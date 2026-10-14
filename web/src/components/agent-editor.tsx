import * as React from "react";
import { Button, Checkbox, CheckboxGroup, Chip, Description, Label, ListBox, Modal, NumberField, ScrollShadow, Select, Separator, Switch, Tabs, TextArea, TextField, Tooltip, } from "@heroui/react";
import { EyeIcon, GitCompareIcon, PencilIcon, RotateCcwIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/api";
import type { Agent, AgentDetail, AgentTrigger, MCPServer, PromptVar, PromptVersion, Settings, SkillItem, Tool, } from "@/lib/types";
import { cn } from "@/lib/utils";
// Traffic tools are host tools gated by the global 流量捕获 switch: bindable, but
// only usable when capture is on. Keep this list in sync with traffic.SeedToolMetas.
const TRAFFIC_TOOL_KEYS = new Set(["traffic_search", "traffic_get"]);
// AgentEditor is the tabbed editor for one agent, used inside the agents-page
// drawer (and reused full-page for deep links). Tabs: 配置与提示词 / MCP / Skill /
// Tools. Config + prompt save as before; visibility + tool bindings toggle live.
export function AgentEditor({ agentKey, onSaved }: {
    agentKey: string;
    onSaved?: () => void;
}) {
    const [detail, setDetail] = React.useState<AgentDetail | null>(null);
    const [versions, setVersions] = React.useState<PromptVersion[]>([]);
    const [variables, setVariables] = React.useState<PromptVar[]>([]);
    const [mcp, setMcp] = React.useState<MCPServer[]>([]);
    const [skills, setSkills] = React.useState<SkillItem[]>([]);
    const [tools, setTools] = React.useState<Tool[]>([]);
    const [loaded, setLoaded] = React.useState(false);
    const [viewVer, setViewVer] = React.useState<PromptVersion | null>(null);
    const [diffVer, setDiffVer] = React.useState<PromptVersion | null>(null);
    const [prompt, setPrompt] = React.useState("");
    const [mcpVisible, setMcpVisible] = React.useState<number[]>([]);
    const [skillVisible, setSkillVisible] = React.useState<string[]>([]);
    const [preview, setPreview] = React.useState("");
    const [maxTurns, setMaxTurns] = React.useState("0");
    const [runSecs, setRunSecs] = React.useState("600");
    // "" = 跟随(未绑定)；否则为 profile id 字符串
    const [llmProfileId, setLlmProfileId] = React.useState("");
    const [llmProfiles, setLlmProfiles] = React.useState<NonNullable<AgentDetail["llm_profiles"]>>([]);
    const [webSearch, setWebSearch] = React.useState(false);
    const [interactiveShell, setInteractiveShell] = React.useState(false);
    const [wrapup, setWrapup] = React.useState("");
    const [wrapupDefault, setWrapupDefault] = React.useState("");
    const [wrapupTurns, setWrapupTurns] = React.useState("0");
    const [wrapupTurnsDefault, setWrapupTurnsDefault] = React.useState(5);
    // 任务级超时收尾词(仅 worker/planner)
    const [ttSupported, setTtSupported] = React.useState(false);
    const [ttWrapup, setTtWrapup] = React.useState("");
    const [ttWrapupDefault, setTtWrapupDefault] = React.useState("");
    const [ttTurns, setTtTurns] = React.useState("0");
    const [ttTurnsDefault, setTtTurnsDefault] = React.useState(5);
    const [settings, setSettings] = React.useState<Settings | null>(null);
    React.useEffect(() => {
        api
            .mcpServers()
            .then(setMcp)
            .catch(() => { });
        api
            .skills()
            .then(setSkills)
            .catch(() => { });
        api
            .tools()
            .then(setTools)
            .catch(() => { });
        api
            .settings()
            .then(setSettings)
            .catch(() => { });
    }, []);
    // global gates: traffic tools need 流量捕获, web search needs the master switch.
    const captureOn = !!settings?.traffic_capture;
    const webSearchGlobalOn = !!settings?.web_search_enabled;
    const reload = React.useCallback(() => {
        api
            .getAgent(agentKey)
            .then((d) => {
            setDetail(d);
            setPrompt(d.prompt ?? "");
            setVariables(d.variables ?? []);
            setVersions(d.versions ?? []);
            setMcpVisible(d.visibility?.mcp ?? []);
            setSkillVisible(d.visibility?.skill ?? []);
            setMaxTurns(String(d.agent?.max_turns ?? 0));
            setRunSecs(String(d.agent?.run_seconds ?? 600));
            setLlmProfileId(d.agent?.llm_profile_id != null ? String(d.agent.llm_profile_id) : "");
            setLlmProfiles(d.llm_profiles ?? []);
            setWebSearch(!!d.agent?.web_search);
            setInteractiveShell(!!d.agent?.interactive_shell);
            setWrapup(d.wrapup_prompt ?? "");
            setWrapupDefault(d.wrapup_default ?? "");
            setWrapupTurns(String(d.wrapup_max_turns ?? 0));
            setWrapupTurnsDefault(d.wrapup_max_turns_default ?? 5);
            setTtSupported(!!d.task_timeout_wrapup_supported);
            setTtWrapup(d.task_timeout_wrapup_prompt ?? "");
            setTtWrapupDefault(d.task_timeout_wrapup_default ?? "");
            setTtTurns(String(d.task_timeout_wrapup_max_turns ?? 0));
            setTtTurnsDefault(d.task_timeout_wrapup_max_turns_default ?? 5);
        })
            .catch(() => setDetail(null))
            .finally(() => setLoaded(true));
    }, [agentKey]);
    React.useEffect(() => {
        reload();
    }, [reload]);
    async function doPreview() {
        try {
            const r = await api.previewAgentPrompt(agentKey, prompt);
            setPreview(r.error ? "渲染错误：" + r.error : r.rendered);
        }
        catch (e) {
            setPreview("预览失败：" + (e as Error).message);
        }
    }
    async function savePrompt() {
        try {
            const r = await api.saveAgentPrompt(agentKey, prompt);
            toast.success(`已保存为版本 v${r.version}`);
            reload();
            onSaved?.();
        }
        catch (e) {
            toast.error("保存失败：" + (e as Error).message);
        }
    }
    async function resetPrompt() {
        try {
            const r = await api.resetAgentPrompt(agentKey);
            toast.success(`已恢复为内置默认（v${r.version}）`);
            reload();
        }
        catch (e) {
            toast.error("恢复失败：" + (e as Error).message);
        }
    }
    async function saveWrapup() {
        try {
            const turns = Math.max(0, Math.floor(Number(wrapupTurns) || 0));
            await api.saveAgentWrapup(agentKey, wrapup, turns);
            toast.success(wrapup.trim() || turns > 0 ? "收尾配置已保存（下次运行生效）" : "已清空，将使用内置默认");
            reload();
        }
        catch (e) {
            toast.error("保存失败：" + (e as Error).message);
        }
    }
    async function resetWrapup() {
        try {
            await api.resetAgentWrapup(agentKey);
            toast.success("已恢复为内置默认");
            reload();
        }
        catch (e) {
            toast.error("恢复失败：" + (e as Error).message);
        }
    }
    async function saveTaskTimeoutWrapup() {
        try {
            const turns = Math.max(0, Math.floor(Number(ttTurns) || 0));
            await api.saveAgentTaskTimeoutWrapup(agentKey, ttWrapup, turns);
            toast.success("任务超时收尾配置已保存（下次运行生效）");
            reload();
        }
        catch (e) {
            toast.error("保存失败：" + (e as Error).message);
        }
    }
    async function resetTaskTimeoutWrapup() {
        try {
            await api.resetAgentTaskTimeoutWrapup(agentKey);
            toast.success("已恢复为内置默认");
            reload();
        }
        catch (e) {
            toast.error("恢复失败：" + (e as Error).message);
        }
    }
    async function saveConfig() {
        try {
            // 只提交本 agent 实际展示的字段，避免把未显示项(如 goals 的 max_turns)覆盖成默认。
            const patch: Parameters<typeof api.saveAgentConfig>[1] = {
                llm_profile_id: llmProfileId === "" ? null : Number(llmProfileId),
            };
            if (showConfig) {
                patch.max_turns = Math.max(0, Math.floor(Number(maxTurns) || 0));
                patch.run_seconds = Math.max(0, Math.floor(Number(runSecs) || 0));
            }
            if (showWebSearch)
                patch.web_search = webSearch;
            if (showInteractiveShell)
                patch.interactive_shell = interactiveShell;
            await api.saveAgentConfig(agentKey, patch);
            toast.success("已保存运行配置（立即生效）");
            reload();
        }
        catch (e) {
            toast.error("保存失败：" + (e as Error).message);
        }
    }
    // applyVis optimistically updates, persists, and toasts success/failure. On
    // failure it reverts to the prior selection so the UI never lies about state.
    async function applyVis(nextMcp: number[], nextSkill: string[], okMsg: string) {
        const prevMcp = mcpVisible;
        const prevSkill = skillVisible;
        setMcpVisible(nextMcp);
        setSkillVisible(nextSkill);
        try {
            await api.setAgentVisibility(agentKey, nextMcp, nextSkill);
            toast.success(okMsg);
            onSaved?.(); // refresh the list so the card's MCP/Skill counts stay in sync
        }
        catch (e) {
            setMcpVisible(prevMcp);
            setSkillVisible(prevSkill);
            toast.error("保存失败：" + (e as Error).message);
        }
    }
    function toggleMcp(id: number) {
        const on = mcpVisible.includes(id);
        const name = mcp.find((m) => m.id === id)?.name ?? String(id);
        applyVis(on ? mcpVisible.filter((x) => x !== id) : [...mcpVisible, id], skillVisible, `${on ? "已取消" : "已开启"} MCP「${name}」可见`);
    }
    function toggleSkill(name: string) {
        const on = skillVisible.includes(name);
        applyVis(mcpVisible, on ? skillVisible.filter((x) => x !== name) : [...skillVisible, name], `${on ? "已取消" : "已开启"} Skill「${name}」可见`);
    }
    async function toggleTool(t: Tool) {
        const on = t.agents.includes(agentKey);
        const nextAgents = on ? t.agents.filter((k) => k !== agentKey) : [...t.agents, agentKey];
        // optimistic update
        setTools((ts) => ts.map((x) => (x.key === t.key ? { ...x, agents: nextAgents } : x)));
        try {
            await api.saveTool(t.key, {
                description: t.description,
                schema: t.schema,
                agents: nextAgents,
                enabled: t.enabled,
            });
            toast.success(`${on ? "已解绑" : "已绑定"}工具「${t.key}」`);
            onSaved?.(); // refresh the list so the card's 工具 count stays in sync
        }
        catch (e) {
            toast.error("保存工具绑定失败：" + (e as Error).message);
            reload();
            api
                .tools()
                .then(setTools)
                .catch(() => { });
        }
    }
    if (loaded && !detail) {
        return <div className="text-muted p-6 text-center text-sm">未找到 Agent：{agentKey}</div>;
    }
    // config is meaningless for the conversational main agent and the fixed-budget
    // goals decomposer; every other agent (workers, custom assistants) honors it.
    const showConfig = agentKey !== "mainagent" && agentKey !== "goals";
    // web search applies to every conversational/executing agent except the one-shot
    // goals decomposer; it's gated by the global master switch.
    const showWebSearch = agentKey !== "goals";
    // interactive shell (持久 PTY 会话工具族) 同样对除 goals 外的 agent 开放;无全局门控。
    const showInteractiveShell = agentKey !== "goals";
    // 每个 agent(含 goals/mainagent)都跑在某个 LLM 上,故「默认模型」绑定对所有 agent 开放。
    const showLLM = true;
    // triggers (P3) only attach to custom agents.
    const isCustom = !!detail && !detail.agent?.builtin;
    return (<Tabs defaultSelectedKey="prompt" className="flex min-h-0 flex-1 flex-col">
      <Tabs.ListContainer>
        <Tabs.List className="mx-4 mt-2 w-fit">
          <Tabs.Tab id="prompt">
            配置与提示词
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="wrapup">
            收尾提示词
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="mcp">
            MCP
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="skill">
            Skill
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="tools">
            Tools
            <Tabs.Indicator />
          </Tabs.Tab>
          {isCustom && (<Tabs.Tab id="triggers">
              触发
              <Tabs.Indicator />
            </Tabs.Tab>)}
        </Tabs.List>
      </Tabs.ListContainer>

      {/* 配置 + 提示词 */}
      <Tabs.Panel id="prompt" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid gap-4">
          {(showLLM || showConfig || showWebSearch || showInteractiveShell) && (<div className="grid gap-3 rounded-md border p-3">
              {showLLM && (<div className="grid gap-1.5">
                  <Label htmlFor="llm-profile" className="text-xs">
                    默认模型（LLM 配置）
                  </Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select selectedKey={llmProfileId || "__follow__"} aria-label="选择选项" onSelectionChange={(key) => {
                    if (key !== null)
                        ((v) => setLlmProfileId(v === "__follow__" ? "" : v))(String(key));
                }}>
                      <Select.Trigger id="llm-profile" className="h-8 w-72">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="__follow__" textValue="跟随任务 / 全局激活配置">
                            跟随任务 / 全局激活配置
                          </ListBox.Item>
                          {llmProfiles.map((p) => (<ListBox.Item key={p.id} id={String(p.id)} textValue="（ ）">
                              {p.name}（{p.model}）{p.is_default ? " · 默认" : ""}
                            </ListBox.Item>))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <span className="text-muted max-w-md text-xs">
                      为该 Agent 绑定固定 LLM 配置（点「保存配置」生效）。优先级：Agent 绑定 &gt; 任务/会话指定 &gt;
                      全局激活。
                    </span>
                  </div>
                </div>)}
              <div className="flex flex-wrap items-end gap-3">
                {showConfig && (<>
                    <div className="grid gap-1.5">
                      <Label htmlFor="max-turns" className="text-xs">
                        最大循环次数（0=不限）
                      </Label>
                      <NumberField id="max-turns" minValue={0} className="h-8 w-32" onChange={(nextValue) => setMaxTurns(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"max-turns"} value={String(maxTurns) === "" ? NaN : Number(maxTurns)}>
                        <NumberField.Group>
                          <NumberField.DecrementButton />
                          <NumberField.Input />
                          <NumberField.IncrementButton />
                        </NumberField.Group>
                      </NumberField>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="run-seconds" className="text-xs">
                        运行时长（秒，0=不限）
                      </Label>
                      <NumberField id="run-seconds" minValue={0} className="h-8 w-32" onChange={(nextValue) => setRunSecs(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"run-seconds"} value={String(runSecs) === "" ? NaN : Number(runSecs)}>
                        <NumberField.Group>
                          <NumberField.DecrementButton />
                          <NumberField.Input />
                          <NumberField.IncrementButton />
                        </NumberField.Group>
                      </NumberField>
                    </div>
                  </>)}
                <Button size="sm" onPress={saveConfig} variant={"outline"}>
                  <SaveIcon /> 保存配置
                </Button>
              </div>
              {showWebSearch && (<div className="flex items-center gap-3 border-t pt-3">
                  <Switch id="web-search" isSelected={webSearch} isDisabled={!webSearchGlobalOn} onChange={setWebSearch} aria-label={"web-search"}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                  <div className="grid gap-0.5">
                    <Label htmlFor="web-search" className="text-sm">
                      网络搜索
                    </Label>
                    <span className="text-muted text-xs">
                      {webSearchGlobalOn
                    ? "为该 Agent 开启后（点上方保存生效），可用 web_search 联网检索"
                    : "需先在「系统配置」开启网络搜索并配置后端，才能在此启用"}
                    </span>
                  </div>
                </div>)}
              {showInteractiveShell && (<div className="flex items-center gap-3 border-t pt-3">
                  <Switch id="interactive-shell" isSelected={interactiveShell} onChange={setInteractiveShell} aria-label={"interactive-shell"}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                  <div className="grid gap-0.5">
                    <Label htmlFor="interactive-shell" className="text-sm">
                      交互式 Shell
                    </Label>
                    <span className="text-muted text-xs">
                      为该 Agent 开启后（点上方保存生效），可用持久 PTY 会话工具（shell_open/send/read/close/list）驱动
                      msfconsole/ssh/REPL 等交互程序
                    </span>
                  </div>
                </div>)}
            </div>)}

          <div className="grid gap-2">
            <Label className="text-muted text-xs">变量（点击插入占位符，渲染时由运行时数据替换）</Label>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (<Tooltip key={v.name}>
                  <Button type="button" onClick={() => setPrompt((p) => `${p}{{.${v.name}}}`)} className="hover:bg-surface-secondary inline-flex items-center gap-1 rounded-md border bg-surface-secondary/40 px-2 py-1 font-mono text-xs" variant="ghost" size="sm">
                    {`{{.${v.name}}}`}
                    <Chip className="px-1 py-0 text-[10px]" size="sm" variant={"soft"}>
                      {v.source}
                    </Chip>
                  </Button>

                  <Tooltip.Content className="max-w-xs">
                    <p className="font-medium">{v.description}</p>
                    <p className="text-muted mt-1">示例：{v.example}</p>
                  </Tooltip.Content>
                </Tooltip>))}
              {variables.length === 0 && <span className="text-muted text-xs">（无变量）</span>}
            </div>
          </div>

          <TextField className="contents" aria-label={"留空则使用内置默认提示词"}>
            <TextArea className="font-mono text-xs" rows={16} value={prompt} placeholder="留空则使用内置默认提示词" onChange={(e) => setPrompt(e.target.value)}/>
          </TextField>

          <div className="flex flex-wrap gap-2">
            <Modal>
              
                <Button size="sm" onPress={doPreview} variant={"outline"}>
                  <EyeIcon /> 预览渲染
                </Button>
              
              <Modal.Backdrop>
                <Modal.Container>
                  <Modal.Dialog className="sm:max-w-2xl">
                    <Modal.CloseTrigger aria-label="关闭"/>
                    <Modal.Header>
                      <Modal.Heading>渲染预览</Modal.Heading>
                      <Description>所有 {`{{.Var}}`} 已由后端用示例值替换。</Description>
                    </Modal.Header>
                    <div className="max-h-[60vh] overflow-auto rounded-md border bg-surface-secondary/30 p-3">
                      <Markdown text={preview}/>
                    </div>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
            </Modal>
            <Button size="sm" onPress={savePrompt}>
              <SaveIcon /> 保存为新版本
            </Button>
            <Button size="sm" onPress={resetPrompt} variant={"outline"}>
              <RotateCcwIcon /> 恢复默认
            </Button>
          </div>

          <Separator />
          <div className="grid gap-2">
            <Label className="text-muted text-xs">版本历史</Label>
            <ul className="grid gap-1">
              {versions.map((ver, i) => (<li key={ver.version} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-xs hover:bg-surface-secondary/50">
                  <span className="font-mono shrink-0">v{ver.version}</span>
                  {i === 0 && (<Chip className="px-1.5 py-0 shrink-0" size="sm" variant={"soft"}>
                      当前
                    </Chip>)}
                  <span className="text-muted truncate flex-1">{ver.note}</span>
                  {ver.ts && (<span className="text-muted/60 shrink-0 tabular-nums">
                      {new Date(ver.ts).toLocaleDateString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                })}
                    </span>)}
                  <Button className="size-6 shrink-0" onPress={() => setViewVer(ver)} size="sm" isIconOnly variant={"ghost"}>
                    <EyeIcon className="size-3"/>
                  </Button>
                  {i > 0 && versions[0] && (<Button className="size-6 shrink-0" onPress={() => setDiffVer(ver)} size="sm" isIconOnly variant={"ghost"}>
                      <GitCompareIcon className="size-3"/>
                    </Button>)}
                </li>))}
              {versions.length === 0 && <li className="text-muted text-xs">（暂无保存的版本，使用内置默认）</li>}
            </ul>
          </div>

          {/* 查看版本 dialog */}
          
            <Modal.Backdrop isOpen={!!viewVer} onOpenChange={(o) => {
            if (!o)
                setViewVer(null);
        }}>
              <Modal.Container>
                <Modal.Dialog className="sm:max-w-2xl">
                  <Modal.CloseTrigger aria-label="关闭"/>
                  <Modal.Header>
                    <Modal.Heading>
                      v{viewVer?.version}
                      {viewVer?.version === versions[0]?.version && (<Chip className="ml-2 px-1.5 py-0 align-middle" size="sm" variant={"soft"}>
                          当前
                        </Chip>)}
                    </Modal.Heading>
                    <Description>
                      {viewVer?.note || "（无备注）"}
                      {viewVer?.ts && (<span className="ml-2 text-muted/60">{new Date(viewVer.ts).toLocaleString("zh-CN")}</span>)}
                    </Description>
                  </Modal.Header>
                  <pre className="bg-surface-secondary max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md p-3 font-mono text-xs">
                    {viewVer?.template_text || "（空）"}
                  </pre>
                  <div className="flex gap-2 justify-end">
                    {viewVer && viewVer.version !== versions[0]?.version && (<Button size="sm" onPress={() => {
                if (viewVer) {
                    setDiffVer(viewVer);
                    setViewVer(null);
                }
            }} variant={"outline"}>
                        <GitCompareIcon className="mr-1 size-3.5"/> 与当前版本对比
                      </Button>)}
                    <Button size="sm" onPress={() => {
            if (viewVer) {
                setPrompt(viewVer.template_text);
                setViewVer(null);
                toast.success(`已加载 v${viewVer.version} 到编辑器，确认后点「保存为新版本」`);
            }
        }}>
                      加载到编辑器
                    </Button>
                  </div>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          

          {/* 版本对比 dialog */}
          
            <Modal.Backdrop isOpen={!!diffVer} onOpenChange={(o) => {
            if (!o)
                setDiffVer(null);
        }}>
              <Modal.Container>
                <Modal.Dialog className="sm:max-w-3xl">
                  <Modal.CloseTrigger aria-label="关闭"/>
                  <Modal.Header>
                    <Modal.Heading>
                      版本对比：v{diffVer?.version} → v{versions[0]?.version}（当前）
                    </Modal.Heading>
                    <Description>
                      <span className="inline-flex items-center gap-3 text-xs">
                        <span className="rounded bg-danger/15 px-1.5 py-0.5 text-danger dark:text-danger">- 删除</span>
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-success dark:text-success">
                          + 新增
                        </span>
                      </span>
                    </Description>
                  </Modal.Header>
                  <DiffView oldText={diffVer?.template_text ?? ""} newText={versions[0]?.template_text ?? ""}/>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          
        </div>
      </Tabs.Panel>

      {/* 收尾提示词 */}
      <Tabs.Panel id="wrapup" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid gap-3">
          <p className="text-muted text-xs leading-relaxed">
            当此 Agent 因<b>超时</b>或<b>步数耗尽</b>被终止时，系统会注入这段「收尾提示词」跑一轮收尾：
            先把已识别但未落库的内容写回，再输出一句总结（避免烂尾）。留空则使用内置默认。
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-xs">收尾提示词正文</Label>
            {wrapup.trim() ? (<Chip className="px-1.5 py-0" size="sm" variant={"soft"}>
                自定义
              </Chip>) : (<Chip className="px-1.5 py-0" size="sm" variant={"secondary"}>
                使用内置默认
              </Chip>)}
          </div>
          <TextField className="contents" aria-label={wrapupDefault || "留空则使用内置默认收尾提示词"}>
            <TextArea className="font-mono text-xs" rows={10} value={wrapup} placeholder={wrapupDefault || "留空则使用内置默认收尾提示词"} onChange={(e) => setWrapup(e.target.value)}/>
          </TextField>
          <div className="grid gap-1.5">
            <Label htmlFor="wrapup-turns" className="text-xs">
              收尾轮数（收尾阶段自身最多跑几轮；0=用内置默认 {wrapupTurnsDefault} 轮）
            </Label>
            <NumberField id="wrapup-turns" minValue={0} className="h-8 w-32" onChange={(nextValue) => setWrapupTurns(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"wrapup-turns"} value={String(wrapupTurns) === "" ? NaN : Number(wrapupTurns)}>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input />
                <NumberField.IncrementButton />
              </NumberField.Group>
            </NumberField>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onPress={saveWrapup}>
              保存
            </Button>
            <Button size="sm" onPress={resetWrapup} variant={"outline"}>
              恢复默认
            </Button>
          </div>
          {wrapupDefault && (<>
              <Separator />
              <div className="grid gap-1.5">
                <Label className="text-muted text-xs">内置默认（只读，供参考）</Label>
                <pre className="text-muted max-h-40 overflow-y-auto rounded-md border bg-surface-secondary/30 p-2 text-xs whitespace-pre-wrap">
                  {wrapupDefault}
                </pre>
              </div>
            </>)}

          {ttSupported && (<>
              <Separator className="my-2"/>
              <p className="text-muted text-xs leading-relaxed">
                <b>任务超时收尾</b>（与上面的 per-run 收尾是<b>两套</b>）：当<b>整个任务</b>
                到达超时上限、即将结束时注入。 与 per-run 语义常相反（如 planner：per-run
                说“别停继续规划”，任务超时说“到点停止、做最后判定”）。留空则用内置默认。
              </p>
              <div className="flex items-center gap-2">
                <Label className="text-xs">任务超时收尾提示词正文</Label>
                {ttWrapup.trim() ? (<Chip className="px-1.5 py-0" size="sm" variant={"soft"}>
                    自定义
                  </Chip>) : (<Chip className="px-1.5 py-0" size="sm" variant={"secondary"}>
                    使用内置默认
                  </Chip>)}
              </div>
              <TextField className="contents" aria-label={ttWrapupDefault || "留空则使用内置默认任务超时收尾提示词"}>
                <TextArea className="font-mono text-xs" rows={10} value={ttWrapup} placeholder={ttWrapupDefault || "留空则使用内置默认任务超时收尾提示词"} onChange={(e) => setTtWrapup(e.target.value)}/>
              </TextField>
              <div className="grid gap-1.5">
                <Label htmlFor="tt-turns" className="text-xs">
                  收尾轮数（0=用内置默认 {ttTurnsDefault} 轮）
                </Label>
                <NumberField id="tt-turns" minValue={0} className="h-8 w-32" onChange={(nextValue) => setTtTurns(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"tt-turns"} value={String(ttTurns) === "" ? NaN : Number(ttTurns)}>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onPress={saveTaskTimeoutWrapup}>
                  保存
                </Button>
                <Button size="sm" onPress={resetTaskTimeoutWrapup} variant={"outline"}>
                  恢复默认
                </Button>
              </div>
              {ttWrapupDefault && (<div className="grid gap-1.5">
                  <Label className="text-muted text-xs">内置默认（只读，供参考）</Label>
                  <pre className="text-muted max-h-40 overflow-y-auto rounded-md border bg-surface-secondary/30 p-2 text-xs whitespace-pre-wrap">
                    {ttWrapupDefault}
                  </pre>
                </div>)}
            </>)}
        </div>
      </Tabs.Panel>

      {/* MCP 可见性 */}
      <Tabs.Panel id="mcp" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-muted mb-3 text-xs">勾选此 Agent 可见的 MCP 服务器。</p>
        <CheckboxGroup className="grid gap-2" aria-label="MCP 授权" value={mcpVisible.map(String)} onChange={(next) => {
            const changed = mcp.find((server) => mcpVisible.includes(server.id) !== next.includes(String(server.id)));
            if (changed)
                toggleMcp(changed.id);
        }}>
          {mcp.map((m) => (<Checkbox key={m.id} value={String(m.id)}>
              <Checkbox.Content className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label>
                  {m.name}
                  <span className="text-muted ml-auto text-xs">{m.transport}</span>
                </Label>
              </Checkbox.Content>
            </Checkbox>))}
          {mcp.length === 0 && <span className="text-muted text-xs">（暂无 MCP）</span>}
        </CheckboxGroup>
      </Tabs.Panel>

      {/* Skill 可见性 */}
      <Tabs.Panel id="skill" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-muted mb-3 text-xs">勾选此 Agent 可见的 Skill。</p>
        <CheckboxGroup className="grid gap-2" aria-label="Skill 授权" value={skillVisible} onChange={(next) => {
            const changed = skills.find((skill) => skillVisible.includes(skill.name) !== next.includes(skill.name));
            if (changed)
                toggleSkill(changed.name);
        }}>
          {skills.map((s) => (<Checkbox key={s.name} value={s.name}>
              <Checkbox.Content className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label>
                  <span className="font-mono text-xs">{s.name}</span>
                  {s.description && <span className="text-muted ml-auto truncate text-xs">{s.description}</span>}
                </Label>
              </Checkbox.Content>
            </Checkbox>))}
          {skills.length === 0 && <span className="text-muted text-xs">（暂无 Skill）</span>}
        </CheckboxGroup>
      </Tabs.Panel>

      {/* Tools 绑定 */}
      <Tabs.Panel id="tools" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="text-muted mb-3 text-xs">勾选绑定给此 Agent 的内置工具。</p>
        <CheckboxGroup className="grid gap-2" aria-label="工具授权" value={tools.filter((tool) => tool.agents.includes(agentKey)).map((tool) => tool.key)} onChange={(next) => {
            const changed = tools.find((tool) => tool.agents.includes(agentKey) !== next.includes(tool.key));
            if (changed)
                void toggleTool(changed);
        }}>
          {tools.map((t) => {
            const isTraffic = TRAFFIC_TOOL_KEYS.has(t.key);
            const gated = isTraffic && !captureOn; // traffic tools need 流量捕获 on
            return (<Checkbox isDisabled={gated} key={t.key} value={t.key}>
                <Checkbox.Content className={cn("flex items-center gap-2 rounded-md border p-2 text-sm", gated && "opacity-60")}>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label>
                    <span className="font-mono text-xs">{t.key}</span>
                    {isTraffic && (<Chip className="px-1 py-0 text-[9px]" size="sm" variant={"soft"}>
                        流量
                      </Chip>)}
                    {!t.enabled && (<Chip className="text-danger px-1 py-0 text-[9px]" size="sm" variant={"secondary"}>
                        已停用
                      </Chip>)}
                    {gated ? (<span className="text-muted ml-auto text-xs">需开启流量捕获</span>) : (t.description && (<span className="text-muted ml-auto line-clamp-1 max-w-[55%] text-xs">{t.description}</span>))}
                  </Label>
                </Checkbox.Content>
              </Checkbox>);
        })}
          {tools.length === 0 && <span className="text-muted text-xs">（暂无工具）</span>}
        </CheckboxGroup>
      </Tabs.Panel>

      {/* 触发(P3, 仅自定义 agent) */}
      {isCustom && (<Tabs.Panel id="triggers" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <AgentTriggersTab agentKey={agentKey} agent={detail?.agent}/>
        </Tabs.Panel>)}
    </Tabs>);
}
// ---------- Diff helpers ----------
type DiffLine = {
    type: "same" | "add" | "del";
    text: string;
};
function computeDiff(oldText: string, newText: string): DiffLine[] {
    const a = oldText.split("\n");
    const b = newText.split("\n");
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const result: DiffLine[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            result.unshift({ type: "same", text: a[i - 1] });
            i--;
            j--;
        }
        else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: "add", text: b[j - 1] });
            j--;
        }
        else {
            result.unshift({ type: "del", text: a[i - 1] });
            i--;
        }
    }
    return result;
}
function DiffView({ oldText, newText }: {
    oldText: string;
    newText: string;
}) {
    const lines = React.useMemo(() => computeDiff(oldText, newText), [oldText, newText]);
    return (<pre className="max-h-[60vh] overflow-auto rounded-md border bg-surface-secondary/30 p-2 font-mono text-xs leading-5">
      {lines.map((l, idx) => (<div key={idx} className={cn("whitespace-pre-wrap px-1", l.type === "del" && "bg-danger/15 text-danger dark:text-danger", l.type === "add" && "bg-success/15 text-success dark:text-success", l.type === "same" && "text-muted")}>
          <span className="select-none mr-1 opacity-50">{l.type === "del" ? "-" : l.type === "add" ? "+" : " "}</span>
          {l.text}
        </div>))}
    </pre>);
}
// AgentTriggersTab manages a custom agent's P3 triggers: list + add + delete.
// Each trigger fires (定时/发现finding/目标达成/任务超时/工具调用，可多选) → a new conversation runs
// in parallel with the base user message + auto context appended by the backend.
function AgentTriggersTab({ agentKey, agent }: {
    agentKey: string;
    agent?: Agent;
}) {
    const [triggers, setTriggers] = React.useState<AgentTrigger[]>([]);
    const [tools, setTools] = React.useState<Tool[]>([]);
    // 触发后处理策略(每 agent);初值来自 agent detail,改动即保存。
    const [runMode, setRunMode] = React.useState<"serial" | "parallel">(agent?.trigger_run_mode ?? "serial");
    const [mergeMode, setMergeMode] = React.useState<"by_task" | "all" | "none">(agent?.trigger_merge_mode ?? "all");
    const [maxParallel, setMaxParallel] = React.useState(String(agent?.trigger_max_parallel ?? 5));
    React.useEffect(() => {
        setRunMode(agent?.trigger_run_mode ?? "serial");
        setMergeMode(agent?.trigger_merge_mode ?? "all");
        setMaxParallel(String(agent?.trigger_max_parallel ?? 5));
    }, [agent?.trigger_run_mode, agent?.trigger_merge_mode, agent?.trigger_max_parallel]);
    async function saveBehavior(patch: {
        trigger_run_mode?: "serial" | "parallel";
        trigger_merge_mode?: "by_task" | "all" | "none";
        trigger_max_parallel?: number;
    }) {
        try {
            await api.saveAgentConfig(agentKey, patch);
        }
        catch (e) {
            toast.error("保存策略失败：" + (e as Error).message);
        }
    }
    const [onInterval, setOnInterval] = React.useState(false);
    const [intervalSec, setIntervalSec] = React.useState("60");
    const [onFinding, setOnFinding] = React.useState(false);
    const [onGoalMet, setOnGoalMet] = React.useState(false);
    const [onTaskTimeout, setOnTaskTimeout] = React.useState(false);
    const [onToolCall, setOnToolCall] = React.useState(false);
    const [onTaskCreate, setOnTaskCreate] = React.useState(false);
    const [intervalMsg, setIntervalMsg] = React.useState("");
    const [findingMsg, setFindingMsg] = React.useState("");
    const [goalMsg, setGoalMsg] = React.useState("");
    const [taskTimeoutMsg, setTaskTimeoutMsg] = React.useState("");
    const [toolCallMsg, setToolCallMsg] = React.useState("");
    const [taskCreateMsg, setTaskCreateMsg] = React.useState("");
    const [toolNames, setToolNames] = React.useState<string[]>([]);
    const [saving, setSaving] = React.useState(false);
    // null = 新增模式；非 null = 正在编辑该 id 的触发器。
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const reload = React.useCallback(() => {
        api
            .agentTriggers(agentKey)
            .then(setTriggers)
            .catch(() => setTriggers([]));
    }, [agentKey]);
    React.useEffect(() => {
        reload();
    }, [reload]);
    React.useEffect(() => {
        api
            .tools()
            .then(setTools)
            .catch(() => setTools([]));
    }, []);
    function toggleTool(key: string) {
        setToolNames((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    }
    // resetForm 清空表单并回到「新增」模式。
    function resetForm() {
        setEditingId(null);
        setOnInterval(false);
        setIntervalSec("60");
        setOnFinding(false);
        setOnGoalMet(false);
        setOnTaskTimeout(false);
        setOnToolCall(false);
        setOnTaskCreate(false);
        setIntervalMsg("");
        setFindingMsg("");
        setGoalMsg("");
        setTaskTimeoutMsg("");
        setToolCallMsg("");
        setTaskCreateMsg("");
        setToolNames([]);
    }
    // startEdit 把某条已有触发器灌进表单,进入「编辑」模式。
    function startEdit(t: AgentTrigger) {
        setEditingId(t.id);
        setOnInterval(t.interval_sec > 0);
        setIntervalSec(t.interval_sec > 0 ? String(t.interval_sec) : "60");
        setOnFinding(t.on_finding);
        setOnGoalMet(t.on_goal_met);
        setOnTaskTimeout(t.on_task_timeout);
        setOnToolCall(t.on_tool_call);
        setOnTaskCreate(t.on_task_create);
        setIntervalMsg(t.interval_message);
        setFindingMsg(t.finding_message);
        setGoalMsg(t.goal_message);
        setTaskTimeoutMsg(t.task_timeout_message);
        setToolCallMsg(t.tool_call_message);
        setTaskCreateMsg(t.task_create_message);
        setToolNames(t.tool_names ?? []);
    }
    // submit 依 editingId 走「新增」或「保存修改」;编辑时保留该触发器的启用状态。
    async function submit() {
        const n = onInterval ? Math.max(1, Math.floor(Number(intervalSec) || 0)) : 0;
        if (n === 0 && !onFinding && !onGoalMet && !onTaskTimeout && !onToolCall && !onTaskCreate) {
            toast.error("至少选择一种触发条件");
            return;
        }
        if (onToolCall && toolNames.length === 0) {
            toast.error("工具调用触发至少选择一个工具");
            return;
        }
        const body = {
            interval_sec: n,
            on_finding: onFinding,
            on_goal_met: onGoalMet,
            on_task_timeout: onTaskTimeout,
            on_tool_call: onToolCall,
            on_task_create: onTaskCreate,
            interval_message: intervalMsg.trim(),
            finding_message: findingMsg.trim(),
            goal_message: goalMsg.trim(),
            task_timeout_message: taskTimeoutMsg.trim(),
            tool_call_message: toolCallMsg.trim(),
            task_create_message: taskCreateMsg.trim(),
            tool_names: onToolCall ? toolNames : [],
        };
        setSaving(true);
        try {
            if (editingId != null) {
                const cur = triggers.find((x) => x.id === editingId);
                await api.updateTrigger(editingId, { ...body, enabled: cur?.enabled ?? true });
                toast.success("已保存修改");
            }
            else {
                await api.createTrigger(agentKey, { ...body, enabled: true });
                toast.success("已添加触发器");
            }
            resetForm();
            reload();
        }
        catch (e) {
            toast.error((editingId != null ? "保存失败：" : "添加失败：") + (e as Error).message);
        }
        finally {
            setSaving(false);
        }
    }
    async function toggleEnabled(t: AgentTrigger) {
        try {
            await api.updateTrigger(t.id, {
                enabled: !t.enabled,
                interval_sec: t.interval_sec,
                on_finding: t.on_finding,
                on_goal_met: t.on_goal_met,
                on_task_timeout: t.on_task_timeout,
                on_tool_call: t.on_tool_call,
                on_task_create: t.on_task_create,
                interval_message: t.interval_message,
                finding_message: t.finding_message,
                goal_message: t.goal_message,
                task_timeout_message: t.task_timeout_message,
                tool_call_message: t.tool_call_message,
                task_create_message: t.task_create_message,
                tool_names: t.tool_names,
            });
            reload();
        }
        catch (e) {
            toast.error("保存失败：" + (e as Error).message);
        }
    }
    async function del(id: number) {
        try {
            await api.deleteTrigger(id);
            if (editingId === id)
                resetForm();
            reload();
        }
        catch (e) {
            toast.error("删除失败：" + (e as Error).message);
        }
    }
    function condLabel(t: AgentTrigger): string {
        const parts: string[] = [];
        if (t.interval_sec > 0)
            parts.push(`每 ${t.interval_sec}s`);
        if (t.on_finding)
            parts.push("发现 finding");
        if (t.on_goal_met)
            parts.push("目标达成");
        if (t.on_task_timeout)
            parts.push("任务超时");
        if (t.on_tool_call)
            parts.push(`工具调用(${t.tool_names.length})`);
        if (t.on_task_create)
            parts.push("任务创建");
        return parts.join(" · ") || "（无条件）";
    }
    return (<div className="grid gap-4">
      <p className="text-muted text-xs">
        触发器让这个自定义 Agent 自动运行：每次触发都<b>新建一个会话运行</b>（在「对话」页可见）。
        可多选触发条件；系统会把「本次为何触发 + 相关任务/finding/目标」自动附加到你写的基础消息后面。
      </p>

      {/* 触发后处理策略 */}
      <div className="grid gap-3 rounded-md border p-3">
        <Label className="text-muted text-xs">触发后处理策略（决定触发如何排队/合并运行）</Label>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid gap-1">
            <Label className="text-xs">运行模式</Label>
            <Select selectedKey={runMode} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((v) => {
                    const rm = v as "serial" | "parallel";
                    setRunMode(rm);
                    saveBehavior({ trigger_run_mode: rm });
                })(String(key));
        }}>
              <Select.Trigger className="h-8 w-40">
                <Select.Value />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="serial" textValue="串行（排队，一次一个）">
                    串行（排队，一次一个）
                  </ListBox.Item>
                  <ListBox.Item id="parallel" textValue="并行（各自并发会话）">
                    并行（各自并发会话）
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">合并模式</Label>
            <Select selectedKey={mergeMode} isDisabled={runMode === "parallel"} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((v) => {
                    const mm = v as "by_task" | "all" | "none";
                    setMergeMode(mm);
                    saveBehavior({ trigger_merge_mode: mm });
                })(String(key));
        }}>
              <Select.Trigger className="h-8 w-44">
                <Select.Value />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="by_task" textValue="按任务合并">
                    按任务合并
                  </ListBox.Item>
                  <ListBox.Item id="all" textValue="全部合并成一条">
                    全部合并成一条
                  </ListBox.Item>
                  <ListBox.Item id="none" textValue="不合并">
                    不合并
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {runMode === "parallel" && (<div className="grid gap-1">
              <Label htmlFor="tr-maxpar" className="text-xs">
                最大并发（0=不限）
              </Label>
              <NumberField id="tr-maxpar" minValue={0} className="h-8 w-28" onBlur={() => {
                const n = Math.max(0, Math.floor(Number(maxParallel) || 0));
                setMaxParallel(String(n));
                saveBehavior({ trigger_max_parallel: n });
            }} onChange={(nextValue) => setMaxParallel(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"tr-maxpar"} value={String(maxParallel) === "" ? NaN : Number(maxParallel)}>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>)}
        </div>
        <p className="text-muted text-xs">
          {runMode === "parallel"
            ? "并行：每次触发立即各开一个会话并发运行，不合并；超过最大并发的触发排队等空位。"
            : mergeMode === "by_task"
                ? "串行·按任务合并：同 agent 一次跑一个；排队中同一任务的事件触发合并成一条会话。"
                : mergeMode === "all"
                    ? "串行·全部合并：同 agent 一次跑一个；取队列时把当前排队的所有触发合并成一条会话。"
                    : "串行·不合并：同 agent 一次跑一个；每条触发各自一个会话。"}
        </p>
      </div>

      {/* 新增 / 编辑触发器 */}
      <div className="grid gap-3 rounded-md border p-3">
        <Label className="text-muted text-xs">
          {editingId != null
            ? `编辑触发器 #${editingId}（改完点「保存修改」）`
            : "新增触发器（每种条件可填各自的用户消息）"}
        </Label>

        {/* 定时 */}
        <div className="grid gap-1.5">
          <Checkbox onChange={(v) => setOnInterval(!!v)} isSelected={onInterval === true}>
            <Checkbox.Content className="flex items-center gap-2 text-sm">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>定时触发</Label>
            </Checkbox.Content>
          </Checkbox>
          {onInterval && (<div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="tr-interval" className="text-xs">
                  每
                </Label>
                <NumberField id="tr-interval" minValue={1} className="h-8 w-24" onChange={(nextValue) => setIntervalSec(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"tr-interval"} value={String(intervalSec) === "" ? NaN : Number(intervalSec)}>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                </NumberField>
                <span className="text-muted text-xs">秒</span>
              </div>
              <TextField className="contents" aria-label={"定时触发时发给 agent 的话，如：巡检所有任务"}>
                <TextArea className="text-xs" rows={2} value={intervalMsg} placeholder="定时触发时发给 agent 的话，如：巡检所有任务" onChange={(e) => setIntervalMsg(e.target.value)}/>
              </TextField>
            </div>)}
        </div>

        {/* finding */}
        <div className="grid gap-1.5">
          <Checkbox onChange={(v) => setOnFinding(!!v)} isSelected={onFinding === true}>
            <Checkbox.Content className="flex items-center gap-2 text-sm">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>发现 finding 时触发</Label>
            </Checkbox.Content>
          </Checkbox>
          {onFinding && (<TextField className="contents" aria-label={"发现 finding 时发给 agent 的话（系统会附带任务与 finding 详情）"}>
              <TextArea className="text-xs" rows={2} value={findingMsg} placeholder="发现 finding 时发给 agent 的话（系统会附带任务与 finding 详情）" onChange={(e) => setFindingMsg(e.target.value)}/>
            </TextField>)}
        </div>

        {/* 目标达成 */}
        <div className="grid gap-1.5">
          <Checkbox onChange={(v) => setOnGoalMet(!!v)} isSelected={onGoalMet === true}>
            <Checkbox.Content className="flex items-center gap-2 text-sm">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>目标达成时触发</Label>
            </Checkbox.Content>
          </Checkbox>
          {onGoalMet && (<TextField className="contents" aria-label={"目标达成时发给 agent 的话（系统会附带任务与达成的目标）"}>
              <TextArea className="text-xs" rows={2} value={goalMsg} placeholder="目标达成时发给 agent 的话（系统会附带任务与达成的目标）" onChange={(e) => setGoalMsg(e.target.value)}/>
            </TextField>)}
        </div>

        {/* 任务超时 */}
        <div className="grid gap-1.5">
          <Checkbox onChange={(v) => setOnTaskTimeout(!!v)} isSelected={onTaskTimeout === true}>
            <Checkbox.Content className="flex items-center gap-2 text-sm">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>任务超时时触发</Label>
            </Checkbox.Content>
          </Checkbox>
          {onTaskTimeout && (<TextField className="contents" aria-label={"任务超时时发给 agent 的话（系统会附带任务编号与目标）"}>
              <TextArea className="text-xs" rows={2} value={taskTimeoutMsg} placeholder="任务超时时发给 agent 的话（系统会附带任务编号与目标）" onChange={(e) => setTaskTimeoutMsg(e.target.value)}/>
            </TextField>)}
        </div>

        {/* 工具调用 */}
        <div className="grid gap-1.5">
          <Checkbox onChange={(v) => setOnToolCall(!!v)} isSelected={onToolCall === true}>
            <Checkbox.Content className="flex items-center gap-2 text-sm">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>工具调用时触发</Label>
            </Checkbox.Content>
          </Checkbox>
          {onToolCall && (<div className="grid gap-1.5">
              <div className="text-muted text-xs">
                选择要监听的工具（至少一个）；任务执行中这些工具每次<b>调用完成</b>都会触发。已选 {toolNames.length}{" "}
                个。
              </div>
              <ScrollShadow className="max-h-40 overflow-y-auto rounded-md border p-2" data-scrollbar="thin" data-slot="scroll-shadow">
                {tools.length === 0 && <span className="text-muted text-xs">（工具列表为空）</span>}
                <div className="grid gap-1">
                  {tools.map((tool) => (<Checkbox className="mt-0.5" onChange={() => toggleTool(tool.key)} isSelected={toolNames.includes(tool.key) === true} key={tool.key}>
                      <Checkbox.Content className="flex items-start gap-2 text-xs">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label>
                          <span className="min-w-0">
                            <span className="font-medium">{tool.key}</span>
                            {tool.description && <span className="text-muted line-clamp-1"> {tool.description}</span>}
                          </span>
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>))}
                </div>
              </ScrollShadow>
              <TextField className="contents" aria-label={"工具被调用时发给 agent 的话（系统会附带任务信息、工具入参与返回内容）"}>
                <TextArea className="text-xs" rows={2} value={toolCallMsg} placeholder="工具被调用时发给 agent 的话（系统会附带任务信息、工具入参与返回内容）" onChange={(e) => setToolCallMsg(e.target.value)}/>
              </TextField>
            </div>)}
        </div>

        {/* 任务创建 */}
        <div className="grid gap-1.5">
          <Checkbox onChange={(v) => setOnTaskCreate(!!v)} isSelected={onTaskCreate === true}>
            <Checkbox.Content className="flex items-center gap-2 text-sm">
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label>任务创建时触发</Label>
            </Checkbox.Content>
          </Checkbox>
          {onTaskCreate && (<TextField className="contents" aria-label={"任务被创建时发给 agent 的话（系统会附带任务编号与目标）"}>
              <TextArea className="text-xs" rows={2} value={taskCreateMsg} placeholder="任务被创建时发给 agent 的话（系统会附带任务编号与目标）" onChange={(e) => setTaskCreateMsg(e.target.value)}/>
            </TextField>)}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onPress={submit} isDisabled={saving}>
            <SaveIcon /> {editingId != null ? "保存修改" : "添加触发器"}
          </Button>
          {editingId != null && (<Button size="sm" onPress={resetForm} isDisabled={saving} variant={"ghost"}>
              <XIcon /> 取消编辑
            </Button>)}
        </div>
      </div>

      {/* 已有触发器 */}
      <div className="grid gap-2">
        <Label className="text-muted text-xs">已有触发器</Label>
        {triggers.length === 0 && <span className="text-muted text-xs">（暂无）</span>}
        {triggers.map((t) => (<div key={t.id} className={cn("flex items-start gap-2 rounded-md border p-2 text-sm", editingId === t.id && "border-accent bg-accent/5")}>
            <Switch isSelected={t.enabled} onChange={() => toggleEnabled(t)} className="mt-0.5" aria-label="启用">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{condLabel(t)}</span>
                {!t.enabled && (<Chip className="text-danger px-1 py-0 text-[9px]" size="sm" variant={"secondary"}>
                    已停用
                  </Chip>)}
              </div>
              <div className="text-muted grid gap-0.5 text-xs">
                {t.interval_sec > 0 && t.interval_message && (<div className="line-clamp-1">定时：{t.interval_message}</div>)}
                {t.on_finding && t.finding_message && <div className="line-clamp-1">finding：{t.finding_message}</div>}
                {t.on_goal_met && t.goal_message && <div className="line-clamp-1">目标：{t.goal_message}</div>}
                {t.on_task_timeout && t.task_timeout_message && (<div className="line-clamp-1">超时：{t.task_timeout_message}</div>)}
                {t.on_task_create && t.task_create_message && (<div className="line-clamp-1">任务创建：{t.task_create_message}</div>)}
                {t.on_tool_call && (<>
                    <div className="line-clamp-1">工具：{t.tool_names.join("、") || "（未选）"}</div>
                    {t.tool_call_message && <div className="line-clamp-1">消息：{t.tool_call_message}</div>}
                  </>)}
              </div>
            </div>
            <Button className="text-muted hover:text-foreground" onPress={() => startEdit(t)} size="sm" isIconOnly aria-label={"编辑"} variant={"ghost"}>
              <PencilIcon className="size-3.5"/>
            </Button>
            <Button className="text-muted hover:text-danger" onPress={() => del(t.id)} size="sm" isIconOnly aria-label={"删除"} variant={"ghost"}>
              <Trash2Icon className="size-3.5"/>
            </Button>
          </div>))}
      </div>
    </div>);
}
