import * as React from "react";

import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArchiveIcon, ArrowLeftIcon, BrainIcon, CheckIcon, CircleAlertIcon, PauseIcon, PlayIcon } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { StatusBadge } from "@/components/status-badge";
import { TaskLLMProfileChain } from "@/components/task-llm-profile-chain";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import type { LLMProfile, Task } from "@/lib/types";

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
function taskProfileIDs(task: Task): string[] {
  if (task.llm_profile_ids && task.llm_profile_ids.length > 0) {
    return task.llm_profile_ids.map(String);
  }
  return task.llm_profile_id ? [String(task.llm_profile_id)] : [];
}
function TaskLLMControl({ task, profiles, onUpdated }: { task: Task; profiles: LLMProfile[]; onUpdated: () => void }) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
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
      setAnchorEl(null);
      onUpdated();
    } catch (error) {
      toast.error("更新失败：" + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Button
        size="small"
        aria-label="查看或切换任务 LLM 配置"
        aria-haspopup="dialog"
        aria-expanded={open}
        color={exhausted ? "error" : "primary"}
        variant="outlined"
        startIcon={<BrainIcon size={16} />}
        title={currentTitle}
        onClick={(event) => {
          syncDraft();
          setAnchorEl(event.currentTarget);
        }}
      >
        <span className="hidden max-w-36 truncate lg:inline">{currentLabel}</span>
        {backupCount > 0 && <span className="hidden text-muted xl:inline">+{backupCount}</span>}
      </Button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack
          role="dialog"
          aria-labelledby="task-llm-heading"
          ref={popoverContentRef}
          spacing={2}
          sx={{ width: 448, maxWidth: "calc(100vw - 32px)", p: 2 }}
        >
          <Box>
            <Typography component="h2" variant="subtitle1" id="task-llm-heading">
              任务 LLM 配置链
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editorDescription}
            </Typography>
          </Box>
          {exhausted && (
            <Alert severity="error" icon={<CircleAlertIcon size={20} />}>
              <AlertTitle>配置链额度已耗尽</AlertTitle>
              {task.llm_failover_reason ?? "所有已选配置均被判定为额度不足。保存配置链可重置故障状态。"}
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
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => setAnchorEl(null)} variant="outlined">
              关闭
            </Button>
            <Button
              size="small"
              onClick={() => void save()}
              disabled={saving}
              variant="contained"
              startIcon={saving ? <CircularProgress size={14} /> : undefined}
            >
              {saveLabel}
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}
function TaskDetailInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [task, setTask] = React.useState<Task | null>(null);
  const [paused, setPaused] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [tab, setTab] = React.useState("sessions");
  const [interceptPendingCount, setInterceptPendingCount] = React.useState(0);
  const [profiles, setProfiles] = React.useState<LLMProfile[]>([]);
  const [archiving, setArchiving] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  React.useEffect(() => {
    api
      .llmProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);
  React.useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .interceptTask(id)
        .then((rows) => {
          if (alive) setInterceptPendingCount(rows.filter((r) => r.status === "pending").length);
        })
        .catch(() => {
          // Polling is best-effort; the next interval retries automatically.
        });
    void load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);
  const taskLoadInFlight = React.useRef<string | null>(null);
  const load = React.useCallback(() => {
    if (taskLoadInFlight.current === id) return;
    taskLoadInFlight.current = id;
    Promise.all([api.task(id), api.stats(id).catch(() => null)])
      .then(([task, s]) => {
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
      })
      .catch(() => {
        // Keep the last rendered task state during a transient poll failure.
      })
      .finally(() => {
        if (taskLoadInFlight.current === id) {
          taskLoadInFlight.current = null;
          setLoaded(true);
        }
      });
  }, [id]);
  React.useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);
  async function togglePause() {
    if (task && ["done", "failed", "timeout"].includes(task.status)) return;
    const next = !paused;
    try {
      await api.controlTask(id, next ? "pause" : "resume");
      setPaused(next);
      toast.success(next ? "已暂停探索" : "已恢复探索");
    } catch (e) {
      toast.error("操作失败：" + (e as Error).message);
    }
  }
  async function archiveTask() {
    if (!task || archiving) return;
    setArchiving(true);
    try {
      await api.archiveTask(task.id);
      toast.success("任务已加入归档队列");
      await navigate("/function/tasks");
    } catch (error) {
      toast.error(`归档失败：${(error as Error).message}`);
      setArchiving(false);
    }
  }
  if (!task) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-muted">{loaded ? `任务 ${id} 已被删除、归档或不存在` : "加载中…"}</p>
        {loaded && (
          <Button
            component={Link}
            to="/function/tasks"
            variant="outlined"
            size="small"
            startIcon={<ArrowLeftIcon size={16} />}
          >
            返回任务列表
          </Button>
        )}
      </div>
    );
  }
  const completed = task.status === "done";
  const terminal = ["done", "failed", "timeout"].includes(task.status);
  const archiveLifecycleEligible = terminal || paused || task.status === "paused";
  const canArchive = archiveLifecycleEligible && !task.archive_blocked_by_task_id;
  let archiveDisabledReason = task.queued ? "排队中的任务必须先暂停" : "运行中的任务必须先暂停";
  if (archiveLifecycleEligible && task.archive_blocked_by_task_id) {
    archiveDisabledReason = `任务被未归档任务 #${task.archive_blocked_by_task_id} 直接继承，请先归档依赖任务`;
  }
  const engineMode = paused ? "paused" : (task.engine_mode ?? "idle");
  let controlVariant: "contained" | "text" | "outlined" = "outlined";
  let controlIcon = <PauseIcon size={16} />;
  let controlLabel = "暂停";
  if (terminal) {
    controlVariant = "text";
    controlIcon = <CheckIcon size={16} />;
    controlLabel = completed ? "已完成" : "已结束";
  } else if (paused) {
    controlVariant = "contained";
    controlIcon = <PlayIcon size={16} />;
    controlLabel = "恢复";
  }
  return (
    <Box sx={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          px: { xs: 2, lg: 3 },
          pt: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
          <SidebarTrigger className="-ml-1" />
          <IconButton component={Link} to="/function/tasks" aria-label="返回任务列表" size="small">
            <ArrowLeftIcon size={18} />
          </IconButton>
          <Typography
            component="h1"
            variant="subtitle1"
            title={task.name || task.description}
            noWrap
            sx={{ flex: 1, minWidth: 80 }}
          >
            {task.name || task.description}
          </Typography>
          <Typography
            component="code"
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", sm: "block" } }}
          >
            {task.id}
          </Typography>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />
          <TaskLLMControl task={task} profiles={profiles} onUpdated={load} />
          <StatusBadge domain={terminal ? "task" : "engine"} value={terminal ? task.status : engineMode} dot />
          <Tooltip title={canArchive ? "归档任务" : archiveDisabledReason}>
            <span className="inline-flex">
              <IconButton
                size="small"
                disabled={!canArchive || archiving}
                aria-label="归档任务"
                onClick={() => setArchiveOpen(true)}
              >
                {archiving ? <CircularProgress size={16} /> : <ArchiveIcon size={18} />}
              </IconButton>
            </span>
          </Tooltip>
          <Button
            size="small"
            onClick={() => void togglePause()}
            disabled={terminal}
            variant={controlVariant}
            startIcon={controlIcon}
          >
            {controlLabel}
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 1 }}>
          {task.goal}
        </Typography>
        <Tabs
          value={tab}
          onChange={(_, value: string) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="任务详情"
          sx={{ mt: 1 }}
        >
          {TABS.map((item) => (
            <Tab
              key={item.value}
              value={item.value}
              id={`task-tab-${item.value}`}
              aria-controls={`task-panel-${item.value}`}
              label={
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.value === "intercept" && interceptPendingCount > 0 && (
                    <Box
                      component="span"
                      sx={{
                        px: 0.75,
                        borderRadius: 1,
                        bgcolor: "warning.main",
                        color: "warning.contrastText",
                        fontSize: 12,
                      }}
                    >
                      {interceptPendingCount > 99 ? "99+" : interceptPendingCount}
                    </Box>
                  )}
                </span>
              }
            />
          ))}
        </Tabs>
      </Box>
      <Box
        role="tabpanel"
        id={`task-panel-${tab}`}
        aria-labelledby={`task-tab-${tab}`}
        sx={{ flex: 1, minWidth: 0, p: { xs: 2, lg: 3 } }}
      >
        {tab === "sessions" && <SessionsTab taskId={id} />}
        {tab === "overview" && <OverviewTab taskId={id} />}
        {tab === "graph" && <GraphTab taskId={id} />}
        {tab === "broadcast" && <BroadcastTab taskId={id} />}
        {tab === "findings" && <FindingsTab taskId={id} />}
        {tab === "assets" && <AssetsTab taskId={id} />}
        {tab === "coverage" && <CoverageGraphTab taskId={id} coverageEnabled={task.coverage_enabled !== false} />}
        {tab === "intercept" && <InterceptTab taskId={id} />}
        {tab === "report" && <ReportTab taskId={id} />}
      </Box>
      <Dialog
        open={archiveOpen}
        onClose={() => {
          if (!archiving) setArchiveOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        aria-labelledby="archive-task-title"
      >
        <DialogTitle id="archive-task-title">归档任务 #{task.id}？</DialogTitle>
        <DialogContent>
          任务图谱、关联记录、独占资产与流量、工作文件和 LLM
          历史将压缩到冷存储。归档完成后可在任务列表的“已归档”页还原。
        </DialogContent>
        <DialogActions>
          <Button disabled={archiving} onClick={() => setArchiveOpen(false)}>
            取消
          </Button>
          <Button disabled={archiving} onClick={() => void archiveTask()} variant="contained">
            {archiving ? "归档中…" : "确认归档"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
export default function TaskDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <TaskDetailInner />
    </React.Suspense>
  );
}
