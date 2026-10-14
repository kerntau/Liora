import * as React from "react";
import { Link } from "react-router";
import { Button, buttonVariants, Card, Input, Label, ListBox, NumberField, Select, Switch, Tabs, TextField, } from "@heroui/react";
import { CpuIcon, KeyboardIcon, RadioTowerIcon, SearchIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { CHAT_SEND_MODE_OPTIONS, type ChatSendMode, setChatSendMode, useChatSendMode } from "@/lib/chat-send-mode";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";
export default function SystemSettingsPage() {
    const [trafficCapture, setTrafficCapture] = React.useState(false);
    const [agentTrafficBinding, setAgentTrafficBinding] = React.useState(false);
    const [webSearch, setWebSearch] = React.useState(false);
    const [backend, setBackend] = React.useState("ddgs");
    const [braveKeySet, setBraveKeySet] = React.useState(false);
    const [braveKeyInput, setBraveKeyInput] = React.useState("");
    const [tavilyKeySet, setTavilyKeySet] = React.useState(false);
    const [tavilyKeyInput, setTavilyKeyInput] = React.useState("");
    const [savingTavilyKey, setSavingTavilyKey] = React.useState(false);
    const [proxyInput, setProxyInput] = React.useState("");
    const [savingProxy, setSavingProxy] = React.useState(false);
    const [globalProxyInput, setGlobalProxyInput] = React.useState("");
    const [savingGlobalProxy, setSavingGlobalProxy] = React.useState(false);
    const [testing, setTesting] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [savingKey, setSavingKey] = React.useState(false);
    const [pyInterp, setPyInterp] = React.useState("");
    const [workers, setWorkers] = React.useState("3");
    const [savingWorkers, setSavingWorkers] = React.useState(false);
    // 操作约束注入范围(默认都开)。
    const [injectPlanner, setInjectPlanner] = React.useState(true);
    const [injectWorker, setInjectWorker] = React.useState(true);
    // 纯前端偏好：不走 /api/settings，直接读写 localStorage。
    const sendMode = useChatSendMode();
    const apply = React.useCallback((s: Settings) => {
        setTrafficCapture(!!s.traffic_capture);
        setAgentTrafficBinding(!!s.agent_traffic_binding);
        setWebSearch(!!s.web_search_enabled);
        setBackend(s.web_search_backend || "ddgs");
        setBraveKeySet(!!s.brave_key_set);
        setTavilyKeySet(!!s.tavily_key_set);
        setProxyInput(s.web_search_proxy ?? "");
        setGlobalProxyInput(s.global_proxy ?? "");
        setPyInterp(s.python_interpreter ?? "");
        setWorkers(String(s.workers ?? 3));
        setInjectPlanner(s.constraints_inject_planner !== false);
        setInjectWorker(s.constraints_inject_worker !== false);
    }, []);
    const saveWorkers = () => {
        const n = Number(workers);
        if (!Number.isInteger(n) || n <= 0) {
            toast.error("并发数必须是大于 0 的整数");
            return;
        }
        setSavingWorkers(true);
        api
            .setSettings({ workers: n })
            .then((s) => {
            apply(s);
            toast.success("已保存并发工作 agent 数（对之后启动的任务生效）");
        })
            .catch((e) => toast.error("保存失败：" + (e as Error).message))
            .finally(() => setSavingWorkers(false));
    };
    const savePython = () => {
        setSaving(true);
        api
            .setSettings({ python_interpreter: pyInterp.trim() })
            .then((s) => {
            apply(s);
            toast.success("已保存 Python 解释器配置");
        })
            .catch((e) => toast.error("保存失败：" + (e as Error).message))
            .finally(() => setSaving(false));
    };
    const detectPython = () => {
        setSaving(true);
        api
            .detectPython()
            .then((r) => setPyInterp(r.python_interpreter))
            .catch(() => undefined)
            .finally(() => setSaving(false));
    };
    React.useEffect(() => {
        api
            .settings()
            .then(apply)
            .catch(() => undefined)
            .finally(() => setLoaded(true));
    }, [apply]);
    const toggleTraffic = (v: boolean) => {
        setTrafficCapture(v); // optimistic
        setSaving(true);
        api
            .setSettings({ traffic_capture: v })
            .then(apply)
            .catch(() => setTrafficCapture(!v)) // revert on failure
            .finally(() => setSaving(false));
    };
    const toggleInjectPlanner = (v: boolean) => {
        setInjectPlanner(v); // optimistic
        api
            .setSettings({ constraints_inject_planner: v })
            .then(apply)
            .catch(() => setInjectPlanner(!v)); // revert on failure
    };
    const toggleAgentTrafficBinding = (v: boolean) => {
        setAgentTrafficBinding(v);
        setSaving(true);
        api
            .setSettings({ agent_traffic_binding: v })
            .then((s) => {
            apply(s);
            toast.success(v ? "已开启 Agent 自动绑定流量" : "已关闭 Agent 自动绑定流量");
        })
            .catch((e) => {
            setAgentTrafficBinding(!v);
            toast.error(`保存失败：${(e as Error).message}`);
        })
            .finally(() => setSaving(false));
    };
    const toggleInjectWorker = (v: boolean) => {
        setInjectWorker(v); // optimistic
        api
            .setSettings({ constraints_inject_worker: v })
            .then(apply)
            .catch(() => setInjectWorker(!v)); // revert on failure
    };
    // Persist a web-search patch (enable and/or backend). Optimistic with refetch.
    const saveWebSearch = (patch: Partial<Settings>) => {
        setSaving(true);
        api
            .setSettings(patch)
            .then((s) => {
            apply(s);
            toast.success("已保存网络搜索配置");
        })
            .catch((e) => {
            toast.error("保存失败：" + (e as Error).message);
            api
                .settings()
                .then(apply)
                .catch(() => undefined);
        })
            .finally(() => setSaving(false));
    };
    const saveBraveKey = () => {
        setSavingKey(true);
        api
            .setSettings({ brave_search_api_key: braveKeyInput })
            .then((s) => {
            apply(s);
            setBraveKeyInput("");
            toast.success("已保存 Brave API Key");
        })
            .catch((e) => toast.error("保存失败：" + (e as Error).message))
            .finally(() => setSavingKey(false));
    };
    const saveTavilyKey = () => {
        setSavingTavilyKey(true);
        api
            .setSettings({ tavily_search_api_key: tavilyKeyInput })
            .then((s) => {
            apply(s);
            setTavilyKeyInput("");
            toast.success("已保存 Tavily API Key");
        })
            .catch((e) => toast.error("保存失败：" + (e as Error).message))
            .finally(() => setSavingTavilyKey(false));
    };
    const saveProxy = () => {
        setSavingProxy(true);
        api
            .setSettings({ web_search_proxy: proxyInput.trim() })
            .then((s) => {
            apply(s);
            toast.success(proxyInput.trim() ? "已保存出口代理" : "已清除出口代理（改为直连）");
        })
            .catch((e) => toast.error("保存失败：" + (e as Error).message))
            .finally(() => setSavingProxy(false));
    };
    const saveGlobalProxy = () => {
        setSavingGlobalProxy(true);
        api
            .setSettings({ global_proxy: globalProxyInput.trim() })
            .then((s) => {
            apply(s);
            toast.success(globalProxyInput.trim() ? "已保存全局代理" : "已清除全局代理（改为直连）");
        })
            .catch((e) => toast.error("保存失败：" + (e as Error).message))
            .finally(() => setSavingGlobalProxy(false));
    };
    // Run a real "test" search ("test") against the CURRENT form values (backend +
    // proxy + entered key), falling back to saved values server-side. Toasts result.
    const runTest = () => {
        setTesting(true);
        api
            .testWebSearch({
            web_search_backend: backend,
            web_search_proxy: proxyInput.trim(),
            brave_search_api_key: braveKeyInput,
            tavily_search_api_key: tavilyKeyInput,
        })
            .then((r) => {
            if (r.ok)
                toast.success(`搜索测试成功 · ${r.backend} 返回 ${r.count} 条结果`);
            else
                toast.error("搜索测试失败：" + (r.error || "未知错误"));
        })
            .catch((e) => toast.error("搜索测试失败：" + (e as Error).message))
            .finally(() => setTesting(false));
    };
    // brave-free selected but no key stored and none being entered → tool stays off.
    const braveNeedsKey = webSearch && backend === "brave-free" && !braveKeySet;
    return (<div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">系统设置</h1>
        <p className="text-muted text-sm">常用运行配置集中显示，工具与网络参数按需调整。</p>
      </div>

      {/* 多列而非 grid：网络搜索卡片比其余高数倍，且高度随所选后端变化（brave/tavily
                            的 key 输入是条件渲染）。grid 会按最高的一张撑满整行、在旁边留下大片空白，
                            多列则自动按内容高度平衡填充。卡片间距靠 mb 而非 gap——多列布局下
                            column-gap 只管列间距，行间距要由子元素自己给。 */}
      <Tabs defaultSelectedKey="basic">
        <Tabs.ListContainer>
          <Tabs.List>
            <Tabs.Tab id="basic">
              基本设置
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="advanced">
              高级设置
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="basic">
          <div className="columns-1 gap-4 md:gap-6 lg:columns-2">
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <RadioTowerIcon className="size-4"/>
                  流量捕获
                </Card.Title>
                <Card.Description>
                  开启后，所有 Agent 的 HTTP 流量经记录代理全量落库，并向 Agent 注入 traffic_search / traffic_get
                  工具与代理配置（提示词含代理说明）。
                  <br />
                  关闭（默认）时不记录任何流量：Agent
                  <b>不会</b>拿到代理配置与流量工具，提示词也<b>不含</b>代理相关内容。切换后会即时重建 Agent 生效。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex items-center justify-between gap-4">
                <Label htmlFor="traffic-capture" className="text-sm font-normal text-muted">
                  {trafficCapture ? "已开启 · 正在记录流量并注入代理" : "已关闭 · 不记录、不注入代理"}
                </Label>
                <Switch id="traffic-capture" isSelected={trafficCapture} isDisabled={!loaded || saving} onChange={toggleTraffic} aria-label={"traffic-capture"}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </Card.Content>
            </Card>
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <RadioTowerIcon className="size-4"/>
                  Agent 自动绑定流量
                </Card.Title>
                <Card.Description id="agent-traffic-binding-description">
                  默认关闭。开启后，漏洞入库时触发的报告 Agent 会核对已有 HTTP 请求/响应，关联对应流量后再编写报告。
                  <b>查阅数据包及额外的工具调用会增加 Token 消耗。</b>
                  <br />
                  TCP、未抓包或没有匹配流量时仍可正常上报。此开关不影响流量捕获、人工绑定及已保存证据的查看。 对下一轮
                  Agent 生效；关闭后会立即拒绝新的自动绑定。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex items-center justify-between gap-4">
                <Label htmlFor="agent-traffic-binding" className="text-sm font-normal text-muted">
                  {agentTrafficBinding ? "已开启 · 会增加 Token 消耗" : "已关闭 · 可继续人工绑定"}
                </Label>
                <Switch id="agent-traffic-binding" aria-describedby="agent-traffic-binding-description" isSelected={agentTrafficBinding} isDisabled={!loaded || saving} onChange={toggleAgentTrafficBinding} aria-label={"agent-traffic-binding"}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </Card.Content>
            </Card>
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <RadioTowerIcon className="size-4"/>
                  自定义脚本 · Python 解释器
                </Card.Title>
                <Card.Description>
                  自定义 <b>script</b> 类型工具用它跑 Python。开机会自动检测（python3 优先）；此处可手填 venv /
                  特定版本的绝对路径，留空则运行时自动检测。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <TextField className="contents" aria-label={"/usr/bin/python3（留空=自动检测）"} isDisabled={!loaded || saving}>
                    <Input className="font-mono text-sm" placeholder="/usr/bin/python3（留空=自动检测）" value={pyInterp} onChange={(e) => setPyInterp(e.target.value)}/>
                  </TextField>
                  <Button onPress={detectPython} isDisabled={!loaded || saving} variant={"outline"}>
                    重新检测
                  </Button>
                  <Button onPress={savePython} isDisabled={!loaded || saving}>
                    保存
                  </Button>
                </div>
              </Card.Content>
            </Card>
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <CpuIcon className="size-4"/>
                  工作并发 · Work Agent 数
                </Card.Title>
                <Card.Description>
                  每个任务并发运行的工作 agent 数量（默认 3）。数值越大并发探测越多、消耗也越高。修改后
                  <b>对之后启动的任务生效</b>，正在运行的任务不受影响。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <NumberField minValue={1} className="w-32 font-mono text-sm" isDisabled={!loaded || savingWorkers} onChange={(nextValue) => setWorkers(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"3"} value={String(workers) === "" ? NaN : Number(workers)}>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                  <Button onPress={saveWorkers} isDisabled={!loaded || savingWorkers}>
                    保存
                  </Button>
                </div>
              </Card.Content>
            </Card>
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <KeyboardIcon className="size-4"/>
                  会话输入框发送键位
                </Card.Title>
                <Card.Description>
                  任务会话输入框使用此设置，选择后立即生效、无需保存。
                  <br />
                  该偏好<b>只存在本浏览器</b>，不随账号同步，换浏览器或清理站点数据后需重新设置。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex items-center justify-between gap-4">
                <Label htmlFor="chat-send-mode" className="text-sm font-normal text-muted">
                  发送方式
                </Label>
                <Select selectedKey={sendMode} aria-label="选择选项" onSelectionChange={(key) => {
            if (key !== null)
                ((v) => setChatSendMode(v as ChatSendMode))(String(key));
        }}>
                  <Select.Trigger id="chat-send-mode" className="w-72">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {CHAT_SEND_MODE_OPTIONS.map((option) => (<ListBox.Item key={option.value} id={option.value}>
                          {option.label}
                        </ListBox.Item>))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="advanced">
          <div className="columns-1 gap-4 md:gap-6 lg:columns-2">
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="text-base">工具与 Agent 配置</Card.Title>
                <Card.Description>按需调整角色、工具和技能，日常测试使用现有配置。</Card.Description>
              </Card.Header>
              <Card.Content className="grid grid-cols-2 gap-2">
                <Link to="/system/agents" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Agent 配置
                </Link>
                <Link to="/system/tools" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  工具配置
                </Link>
                <Link to="/system/skills" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  Skills 配置
                </Link>
                <Link to="/system/mcp" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  MCP 配置
                </Link>
              </Card.Content>
            </Card>
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <RadioTowerIcon className="size-4"/>
                  全局代理
                </Card.Title>
                <Card.Description>
                  所有 Agent 的<b>目标流量</b>经此代理出网（隐藏源 IP / 走跳板）。支持 <b>http / https / socks5</b>
                  ，可带 <code>user:pass</code> 认证。留空=直连。
                  <br />
                  开启<b>流量捕获</b>时，它作为记录代理的<b>上游</b>
                  （流量仍全量落库，再经此代理出网）；关闭捕获时，直接注入 Agent 的 bash / WebFetch
                  出网。与网络搜索代理、LLM 代理相互独立。
                  <br />
                  <b>提示</b>：socks5 在<b>关闭捕获</b>时依赖各命令行工具对 <code>ALL_PROXY</code> 的支持（curl
                  可用，部分工具可能忽略）； 若主要用 socks5，建议开启流量捕获——此路径由 MITM
                  亲自拨号，工具无感知、稳定生效。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-2">
                <Label htmlFor="global-proxy" className="text-sm font-normal text-muted">
                  代理地址
                </Label>
                <div className="flex items-center gap-2">
                  <TextField className="contents" aria-label={"socks5://user:pass@host:1080 或 http://host:port（留空=直连）"} isDisabled={!loaded || savingGlobalProxy}>
                    <Input id="global-proxy" autoComplete="off" placeholder="socks5://user:pass@host:1080 或 http://host:port（留空=直连）" value={globalProxyInput} onChange={(e) => setGlobalProxyInput(e.target.value)}/>
                  </TextField>
                  <Button type="button" onPress={saveGlobalProxy} isDisabled={!loaded || savingGlobalProxy}>
                    保存
                  </Button>
                </div>
                <p className="text-muted text-xs">
                  {globalProxyInput.trim() ? "已配置 · 所有目标流量经此代理出网" : "未配置 · 目标流量直连出网"}
                </p>
              </Card.Content>
            </Card>
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <ShieldAlertIcon className="size-4"/>
                  操作约束注入
                </Card.Title>
                <Card.Description>
                  开启后，把每个任务的<b>操作约束</b>（在任务总览「操作约束」里维护的 allow/deny 条目）拼进对应 Agent
                  的系统提示，用来框定探索边界（如「仅测当前端口」「禁止爆破」）。
                  <br />
                  可分别控制注入到 <b>规划者（planner）</b>与 <b>执行者（worker）</b>
                  ；默认都开。切换即时生效（下一轮读取），无需重建 Agent。关闭后该 Agent 不再看到约束。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="inject-planner" className="text-sm font-normal text-muted">
                    注入规划者（planner）{injectPlanner ? " · 已开启" : " · 已关闭"}
                  </Label>
                  <Switch id="inject-planner" isSelected={injectPlanner} isDisabled={!loaded} onChange={toggleInjectPlanner} aria-label={"inject-planner"}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="inject-worker" className="text-sm font-normal text-muted">
                    注入执行者（worker）{injectWorker ? " · 已开启" : " · 已关闭"}
                  </Label>
                  <Switch id="inject-worker" isSelected={injectWorker} isDisabled={!loaded} onChange={toggleInjectWorker} aria-label={"inject-worker"}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>
              </Card.Content>
            </Card>
            <Card className="mb-4 break-inside-avoid md:mb-6">
              <Card.Header>
                <Card.Title className="flex items-center gap-2 text-base">
                  <SearchIcon className="size-4"/>
                  网络搜索
                </Card.Title>
                <Card.Description>
                  这是网络搜索的<b>总开关 + 来源配置</b>。开启后，才能在<b>每个 Agent 的配置</b>里单独选择是否启用
                  <b>web_search</b>（仅返回标题/链接/摘要，不抓取正文；抓取由 WebFetch 负责）。网络搜索<b>不走</b>
                  记录代理，独立于流量捕获。
                  <br />
                  来源可选 <b>DuckDuckGo（ddgs）</b>（无需 Key）、<b>Brave（免费版）</b>（需填写 Brave API Key）、{" "}
                  <b>Tavily</b>（需填写 Tavily API Key）或 <b>DeepSeek</b>（复用当前 LLM 配置）。总开关关闭时，各 Agent
                  的网络搜索开关不可用。
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="web-search" className="text-sm font-normal text-muted">
                    {webSearch ? "总开关已开启 · 可在各 Agent 配置里单独启用" : "已关闭 · 各 Agent 无法启用网络搜索"}
                  </Label>
                  <Switch id="web-search" isSelected={webSearch} isDisabled={!loaded || saving} onChange={(v) => {
            setWebSearch(v); // optimistic
            saveWebSearch({ web_search_enabled: v });
        }} aria-label={"web-search"}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </div>

                {webSearch && (<div className="flex items-center justify-between gap-4">
                    <Label className="text-sm font-normal text-muted">搜索来源</Label>
                    <Select selectedKey={backend} isDisabled={!loaded || saving} aria-label="选择选项" onSelectionChange={(key) => {
                if (key !== null)
                    ((v) => {
                        setBackend(v); // optimistic
                        saveWebSearch({ web_search_backend: v });
                    })(String(key));
            }}>
                      <Select.Trigger className="w-48 shrink-0">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="ddgs" textValue="DuckDuckGo（ddgs · 免费无 Key）">
                            DuckDuckGo（ddgs · 免费无 Key）
                          </ListBox.Item>
                          <ListBox.Item id="brave-free" textValue="Brave（免费版 · 需 Key）">
                            Brave（免费版 · 需 Key）
                          </ListBox.Item>
                          <ListBox.Item id="tavily" textValue="Tavily（需 Key）">
                            Tavily（需 Key）
                          </ListBox.Item>
                          <ListBox.Item id="deepseek" textValue="DeepSeek（官方）">
                            DeepSeek（官方）
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>)}

                {webSearch && backend === "deepseek" && (<div className="border-border/60 bg-surface-secondary/30 flex flex-col gap-2 rounded-md border p-3">
                    <p className="text-sm font-medium">DeepSeek 官方联网搜索</p>
                    <p className="text-muted text-xs leading-relaxed">
                      该来源直接复用<b>当前激活的 LLM 配置</b>。因此它
                      <b>仅支持 DeepSeek 官方模型</b>，且该配置<b>必须使用 anthropic 协议</b>
                      ——DeepSeek 的 OpenAI 协议端点不支持服务端搜索。切换 LLM 配置后此来源可能失效。
                    </p>
                    <p className="text-muted text-xs leading-relaxed">
                      与其它来源不同，搜索由 <b>DeepSeek 服务端执行</b>：每次搜索会额外消耗一次模型调用（产生 Token
                      费用），搜索请求<b>不经过上面的出口代理</b>，也<b>不计入流量留痕</b>；返回结果
                      <b>只有标题和链接</b>
                      （无摘要），需要正文时由 WebFetch 抓取。
                    </p>
                    <p className="text-muted text-xs leading-relaxed">
                      是否满足上述条件由你自行确认，系统不做拦截；可用下方「测试搜索」按钮实际跑一次来验证。
                    </p>
                  </div>)}

                {webSearch && backend === "brave-free" && (<div className="flex flex-col gap-2">
                    <Label htmlFor="brave-key" className="text-sm font-normal text-muted">
                      Brave Search API Key
                      {braveKeySet && <span className="ml-2 text-xs text-success">已配置</span>}
                    </Label>
                    <div className="flex items-center gap-2">
                      <TextField className="contents" aria-label={braveKeySet ? "已配置（留空则不变）" : "输入 Brave API Key"} isDisabled={!loaded || savingKey}>
                        <Input id="brave-key" type="password" autoComplete="off" placeholder={braveKeySet ? "已配置（留空则不变）" : "输入 Brave API Key"} value={braveKeyInput} onChange={(e) => setBraveKeyInput(e.target.value)}/>
                      </TextField>
                      <Button type="button" onPress={saveBraveKey} isDisabled={!loaded || savingKey || braveKeyInput.trim() === ""}>
                        保存
                      </Button>
                    </div>
                    {braveNeedsKey && (<p className="text-xs text-warning">
                        已选择 Brave 但尚未配置 Key —— 在保存 Key 之前，搜索工具不会启用。
                      </p>)}
                    <p className="text-muted text-xs">
                      免费版额度约 2,000 次/月。前往 https://brave.com/search/api/ 获取 Key。
                    </p>
                  </div>)}

                {webSearch && backend === "tavily" && (<div className="flex flex-col gap-2">
                    <Label htmlFor="tavily-key" className="text-sm font-normal text-muted">
                      Tavily Search API Key
                      {tavilyKeySet && <span className="ml-2 text-xs text-success">已配置</span>}
                    </Label>
                    <div className="flex items-center gap-2">
                      <TextField className="contents" aria-label={tavilyKeySet ? "已配置（留空则不变）" : "输入 Tavily API Key（tvly-…）"} isDisabled={!loaded || savingTavilyKey}>
                        <Input id="tavily-key" type="password" autoComplete="off" placeholder={tavilyKeySet ? "已配置（留空则不变）" : "输入 Tavily API Key（tvly-…）"} value={tavilyKeyInput} onChange={(e) => setTavilyKeyInput(e.target.value)}/>
                      </TextField>
                      <Button type="button" onPress={saveTavilyKey} isDisabled={!loaded || savingTavilyKey || tavilyKeyInput.trim() === ""}>
                        保存
                      </Button>
                    </div>
                    {webSearch && backend === "tavily" && !tavilyKeySet && (<p className="text-xs text-warning">
                        已选择 Tavily 但尚未配置 Key —— 在保存 Key 之前，搜索工具不会启用。
                      </p>)}
                    <p className="text-muted text-xs">前往 https://tavily.com 注册并获取 API Key。</p>
                  </div>)}

                {webSearch && (<div className="flex flex-col gap-2">
                    <Label htmlFor="ws-proxy" className="text-sm font-normal text-muted">
                      出口代理（可选）
                    </Label>
                    <div className="flex items-center gap-2">
                      <TextField className="contents" aria-label={"http://host:port 或 socks5://host:port（留空=直连）"} isDisabled={!loaded || savingProxy}>
                        <Input id="ws-proxy" autoComplete="off" placeholder="http://host:port 或 socks5://host:port（留空=直连）" value={proxyInput} onChange={(e) => setProxyInput(e.target.value)}/>
                      </TextField>
                      <Button type="button" onPress={saveProxy} isDisabled={!loaded || savingProxy}>
                        保存
                      </Button>
                    </div>
                    <p className="text-muted text-xs">
                      独立出口代理，仅用于访问搜索端点（VPN/SOCKS 等）。与记录流量的 MITM
                      代理无关；网络不通时经此代理访问。
                    </p>
                  </div>)}

                {webSearch && (<div className="flex items-center justify-between gap-4 border-t pt-4">
                    <p className="text-muted text-xs">
                      用当前配置（来源 + 代理 + Key）实际搜索一次「test」，验证是否可用。
                    </p>
                    <Button type="button" onPress={runTest} isDisabled={!loaded || testing} className="shrink-0" variant={"outline"}>
                      {testing ? "测试中…" : "测试搜索"}
                    </Button>
                  </div>)}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>);
}
