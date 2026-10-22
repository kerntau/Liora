"use client";

import * as React from "react";

import Link from "@/lib/router-compat";
import { usePathname, useRouter, useSearchParams } from "@/lib/router-compat";

import {
  ActivityIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  BrainIcon,
  CalendarDaysIcon,
  CheckIcon,
  CircleAlertIcon,
  PauseIcon,
  PlayIcon,
  TargetIcon,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { MetaItems } from "@/components/app/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TaskLLMProfileChain } from "@/components/task-llm-profile-chain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { PAGE_TITLE_CLASS } from "@/lib/typography";
import type { InterceptApprovalRow, LLMProfile, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AssetsTab } from "./_tabs/assets-tab";
import { BroadcastTab } from "./_tabs/broadcast-tab";
import { CoverageGraphTab } from "./_tabs/coverage-graph-tab";
import { FindingsTab } from "./_tabs/findings-tab";
import { GraphTab } from "./_tabs/graph-tab";
import { InterceptTab } from "./_tabs/intercept-tab";
import { OverviewTab } from "./_tabs/overview-tab";
import { ReportTab } from "./_tabs/report-tab";
import { SessionsTab } from "./_tabs/sessions-tab";

const TABS = [
  { value: "sessions", label: "执行过程" },
  { value: "overview", label: "总览" },
  { value: "graph", label: "探索链路" },
  { value: "broadcast", label: "播报板" },
  { value: "findings", label: "漏洞结果" },
  { value: "assets", label: "测试资产" },
  { value: "coverage", label: "资产覆盖图" },
  { value: "intercept", label: "拦截审批" },
  { value: "report", label: "报告" },
];

const DEFAULT_TAB = "sessions";
const TAB_VALUES = new Set(TABS.map((tab) => tab.value));

// engine_mode 是后端枚举（exploring|paused|stalled|idle）。认不出的值（老数据、
// 新引擎）不能直接当标签渲染，否则会把英文枚举漏到界面上；此时回退到任务状态。
const ENGINE_MODES = new Set(["exploring", "paused", "stalled", "idle"]);

// 非法或缺失的 tab 参数回落到默认页签，手工改 URL 不会渲染出空白内容区。
function normalizeTab(value: string | null) {
  return value && TAB_VALUES.has(value) ? value : DEFAULT_TAB;
}

// pending 列表每 5s 拉一次:内容未变时复用旧数组,避免整页每 5s 白白重渲染。
function samePendingIntercepts(a: InterceptApprovalRow[], b: InterceptApprovalRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row.id === b[index].id);
}

function taskProfileIDs(task: Task): string[] {
  if (task.llm_profile_ids && task.llm_profile_ids.length > 0) {
    return task.llm_profile_ids.map(String);
  }
  return task.llm_profile_id ? [String(task.llm_profile_id)] : [];
}

