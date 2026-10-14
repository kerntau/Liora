import * as React from "react";
import { Button, Card, Chip, Description, Drawer, Input, Label, ListBox, Modal, NumberField, ScrollShadow, Select, Separator, Switch, Table, Tabs, TextArea, TextField, } from "@heroui/react";
import { BotIcon, ListFilterIcon, PencilIcon, PlusIcon, ShieldAlertIcon, Trash2Icon } from "lucide-react";
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
    const sys: Tool[] = [], custom: Tool[] = [];
    for (const t of dbTools) {
        if (SDK_KEYS.has(t.key))
            continue; // already covered by hardcoded groups
        if (t.system)
            sys.push(t);
        else
            custom.push(t);
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
function ActionBadge({ action }: {
    action: InterceptAction;
}) {
    if (action === "allow")
        return (<Chip size="sm" variant={"soft"}>
        允许
      </Chip>);
    if (action === "deny")
        return (<Chip color="danger" size="sm" variant={"soft"}>
        禁止
      </Chip>);
    return (<Chip className="border-warning text-warning" size="sm" variant={"secondary"}>
      申请
    </Chip>);
}
function Field({ label, children }: {
    label: string;
    children: React.ReactNode;
}) {
    return (<div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</Label>
      {children}
    </div>);
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
        }
        catch (e) {
            toast.error("加载模型兜底配置失败: " + (e as Error).message);
        }
        finally {
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
        }
        catch (e) {
            toast.error("保存失败: " + (e as Error).message);
        }
        finally {
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
        }
        catch (e) {
            toast.error("恢复失败: " + (e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    return (<div className="space-y-4">
      {/* 启用开关 —— 独立高亮条 */}
      <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${cfg.enabled ? "border-accent/50 bg-accent-soft/40 dark:bg-accent/20" : "bg-surface-secondary/40"}`}>
        <div className="flex items-center gap-2.5">
          <BotIcon className={`h-5 w-5 shrink-0 ${cfg.enabled ? "text-accent" : "text-muted"}`}/>
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
          <Switch isSelected={cfg.enabled} isDisabled={loading} onChange={(v) => patch({ enabled: v })} aria-label="启用">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
      </div>

      {cfg.enabled && (<div className="grid gap-4 lg:grid-cols-5">
          {/* 左:提示词编辑器(直接展开,主区域) */}
          <Card className="lg:col-span-3">
            <Card.Content className="flex h-full flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">审批提示词</p>
                  <p className="text-xs text-muted">模型据此判定 ALLOW / ASK / DENY，可直接编辑</p>
                </div>
                <Button size="sm" className="h-7 text-xs" onPress={restorePrompt} isDisabled={saving} variant={"ghost"}>
                  恢复默认模板
                </Button>
              </div>
              <TextField className="contents" aria-label={"留空使用内置模板"}>
                <TextArea className="min-h-[22rem] flex-1 resize-none font-mono text-xs leading-relaxed" value={cfg.prompt} onChange={(e) => patch({ prompt: e.target.value })} placeholder="留空使用内置模板" spellCheck={false}/>
              </TextField>
              <p className="text-right text-[11px] text-muted">{cfg.prompt.length} 字</p>
            </Card.Content>
          </Card>

          {/* 右:判定参数(设置栏) */}
          <Card className="lg:col-span-2">
            <Card.Content className="space-y-5 p-4">
              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">判定模型与策略</p>
                <Field label="审批模型">
                  <Select selectedKey={String(cfg.profile_id || 0)} aria-label="选择选项" onSelectionChange={(key) => {
                if (key !== null)
                    ((v) => patch({ profile_id: Number(v) }))(String(key));
            }}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id={FOLLOW_ACTIVE} textValue="跟随激活配置">
                          跟随激活配置
                        </ListBox.Item>
                        {profiles.map((p) => (<ListBox.Item key={p.id} id={p.id} textValue="（ ）">
                            {p.name}（{p.model}）
                          </ListBox.Item>))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>
                <Field label="模型判定超时（秒）">
                  <NumberField minValue={1} onChange={(nextValue) => {
                const n = parseInt(Number.isNaN(nextValue) ? "" : String(nextValue), 10);
                if (n > 0)
                    patch({ timeout_seconds: n });
            }} aria-label={"\u8F93\u5165"} value={String(cfg.timeout_seconds) === "" ? NaN : Number(cfg.timeout_seconds)}>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                </Field>
                <Field label="模型失败时（出错 / 超时 / 无法解析）">
                  <Select selectedKey={cfg.fail_action} aria-label="选择选项" onSelectionChange={(key) => {
                if (key !== null)
                    ((v) => patch({ fail_action: v as JudgeConfig["fail_action"] }))(String(key));
            }}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="allow" textValue="放行">
                          放行
                        </ListBox.Item>
                        <ListBox.Item id="ask" textValue="转人工审批">
                          转人工审批
                        </ListBox.Item>
                        <ListBox.Item id="deny" textValue="拦截">
                          拦截
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  人工审批（模型判为「转人工」时）
                </p>
                <Field label="审批等待超时（秒）">
                  <NumberField minValue={5} onChange={(nextValue) => {
                const n = parseInt(Number.isNaN(nextValue) ? "" : String(nextValue), 10);
                if (n > 0)
                    patch({ ask_timeout_seconds: n });
            }} aria-label={"\u8F93\u5165"} value={String(cfg.ask_timeout_seconds) === "" ? NaN : Number(cfg.ask_timeout_seconds)}>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                </Field>
                <Field label="超时后默认动作">
                  <Select selectedKey={cfg.ask_timeout_action} aria-label="选择选项" onSelectionChange={(key) => {
                if (key !== null)
                    ((v) => patch({ ask_timeout_action: v as JudgeConfig["ask_timeout_action"] }))(String(key));
            }}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="deny" textValue="拦截">
                          拦截
                        </ListBox.Item>
                        <ListBox.Item id="allow" textValue="放行">
                          放行
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>
              </div>
            </Card.Content>
          </Card>
        </div>)}

      <div className="flex justify-end">
        <Button size="sm" onPress={save} isDisabled={saving || loading}>
          {saving ? "保存中…" : "保存配置"}
        </Button>
      </div>
    </div>);
}
// ---- page ----
export default function InterceptPage() {
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
        }
        catch {
            // 信息条非关键,失败静默
        }
    }, []);
    const load = React.useCallback(async () => {
        try {
            const r = await api.interceptRules();
            setRules(r);
        }
        catch {
            toast.error("加载拦截规则失败");
        }
        finally {
            setLoading(false);
        }
    }, []);
    React.useEffect(() => {
        load();
        loadScope();
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
        }
        catch {
            // JS RegExp 不支持 Go RE2 扩展语法（如 (?i) 内联 flag）。
            // 这里只是预览校验失败，不代表 Go 端无效；交给服务端最终验证。
            setRegexErr("");
            setRegexWarn(true);
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
            }
            else {
                await api.createInterceptRule(form);
                toast.success("规则已创建");
            }
            setOpen(false);
            load();
        }
        catch (e) {
            toast.error((e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    async function handleDelete(id: number) {
        try {
            await api.deleteInterceptRule(id);
            toast.success("规则已删除");
            load();
        }
        catch (e) {
            toast.error((e as Error).message);
        }
    }
    async function handleToggle(rule: InterceptRule) {
        try {
            await api.toggleInterceptRule(rule.id, !rule.enabled);
            load();
        }
        catch (e) {
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
        }
        catch (e) {
            toast.error("加载失败: " + (e as Error).message);
        }
        finally {
            setScopeLoading(false);
        }
    }
    function toggleTool(key: string, val: boolean) {
        setEnabledTools((prev) => {
            const next = new Set(prev);
            if (val)
                next.add(key);
            else
                next.delete(key);
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
        }
        catch (e) {
            toast.error("保存失败: " + (e as Error).message);
        }
        finally {
            setScopeSaving(false);
        }
    }
    const toolGroups = React.useMemo(() => groupTools(allTools), [allTools]);
    // ---- render ----
    return (<div className="flex flex-1 flex-col gap-5 p-6">
      {/* ---- header ---- */}
      <div className="flex items-center gap-2.5">
        <ShieldAlertIcon className="h-5 w-5 shrink-0"/>
        <div>
          <h1 className="text-lg font-semibold leading-tight">命令拦截</h1>
          <p className="text-sm text-muted mt-0.5">工具执行前先按拦截规则匹配；未命中的命令可交由模型兜底判定</p>
        </div>
      </div>

      {/* ---- 拦截范围信息条（规则匹配与模型兜底共用：不在范围内的工具两者都不介入）---- */}
      <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 ${scopeTools.length === 0
            ? "border-warning/60 bg-warning-soft/50 dark:bg-warning/20"
            : "bg-surface-secondary/40"}`}>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <ListFilterIcon className="h-4 w-4 shrink-0 text-muted"/>
          <span className="shrink-0 font-medium">拦截范围</span>
          {scopeTools.length === 0 ? (<span className="text-warning dark:text-warning">未启用任何工具 — 拦截规则与模型兜底均不会生效</span>) : (<>
              <Chip className="shrink-0" size="sm" variant={"soft"}>
                {scopeTools.length} 个工具
              </Chip>
              <span className="truncate text-muted" title={scopeTools.join("、")}>
                {scopeTools.join("、")}
              </span>
            </>)}
        </div>
        <Button size="sm" className="shrink-0" onPress={openScope} variant={scopeTools.length === 0 ? "primary" : "outline"}>
          <ListFilterIcon className="h-4 w-4"/>
          调整范围
        </Button>
      </div>

      <Tabs defaultSelectedKey="rules" className="flex-1">
        <Tabs.ListContainer>
          <Tabs.List>
            <Tabs.Tab id="rules">
              拦截规则
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="judge">
              模型配置
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* ---- tab: 拦截规则 ---- */}
        <Tabs.Panel id="rules" className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">按优先级（数字越大越先）逐条匹配，首条命中的规则生效</p>
            <Button onPress={openNew} size="sm" className="shrink-0">
              <PlusIcon className="h-4 w-4"/>
              新建规则
            </Button>
          </div>

          <Card>
            <Card.Content className="p-0">
              {loading ? (<p className="p-6 text-sm text-muted">加载中…</p>) : rules.length === 0 ? (<div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <ShieldAlertIcon className="h-8 w-8 text-muted/40"/>
                  <p className="text-sm text-muted">暂无规则</p>
                  <Button size="sm" onPress={openNew} variant={"outline"}>
                    <PlusIcon className="h-4 w-4"/>
                    新建第一条规则
                  </Button>
                </div>) : (<Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label="数据表">
                      <Table.Header>
                        <Table.Column className="w-[72px]" id="column-19256" isRowHeader>
                          优先级
                        </Table.Column>
                        <Table.Column id="column-19322" isRowHeader>
                          名称
                        </Table.Column>
                        <Table.Column className="w-[90px]" id="column-19366" isRowHeader>
                          目标
                        </Table.Column>
                        <Table.Column className="w-[80px]" id="column-19431" isRowHeader>
                          类型
                        </Table.Column>
                        <Table.Column id="column-19496" isRowHeader>
                          模式
                        </Table.Column>
                        <Table.Column className="w-[72px]" id="column-19540" isRowHeader>
                          策略
                        </Table.Column>
                        <Table.Column className="w-[64px] text-center" id="column-19605" isRowHeader>
                          启用
                        </Table.Column>
                        <Table.Column className="w-[80px]" id="column-19682" isRowHeader/>
                      </Table.Header>
                      <Table.Body>
                        {rules.map((rule) => (<Table.Row key={rule.id} className={!rule.enabled ? "opacity-40" : ""} id={rule.id}>
                            <Table.Cell>
                              <span className="font-mono text-xs tabular-nums">{rule.priority}</span>
                            </Table.Cell>
                            <Table.Cell className="font-medium text-sm">{rule.name}</Table.Cell>
                            <Table.Cell>
                              <span className="text-xs text-muted">
                                {rule.match_target === "tool_name" ? "工具名" : "输入内容"}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <span className="text-xs text-muted">
                                {rule.match_type === "regex" ? "正则" : "字符串"}
                              </span>
                            </Table.Cell>
                            <Table.Cell className="max-w-[220px]">
                              <code className="block truncate rounded bg-surface-secondary px-1.5 py-0.5 text-xs font-mono">
                                {rule.pattern}
                              </code>
                            </Table.Cell>
                            <Table.Cell>
                              <ActionBadge action={rule.action}/>
                            </Table.Cell>
                            <Table.Cell className="text-center">
                              <Switch isSelected={rule.enabled} onChange={() => handleToggle(rule)} aria-label="启用">
                                <Switch.Control>
                                  <Switch.Thumb />
                                </Switch.Control>
                              </Switch>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="flex items-center justify-end gap-0.5">
                                <Button className="h-7 w-7" onPress={() => openEdit(rule)} size="sm" isIconOnly variant={"ghost"}>
                                  <PencilIcon className="h-3.5 w-3.5"/>
                                </Button>
                                <Button className="h-7 w-7 text-danger hover:text-danger" onPress={() => handleDelete(rule.id)} size="sm" isIconOnly variant={"ghost"}>
                                  <Trash2Icon className="h-3.5 w-3.5"/>
                                </Button>
                              </div>
                            </Table.Cell>
                          </Table.Row>))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>)}
            </Card.Content>
          </Card>
        </Tabs.Panel>

        {/* ---- tab: 模型配置 ---- */}
        <Tabs.Panel id="judge" className="mt-4">
          <JudgeCard />
        </Tabs.Panel>
      </Tabs>

      {/* ---- editor sheet ---- */}
      
        <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
          <Drawer.Content placement={"right"}>
            <Drawer.Dialog className="flex flex-col gap-0 p-0 sm:max-w-md">
              <Drawer.CloseTrigger aria-label="关闭"/>
              <Drawer.Header className="border-b px-6 py-4">
                <Drawer.Heading>{editing ? "编辑规则" : "新建规则"}</Drawer.Heading>
                <Description className="text-xs">优先级越大越先匹配；首条命中规则生效，后续跳过</Description>
              </Drawer.Header>

              <ScrollShadow className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5" data-scrollbar="thin" data-slot="scroll-shadow">
                <Field label="名称">
                  <TextField className="contents" aria-label={"给规则起个名字"}>
                    <Input placeholder="给规则起个名字" value={form.name} onChange={(e) => set({ name: e.target.value })}/>
                  </TextField>
                </Field>

                <Field label="优先级（数字越大越先匹配）">
                  <NumberField onChange={(nextValue) => set({ priority: parseInt(Number.isNaN(nextValue) ? "" : String(nextValue)) || 0 })} aria-label={"\u8F93\u5165"} value={String(form.priority) === "" ? NaN : Number(form.priority)}>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                </Field>

                <Separator />

                <Field label="匹配目标">
                  <Select selectedKey={form.match_target} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((v) => set({ match_target: v as RuleForm["match_target"] }))(String(key));
        }}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="tool_name" textValue="工具名（tool_name）">
                          工具名（tool_name）
                        </ListBox.Item>
                        <ListBox.Item id="tool_input" textValue="输入内容（tool_input JSON）">
                          输入内容（tool_input JSON）
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>

                <Field label="匹配类型">
                  <Select selectedKey={form.match_type} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((v) => set({ match_type: v as RuleForm["match_type"] }))(String(key));
        }}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="string" textValue="字符串包含">
                          字符串包含
                        </ListBox.Item>
                        <ListBox.Item id="regex" textValue="正则表达式">
                          正则表达式
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>

                <Field label="模式">
                  <TextField className="contents" aria-label={form.match_type === "regex" ? "^Bash$" : "rm -rf"}>
                    <Input placeholder={form.match_type === "regex" ? "^Bash$" : "rm -rf"} value={form.pattern} onChange={(e) => set({ pattern: e.target.value })} className={regexErr ? "border-danger focus-visible:ring-danger" : ""}/>
                  </TextField>
                  {regexErr && <p className="text-xs text-danger mt-1">{regexErr}</p>}
                  {regexWarn && (<p className="text-xs text-warning mt-1">
                      包含 Go RE2 扩展语法（如 <code className="font-mono">(?i)</code>
                      ），浏览器无法预览，提交后由服务端验证
                    </p>)}
                </Field>

                <Separator />

                <Field label="拦截策略">
                  <Select selectedKey={form.action} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((v) => set({ action: v as InterceptAction }))(String(key));
        }}>
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="allow" textValue="允许 — 直接放行，跳过后续规则">
                          允许 — 直接放行，跳过后续规则
                        </ListBox.Item>
                        <ListBox.Item id="deny" textValue="禁止 — 阻断，返回拒绝消息给模型">
                          禁止 — 阻断，返回拒绝消息给模型
                        </ListBox.Item>
                        <ListBox.Item id="ask" textValue="向用户申请 — 等待审批">
                          向用户申请 — 等待审批
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>

                {form.action !== "allow" && (<Field label={form.action === "deny" ? "拒绝消息（返回给模型）" : "审批说明（可选）"}>
                    <TextField className="contents" aria-label={form.action === "deny" ? "操作被安全策略阻止" : ""}>
                      <TextArea placeholder={form.action === "deny" ? "操作被安全策略阻止" : ""} value={form.message} onChange={(e) => set({ message: e.target.value })} rows={2} className="resize-none"/>
                    </TextField>
                  </Field>)}

                {form.action === "ask" && (<>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">启用审批超时</p>
                        <p className="text-xs text-muted">超时后自动处置，不再等待</p>
                      </div>
                      <Switch isSelected={form.timeout_enabled} onChange={(v) => set({ timeout_enabled: v })} aria-label="启用">
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch>
                    </div>
                    {form.timeout_enabled && (<div className="flex items-end gap-3">
                        <Field label="超时时间（秒）">
                          <NumberField minValue={5} className="w-28" onChange={(nextValue) => {
                    const n = parseInt(Number.isNaN(nextValue) ? "" : String(nextValue), 10);
                    if (n > 0)
                        set({ timeout_seconds: n });
                }} aria-label={"\u8F93\u5165"} value={String(form.timeout_seconds) === "" ? NaN : Number(form.timeout_seconds)}>
                            <NumberField.Group>
                              <NumberField.DecrementButton />
                              <NumberField.Input />
                              <NumberField.IncrementButton />
                            </NumberField.Group>
                          </NumberField>
                        </Field>
                        <Field label="超时动作">
                          <Select selectedKey={form.timeout_action} aria-label="选择选项" onSelectionChange={(key) => {
                    if (key !== null)
                        ((v) => set({ timeout_action: v as "deny" | "allow" }))(String(key));
                }}>
                            <Select.Trigger className="w-32">
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="deny" textValue="自动拒绝">
                                  自动拒绝
                                </ListBox.Item>
                                <ListBox.Item id="allow" textValue="自动允许">
                                  自动允许
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        </Field>
                      </div>)}
                  </>)}

                <Separator />

                <div className="flex items-center gap-3">
                  <Switch id="rule-enabled" isSelected={form.enabled} onChange={(v) => set({ enabled: v })} aria-label={"rule-enabled"}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                  <Label htmlFor="rule-enabled" className="cursor-pointer">
                    启用此规则
                  </Label>
                </div>
              </ScrollShadow>

              <Drawer.Footer className="border-t px-6 py-4 flex-row justify-end gap-2">
                <Button onPress={() => setOpen(false)} variant={"outline"}>
                  取消
                </Button>
                <Button onPress={handleSave} isDisabled={saving || !!regexErr}>
                  {saving ? "保存中…" : "保存"}
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      

      {/* ---- scope dialog ---- */}
      
        <Modal.Backdrop isOpen={scopeOpen} onOpenChange={setScopeOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-lg flex flex-col overflow-hidden p-0 gap-0" style={{ maxHeight: "min(80vh, 560px)" }}>
              <Modal.CloseTrigger aria-label="关闭"/>
              <Modal.Header className="shrink-0 border-b px-6 py-4">
                <Modal.Heading className="flex items-center gap-2">
                  <ListFilterIcon className="h-4 w-4"/>
                  拦截范围
                </Modal.Heading>
                <Description className="text-xs">只有启用拦截的工具才会进入规则匹配；其余工具直接放行</Description>
              </Modal.Header>

              <ScrollShadow className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5" data-scrollbar="thin" data-slot="scroll-shadow">
                {scopeLoading ? (<p className="text-sm text-muted py-4">加载中…</p>) : (toolGroups.map((group, gi) => (<div key={group.label}>
                      {gi > 0 && <Separator className="mb-5"/>}
                      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.tools.map((t) => (<div key={t.key} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-secondary/50">
                            <Switch id={`scope-${t.key}`} isSelected={enabledTools.has(t.key)} onChange={(v) => toggleTool(t.key, v)} aria-label={`scope-${t.key}`}>
                              <Switch.Control>
                                <Switch.Thumb />
                              </Switch.Control>
                            </Switch>
                            <label htmlFor={`scope-${t.key}`} className="flex-1 min-w-0 cursor-pointer">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-sm">{t.key}</span>
                                {t.kind && t.kind !== "builtin" && (<Chip className="px-1 py-0 text-[10px]" size="sm" variant={"secondary"}>
                                    {t.kind}
                                  </Chip>)}
                              </div>
                              {t.description && <p className="text-[11px] text-muted line-clamp-1">{t.description}</p>}
                            </label>
                          </div>))}
                      </div>
                    </div>)))}
              </ScrollShadow>

              <div className="shrink-0 border-t px-6 py-3 flex justify-end gap-2">
                <Button size="sm" onPress={() => setScopeOpen(false)} variant={"outline"}>
                  取消
                </Button>
                <Button size="sm" onPress={saveScope} isDisabled={scopeSaving || scopeLoading}>
                  {scopeSaving ? "保存中…" : "保存"}
                </Button>
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      
    </div>);
}
