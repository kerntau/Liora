import * as React from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { PlayIcon, PlusIcon, RotateCcwIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { Agent, Tool } from "@/lib/types";

// Traffic tools are host tools gated by the global 流量捕获 switch: bindable, but
// only usable when capture is on. Keep in sync with traffic.SeedToolMetas.
const TRAFFIC_TOOL_KEYS = new Set(["traffic_search", "traffic_get"]);
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
      name,
      type,
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
            name: subName,
            type: subType,
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
  onSaved,
  onClose,
}: {
  tool: Tool;
  agents: Agent[];
  captureOn: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  // traffic tools can't be bound/enabled until the global 流量捕获 switch is on.
  const trafficGated = TRAFFIC_TOOL_KEYS.has(tool.key) && !captureOn;
  const [description, setDescription] = React.useState(tool.description);
  const [bound, setBound] = React.useState<string[]>(tool.agents);
  const [enabled, setEnabled] = React.useState(tool.enabled);
  const [rows, setRows] = React.useState<ParamRow[]>(() => toRows(tool.schema));
  const [saving, setSaving] = React.useState(false);
  const setRow = (i: number, patch: Partial<ParamRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggleAgent = (k: string) => setBound((b) => (b.includes(k) ? b.filter((x) => x !== k) : [...b, k]));
  async function save() {
    setSaving(true);
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
    }
  }
  async function reset() {
    try {
      await api.resetTool(tool.key);
      toast.success(`已恢复「${tool.key}」为代码默认`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("恢复失败：" + (e as Error).message);
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Box
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
        data-scrollbar="thin"
        data-slot="scroll-shadow"
        sx={{ overflowY: "auto", overflowX: "hidden" }}
      >
        {trafficGated && (
          <div className="border-warning/40 bg-warning/10 text-muted rounded-md border px-3 py-2 text-xs">
            该工具依赖<b>流量捕获</b>。请先在「系统配置」开启流量捕获，才能绑定给 Agent 并启用。
          </div>
        )}
        {/* binding + switch */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="grid gap-1.5">
            <Box component="span" className="text-muted text-xs" sx={{ fontSize: "inherit" }}>
              绑定 Agent（决定该工具给哪些 Agent）
            </Box>
            <div className="flex flex-wrap gap-3">
              {agents.map((ag) => (
                <FormControlLabel
                  key={ag.key}
                  control={
                    <Checkbox
                      disabled={trafficGated}
                      checked={bound.includes(ag.key) === true}
                      onChange={() => toggleAgent(ag.key)}
                      size="small"
                      slotProps={{ input: { "aria-label": undefined } }}
                    />
                  }
                  label={
                    <>
                      <Box
                        className="flex items-center gap-2 text-sm"
                        sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
                      >
                        <Box component="span" sx={{ fontSize: "inherit" }}>
                          {ag.name}
                          <span className="text-muted font-mono text-xs">{ag.key}</span>
                        </Box>
                      </Box>
                    </>
                  }
                  sx={{
                    m: 0,
                    alignItems: "center",
                    gap: 0.5,
                    "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1, fontSize: 14 },
                  }}
                />
              ))}
              {agents.length === 0 && <span className="text-muted text-xs">（无 Agent）</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id={`en-${tool.key}`}
              checked={enabled}
              onChange={(_event, checked) => setEnabled(checked)}
              size="small"
              slotProps={{ input: { "aria-label": `en-${tool.key}` } }}
            />
            <Box component="label" htmlFor={`en-${tool.key}`} className="text-sm" sx={{ fontSize: "inherit" }}>
              启用
            </Box>
          </div>
        </div>

        {/* description */}
        <div className="grid gap-1.5">
          <Box component="span" className="text-muted text-xs" sx={{ fontSize: "inherit" }}>
            工具描述（发送给模型）
          </Box>
          <TextField
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={"font-mono text-xs"}
            multiline
            fullWidth
            size="small"
            slotProps={{ htmlInput: { "aria-label": "工具描述" } }}
            sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
          />
        </div>

        {/* params */}
        <div className="grid gap-2">
          <Box component="span" className="text-muted text-xs" sx={{ fontSize: "inherit" }}>
            参数（名称 / 类型 / 必填只读；描述与默认值可改）
          </Box>
          {rows.length === 0 && <span className="text-muted text-xs">（无参数）</span>}
          {rows.map((r, i) => (
            <div
              key={(r.parentKey ?? "") + "." + r.name}
              className={
                r.parentKey ? "border-l-2 border-muted ml-3 pl-3 grid gap-2 py-2" : "grid gap-2 rounded-md border p-3"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {r.parentKey && <span className="text-muted font-mono text-[10px]">↳</span>}
                <span className="font-mono text-sm">{r.name}</span>
                <Chip className="px-1.5 py-0 text-[10px]" size="small" variant="filled" label={<>{r.type || "?"}</>} />
                {r.required && (
                  <Chip className="px-1.5 py-0 text-[10px]" size="small" variant="filled" label={<>必填</>} />
                )}
                {r.parentKey && <span className="text-muted text-[10px]">items 子字段</span>}
              </div>
              <div className="grid gap-2">
                <div className="grid gap-1">
                  <Box component="span" className="text-muted text-[11px]" sx={{ fontSize: "inherit" }}>
                    描述
                  </Box>
                  <TextField
                    value={r.description}
                    onChange={(e) => setRow(i, { description: e.target.value })}
                    className={"text-xs"}
                    fullWidth
                    size="small"
                    slotProps={{ htmlInput: { "aria-label": "参数描述" } }}
                  />
                </div>
                <div className="grid gap-1">
                  <Box component="span" className="text-muted text-[11px]" sx={{ fontSize: "inherit" }}>
                    默认值
                  </Box>
                  <TextField
                    placeholder={r.scalar ? "（空=无默认）" : "仅标量支持"}
                    value={r.defaultStr}
                    onChange={(e) => setRow(i, { defaultStr: e.target.value })}
                    disabled={!r.scalar}
                    className={"text-xs"}
                    fullWidth
                    size="small"
                    slotProps={{ htmlInput: { "aria-label": "参数默认值" } }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Box>

      <Divider className="mt-4" />
      <div className="flex flex-wrap gap-2 p-4">
        <Button onClick={save} disabled={saving} size="small" variant="contained">
          <SaveIcon /> 保存
        </Button>
        <Button onClick={reset} size="small" variant="outlined">
          <RotateCcwIcon /> 恢复默认
        </Button>
      </div>
    </div>
  );
}
// ToolGridCard is one clickable tile in the catalog grid.
function ToolGridCard({ tool, onClick }: { tool: Tool; onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className="hover:border-accent/50 hover:bg-surface-secondary/40 focus-visible:ring-focus flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      size="small"
      variant="text"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{tool.key}</span>
        {tool.system ? (
          <Chip className="px-1.5 py-0 text-[10px]" size="small" variant="filled" label={<>系统</>} />
        ) : (
          <Chip className="px-1.5 py-0 text-[10px]" size="small" variant="filled" label={<>自定义·{tool.kind}</>} />
        )}
        {tool.deferred && (
          <Chip className="px-1.5 py-0 text-[10px]" size="small" variant="filled" label={<>deferred</>} />
        )}
        {!tool.enabled && (
          <Chip className="text-danger px-1.5 py-0 text-[10px]" size="small" variant="filled" label={<>已停用</>} />
        )}
        <Chip
          className="ml-auto px-1.5 py-0 text-[10px] tabular-nums"
          title={`累计调用 ${tool.calls ?? 0} 次`}
          size="small"
          variant="filled"
          label={<>调用 {tool.calls ?? 0}</>}
        />
      </div>
      <p className="text-muted line-clamp-1 h-4 text-xs">{tool.description || "（无描述）"}</p>
      <div className="mt-auto flex flex-wrap gap-1 pt-1">
        {tool.agents.length === 0 && <span className="text-muted text-[10px]">（未绑定 Agent）</span>}
        {tool.agents.map((a) => (
          <Chip key={a} className="px-1.5 py-0 text-[10px]" size="small" variant="filled" label={<>{a}</>} />
        ))}
      </div>
    </Button>
  );
}
export default function ToolsPage() {
  const [tools, setTools] = React.useState<Tool[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [captureOn, setCaptureOn] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [customEdit, setCustomEdit] = React.useState<Tool | "new" | null>(null);
  const reload = React.useCallback(() => {
    api
      .tools()
      .then(setTools)
      .catch(() => setTools([]));
  }, []);
  React.useEffect(() => {
    reload();
    api
      .agents()
      .then(setAgents)
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
    api
      .settings()
      .then((s) => setCaptureOn(!!s.traffic_capture))
      .catch(() => {
        /* Optional catalog data remains empty if unavailable. */
      });
  }, [reload]);
  const [editorTab, setEditorTab] = React.useState("system");
  const [query, setQuery] = React.useState("");
  const selected = tools.find((t) => t.key === selectedKey) ?? null;
  const matchTool = React.useCallback(
    (t: Tool) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        t.key.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.agents.some((a) => a.toLowerCase().includes(q))
      );
    },
    [query],
  );
  const systemTools = tools.filter((t) => t.system && matchTool(t));
  const customTools = tools.filter((t) => !t.system && matchTool(t));
  const allSystemCount = tools.filter((t) => t.system).length;
  const allCustomCount = tools.filter((t) => !t.system).length;
  // clicking a built-in tool opens the binding drawer; a custom tool opens its full editor.
  const openTool = (t: Tool) => (t.system ? setSelectedKey(t.key) : setCustomEdit(t));
  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">工具</h1>
          <p className="text-muted text-sm">系统工具的描述/绑定，以及自定义工具(command/script/http)</p>
        </div>
        <div className="relative w-64">
          <TextField
            value={query}
            placeholder={"搜索工具名、描述、Agent…"}
            size="small"
            fullWidth
            type="search"
            onChange={(event) => ((nextValue) => setQuery(nextValue))(event.target.value)}
            slotProps={{ htmlInput: { "aria-label": "搜索工具名、描述、Agent…" } }}
          />
        </div>
      </div>

      <Box sx={{ minWidth: 0 }}>
        <Tabs
          value={editorTab}
          onChange={(_event, value: string) => setEditorTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, mb: 2 }}
        >
          <Tab
            value={"system"}
            label={<>系统工具</>}
            id={"editor-tab-" + "system"}
            aria-controls={"editor-panel-" + "system"}
          />
          <Tab
            value={"custom"}
            label={<>自定义工具</>}
            id={"editor-tab-" + "custom"}
            aria-controls={"editor-panel-" + "custom"}
          />
        </Tabs>

        <>
          {editorTab === "system" && (
            <Box role="tabpanel" id={"editor-panel-" + "system"} aria-labelledby={"editor-tab-" + "system"}>
              <Card variant="outlined">
                <Box sx={{ px: 3, pt: 3 }}>
                  <Typography variant="h6">系统工具</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {query.trim()
                      ? `${systemTools.length} / ${allSystemCount} 个匹配，点击卡片编辑描述、参数默认值与 Agent 绑定`
                      : `共 ${allSystemCount} 个，点击卡片编辑描述、参数默认值与 Agent 绑定`}
                  </Typography>
                </Box>
                <CardContent>
                  {systemTools.length === 0 ? (
                    <p className="text-muted py-6 text-center text-sm">
                      {query.trim() ? "没有匹配的系统工具" : "（暂无系统工具，等待后端 seed）"}
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {systemTools.map((t) => (
                        <ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </>

        <>
          {editorTab === "custom" && (
            <Box role="tabpanel" id={"editor-panel-" + "custom"} aria-labelledby={"editor-tab-" + "custom"}>
              <Card variant="outlined">
                <Box sx={{ px: 3, pt: 3 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Typography variant="h6">自定义工具</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {query.trim()
                          ? `shell/command/script/http，${customTools.length} / ${allCustomCount} 个匹配，点击卡片编辑`
                          : `shell(bash 声明) / command(命令) / script(Python) / http(API)，共 ${allCustomCount} 个，点击卡片编辑`}
                      </Typography>
                    </div>
                    <Button onClick={() => setCustomEdit("new")} size="small" variant="contained">
                      <PlusIcon /> 新建自定义工具
                    </Button>
                  </div>
                </Box>
                <CardContent>
                  {customTools.length === 0 ? (
                    <p className="text-muted py-6 text-center text-sm">
                      {query.trim() ? "没有匹配的自定义工具" : "（暂无自定义工具，点击右上角「新建自定义工具」）"}
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {customTools.map((t) => (
                        <ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </>
      </Box>

      <Drawer
        anchor="right"
        open={!!selected}
        onClose={() => setSelectedKey(null)}
        slotProps={{
          paper: {
            "aria-labelledby": "tool-editor-heading",
            sx: { width: { xs: "100vw", sm: "clamp(420px,45vw,760px)" }, maxWidth: "100vw", overflow: "hidden" },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative" }}>
          <IconButton
            aria-label="关闭"
            onClick={() => setSelectedKey(null)}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12, zIndex: 1 }}
          >
            <XIcon size={18} />
          </IconButton>
          {selected && (
            <>
              <Box className="px-4" sx={{ pt: 2, pb: 2, pr: 5 }}>
                <Typography className="font-mono" component="h2" variant="h6" id="tool-editor-heading">
                  {selected.key}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  编辑描述、参数默认值与 Agent 绑定
                </Typography>
              </Box>
              <ToolEditor
                key={selected.key}
                tool={selected}
                agents={agents}
                captureOn={captureOn}
                onSaved={reload}
                onClose={() => setSelectedKey(null)}
              />
            </>
          )}
        </Box>
      </Drawer>

      <CustomToolDialog
        edit={customEdit}
        agents={agents}
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
  onClose,
  onSaved,
}: {
  edit: Tool | "new" | null;
  agents: Agent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = edit === "new";
  const tool = edit && edit !== "new" ? edit : null;
  const [key, setKey] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<"shell" | "command" | "script" | "http">("shell");
  const [ex, setEx] = React.useState<ExecState>({
    command: "",
    code: "",
    method: "GET",
    url: "",
    headers: "",
    body: "",
    timeout_ms: "",
    proxy: "",
    use_recording_proxy: false,
  });
  const [schemaText, setSchemaText] = React.useState("");
  const [bound, setBound] = React.useState<string[]>([]);
  const [deferred, setDeferred] = React.useState(false);
  const [enabled, setEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [paramsText, setParamsText] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    output: string;
    is_error: boolean;
  } | null>(null);
  // (re)load form state when opening.
  React.useEffect(() => {
    if (!edit) return;
    setParamsText("");
    setTestResult(null);
    if (edit === "new") {
      setKey("");
      setDescription("");
      setKind("shell");
      setEx({
        command: "",
        code: "",
        method: "GET",
        url: "",
        headers: "",
        body: "",
        timeout_ms: "",
        proxy: "",
        use_recording_proxy: false,
      });
      setSchemaText("");
      setBound([]);
      setDeferred(false);
      setEnabled(true);
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
      try {
        headers = JSON.parse(ex.headers);
      } catch {
        /* validated on save */
      }
    }
    return {
      method: ex.method,
      url: ex.url,
      headers,
      body: ex.body,
      timeout_ms: t,
      proxy: ex.proxy,
      use_recording_proxy: ex.use_recording_proxy,
    };
  }
  async function save() {
    if (isNew && !/^[a-z][a-z0-9_]*$/.test(key.trim())) {
      toast.error("key 需小写字母开头，仅含小写字母/数字/下划线");
      return;
    }
    let schema: Record<string, unknown> = {};
    if (schemaText.trim()) {
      try {
        schema = JSON.parse(schemaText);
      } catch {
        toast.error("参数 JSON Schema 格式错误");
        return;
      }
    }
    if (kind === "http" && ex.headers.trim()) {
      try {
        JSON.parse(ex.headers);
      } catch {
        toast.error("headers JSON 格式错误");
        return;
      }
    }
    if (kind === "http") {
      const props = (
        schema as {
          properties?: Record<string, unknown>;
        }
      ).properties;
      if (!props || Object.keys(props).length === 0) {
        toast.error("http 工具必须提供参数 JSON Schema（含 properties，不能留空）");
        return;
      }
    }
    setSaving(true);
    const payload = {
      description,
      schema: kind === "shell" ? {} : schema,
      agents: bound,
      enabled,
      kind,
      exec: buildExec(),
      deferred: kind === "shell" ? false : deferred,
    };
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
    }
  }
  // runTest dry-runs the CURRENT form (unsaved) with the sample params, so a
  // template/script/request can be debugged before saving.
  async function runTest() {
    let params: Record<string, unknown> = {};
    if (paramsText.trim()) {
      try {
        params = JSON.parse(paramsText);
      } catch {
        toast.error("测试参数 JSON 格式错误");
        return;
      }
    }
    if (kind === "http" && ex.headers.trim()) {
      try {
        JSON.parse(ex.headers);
      } catch {
        toast.error("headers JSON 格式错误");
        return;
      }
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
    <Drawer
      anchor="right"
      open={!!edit}
      onClose={onClose}
      slotProps={{
        paper: {
          "aria-labelledby": "custom-tool-editor-heading",
          sx: { width: { xs: "100vw", sm: "clamp(420px,45vw,760px)" }, maxWidth: "100vw", overflow: "hidden" },
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, position: "relative" }}>
        <IconButton
          aria-label="关闭"
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 12, top: 12, zIndex: 1 }}
        >
          <XIcon size={18} />
        </IconButton>
        <Box className="px-4" sx={{ pt: 2, pb: 2, pr: 5 }}>
          <Typography component="h2" variant="h6" id="custom-tool-editor-heading">
            {isNew ? "新建自定义工具" : `编辑 ${tool?.key}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            shell=bash 环境声明(只需名称+描述，告知模型可用 bash 调用)；command/script/http 需写执行规格。
          </Typography>
        </Box>

        <Box
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          data-scrollbar="thin"
          data-slot="scroll-shadow"
          sx={{ overflowY: "auto", overflowX: "hidden" }}
        >
          <div className="grid gap-1.5">
            <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
              Key
            </Box>
            <TextField
              placeholder="如 nmap_scan"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={!isNew}
              className={"font-mono"}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { "aria-label": "工具 Key" } }}
              sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
            />
          </div>
          <div className="grid gap-1.5">
            <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
              描述(发给模型)
            </Box>
            <TextField
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              fullWidth
              size="small"
              slotProps={{ htmlInput: { "aria-label": "工具描述" } }}
            />
          </div>

          <div className="grid gap-1.5">
            <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
              类型
            </Box>
            <Select
              value={kind}
              onChange={(event) =>
                ((key) => {
                  if (key !== null) ((v) => setKind(v as "shell" | "command" | "script" | "http"))(String(key));
                })(event.target.value)
              }
              size="small"
              className="w-56"
              inputProps={{ "aria-label": "工具类型" }}
            >
              <MenuItem value={"shell"}>shell（bash 环境声明）</MenuItem>
              <MenuItem value={"command"}>command（shell 命令模板）</MenuItem>
              <MenuItem value={"script"}>script（Python 脚本）</MenuItem>
              <MenuItem value={"http"}>http（API 请求）</MenuItem>
            </Select>
            {kind === "shell" && (
              <p className="text-muted text-xs">
                适合 nmap、sqlmap、ffuf 等出名工具——模型已知用法，只需声明"可在 bash 中调用"即可。名称+描述会追加到 Bash
                工具描述里。
              </p>
            )}
          </div>

          {kind === "command" && (
            <div className="grid gap-1.5">
              <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                命令模板（占位符 {"{param}"}，如 nmap -p {"{ports}"} {"{target}"}）
              </Box>
              <TextField
                rows={2}
                value={ex.command}
                onChange={(e) => setEx({ ...ex, command: e.target.value })}
                className={"font-mono text-xs"}
                multiline
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "命令模板" } }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
            </div>
          )}
          {kind === "script" && (
            <div className="grid gap-1.5">
              <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                Python 正文（参数走 stdin JSON / os.environ["TOOL_X"]）
              </Box>
              <TextField
                rows={10}
                value={ex.code}
                placeholder={"import json,sys\nargs=json.load(sys.stdin)\nprint(...)"}
                onChange={(e) => setEx({ ...ex, code: e.target.value })}
                className={"font-mono text-xs"}
                multiline
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "Python 代码" } }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
            </div>
          )}
          {kind === "http" && (
            <div className="grid gap-2">
              <div className="flex gap-2">
                <div className="grid gap-1.5">
                  <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                    Method
                  </Box>
                  <TextField
                    value={ex.method}
                    onChange={(e) => setEx({ ...ex, method: e.target.value })}
                    className={"w-24"}
                    fullWidth
                    size="small"
                    slotProps={{ htmlInput: { "aria-label": "HTTP 方法" } }}
                  />
                </div>
                <div className="grid flex-1 gap-1.5">
                  <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                    URL（可含 {"{param}"}）
                  </Box>
                  <TextField
                    value={ex.url}
                    onChange={(e) => setEx({ ...ex, url: e.target.value })}
                    className={"font-mono text-xs"}
                    fullWidth
                    size="small"
                    slotProps={{ htmlInput: { "aria-label": "HTTP URL" } }}
                    sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                  Headers（JSON，可含 {"{param}"}）
                </Box>
                <TextField
                  rows={2}
                  value={ex.headers}
                  placeholder={'{"Authorization": "Bearer {token}"}'}
                  onChange={(e) => setEx({ ...ex, headers: e.target.value })}
                  className={"font-mono text-xs"}
                  multiline
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { "aria-label": "Headers JSON" } }}
                  sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
                />
              </div>
              <div className="grid gap-1.5">
                <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                  Body（可含 {"{param}"}）
                </Box>
                <TextField
                  rows={2}
                  value={ex.body}
                  onChange={(e) => setEx({ ...ex, body: e.target.value })}
                  className={"font-mono text-xs"}
                  multiline
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { "aria-label": "Body 模板" } }}
                  sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="grid gap-1.5">
                  <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                    代理 URL（空=直连）
                  </Box>
                  <TextField
                    value={ex.proxy}
                    onChange={(e) => setEx({ ...ex, proxy: e.target.value })}
                    className={"font-mono text-xs w-56"}
                    fullWidth
                    size="small"
                    slotProps={{ htmlInput: { "aria-label": "代理 URL" } }}
                    sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
                  />
                </div>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ex.use_recording_proxy === true}
                      onChange={(_event, checked) => ((v) => setEx({ ...ex, use_recording_proxy: !!v }))(checked)}
                      size="small"
                      slotProps={{ input: { "aria-label": undefined } }}
                    />
                  }
                  label={
                    <>
                      <Box
                        className="mt-4 flex items-center gap-2 text-sm"
                        sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
                      >
                        <Box component="span" sx={{ fontSize: "inherit" }}>
                          走记录代理
                        </Box>
                      </Box>
                    </>
                  }
                  sx={{
                    m: 0,
                    alignItems: "center",
                    gap: 0.5,
                    "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1, fontSize: 14 },
                  }}
                />
              </div>
            </div>
          )}

          {kind !== "shell" && (
            <div className="flex items-center gap-3">
              <div className="grid gap-1.5">
                <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                  超时(ms，空=默认)
                </Box>
                <TextField
                  className="w-32"
                  type="number"
                  size="small"
                  value={
                    Number.isNaN(String(ex.timeout_ms) === "" ? NaN : Number(ex.timeout_ms))
                      ? ""
                      : String(ex.timeout_ms) === ""
                        ? NaN
                        : Number(ex.timeout_ms)
                  }
                  onChange={(event) =>
                    ((nextValue) => setEx({ ...ex, timeout_ms: Number.isNaN(nextValue) ? "" : String(nextValue) }))(
                      event.target.value === "" ? NaN : Number(event.target.value),
                    )
                  }
                  slotProps={{ htmlInput: { min: undefined, max: undefined, "aria-label": "\u8F93\u5165" } }}
                />
              </div>
            </div>
          )}

          {kind !== "shell" && (
            <div className="grid gap-1.5">
              <Box component="span" className="text-xs" sx={{ fontSize: "inherit" }}>
                参数 JSON Schema
                {kind === "http" ? "（http 工具必填，需含 properties）" : "（留空 = 自动给 {args} 薄壳）"}
              </Box>
              <TextField
                rows={4}
                value={schemaText}
                placeholder={'{"type":"object","properties":{"target":{"type":"string"}},"required":["target"]}'}
                onChange={(e) => setSchemaText(e.target.value)}
                className={"font-mono text-xs"}
                multiline
                fullWidth
                size="small"
                slotProps={{
                  htmlInput: {
                    "aria-label": "参数 JSON Schema",
                  },
                }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Box component="span" className="text-muted text-xs" sx={{ fontSize: "inherit" }}>
              绑定 Agent
            </Box>
            <div className="flex flex-wrap gap-3">
              {agents.map((a) => (
                <FormControlLabel
                  key={a.key}
                  control={
                    <Checkbox
                      checked={bound.includes(a.key) === true}
                      onChange={() => toggleAgent(a.key)}
                      size="small"
                      slotProps={{ input: { "aria-label": undefined } }}
                    />
                  }
                  label={
                    <>
                      <Box
                        className="flex items-center gap-2 text-sm"
                        sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
                      >
                        <Box component="span" sx={{ fontSize: "inherit" }}>
                          {a.name}
                          <span className="text-muted font-mono text-xs">{a.key}</span>
                        </Box>
                      </Box>
                    </>
                  }
                  sx={{
                    m: 0,
                    alignItems: "center",
                    gap: 0.5,
                    "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1, fontSize: 14 },
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <FormControlLabel
              className={"flex items-center gap-2 text-sm"}
              control={
                <Switch
                  checked={enabled}
                  onChange={(_event, checked) => setEnabled(checked)}
                  size="small"
                  slotProps={{ input: { "aria-label": "启用" } }}
                />
              }
              label={
                <>
                  <Box component="span" sx={{ fontSize: "inherit" }}>
                    启用
                  </Box>
                </>
              }
              sx={{
                m: 0,
                alignItems: "center",
                gap: 0.5,
                "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1, fontSize: 14 },
              }}
            />
            {kind !== "shell" && (
              <FormControlLabel
                className={"flex items-center gap-2 text-sm"}
                control={
                  <Switch
                    checked={deferred}
                    onChange={(_event, checked) => setDeferred(checked)}
                    size="small"
                    slotProps={{ input: { "aria-label": "延迟加载" } }}
                  />
                }
                label={
                  <>
                    <Box component="span" sx={{ fontSize: "inherit" }}>
                      deferred（大量不常用工具才开）
                    </Box>
                  </>
                }
                sx={{
                  m: 0,
                  alignItems: "center",
                  gap: 0.5,
                  "& .MuiFormControlLabel-label": { minWidth: 0, flex: 1, fontSize: 14 },
                }}
              />
            )}
          </div>

          {kind !== "shell" && (
            <div className="grid gap-1.5 rounded-md border p-3">
              <Box component="span" className="text-xs font-medium" sx={{ fontSize: "inherit" }}>
                测试运行（用当前表单，不会保存）
              </Box>
              <TextField
                rows={2}
                value={paramsText}
                placeholder={'示例参数 JSON，如 {"target":"example.com"}'}
                onChange={(e) => setParamsText(e.target.value)}
                className={"font-mono text-xs"}
                multiline
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "测试参数 JSON" } }}
                sx={{ "& .MuiInputBase-input": { fontFamily: "monospace", fontSize: 12 } }}
              />
              <div>
                <Button onClick={runTest} disabled={testing} size="small" variant="outlined">
                  <PlayIcon /> {testing ? "运行中…" : "测试运行"}
                </Button>
              </div>
              {testResult && (
                <pre
                  className={
                    "max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-secondary p-2 font-mono text-xs " +
                    (testResult.is_error ? "text-danger" : "")
                  }
                >
                  {testResult.output || "（无输出）"}
                </pre>
              )}
            </div>
          )}
        </Box>

        <Divider />
        <div className="flex items-center gap-2 p-4">
          <Button onClick={save} disabled={saving} size="small" variant="contained">
            <SaveIcon /> {isNew ? "创建" : "保存"}
          </Button>
          {!isNew && (
            <Button className="text-danger" onClick={del} size="small" variant="outlined">
              <Trash2Icon /> 删除
            </Button>
          )}
        </div>
      </Box>
    </Drawer>
  );
}
