import * as React from "react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  LinearProgress,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowUpRightIcon,
  BugIcon,
  ClockIcon,
  NetworkIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TargetIcon,
  ZapIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { StatusBadge } from "@/components/status-badge";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { api } from "@/lib/api";
import type {
  Activity,
  Agent,
  ConvTokenSummary,
  Finding,
  InterceptPending,
  LLMProfile,
  MCPServer,
  Settings,
  SkillItem,
  Stats,
  Task,
  TokenTotal,
  Tool,
  TrafficExchange,
  UsageStats,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ── chart constants ───────────────────────────────────────────────────────────
const dailyTrendConfig = {
  input: { label: "输入", color: "hsl(217 91% 60%)" },
  output: { label: "输出", color: "hsl(263 70% 60%)" },
  cacheRead: { label: "缓存读", color: "hsl(160 60% 45%)" },
} satisfies ChartConfig;
// ── helpers ──────────────────────────────────────────────────────────────────
function fmtRel(ts?: string | number): string {
  if (!ts) return "—";
  const ms = Date.now() - (typeof ts === "number" ? ts * 1000 : Date.parse(ts as string));
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s 前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m 前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h 前`;
  return `${Math.floor(h / 24)}d 前`;
}
function fmtTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
const ASSET_TYPE_LABELS: Record<string, string> = {
  root_domain: "根域名",
  ip: "IP",
  subdomain: "子域名",
  app: "应用",
  service: "服务",
  endpoint: "端点",
};
const ASSET_COLORS: Record<string, "primary" | "warning" | "info" | "success"> = {
  root_domain: "primary",
  ip: "primary",
  subdomain: "primary",
  app: "warning",
  service: "info",
  endpoint: "success",
};
function statusColor(code: number): string {
  if (code < 300) return "text-success";
  if (code < 400) return "text-accent";
  if (code < 500) return "text-warning";
  return "text-danger";
}
function statusBg(code: number): string {
  if (code < 300) return "bg-success";
  if (code < 400) return "bg-accent";
  if (code < 500) return "bg-warning";
  return "bg-danger";
}
// ── sub-components ────────────────────────────────────────────────────────────
function LiveDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-accent", className)} />;
}
function SectionTitle({
  icon: Icon,
  children,
  sub,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-muted" />
        {children}
      </div>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
// ── page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  // data state
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [pending, setPending] = React.useState<InterceptPending[]>([]);
  const [activity, setActivity] = React.useState<Activity[]>([]);
  const [tokens, setTokens] = React.useState<TokenTotal | null>(null);
  const [convTokens, setConvTokens] = React.useState<ConvTokenSummary[]>([]);
  const [usageStats, setUsageStats] = React.useState<UsageStats | null>(null);
  const [assetCounts, setAssetCounts] = React.useState<Record<string, number>>({});
  const [traffic, setTraffic] = React.useState<TrafficExchange[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [mcpServers, setMcpServers] = React.useState<MCPServer[]>([]);
  const [skills, setSkills] = React.useState<SkillItem[]>([]);
  const [tools, setTools] = React.useState<Tool[]>([]);
  const [llmProfiles, setLLMProfiles] = React.useState<LLMProfile[]>([]);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  // The task list is the most expensive dashboard source. Poll it independently
  // so a large history cannot hold back every other dashboard panel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: The refresh button explicitly restarts each polling group.
  React.useEffect(() => {
    let alive = true;
    let loading = false;
    let signature = "";
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const tr = await api.tasks();
        if (!alive) return;
        const nextSignature = JSON.stringify(tr.tasks);
        if (nextSignature !== signature) {
          signature = nextSignature;
          setTasks(tr.tasks);
        }
      } catch {
        /* transient errors — next poll retries */
        if (alive) setLoadError(true);
      } finally {
        loading = false;
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshNonce]);
  // The remaining fast sources stay batched so one poll causes a single render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: The refresh button explicitly restarts each polling group.
  React.useEffect(() => {
    let alive = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [findings, stats, settings, pending, activity, tokens, conversationTokens] = await Promise.all([
          api.findings(),
          api.stats(),
          api.settings(),
          api.interceptPending(),
          api.activity(undefined, { limit: 30 }),
          api.tokenStats(),
          api.conversationTokens(),
        ]);
        if (!alive) return;
        setFindings(findings);
        setStats(stats);
        setSettings(settings);
        setPending(pending);
        setActivity(activity.items);
        setTokens(tokens.total ?? null);
        setConvTokens(conversationTokens);
        setInitialLoading(false);
        setLoadError(false);
        setLastUpdated(new Date());
      } catch {
        // Preserve stale data and retry on the next interval.
        if (alive) {
          setInitialLoading(false);
          setLoadError(true);
        }
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [refreshNonce]);
  // slow poll: traffic, assets, system-static (every 15s)
  // biome-ignore lint/correctness/useExhaustiveDependencies: The refresh button explicitly restarts each polling group.
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [traf, counts, agentList, mcpList, skillList, toolList, profileList, usage] = await Promise.all([
          api.traffic(0, 50),
          api.assetCounts(),
          api.agents(),
          api.mcpServers(),
          api.skills(),
          api.tools(),
          api.llmProfiles(),
          api.usageStats(365),
        ]);
        if (!alive) return;
        setTraffic(traf.exchanges ?? []);
        setAssetCounts(counts ?? {});
        setAgents(agentList);
        setMcpServers(mcpList);
        setSkills(skillList);
        setTools(toolList);
        setLLMProfiles(profileList);
        setUsageStats(usage);
      } catch {
        /* transient errors */
        if (alive) setLoadError(true);
      }
    };
    void load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshNonce]);
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
  const sortedTasks = React.useMemo(
    () =>
      [...tasks]
        .sort((a, b) => (b.last_activity_unix ?? b.created_unix ?? 0) - (a.last_activity_unix ?? a.created_unix ?? 0))
        .slice(0, 5),
    [tasks],
  );
  const recentFindings = React.useMemo(
    () => [...findings].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 8),
    [findings],
  );
  const recentActivity = React.useMemo(
    () =>
      [...activity]
        .filter((a) => a.kind !== "usage")
        .sort((a, b) => b.seq - a.seq)
        .slice(0, 6),
    [activity],
  );
  const totalAssets = React.useMemo(() => Object.values(assetCounts).reduce((a, b) => a + b, 0), [assetCounts]);
  // asset type breakdown
  const assetByType = React.useMemo(() => {
    return Object.entries(assetCounts)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [assetCounts]);
  const assetMax = assetByType[0]?.[1] ?? 1;
  // traffic status code breakdown
  const trafficByCodes = React.useMemo(() => {
    const m: Record<number, number> = {};
    for (const e of traffic) {
      const bucket = Math.floor(e.status / 100) * 100;
      m[bucket] = (m[bucket] ?? 0) + 1;
    }
    return Object.entries(m)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([code, n]) => ({ code: Number(code), n }));
  }, [traffic]);
  const trafficMax = Math.max(...trafficByCodes.map((x) => x.n), 1);
  const recentTraffic = [...traffic].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 5);
  // system
  const activeProfile = llmProfiles.find((p) => p.is_default);
  const enabledTools = tools.filter((t) => t.enabled);
  const pendingCount = pending.length;
  // ── token stats per LLM profile ──────────────────────────────────────────
  // tasks whose llm_profile_id is null/undefined used the active default profile
  const defaultProfileId = activeProfile ? Number(activeProfile.id) : null;
  // 数据源开关：旧版 = activity（task.tokens + 会话），新版 = llm_usage 计量账本。
  const [tokenVersion, setTokenVersion] = React.useState<"old" | "new">("old");
  // selected profile tab: "all" = 全部; number = specific profile id
  const [tokenTab, setTokenTab] = React.useState<number | null | "all">("all");
  // day range for the daily bar chart
  const [tokenDays, setTokenDays] = React.useState<7 | 30 | 90 | 180 | 365>(30);
  // profile 名 → id，用于把 llm_usage 的 profile_name 映射到现有 profile 分栏。
  const profileIdByName = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of llmProfiles) m.set(p.name, Number(p.id));
    return m;
  }, [llmProfiles]);
  type Bucket = {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    taskCount: number;
  };
  // 旧版：按 profile 归桶（来自 activity 的 task.tokens + 会话用量）。
  const tokenByProfileOld = React.useMemo<Map<number | null, Bucket>>(() => {
    const m = new Map<number | null, Bucket>();
    const fold = (key: number | null, inp: number, out: number, cr: number, cw: number, addTask: boolean) => {
      const prev = m.get(key) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, taskCount: 0 };
      m.set(key, {
        input: prev.input + inp,
        output: prev.output + out,
        cacheRead: prev.cacheRead + cr,
        cacheWrite: prev.cacheWrite + cw,
        taskCount: prev.taskCount + (addTask ? 1 : 0),
      });
    };
    for (const t of tasks) {
      fold(
        t.llm_profile_id ?? defaultProfileId,
        t.tokens?.input_tokens ?? 0,
        t.tokens?.output_tokens ?? 0,
        t.tokens?.cache_read_tokens ?? 0,
        t.tokens?.cache_write_tokens ?? 0,
        true,
      );
    }
    for (const c of convTokens) {
      fold(
        c.llm_profile_id ?? defaultProfileId,
        c.input_tokens,
        c.output_tokens,
        c.cache_read_tokens,
        c.cache_write_tokens,
        false,
      );
    }
    return m;
  }, [tasks, convTokens, defaultProfileId]);
  // 新版：按 profile 归桶（来自 llm_usage 全局聚合，逐次调用精确）。
  const tokenByProfileNew = React.useMemo<Map<number | null, Bucket>>(() => {
    const m = new Map<number | null, Bucket>();
    for (const p of usageStats?.by_profile ?? []) {
      // 未匹配到现有 profile（改名/删除/空名）→ 落到默认桶，仍计入「全部」。
      const key = profileIdByName.get(p.profile_name) ?? defaultProfileId;
      const prev = m.get(key) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, taskCount: 0 };
      m.set(key, {
        input: prev.input + p.input_tokens,
        output: prev.output + p.output_tokens,
        cacheRead: prev.cacheRead + p.cache_read_tokens,
        cacheWrite: prev.cacheWrite + p.cache_write_tokens,
        taskCount: prev.taskCount + p.tasks,
      });
    }
    return m;
  }, [usageStats, profileIdByName, defaultProfileId]);
  const tokenByProfile = tokenVersion === "new" ? tokenByProfileNew : tokenByProfileOld;
  const displayedTokens = React.useMemo(() => {
    if (tokenTab === "all") {
      let input = 0,
        output = 0,
        cacheRead = 0,
        cacheWrite = 0,
        taskCount = 0;
      for (const v of tokenByProfile.values()) {
        input += v.input;
        output += v.output;
        cacheRead += v.cacheRead;
        cacheWrite += v.cacheWrite;
        taskCount += v.taskCount;
      }
      return { input, output, cacheRead, cacheWrite, taskCount };
    }
    const v = tokenByProfile.get(tokenTab as number | null);
    return v
      ? { input: v.input, output: v.output, cacheRead: v.cacheRead, cacheWrite: v.cacheWrite, taskCount: v.taskCount }
      : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, taskCount: 0 };
  }, [tokenTab, tokenByProfile]);
  // 旧版每日：把任务/会话的总量按其创建日期归桶（近似，非真实每日消耗）。
  const dailyTokenDataOld = React.useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - tokenDays);
    const cutoff = now.toISOString().slice(0, 10);
    const m = new Map<
      string,
      {
        input: number;
        output: number;
        cacheRead: number;
      }
    >();
    const fold = (date: string, inp: number, out: number, cr: number) => {
      if (date < cutoff) return;
      const prev = m.get(date) ?? { input: 0, output: 0, cacheRead: 0 };
      m.set(date, { input: prev.input + inp, output: prev.output + out, cacheRead: prev.cacheRead + cr });
    };
    for (const t of tasks) {
      if (tokenTab !== "all" && (t.llm_profile_id ?? defaultProfileId) !== tokenTab) continue;
      fold(
        t.created_at.slice(0, 10),
        t.tokens?.input_tokens ?? 0,
        t.tokens?.output_tokens ?? 0,
        t.tokens?.cache_read_tokens ?? 0,
      );
    }
    for (const c of convTokens) {
      if (tokenTab !== "all" && (c.llm_profile_id ?? defaultProfileId) !== tokenTab) continue;
      fold(c.created_at.slice(0, 10), c.input_tokens, c.output_tokens, c.cache_read_tokens);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [tasks, convTokens, tokenDays, tokenTab, defaultProfileId]);
  // 新版每日：来自 llm_usage 的真实每日消耗（ts 是实际调用时刻）。
  const dailyTokenDataNew = React.useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - tokenDays);
    const cutoff = now.toISOString().slice(0, 10);
    const m = new Map<
      string,
      {
        input: number;
        output: number;
        cacheRead: number;
      }
    >();
    for (const d of usageStats?.daily ?? []) {
      if (d.date < cutoff) continue;
      if (tokenTab !== "all" && (profileIdByName.get(d.profile_name) ?? defaultProfileId) !== tokenTab) continue;
      const prev = m.get(d.date) ?? { input: 0, output: 0, cacheRead: 0 };
      m.set(d.date, {
        input: prev.input + d.input_tokens,
        output: prev.output + d.output_tokens,
        cacheRead: prev.cacheRead + d.cache_read_tokens,
      });
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [usageStats, tokenDays, tokenTab, profileIdByName, defaultProfileId]);
  const dailyTokenData = tokenVersion === "new" ? dailyTokenDataNew : dailyTokenDataOld;
  // activity kind label
  function kindLabel(a: Activity): string {
    if (a.kind === "tool_use") return a.tool ?? "tool_use";
    if (a.kind === "tool_result") return "tool_result";
    return a.kind;
  }
  function workerColor(w: string): string {
    if (w === "planner") return "text-accent";
    if (w === "mainagent") return "text-cyan-400";
    return "text-accent";
  }
  function workerBg(w: string): string {
    if (w === "planner") return "bg-accent/10 text-accent border-accent/20";
    if (w === "mainagent") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    return "bg-accent/10 text-accent border-accent/20";
  }
  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      {/* ── Header ── */}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">总览</h1>
          <p className="text-xs text-muted">系统全局状态 · 实时刷新</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastUpdated && (
            <span className="text-xs tabular-nums text-muted">
              更新于{" "}
              {lastUpdated.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <Button
            size="small"
            onClick={() => setRefreshNonce((value) => value + 1)}
            aria-label="刷新仪表盘数据"
            variant="outlined"
          >
            <RefreshCwIcon className="size-3.5" aria-hidden="true" /> 刷新
          </Button>
          <Button size="small" onClick={() => navigate("/function/tasks")} variant="contained">
            <PlusIcon className="size-3.5" aria-hidden="true" /> 新建任务
          </Button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs"
        >
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangleIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <strong className="font-medium">部分数据暂时不可用。</strong> 已保留最近一次结果，请稍后重试。
            </span>
          </div>
          <Button size="small" onClick={() => setRefreshNonce((value) => value + 1)} variant="outlined">
            重试
          </Button>
        </div>
      )}

      {/* ── Row 1: 5 stat cards ── */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* 活跃任务 */}
        <Card className="gap-1" sx={{ minWidth: 0 }}>
          <CardHeader
            title={
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <TargetIcon className="size-3" /> 活跃任务
              </div>
            }
            subheader={
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tabular-nums">
                  {initialLoading ? "—" : (tasksByStatus.running ?? 0)}
                </span>
                <span className="text-xs text-muted">/ {initialLoading ? "—" : tasks.length}</span>
              </div>
            }
            sx={{ pb: 1 }}
            slotProps={{ subheader: { color: "text.primary" } }}
          />
          <CardContent className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs" sx={{ pt: 1 }}>
            {(tasksByStatus.running ?? 0) > 0 && <span className="text-accent">探索 {tasksByStatus.running}</span>}
            {(tasksByStatus.paused ?? 0) > 0 && <span className="text-warning">暂停 {tasksByStatus.paused}</span>}
            {(tasksByStatus.done ?? 0) > 0 && <span className="text-success">完成 {tasksByStatus.done}</span>}
            {tasks.length === 0 && <span className="text-muted">暂无任务</span>}
          </CardContent>
        </Card>

        {/* 确认发现 */}
        <Card className="gap-1" sx={{ minWidth: 0 }}>
          <CardHeader
            title={
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <BugIcon className="size-3" /> 确认发现
              </div>
            }
            subheader={
              <div className="text-2xl font-semibold tabular-nums">{initialLoading ? "—" : findings.length}</div>
            }
            sx={{ pb: 1 }}
            slotProps={{ subheader: { color: "text.primary" } }}
          />
          <CardContent className="flex flex-wrap gap-2.5 text-xs" sx={{ pt: 1 }}>
            <span className="text-danger">严重 {findingsBySev.critical}</span>
            <span className="text-danger">高危 {findingsBySev.high}</span>
            <span className="text-warning">中危 {findingsBySev.medium}</span>
            <span className="text-muted">低危 {findingsBySev.low}</span>
          </CardContent>
        </Card>

        {/* 资产节点 */}
        <Card className="gap-1" sx={{ minWidth: 0 }}>
          <CardHeader
            title={
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <NetworkIcon className="size-3" /> 资产节点
              </div>
            }
            subheader={<div className="text-2xl font-semibold tabular-nums">{initialLoading ? "—" : totalAssets}</div>}
            sx={{ pb: 1 }}
            slotProps={{ subheader: { color: "text.primary" } }}
          />
          <CardContent className="text-xs text-muted" sx={{ pt: 1 }}>
            跨任务共享
          </CardContent>
        </Card>

        {/* 流量交互 */}
        <Card className="gap-1" sx={{ minWidth: 0 }}>
          <CardHeader
            title={
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <ActivityIcon className="size-3" /> 流量交互
              </div>
            }
            subheader={
              <div className="text-2xl font-semibold tabular-nums">{initialLoading ? "—" : traffic.length}</div>
            }
            sx={{ pb: 1 }}
            slotProps={{ subheader: { color: "text.primary" } }}
          />
          <CardContent className="flex items-center gap-1.5 text-xs text-muted" sx={{ pt: 1 }}>
            {settings?.traffic_capture ? (
              <>
                <LiveDot />
                <span>录制中</span>
              </>
            ) : (
              <span>捕获未开启</span>
            )}
          </CardContent>
        </Card>

        {/* LLM 用量 */}
        <Card className="gap-1" sx={{ minWidth: 0 }}>
          <CardHeader
            title={
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <ZapIcon className="size-3" /> Token 用量
              </div>
            }
            subheader={
              <div className="text-2xl font-semibold tabular-nums">
                {initialLoading ? "—" : fmtTokens(displayedTokens.input + displayedTokens.output) || "—"}
              </div>
            }
            sx={{ pb: 1 }}
            slotProps={{ subheader: { color: "text.primary" } }}
          />
          <CardContent className="text-xs text-muted" sx={{ pt: 1 }}>
            入 {fmtTokens(displayedTokens.input)}（含缓存 {fmtTokens(displayedTokens.cacheRead)}）· 出{" "}
            {fmtTokens(displayedTokens.output)}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: LLM Token 消耗 ── */}

      {/* ── Row 3: 活动流 | 发现 ── */}

      {/* ── Row 4: 任务表格 ── */}

      {/* ── Row 5: 资产分布 | 流量状态码 | 拦截 & 待审批 ── */}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card component="section" aria-label="LLM Token 消耗" className="p-4 lg:col-span-2" sx={{ minWidth: 0 }}>
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <ZapIcon className="size-3.5 text-muted" />
              LLM Token 消耗
              {/* 数据源开关：旧版=activity 统计（含历史任务），新版=llm_usage 计量账本（更准，仅覆盖启用后） */}
              <ToggleButtonGroup
                exclusive
                value={tokenVersion}
                onChange={(_, value) => {
                  if (value !== null) setTokenVersion(value);
                }}
                size="small"
                aria-label="Token 统计来源"
              >
                {(
                  [
                    { v: "old", label: "旧版" },
                    { v: "new", label: "新版" },
                  ] as const
                ).map(({ v, label }) => (
                  <ToggleButton
                    key={v}
                    aria-label={
                      v === "new"
                        ? "新版：来自 llm_usage 计量账本，逐次调用精确、含中断消耗；仅覆盖启用后的数据"
                        : "旧版：来自 activity 统计（含历史任务），中断消耗不计、无法精确到模型"
                    }
                    value={v}
                  >
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <span className="text-xs font-normal text-muted">
                {tokenVersion === "new" ? "llm_usage" : "activity"}
              </span>
            </div>
            {/* Profile tabs */}
            <Tabs
              value={tokenTab ?? "all"}
              onChange={(_, value) => setTokenTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="模型 Token 用量"
              sx={{ maxWidth: "100%", minHeight: 40, "& .MuiTab-root": { minHeight: 40, py: 1 } }}
            >
              <Tab value={"all"} label={<span className="inline-flex items-center gap-1">全部</span>} />
              {llmProfiles.map((p) => {
                const key = Number(p.id);
                const hasData = tokenByProfile.has(key) || (p.is_default && tokenByProfile.has(defaultProfileId));
                const resolvedKey = tokenByProfile.has(key) ? key : p.is_default ? defaultProfileId : key;
                return (
                  <Tab
                    key={p.id}
                    value={resolvedKey ?? key}
                    sx={{ opacity: hasData ? 1 : 0.6 }}
                    label={
                      <span className="inline-flex items-center gap-1">
                        {p.name}
                        {p.is_default && (
                          <span
                            className={cn(
                              "rounded px-1 py-0 text-[8px]",
                              tokenTab === resolvedKey
                                ? "bg-background/20 text-background"
                                : "bg-success/20 text-success",
                            )}
                          >
                            默认
                          </span>
                        )}
                      </span>
                    }
                  />
                );
              })}
            </Tabs>
          </div>

          {/* Body: metrics left + bar chart right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
            {/* Left: key metrics */}
            <div className="flex flex-col gap-4">
              {/* Total */}
              <div>
                <div className="text-xs text-muted">合计 (输入+输出)</div>
                <div className="mt-0.5 text-3xl font-bold tabular-nums tracking-tight">
                  {fmtTokens(displayedTokens.input + displayedTokens.output) || "—"}
                </div>
                <div className="mt-0.5 text-xs text-muted">{displayedTokens.taskCount} 个任务</div>
              </div>

              {/* Per-type bars */}
              <div className="space-y-3">
                {(() => {
                  // input 已含缓存；拆成不重叠三段：未命中输入 + 缓存命中 + 输出 = 总量。
                  const total = displayedTokens.input + displayedTokens.output;
                  return [
                    {
                      label: "输入(未命中)",
                      value: displayedTokens.input - displayedTokens.cacheRead,
                      barColor: dailyTrendConfig.input.color!,
                      text: "text-accent",
                    },
                    {
                      label: "缓存命中",
                      value: displayedTokens.cacheRead,
                      barColor: dailyTrendConfig.cacheRead.color!,
                      text: "text-success",
                    },
                    {
                      label: "输出",
                      value: displayedTokens.output,
                      barColor: dailyTrendConfig.output.color!,
                      text: "text-accent",
                    },
                  ].map(({ label, value, barColor, text }) => {
                    const pct = total > 0 ? (value / total) * 100 : 0;
                    return (
                      <div key={label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted">{label}</span>
                          <span className={cn("font-mono font-semibold tabular-nums", text)}>{fmtTokens(value)}</span>
                        </div>
                        <LinearProgress
                          aria-label={`${label}占比`}
                          variant="determinate"
                          value={Math.max(0, Math.min(100, pct))}
                          sx={{ height: 6, borderRadius: 1, "& .MuiLinearProgress-bar": { bgcolor: barColor } }}
                        />
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Cache hit rate */}
              {(() => {
                // input 已含缓存 → 命中率 = 缓存命中 / 总输入。
                const denominator = displayedTokens.input;
                const hitPct = denominator > 0 ? Math.round((displayedTokens.cacheRead / denominator) * 100) : 0;
                return (
                  <div className="flex items-center justify-between rounded-lg border bg-surface-secondary/20 px-3 py-2 text-xs">
                    <span className="text-muted">缓存命中率</span>
                    <span className={cn("font-semibold tabular-nums", hitPct > 50 ? "text-success" : "text-warning")}>
                      {hitPct}%
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Right: daily bar chart */}
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-3 text-xs text-muted">
                  {(["input", "output", "cacheRead"] as const).map((k) => (
                    <span key={k} className="flex items-center gap-1">
                      <span
                        className="inline-block size-2 rounded-sm"
                        style={{ background: dailyTrendConfig[k].color }}
                      />
                      {dailyTrendConfig[k].label}
                    </span>
                  ))}
                </div>
                <ToggleButtonGroup
                  exclusive
                  value={tokenDays}
                  onChange={(_, value) => {
                    if (value !== null) setTokenDays(value);
                  }}
                  size="small"
                  aria-label="Token 统计时间范围"
                >
                  {(
                    [
                      { days: 7, label: "7天" },
                      { days: 30, label: "30天" },
                      { days: 90, label: "3月" },
                      { days: 180, label: "6月" },
                      { days: 365, label: "一年" },
                    ] as const
                  ).map(({ days, label }) => (
                    <ToggleButton key={days} value={days}>
                      {label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </div>

              <div role="img" aria-label={`近 ${tokenDays} 天 Token 使用趋势`}>
                <span className="sr-only">{dailyTokenData.length} 个日期的用量统计</span>
                {dailyTokenData.length === 0 ? (
                  <div
                    className="flex flex-1 items-center justify-center rounded-lg border bg-surface-secondary/10 text-xs text-muted"
                    style={{ minHeight: 180 }}
                  >
                    暂无数据
                  </div>
                ) : (
                  <ChartContainer config={dailyTrendConfig} className="h-[200px] min-w-0 w-full">
                    <BarChart data={dailyTokenData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} maxBarSize={40}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        tickMargin={6}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(v) => fmtTokens(Number(v))}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10 }}
                        width={44}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            formatter={(value, name) => (
                              <div className="flex w-full items-center justify-between gap-4">
                                <span>
                                  {(
                                    dailyTrendConfig as Record<
                                      string,
                                      {
                                        label: string;
                                      }
                                    >
                                  )[String(name)]?.label ?? String(name)}
                                </span>
                                <span className="font-mono font-semibold tabular-nums">{fmtTokens(Number(value))}</span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Bar
                        dataKey="input"
                        stackId="1"
                        fill="var(--color-input)"
                        radius={[0, 0, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="output"
                        stackId="1"
                        fill="var(--color-output)"
                        radius={[0, 0, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="cacheRead"
                        stackId="1"
                        fill="var(--color-cacheRead)"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-4" sx={{ minWidth: 0 }}>
          <SectionTitle icon={ShieldCheckIcon}>系统状态</SectionTitle>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-lg border bg-surface-secondary/20 px-3 py-2">
              <div className="text-xs text-muted">LLM 配置</div>
              <Chip
                className={cn(
                  "text-xs",
                  stats?.llm_configured
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-danger/30 bg-danger/10 text-danger",
                )}
                size="small"
                variant="outlined"
                label={<>{stats?.llm_configured ? "已配置" : "未配置"}</>}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-surface-secondary/20 px-3 py-2">
              <div className="text-xs text-muted">流量捕获</div>
              <Chip
                className={cn(
                  "text-xs",
                  settings?.traffic_capture ? "border-accent/30 bg-accent/10 text-accent" : "text-muted",
                )}
                size="small"
                variant="outlined"
                label={<>{settings?.traffic_capture ? "开启" : "关闭"}</>}
              />
            </div>

            {activeProfile && (
              <div className="flex items-center justify-between rounded-lg border bg-surface-secondary/20 px-3 py-2">
                <div className="text-xs text-muted">激活模型</div>
                <span className="font-mono text-xs">{activeProfile.model}</span>
              </div>
            )}
          </div>

          {/* pending approvals */}
          {pendingCount > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-medium text-warning">待审批 ({pendingCount})</div>
              <div className="flex flex-col gap-1.5">
                {pending.slice(0, 3).map((p) => (
                  <Link
                    key={p.id}
                    to="/system/intercept/approvals"
                    className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-2.5 py-2 hover:bg-warning/10"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{p.tool_name}</div>
                      <div className="text-xs text-muted">{p.agent_name}</div>
                    </div>
                    <ArrowUpRightIcon className="size-3 shrink-0 text-warning" />
                  </Link>
                ))}
                {pendingCount > 3 && (
                  <Link
                    to="/system/intercept/approvals"
                    className="text-center text-xs text-muted hover:text-foreground"
                  >
                    还有 {pendingCount - 3} 条…
                  </Link>
                )}
              </div>
            </div>
          )}

          {pendingCount === 0 && (
            <div className="mt-3 rounded-lg border bg-surface-secondary/10 px-3 py-3 text-center text-xs text-muted">
              <ShieldCheckIcon className="mx-auto mb-1 size-4 text-success/50" />
              无待审批拦截
            </div>
          )}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="p-4" sx={{ minWidth: 0 }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <ActivityIcon className="size-3.5 text-muted" />
              活动流
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{activity.filter((a) => a.kind !== "usage").length} 条事件</span>
              <Link to="/function/tasks" className="flex items-center gap-0.5 text-xs text-muted hover:text-foreground">
                查看任务 <ArrowUpRightIcon className="size-3" />
              </Link>
            </div>
          </div>

          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {(["tool_use", "tool_result", "text", "thinking", "result"] as const).map((kind) => {
              const count = activity.filter((a) => a.kind === kind).length;
              if (count === 0) return null;
              return (
                <span key={kind} className="rounded border bg-surface-secondary/20 px-1.5 py-0.5 text-xs text-muted">
                  {kind} <strong className="text-foreground/70">{count}</strong>
                </span>
              );
            })}
          </div>

          <div className="divide-y">
            {recentActivity.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted">暂无活动记录</div>
            ) : (
              recentActivity.map((a) => (
                <div key={a.seq} className="flex gap-2.5 py-2">
                  <span
                    className={cn(
                      "shrink-0 self-start rounded border px-1.5 py-0.5 font-mono text-xs",
                      workerBg(a.worker),
                    )}
                  >
                    {a.worker}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{kindLabel(a)}</div>
                    <div className="mt-0.5 truncate text-xs text-muted">{a.summary}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Chip
                      className="px-1.5 py-0 text-xs text-muted"
                      size="small"
                      variant="outlined"
                      label={<>{a.kind}</>}
                    />
                    <div className="mt-0.5 text-xs tabular-nums text-muted">{fmtRel(a.ts)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="p-4" sx={{ minWidth: 0 }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <BugIcon className="size-3.5 text-muted" />
              发现
            </div>
            <Link
              to="/function/findings"
              className="flex items-center gap-0.5 text-xs text-muted hover:text-foreground"
            >
              全部 <ArrowUpRightIcon className="size-3" />
            </Link>
          </div>

          <div className="divide-y">
            {recentFindings.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted">暂无发现</div>
            ) : (
              recentFindings.map((f) => (
                <div key={f.id} className="flex items-start gap-2 py-2">
                  <StatusBadge domain="severity" value={f.severity} className="mt-0.5 shrink-0 px-1.5 py-0 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold">{f.vulnclass}</span>
                      {f.task_description && <span className="truncate text-xs text-muted">{f.task_description}</span>}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted">{f.summary}</div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{fmtRel(f.ts)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card className="overflow-hidden p-0 md:col-span-2" sx={{ minWidth: 0 }}>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <ClockIcon className="size-3.5 text-muted" />
              任务
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{tasks.length} 个任务</span>
              <Link to="/function/tasks" className="flex items-center gap-0.5 text-xs text-muted hover:text-foreground">
                全部 <ArrowUpRightIcon className="size-3" />
              </Link>
            </div>
          </div>
          <TableContainer>
            <Table
              className="w-full border-collapse text-xs"
              aria-label="最近任务"
              size="small"
              sx={{ minWidth: 640, "& th": { whiteSpace: "nowrap" } }}
            >
              <TableHead>
                <TableRow>
                  {["任务", "状态", "引擎", "目标进度", "在途", "最近活动"].map((h) => (
                    <TableCell
                      key={h}
                      className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-widest text-muted first:pl-4"
                      id={h}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedTasks.length === 0 ? (
                  <TableRow id="row-36658">
                    <TableCell colSpan={6} className="px-4 py-6 text-center text-xs text-muted">
                      暂无任务
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTasks.map((t) => {
                    const goalsPct = t.goals_total ? Math.round(((t.goals_met ?? 0) / t.goals_total) * 100) : null;
                    return (
                      <TableRow
                        key={t.id}
                        className="border-b last:border-0 transition-colors hover:bg-surface-secondary/30"
                        id={`${t.id}-36971`}
                      >
                        <TableCell className="max-w-xs px-4 py-3">
                          <Link to={`/function/tasks/detail?id=${t.id}`} className="group flex flex-col">
                            <span className="truncate font-medium group-hover:underline">{t.description}</span>
                            <span className="mt-0.5 truncate font-mono text-xs text-muted">{t.id}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <StatusBadge domain="task" value={t.status} dot className="px-1.5 py-0 text-xs" />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <StatusBadge
                            domain="engine"
                            value={t.engine_mode ?? "idle"}
                            className="px-1.5 py-0 text-xs"
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {goalsPct !== null ? (
                            <div className="flex items-center gap-2">
                              <LinearProgress
                                aria-label="进度"
                                variant="determinate"
                                value={Math.max(0, Math.min(100, goalsPct))}
                                sx={{ height: 6, borderRadius: 1, width: 56 }}
                              />
                              <span className="tabular-nums text-muted">
                                {t.goals_met ?? 0}/{t.goals_total}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 tabular-nums">
                          {(t.in_flight ?? 0) > 0 ? (
                            <span className="font-semibold">{t.in_flight}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 tabular-nums text-muted">
                          {fmtRel(t.last_activity_unix ?? t.created_unix)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
        <Card className="p-4" sx={{ minWidth: 0 }}>
          <SectionTitle icon={NetworkIcon} sub="按类型">
            资产分布
          </SectionTitle>

          {assetByType.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">暂无资产数据</div>
          ) : (
            <div className="flex flex-col gap-2">
              {assetByType.map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 text-right text-xs text-muted">{ASSET_TYPE_LABELS[type] ?? type}</span>
                  <LinearProgress
                    aria-label={`${ASSET_TYPE_LABELS[type] ?? type}数量占比`}
                    color={ASSET_COLORS[type] ?? "primary"}
                    variant="determinate"
                    value={Math.max(0, Math.min(100, (count / assetMax) * 100))}
                    sx={{ height: 6, borderRadius: 1, flex: 1 }}
                  />
                  <span className="w-4 text-right tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 border-t pt-3 text-xs text-muted">共 {totalAssets} 节点</div>
        </Card>
        <Card className="p-4" sx={{ minWidth: 0 }}>
          <SectionTitle icon={ActivityIcon} sub={`${traffic.length} 次请求`}>
            流量状态码
          </SectionTitle>

          {/* bar chart */}
          {trafficByCodes.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">暂无流量数据</div>
          ) : (
            <>
              <div className="mb-3 flex items-end gap-2" style={{ height: 52 }}>
                {trafficByCodes.map(({ code, n }) => (
                  <div key={code} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs tabular-nums text-muted">{n}</span>
                    <div
                      className={cn("w-full min-h-1 rounded-sm", statusBg(code), "opacity-80")}
                      style={{ height: Math.max(4, (n / trafficMax) * 36) }}
                    />
                    <span className={cn("text-xs font-mono", statusColor(code))}>{code}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-2.5">
                <div className="mb-1.5 text-xs text-muted">最近请求</div>
                <div className="flex flex-col gap-1.5">
                  {recentTraffic.map((e) => (
                    <div key={e.id} className="flex items-center gap-1.5 text-xs">
                      <span
                        className={cn(
                          "shrink-0 rounded border px-1 py-0 font-mono text-xs",
                          e.method === "GET"
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-accent/30 bg-accent/10 text-accent",
                        )}
                      >
                        {e.method}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {e.host}
                        {e.url.replace(/^https?:\/\/[^/]+/, "").substring(0, 30)}
                      </span>
                      <span className={cn("shrink-0 font-mono text-xs", statusColor(e.status))}>{e.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
