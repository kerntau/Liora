"use client";

import * as React from "react";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import type {
  Activity,
  ConvTokenSummary,
  Finding,
  InterceptPending,
  LLMProfile,
  Settings,
  Stats,
  Task,
  TrafficExchange,
  UsageStats,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { ActivityPanel } from "./_components/activity-panel";
import { ApprovalPanel } from "./_components/approval-panel";
import { AssetPanel } from "./_components/asset-panel";
import { FindingPanel } from "./_components/finding-panel";
import { StatCards } from "./_components/stat-cards";
import { TaskPanel } from "./_components/task-panel";
import { TokenCharts } from "./_components/token-charts";
import { TrafficPanel } from "./_components/traffic-panel";
import { useTokenStats } from "./_components/use-token-stats";

// ── polling ──────────────────────────────────────────────────────────────────

type SourceKey = "tasks" | "fast" | "slow";
type SourceState = "pending" | "ok" | "error";

const SOURCE_KEYS: SourceKey[] = ["tasks", "fast", "slow"];

// 面板中文名：顶部失败提示据此说明「哪些面板没加载出来」。
const FAST_PANEL_LABELS: Record<string, string> = {
  findings: "确认发现",
  stats: "系统状态",
  settings: "流量捕获状态",
  pending: "待审批拦截",
  activity: "活动流",
  tokens: "Token 用量",
  convTokens: "会话令牌",
};

const SLOW_PANEL_LABELS: Record<string, string> = {
  traffic: "流量交互",
  assetCounts: "资产节点",
  agents: "代理",
  mcpServers: "MCP 服务",
  skills: "技能",
  tools: "工具",
  llmProfiles: "模型配置",
  usageStats: "用量统计",
};

type SettledValues<T extends Record<string, () => Promise<unknown>>> = {
  [K in keyof T]?: Awaited<ReturnType<T[K]>>;
};

/**
 * 逐项 settle：单个接口失败只记入失败项，同一批里已经成功的数据照常返回，
 * 不再出现「一个接口挂掉 = 整批面板都不更新」。
 */
async function settleAll<T extends Record<string, () => Promise<unknown>>>(
  loaders: T,
): Promise<{ values: SettledValues<T>; failed: (keyof T)[] }> {
  const keys = Object.keys(loaders) as (keyof T)[];
  const results = await Promise.allSettled(keys.map((key) => Promise.resolve().then(() => loaders[key]())));
  const values: Partial<Record<keyof T, unknown>> = {};
  const failed: (keyof T)[] = [];
  results.forEach((result, index) => {
    const key = keys[index];
    if (result.status === "fulfilled") {
      values[key] = result.value;
    } else {
      failed.push(key);
    }
  });
  return { values: values as SettledValues<T>, failed };
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // data state
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [pending, setPending] = React.useState<InterceptPending[]>([]);
  const [activity, setActivity] = React.useState<Activity[]>([]);
  const [convTokens, setConvTokens] = React.useState<ConvTokenSummary[]>([]);
  const [usageStats, setUsageStats] = React.useState<UsageStats | null>(null);
  const [assetCounts, setAssetCounts] = React.useState<Record<string, number>>({});
  const [traffic, setTraffic] = React.useState<TrafficExchange[]>([]);
  const [llmProfiles, setLLMProfiles] = React.useState<LLMProfile[]>([]);
  const [refreshRevision, refresh] = React.useReducer((value: number) => value + 1, 0);

  // 三个数据源各自的首载/失败状态：首载前给骨架（不把 0 当真实数据），
  // 失败保留旧值并在顶部显式提示，避免「请求失败 = 页面全空」。
  const [sources, setSources] = React.useState<Record<SourceKey, SourceState>>({
    tasks: "pending",
    fast: "pending",
    slow: "pending",
  });
  // 每个源里失败的面板名（成功项照常更新）；只有整源全灭才把源标成 error。
  const [failedPanels, setFailedPanels] = React.useState<Record<SourceKey, string[]>>({
    tasks: [],
    fast: [],
    slow: [],
  });
  const reportSource = React.useCallback((key: SourceKey, failed: string[], total: number) => {
    const next: SourceState = failed.length >= total ? "error" : "ok";
    setSources((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    setFailedPanels((prev) => {
      const current = prev[key];
      if (current.length === failed.length && current.every((label, index) => label === failed[index])) return prev;
      return { ...prev, [key]: failed };
    });
  }, []);
  const tasksReady = sources.tasks === "ok";
  const fastReady = sources.fast === "ok";
  const slowReady = sources.slow === "ok";
  const failedLabels = React.useMemo(() => {
    const labels: string[] = [];
    for (const key of SOURCE_KEYS) {
      for (const label of failedPanels[key]) {
        if (!labels.includes(label)) labels.push(label);
      }
    }
    return labels;
  }, [failedPanels]);
  const anyFailed = failedLabels.length > 0;
  const allFailed = SOURCE_KEYS.every((key) => sources[key] === "error");
  const failedSummary =
    failedLabels.length > 6
      ? `${failedLabels.slice(0, 6).join("、")} 等 ${failedLabels.length} 项`
      : failedLabels.join("、");

  // 手动刷新：三个数据源都结束（成功或失败）才收起转圈。
  // 用「代次」区分批次：旧代次的请求（5s/15s 轮询里还在飞的）结束时直接忽略，
  // 不会把本次刷新的计数多减，转圈不会提前停。
  const [refreshing, setRefreshing] = React.useState(false);
  const refreshGeneration = React.useRef(0);
  const refreshOutstanding = React.useRef<Set<SourceKey>>(new Set());
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const startRefresh = React.useCallback(() => {
    refreshGeneration.current += 1;
    refreshOutstanding.current = new Set(SOURCE_KEYS);
    setRefreshing(true);
    refresh();
  }, []);
  const finishRefresh = React.useCallback((generation: number, key: SourceKey) => {
    // 旧代次的请求结束：不属于本次刷新，直接忽略。
    if (generation !== refreshGeneration.current) return;
    const outstanding = refreshOutstanding.current;
    if (!outstanding.delete(key)) return;
    if (outstanding.size === 0) setRefreshing(false);
  }, []);

  // 一次抓取所属的批次是否仍然有效：组件已卸载，或期间又发起了手动刷新，都要丢弃。
  const currentBatch = React.useCallback(
    (generation: number) => () => mounted.current && generation === refreshGeneration.current,
    [],
  );

  // 任务列表最重，单独轮询：避免大历史拖住其他面板。
  const tasksSignature = React.useRef("");
  const loadTasks = React.useCallback(
    async (generation: number) => {
      const isCurrent = currentBatch(generation);
      try {
        const tr = await api.tasks();
        if (!isCurrent()) return;
        const nextSignature = JSON.stringify(tr.tasks);
        if (nextSignature !== tasksSignature.current) {
          tasksSignature.current = nextSignature;
          setTasks(tr.tasks);
        }
        reportSource("tasks", [], 1);
      } catch {
        // 保留旧值，下一轮自动重试；失败面板在顶部显式提示。
        if (isCurrent()) reportSource("tasks", ["任务列表"], 1);
      } finally {
        finishRefresh(generation, "tasks");
      }
    },
    [currentBatch, finishRefresh, reportSource],
  );

  // 其余快源：逐项 settle，单个接口失败不再拖垮整批面板。
  const loadFast = React.useCallback(
    async (generation: number) => {
      const isCurrent = currentBatch(generation);
      try {
        const { values, failed } = await settleAll({
          findings: () => api.findings(),
          stats: () => api.stats(),
          settings: () => api.settings(),
          pending: () => api.interceptPending(),
          activity: () => api.activity(undefined, { limit: 30 }),
          tokens: () => api.tokenStats(),
          convTokens: () => api.conversationTokens(),
        });
        if (!isCurrent()) return;
        if (values.findings !== undefined) setFindings(values.findings);
        if (values.stats !== undefined) setStats(values.stats);
        if (values.settings !== undefined) setSettings(values.settings);
        if (values.pending !== undefined) setPending(values.pending);
        if (values.activity !== undefined) setActivity(values.activity.items);
        if (values.convTokens !== undefined) setConvTokens(values.convTokens);
        // total = 失败数 + 成功数：只有整批全灭才标 error。
        reportSource(
          "fast",
          failed.map((panel) => FAST_PANEL_LABELS[panel]),
          failed.length + Object.keys(values).length,
        );
      } finally {
        finishRefresh(generation, "fast");
      }
    },
    [currentBatch, finishRefresh, reportSource],
  );

  // slow poll: traffic, assets, system-static (every 15s)
  const loadSlow = React.useCallback(
    async (generation: number) => {
      const isCurrent = currentBatch(generation);
      try {
        const { values, failed } = await settleAll({
          traffic: () => api.traffic(0, 50),
          assetCounts: () => api.assetCounts(),
          agents: () => api.agents(),
          mcpServers: () => api.mcpServers(),
          skills: () => api.skills(),
          tools: () => api.tools(),
          llmProfiles: () => api.llmProfiles(),
          usageStats: () => api.usageStats(365),
        });
        if (!isCurrent()) return;
        if (values.traffic !== undefined) setTraffic(values.traffic.exchanges ?? []);
        if (values.assetCounts !== undefined) setAssetCounts(values.assetCounts ?? {});
        if (values.llmProfiles !== undefined) setLLMProfiles(values.llmProfiles);
        if (values.usageStats !== undefined) setUsageStats(values.usageStats);
        reportSource(
          "slow",
          failed.map((panel) => SLOW_PANEL_LABELS[panel]),
          failed.length + Object.keys(values).length,
        );
      } finally {
        finishRefresh(generation, "slow");
      }
    },
    [currentBatch, finishRefresh, reportSource],
  );

  // 三个源各自的节奏：任务与快源 5s，慢源 15s。标签页隐藏时 usePolling 会停表，
  // 回到前台先补跑一次；同一源串行，上一批没结束就不叠加请求。
  usePolling(() => loadTasks(refreshGeneration.current), 5000);
  usePolling(() => loadFast(refreshGeneration.current), 5000);
  usePolling(() => loadSlow(refreshGeneration.current), 15000);

  // 手动刷新：代次已在 startRefresh 里 +1，旧批次的结果会自动作废；
  // 这里立刻让三个源各跑一批，不必等下一个轮询周期。
  React.useEffect(() => {
    if (refreshRevision === 0) return;
    const generation = refreshGeneration.current;
    void loadTasks(generation);
    void loadFast(generation);
    void loadSlow(generation);
  }, [refreshRevision, loadTasks, loadFast, loadSlow]);

  // ── derived ───────────────────────────────────────────────────────────────

  const tasksByStatus = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) m[t.status] = (m[t.status] ?? 0) + 1;
    return m;
  }, [tasks]);

  const findingsBySev = React.useMemo(() => {
    const m = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (f.severity in m) m[f.severity as keyof typeof m]++;
    }
    return m;
  }, [findings]);

  const totalAssets = React.useMemo(() => Object.values(assetCounts).reduce((a, b) => a + b, 0), [assetCounts]);

  // system
  const activeProfile = llmProfiles.find((p) => p.is_default);

  // ── token stats per LLM profile ──────────────────────────────────────────
  // tasks whose llm_profile_id is null/undefined used the active default profile
  const defaultProfileId = activeProfile ? Number(activeProfile.id) : null;

  const {
    tokenVersion,
    setTokenVersion,
    tokenTab,
    setTokenTab,
    tokenDays,
    setTokenDays,
    tokenByProfile,
    displayedTokens,
    dailyTokenData,
  } = useTokenStats({ tasks, convTokens, usageStats, llmProfiles, defaultProfileId });

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">总览</h1>
          <p className="text-xs text-muted-foreground">系统全局状态 · 实时刷新</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="刷新仪表盘数据"
          aria-busy={refreshing || undefined}
          disabled={refreshing}
          onClick={startRefresh}
        >
          <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {anyFailed && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground"
        >
          <AlertTriangleIcon className="size-3.5 shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1">
            {allFailed ? "数据加载失败" : "部分面板加载失败"}：
            <span className="font-medium text-foreground/80">{failedSummary}</span>
            （已保留上次结果，将自动重试）
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs"
            disabled={refreshing}
            onClick={startRefresh}
          >
            立即重试
          </Button>
        </div>
      )}

      {/* ── Row 1: 5 stat cards ── */}
      <StatCards
        tasksReady={tasksReady}
        tasksTotal={tasks.length}
        tasksByStatus={tasksByStatus}
        fastReady={fastReady}
        findingsTotal={findings.length}
        findingsBySev={findingsBySev}
        slowReady={slowReady}
        totalAssets={totalAssets}
        trafficCount={traffic.length}
        trafficCapture={settings?.traffic_capture}
        tokens={displayedTokens}
      />

      {/* ── Row 2: LLM Token 消耗 ── */}
      <TokenCharts
        llmProfiles={llmProfiles}
        defaultProfileId={defaultProfileId}
        tokenVersion={tokenVersion}
        onTokenVersionChange={setTokenVersion}
        tokenTab={tokenTab}
        onTokenTabChange={setTokenTab}
        tokenDays={tokenDays}
        onTokenDaysChange={setTokenDays}
        tokenByProfile={tokenByProfile}
        displayedTokens={displayedTokens}
        dailyTokenData={dailyTokenData}
      />

      {/* ── Row 3: 活动流 | 发现 ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ActivityPanel activity={activity} fastReady={fastReady} />
        <FindingPanel findings={findings} fastReady={fastReady} />
      </div>

      {/* ── Row 4: 任务表格 ── */}
      <TaskPanel tasks={tasks} tasksReady={tasksReady} />

      {/* ── Row 5: 资产分布 | 流量状态码 | 拦截 & 待审批 ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <AssetPanel assetCounts={assetCounts} totalAssets={totalAssets} />
        <TrafficPanel traffic={traffic} />
        <ApprovalPanel stats={stats} settings={settings} activeProfile={activeProfile} pending={pending} />
      </div>
    </div>
  );
}
