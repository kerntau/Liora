"use client";

import * as React from "react";

import {
  ActivityIcon,
  AlertTriangleIcon,
  BugIcon,
  CheckIcon,
  ClockIcon,
  CoinsIcon,
  ListChecksIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TargetIcon,
  Trash2Icon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Donut } from "@/components/app/donut";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { fmtTokens } from "@/lib/format";
import { isTaskNotFoundError } from "@/lib/task-not-found";
import type {
  Finding,
  ModelTokenStat,
  Stats,
  Task,
  TaskConstraint,
  TaskGoal,
  TaskNode,
  TaskScopeRow,
} from "@/lib/types";

// engine_mode 是后端枚举；认不出的值（老数据/新引擎）不能直接当标签渲染。
const ENGINE_MODES = ["exploring", "paused", "stalled", "idle"];

// 缓存命中率 = 缓存读 / 输入（InputTokens 已含 cache_read 子集，故比值在 0–100%）。
function cacheHitRate(cacheRead: number, input: number): string {
  if (input <= 0) return "—";
  return Math.round((cacheRead / input) * 100) + "%";
}

// 测试范围一条的显示值：域名 / 网段 / 公司。
function scopeValue(row: TaskScopeRow): string {
  if (row.value) return row.value;
  if (row.domain) return row.domain;
  if (row.net) return row.net;
  if (row.company_id) return row.company_name?.trim() ? row.company_name : `企业 #${row.company_id}`;
  return "—";
}

const SCOPE_KIND_LABELS: Record<TaskScopeRow["kind"], string> = {
  company: "公司",
  root_domain: "根域名",
  subdomain: "子域名",
  ip: "IP",
  cidr: "网段",
  icp: "ICP",
  keyword: "关键词",
};

const SCOPE_SOURCE_LABELS: Record<TaskScopeRow["source"], string> = {
  auto: "自动",
  agent: "Agent",
  manual: "手动",
};

function CountChip({ children }: { children: React.ReactNode }) {
  return <span className="app-chip shrink-0 tabular-nums">{children}</span>;
}

