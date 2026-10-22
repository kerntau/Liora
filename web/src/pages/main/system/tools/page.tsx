"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import {
  AlertTriangleIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  ShieldAlertIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AsyncState } from "@/components/async-state";
import { PageHeader } from "@/components/app/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAsyncData } from "@/hooks/use-async-data";
import type { Agent, Tool } from "@/lib/types";

// Traffic tools are host tools gated by the global 流量捕获 switch: bindable, but
// only usable when capture is on. Keep in sync with traffic.SeedToolMetas.
const TRAFFIC_TOOL_KEYS = new Set(["traffic_search", "traffic_get"]);

// Tools that can execute commands or mutate files are surfaced with a warning
// tone so a binding decision is never made on a neutral-looking card.
const DANGEROUS_TOOL_KEYS = new Set([
  "Bash",
  "Write",
  "Edit",
  "MultiEdit",
  "shell_open",
  "shell_send",
  "shell_read",
  "shell_close",
  "shell_list",
]);

function isDangerousTool(tool: Tool) {
  if (DANGEROUS_TOOL_KEYS.has(tool.key)) return true;
  return tool.kind === "shell" || tool.kind === "command" || tool.kind === "script";
}

// paramRows flattens schema.properties into an ordered row list for editing.
// name/type/required are read-only (welded to the Go handler); description/default
// are editable. Non-scalar params (array/object) can't carry an editable default.
// parentKey is set for rows that live inside an array param's items.properties.
type ParamRow = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultStr: string; // "" = no default declared
  scalar: boolean;
  parentKey?: string; // set when this is a sub-field of an array param's items
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRows(schema: Record<string, any>): ParamRow[] {
  const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = new Set<string>((schema?.required as string[]) ?? []);
  const rows: ParamRow[] = [];
  for (const [name, p] of Object.entries(props)) {
    const type = String(p?.type ?? "");
    const hasDefault = p != null && "default" in p && (p as Record<string, unknown>).default != null;
    rows.push({
      name, type,
      required: required.has(name),
      description: String(p?.description ?? ""),
      defaultStr: hasDefault ? String((p as Record<string, unknown>).default) : "",
      scalar: ["string", "integer", "number", "boolean"].includes(type),
    });
    // Expand items.properties for array params so sub-fields are editable.
    if (type === "array") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemProps = (p as any)?.items?.properties as Record<string, Record<string, unknown>> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemRequired = new Set<string>(((p as any)?.items?.required as string[]) ?? []);
      if (itemProps) {
        for (const [subName, subP] of Object.entries(itemProps)) {
          const subType = String((subP as Record<string, unknown>)?.type ?? "");
          const subHasDefault = subP != null && "default" in subP && subP.default != null;
          rows.push({
            name: subName, type: subType,
            required: itemRequired.has(subName),
            description: String(subP?.description ?? ""),
            defaultStr: subHasDefault ? String(subP.default) : "",
            scalar: ["string", "integer", "number", "boolean"].includes(subType),
            parentKey: name,
          });
        }
      }
    }
  }
  return rows;
}

// coerceDefault turns the edited default string back into a typed JSON value, or
// undefined to drop the "default" key entirely.
function coerceDefault(type: string, raw: string): unknown {
  const s = raw.trim();
  if (s === "") return undefined;
  if (type === "integer" || type === "number") {
    const n = Number(s);
    return Number.isNaN(n) ? undefined : n;
  }
  if (type === "boolean") return s === "true";
  return raw;
}

// applyRows writes edited rows back into a deep-copied schema (structure untouched).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyRows(schema: Record<string, any>, rows: ParamRow[]): Record<string, any> {
  const next = structuredClone(schema ?? {});
  const props = (next.properties ?? {}) as Record<string, Record<string, unknown>>;
  for (const r of rows) {
    if (r.parentKey) {
      // Sub-field of an array param's items.properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent = props[r.parentKey] as any;
      const subP = parent?.items?.properties?.[r.name] as Record<string, unknown> | undefined;
      if (!subP) continue;
      subP.description = r.description;
      if (r.scalar) {
        const dv = coerceDefault(r.type, r.defaultStr);
        if (dv === undefined) delete subP.default;
        else subP.default = dv;
      }
    } else {
      const p = props[r.name];
      if (!p) continue;
      p.description = r.description;
      if (r.scalar) {
        const dv = coerceDefault(r.type, r.defaultStr);
        if (dv === undefined) delete p.default;
        else p.default = dv;
      }
    }
  }
  return next;
}

