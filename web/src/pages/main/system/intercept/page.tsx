import * as React from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { BotIcon, ListFilterIcon, PencilIcon, PlusIcon, ShieldAlertIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { InterceptAction, InterceptRule, JudgeConfig, LLMProfile, Tool } from "@/lib/types";

// ---- tool scope ----
// SDK tools are intentionally not seeded into the DB (they apply to every agent
// and have no per-agent binding). We hardcode them here so they still appear in
// the scope dialog.
function sdkTool(key: string, description: string): Tool {
  return { key, system: true, description, schema: {}, agents: [], enabled: true, kind: "builtin" };
}
const SDK_EXEC: Tool[] = [
  sdkTool("Bash", "在 shell 中执行命令"),
  sdkTool("WebFetch", "发起 HTTP/HTTPS 请求（含代理支持）"),
  sdkTool("web_search", "网络搜索"),
  sdkTool("shell_open", "开启持久 PTY 交互会话"),
  sdkTool("shell_send", "向交互会话发送输入"),
  sdkTool("shell_read", "读取交互会话输出"),
  sdkTool("shell_close", "关闭交互会话"),
  sdkTool("shell_list", "列出所有交互会话"),
];
const SDK_WRITE: Tool[] = [
  sdkTool("Write", "写入文件"),
  sdkTool("Edit", "编辑文件（精确替换）"),
  sdkTool("MultiEdit", "批量编辑文件"),
];
const SDK_KEYS = new Set([...SDK_EXEC, ...SDK_WRITE].map((t) => t.key));
function groupTools(dbTools: Tool[]) {
  const sys: Tool[] = [],
    custom: Tool[] = [];
  for (const t of dbTools) {
    if (SDK_KEYS.has(t.key)) continue; // already covered by hardcoded groups
    if (t.system) sys.push(t);
    else custom.push(t);
  }
  return [
    { label: "执行类", tools: SDK_EXEC },
    { label: "写入/编辑类", tools: SDK_WRITE },
    { label: "系统工具", tools: sys },
    { label: "自定义工具", tools: custom },
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
  if (action === "allow") return <Chip size="small" variant="filled" label={<>允许</>} />;
  if (action === "deny") return <Chip size="small" variant="filled" color="error" label={<>禁止</>} />;
  return <Chip className="border-warning text-warning" size="small" variant="filled" label={<>申请</>} />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Box
        component="span"
        className="text-xs font-medium text-muted uppercase tracking-wide"
        sx={{ fontSize: "inherit" }}
      >
        {label}
      </Box>
      {children}
    </div>
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
    void load();
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
    <div className="space-y-4">
      {/* 启用开关 —— 独立高亮条 */}
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${cfg.enabled ? "border-accent/50 bg-accent-soft/40 dark:bg-accent/20" : "bg-surface-secondary/40"}`}
      >
        <div className="flex items-center gap-2.5">
          <BotIcon className={`h-5 w-5 shrink-0 ${cfg.enabled ? "text-accent" : "text-muted"}`} />
          <div>
            <p className="text-sm font-semibold leading-tight">模型兜底审批</p>
            <p className="text-xs text-muted mt-0.5">
              在<span className="font-medium text-foreground">拦截范围</span>内、且
              <span className="font-medium text-foreground">没有任何拦截规则命中</span>的命令，才由模型做语义判断（放行
              / 转人工 / 拦截）
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted">{cfg.enabled ? "已启用" : "未启用"}</span>
          <Switch
            disabled={loading}
            checked={cfg.enabled}
            onChange={(_event, checked) => ((v) => patch({ enabled: v }))(checked)}
            size="small"
            slotProps={{ input: { "aria-label": "模型兜底审批" } }}
          />
        </div>
      </div>

      {cfg.enabled && (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* 左:提示词编辑器(直接展开,主区域) */}
          <Card className="lg:col-span-3" variant="outlined">
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">审批提示词</p>
                  <p className="text-xs text-muted">模型据此判定 ALLOW / ASK / DENY，可直接编辑</p>
                </div>
                <Button className="h-7 text-xs" onClick={restorePrompt} disabled={saving} size="small" variant="text">
                  恢复默认模板
                </Button>
              </div>
              <TextField
                value={cfg.prompt}
                onChange={(e) => patch({ prompt: e.target.value })}
                placeholder="留空使用内置模板"
                spellCheck={false}
                className={"min-h-[22rem] flex-1 resize-none font-mono text-xs leading-relaxed"}
                multiline
                minRows={3}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "留空使用内置模板" } }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
              <p className="text-right text-[11px] text-muted">{cfg.prompt.length} 字</p>
            </CardContent>
          </Card>

          {/* 右:判定参数(设置栏) */}
          <Card className="lg:col-span-2" variant="outlined">
            <CardContent className="space-y-5 p-4">
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">判定模型与策略</p>
                <Field label="审批模型">
                  <Select
                    value={String(cfg.profile_id || 0)}
                    onChange={(event) =>
                      ((key) => {
                        if (key !== null) ((v) => patch({ profile_id: Number(v) }))(String(key));
                      })(event.target.value)
                    }
                    size="small"
                    inputProps={{ "aria-label": "审批模型" }}
                  >
                    <MenuItem value={FOLLOW_ACTIVE}>跟随激活配置</MenuItem>
                    {profiles.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}（{p.model}）
                      </MenuItem>
                    ))}
                  </Select>
                </Field>
                <Field label="模型判定超时（秒）">
                  <TextField
                    type="number"
                    size="small"
                    value={
                      Number.isNaN(String(cfg.timeout_seconds) === "" ? NaN : Number(cfg.timeout_seconds))
                        ? ""
                        : String(cfg.timeout_seconds) === ""
                          ? NaN
                          : Number(cfg.timeout_seconds)
                    }
                    onChange={(event) =>
                      ((nextValue) => {
                        const n = parseInt(Number.isNaN(nextValue) ? "" : String(nextValue), 10);
                        if (n > 0) patch({ timeout_seconds: n });
                      })(event.target.value === "" ? NaN : Number(event.target.value))
                    }
                    slotProps={{ htmlInput: { min: 1, max: undefined, "aria-label": "模型判定超时（秒）" } }}
                  />
                </Field>
                <Field label="模型失败时（出错 / 超时 / 无法解析）">
                  <Select
                    value={cfg.fail_action}
                    onChange={(event) =>
                      ((key) => {
                        if (key !== null) ((v) => patch({ fail_action: v as JudgeConfig["fail_action"] }))(String(key));
                      })(event.target.value)
                    }
                    size="small"
                    inputProps={{ "aria-label": "模型失败时（出错 / 超时 / 无法解析）" }}
                  >
                    <MenuItem value={"allow"}>放行</MenuItem>
                    <MenuItem value={"ask"}>转人工审批</MenuItem>
                    <MenuItem value={"deny"}>拦截</MenuItem>
                  </Select>
                </Field>
              </div>

              <Divider />

              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  人工审批（模型判为「转人工」时）
                </p>
                <Field label="审批等待超时（秒）">
                  <TextField
                    type="number"
                    size="small"
                    value={
                      Number.isNaN(String(cfg.ask_timeout_seconds) === "" ? NaN : Number(cfg.ask_timeout_seconds))
                        ? ""
                        : String(cfg.ask_timeout_seconds) === ""
                          ? NaN
                          : Number(cfg.ask_timeout_seconds)
                    }
                    onChange={(event) =>
                      ((nextValue) => {
                        const n = parseInt(Number.isNaN(nextValue) ? "" : String(nextValue), 10);
                        if (n > 0) patch({ ask_timeout_seconds: n });
                      })(event.target.value === "" ? NaN : Number(event.target.value))
                    }
                    slotProps={{ htmlInput: { min: 5, max: undefined, "aria-label": "审批等待超时（秒）" } }}
                  />
                </Field>
                <Field label="超时后默认动作">
                  <Select
                    value={cfg.ask_timeout_action}
                    onChange={(event) =>
                      ((key) => {
                        if (key !== null)
                          ((v) => patch({ ask_timeout_action: v as JudgeConfig["ask_timeout_action"] }))(String(key));
                      })(event.target.value)
                    }
                    size="small"
                    inputProps={{ "aria-label": "超时后默认动作" }}
                  >
                    <MenuItem value={"deny"}>拦截</MenuItem>
                    <MenuItem value={"allow"}>放行</MenuItem>
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || loading} size="small" variant="contained">
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
}
// ---- page ----
export default function InterceptPage() {
  const [viewTab, setViewTab] = React.useState("rules");
  const [rules, setRules] = React.useState<InterceptRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InterceptRule | null>(null);
  const [form, setForm] = React.useState<RuleForm>(defaultForm());
  const [saving, setSaving] = React.useState(false);
  const [regexErr, setRegexErr] = React.useState("");
  const [regexWarn, setRegexWarn] = React.useState(false); // true = JS 无法解析但可能是合法 Go 语法
  // ---- tool scope dialog ----
  const [scopeOpen, setScopeOpen] = React.useState(false);
  const [allTools, setAllTools] = React.useState<Tool[]>([]);
  const [enabledTools, setEnabledTools] = React.useState<Set<string>>(new Set());
  const [scopeLoading, setScopeLoading] = React.useState(false);
  const [scopeSaving, setScopeSaving] = React.useState(false);
  const [scopeTools, setScopeTools] = React.useState<string[]>([]); // 页头信息条:当前进入拦截的工具
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
    } catch {
      toast.error("加载拦截规则失败");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void load();
    void loadScope();
  }, [load, loadScope]);
  React.useEffect(() => {
    if (form.match_type !== "regex" || !form.pattern) {
      setRegexErr("");
      setRegexWarn(false);
      return;
    }
    try {
      new RegExp(form.pattern);
      setRegexErr("");
      setRegexWarn(false);
    } catch {
      // Go RE2 支持的内联 flag（如 (?i)）在 JavaScript 中无法预览，交给服务端验证。
      // 其它语法错误在提交前阻止保存，避免把明确无效的规则写入配置。
      if (/\(\?[imsU-]+\)/.test(form.pattern) || /\(\?[imsU-]+:/.test(form.pattern)) {
        setRegexErr("");
        setRegexWarn(true);
      } else {
        setRegexErr("正则表达式语法无效");
        setRegexWarn(false);
      }
    }
  }, [form.pattern, form.match_type]);
  // ---- rule handlers ----
  function set(patch: Partial<RuleForm>) {
    setForm((f) => ({ ...f, ...patch }));
  }
  function openNew() {
    setEditing(null);
    setForm(defaultForm());
    setRegexErr("");
    setOpen(true);
  }
  function openEdit(rule: InterceptRule) {
    setEditing(rule);
    setForm({
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      match_target: rule.match_target,
      match_type: rule.match_type,
      pattern: rule.pattern,
      action: rule.action,
      message: rule.message,
      timeout_enabled: rule.timeout_enabled,
      timeout_seconds: rule.timeout_seconds,
      timeout_action: rule.timeout_action,
    });
    setRegexErr("");
    setOpen(true);
  }
  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    if (!form.pattern.trim()) {
      toast.error("模式不能为空");
      return;
    }
    if (regexErr) {
      toast.error("正则表达式语法无效");
      return;
    }
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
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(id: number) {
    try {
      await api.deleteInterceptRule(id);
      toast.success("规则已删除");
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function handleToggle(rule: InterceptRule) {
    try {
      await api.toggleInterceptRule(rule.id, !rule.enabled);
      void load();
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
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (val) next.add(key);
      else next.delete(key);
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
  const toolGroups = React.useMemo(() => groupTools(allTools), [allTools]);
  // ---- render ----
  return (
    <div className="flex flex-1 flex-col gap-5 p-6">
      {/* ---- header ---- */}
      <div className="flex items-center gap-2.5">
        <ShieldAlertIcon className="h-5 w-5 shrink-0" />
        <div>
          <h1 className="text-lg font-semibold leading-tight">命令拦截</h1>
          <p className="text-sm text-muted mt-0.5">工具执行前先按拦截规则匹配；未命中的命令可交由模型兜底判定</p>
        </div>
      </div>

      {/* ---- 拦截范围信息条（规则匹配与模型兜底共用：不在范围内的工具两者都不介入）---- */}
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 ${
          scopeTools.length === 0
            ? "border-warning/60 bg-warning-soft/50 dark:bg-warning/20"
            : "bg-surface-secondary/40"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <ListFilterIcon className="h-4 w-4 shrink-0 text-muted" />
          <span className="shrink-0 font-medium">拦截范围</span>
          {scopeTools.length === 0 ? (
            <span className="text-warning dark:text-warning">未启用任何工具 — 拦截规则与模型兜底均不会生效</span>
          ) : (
            <>
              <Chip className="shrink-0" size="small" variant="filled" label={<>{scopeTools.length} 个工具</>} />
              <span className="truncate text-muted" title={scopeTools.join("、")}>
                {scopeTools.join("、")}
              </span>
            </>
          )}
        </div>
        <Button
          className="shrink-0"
          onClick={openScope}
          aria-label="拦截范围 调整范围"
          size="small"
          variant={
            (scopeTools.length === 0 ? "primary" : "outline") === "outline"
              ? "outlined"
              : (scopeTools.length === 0 ? "primary" : "outline") === "primary"
                ? "contained"
                : "text"
          }
        >
          <ListFilterIcon className="h-4 w-4" />
          调整范围
        </Button>
      </div>

      <Box className="flex-1" sx={{ minWidth: 0 }}>
        <Tabs
          value={viewTab}
          onChange={(_event, value: string) => setViewTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, flexShrink: 0, mb: 2, maxWidth: "100%" }}
        >
          <Tab
            value={"rules"}
            label={<>拦截规则</>}
            id={"intercept-tab-" + "rules"}
            aria-controls={"intercept-panel-" + "rules"}
          />
          <Tab
            value={"judge"}
            label={<>模型兜底</>}
            id={"intercept-tab-" + "judge"}
            aria-controls={"intercept-panel-" + "judge"}
          />
        </Tabs>

        {/* ---- tab: 拦截规则 ---- */}
        <>
          {viewTab === "rules" && (
            <Box
              className="mt-4 flex flex-col gap-4"
              role="tabpanel"
              id={"intercept-panel-" + "rules"}
              aria-labelledby={"intercept-tab-" + "rules"}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted">按优先级（数字越大越先）逐条匹配，首条命中的规则生效</p>
                <Button onClick={openNew} className="shrink-0" size="small" variant="contained">
                  <PlusIcon className="h-4 w-4" />
                  新建规则
                </Button>
              </div>

              <Card variant="outlined">
                <CardContent className="p-0">
                  {loading ? (
                    <p className="p-6 text-sm text-muted">加载中…</p>
                  ) : rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <ShieldAlertIcon className="h-8 w-8 text-muted/40" />
                      <p className="text-sm text-muted">暂无规则</p>
                      <Button onClick={openNew} size="small" variant="outlined">
                        <PlusIcon className="h-4 w-4" />
                        新建第一条规则
                      </Button>
                    </div>
                  ) : (
                    <TableContainer>
                      <Table aria-label="数据表" size="small" sx={{ minWidth: 800, "& th": { whiteSpace: "nowrap" } }}>
                        <TableHead>
                          <TableRow>
                            <TableCell className="w-[72px]" component="th" scope="col">
                              优先级
                            </TableCell>
                            <TableCell component="th" scope="col">
                              名称
                            </TableCell>
                            <TableCell className="w-[90px]" component="th" scope="col">
                              目标
                            </TableCell>
                            <TableCell className="w-[80px]" component="th" scope="col">
                              类型
                            </TableCell>
                            <TableCell component="th" scope="col">
                              模式
                            </TableCell>
                            <TableCell className="w-[72px]" component="th" scope="col">
                              策略
                            </TableCell>
                            <TableCell className="w-[64px] text-center" component="th" scope="col">
                              启用
                            </TableCell>
                            <TableCell className="w-[80px]" component="th" scope="col" />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rules.map((rule) => (
                            <TableRow key={rule.id} className={!rule.enabled ? "opacity-40" : ""}>
                              <TableCell>
                                <span className="font-mono text-xs tabular-nums">{rule.priority}</span>
                              </TableCell>
                              <TableCell className="font-medium text-sm">{rule.name}</TableCell>
                              <TableCell>
                                <span className="text-xs text-muted">
                                  {rule.match_target === "tool_name" ? "工具名" : "输入内容"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted">
                                  {rule.match_type === "regex" ? "正则" : "字符串"}
                                </span>
                              </TableCell>
                              <TableCell className="max-w-[220px]">
                                <code className="block truncate rounded bg-surface-secondary px-1.5 py-0.5 text-xs font-mono">
                                  {rule.pattern}
                                </code>
                              </TableCell>
                              <TableCell>
                                <ActionBadge action={rule.action} />
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={rule.enabled}
                                  onChange={() => handleToggle(rule)}
                                  size="small"
                                  slotProps={{ input: { "aria-label": `启用规则 ${rule.name}` } }}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-0.5">
                                  <IconButton
                                    className="h-7 w-7"
                                    onClick={() => openEdit(rule)}
                                    aria-label="编辑规则"
                                    size="small"
                                  >
                                    <PencilIcon className="h-3.5 w-3.5" />
                                  </IconButton>
                                  <IconButton
                                    className="h-7 w-7 text-danger hover:text-danger"
                                    onClick={() => handleDelete(rule.id)}
                                    aria-label="删除规则"
                                    size="small"
                                  >
                                    <Trash2Icon className="h-3.5 w-3.5" />
                                  </IconButton>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </>

        {/* ---- tab: 模型配置 ---- */}
        <>
          {viewTab === "judge" && (
            <Box
              className="mt-4"
              role="tabpanel"
              id={"intercept-panel-" + "judge"}
              aria-labelledby={"intercept-tab-" + "judge"}
            >
              <JudgeCard />
            </Box>
          )}
        </>
      </Box>

      {/* ---- editor sheet ---- */}

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            "aria-labelledby": "intercept-rule-title",
            sx: { width: { xs: "100vw", sm: "clamp(420px,45vw,760px)" }, maxWidth: "100vw", overflow: "hidden" },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative" }}>
          <IconButton
            aria-label="关闭"
            onClick={() => setOpen(false)}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12, zIndex: 1 }}
          >
            <XIcon size={18} />
          </IconButton>
          <Box className="border-b px-6 py-4" sx={{ py: 2, px: 2, pr: 5 }}>
            <Typography id="intercept-rule-title" component="h2" variant="h6">
              {editing ? "编辑规则" : "新建规则"}
            </Typography>
            <Typography className="text-xs" variant="body2" color="text.secondary">
              优先级越大越先匹配；首条命中规则生效，后续跳过
            </Typography>
          </Box>

          <Box
            className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5"
            data-scrollbar="thin"
            data-slot="scroll-shadow"
            sx={{ overflowY: "auto", overflowX: "hidden" }}
          >
            <Field label="名称">
              <TextField
                placeholder="给规则起个名字"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "名称" } }}
              />
            </Field>

            <Field label="优先级（数字越大越先匹配）">
              <TextField
                type="number"
                size="small"
                value={
                  Number.isNaN(String(form.priority) === "" ? NaN : Number(form.priority))
                    ? ""
                    : String(form.priority) === ""
                      ? NaN
                      : Number(form.priority)
                }
                onChange={(event) =>
                  ((nextValue) => set({ priority: parseInt(Number.isNaN(nextValue) ? "" : String(nextValue)) || 0 }))(
                    event.target.value === "" ? NaN : Number(event.target.value),
                  )
                }
                slotProps={{
                  htmlInput: { min: undefined, max: undefined, "aria-label": "优先级（数字越大越先匹配）" },
                }}
              />
            </Field>

            <Divider />

            <Field label="匹配目标">
              <Select
                value={form.match_target}
                onChange={(event) =>
                  ((key) => {
                    if (key !== null) ((v) => set({ match_target: v as RuleForm["match_target"] }))(String(key));
                  })(event.target.value)
                }
                size="small"
                inputProps={{ "aria-label": "匹配目标" }}
              >
                <MenuItem value={"tool_name"}>工具名（tool_name）</MenuItem>
                <MenuItem value={"tool_input"}>输入内容（tool_input JSON）</MenuItem>
              </Select>
            </Field>

            <Field label="匹配类型">
              <Select
                value={form.match_type}
                onChange={(event) =>
                  ((key) => {
                    if (key !== null) ((v) => set({ match_type: v as RuleForm["match_type"] }))(String(key));
                  })(event.target.value)
                }
                size="small"
                inputProps={{ "aria-label": "匹配类型" }}
              >
                <MenuItem value={"string"}>字符串包含</MenuItem>
                <MenuItem value={"regex"}>正则表达式</MenuItem>
              </Select>
            </Field>

            <Field label="模式">
              <TextField
                placeholder={form.match_type === "regex" ? "^Bash$" : "rm -rf"}
                value={form.pattern}
                onChange={(e) => set({ pattern: e.target.value })}
                className={regexErr ? "border-danger focus-visible:ring-danger" : ""}
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "模式" } }}
              />
              {regexErr && <p className="text-xs text-danger mt-1">{regexErr}</p>}
              {regexWarn && (
                <p className="text-xs text-warning mt-1">
                  包含 Go RE2 扩展语法（如 <code className="font-mono">(?i)</code>
                  ），浏览器无法预览，提交后由服务端验证
                </p>
              )}
            </Field>

            <Divider />

            <Field label="拦截策略">
              <Select
                value={form.action}
                onChange={(event) =>
                  ((key) => {
                    if (key !== null) ((v) => set({ action: v as InterceptAction }))(String(key));
                  })(event.target.value)
                }
                size="small"
                inputProps={{ "aria-label": "拦截策略" }}
              >
                <MenuItem value={"allow"}>允许 — 直接放行，跳过后续规则</MenuItem>
                <MenuItem value={"deny"}>禁止 — 阻断，返回拒绝消息给模型</MenuItem>
                <MenuItem value={"ask"}>向用户申请 — 等待审批</MenuItem>
              </Select>
            </Field>

            {form.action !== "allow" && (
              <Field label={form.action === "deny" ? "拒绝消息（返回给模型）" : "审批说明（可选）"}>
                <TextField
                  placeholder={form.action === "deny" ? "操作被安全策略阻止" : ""}
                  value={form.message}
                  onChange={(e) => set({ message: e.target.value })}
                  rows={2}
                  className={"resize-none"}
                  multiline
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { "aria-label": form.action === "deny" ? "拒绝消息" : "审批说明" } }}
                />
              </Field>
            )}

            {form.action === "ask" && (
              <>
                <Divider />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">启用审批超时</p>
                    <p className="text-xs text-muted">超时后自动处置，不再等待</p>
                  </div>
                  <Switch
                    checked={form.timeout_enabled}
                    onChange={(_event, checked) => ((v) => set({ timeout_enabled: v }))(checked)}
                    size="small"
                    slotProps={{ input: { "aria-label": "启用审批超时" } }}
                  />
                </div>
                {form.timeout_enabled && (
                  <div className="flex items-end gap-3">
                    <Field label="超时时间（秒）">
                      <TextField
                        className="w-28"
                        type="number"
                        size="small"
                        value={
                          Number.isNaN(String(form.timeout_seconds) === "" ? NaN : Number(form.timeout_seconds))
                            ? ""
                            : String(form.timeout_seconds) === ""
                              ? NaN
                              : Number(form.timeout_seconds)
                        }
                        onChange={(event) =>
                          ((nextValue) => {
                            const n = parseInt(Number.isNaN(nextValue) ? "" : String(nextValue), 10);
                            if (n > 0) set({ timeout_seconds: n });
                          })(event.target.value === "" ? NaN : Number(event.target.value))
                        }
                        slotProps={{ htmlInput: { min: 5, max: undefined, "aria-label": "超时时间（秒）" } }}
                      />
                    </Field>
                    <Field label="超时动作">
                      <Select
                        value={form.timeout_action}
                        onChange={(event) =>
                          ((key) => {
                            if (key !== null) ((v) => set({ timeout_action: v as "deny" | "allow" }))(String(key));
                          })(event.target.value)
                        }
                        size="small"
                        className="w-32"
                        inputProps={{ "aria-label": "超时动作" }}
                      >
                        <MenuItem value={"deny"}>自动拒绝</MenuItem>
                        <MenuItem value={"allow"}>自动允许</MenuItem>
                      </Select>
                    </Field>
                  </div>
                )}
              </>
            )}

            <Divider />

            <div className="flex items-center gap-3">
              <Switch
                id="rule-enabled"
                checked={form.enabled}
                onChange={(_event, checked) => ((v) => set({ enabled: v }))(checked)}
                size="small"
                slotProps={{ input: { "aria-label": "rule-enabled" } }}
              />
              <Box component="label" htmlFor="rule-enabled" className="cursor-pointer" sx={{ fontSize: "inherit" }}>
                启用此规则
              </Box>
            </div>
          </Box>

          <Box
            className="border-t px-6 py-4 flex-row justify-end gap-2"
            sx={{ display: "flex", gap: 1, flexShrink: 0 }}
          >
            <Button onClick={() => setOpen(false)} size="small" variant="outlined">
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || !!regexErr} size="small" variant="contained">
              {saving ? "保存中…" : "保存"}
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* ---- scope dialog ---- */}

      <Dialog
        open={scopeOpen}
        onClose={() => setScopeOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="intercept-scope-title"
        slotProps={{ paper: { sx: { maxHeight: "min(80vh,560px)" } } }}
      >
        <DialogContent sx={{ display: "flex", flexDirection: "column", overflow: "hidden", p: 0 }}>
          <IconButton
            aria-label="关闭"
            onClick={() => setScopeOpen(false)}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12, zIndex: 1 }}
          >
            <XIcon size={18} />
          </IconButton>
          <Box className="shrink-0 border-b px-6 py-4" sx={{ py: 2, px: 2, pr: 5 }}>
            <Typography className="flex items-center gap-2" id="intercept-scope-title" component="h2" variant="h6">
              <ListFilterIcon className="h-4 w-4" />
              拦截范围
            </Typography>
            <Typography className="text-xs" variant="body2" color="text.secondary">
              只有启用拦截的工具才会进入规则匹配；其余工具直接放行
            </Typography>
          </Box>

          <Box
            className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5"
            data-scrollbar="thin"
            data-slot="scroll-shadow"
            sx={{ overflowY: "auto", overflowX: "hidden" }}
          >
            {scopeLoading ? (
              <p className="text-sm text-muted py-4">加载中…</p>
            ) : (
              toolGroups.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <Divider className="mb-5" />}
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.tools.map((t) => (
                      <div
                        key={t.key}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-secondary/50"
                      >
                        <Switch
                          id={`scope-${t.key}`}
                          checked={enabledTools.has(t.key)}
                          onChange={(_event, checked) => ((v) => toggleTool(t.key, v))(checked)}
                          size="small"
                          slotProps={{ input: { "aria-label": `scope-${t.key}` } }}
                        />
                        <label htmlFor={`scope-${t.key}`} className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm">{t.key}</span>
                            {t.kind && t.kind !== "builtin" && (
                              <Chip
                                className="px-1 py-0 text-[10px]"
                                size="small"
                                variant="filled"
                                label={<>{t.kind}</>}
                              />
                            )}
                          </div>
                          {t.description && <p className="text-[11px] text-muted line-clamp-1">{t.description}</p>}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </Box>

          <div className="shrink-0 border-t px-6 py-3 flex justify-end gap-2">
            <Button onClick={() => setScopeOpen(false)} size="small" variant="outlined">
              取消
            </Button>
            <Button onClick={saveScope} disabled={scopeSaving || scopeLoading} size="small" variant="contained">
              {scopeSaving ? "保存中…" : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