// 关键数字：默认平铺（用于卡片底部的指标条），boxed 用于网格里的独立小卡。
function Metric({
  label,
  value,
  hint,
  tone = "default",
  boxed = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
  boxed?: boolean;
}) {
  let toneClass = "text-foreground";
  if (tone === "primary") toneClass = "text-primary";
  if (tone === "success") toneClass = "text-success";
  if (tone === "warning") toneClass = "text-warning";
  if (tone === "destructive") toneClass = "text-destructive";
  return (
    <div className={boxed ? "min-w-0 rounded-xl border border-border/70 bg-surface-muted/50 p-3" : "min-w-0"}>
      <div className={`text-[18px] leading-7 font-semibold tracking-tight tabular-nums ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {hint ? <div className="text-[11px] text-muted-foreground/80">{hint}</div> : null}
    </div>
  );
}

// 统一的空态：图标 + 标题 + 说明 + 可选动作。
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-surface-muted/40 px-4 py-8 text-center sm:py-10">
      <Icon className="size-7 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  );
}

export function OverviewTab({ taskId }: { taskId: string }) {
  const [task, setTask] = React.useState<Task | null>(null);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [intents, setIntents] = React.useState<TaskNode[]>([]);
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [coverage, setCoverage] = React.useState<{
    enabled: boolean;
    scope_rows: number;
    denominator: number;
    tested: number;
    pct: number | null;
    by_type: { type: string; total: number; tested: number }[];
  } | null>(null);
  // 正在重跑的意图 id（含 "__all__" 表示批量），用于禁用按钮 + 转圈。
  const [rerunning, setRerunning] = React.useState<Set<string>>(new Set());
  // 测试范围列表 + 新增表单状态。
  const [scope, setScope] = React.useState<TaskScopeRow[]>([]);
  const [scopeKind, setScopeKind] = React.useState<TaskScopeRow["kind"]>("root_domain");
  const [scopeValueInput, setScopeValueInput] = React.useState("");
  const [scopeBusy, setScopeBusy] = React.useState(false);
  const [scopeErr, setScopeErr] = React.useState("");
  // 按模型的 token 用量（来自常开的 llm_usage 计量账本，逐次精确）。
  const [modelTokens, setModelTokens] = React.useState<ModelTokenStat[]>([]);
  // 目标管理：目标列表 + 新增表单 + 行内编辑状态。
  const [goals, setGoals] = React.useState<TaskGoal[]>([]);
  const [goalText, setGoalText] = React.useState("");
  const goalInputRef = React.useRef<HTMLInputElement>(null);
  const [goalVuln, setGoalVuln] = React.useState("");
  const [goalBusy, setGoalBusy] = React.useState(false);
  const [goalErr, setGoalErr] = React.useState("");
  const [editingGoalId, setEditingGoalId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState("");
  const [editVuln, setEditVuln] = React.useState("");
  // 约束管理：约束列表 + 新增表单 + 行内编辑状态。
  const [constraints, setConstraints] = React.useState<TaskConstraint[]>([]);
  const [conText, setConText] = React.useState("");
  const conInputRef = React.useRef<HTMLInputElement>(null);
  const [conKind, setConKind] = React.useState<TaskConstraint["kind"]>("deny");
  const [conBusy, setConBusy] = React.useState(false);
  const [conErr, setConErr] = React.useState("");
  const [editingConId, setEditingConId] = React.useState<string | null>(null);
  const [editConText, setEditConText] = React.useState("");
  const [editConKind, setEditConKind] = React.useState<TaskConstraint["kind"]>("deny");
  // 轮询/首载失败要看得见：保留旧值 + 顶部提示 + 手动重试。
  const [loadFailed, setLoadFailed] = React.useState(false);
  // 任务已被删除/归档（findings 404）：显示明确文案，不再报通用「刷新失败」。
  const [notFound, setNotFound] = React.useState(false);
  const [reloadTick, setReloadTick] = React.useState(0);

  const loadTokens = React.useCallback(async () => {
    try {
      const resp = await api.tokensByModel(taskId);
      setModelTokens(resp.models);
    } catch {
      // 忽略：无 PG 时接口报错，卡片自然为空
    }
  }, [taskId]);

  const loadScope = React.useCallback(async () => {
    try {
      const resp = await api.taskScope(taskId);
      setScope(resp.scope);
    } catch {
      // 忽略：无 asset store 时接口 503，范围卡片自然为空
    }
  }, [taskId]);

  const loadGoals = React.useCallback(async () => {
    try {
      const resp = await api.taskGoals(taskId);
      setGoals(resp.goals);
    } catch {
      // 忽略：瞬时错误，下次轮询重试
    }
  }, [taskId]);

  const addGoal = async () => {
    const text = goalText.trim();
    if (!text) return;
    setGoalBusy(true);
    setGoalErr("");
    try {
      await api.addGoal(taskId, text, goalVuln.trim() || undefined);
      setGoalText("");
      setGoalVuln("");
      await loadGoals();
    } catch (e) {
      setGoalErr(e instanceof Error ? e.message : "添加失败");
    } finally {
      setGoalBusy(false);
    }
  };

  const startEditGoal = (g: TaskGoal) => {
    setEditingGoalId(g.id);
    setEditText(g.text);
    setEditVuln(g.vulnclass ?? "");
  };

  const cancelEditGoal = () => {
    setEditingGoalId(null);
    setEditText("");
    setEditVuln("");
  };

  const saveEditGoal = async (g: TaskGoal) => {
    const text = editText.trim();
    if (!text) return;
    setGoalBusy(true);
    setGoalErr("");
    try {
      await api.updateGoal(taskId, g.id, text, editVuln.trim() || undefined);
      cancelEditGoal();
      await loadGoals();
    } catch (e) {
      setGoalErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setGoalBusy(false);
    }
  };

  const removeGoal = async (g: TaskGoal) => {
    setGoals((prev) => prev.filter((x) => x.id !== g.id));
    try {
      await api.deleteGoal(taskId, g.id);
    } catch (e) {
      setGoalErr(e instanceof Error ? e.message : "删除失败，已还原");
      await loadGoals(); // 删除失败：重新拉取还原
    }
  };

  const loadConstraints = React.useCallback(async () => {
    try {
      const resp = await api.taskConstraints(taskId);
      setConstraints(resp.constraints);
    } catch {
      // 忽略：瞬时错误，下次轮询重试
    }
  }, [taskId]);

  const addConstraint = async () => {
    const text = conText.trim();
    if (!text) return;
    setConBusy(true);
    setConErr("");
    try {
      await api.addConstraint(taskId, text, conKind);
      setConText("");
      await loadConstraints();
    } catch (e) {
      setConErr(e instanceof Error ? e.message : "添加失败");
    } finally {
      setConBusy(false);
    }
  };

  const startEditConstraint = (c: TaskConstraint) => {
    setEditingConId(c.id);
    setEditConText(c.text);
    setEditConKind(c.kind);
  };

  const cancelEditConstraint = () => {
    setEditingConId(null);
    setEditConText("");
    setEditConKind("deny");
  };

  const saveEditConstraint = async (c: TaskConstraint) => {
    const text = editConText.trim();
    if (!text) return;
    setConBusy(true);
    setConErr("");
    try {
      await api.updateConstraint(taskId, c.id, text, editConKind);
      cancelEditConstraint();
      await loadConstraints();
    } catch (e) {
      setConErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setConBusy(false);
    }
  };

  const removeConstraint = async (c: TaskConstraint) => {
    setConstraints((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await api.deleteConstraint(taskId, c.id);
    } catch (e) {
      setConErr(e instanceof Error ? e.message : "删除失败，已还原");
      await loadConstraints(); // 删除失败：重新拉取还原
    }
  };

  const addScope = async () => {
    const value = scopeValueInput.trim();
    if (!value) return;
    setScopeBusy(true);
    setScopeErr("");
    try {
      await api.addTaskScope(taskId, scopeKind, value);
      setScopeValueInput("");
      await loadScope();
    } catch (e) {
      setScopeErr(e instanceof Error ? e.message : "添加失败");
    } finally {
      setScopeBusy(false);
    }
  };

  const removeScope = async (row: TaskScopeRow) => {
    setScope((prev) => prev.filter((s) => s.id !== row.id));
    try {
      await api.deleteTaskScope(taskId, row.id);
    } catch (e) {
      setScopeErr(e instanceof Error ? e.message : "删除失败，已还原");
      await loadScope(); // 删除失败：重新拉取还原
    }
  };

  const markRerun = (key: string, on: boolean) =>
    setRerunning((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  // 重跑单条：置回 open（乐观更新本地 state，3s 轮询兜底），worker 会重新认领、从头再跑。
  const rerunOne = async (id: string) => {
    markRerun(id, true);
    try {
      await api.rerunIntent(taskId, id);
      setIntents((prev) => prev.map((i) => (i.id === id ? { ...i, state: "open" } : i)));
    } catch {
      // 失败忽略：下次轮询仍显示 blocked，用户可再点
    } finally {
      markRerun(id, false);
    }
  };

  // 批量重跑本任务全部 blocked。
  const rerunAll = async () => {
    markRerun("__all__", true);
    try {
      await api.rerunBlocked(taskId);
      setIntents((prev) => prev.map((i) => (i.state === "blocked" ? { ...i, state: "open" } : i)));
    } catch {
      // ignore
    } finally {
      markRerun("__all__", false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadTick 仅用于「立即重试」触发重新拉取。
  React.useEffect(() => {
    let cancelled = false;
    let loading = false;

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const [taskResp, statsResp, intentsResp, findingsResp] = await Promise.all([
          api.task(taskId),
          api.stats(taskId),
          api.intents(taskId),
          api.findings(taskId),
        ]);
        if (cancelled) return;
        const activeTask = statsResp.active_task;
        setTask(
          activeTask
            ? {
                ...taskResp,
                in_flight: activeTask.in_flight,
                goals_total: activeTask.goals_total,
                goals_met: activeTask.goals_met,
                engine_mode: statsResp.engine_mode ?? activeTask.engine_mode,
                paused: activeTask.paused,
              }
            : taskResp,
        );
        setStats(statsResp);
        setIntents(intentsResp);
        setFindings(findingsResp);
        setLoadFailed(false);
        setNotFound(false);
        // coverage is independent + may 503 when no asset store — fetch separately so
        // its failure never blocks the others.
        api
          .taskCoverage(taskId)
          .then((c) => {
            if (!cancelled) setCoverage(c);
          })
          .catch(() => {
            // A transient coverage failure is retried by the next poll.
          });
      } catch (error: unknown) {
        // 保留旧值，下一轮自动重试；失败在顶部显式提示，不静默。
        if (cancelled) return;
        if (isTaskNotFoundError(error)) {
          setNotFound(true);
          setLoadFailed(false);
        } else {
          setLoadFailed(true);
        }
      } finally {
        loading = false;
      }
    };

    void load();
    void loadScope();
    void loadTokens();
    void loadGoals();
    void loadConstraints();
    const timer = setInterval(() => {
      void load();
      void loadTokens();
      void loadGoals();
      void loadConstraints();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [taskId, loadScope, loadTokens, loadGoals, loadConstraints, reloadTick]);

  const running = intents.filter((i) => i.state === "running");
  const open = intents.filter((i) => i.state === "open");
  const blocked = intents.filter((i) => i.state === "blocked");
  const taskFindings = findings.filter((f) => f.task_id === taskId);
  const goalsPct = task?.goals_total ? Math.round(((task.goals_met ?? 0) / task.goals_total) * 100) : 0;
  // token 合计（跨全部模型），用于卡片头部总览。
  const tokenTotals = modelTokens.reduce(
    (acc, m) => {
      acc.input += m.input_tokens;
      acc.output += m.output_tokens;
      acc.cacheRead += m.cache_read_tokens;
      acc.cacheWrite += m.cache_write_tokens;
      acc.calls += m.calls;
      return acc;
    },
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 },
  );

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {notFound && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3.5 py-2.5 text-[12px] text-muted-foreground"
        >
          <AlertTriangleIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
          任务不存在或已归档，无法加载总览数据
        </div>
      )}
      {loadFailed && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-warning/25 bg-warning/5 px-3.5 py-2.5 text-[12px] text-muted-foreground"
        >
          <AlertTriangleIcon className="size-4 shrink-0 text-warning" aria-hidden="true" />
          任务数据刷新失败，当前显示上次成功的结果，正在自动重试
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-xs"
            onClick={() => setReloadTick((n) => n + 1)}
          >
            立即重试
          </Button>
        </div>
      )}

      {/* 原始任务描述与目标(创建时填写的),置顶便于随时回看。 */}
      <section role="region" aria-label="任务描述与目标" className="min-w-0">
        <SectionCard icon={TargetIcon} title="任务描述与目标" description="创建任务时填写的背景与验收目标">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-surface-muted/60 p-4">
              <div className="text-[11px] font-medium text-muted-foreground">描述</div>
              <p className="mt-1.5 text-[13px] leading-6 whitespace-pre-wrap break-words">
                {task?.description?.trim() || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface-muted/60 p-4">
              <div className="text-[11px] font-medium text-muted-foreground">目标</div>
              <p className="mt-1.5 text-[13px] leading-6 whitespace-pre-wrap break-words">
                {task?.goal?.trim() || "—"}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-4 sm:grid-cols-4">
            <Metric label="待领意图" value={open.length} hint="frontier 开放" />
            <Metric label="确认发现" value={taskFindings.length} hint="本任务" tone="destructive" />
            <Metric label="意图总数" value={intents.length} hint="本任务全部意图" />
            <Metric
              label="目标达成"
              value={`${task?.goals_met ?? 0}/${task?.goals_total ?? 0}`}
              hint="已达成 / 全部"
              tone={(task?.goals_met ?? 0) > 0 ? "success" : "default"}
            />
          </div>
        </SectionCard>
      </section>

      {/* 主区左：目标与约束（需要编辑的配置）；右：运行态摘要。 */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 lg:gap-5">
          {/* 目标管理：查看/新增/修改/删除本任务的探索目标。新增与修改会通知规划者并复活任务，
              删除仅通知规划者（不复活）。目标 = 最终可交付/可核验的结果，不是攻击步骤或侦察动作。 */}
          <section role="region" aria-label="目标管理" className="min-w-0">
            <SectionCard
              icon={ListChecksIcon}
              title="目标管理"
              description="最终可核验的目标；新增或修改会通知规划者并复活任务"
              actions={<CountChip>{goals.length} 条</CountChip>}
            >
              {/* 新增表单 */}
              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-surface-muted/60 p-3 sm:flex-row sm:items-center">
                <Input
                  ref={goalInputRef}
                  className="h-9 flex-1 bg-card text-[13px]"
                  placeholder="新增目标，如『拿到管理员账号的越权访问』"
                  aria-label="新增目标"
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addGoal();
                  }}
                  disabled={goalBusy}
                />
                <div className="flex items-center gap-2">
                  <Input
                    className="h-9 w-32 bg-card text-[13px]"
                    placeholder="漏洞类(可选)"
                    value={goalVuln}
                    aria-label="新增目标的漏洞类（可选）"
                    onChange={(e) => setGoalVuln(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addGoal();
                    }}
                    disabled={goalBusy}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0"
                    disabled={goalBusy || !goalText.trim()}
                    onClick={() => void addGoal()}
                  >
                    <PlusIcon className="size-3.5" /> 添加
                  </Button>
                </div>
              </div>
              {goalErr && <p className="mb-2 text-[12px] text-destructive">{goalErr}</p>}
              {/* 目标列表 */}
              {goals.length > 0 ? (
                <ul className="overflow-hidden rounded-xl border border-border/70">
                  {goals.map((g) =>
                    editingGoalId === g.id ? (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-surface-muted/60 px-3 py-2.5 last:border-0"
                      >
                        <Input
                          className="h-8 min-w-48 flex-1 bg-card text-[13px]"
                          value={editText}
                          aria-label="编辑目标"
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEditGoal(g);
                            if (e.key === "Escape") cancelEditGoal();
                          }}
                          disabled={goalBusy}
                          autoFocus
                        />
                        <Input
                          className="h-8 w-32 bg-card text-[13px]"
                          placeholder="漏洞类(可选)"
                          value={editVuln}
                          aria-label="编辑目标的漏洞类（可选）"
                          onChange={(e) => setEditVuln(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEditGoal(g);
                            if (e.key === "Escape") cancelEditGoal();
                          }}
                          disabled={goalBusy}
                        />
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={goalBusy || !editText.trim()}
                            onClick={() => void saveEditGoal(g)}
                            aria-label="保存目标"
                          >
                            <CheckIcon className="size-4 text-success" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={goalBusy}
                            onClick={cancelEditGoal}
                            aria-label="取消编辑目标"
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={g.id}
                        className="flex items-start gap-2.5 border-b border-border/70 px-3 py-2.5 last:border-0"
                      >
                        <StatusBadge domain="goal" value={g.state} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1 text-[13px] leading-6 break-words">{g.text}</span>
                        {g.vulnclass && (
                          <span className="app-chip mt-0.5 shrink-0 px-2 py-0.5 text-[11px]">{g.vulnclass}</span>
                        )}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            disabled={goalBusy}
                            onClick={() => startEditGoal(g)}
                            aria-label="编辑目标"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={goalBusy}
                            onClick={() => void removeGoal(g)}
                            aria-label="删除目标"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <EmptyState
                  icon={TargetIcon}
                  title="还没有目标"
                  description="目标决定规划者派发哪些探索意图。先添加一条可核验的结果目标。"
                  action={
                    <Button size="sm" variant="outline" onClick={() => goalInputRef.current?.focus()}>
                      <PlusIcon className="size-3.5" /> 添加第一条目标
                    </Button>
                  }
                />
              )}
            </SectionCard>
          </section>

          {/* 操作约束管理：allow=允许 / deny=禁止。约束会在下一轮规划时注入 planner/worker 的系统
              提示以框定探索边界（注入范围可在 系统设置 里按 planner/worker 开关）。改动不即时打断，
              下一轮规划自然读到。 */}
          <section role="region" aria-label="操作约束" className="min-w-0">
            <SectionCard
              icon={ShieldAlertIcon}
              title="操作约束"
              description="框定 planner / worker 的探索边界，改动下一轮规划生效"
              actions={<CountChip>{constraints.length} 条</CountChip>}
            >
              {/* 新增表单 */}
              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-surface-muted/60 p-3 sm:flex-row sm:items-center">
                <NativeSelect
                  size="sm"
                  value={conKind}
                  aria-label="新增操作约束类型"
                  onChange={(e) => setConKind(e.target.value as TaskConstraint["kind"])}
                  className="shrink-0"
                >
                  <NativeSelectOption value="deny">禁止</NativeSelectOption>
                  <NativeSelectOption value="allow">允许</NativeSelectOption>
                </NativeSelect>
                <Input
                  ref={conInputRef}
                  className="h-9 flex-1 bg-card text-[13px]"
                  placeholder="一条操作约束，如『仅测当前端口，不扫其他端口』"
                  value={conText}
                  aria-label="新增操作约束"
                  onChange={(e) => setConText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addConstraint();
                  }}
                  disabled={conBusy}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0"
                  disabled={conBusy || !conText.trim()}
                  onClick={() => void addConstraint()}
                >
                  <PlusIcon className="size-3.5" /> 添加
                </Button>
              </div>
              {conErr && <p className="mb-2 text-[12px] text-destructive">{conErr}</p>}
              {/* 约束列表 */}
              {constraints.length > 0 ? (
                <ul className="overflow-hidden rounded-xl border border-border/70">
                  {constraints.map((c) =>
                    editingConId === c.id ? (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-surface-muted/60 px-3 py-2.5 last:border-0"
                      >
                        <NativeSelect
                          size="sm"
                          value={editConKind}
                          aria-label="编辑操作约束类型"
                          onChange={(e) => setEditConKind(e.target.value as TaskConstraint["kind"])}
                          className="shrink-0"
                        >
                          <NativeSelectOption value="deny">禁止</NativeSelectOption>
                          <NativeSelectOption value="allow">允许</NativeSelectOption>
                        </NativeSelect>
                        <Input
                          className="h-8 min-w-48 flex-1 bg-card text-[13px]"
                          value={editConText}
                          aria-label="编辑操作约束"
                          onChange={(e) => setEditConText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEditConstraint(c);
                            if (e.key === "Escape") cancelEditConstraint();
                          }}
                          disabled={conBusy}
                          autoFocus
                        />
                        <div className="ml-auto flex shrink-0 items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={conBusy || !editConText.trim()}
                            onClick={() => void saveEditConstraint(c)}
                            aria-label="保存操作约束"
                          >
                            <CheckIcon className="size-4 text-success" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={conBusy}
                            onClick={cancelEditConstraint}
                            aria-label="取消编辑操作约束"
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ) : (
                      <li
                        key={c.id}
                        className="flex items-start gap-2.5 border-b border-border/70 px-3 py-2.5 last:border-0"
                      >
                        <span
                          className={
                            c.kind === "allow"
                              ? "mt-0.5 inline-flex shrink-0 items-center rounded-md border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success"
                              : "mt-0.5 inline-flex shrink-0 items-center rounded-md border border-destructive/20 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
                          }
                        >
                          {c.kind === "allow" ? "允许" : "禁止"}
                        </span>
                        <span className="min-w-0 flex-1 text-[13px] leading-6 break-words">{c.text}</span>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            disabled={conBusy}
                            onClick={() => startEditConstraint(c)}
                            aria-label="编辑操作约束"
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={conBusy}
                            onClick={() => void removeConstraint(c)}
                            aria-label="删除操作约束"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <EmptyState
                  icon={ShieldAlertIcon}
                  title="暂无操作约束"
                  description="建任务时会自动从描述/目标抽取；也可在此手动增删改，用来框定「允许/禁止做哪些操作」。"
                  action={
                    <Button size="sm" variant="outline" onClick={() => conInputRef.current?.focus()}>
                      <PlusIcon className="size-3.5" /> 添加第一条约束
                    </Button>
                  }
                />
              )}
            </SectionCard>
          </section>
        </div>

        {/* 右栏：运行态摘要，窄屏时排到目标/约束之后。 */}
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
          <SectionCard
            icon={ActivityIcon}
            title="运行心跳"
            actions={
              // 认不出的 engine_mode（老数据/新引擎）不渲染徽章，避免把英文枚举漏到界面上。
              ENGINE_MODES.includes(stats?.engine_mode ?? task?.engine_mode ?? "idle") ? (
                <StatusBadge domain="engine" value={stats?.engine_mode ?? task?.engine_mode ?? "idle"} dot />
              ) : null
            }
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              <div>
                <dt className="text-[12px] text-muted-foreground">运行中 Worker</dt>
                <dd className="mt-0.5 text-[18px] leading-7 font-semibold tabular-nums">{running.length}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted-foreground">最近活动</dt>
                <dd className="mt-1 inline-flex items-center gap-1 text-[13px] tabular-nums">
                  <ClockIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  {task?.last_activity ? new Date(task.last_activity).toLocaleTimeString("zh-CN") : "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>目标进度</span>
                  <span className="font-medium text-foreground/80 tabular-nums">
                    {task?.goals_met ?? 0}/{task?.goals_total ?? 0}
                  </span>
                </dt>
                <dd className="mt-1.5">
                  <Progress value={goalsPct} />
                </dd>
              </div>
              {task?.completed_unix && task.completed_unix > 0 ? (
                <div className="col-span-2 flex items-center justify-between border-t border-border/70 pt-3">
                  <dt className="text-[12px] text-muted-foreground">完成时间</dt>
                  <dd className="inline-flex items-center gap-1 text-[12px] tabular-nums">
                    <ClockIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {new Date(task.completed_unix * 1000).toLocaleString("zh-CN")}
                  </dd>
                </div>
              ) : null}
            </dl>
          </SectionCard>

          {coverage && coverage.enabled && coverage.scope_rows > 0 && (
            <SectionCard
              icon={TargetIcon}
              title="资产测试覆盖度"
              description="粗估，仅供参考"
              actions={<span className="app-chip tabular-nums">已测 {coverage.tested}/{coverage.denominator}</span>}
            >
              <div className="flex items-center gap-4">
                <Donut
                  value={coverage.pct != null ? Math.round(coverage.pct * 100) : 0}
                  size={88}
                  stroke={8}
                  color="var(--primary)"
                  label={coverage.pct != null ? undefined : "—"}
                  caption="覆盖"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {coverage.by_type.length > 0 ? (
                    coverage.by_type.map((b) => (
                      <div key={b.type} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate text-muted-foreground">{b.type}</span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {b.tested}/{b.total}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-muted-foreground">尚无分类型覆盖数据</p>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard icon={AlertTriangleIcon} title="需要关注">
            <div className="grid grid-cols-2 gap-3">
              <Metric boxed label="确认漏洞" value={taskFindings.length} tone="destructive" />
              <Metric boxed label="执行中" value={running.length} tone="primary" />
              <Metric boxed label="frontier 待领" value={open.length} />
              <Metric boxed label="被拦意图" value={blocked.length} tone="destructive" />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* LLM Token 用量：按模型分组，数据来自 llm_records（需开启 LLM 录制）。 */}
      <SectionCard
        icon={CoinsIcon}
        title="LLM Token 用量"
        description={`按模型统计${tokenTotals.calls > 0 ? ` · 共 ${tokenTotals.calls} 次调用` : ""}`}
      >
        {modelTokens.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric boxed label="输入" value={fmtTokens(tokenTotals.input)} />
              <Metric boxed label="输出" value={fmtTokens(tokenTotals.output)} />
              <Metric boxed label="缓存读" value={fmtTokens(tokenTotals.cacheRead)} />
              <Metric
                boxed
                label="缓存命中率"
                value={cacheHitRate(tokenTotals.cacheRead, tokenTotals.input)}
                tone="success"
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-border/70">
              <Table aria-label="按模型 Token 用量">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-3">模型</TableHead>
                    <TableHead className="text-right">调用</TableHead>
                    <TableHead className="text-right">输入</TableHead>
                    <TableHead className="text-right">输出</TableHead>
                    <TableHead className="text-right">缓存读</TableHead>
                    <TableHead className="pr-3 text-right">命中率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelTokens.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell className="max-w-[18rem] truncate pl-3 font-mono text-[12px]" title={m.model}>
                        {m.model}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m.calls}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtTokens(m.input_tokens)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtTokens(m.output_tokens)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtTokens(m.cache_read_tokens)}</TableCell>
                      <TableCell className="pr-3 text-right font-medium text-success tabular-nums">
                        {cacheHitRate(m.cache_read_tokens, m.input_tokens)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={CoinsIcon}
            title="暂无 LLM 用量"
            description="任务尚未产生调用，或记录仍在写入。"
          />
        )}
      </SectionCard>

      {/* 测试范围：覆盖度分母 + 授权边界，可手动增删。 */}
      <section role="region" aria-label="测试范围" className="min-w-0">
        <SectionCard
          icon={ShieldCheckIcon}
          title="测试范围"
          description="覆盖度分母与授权边界，可手动增删"
          actions={<CountChip>{scope.length} 条</CountChip>}
          footer={
            scope.length > 10 ? (
              <span className="text-[11px] text-muted-foreground">共 {scope.length} 条 · 列表可滚动查看全部</span>
            ) : undefined
          }
        >
          {/* 新增表单 */}
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-surface-muted/60 p-3 sm:flex-row sm:items-center">
            <NativeSelect
              size="sm"
              value={scopeKind}
              aria-label="范围类型"
              onChange={(e) => setScopeKind(e.target.value as TaskScopeRow["kind"])}
              className="shrink-0"
            >
              <NativeSelectOption value="root_domain">根域名</NativeSelectOption>
              <NativeSelectOption value="subdomain">子域名</NativeSelectOption>
              <NativeSelectOption value="ip">IP</NativeSelectOption>
              <NativeSelectOption value="cidr">网段</NativeSelectOption>
              <NativeSelectOption value="icp">ICP</NativeSelectOption>
              <NativeSelectOption value="keyword">关键词</NativeSelectOption>
              <NativeSelectOption value="company">公司</NativeSelectOption>
            </NativeSelect>
            <Input
              className="h-9 flex-1 bg-card text-[13px]"
              placeholder={
                scopeKind === "company"
                  ? "公司名或 id"
                  : scopeKind === "ip" || scopeKind === "cidr"
                    ? "如 10.0.0.1 或 10.0.0.0/24"
                    : scopeKind === "icp"
                      ? "如 京ICP备12345678号-1"
                      : scopeKind === "keyword"
                        ? "如 企业名称关键词"
                        : "如 example.com"
              }
              value={scopeValueInput}
              aria-label="范围值"
              onChange={(e) => setScopeValueInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addScope();
              }}
              disabled={scopeBusy}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0"
              disabled={scopeBusy || !scopeValueInput.trim()}
              onClick={() => void addScope()}
            >
              <PlusIcon className="size-3.5" /> 添加
            </Button>
          </div>
          {scopeErr && <p className="mb-2 text-[12px] text-destructive">{scopeErr}</p>}
          {/* 范围列表 */}
          {scope.length > 0 ? (
            <ul className="max-h-[400px] overflow-x-hidden overflow-y-auto rounded-xl border border-border/70">
              {scope.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2.5 border-b border-border/70 px-3 py-2 last:border-0"
                >
                  <span className="inline-flex shrink-0 items-center rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {SCOPE_KIND_LABELS[row.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={scopeValue(row)}>
                    {scopeValue(row)}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {SCOPE_SOURCE_LABELS[row.source]}
                  </span>
                  {String(row.task_id ?? "") === taskId ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => void removeScope(row)}
                      aria-label="删除测试范围"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  ) : (
                    <span className="w-8 shrink-0 text-center text-[11px] text-muted-foreground">继承</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={ShieldCheckIcon}
              title="暂无测试范围"
              description="添加后可作为资产覆盖度的分母，也用于框定授权边界。"
            />
          )}
        </SectionCard>
      </section>

      {/* Work set */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <SectionCard icon={TargetIcon} title="进行中意图" actions={<CountChip>{running.length}</CountChip>}>
          {running.length > 0 ? (
            <ul className="overflow-hidden rounded-xl border border-border/70">
              {running.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center gap-2 border-b border-border/70 px-3 py-2 last:border-0">
                  <StatusBadge domain="intent" value={i.state} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{i.payload}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={TargetIcon}
              title="暂无进行中意图"
              description="任务开始探索后，这里会显示正在执行的意图。"
            />
          )}
        </SectionCard>

        <SectionCard icon={BugIcon} title="最近发现" actions={<CountChip>{taskFindings.length}</CountChip>}>
          {taskFindings.length > 0 ? (
            <ul className="overflow-hidden rounded-xl border border-border/70">
              {taskFindings.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center gap-2 border-b border-border/70 px-3 py-2 last:border-0">
                  <StatusBadge domain="severity" value={f.severity} dot className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{f.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={BugIcon} title="暂无发现" description="验证成功的漏洞会先汇总到这里。" />
          )}
        </SectionCard>
      </div>

      {/* Blocked intents — 出错/被拦(如 LLM 网络问题)的意图，可一键重跑：置回 open，
          worker 会重新认领、从头再跑（已写回图谱的数据保留）；任务若已终态/暂停会自动复活。 */}
      {blocked.length > 0 && (
        <SectionCard
          icon={AlertTriangleIcon}
          title="被拦 / 出错意图"
          description={`共 ${blocked.length} 条，可重跑；重跑会置回待领，已写回图谱的数据保留`}
          actions={
            <Button size="sm" variant="outline" disabled={rerunning.has("__all__")} onClick={() => void rerunAll()}>
              <RefreshCwIcon className={`size-3.5 ${rerunning.has("__all__") ? "animate-spin" : ""}`} />
              全部重跑
            </Button>
          }
          className="border-destructive/25"
        >
          <ul className="overflow-hidden rounded-xl border border-border/70">
            {blocked.slice(0, 20).map((i) => (
              <li key={i.id} className="flex items-center gap-2 border-b border-border/70 px-3 py-2 last:border-0">
                <StatusBadge domain="intent" value={i.state} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{i.payload}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-xs"
                  disabled={rerunning.has(i.id)}
                  onClick={() => void rerunOne(i.id)}
                >
                  <RefreshCwIcon className={`size-3 ${rerunning.has(i.id) ? "animate-spin" : ""}`} />
                  重跑
                </Button>
              </li>
            ))}
          </ul>
          {blocked.length > 20 && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              仅显示前 20 条，点「全部重跑」处理剩余 {blocked.length - 20} 条。
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
}