// ToolEditor is the full edit form for one tool, rendered inside the drawer.
function ToolEditor({
  tool,
  agents,
  captureOn,
  agentsFailed,
  onSaved,
  onClose,
  onBusyChange,
}: {
  tool: Tool;
  agents: Agent[];
  /** null = 系统设置没拉到，流量门控状态未知，不能据此拦截绑定。 */
  captureOn: boolean | null;
  agentsFailed: boolean;
  onSaved: () => void;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  // traffic tools can't be bound/enabled until the global 流量捕获 switch is on.
  const trafficGated = TRAFFIC_TOOL_KEYS.has(tool.key) && captureOn === false;
  const [description, setDescription] = React.useState(tool.description);
  const [bound, setBound] = React.useState<string[]>(tool.agents);
  const [enabled, setEnabled] = React.useState(tool.enabled);
  const [rows, setRows] = React.useState<ParamRow[]>(() => toRows(tool.schema));
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const setRow = (i: number, patch: Partial<ParamRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggleAgent = (k: string) =>
    setBound((b) => (b.includes(k) ? b.filter((x) => x !== k) : [...b, k]));

  async function save() {
    setSaving(true);
    onBusyChange?.(true);
    try {
      await api.saveTool(tool.key, {
        description,
        schema: applyRows(tool.schema, rows),
        agents: bound,
        enabled,
      });
      toast.success(`已保存工具「${tool.key}」`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  }
  async function reset() {
    setResetting(true);
    onBusyChange?.(true);
    try {
      await api.resetTool(tool.key);
      toast.success(`已恢复「${tool.key}」为代码默认`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("恢复失败：" + (e as Error).message);
      // 抛给 ConfirmDialog：失败时保持确认框打开，不假装成功。
      throw e;
    } finally {
      setResetting(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
        {trafficGated && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>该工具依赖<b>流量捕获</b>。请先在「系统配置」开启流量捕获，才能绑定给 Agent 并启用。</span>
          </div>
        )}
        {isDangerousTool(tool) && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>该工具可执行命令或写入文件，属于高危能力；仅绑定给确实需要的 Agent，并保持最小授权。</span>
          </div>
        )}
        {/* binding + switch */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border/70 bg-surface-muted/40 p-4">
          <div className="grid gap-1.5">
            <Label id="tool-bind-agents-label" className="text-muted-foreground text-xs">
              绑定 Agent（决定该工具给哪些 Agent）
            </Label>
            <div role="group" aria-labelledby="tool-bind-agents-label" className="flex flex-wrap gap-3">
              {agents.map((ag) => (
                <label key={ag.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={bound.includes(ag.key)}
                    disabled={trafficGated}
                    onCheckedChange={() => toggleAgent(ag.key)}
                  />
                  {ag.name}
                  <span className="text-muted-foreground font-mono text-xs">{ag.key}</span>
                </label>
              ))}
              {agents.length === 0 &&
                (agentsFailed ? (
                  <span className="text-destructive text-xs">Agent 列表加载失败，绑定可能不完整</span>
                ) : (
                  <span className="text-muted-foreground text-xs">（无 Agent）</span>
                ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} id={`en-${tool.key}`} />
            <Label htmlFor={`en-${tool.key}`} className="text-sm">
              启用
            </Label>
          </div>
        </div>

        {/* description */}
        <div className="grid gap-1.5">
          <Label htmlFor="builtin-tool-description" className="text-muted-foreground text-xs">工具描述（发送给模型）</Label>
          <Textarea
            id="builtin-tool-description"
            className="font-mono text-xs leading-5"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* params */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-muted-foreground text-xs">
              参数（名称 / 类型 / 必填只读；描述与默认值可改）
            </Label>
            <span className="text-[12px] tabular-nums text-muted-foreground">{rows.length} 个</span>
          </div>
          {rows.length === 0 && <span className="text-muted-foreground text-xs">（无参数）</span>}
          {rows.map((r, i) => (
            <div
              key={(r.parentKey ?? "") + "." + r.name}
              className={r.parentKey
                ? "ml-3 grid gap-2 border-l-2 border-border py-2 pl-3"
                : "grid gap-2 rounded-lg border border-border/70 bg-card p-3"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {r.parentKey && <span className="text-muted-foreground font-mono text-[10px]">↳</span>}
                <span className="font-mono text-sm">{r.name}</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {r.type || "?"}
                </Badge>
                {r.required && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    必填
                  </Badge>
                )}
                {r.parentKey && (
                  <span className="text-muted-foreground text-[10px]">items 子字段</span>
                )}
              </div>
              <div className="grid gap-2">
                <div className="grid gap-1">
                  <Label htmlFor={`tool-param-description-${i}`} className="text-muted-foreground text-[12px]">描述</Label>
                  <Input
                    id={`tool-param-description-${i}`}
                    aria-label={`参数 ${r.parentKey ? `${r.parentKey}.` : ""}${r.name} 描述`}
                    className="text-xs"
                    value={r.description}
                    onChange={(e) => setRow(i, { description: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`tool-param-default-${i}`} className="text-muted-foreground text-[12px]">默认值</Label>
                  <Input
                    id={`tool-param-default-${i}`}
                    aria-label={`参数 ${r.parentKey ? `${r.parentKey}.` : ""}${r.name} 默认值`}
                    className="text-xs"
                    placeholder={r.scalar ? "（空=无默认）" : "仅标量支持"}
                    disabled={!r.scalar}
                    value={r.defaultStr}
                    onChange={(e) => setRow(i, { defaultStr: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="mt-4" />
      <div className="flex flex-wrap gap-2 p-4">
        <Button size="sm" onClick={save} disabled={saving || resetting}>
          <SaveIcon /> 保存
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)} disabled={saving || resetting}>
          <RotateCcwIcon /> 恢复默认
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={`恢复「${tool.key}」为代码默认？`}
        description="将丢弃当前描述、参数默认值与 Agent 绑定，恢复为代码内置默认值。"
        confirmLabel="恢复默认"
        destructive
        onConfirm={reset}
      />
    </div>
  );
}

// ToolGridSkeleton keeps the grid footprint while the first page loads.
function ToolGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-[146px] rounded-lg" />
      ))}
    </div>
  );
}

// ToolGridCard is one clickable tile in the catalog grid.
function ToolGridCard({ tool, onClick }: { tool: Tool; onClick: () => void }) {
  const danger = isDangerousTool(tool);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-2xs transition-colors hover:border-primary/40 hover:bg-surface-muted/30 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:outline-none"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}
          aria-hidden="true"
        >
          {danger ? <ShieldAlertIcon className="size-4" /> : <WrenchIcon className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-mono text-[13px] font-medium text-foreground">{tool.key}</span>
            {danger ? (
              <span className="shrink-0 rounded-full border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
                高危
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 min-h-8 text-[12px] leading-4 text-muted-foreground">
            {tool.description || "（无描述）"}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            tool.enabled
              ? "border-success/20 bg-success/10 text-success"
              : "border-transparent bg-muted text-muted-foreground",
          )}
        >
          {tool.enabled ? "启用" : "已停用"}
        </span>
      </div>

      <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="rounded-full border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {tool.system ? "系统" : `自定义 · ${tool.kind}`}
          </span>
          {tool.deferred ? (
            <span
              className="rounded-full border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              title="deferred：默认不注入模型上下文，按需加载"
            >
              延迟加载
            </span>
          ) : null}
          {tool.agents.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">未绑定 Agent</span>
          ) : (
            tool.agents.slice(0, 3).map((a) => (
              <span key={a} className="max-w-24 truncate rounded-full border border-border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {a}
              </span>
            ))
          )}
          {tool.agents.length > 3 ? (
            <span className="text-[11px] text-muted-foreground">+{tool.agents.length - 3}</span>
          ) : null}
        </div>
        <span
          className="shrink-0 text-[12px] tabular-nums text-muted-foreground"
          title={`累计调用 ${tool.calls ?? 0} 次`}
        >
          {tool.calls ?? 0} 次
        </span>
      </div>
    </button>
  );
}

export default function ToolsPage() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [captureOn, setCaptureOn] = React.useState(false);
  // 旁路数据（Agent 列表 / 系统设置）失败时不能静默：否则「无 Agent」和
  // 「流量捕获未开启」都会变成看起来正常的假象。
  const [agentsFailed, setAgentsFailed] = React.useState(false);
  const [captureFailed, setCaptureFailed] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [customEdit, setCustomEdit] = React.useState<Tool | "new" | null>(null);
  const [editorBusy, setEditorBusy] = React.useState(false);

  // 列表走统一四态：首载骨架、失败常驻可重试；刷新保留上一份，卡片不闪空。
  const toolsQ = useAsyncData(() => api.tools(), []);
  const tools = toolsQ.data ?? [];
  const reload = toolsQ.reload;

  const loadSide = React.useCallback(() => {
    setAgentsFailed(false);
    setCaptureFailed(false);
    api.agents().then(setAgents).catch(() => setAgentsFailed(true));
    api.settings().then((s) => setCaptureOn(!!s.traffic_capture)).catch(() => setCaptureFailed(true));
  }, []);
  React.useEffect(() => {
    loadSide();
  }, [loadSide]);

  const [query, setQuery] = React.useState("");

  const selected = tools.find((t) => t.key === selectedKey) ?? null;
  const matchTool = React.useCallback((t: Tool) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.key.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.agents.some((a) => a.toLowerCase().includes(q))
    );
  }, [query]);
  const systemTools = tools.filter((t) => t.system && matchTool(t));
  const customTools = tools.filter((t) => !t.system && matchTool(t));
  const allSystemCount = tools.filter((t) => t.system).length;
  const allCustomCount = tools.filter((t) => !t.system).length;
  // clicking a built-in tool opens the binding drawer; a custom tool opens its full editor.
  const openTool = (t: Tool) => (t.system ? setSelectedKey(t.key) : setCustomEdit(t));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <PageHeader
        icon={WrenchIcon}
        title="工具"
        description="管理系统工具的描述、参数默认值与 Agent 绑定，并维护 command / script / http 自定义工具。"
        // 总数 = 系统 + 自定义，三个数字并列是同一口径的重复计数（用户已指出）。
        // 只在确有自定义工具时补一句自定义数，否则「共 N 个工具」已经说完了。
        meta={[
          <span className="tabular-nums">共 {tools.length} 个工具</span>,
          allCustomCount > 0 ? (
            <span className="tabular-nums">其中自定义 {allCustomCount} 个</span>
          ) : null,
        ]}
        actions={
          <Button size="sm" onClick={() => setCustomEdit("new")}>
            <PlusIcon className="size-4" /> 新建自定义工具
          </Button>
        }
      />

      {(agentsFailed || captureFailed) && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning"
        >
          <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {agentsFailed && "Agent 列表加载失败，工具绑定显示可能不完整。"}
            {captureFailed && "系统设置加载失败，流量工具的门控状态未知。"}
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={loadSide}>
            重试
          </Button>
        </div>
      )}

      <Tabs defaultValue="system" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2 shadow-[var(--shadow-card)]">
          {/* 与同排的 32px 搜索框同高，避免工具栏出现 36/32 两种高度。 */}
          <TabsList className="h-8!">
            <TabsTrigger value="system">系统工具</TabsTrigger>
            <TabsTrigger value="custom">自定义工具</TabsTrigger>
          </TabsList>
          <div className="relative w-full min-w-0 sm:max-w-xs">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" aria-hidden="true" />
            <Input
              aria-label="搜索工具"
              className="h-8 pl-8 text-[13px]"
              placeholder="搜索工具名、描述、Agent…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query.trim() ? (
            <span className="ml-auto shrink-0 text-[12px] tabular-nums text-muted-foreground">
              {systemTools.length + customTools.length} / {tools.length} 个匹配
            </span>
          ) : null}
        </div>

        <TabsContent value="system">
          <AsyncState
            status={toolsQ.status}
            error={toolsQ.error}
            onRetry={reload}
            refreshing={toolsQ.refreshing}
            isEmpty={systemTools.length === 0}
            skeleton={<ToolGridSkeleton />}
            empty={
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-8 text-center">
                <WrenchIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-[13px] font-medium text-foreground">
                  {query.trim() ? "没有匹配的系统工具" : "暂无系统工具"}
                </p>
                <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">
                  {query.trim() ? "换一个关键词，或清空搜索查看全部系统工具。" : "等待后端初始化内置工具后即可在此绑定。"}
                </p>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {systemTools.map((t) => (
                <ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)} />
              ))}
            </div>
          </AsyncState>
        </TabsContent>

        <TabsContent value="custom">
          <AsyncState
            status={toolsQ.status}
            error={toolsQ.error}
            onRetry={reload}
            refreshing={toolsQ.refreshing}
            isEmpty={customTools.length === 0}
            skeleton={<ToolGridSkeleton />}
            empty={
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-8 text-center">
                <SparklesIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-[13px] font-medium text-foreground">
                  {query.trim() ? "没有匹配的自定义工具" : "还没有自定义工具"}
                </p>
                <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">
                  {query.trim()
                    ? "换一个关键词，或清空搜索查看全部自定义工具。"
                    : "点右上角「新建自定义工具」，把常用命令、脚本或 HTTP 接口封装成工具并绑定给 Agent。"}
                </p>
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {customTools.map((t) => (
                <ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)} />
              ))}
            </div>
          </AsyncState>
        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedKey(null)}>
        <SheetContent
          side="right"
          busy={editorBusy}
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[30vw] data-[side=right]:sm:min-w-96 data-[side=right]:sm:max-w-[30vw]"
        >
          {selected && (
            <>
              <SheetHeader className="px-4">
                <SheetTitle className="font-mono">{selected.key}</SheetTitle>
                <SheetDescription>编辑描述、参数默认值与 Agent 绑定</SheetDescription>
              </SheetHeader>
              <ToolEditor
                key={selected.key}
                tool={selected}
                agents={agents}
                captureOn={captureFailed ? null : captureOn}
                agentsFailed={agentsFailed}
                onSaved={reload}
                onClose={() => setSelectedKey(null)}
                onBusyChange={setEditorBusy}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <CustomToolDialog
        edit={customEdit}
        agents={agents}
        agentsFailed={agentsFailed}
        onClose={() => setCustomEdit(null)}
        onSaved={() => {
          setCustomEdit(null);
          reload();
        }}
      />
    </div>
  );
}

// ---- 自定义工具编辑器 ----

type ExecState = {
  command: string;
  code: string;
  method: string;
  url: string;
  headers: string;
  body: string;
  timeout_ms: string;
  proxy: string;
  use_recording_proxy: boolean;
};

function CustomToolDialog({
  edit,
  agents,
  agentsFailed,
  onClose,
  onSaved,
}: {
  edit: Tool | "new" | null;
  agents: Agent[];
  agentsFailed: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = edit === "new";
  const tool = edit && edit !== "new" ? edit : null;
  const [key, setKey] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<"shell" | "command" | "script" | "http">("shell");
  const [ex, setEx] = React.useState<ExecState>({
    command: "", code: "", method: "GET", url: "", headers: "", body: "", timeout_ms: "", proxy: "", use_recording_proxy: false,
  });
  const [schemaText, setSchemaText] = React.useState("");
  const [bound, setBound] = React.useState<string[]>([]);
  const [deferred, setDeferred] = React.useState(false);
  const [enabled, setEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [paramsText, setParamsText] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ output: string; is_error: boolean } | null>(null);

  // (re)load form state when opening.
  React.useEffect(() => {
    if (!edit) return;
    setParamsText(""); setTestResult(null);
    if (edit === "new") {
      setKey(""); setDescription(""); setKind("shell");
      setEx({ command: "", code: "", method: "GET", url: "", headers: "", body: "", timeout_ms: "", proxy: "", use_recording_proxy: false });
      setSchemaText(""); setBound([]); setDeferred(false); setEnabled(true);
      return;
    }
    const t = edit;
    const e = (t.exec ?? {}) as Record<string, unknown>;
    setKey(t.key);
    setDescription(t.description);
    setKind((t.kind as "shell" | "command" | "script" | "http") ?? "shell");
    setEx({
      command: String(e.command ?? ""),
      code: String(e.code ?? ""),
      method: String(e.method ?? "GET"),
      url: String(e.url ?? ""),
      headers: e.headers ? JSON.stringify(e.headers, null, 2) : "",
      body: String(e.body ?? ""),
      timeout_ms: e.timeout_ms ? String(e.timeout_ms) : "",
      proxy: String(e.proxy ?? ""),
      use_recording_proxy: !!e.use_recording_proxy,
    });
    setSchemaText(t.schema && Object.keys(t.schema).length ? JSON.stringify(t.schema, null, 2) : "");
    setBound(t.agents ?? []);
    setDeferred(!!t.deferred);
    setEnabled(t.enabled);
  }, [edit]);

  const toggleAgent = (k: string) => setBound((b) => (b.includes(k) ? b.filter((x) => x !== k) : [...b, k]));

  function buildExec(): Record<string, unknown> {
    if (kind === "shell") return {};
    const t = ex.timeout_ms ? Number(ex.timeout_ms) : undefined;
    if (kind === "command") return { command: ex.command, timeout_ms: t };
    if (kind === "script") return { code: ex.code, timeout_ms: t };
    let headers: Record<string, string> = {};
    if (ex.headers.trim()) {
      try { headers = JSON.parse(ex.headers); } catch { /* validated on save */ }
    }
    return { method: ex.method, url: ex.url, headers, body: ex.body, timeout_ms: t, proxy: ex.proxy, use_recording_proxy: ex.use_recording_proxy };
  }

  async function save() {
    if (isNew && !/^[a-z][a-z0-9_]*$/.test(key.trim())) {
      toast.error("key 需小写字母开头，仅含小写字母/数字/下划线");
      return;
    }
    let schema: Record<string, unknown> = {};
    if (schemaText.trim()) {
      try { schema = JSON.parse(schemaText); } catch { toast.error("参数 JSON Schema 格式错误"); return; }
    }
    if (kind === "http" && ex.headers.trim()) {
      try { JSON.parse(ex.headers); } catch { toast.error("headers JSON 格式错误"); return; }
    }
    if (kind === "http") {
      const props = (schema as { properties?: Record<string, unknown> }).properties;
      if (!props || Object.keys(props).length === 0) {
        toast.error("http 工具必须提供参数 JSON Schema（含 properties，不能留空）");
        return;
      }
    }
    setSaving(true);
    const payload = { description, schema: kind === "shell" ? {} : schema, agents: bound, enabled, kind, exec: buildExec(), deferred: kind === "shell" ? false : deferred };
    try {
      if (isNew) await api.createCustomTool({ key: key.trim(), ...payload });
      else await api.updateCustomTool(tool!.key, payload);
      toast.success(isNew ? "已创建自定义工具" : "已保存");
      onSaved();
    } catch (e) {
      toast.error("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function del() {
    if (!tool) return;
    try {
      await api.deleteCustomTool(tool.key);
      toast.success("已删除");
      onSaved();
    } catch (e) {
      toast.error("删除失败：" + (e as Error).message);
      // 抛给 ConfirmDialog：失败时保持确认框打开，不假装已删除。
      throw e;
    }
  }
  // runTest dry-runs the CURRENT form (unsaved) with the sample params, so a
  // template/script/request can be debugged before saving.
  async function runTest() {
    let params: Record<string, unknown> = {};
    if (paramsText.trim()) {
      try { params = JSON.parse(paramsText); } catch { toast.error("测试参数 JSON 格式错误"); return; }
    }
    if (kind === "http" && ex.headers.trim()) {
      try { JSON.parse(ex.headers); } catch { toast.error("headers JSON 格式错误"); return; }
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.testCustomTool({ kind, exec: buildExec(), params });
      setTestResult(r);
    } catch (e) {
      setTestResult({ output: (e as Error).message, is_error: true });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Sheet open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        busy={saving}
        className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[45vw] data-[side=right]:sm:min-w-[480px] data-[side=right]:sm:max-w-[45vw]"
      >
        <SheetHeader className="px-4">
          <SheetTitle>{isNew ? "新建自定义工具" : `编辑 ${tool?.key}`}</SheetTitle>
          <SheetDescription>shell=bash 环境声明(只需名称+描述，告知模型可用 bash 调用)；command/script/http 需写执行规格。</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          <div className="grid gap-1.5">
            <Label htmlFor="custom-tool-key" className="text-xs">Key</Label>
            <Input id="custom-tool-key" className="font-mono" placeholder="如 nmap_scan" value={key} disabled={!isNew}
              onChange={(e) => setKey(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="custom-tool-description" className="text-xs">描述(发给模型)</Label>
            <Textarea id="custom-tool-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="custom-tool-kind" className="text-xs">类型</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "shell" | "command" | "script" | "http")}>
              <SelectTrigger id="custom-tool-kind" className="w-56 max-w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shell">shell（bash 环境声明）</SelectItem>
                <SelectItem value="command">command（shell 命令模板）</SelectItem>
                <SelectItem value="script">script（Python 脚本）</SelectItem>
                <SelectItem value="http">http（API 请求）</SelectItem>
              </SelectContent>
            </Select>
            {kind === "shell" && (
              <p className="text-muted-foreground text-xs">适合 nmap、sqlmap、ffuf 等出名工具——模型已知用法，只需声明"可在 bash 中调用"即可。名称+描述会追加到 Bash 工具描述里。</p>
            )}
          </div>

          {kind === "command" && (
            <div className="grid gap-1.5">
              <Label htmlFor="custom-tool-command" className="text-xs">命令模板（占位符 {"{param}"}，如 nmap -p {"{ports}"} {"{target}"}）</Label>
              <Textarea id="custom-tool-command" className="font-mono text-xs" rows={2} value={ex.command}
                onChange={(e) => setEx({ ...ex, command: e.target.value })} />
            </div>
          )}
          {kind === "script" && (
            <div className="grid gap-1.5">
              <Label htmlFor="custom-tool-code" className="text-xs">Python 正文（参数走 stdin JSON / os.environ["TOOL_X"]）</Label>
              <Textarea id="custom-tool-code" className="font-mono text-xs" rows={10} value={ex.code}
                placeholder={'import json,sys\nargs=json.load(sys.stdin)\nprint(...)'}
                onChange={(e) => setEx({ ...ex, code: e.target.value })} />
            </div>
          )}
          {kind === "http" && (
            <div className="grid gap-2">
              <div className="flex gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="custom-tool-method" className="text-xs">Method</Label>
                  <Input id="custom-tool-method" className="w-24" value={ex.method} onChange={(e) => setEx({ ...ex, method: e.target.value })} />
                </div>
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="custom-tool-url" className="text-xs">URL（可含 {"{param}"}）</Label>
                  <Input id="custom-tool-url" className="font-mono text-xs" value={ex.url} onChange={(e) => setEx({ ...ex, url: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="custom-tool-headers" className="text-xs">Headers（JSON，可含 {"{param}"}）</Label>
                <Textarea id="custom-tool-headers" className="font-mono text-xs" rows={2} value={ex.headers}
                  placeholder={'{"Authorization": "Bearer {token}"}'} onChange={(e) => setEx({ ...ex, headers: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="custom-tool-body" className="text-xs">Body（可含 {"{param}"}）</Label>
                <Textarea id="custom-tool-body" className="font-mono text-xs" rows={2} value={ex.body} onChange={(e) => setEx({ ...ex, body: e.target.value })} />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="custom-tool-proxy" className="text-xs">代理 URL（空=直连）</Label>
                  <Input id="custom-tool-proxy" className="font-mono text-xs w-56" value={ex.proxy} onChange={(e) => setEx({ ...ex, proxy: e.target.value })} />
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm">
                  <Checkbox checked={ex.use_recording_proxy} onCheckedChange={(v) => setEx({ ...ex, use_recording_proxy: !!v })} />
                  走记录代理
                </label>
              </div>
            </div>
          )}

          {kind !== "shell" && (
            <div className="flex items-center gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="custom-tool-timeout" className="text-xs">超时(ms，空=默认)</Label>
                <Input id="custom-tool-timeout" type="number" className="w-32" value={ex.timeout_ms} onChange={(e) => setEx({ ...ex, timeout_ms: e.target.value })} />
              </div>
            </div>
          )}

          {kind !== "shell" && (
            <div className="grid gap-1.5">
              <Label htmlFor="custom-tool-schema" className="text-xs">
                参数 JSON Schema{kind === "http" ? "（http 工具必填，需含 properties）" : "（留空 = 自动给 {args} 薄壳）"}
              </Label>
              <Textarea id="custom-tool-schema" className="font-mono text-xs" rows={4} value={schemaText}
                placeholder={'{"type":"object","properties":{"target":{"type":"string"}},"required":["target"]}'}
                onChange={(e) => setSchemaText(e.target.value)} />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label id="custom-tool-bind-agents-label" className="text-muted-foreground text-xs">
              绑定 Agent
            </Label>
            <div role="group" aria-labelledby="custom-tool-bind-agents-label" className="flex flex-wrap gap-3">
              {agentsFailed && <span className="text-destructive text-xs">Agent 列表加载失败，绑定可能不完整</span>}
              {agents.map((a) => (
                <label key={a.key} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={bound.includes(a.key)} onCheckedChange={() => toggleAgent(a.key)} />
                  {a.name}<span className="text-muted-foreground font-mono text-xs">{a.key}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={setEnabled} /> 启用
            </label>
            {kind !== "shell" && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={deferred} onCheckedChange={setDeferred} /> deferred（大量不常用工具才开）
              </label>
            )}
          </div>

          {kind !== "shell" && (
            <div className="grid gap-1.5 rounded-md border p-3">
              <Label htmlFor="custom-tool-test-params" className="text-xs font-medium">测试运行（用当前表单，不会保存）</Label>
              <Textarea id="custom-tool-test-params" className="font-mono text-xs" rows={2} value={paramsText}
                placeholder={'示例参数 JSON，如 {"target":"example.com"}'}
                onChange={(e) => setParamsText(e.target.value)} />
              <div>
                <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
                  <PlayIcon /> {testing ? "运行中…" : "测试运行"}
                </Button>
              </div>
              <pre
                role="status"
                className={
                  "max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 font-mono text-xs " +
                  (testResult?.is_error ? "text-destructive " : "") +
                  (testResult ? "" : "sr-only")
                }
              >
                {testResult ? (
                  <>
                    <span className="sr-only">{testResult.is_error ? "测试失败：" : "测试输出："}</span>
                    <span>{testResult.output || "（无输出）"}</span>
                  </>
                ) : null}
              </pre>
            </div>
          )}
        </div>

        <Separator />
        <div className="flex items-center gap-2 p-4">
          <Button size="sm" onClick={save} disabled={saving}>
            <SaveIcon /> {isNew ? "创建" : "保存"}
          </Button>
          {!isNew && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> 删除
            </Button>
          )}
        </div>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`删除自定义工具「${tool?.key ?? ""}」？`}
          description="该工具会从所有已绑定的 Agent 移除，删除后无法恢复。"
          confirmLabel="删除"
          destructive
          onConfirm={del}
        />
      </SheetContent>
    </Sheet>
  );
}
