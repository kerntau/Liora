import * as React from "react";
import { Button, Card, Checkbox, Chip, Description, Drawer, Input, Label, ListBox, NumberField, ScrollShadow, SearchField, Select, Separator, Switch, Tabs, TextArea, TextField, } from "@heroui/react";
import { PlayIcon, PlusIcon, RotateCcwIcon, SaveIcon, SearchIcon, Trash2Icon } from "lucide-react";
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
    if (s === "")
        return undefined;
    if (type === "integer" || type === "number") {
        const n = Number(s);
        return Number.isNaN(n) ? undefined : n;
    }
    if (type === "boolean")
        return s === "true";
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
            if (!subP)
                continue;
            subP.description = r.description;
            if (r.scalar) {
                const dv = coerceDefault(r.type, r.defaultStr);
                if (dv === undefined)
                    delete subP.default;
                else
                    subP.default = dv;
            }
        }
        else {
            const p = props[r.name];
            if (!p)
                continue;
            p.description = r.description;
            if (r.scalar) {
                const dv = coerceDefault(r.type, r.defaultStr);
                if (dv === undefined)
                    delete p.default;
                else
                    p.default = dv;
            }
        }
    }
    return next;
}
// ToolEditor is the full edit form for one tool, rendered inside the drawer.
function ToolEditor({ tool, agents, captureOn, onSaved, onClose, }: {
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
    const setRow = (i: number, patch: Partial<ParamRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
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
        }
        catch (e) {
            toast.error("保存失败：" + (e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    async function reset() {
        try {
            await api.resetTool(tool.key);
            toast.success(`已恢复「${tool.key}」为代码默认`);
            onSaved();
            onClose();
        }
        catch (e) {
            toast.error("恢复失败：" + (e as Error).message);
        }
    }
    return (<div className="flex min-h-0 flex-1 flex-col">
      <ScrollShadow className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4" data-scrollbar="thin" data-slot="scroll-shadow">
        {trafficGated && (<div className="border-warning/40 bg-warning/10 text-muted rounded-md border px-3 py-2 text-xs">
            该工具依赖<b>流量捕获</b>。请先在「系统配置」开启流量捕获，才能绑定给 Agent 并启用。
          </div>)}
        {/* binding + switch */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="grid gap-1.5">
            <Label className="text-muted text-xs">绑定 Agent（决定该工具给哪些 Agent）</Label>
            <div className="flex flex-wrap gap-3">
              {agents.map((ag) => (<Checkbox isDisabled={trafficGated} onChange={() => toggleAgent(ag.key)} isSelected={bound.includes(ag.key) === true} key={ag.key}>
                  <Checkbox.Content className="flex items-center gap-2 text-sm">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>
                      {ag.name}
                      <span className="text-muted font-mono text-xs">{ag.key}</span>
                    </Label>
                  </Checkbox.Content>
                </Checkbox>))}
              {agents.length === 0 && <span className="text-muted text-xs">（无 Agent）</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch isSelected={enabled} onChange={setEnabled} id={`en-${tool.key}`} aria-label={`en-${tool.key}`}>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
            <Label htmlFor={`en-${tool.key}`} className="text-sm">
              启用
            </Label>
          </div>
        </div>

        {/* description */}
        <div className="grid gap-1.5">
          <Label className="text-muted text-xs">工具描述（发送给模型）</Label>
          <TextField className="contents" aria-label={"\u6587\u672C\u5185\u5BB9"}>
            <TextArea className="font-mono text-xs" rows={6} value={description} onChange={(e) => setDescription(e.target.value)}/>
          </TextField>
        </div>

        {/* params */}
        <div className="grid gap-2">
          <Label className="text-muted text-xs">参数（名称 / 类型 / 必填只读；描述与默认值可改）</Label>
          {rows.length === 0 && <span className="text-muted text-xs">（无参数）</span>}
          {rows.map((r, i) => (<div key={(r.parentKey ?? "") + "." + r.name} className={r.parentKey ? "border-l-2 border-muted ml-3 pl-3 grid gap-2 py-2" : "grid gap-2 rounded-md border p-3"}>
              <div className="flex flex-wrap items-center gap-2">
                {r.parentKey && <span className="text-muted font-mono text-[10px]">↳</span>}
                <span className="font-mono text-sm">{r.name}</span>
                <Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"soft"}>
                  {r.type || "?"}
                </Chip>
                {r.required && (<Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
                    必填
                  </Chip>)}
                {r.parentKey && <span className="text-muted text-[10px]">items 子字段</span>}
              </div>
              <div className="grid gap-2">
                <div className="grid gap-1">
                  <Label className="text-muted text-[11px]">描述</Label>
                  <TextField className="contents" aria-label={"\u8F93\u5165"}>
                    <Input className="text-xs" value={r.description} onChange={(e) => setRow(i, { description: e.target.value })}/>
                  </TextField>
                </div>
                <div className="grid gap-1">
                  <Label className="text-muted text-[11px]">默认值</Label>
                  <TextField className="contents" aria-label={r.scalar ? "（空=无默认）" : "仅标量支持"} isDisabled={!r.scalar}>
                    <Input className="text-xs" placeholder={r.scalar ? "（空=无默认）" : "仅标量支持"} value={r.defaultStr} onChange={(e) => setRow(i, { defaultStr: e.target.value })}/>
                  </TextField>
                </div>
              </div>
            </div>))}
        </div>
      </ScrollShadow>

      <Separator className="mt-4"/>
      <div className="flex flex-wrap gap-2 p-4">
        <Button size="sm" onPress={save} isDisabled={saving}>
          <SaveIcon /> 保存
        </Button>
        <Button size="sm" onPress={reset} variant={"outline"}>
          <RotateCcwIcon /> 恢复默认
        </Button>
      </div>
    </div>);
}
// ToolGridCard is one clickable tile in the catalog grid.
function ToolGridCard({ tool, onClick }: {
    tool: Tool;
    onClick: () => void;
}) {
    return (<Button type="button" onClick={onClick} className="hover:border-accent/50 hover:bg-surface-secondary/40 focus-visible:ring-focus flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none" variant="ghost" size="sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{tool.key}</span>
        {tool.system ? (<Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"soft"}>
            系统
          </Chip>) : (<Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
            自定义·{tool.kind}
          </Chip>)}
        {tool.deferred && (<Chip className="px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
            deferred
          </Chip>)}
        {!tool.enabled && (<Chip className="text-danger px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
            已停用
          </Chip>)}
        <Chip className="ml-auto px-1.5 py-0 text-[10px] tabular-nums" title={`累计调用 ${tool.calls ?? 0} 次`} size="sm" variant={"soft"}>
          调用 {tool.calls ?? 0}
        </Chip>
      </div>
      <p className="text-muted line-clamp-1 h-4 text-xs">{tool.description || "（无描述）"}</p>
      <div className="mt-auto flex flex-wrap gap-1 pt-1">
        {tool.agents.length === 0 && <span className="text-muted text-[10px]">（未绑定 Agent）</span>}
        {tool.agents.map((a) => (<Chip key={a} className="px-1.5 py-0 text-[10px]" size="sm" variant={"secondary"}>
            {a}
          </Chip>))}
      </div>
    </Button>);
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
            .catch(() => { });
        api
            .settings()
            .then((s) => setCaptureOn(!!s.traffic_capture))
            .catch(() => { });
    }, [reload]);
    const [query, setQuery] = React.useState("");
    const selected = tools.find((t) => t.key === selectedKey) ?? null;
    const matchTool = React.useCallback((t: Tool) => {
        const q = query.trim().toLowerCase();
        if (!q)
            return true;
        return (t.key.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.agents.some((a) => a.toLowerCase().includes(q)));
    }, [query]);
    const systemTools = tools.filter((t) => t.system && matchTool(t));
    const customTools = tools.filter((t) => !t.system && matchTool(t));
    const allSystemCount = tools.filter((t) => t.system).length;
    const allCustomCount = tools.filter((t) => !t.system).length;
    // clicking a built-in tool opens the binding drawer; a custom tool opens its full editor.
    const openTool = (t: Tool) => (t.system ? setSelectedKey(t.key) : setCustomEdit(t));
    return (<div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">工具</h1>
          <p className="text-muted text-sm">系统工具的描述/绑定，以及自定义工具(command/script/http)</p>
        </div>
        <div className="relative w-64">
          <SearchIcon className="text-muted absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"/>
          <SearchField className="h-8 pl-8 text-sm" value={query} onChange={(nextValue) => setQuery(nextValue)} aria-label={"搜索工具名、描述、Agent…"}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={"搜索工具名、描述、Agent…"}/>
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
      </div>

      <Tabs defaultSelectedKey="system">
        <Tabs.ListContainer>
          <Tabs.List>
            <Tabs.Tab id="system">
              系统工具
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="custom">
              自定义工具
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="system">
          <Card>
            <Card.Header>
              <Card.Title>系统工具</Card.Title>
              <Card.Description>
                {query.trim()
            ? `${systemTools.length} / ${allSystemCount} 个匹配，点击卡片编辑描述、参数默认值与 Agent 绑定`
            : `共 ${allSystemCount} 个，点击卡片编辑描述、参数默认值与 Agent 绑定`}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {systemTools.length === 0 ? (<p className="text-muted py-6 text-center text-sm">
                  {query.trim() ? "没有匹配的系统工具" : "（暂无系统工具，等待后端 seed）"}
                </p>) : (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {systemTools.map((t) => (<ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)}/>))}
                </div>)}
            </Card.Content>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="custom">
          <Card>
            <Card.Header>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Card.Title>自定义工具</Card.Title>
                  <Card.Description>
                    {query.trim()
            ? `shell/command/script/http，${customTools.length} / ${allCustomCount} 个匹配，点击卡片编辑`
            : `shell(bash 声明) / command(命令) / script(Python) / http(API)，共 ${allCustomCount} 个，点击卡片编辑`}
                  </Card.Description>
                </div>
                <Button size="sm" onPress={() => setCustomEdit("new")}>
                  <PlusIcon /> 新建自定义工具
                </Button>
              </div>
            </Card.Header>
            <Card.Content>
              {customTools.length === 0 ? (<p className="text-muted py-6 text-center text-sm">
                  {query.trim() ? "没有匹配的自定义工具" : "（暂无自定义工具，点击右上角「新建自定义工具」）"}
                </p>) : (<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {customTools.map((t) => (<ToolGridCard key={t.key} tool={t} onClick={() => openTool(t)}/>))}
                </div>)}
            </Card.Content>
          </Card>
        </Tabs.Panel>
      </Tabs>

      
        <Drawer.Backdrop isOpen={!!selected} onOpenChange={(o) => !o && setSelectedKey(null)}>
          <Drawer.Content placement={"right"}>
            <Drawer.Dialog className="gap-0 p-0 data-[side=right]:w-[30vw] data-[side=right]:sm:max-w-[30vw]">
              <Drawer.CloseTrigger aria-label="关闭"/>
              {selected && (<>
                  <Drawer.Header className="px-4">
                    <Drawer.Heading className="font-mono">{selected.key}</Drawer.Heading>
                    <Description>编辑描述、参数默认值与 Agent 绑定</Description>
                  </Drawer.Header>
                  <ToolEditor key={selected.key} tool={selected} agents={agents} captureOn={captureOn} onSaved={reload} onClose={() => setSelectedKey(null)}/>
                </>)}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      

      <CustomToolDialog edit={customEdit} agents={agents} onClose={() => setCustomEdit(null)} onSaved={() => {
            setCustomEdit(null);
            reload();
        }}/>
    </div>);
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
function CustomToolDialog({ edit, agents, onClose, onSaved, }: {
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
        if (!edit)
            return;
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
        if (kind === "shell")
            return {};
        const t = ex.timeout_ms ? Number(ex.timeout_ms) : undefined;
        if (kind === "command")
            return { command: ex.command, timeout_ms: t };
        if (kind === "script")
            return { code: ex.code, timeout_ms: t };
        let headers: Record<string, string> = {};
        if (ex.headers.trim()) {
            try {
                headers = JSON.parse(ex.headers);
            }
            catch {
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
            }
            catch {
                toast.error("参数 JSON Schema 格式错误");
                return;
            }
        }
        if (kind === "http" && ex.headers.trim()) {
            try {
                JSON.parse(ex.headers);
            }
            catch {
                toast.error("headers JSON 格式错误");
                return;
            }
        }
        if (kind === "http") {
            const props = (schema as {
                properties?: Record<string, unknown>;
            }).properties;
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
            if (isNew)
                await api.createCustomTool({ key: key.trim(), ...payload });
            else
                await api.updateCustomTool(tool!.key, payload);
            toast.success(isNew ? "已创建自定义工具" : "已保存");
            onSaved();
        }
        catch (e) {
            toast.error("保存失败：" + (e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    async function del() {
        if (!tool)
            return;
        try {
            await api.deleteCustomTool(tool.key);
            toast.success("已删除");
            onSaved();
        }
        catch (e) {
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
            }
            catch {
                toast.error("测试参数 JSON 格式错误");
                return;
            }
        }
        if (kind === "http" && ex.headers.trim()) {
            try {
                JSON.parse(ex.headers);
            }
            catch {
                toast.error("headers JSON 格式错误");
                return;
            }
        }
        setTesting(true);
        setTestResult(null);
        try {
            const r = await api.testCustomTool({ kind, exec: buildExec(), params });
            setTestResult(r);
        }
        catch (e) {
            setTestResult({ output: (e as Error).message, is_error: true });
        }
        finally {
            setTesting(false);
        }
    }
    return (
      <Drawer.Backdrop isOpen={!!edit} onOpenChange={(o) => !o && onClose()}>
        <Drawer.Content placement={"right"}>
          <Drawer.Dialog className="flex flex-col gap-0 p-0 data-[side=right]:w-[45vw] data-[side=right]:sm:max-w-[45vw] data-[side=right]:min-w-[480px]">
            <Drawer.CloseTrigger aria-label="关闭"/>
            <Drawer.Header className="px-4">
              <Drawer.Heading>{isNew ? "新建自定义工具" : `编辑 ${tool?.key}`}</Drawer.Heading>
              <Description>
                shell=bash 环境声明(只需名称+描述，告知模型可用 bash 调用)；command/script/http 需写执行规格。
              </Description>
            </Drawer.Header>

            <ScrollShadow className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4" data-scrollbar="thin" data-slot="scroll-shadow">
              <div className="grid gap-1.5">
                <Label className="text-xs">Key</Label>
                <TextField className="contents" aria-label={"如 nmap_scan"} isDisabled={!isNew}>
                  <Input className="font-mono" placeholder="如 nmap_scan" value={key} onChange={(e) => setKey(e.target.value)}/>
                </TextField>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">描述(发给模型)</Label>
                <TextField className="contents" aria-label={"\u6587\u672C\u5185\u5BB9"}>
                  <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}/>
                </TextField>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">类型</Label>
                <Select selectedKey={kind} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((v) => setKind(v as "shell" | "command" | "script" | "http"))(String(key));
        }}>
                  <Select.Trigger className="w-56">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="shell" textValue="shell（bash 环境声明）">
                        shell（bash 环境声明）
                      </ListBox.Item>
                      <ListBox.Item id="command" textValue="command（shell 命令模板）">
                        command（shell 命令模板）
                      </ListBox.Item>
                      <ListBox.Item id="script" textValue="script（Python 脚本）">
                        script（Python 脚本）
                      </ListBox.Item>
                      <ListBox.Item id="http" textValue="http（API 请求）">
                        http（API 请求）
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                {kind === "shell" && (<p className="text-muted text-xs">
                    适合 nmap、sqlmap、ffuf 等出名工具——模型已知用法，只需声明"可在 bash 中调用"即可。名称+描述会追加到
                    Bash 工具描述里。
                  </p>)}
              </div>

              {kind === "command" && (<div className="grid gap-1.5">
                  <Label className="text-xs">
                    命令模板（占位符 {"{param}"}，如 nmap -p {"{ports}"} {"{target}"}）
                  </Label>
                  <TextField className="contents" aria-label={"\u6587\u672C\u5185\u5BB9"}>
                    <TextArea className="font-mono text-xs" rows={2} value={ex.command} onChange={(e) => setEx({ ...ex, command: e.target.value })}/>
                  </TextField>
                </div>)}
              {kind === "script" && (<div className="grid gap-1.5">
                  <Label className="text-xs">Python 正文（参数走 stdin JSON / os.environ["TOOL_X"]）</Label>
                  <TextField className="contents" aria-label={"import json,sys\nargs=json.load(sys.stdin)\nprint(...)"}>
                    <TextArea className="font-mono text-xs" rows={10} value={ex.code} placeholder={"import json,sys\nargs=json.load(sys.stdin)\nprint(...)"} onChange={(e) => setEx({ ...ex, code: e.target.value })}/>
                  </TextField>
                </div>)}
              {kind === "http" && (<div className="grid gap-2">
                  <div className="flex gap-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Method</Label>
                      <TextField className="contents" aria-label={"\u8F93\u5165"}>
                        <Input className="w-24" value={ex.method} onChange={(e) => setEx({ ...ex, method: e.target.value })}/>
                      </TextField>
                    </div>
                    <div className="grid flex-1 gap-1.5">
                      <Label className="text-xs">URL（可含 {"{param}"}）</Label>
                      <TextField className="contents" aria-label={"\u8F93\u5165"}>
                        <Input className="font-mono text-xs" value={ex.url} onChange={(e) => setEx({ ...ex, url: e.target.value })}/>
                      </TextField>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Headers（JSON，可含 {"{param}"}）</Label>
                    <TextField className="contents" aria-label={'{"Authorization": "Bearer {token}"}'}>
                      <TextArea className="font-mono text-xs" rows={2} value={ex.headers} placeholder={'{"Authorization": "Bearer {token}"}'} onChange={(e) => setEx({ ...ex, headers: e.target.value })}/>
                    </TextField>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Body（可含 {"{param}"}）</Label>
                    <TextField className="contents" aria-label={"\u6587\u672C\u5185\u5BB9"}>
                      <TextArea className="font-mono text-xs" rows={2} value={ex.body} onChange={(e) => setEx({ ...ex, body: e.target.value })}/>
                    </TextField>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">代理 URL（空=直连）</Label>
                      <TextField className="contents" aria-label={"\u8F93\u5165"}>
                        <Input className="font-mono text-xs w-56" value={ex.proxy} onChange={(e) => setEx({ ...ex, proxy: e.target.value })}/>
                      </TextField>
                    </div>
                    <Checkbox onChange={(v) => setEx({ ...ex, use_recording_proxy: !!v })} isSelected={ex.use_recording_proxy === true}>
                      <Checkbox.Content className="mt-4 flex items-center gap-2 text-sm">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label>走记录代理</Label>
                      </Checkbox.Content>
                    </Checkbox>
                  </div>
                </div>)}

              {kind !== "shell" && (<div className="flex items-center gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">超时(ms，空=默认)</Label>
                    <NumberField className="w-32" onChange={(nextValue) => setEx({ ...ex, timeout_ms: Number.isNaN(nextValue) ? "" : String(nextValue) })} aria-label={"\u8F93\u5165"} value={String(ex.timeout_ms) === "" ? NaN : Number(ex.timeout_ms)}>
                      <NumberField.Group>
                        <NumberField.DecrementButton />
                        <NumberField.Input />
                        <NumberField.IncrementButton />
                      </NumberField.Group>
                    </NumberField>
                  </div>
                </div>)}

              {kind !== "shell" && (<div className="grid gap-1.5">
                  <Label className="text-xs">
                    参数 JSON Schema
                    {kind === "http" ? "（http 工具必填，需含 properties）" : "（留空 = 自动给 {args} 薄壳）"}
                  </Label>
                  <TextField className="contents" aria-label={'{"type":"object","properties":{"target":{"type":"string"}},"required":["target"]}'}>
                    <TextArea className="font-mono text-xs" rows={4} value={schemaText} placeholder={'{"type":"object","properties":{"target":{"type":"string"}},"required":["target"]}'} onChange={(e) => setSchemaText(e.target.value)}/>
                  </TextField>
                </div>)}

              <div className="grid gap-1.5">
                <Label className="text-muted text-xs">绑定 Agent</Label>
                <div className="flex flex-wrap gap-3">
                  {agents.map((a) => (<Checkbox onChange={() => toggleAgent(a.key)} isSelected={bound.includes(a.key) === true} key={a.key}>
                      <Checkbox.Content className="flex items-center gap-2 text-sm">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label>
                          {a.name}
                          <span className="text-muted font-mono text-xs">{a.key}</span>
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>))}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <Switch isSelected={enabled} onChange={setEnabled} aria-label="启用" className="flex items-center gap-2 text-sm">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Label>启用</Label>
                </Switch>
                {kind !== "shell" && (<Switch isSelected={deferred} onChange={setDeferred} aria-label="启用" className="flex items-center gap-2 text-sm">
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Label>deferred（大量不常用工具才开）</Label>
                  </Switch>)}
              </div>

              {kind !== "shell" && (<div className="grid gap-1.5 rounded-md border p-3">
                  <Label className="text-xs font-medium">测试运行（用当前表单，不会保存）</Label>
                  <TextField className="contents" aria-label={'示例参数 JSON，如 {"target":"example.com"}'}>
                    <TextArea className="font-mono text-xs" rows={2} value={paramsText} placeholder={'示例参数 JSON，如 {"target":"example.com"}'} onChange={(e) => setParamsText(e.target.value)}/>
                  </TextField>
                  <div>
                    <Button size="sm" onPress={runTest} isDisabled={testing} variant={"outline"}>
                      <PlayIcon /> {testing ? "运行中…" : "测试运行"}
                    </Button>
                  </div>
                  {testResult && (<pre className={"max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-secondary p-2 font-mono text-xs " +
                    (testResult.is_error ? "text-danger" : "")}>
                      {testResult.output || "（无输出）"}
                    </pre>)}
                </div>)}
            </ScrollShadow>

            <Separator />
            <div className="flex items-center gap-2 p-4">
              <Button size="sm" onPress={save} isDisabled={saving}>
                <SaveIcon /> {isNew ? "创建" : "保存"}
              </Button>
              {!isNew && (<Button size="sm" className="text-danger" onPress={del} variant={"outline"}>
                  <Trash2Icon /> 删除
                </Button>)}
            </div>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    );
}