// 头部只展示到日期的创建时间，避免不同 locale 的格式抖动。
function formatDay(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function TaskLLMControl({ task, profiles, onUpdated }: { task: Task; profiles: LLMProfile[]; onUpdated: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [profileIDs, setProfileIDs] = React.useState<string[]>(() => taskProfileIDs(task));
  const [activeProfileID, setActiveProfileID] = React.useState(
    task.active_llm_profile_id ? String(task.active_llm_profile_id) : (taskProfileIDs(task)[0] ?? ""),
  );
  const [saving, setSaving] = React.useState(false);
  const popoverContentRef = React.useRef<HTMLDivElement>(null);

  const chain = taskProfileIDs(task);
  const exhausted = task.llm_failover_state === "chain_exhausted";
  // 任何状态都可以改链,终态也不例外:任务结束后主 Agent 对话仍走这条链,
  // 链上模型出问题时必须能换掉,否则已完成任务就没法继续交互。
  const terminal = ["done", "failed", "timeout"].includes(task.status);
  // A null active profile on an exhausted, non-empty chain is a persisted end
  // cursor. Keep the status display honest; choosing the first profile is only
  // the editor's reset draft and does not mean it is currently active.
  let activeID = chain[0] ?? "";
  if (exhausted) activeID = "";
  if (task.active_llm_profile_id) activeID = String(task.active_llm_profile_id);
  const activeProfile = profiles.find((profile) => profile.id === activeID);
  const currentLabel = exhausted
    ? "配置链已耗尽"
    : (activeProfile?.name ?? (activeID ? `配置 #${activeID}` : "跟随默认配置"));
  const activeIndex = chain.indexOf(activeID);
  const backupCount = activeIndex >= 0 ? Math.max(0, chain.length - activeIndex - 1) : 0;
  const currentTitle = [currentLabel, activeProfile?.model, backupCount > 0 ? `${backupCount} 个备用` : ""]
    .filter(Boolean)
    .join(" · ");
  let editorDescription = "调整顺序或当前配置后，将从下一次 LLM 调用开始生效。";
  if (terminal) editorDescription = "任务已结束，改动只影响后续的主 Agent 对话。";
  let saveLabel = "保存";
  if (exhausted) saveLabel = "保存并重置";
  if (saving) saveLabel = "保存中";

  const syncDraft = React.useCallback(() => {
    const next = taskProfileIDs(task);
    setProfileIDs(next);
    setActiveProfileID(task.active_llm_profile_id ? String(task.active_llm_profile_id) : (next[0] ?? ""));
  }, [task]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) syncDraft();
  };

  const handleProfileIDsChange = (next: string[]) => {
    setProfileIDs(next);
    setActiveProfileID((current) => (next.includes(current) ? current : (next[0] ?? "")));
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.updateTaskLLMProfiles(
        task.id,
        profileIDs.map(Number),
        activeProfileID ? Number(activeProfileID) : undefined,
      );
      if (result.switch_event) {
        toast.info(result.switch_event.summary, { id: `task-${task.id}-llm-${result.switch_event.seq}` });
      } else {
        toast.success(
          result.reopened_intents > 0
            ? `LLM 配置已更新，并恢复 ${result.reopened_intents} 条额度阻塞意图`
            : "LLM 配置已更新",
        );
      }
      setOpen(false);
      onUpdated();
    } catch (error) {
      toast.error("更新失败：" + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={exhausted ? "destructive" : "outline"}
          aria-label="查看或切换任务 LLM 配置"
          title={currentTitle}
        >
          <BrainIcon data-icon="inline-start" />
          <span className="hidden max-w-36 truncate lg:inline">{currentLabel}</span>
          {backupCount > 0 && <span className="hidden text-muted-foreground xl:inline">+{backupCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverContentRef}
        aria-label="任务 LLM 配置链"
        align="start"
        className="w-[min(28rem,calc(100vw-2rem))] gap-4 p-4"
      >
        <PopoverHeader>
          <PopoverTitle>任务 LLM 配置链</PopoverTitle>
          <PopoverDescription>{editorDescription}</PopoverDescription>
        </PopoverHeader>

        {exhausted && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>配置链额度已耗尽</AlertTitle>
            <AlertDescription>
              {task.llm_failover_reason ?? "所有已选配置均被判定为额度不足。保存配置链可重置故障状态。"}
            </AlertDescription>
          </Alert>
        )}

        <TaskLLMProfileChain
          profiles={profiles}
          value={profileIDs}
          onValueChange={handleProfileIDsChange}
          activeProfileId={activeProfileID}
          onActiveProfileChange={setActiveProfileID}
          inputId="task-llm-profiles"
          disabled={saving}
          portalContainer={popoverContentRef}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            关闭
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving && <Spinner data-icon="inline-start" />}
            {saveLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TaskDetailInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  // 页签记在 URL 上：刷新、从别处回到详情页都停在同一页签，也方便直接分享。
  const tab = normalizeTab(searchParams.get("tab"));
  const [task, setTask] = React.useState<Task | null>(null);
  const [paused, setPaused] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  // 首载失败:404 与其它错误分开,前者才断言「已被删除/归档/不存在」。
  const [loadError, setLoadError] = React.useState<Error | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [controlling, setControlling] = React.useState(false);
  // 待审批拦截由本页统一轮询,再传给执行过程页签,避免两处各轮询一次。
  const [pendingIntercepts, setPendingIntercepts] = React.useState<InterceptApprovalRow[]>([]);
  // The badge counts every pending row; the list itself is capped at 100, so the
  // server total is the number to show when a task has a long approval history.
  const [pendingInterceptTotal, setPendingInterceptTotal] = React.useState(0);
  const [profiles, setProfiles] = React.useState<LLMProfile[]>([]);
  const [archiving, setArchiving] = React.useState(false);

  React.useEffect(() => {
    api
      .llmProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  // id 变化时 usePolling 不会重启定时器，用 ref 丢弃旧任务的迟到响应。
  const idRef = React.useRef(id);
  idRef.current = id;

  const loadPendingIntercepts = React.useCallback(async () => {
    const requestedID = id;
    try {
      // Ask for pending explicitly: the unfiltered endpoint returns the newest 100
      // rows of ANY status, so an older pending approval could fall outside the page.
      const { items, total } = await api.interceptTaskPage(requestedID, 1, 100, { status: "pending" });
      if (idRef.current !== requestedID) return;
      setPendingIntercepts((prev) => (samePendingIntercepts(prev, items) ? prev : items));
      setPendingInterceptTotal(total);
    } catch {
      // Polling is best-effort; the next interval retries automatically.
    }
  }, [id]);

  // 切到另一个任务时立即刷新一次；首轮由 usePolling 的「启用即执行」负责。
  const pendingRefreshedOnce = React.useRef(false);
  React.useEffect(() => {
    if (!pendingRefreshedOnce.current) {
      pendingRefreshedOnce.current = true;
      return;
    }
    void loadPendingIntercepts();
  }, [loadPendingIntercepts]);
  usePolling(loadPendingIntercepts, 5000);

  const taskLoadInFlight = React.useRef<string | null>(null);
  const load = React.useCallback(async () => {
    if (taskLoadInFlight.current === id) return;
    taskLoadInFlight.current = id;
    try {
      const [task, s] = await Promise.all([api.task(id), api.stats(id).catch(() => null)]);
      if (taskLoadInFlight.current !== id) return;
      const base = { ...task };
      const at = s?.active_task;
      if (at) {
        base.in_flight = at.in_flight;
        base.goals_total = at.goals_total;
        base.goals_met = at.goals_met;
        base.engine_mode = s?.engine_mode ?? at.engine_mode;
        base.paused = at.paused;
      }
      setTask(base);
      setPaused(at?.paused ?? base.paused ?? false);
      setLoadError(null);
      setNotFound(false);
    } catch (error: unknown) {
      // 保留上一份任务状态;只有 404 才把任务判为不存在,其余按「加载失败」并可重试。
      if (taskLoadInFlight.current !== id) return;
      const cause = error instanceof Error ? error : new Error(String(error));
      setLoadError(cause);
      setNotFound(cause.message === "task not found");
    } finally {
      if (taskLoadInFlight.current === id) {
        taskLoadInFlight.current = null;
        setLoaded(true);
      }
    }
  }, [id]);

  // 切到另一个任务时立即拉一次；首轮由 usePolling 的「启用即执行」负责。
  const taskRefreshedOnce = React.useRef(false);
  React.useEffect(() => {
    if (!taskRefreshedOnce.current) {
      taskRefreshedOnce.current = true;
      return;
    }
    void load();
  }, [load]);
  usePolling(load, 5000);

  // 切页签用 replace：浏览历史里不该堆满 tab 切换记录，后退仍然回到上一页。
  const selectTab = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      if (next === DEFAULT_TAB) params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  // 优先回到用户来的那一页（任务列表、漏洞结果等），只有直接打开详情链接、没有应用内
  // 历史时才退回任务列表。history.state.idx 由 react-router 维护。
  const goBack = React.useCallback(() => {
    const idx = (window.history.state as { idx?: number | null } | null)?.idx ?? 0;
    if (idx > 0) router.back();
    else router.push("/function/tasks");
  }, [router]);

  async function togglePause() {
    if (controlling) return;
    if (task && ["done", "failed", "timeout"].includes(task.status)) return;
    const next = !paused;
    setControlling(true);
    try {
      await api.controlTask(id, next ? "pause" : "resume");
      setPaused(next);
      toast.success(next ? "已暂停探索" : "已恢复探索");
    } catch (e) {
      toast.error("操作失败：" + (e as Error).message);
    } finally {
      setControlling(false);
    }
  }

  async function archiveTask() {
    if (!task || archiving) return;
    setArchiving(true);
    try {
      await api.archiveTask(task.id);
      toast.success("任务已加入归档队列");
      router.push("/function/tasks");
    } catch (error) {
      toast.error(`归档失败：${(error as Error).message}`);
      setArchiving(false);
    }
  }

  if (!task) {
    const backToList = (
      <Button asChild variant="outline" size="sm">
        <Link href="/function/tasks">
          <ArrowLeftIcon /> 返回任务列表
        </Link>
      </Button>
    );
    if (!loaded) {
      return (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center"
        >
          <Spinner className="size-5 text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">加载中…</p>
        </div>
      );
    }
    // 首载失败先看 loadError:只有后端明确回 404 才断言任务不存在,
    // 其它错误(网络/5xx/超时)按「加载失败」给重试,不能谎报为已删除。
    if (loadError && !notFound) {
      return (
        <div role="alert" className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
            <span className="mx-auto grid size-10 place-items-center rounded-md bg-destructive/10 text-destructive">
              <CircleAlertIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="mt-3 text-[14px] font-semibold text-foreground">任务加载失败</div>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {loadError.message}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={load}>
                重试
              </Button>
              {backToList}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto grid size-10 place-items-center rounded-md bg-surface-muted text-muted-foreground">
            <CircleAlertIcon className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-[13px] leading-6 text-muted-foreground">任务 {id} 已被删除、归档或不存在</p>
          <div className="mt-4 flex justify-center">{backToList}</div>
        </div>
      </div>
    );
  }

  const completed = task.status === "done";
  const lastActivityDate = task.last_activity ? new Date(task.last_activity) : null;
  // 没有（或非法的）最近活动时间时整条省略：只留「最近活动 —」会是一个悬空的破折号。
  const lastActivityAt =
    lastActivityDate && !Number.isNaN(lastActivityDate.getTime())
      ? lastActivityDate.toLocaleTimeString("zh-CN")
      : "";
  const interceptPendingCount = Math.max(pendingInterceptTotal, pendingIntercepts.length);
  const terminal = ["done", "failed", "timeout"].includes(task.status);
  const archiveLifecycleEligible = terminal || paused || task.status === "paused";
  const canArchive = archiveLifecycleEligible && !task.archive_blocked_by_task_id;
  let archiveDisabledReason = task.queued ? "排队中的任务必须先暂停" : "运行中的任务必须先暂停";
  if (archiveLifecycleEligible && task.archive_blocked_by_task_id) {
    archiveDisabledReason = `任务被未归档任务 #${task.archive_blocked_by_task_id} 直接继承，请先归档依赖任务`;
  }
  const engineMode = paused ? "paused" : (task.engine_mode ?? "idle");
  const knownEngineMode = ENGINE_MODES.has(engineMode);
  let controlVariant: "default" | "secondary" | "outline" = "outline";
  let controlIcon = <PauseIcon data-icon="inline-start" />;
  let controlLabel = "暂停";
  if (terminal) {
    controlVariant = "secondary";
    controlIcon = <CheckIcon data-icon="inline-start" />;
    controlLabel = completed ? "已完成" : "已结束";
  } else if (paused) {
    controlVariant = "default";
    controlIcon = <PlayIcon data-icon="inline-start" />;
    controlLabel = "恢复";
  }
  const archiveTrigger = (
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={!canArchive || archiving}
      aria-label={canArchive ? "归档任务" : archiveDisabledReason}
    >
      {archiving ? <Spinner /> : <ArchiveIcon />}
    </Button>
  );

  const useEngineStatus = !terminal && knownEngineMode;
  const statusDomain = useEngineStatus ? "engine" : "task";
  const statusValue = useEngineStatus ? engineMode : (paused ? "paused" : task.status);

  return (
    <Tabs value={tab} onValueChange={selectTab} className="flex flex-col gap-5">
      {/* 头部：左侧返回箭头 + 任务名 + 状态徽章 + ID，右侧操作；页签贴在同一块头部下方。
          全局顶栏已经承载品牌 Logo，这里不再重复一个 logo。 */}
      <header className="border-border/60 border-b">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground -ml-1.5 shrink-0"
              aria-label="返回上一页"
              onClick={goBack}
            >
              <ArrowLeftIcon />
            </Button>
            {/* 标题 + 状态 + 编号作为一个整体：编号不再单独做成带边框的胶囊，
                否则会被读成「被推到右边」的第三个控件。 */}
            <div className="flex min-w-0 items-center gap-2">
              <h1
                className={cn("min-w-0 max-w-[min(100%,36rem)] truncate", PAGE_TITLE_CLASS)}
                title={task.name || task.description}
              >
                {task.name || task.description}
              </h1>
              <StatusBadge domain={statusDomain} value={statusValue} dot className="shrink-0" />
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">#{task.id}</span>
            </div>
            <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
              <TaskLLMControl task={task} profiles={profiles} onUpdated={load} />
              {canArchive ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>{archiveTrigger}</AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>归档任务 #{task.id}？</AlertDialogTitle>
                      <AlertDialogDescription>
                        任务图谱、关联记录、独占资产与流量、工作文件和 LLM
                        历史将压缩到冷存储。归档完成后可在任务列表的“已归档”页还原。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void archiveTask()}>确认归档</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">{archiveTrigger}</span>
                  </TooltipTrigger>
                  <TooltipContent>{archiveDisabledReason}</TooltipContent>
                </Tooltip>
              )}
              <AsyncButton
                size="sm"
                variant={controlVariant}
                loading={controlling}
                onClick={togglePause}
                disabled={terminal}
                className="shrink-0"
              >
                {controlling ? null : controlIcon}
                {controlLabel}
              </AsyncButton>
            </div>
          </div>

          {/* 第二行：目标摘要 + 只读元信息。 */}
          <div className="flex min-w-0 items-center gap-2">
            <TargetIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="shrink-0 text-[12px] text-muted-foreground">目标</span>
            <p className="min-w-0 flex-1 truncate text-[13px] text-foreground/80" title={task.goal || task.description}>
              {task.goal?.trim() || "未填写测试目标"}
            </p>
            <MetaItems
              className="hidden shrink-0 lg:flex"
              items={[
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <CalendarDaysIcon className="size-3" aria-hidden="true" />
                  创建 {formatDay(task.created_at)}
                </span>,
                lastActivityAt ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <ActivityIcon className="size-3" aria-hidden="true" />
                    最近活动 {lastActivityAt}
                  </span>
                ) : null,
              ]}
            />
          </div>

          {/* 第三行：下划线型页签，横向可滚动；角标用浅色胶囊而不是实心色块。 */}
          <div className="no-scrollbar -mb-px flex min-w-0 overflow-x-auto">
            {/* tabs.tsx 的基线里带 dark:bg-muted/50，深色下会在页签条后面铺一条底色，这里压回透明。 */}
            <TabsList variant="line" className="h-10! min-w-max gap-0.5 bg-transparent p-0 dark:bg-transparent">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  // 下划线型页签只要底部指示条，不要选中块的底色（深色下 dark: 变体会盖掉
                  // line 变体的透明背景，出现一块突兀的实心色块）。
                  className="h-10 flex-none gap-1.5 rounded-none px-3 text-[13px] after:bottom-0! data-active:ring-0! dark:data-active:bg-transparent"
                >
                  {t.label}
                  {t.value === "intercept" && interceptPendingCount > 0 && (
                    <span
                      title={`${interceptPendingCount} 条待审批`}
                      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/15 px-1 text-[10px] font-semibold leading-none text-amber-700 tabular-nums dark:text-amber-400"
                    >
                      {interceptPendingCount > 99 ? "99+" : interceptPendingCount}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {/* 角标只有一个数字，读屏把页签念成「拦截审批 3」，数字含义不明。页签的可访问名
              保持不变（e2e 依赖），另外用一个独立实时区说明它，并顺带播报新到的审批请求。 */}
          <span className="sr-only" role="status">
            {interceptPendingCount > 0 ? `拦截审批有 ${interceptPendingCount} 条待处理` : ""}
          </span>
        </div>
      </header>

      {/* 内容区：各页签内部自行使用 SectionCard，容器留白由 MainContent 统一提供。 */}
      <div className="flex min-w-0 flex-col">
        <TabsContent value="sessions" className="mt-0">
          <SessionsTab taskId={id} pendingIntercepts={pendingIntercepts} />
        </TabsContent>
        <TabsContent value="overview" className="mt-0">
          <OverviewTab taskId={id} />
        </TabsContent>
        <TabsContent value="graph" className="mt-0">
          <GraphTab taskId={id} />
        </TabsContent>
        <TabsContent value="broadcast" className="mt-0">
          <BroadcastTab taskId={id} />
        </TabsContent>
        <TabsContent value="findings" className="mt-0">
          <FindingsTab taskId={id} />
        </TabsContent>
        <TabsContent value="assets" className="mt-0">
          <AssetsTab taskId={id} />
        </TabsContent>
        <TabsContent value="coverage" className="mt-0">
          <CoverageGraphTab taskId={id} coverageEnabled={task.coverage_enabled !== false} />
        </TabsContent>
        <TabsContent value="intercept" className="mt-0">
          <InterceptTab taskId={id} />
        </TabsContent>
        <TabsContent value="report" className="mt-0">
          <ReportTab taskId={id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

// useSearchParams must sit under a Suspense boundary for static export.
export default function TaskDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <TaskDetailInner />
    </React.Suspense>
  );
}
