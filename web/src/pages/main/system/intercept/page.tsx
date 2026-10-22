"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import {
  BotIcon,
  FileTextIcon,
  ListFilterIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InterceptRule, InterceptAction, JudgeConfig, LLMProfile, Tool } from "@/lib/types";

// ---- tool scope ----

// SDK tools are intentionally not seeded into the DB (they apply to every agent
// and have no per-agent binding). We hardcode them here so they still appear in
// the scope dialog.
function sdkTool(key: string, description: string): Tool {
  return { key, system: true, description, schema: {}, agents: [], enabled: true, kind: "builtin" };
}

const SDK_EXEC: Tool[] = [
  sdkTool("Bash",        "在 shell 中执行命令"),
  sdkTool("WebFetch",    "发起 HTTP/HTTPS 请求（含代理支持）"),
  sdkTool("web_search",  "网络搜索"),
  sdkTool("shell_open",  "开启持久 PTY 交互会话"),
  sdkTool("shell_send",  "向交互会话发送输入"),
  sdkTool("shell_read",  "读取交互会话输出"),
  sdkTool("shell_close", "关闭交互会话"),
  sdkTool("shell_list",  "列出所有交互会话"),
];

const SDK_WRITE: Tool[] = [
  sdkTool("Write",     "写入文件"),
  sdkTool("Edit",      "编辑文件（精确替换）"),
  sdkTool("MultiEdit", "批量编辑文件"),
];

const SDK_KEYS = new Set([...SDK_EXEC, ...SDK_WRITE].map((t) => t.key));

function groupTools(dbTools: Tool[]) {
  const sys: Tool[] = [], custom: Tool[] = [];
  for (const t of dbTools) {
    if (SDK_KEYS.has(t.key)) continue; // already covered by hardcoded groups
    if (t.system) sys.push(t);
    else          custom.push(t);
  }
  return [
    { label: "执行类",      tools: SDK_EXEC },
    { label: "写入/编辑类", tools: SDK_WRITE },
    { label: "系统工具",    tools: sys },
    { label: "自定义工具",  tools: custom },
  ].filter((g) => g.tools.length > 0);
}

// ---- form state ----

type RuleForm = {
  name: string;
  enabled: boolean;
  priority: number;
  match_target: "tool_name" | "tool_input";
  match_type: "string" | "regex";
  pattern: string;
  action: InterceptAction;
  message: string;
  timeout_enabled: boolean;
  timeout_seconds: number;
  timeout_action: "deny" | "allow";
};

const defaultForm = (): RuleForm => ({
  name: "",
  enabled: true,
  priority: 0,
  match_target: "tool_name",
  match_type: "string",
  pattern: "",
  action: "deny",
  message: "",
  timeout_enabled: true,
  timeout_seconds: 60,
  timeout_action: "deny",
});

// ---- small components ----

function ActionBadge({ action }: { action: InterceptAction }) {
  if (action === "allow") {
    return (
      <span className="inline-flex items-center rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
        允许
      </span>
    );
  }
  if (action === "deny") {
    return (
      <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
        禁止
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-warning/25 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
      申请
    </span>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
    </div>
  );
}

// 数值输入：允许清空后再输入。空值/低于下限时暂不提交，失焦回到已提交值。
function NumberInput({
  id,
  value,
  min = 1,
  onValue,
  className,
  label,
}: {
  id?: string;
  value: number;
  min?: number;
  onValue: (n: number) => void;
  className?: string;
  label?: string;
}) {
  const [draft, setDraft] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);
  return (
    <Input
      id={id}
      aria-label={label}
      type="number"
      inputMode="numeric"
      min={min}
      className={className}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (!raw.trim()) return; // 允许清空，等待继续输入
        const n = Number(raw);
        if (Number.isFinite(n) && n >= min) onValue(n);
      }}
      onBlur={() => setFocused(false)}
    />
  );
}

