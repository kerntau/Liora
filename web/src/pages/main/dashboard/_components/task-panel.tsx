"use client";

import * as React from "react";

import Link from "@/lib/router-compat";

import { ArrowRightIcon, ListChecksIcon, PlayCircleIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { SectionCard } from "@/components/app/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { breathe } from "@/lib/motion";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import { formatClock, runSeconds, sortTasksByActivity, taskProgress } from "./console/helpers";

/**
 * 活跃任务列表：按「活跃优先 + 最近活动」排序，运行中的任务带呼吸点与进度条。
 * 只展示与跳转，任务操作（暂停/继续）集中在指挥台大屏上。
 */
export function ActiveTasksCard({
  tasks,
  tasksReady,
  selectedId,
  onSelect,
}: {
  tasks: Task[];
  tasksReady: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const rows = React.useMemo(() => sortTasksByActivity(tasks).slice(0, 6), [tasks]);

  return (
    <SectionCard
      icon={ListChecksIcon}
      title="活跃任务"
      description="按活跃度排序，点击行切换指挥台聚焦"
      className="min-w-0 self-start"
      actions={
        <Link
          prefetch={false}
          href="/function/tasks"
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          全部任务 <ArrowRightIcon className="size-3" aria-hidden="true" />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          {tasksReady ? (
            <>
              <p className="text-[13px] font-medium text-foreground">暂无任务</p>
              <p className="text-xs text-muted-foreground">新建任务后会出现在这里。</p>
            </>
          ) : (
            <Skeleton className="h-5 w-40" />
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((task) => {
            const running = task.status === "running";
            const progress = taskProgress(task, null);
            const selected = task.id === selectedId;
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onSelect(task.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                    selected
                      ? "bg-accent/60 ring-1 ring-primary/20 ring-inset"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      running
                        ? cn("bg-success", breathe.className)
                        : task.status === "paused"
                          ? "bg-warning"
                          : "bg-muted-foreground/35",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {task.name || task.description || "任务 #" + task.id}
                      </span>
                      <StatusBadge
                        domain="task"
                        value={task.status}
                        className="shrink-0 px-1.5 py-0 text-[11px]"
                      />
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            "block h-full rounded-full transition-[width] duration-700",
                            running
                              ? "bg-primary"
                              : task.status === "done"
                                ? "bg-success"
                                : "bg-warning",
                          )}
                          style={{ width: (progress > 0 ? Math.max(progress, 2) : 0) + "%" }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                        {progress}%
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center justify-end gap-3 text-[11px] text-muted-foreground sm:w-40">
                    {task.goals_total ? (
                      <span className="tabular-nums">
                        {task.goals_met ?? 0}/{task.goals_total} 目标
                      </span>
                    ) : null}
                    <span className="hidden font-mono tabular-nums sm:inline">
                      {formatClock(runSeconds(task, Math.floor(Date.now() / 1000)))}
                    </span>
                    <PlayCircleIcon
                      className={cn("size-3.5", selected ? "text-primary" : "text-muted-foreground/40")}
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
