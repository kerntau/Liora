"use client";

import * as React from "react";

import {
  ChevronRightIcon,
  CpuIcon,
  FileCode2Icon,
  Globe2Icon,
  KeyboardIcon,
  RadioTowerIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

import Link from "@/lib/router-compat";

import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { AsyncState } from "@/components/async-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/use-async-data";
import { api } from "@/lib/api";
import { CHAT_SEND_MODE_OPTIONS, type ChatSendMode, setChatSendMode, useChatSendMode } from "@/lib/chat-send-mode";
import type { Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

function TogglePill({
  on,
  onLabel = "已开启",
  offLabel = "已关闭",
}: {
  on: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        on ? "border-success/25 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", on ? "bg-success" : "bg-muted-foreground/50")} />
      {on ? onLabel : offLabel}
    </span>
  );
}

function DirtyHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warning/25 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
      {children}
    </span>
  );
}

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
  // 写操作计数：并发保存时不会提前解锁，也避免旧响应把新状态覆盖回去。
  const [savingCount, setSavingCount] = React.useState(0);
  const saving = savingCount > 0;
  const beginSaving = React.useCallback(() => setSavingCount((n) => n + 1), []);
  const endSaving = React.useCallback(() => setSavingCount((n) => Math.max(0, n - 1)), []);
  const [savingKey, setSavingKey] = React.useState(false);
  const [pyInterp, setPyInterp] = React.useState("");
  const [workers, setWorkers] = React.useState("3");
  const [workersError, setWorkersError] = React.useState<string | null>(null);
  // 开启流量捕获会全量落库并重建 Agent，先确认再写。
  const [confirmCapture, setConfirmCapture] = React.useState(false);
  // 操作约束注入范围(默认都开)。
  const [injectPlanner, setInjectPlanner] = React.useState(true);
  const [injectWorker, setInjectWorker] = React.useState(true);
  // 纯前端偏好：不走 /api/settings，直接读写 localStorage。
  const sendMode = useChatSendMode();

  // 服务端已保存的值：用于判断「未保存」，也用于避免保存其它开关时冲掉正在编辑的草稿。
  const savedRef = React.useRef({ python: "", workers: "3", wsProxy: "", globalProxy: "" });
  const [saved, setSaved] = React.useState(savedRef.current);

  const apply = React.useCallback((s: Settings) => {
    const next = {
      python: s.python_interpreter ?? "",
      workers: String(s.workers ?? 3),
      wsProxy: s.web_search_proxy ?? "",
      globalProxy: s.global_proxy ?? "",
    };
    const prev = savedRef.current;
    savedRef.current = next;
    setSaved(next);
    setTrafficCapture(!!s.traffic_capture);
    setAgentTrafficBinding(!!s.agent_traffic_binding);
    setWebSearch(!!s.web_search_enabled);
    setBackend(s.web_search_backend || "ddgs");
    setBraveKeySet(!!s.brave_key_set);
    setTavilyKeySet(!!s.tavily_key_set);
    // 只同步没有被编辑过的字段，别把用户输入覆盖掉。
    setProxyInput((cur) => (cur === prev.wsProxy ? next.wsProxy : cur));
    setGlobalProxyInput((cur) => (cur === prev.globalProxy ? next.globalProxy : cur));
    setPyInterp((cur) => (cur === prev.python ? next.python : cur));
    setWorkers((cur) => (cur === prev.workers ? next.workers : cur));
    setInjectPlanner(s.constraints_inject_planner !== false);
    setInjectWorker(s.constraints_inject_worker !== false);
  }, []);

  const saveWorkers = () => {
    const n = Number(workers);
    if (!Number.isInteger(n) || n <= 0) {
      setWorkersError("并发数必须是大于 0 的整数");
      return;
    }
    setWorkersError(null);
    beginSaving();
    api
      .setSettings({ workers: n })
      .then((s) => {
        apply(s);
        toast.success("已保存并发工作 agent 数（对之后启动的任务生效）");
      })
      .catch((e) => toast.error("保存失败：" + (e as Error).message))
      .finally(endSaving);
  };

  const savePython = () => {
    beginSaving();
    api
      .setSettings({ python_interpreter: pyInterp.trim() })
      .then((s) => {
        apply(s);
        toast.success("已保存 Python 解释器配置");
      })
      .catch((e) => toast.error("保存失败：" + (e as Error).message))
      .finally(endSaving);
  };
  const detectPython = () => {
    beginSaving();
    api
      .detectPython()
      .then((r) => setPyInterp(r.python_interpreter))
      .catch((e) => toast.error("检测失败：" + (e as Error).message))
      .finally(endSaving);
  };

  const { data: settings, error: loadError, status: loadStatus, reload } = useAsyncData(() => api.settings(), []);
  React.useEffect(() => {
    if (settings) apply(settings);
  }, [settings, apply]);
  // 没有拿到服务端配置前不渲染表单：否则会把默认值当成真实设置展示、还能直接提交。
  const loaded = !!settings;

  const persistTraffic = (v: boolean) => {
    setTrafficCapture(v); // optimistic
    beginSaving();
    return api
      .setSettings({ traffic_capture: v })
      .then(apply)
      .catch((e) => {
        setTrafficCapture(!v); // revert on failure
        toast.error("保存失败：" + (e as Error).message);
      })
      .finally(endSaving);
  };

  const toggleTraffic = (v: boolean) => {
    if (v) {
      // 开启会全量落库并即时重建 Agent，先确认后果。
      setConfirmCapture(true);
      return;
    }
    void persistTraffic(false);
  };

  const toggleInjectPlanner = (v: boolean) => {
    setInjectPlanner(v); // optimistic
    beginSaving();
    api
      .setSettings({ constraints_inject_planner: v })
      .then(apply)
      .catch((e) => {
        setInjectPlanner(!v); // revert on failure
        toast.error("保存失败：" + (e as Error).message);
      })
      .finally(endSaving);
  };

  const toggleAgentTrafficBinding = (v: boolean) => {
    setAgentTrafficBinding(v); // optimistic
    beginSaving();
    api
      .setSettings({ agent_traffic_binding: v })
      .then(apply)
      .catch((e) => {
        setAgentTrafficBinding(!v);
        toast.error(`保存失败：${(e as Error).message}`);
      })
      .finally(endSaving);
  };

  const toggleInjectWorker = (v: boolean) => {
    setInjectWorker(v); // optimistic
    beginSaving();
    api
      .setSettings({ constraints_inject_worker: v })
      .then(apply)
      .catch((e) => {
        setInjectWorker(!v); // revert on failure
        toast.error("保存失败：" + (e as Error).message);
      })
      .finally(endSaving);
  };

  // Persist a web-search patch (enable and/or backend). Optimistic with refetch.
  const saveWebSearch = (patch: Partial<Settings>) => {
    beginSaving();
    api
      .setSettings(patch)
      .then(apply)
      .catch((e) => {
        toast.error("保存失败：" + (e as Error).message);
        api
          .settings()
          .then(apply)
          .catch(() => undefined);
      })
      .finally(endSaving);
  };

  const saveBraveKey = () => {
    setSavingKey(true);
    beginSaving();
    api
      .setSettings({ brave_search_api_key: braveKeyInput })
      .then((s) => {
        apply(s);
        setBraveKeyInput("");
        toast.success("已保存 Brave API Key");
      })
      .catch((e) => toast.error("保存失败：" + (e as Error).message))
      .finally(() => {
        setSavingKey(false);
        endSaving();
      });
  };

  const saveTavilyKey = () => {
    setSavingTavilyKey(true);
    beginSaving();
    api
      .setSettings({ tavily_search_api_key: tavilyKeyInput })
      .then((s) => {
        apply(s);
        setTavilyKeyInput("");
        toast.success("已保存 Tavily API Key");
      })
      .catch((e) => toast.error("保存失败：" + (e as Error).message))
      .finally(() => {
        setSavingTavilyKey(false);
        endSaving();
      });
  };

  const saveProxy = () => {
    setSavingProxy(true);
    beginSaving();
    api
      .setSettings({ web_search_proxy: proxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(proxyInput.trim() ? "已保存出口代理" : "已清除出口代理（改为直连）");
      })
      .catch((e) => toast.error("保存失败：" + (e as Error).message))
      .finally(() => {
        setSavingProxy(false);
        endSaving();
      });
  };

  const saveGlobalProxy = () => {
    setSavingGlobalProxy(true);
    beginSaving();
    api
      .setSettings({ global_proxy: globalProxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(globalProxyInput.trim() ? "已保存全局代理" : "已清除全局代理（改为直连）");
      })
      .catch((e) => toast.error("保存失败：" + (e as Error).message))
      .finally(() => {
        setSavingGlobalProxy(false);
        endSaving();
      });
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
        if (r.ok) toast.success(`搜索测试成功 · ${r.backend} 返回 ${r.count} 条结果`);
        else toast.error("搜索测试失败：" + (r.error || "未知错误"));
      })
      .catch((e) => toast.error("搜索测试失败：" + (e as Error).message))
      .finally(() => setTesting(false));
  };

  // brave-free selected but no key stored and none being entered → tool stays off.
  const braveNeedsKey = webSearch && backend === "brave-free" && !braveKeySet;

  // 与服务端已保存值不一致即为「未保存」草稿。
  const pythonDirty = pyInterp.trim() !== saved.python.trim();
  const workersDirty = workers.trim() !== saved.workers.trim();
  const globalProxyDirty = globalProxyInput.trim() !== saved.globalProxy.trim();
  const wsProxyDirty = proxyInput.trim() !== saved.wsProxy.trim();

  // 首载与失败都不渲染表单：否则默认值会被当成真实配置，失败也无处重试。
  if (!settings) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <PageHeader
          icon={Settings2Icon}
          title="系统设置"
          description="常用运行配置集中显示，工具与网络参数按需调整。"
        />
        <AsyncState
          status={loadStatus === "error" ? "error" : "loading"}
          error={loadError}
          onRetry={reload}
          skeleton={
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-lg" />
              ))}
            </div>
          }
        >
          <div />
        </AsyncState>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        icon={Settings2Icon}
        title="系统设置"
        description="运行参数、网络出口与安全约束集中管理；每项单独保存，保存后即时生效。"
        meta={[
          <span>流量捕获：{trafficCapture ? "已开启" : "已关闭"}</span>,
          <span>网络搜索：{webSearch ? "已开启" : "已关闭"}</span>,
          <span className="tabular-nums">Work Agent {workers} 个</span>,
        ]}
        actions={
          <Button size="sm" variant="outline" onClick={reload} disabled={saving}>
            <RefreshCwIcon /> 刷新配置
          </Button>
        }
      />

      <Tabs defaultValue="basic" className="flex-1">
        <TabsList className="w-fit">
          <TabsTrigger value="basic">基本设置</TabsTrigger>
          <TabsTrigger value="advanced">高级设置</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              icon={RadioTowerIcon}
              title="流量捕获"
              description="开启后，所有 Agent 的 HTTP 流量经记录代理全量落库，并向 Agent 注入 traffic_search / traffic_get 工具与代理配置。"
            >
              <div className="grid gap-3">
                <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-muted/70 p-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="traffic-capture" className="text-[13px] font-medium">
                        记录 HTTP 流量
                      </Label>
                      <TogglePill on={trafficCapture} />
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                      {trafficCapture ? "正在记录流量并注入代理" : "不记录流量、不注入代理"}
                    </p>
                  </div>
                  <Switch
                    id="traffic-capture"
                    checked={trafficCapture}
                    disabled={!loaded || saving}
                    onCheckedChange={toggleTraffic}
                  />
                </div>
                <p className="text-[12px] leading-5 text-muted-foreground">
                  关闭（默认）时不记录任何流量：Agent <b>不会</b>拿到代理配置与流量工具，提示词也<b>不含</b>
                  代理相关内容。切换后会即时重建 Agent 生效。
                </p>
              </div>
            </SectionCard>

            <SectionCard
              icon={RadioTowerIcon}
              title="Agent 自动绑定流量"
              description="漏洞入库时触发的报告 Agent 会核对已有 HTTP 请求/响应，关联对应流量后再编写报告。"
            >
              <div className="grid gap-3">
                <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-muted/70 p-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="agent-traffic-binding" className="text-[13px] font-medium">
                        自动关联流量证据
                      </Label>
                      <TogglePill on={agentTrafficBinding} onLabel="已开启，会增加 Token 消耗" offLabel="已关闭，可人工绑定" />
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                      查阅数据包及额外的工具调用会增加 Token 消耗。
                    </p>
                  </div>
                  <Switch
                    id="agent-traffic-binding"
                    aria-describedby="agent-traffic-binding-description"
                    checked={agentTrafficBinding}
                    disabled={!loaded || saving}
                    onCheckedChange={toggleAgentTrafficBinding}
                  />
                </div>
                <p id="agent-traffic-binding-description" className="text-[12px] leading-5 text-muted-foreground">
                  默认关闭。TCP、未抓包或没有匹配流量时仍可正常上报。此开关不影响流量捕获、人工绑定及已保存证据的查看；
                  对下一轮 Agent 生效，关闭后会立即拒绝新的自动绑定。
                </p>
              </div>
            </SectionCard>

            <SectionCard
              icon={FileCode2Icon}
              title="自定义脚本"
              description="自定义 script 类型工具用它跑 Python；留空则运行时自动检测。"
            >
              <div className="grid gap-2">
                <Label htmlFor="python-interpreter" className="text-[13px] font-medium">
                  Python 解释器
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="python-interpreter"
                    className="w-full font-mono text-[13px] sm:min-w-0 sm:flex-1"
                    placeholder="/usr/bin/python3（留空=自动检测）"
                    value={pyInterp}
                    disabled={!loaded || saving}
                    onChange={(e) => setPyInterp(e.target.value)}
                  />
                  <Button variant="ghost" onClick={detectPython} disabled={!loaded || saving}>
                    重新检测
                  </Button>
                  <Button variant="outline" onClick={savePython} disabled={!loaded || saving}>
                    保存
                  </Button>
                  {pythonDirty && <DirtyHint>未保存</DirtyHint>}
                </div>
                <p className="text-[12px] leading-5 text-muted-foreground">
                  开机会自动检测（python3 优先）；此处可手填 venv / 特定版本的绝对路径，留空则运行时自动检测。
                </p>
              </div>
            </SectionCard>

            <SectionCard
              icon={CpuIcon}
              title="工作并发 · Work Agent 数"
              description="每个任务并发运行的工作 agent 数量（默认 3）。修改后对之后启动的任务生效，正在运行的任务不受影响。"
            >
              <div className="grid gap-2">
                <Label htmlFor="worker-count" className="text-[13px] font-medium">
                  工作并发数
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="worker-count"
                    type="number"
                    min={1}
                    className="w-32 font-mono text-[13px] tabular-nums"
                    placeholder="3"
                    value={workers}
                    aria-invalid={!!workersError}
                    aria-describedby={workersError ? "worker-count-error" : undefined}
                    disabled={!loaded || saving}
                    onChange={(e) => {
                      setWorkers(e.target.value);
                      if (workersError) setWorkersError(null);
                    }}
                  />
                  <Button variant="outline" onClick={saveWorkers} disabled={!loaded || saving}>
                    保存
                  </Button>
                  {workersDirty && !workersError && <DirtyHint>未保存</DirtyHint>}
                </div>
                {workersError ? (
                  <p id="worker-count-error" role="alert" className="text-destructive text-xs">
                    {workersError}
                  </p>
                ) : (
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    数值越大并发探测越多、消耗也越高；保存后对之后启动的任务生效。
                  </p>
                )}
              </div>
            </SectionCard>

            <SectionCard
              icon={KeyboardIcon}
              title="会话输入框发送键位"
              className="xl:col-span-2"
              description="任务会话输入框使用此设置，选择后立即生效、无需保存；该偏好只存在本浏览器，不随账号同步。"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <Label htmlFor="chat-send-mode" className="text-[13px] font-medium">
                  发送方式
                </Label>
                <Select value={sendMode} onValueChange={(v) => setChatSendMode(v as ChatSendMode)}>
                  <SelectTrigger id="chat-send-mode" className="w-full min-w-0 text-[13px] sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAT_SEND_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="mt-4">
          <div className="grid items-start gap-4">
            <SectionCard
              icon={WrenchIcon}
              title="工具与 Agent 配置"
              description="按需调整角色、工具和技能，日常测试使用现有配置。"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <Button variant="outline" className="justify-between" asChild>
                  <Link href="/system/agents">
                    Agent 配置
                    <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button variant="outline" className="justify-between" asChild>
                  <Link href="/system/tools">
                    工具配置
                    <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button variant="outline" className="justify-between" asChild>
                  <Link href="/system/skills">
                    Skills 配置
                    <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                  </Link>
                </Button>
                <Button variant="outline" className="justify-between" asChild>
                  <Link href="/system/mcp">
                    MCP 配置
                    <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                  </Link>
                </Button>
              </div>
            </SectionCard>

            <SectionCard
              icon={Globe2Icon}
              title="全局代理"
              description="所有 Agent 的目标流量经此代理出网（隐藏源 IP / 走跳板），支持 http / https / socks5，可带 user:pass 认证。"
            >
              <div className="grid gap-2">
                <Label htmlFor="global-proxy" className="text-[13px] font-medium">
                  代理地址
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="global-proxy"
                    autoComplete="off"
                    className="min-w-0 flex-1 font-mono text-[13px]"
                    placeholder="socks5://user:pass@host:1080 或 http://host:port（留空=直连）"
                    value={globalProxyInput}
                    disabled={!loaded || savingGlobalProxy}
                    onChange={(e) => setGlobalProxyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveGlobalProxy}
                    disabled={!loaded || savingGlobalProxy}
                  >
                    保存
                  </Button>
                </div>
                <p className="text-[12px] leading-5 text-muted-foreground">
                  {globalProxyInput.trim() ? "已配置，所有目标流量经此代理出网" : "未配置，目标流量直连出网"}
                  {globalProxyDirty && <span className="text-warning">（有未保存的修改）</span>}
                </p>
                <p className="text-[12px] leading-5 text-muted-foreground">
                  开启流量捕获时作为记录代理的上游；关闭捕获时直接注入 Agent 的 bash / WebFetch 出网。与网络搜索代理、LLM
                  代理相互独立。
                </p>
              </div>
            </SectionCard>

            <SectionCard
              icon={ShieldAlertIcon}
              title="操作约束注入"
              description="把任务的操作约束（allow / deny 条目）拼进对应 Agent 的系统提示，用来框定探索边界；切换即时生效。"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-muted/70 p-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="inject-planner" className="text-[13px] font-medium">
                        注入规划者（planner）
                      </Label>
                      <TogglePill on={injectPlanner} />
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">规划阶段读取约束，约束探索边界。</p>
                  </div>
                  <Switch
                    id="inject-planner"
                    checked={injectPlanner}
                    disabled={!loaded || saving}
                    onCheckedChange={toggleInjectPlanner}
                  />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-muted/70 p-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="inject-worker" className="text-[13px] font-medium">
                        注入执行者（worker）
                      </Label>
                      <TogglePill on={injectWorker} />
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">执行阶段读取约束，避免越界操作。</p>
                  </div>
                  <Switch
                    id="inject-worker"
                    checked={injectWorker}
                    disabled={!loaded || saving}
                    onCheckedChange={toggleInjectWorker}
                  />
                </div>
                <p className="text-[12px] leading-5 text-muted-foreground sm:col-span-2">
                  默认都开。下一轮读取即生效，无需重建 Agent；关闭后该 Agent 不再看到约束。
                </p>
              </div>
            </SectionCard>

            <SectionCard
              icon={SearchIcon}
              title="网络搜索"
              description="网络搜索的总开关与来源配置。开启后才能在 Agent 配置里单独启用 web_search；仅返回标题/链接/摘要，抓取正文由 WebFetch 负责。"
            >
              <div className="grid gap-3">
                <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-muted/70 p-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="web-search" className="text-[13px] font-medium">
                        启用网络搜索
                      </Label>
                      <TogglePill on={webSearch} />
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                      {webSearch ? "总开关已开启，可在各 Agent 配置里单独启用" : "已关闭，各 Agent 无法启用网络搜索"}
                    </p>
                  </div>
                  <Switch
                    id="web-search"
                    checked={webSearch}
                    disabled={!loaded || saving}
                    onCheckedChange={(v) => {
                      setWebSearch(v); // optimistic
                      saveWebSearch({ web_search_enabled: v });
                    }}
                  />
                </div>

                {webSearch && (
                  <div className="flex flex-col gap-2 rounded-lg bg-surface-muted/70 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="web-search-backend" className="text-[13px] font-medium">
                        搜索来源
                      </Label>
                      <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                        网络搜索不走记录代理，独立于流量捕获。
                      </p>
                    </div>
                    <Select
                      value={backend}
                      disabled={!loaded || saving}
                      onValueChange={(v) => {
                        setBackend(v); // optimistic
                        saveWebSearch({ web_search_backend: v });
                      }}
                    >
                      <SelectTrigger id="web-search-backend" className="w-full min-w-0 text-[13px] sm:w-72">
                        <SelectValue placeholder="选择来源" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ddgs">DuckDuckGo（ddgs，免费无 Key）</SelectItem>
                        <SelectItem value="brave-free">Brave（免费版，需 Key）</SelectItem>
                        <SelectItem value="tavily">Tavily（需 Key）</SelectItem>
                        <SelectItem value="deepseek">DeepSeek（官方）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {webSearch && backend === "deepseek" && (
                  <div className="flex flex-col gap-2 rounded-lg border border-primary/15 bg-primary/[0.04] p-3.5">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      <SearchIcon className="size-3.5 text-primary" />
                      DeepSeek 官方联网搜索
                    </p>
                    <p className="text-muted-foreground text-[12px] leading-5">
                      该来源直接复用<b>当前激活的 LLM 配置</b>。因此它
                      <b>仅支持 DeepSeek 官方模型</b>，且该配置<b>必须使用 anthropic 协议</b>
                      ——DeepSeek 的 OpenAI 协议端点不支持服务端搜索。切换 LLM 配置后此来源可能失效。
                    </p>
                    <p className="text-muted-foreground text-[12px] leading-5">
                      与其它来源不同，搜索由 <b>DeepSeek 服务端执行</b>：每次搜索会额外消耗一次模型调用（产生 Token
                      费用），搜索请求<b>不经过上面的出口代理</b>，也<b>不计入流量留痕</b>；返回结果
                      <b>只有标题和链接</b>（无摘要），需要正文时由 WebFetch 抓取。
                    </p>
                    <p className="text-muted-foreground text-[12px] leading-5">
                      是否满足上述条件由你自行确认，系统不做拦截；可用下方「测试搜索」按钮实际跑一次来验证。
                    </p>
                  </div>
                )}

                {webSearch && backend === "brave-free" && (
                  <div className="grid gap-2 rounded-lg bg-surface-muted/70 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="brave-key" className="text-[13px] font-medium">
                        Brave Search API Key
                      </Label>
                      {braveKeySet && <TogglePill on onLabel="已配置" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="brave-key"
                        type="password"
                        autoComplete="off"
                        className="min-w-0 flex-1 font-mono text-[13px]"
                        placeholder={braveKeySet ? "已配置（留空则不变）" : "输入 Brave API Key"}
                        value={braveKeyInput}
                        disabled={!loaded || savingKey}
                        onChange={(e) => setBraveKeyInput(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={saveBraveKey}
                        disabled={!loaded || savingKey || braveKeyInput.trim() === ""}
                      >
                        保存
                      </Button>
                    </div>
                    {braveNeedsKey && (
                      <p className="text-warning text-[12px]">
                        已选择 Brave 但尚未配置 Key —— 在保存 Key 之前，搜索工具不会启用。
                      </p>
                    )}
                    <p className="text-muted-foreground text-[12px] leading-5">
                      免费版额度约 2,000 次/月。前往 https://brave.com/search/api/ 获取 Key。
                    </p>
                  </div>
                )}

                {webSearch && backend === "tavily" && (
                  <div className="grid gap-2 rounded-lg bg-surface-muted/70 p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor="tavily-key" className="text-[13px] font-medium">
                        Tavily Search API Key
                      </Label>
                      {tavilyKeySet && <TogglePill on onLabel="已配置" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="tavily-key"
                        type="password"
                        autoComplete="off"
                        className="min-w-0 flex-1 font-mono text-[13px]"
                        placeholder={tavilyKeySet ? "已配置（留空则不变）" : "输入 Tavily API Key（tvly-…）"}
                        value={tavilyKeyInput}
                        disabled={!loaded || savingTavilyKey}
                        onChange={(e) => setTavilyKeyInput(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={saveTavilyKey}
                        disabled={!loaded || savingTavilyKey || tavilyKeyInput.trim() === ""}
                      >
                        保存
                      </Button>
                    </div>
                    {webSearch && backend === "tavily" && !tavilyKeySet && (
                      <p className="text-warning text-[12px]">
                        已选择 Tavily 但尚未配置 Key —— 在保存 Key 之前，搜索工具不会启用。
                      </p>
                    )}
                    <p className="text-muted-foreground text-[12px] leading-5">
                      前往 https://tavily.com 注册并获取 API Key。
                    </p>
                  </div>
                )}

                {webSearch && (
                  <div className="grid gap-2 rounded-lg bg-surface-muted/70 p-3.5">
                    <Label htmlFor="ws-proxy" className="text-[13px] font-medium">
                      出口代理（可选）
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="ws-proxy"
                        autoComplete="off"
                        className="min-w-0 flex-1 font-mono text-[13px]"
                        placeholder="http://host:port 或 socks5://host:port（留空=直连）"
                        value={proxyInput}
                        disabled={!loaded || savingProxy}
                        onChange={(e) => setProxyInput(e.target.value)}
                      />
                      <Button type="button" variant="outline" onClick={saveProxy} disabled={!loaded || savingProxy}>
                        保存
                      </Button>
                    </div>
                    {wsProxyDirty && <p className="text-warning text-[12px]">有未保存的修改</p>}
                    <p className="text-muted-foreground text-[12px] leading-5">
                      独立出口代理，仅用于访问搜索端点（VPN / SOCKS 等）。与记录流量的 MITM 代理无关；网络不通时经此代理访问。
                    </p>
                  </div>
                )}

                {webSearch && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
                    <p className="text-muted-foreground min-w-0 flex-1 text-[12px] leading-5">
                      用当前配置（来源 + 代理 + Key）实际搜索一次「test」，验证是否可用。
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={runTest}
                      disabled={!loaded || testing}
                      className="shrink-0"
                    >
                      {testing ? "测试中…" : "测试搜索"}
                    </Button>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmCapture}
        onOpenChange={setConfirmCapture}
        title="开启流量捕获？"
        description="开启后所有 Agent 的 HTTP 流量会经记录代理全量落库，并即时重建 Agent 注入代理配置与流量工具，Token 消耗随之上升。可随时关闭。"
        confirmLabel="开启捕获"
        onConfirm={() => persistTraffic(true)}
      />
    </div>
  );
}