// ---- LLM fallback judge card ----

const FOLLOW_ACTIVE = "0"; // profile_id 0 = 跟随激活/默认配置

const defaultJudge = (): JudgeConfig => ({
  enabled: false,
  profile_id: 0,
  prompt: "",
  timeout_seconds: 15,
  fail_action: "allow",
  ask_timeout_seconds: 300,
  ask_timeout_action: "deny",
});

function JudgeCard() {
  const [cfg, setCfg] = React.useState<JudgeConfig>(defaultJudge());
  const [profiles, setProfiles] = React.useState<LLMProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [j, ps] = await Promise.all([api.interceptGetJudgeConfig(), api.llmProfiles()]);
      setCfg(j);
      setProfiles(ps);
    } catch (e) {
      toast.error("加载模型兜底配置失败: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  function patch(p: Partial<JudgeConfig>) {
    setCfg((c) => ({ ...c, ...p }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.interceptSetJudgeConfig(cfg);
      toast.success("模型兜底配置已保存");
      await load(); // 回读:提示词若清空则回填内置模板
    } catch (e) {
      toast.error("保存失败: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function restorePrompt() {
    // 清空提示词并保存 → 服务端下次返回内置模板全文,回填到输入框。
    setSaving(true);
    try {
      await api.interceptSetJudgeConfig({ ...cfg, prompt: "" });
      const j = await api.interceptGetJudgeConfig();
      setCfg(j);
      toast.success("已恢复内置默认模板");
    } catch (e) {
      toast.error("恢复失败: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 启用开关 —— 独立高亮条 */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
          cfg.enabled ? "border-primary/30 bg-primary/5" : "border-border/70 bg-surface-muted/40",
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", cfg.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
            <BotIcon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight">模型兜底审批</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              在<span className="font-medium text-foreground">拦截范围</span>内、且<span className="font-medium text-foreground">没有任何拦截规则命中</span>的命令，才由模型做语义判断（放行 / 转人工 / 拦截）
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", cfg.enabled ? "border-success/20 bg-success/10 text-success" : "border-transparent bg-muted text-muted-foreground")}>
            {cfg.enabled ? "已启用" : "未启用"}
          </span>
          <Switch aria-label="模型兜底审批" checked={cfg.enabled} disabled={loading} onCheckedChange={(v) => patch({ enabled: v })} />
        </div>
      </div>

      {cfg.enabled && (
        <div className="grid gap-4 xl:grid-cols-5">
          {/* 左:提示词编辑器(直接展开,主区域) */}
          <SectionCard
            icon={FileTextIcon}
            title="审批提示词"
            description="模型据此判定 ALLOW / ASK / DENY，可直接编辑"
            className="xl:col-span-3"
            actions={
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={restorePrompt} disabled={saving}>
                恢复默认模板
              </Button>
            }
          >
            <Textarea
              aria-label="审批提示词"
              className="min-h-[22rem] w-full resize-none font-mono text-xs leading-relaxed"
              value={cfg.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="留空使用内置模板"
              spellCheck={false}
            />
            <p className="mt-2 text-right text-[11px] tabular-nums text-muted-foreground">{cfg.prompt.length} 字</p>
          </SectionCard>

          {/* 右:判定参数(设置栏) */}
          <SectionCard
            icon={SlidersHorizontalIcon}
            title="判定模型与策略"
            description="模型超时、失败与人工审批的兜底动作"
            className="xl:col-span-2"
          >
            <div className="space-y-4">
              <div className="space-y-4">
                <Field label="审批模型" htmlFor="judge-profile">
                  <Select value={String(cfg.profile_id || 0)} onValueChange={(v) => patch({ profile_id: Number(v) })}>
                    <SelectTrigger id="judge-profile"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FOLLOW_ACTIVE}>跟随激活配置</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}（{p.model}）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="模型判定超时（秒）" htmlFor="judge-timeout">
                  <NumberInput
                    id="judge-timeout"
                    min={1}
                    value={cfg.timeout_seconds}
                    onValue={(n) => patch({ timeout_seconds: n })}
                  />
                </Field>
                <Field label="模型失败时（出错 / 超时 / 无法解析）" htmlFor="judge-fail-action">
                  <Select value={cfg.fail_action} onValueChange={(v) => patch({ fail_action: v as JudgeConfig["fail_action"] })}>
                    <SelectTrigger id="judge-fail-action"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">放行</SelectItem>
                      <SelectItem value="ask">转人工审批</SelectItem>
                      <SelectItem value="deny">拦截</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="text-xs font-semibold text-foreground">人工审批（模型判为「转人工」时）</p>
                <Field label="审批等待超时（秒）" htmlFor="judge-ask-timeout">
                  <NumberInput
                    id="judge-ask-timeout"
                    min={5}
                    value={cfg.ask_timeout_seconds}
                    onValue={(n) => patch({ ask_timeout_seconds: n })}
                  />
                </Field>
                <Field label="超时后默认动作" htmlFor="judge-ask-timeout-action">
                  <Select value={cfg.ask_timeout_action} onValueChange={(v) => patch({ ask_timeout_action: v as JudgeConfig["ask_timeout_action"] })}>
                    <SelectTrigger id="judge-ask-timeout-action"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deny">拦截</SelectItem>
                      <SelectItem value="allow">放行</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-[var(--shadow-card)]">
        <p className="text-xs text-muted-foreground">提示词与判定策略修改后需保存才会生效</p>
        <Button size="sm" onClick={save} disabled={saving || loading}>
          {saving ? "保存中…" : "保存配置"}
        </Button>
      </div>
    </div>
  );
}

// ---- page ----

export default function InterceptPage() {
  const [rules, setRules]     = React.useState<InterceptRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [open, setOpen]       = React.useState(false);
  const [editing, setEditing] = React.useState<InterceptRule | null>(null);
  const [form, setForm]       = React.useState<RuleForm>(defaultForm());
  const [saving, setSaving]   = React.useState(false);
  const [regexErr, setRegexErr] = React.useState("");
  const [regexWarn, setRegexWarn] = React.useState(false); // true = JS 无法解析但可能是合法 Go 语法
  const [nameErr, setNameErr] = React.useState("");
  const [patternErr, setPatternErr] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<InterceptRule | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // ---- tool scope dialog ----
  const [scopeOpen, setScopeOpen]       = React.useState(false);
  const [allTools, setAllTools]         = React.useState<Tool[]>([]);
  const [enabledTools, setEnabledTools] = React.useState<Set<string>>(new Set());
  const [scopeLoading, setScopeLoading] = React.useState(false);
  const [scopeSaving, setScopeSaving]   = React.useState(false);
  const [scopeTools, setScopeTools]     = React.useState<string[]>([]); // 页头信息条:当前进入拦截的工具
  // 页签内容默认在切走时卸载，而模型兜底配置的表单状态在 JudgeCard 内部：
  // 切去「拦截规则」看一眼再回来，提示词/超时等未保存的编辑就没了。首次进入后常驻。
  const [judgeMounted, setJudgeMounted] = React.useState(false);
  const [tab, setTab] = React.useState("rules");

  // ---- data ----

  const loadScope = React.useCallback(async () => {
    try {
      const cfg = await api.interceptGetToolConfig();
      setScopeTools(cfg.enabled_tools);
    } catch {
      // 信息条非关键,失败静默
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      const r = await api.interceptRules();
      setRules(r);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); loadScope(); }, [load, loadScope]);

  React.useEffect(() => {
    if (form.match_type !== "regex" || !form.pattern) { setRegexErr(""); setRegexWarn(false); return; }
    try {
      new RegExp(form.pattern);
      setRegexErr("");
      setRegexWarn(false);
    } catch (error) {
      // Preview known RE2-only syntax without rejecting valid Go patterns.
      // Still reject malformed structure such as an unterminated character class.
      const preview = form.pattern
        .replace(/\\Q([\s\S]*?)(?:\\E|$)/g, (_, literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .replace(/\(\?[imsU-]+\)/g, "")
        .replace(/\(\?[imsU-]+:/g, "(?:")
        .replace(/\(\?P</g, "(?<");
      try {
        new RegExp(preview);
        setRegexErr("");
        setRegexWarn(true);
      } catch {
        setRegexErr(error instanceof Error ? error.message : "正则表达式语法无效");
        setRegexWarn(false);
      }
    }
  }, [form.pattern, form.match_type]);

  // ---- rule handlers ----

  function set(patch: Partial<RuleForm>) { setForm(f => ({ ...f, ...patch })); }

  function openNew() {
    setEditing(null);
    setForm(defaultForm());
    setRegexErr("");
    setNameErr("");
    setPatternErr("");
    setOpen(true);
  }

  function openEdit(rule: InterceptRule) {
    setEditing(rule);
    setForm({
      name: rule.name, enabled: rule.enabled, priority: rule.priority,
      match_target: rule.match_target, match_type: rule.match_type,
      pattern: rule.pattern, action: rule.action, message: rule.message,
      timeout_enabled: rule.timeout_enabled, timeout_seconds: rule.timeout_seconds,
      timeout_action: rule.timeout_action,
    });
    setRegexErr("");
    setNameErr("");
    setPatternErr("");
    setOpen(true);
  }

  async function handleSave() {
    const nextNameErr = form.name.trim() ? "" : "名称不能为空";
    const nextPatternErr = form.pattern.trim() ? "" : "模式不能为空";
    setNameErr(nextNameErr);
    setPatternErr(nextPatternErr);
    if (nextNameErr || nextPatternErr || regexErr) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateInterceptRule(editing.id, form);
        toast.success("规则已更新");
      } else {
        await api.createInterceptRule(form);
        toast.success("规则已创建");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteInterceptRule(deleteTarget.id);
      toast.success("规则已删除");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle(rule: InterceptRule) {
    try {
      await api.toggleInterceptRule(rule.id, !rule.enabled);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // ---- scope handlers ----

  async function openScope() {
    setScopeOpen(true);
    setScopeLoading(true);
    try {
      const [tools, cfg] = await Promise.all([api.tools(), api.interceptGetToolConfig()]);
      setAllTools(tools);
      setEnabledTools(new Set(cfg.enabled_tools));
    } catch (e) {
      toast.error("加载失败: " + (e as Error).message);
    } finally {
      setScopeLoading(false);
    }
  }

  function toggleTool(key: string, val: boolean) {
    setEnabledTools(prev => {
      const next = new Set(prev);
      if (val) next.add(key); else next.delete(key);
      return next;
    });
  }

  async function saveScope() {
    setScopeSaving(true);
    try {
      await api.interceptSetToolConfig([...enabledTools]);
      toast.success("拦截范围已保存");
      setScopeTools([...enabledTools]);
      setScopeOpen(false);
    } catch (e) {
      toast.error("保存失败: " + (e as Error).message);
    } finally {
      setScopeSaving(false);
    }
  }

  const patternError = patternErr || regexErr;
  const toolGroups = React.useMemo(() => groupTools(allTools), [allTools]);

  // ---- render ----

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">

      <PageHeader
        icon={ShieldAlertIcon}
        title="命令拦截"
        description="工具执行前先按拦截规则匹配；未命中的命令可交由模型兜底判定。"
        meta={[
          <span className="tabular-nums">{scopeTools.length} 个工具在拦截范围</span>,
          <span className="tabular-nums">
            {rules.length} 条规则（{rules.filter((rule) => rule.enabled).length} 条启用）
          </span>,
        ]}
        actions={
          <Button onClick={openNew} size="sm">
            <PlusIcon className="size-4" />
            新建规则
          </Button>
        }
      />

      {/* ---- 拦截范围信息条（规则匹配与模型兜底共用：不在范围内的工具两者都不介入）---- */}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
          scopeTools.length === 0
            ? "border-warning/40 bg-warning/5"
            : "border-border/60 bg-card shadow-[var(--shadow-card)]",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-[13px]">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ListFilterIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="shrink-0 font-semibold">拦截范围</span>
          {scopeTools.length === 0 ? (
            <span className="text-warning">
              未启用任何工具 — 拦截规则与模型兜底均不会生效
            </span>
          ) : (
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={scopeTools.join("、")}>
              {scopeTools.join("、")}
            </span>
          )}
        </div>
        {/* 全页唯一的主操作是页头的「新建规则」；范围为空时的强调交给这条警告色信息条，
            按钮本身保持 outline，避免同屏出现两个 primary（REFINE-SPEC 二.4）。 */}
        <Button
          variant="outline"
          size="sm"
          className={cn("shrink-0", scopeTools.length === 0 && "border-warning/40 text-warning hover:text-warning")}
          onClick={openScope}
        >
          <ListFilterIcon className="size-4" />
          调整范围
        </Button>
      </div>

      <Tabs
        defaultValue="rules"
        className="flex flex-col gap-4"
        onValueChange={(value) => {
          setTab(value);
          if (value === "judge") setJudgeMounted(true);
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="rules">拦截规则</TabsTrigger>
            <TabsTrigger value="judge">模型配置</TabsTrigger>
          </TabsList>
          {tab === "rules" ? (
            <p className="min-w-0 text-xs text-muted-foreground">
              按优先级（数字越大越先）逐条匹配，首条命中的规则生效
            </p>
          ) : null}
        </div>

        {/* ---- tab: 拦截规则 ---- */}
        <TabsContent value="rules" className="mt-0">
          <SectionCard
            icon={ShieldCheckIcon}
            title="拦截规则"
            description="命中即执行对应策略；停用的规则仍保留配置，但不参与匹配。"
            bodyClassName="px-0 pb-0"
          >
            {loading ? (
              <div className="flex flex-col gap-2 px-5 pb-5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-muted" />
                ))}
              </div>
            ) : loadError ? (
              <div role="alert" className="flex flex-col items-center justify-center gap-1.5 px-5 py-6 text-center">
                <ShieldAlertIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-[13px] font-medium text-foreground">加载拦截规则失败</p>
                <p className="max-w-md text-xs text-muted-foreground [overflow-wrap:anywhere]">{loadError}</p>
                <Button size="sm" variant="outline" className="h-8" onClick={() => void load()}>
                  重试
                </Button>
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 px-5 py-6 text-center">
                <ShieldAlertIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-[13px] font-medium text-foreground">暂无规则</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  新建第一条规则，为高危命令设置允许、禁止或转人工审批。
                </p>
                <Button size="sm" variant="outline" className="h-8" onClick={openNew}>
                  <PlusIcon className="size-4" />
                  新建第一条规则
                </Button>
              </div>
            ) : (
              <>
                <p className="px-5 pb-2 text-xs text-muted-foreground sm:hidden">左右滑动表格查看模式、策略与启用状态。</p>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[72px]">优先级</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead className="w-[96px]">目标</TableHead>
                    <TableHead className="w-[76px]">类型</TableHead>
                    <TableHead>模式</TableHead>
                    <TableHead className="w-[72px]">策略</TableHead>
                    <TableHead className="w-[64px] text-center">启用</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id} className={cn("h-11", !rule.enabled && "text-muted-foreground")}>
                      <TableCell>
                        <span className="inline-flex min-w-7 items-center justify-center rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
                          {rule.priority}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn("max-w-[260px] truncate text-[13px] font-medium", rule.enabled && "text-foreground")}
                        title={rule.name}
                      >
                        {rule.name}
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px]">
                          {rule.match_target === "tool_name" ? "工具名" : "输入内容"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px]">
                          {rule.match_type === "regex" ? "正则" : "字符串"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <code
                          className="inline-block max-w-full truncate rounded bg-muted/50 px-1.5 py-0.5 align-middle font-mono text-[12px]"
                          title={rule.pattern}
                        >
                          {rule.pattern}
                        </code>
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={rule.action} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          aria-label={`启用规则 ${rule.name}`}
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggle(rule)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="icon" variant="ghost" className="size-7"
                            onClick={() => openEdit(rule)}
                            aria-label={`编辑规则 ${rule.name}`}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(rule)}
                            aria-label={`删除规则 ${rule.name}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
          </SectionCard>
        </TabsContent>

        {/* ---- tab: 模型配置 ---- */}
        {judgeMounted && (
          <TabsContent value="judge" forceMount className="mt-0 data-[state=inactive]:hidden">
            <JudgeCard />
          </TabsContent>
        )}
      </Tabs>

      {/* ---- editor sheet ---- */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{editing ? "编辑规则" : "新建规则"}</SheetTitle>
            <SheetDescription className="text-xs">
              优先级越大越先匹配；首条命中规则生效，后续跳过
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            <Field label="名称" htmlFor="rule-name">
              <Input
                id="rule-name"
                aria-invalid={!!nameErr}
                aria-describedby={nameErr ? "rule-name-error" : undefined}
                placeholder="给规则起个名字"
                value={form.name}
                onChange={(e) => {
                  setNameErr("");
                  set({ name: e.target.value });
                }}
                className={nameErr ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {nameErr && (
                <p id="rule-name-error" role="alert" className="text-xs text-destructive mt-1">{nameErr}</p>
              )}
            </Field>

            <Field label="优先级（数字越大越先匹配）" htmlFor="rule-priority">
              <Input
                id="rule-priority"
                type="number"
                value={form.priority}
                onChange={(e) => set({ priority: parseInt(e.target.value) || 0 })}
              />
            </Field>

            <Separator />

            <Field label="匹配目标" htmlFor="rule-match-target">
              <Select
                value={form.match_target}
                onValueChange={(v) => set({ match_target: v as RuleForm["match_target"] })}
              >
                <SelectTrigger id="rule-match-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tool_name">工具名（tool_name）</SelectItem>
                  <SelectItem value="tool_input">输入内容（tool_input JSON）</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="匹配类型" htmlFor="rule-match-type">
              <Select
                value={form.match_type}
                onValueChange={(v) => set({ match_type: v as RuleForm["match_type"] })}
              >
                <SelectTrigger id="rule-match-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">字符串包含</SelectItem>
                  <SelectItem value="regex">正则表达式</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="模式" htmlFor="rule-pattern">
              <Input
                id="rule-pattern"
                aria-invalid={!!patternError}
                aria-describedby={patternError ? "rule-pattern-error" : undefined}
                placeholder={form.match_type === "regex" ? "^Bash$" : "rm -rf"}
                value={form.pattern}
                onChange={(e) => {
                  setPatternErr("");
                  set({ pattern: e.target.value });
                }}
                className={patternError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {patternError && (
                <p id="rule-pattern-error" role="alert" className="text-xs text-destructive mt-1">{patternError}</p>
              )}
              {regexWarn && (
                <p className="text-xs text-warning mt-1">包含 Go RE2 扩展语法（如 <code className="font-mono">(?i)</code>），浏览器无法预览，提交后由服务端验证</p>
              )}
            </Field>

            <Separator />

            <Field label="拦截策略" htmlFor="rule-action">
              <Select
                value={form.action}
                onValueChange={(v) => set({ action: v as InterceptAction })}
              >
                <SelectTrigger id="rule-action"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">允许 — 直接放行，跳过后续规则</SelectItem>
                  <SelectItem value="deny">禁止 — 阻断，返回拒绝消息给模型</SelectItem>
                  <SelectItem value="ask">向用户申请 — 等待审批</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {form.action !== "allow" && (
              <Field label={form.action === "deny" ? "拒绝消息（返回给模型）" : "审批说明（可选）"} htmlFor="rule-message">
                <Textarea
                  id="rule-message"
                  placeholder={form.action === "deny" ? "操作被安全策略阻止" : ""}
                  value={form.message}
                  onChange={(e) => set({ message: e.target.value })}
                  rows={2}
                  className="resize-none"
                />
              </Field>
            )}

            {form.action === "ask" && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">启用审批超时</p>
                    <p className="text-xs text-muted-foreground">超时后自动处置，不再等待</p>
                  </div>
                  <Switch
                    aria-label="启用审批超时"
                    checked={form.timeout_enabled}
                    onCheckedChange={(v) => set({ timeout_enabled: v })}
                  />
                </div>
                {form.timeout_enabled && (
                  <div className="flex items-end gap-3">
                    <Field label="超时时间（秒）" htmlFor="rule-timeout">
                      <NumberInput
                        id="rule-timeout"
                        min={5}
                        className="w-28"
                        value={form.timeout_seconds}
                        onValue={(n) => set({ timeout_seconds: n })}
                      />
                    </Field>
                    <Field label="超时动作" htmlFor="rule-timeout-action">
                      <Select
                        value={form.timeout_action}
                        onValueChange={(v) => set({ timeout_action: v as "deny" | "allow" })}
                      >
                        <SelectTrigger id="rule-timeout-action" className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deny">自动拒绝</SelectItem>
                          <SelectItem value="allow">自动允许</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}
              </>
            )}

            <Separator />

            <div className="flex items-center gap-3">
              <Switch
                id="rule-enabled"
                checked={form.enabled}
                onCheckedChange={(v) => set({ enabled: v })}
              />
              <Label htmlFor="rule-enabled" className="cursor-pointer">启用此规则</Label>
            </div>
          </div>

          <SheetFooter className="border-t px-6 py-4 flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || !!regexErr}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ---- delete confirm ---- */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
        title="删除拦截规则？"
        description={
          deleteTarget
            ? `删除「${deleteTarget.name}」后该规则不再生效，之后匹配该模式的工具调用不会再被它拦截或放行。`
            : undefined
        }
        confirmLabel="删除"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
      />

      {/* ---- scope dialog ---- */}
      <Dialog open={scopeOpen} onOpenChange={setScopeOpen}>
        <DialogContent className="sm:max-w-lg flex flex-col overflow-hidden p-0 gap-0" style={{ maxHeight: "min(80vh, 560px)" }}>
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <ListFilterIcon className="h-4 w-4" />
              拦截范围
            </DialogTitle>
            <DialogDescription className="text-xs">
              只有启用拦截的工具才会进入规则匹配；其余工具直接放行
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
            {scopeLoading ? (
              <p className="text-sm text-muted-foreground py-4">加载中…</p>
            ) : (
              toolGroups.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <Separator className="mb-5" />}
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.tools.map((t) => (
                      <div key={t.key} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <Switch
                          id={`scope-${t.key}`}
                          checked={enabledTools.has(t.key)}
                          onCheckedChange={(v) => toggleTool(t.key, v)}
                        />
                        <label htmlFor={`scope-${t.key}`} className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm">{t.key}</span>
                            {(t.kind && t.kind !== "builtin") && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[11px]">{t.kind}</Badge>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 border-t px-6 py-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setScopeOpen(false)}>取消</Button>
            <Button size="sm" onClick={saveScope} disabled={scopeSaving || scopeLoading}>
              {scopeSaving ? "保存中…" : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
