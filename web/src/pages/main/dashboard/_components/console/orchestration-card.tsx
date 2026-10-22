"use client";

import Link from "@/lib/router-compat";

import {
  ArrowRightIcon,
  BadgeCheckIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  RadarIcon,
  RotateCcwIcon,
  WorkflowIcon,
} from "lucide-react";

import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import { stageIndex, STAGES } from "./helpers";

// 阶段只区分图标；配色交给「当前阶段」一处强调，其余保持中性（强调色只用于当前选中）。
const STAGE_ICONS = {
  plan: ClipboardListIcon,
  explore: RadarIcon,
  test: FlaskConicalIcon,
  verify: BadgeCheckIcon,
} as const;

export function OrchestrationCard({
  task,
  assets,
  findings,
  verified,
  goals,
  scopeRows,
  coveragePct,
}: {
  task: Task | null;
  assets: number;
  findings: number;
  verified: number;
  goals: number;
  scopeRows: number;
  coveragePct: number | null;
}) {
  const active = stageIndex(task);
  const metrics = [
    { primary: goals + " 个目标", secondary: scopeRows + " 条范围" },
    { primary: assets + " 个资产", secondary: "攻击面分析" },
    { primary: findings + " 个发现", secondary: verified + " 个已确认" },
    { primary: (coveragePct ?? 0) + "% 覆盖", secondary: "结果与影响" },
  ];

  return (
    <SectionCard
      icon={WorkflowIcon}
      title="Agent 智能编排"
      description="多 Agent 协同，自动化完成渗透测试全流程"
      className="h-full min-w-0"
      actions={
        task ? (
          <Button asChild size="sm" variant="outline">
            <Link prefetch={false} href={"/function/tasks/detail?id=" + task.id + "&tab=graph"}>
              查看任务图
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-2 xl:flex xl:flex-row xl:items-stretch">
        {STAGES.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.key];
          const isActive = index === active;
          const body = (
            <div
              className={cn(
                "group relative flex h-full min-h-[96px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all",
                isActive
                  ? "border-primary/30 bg-primary/[0.06] ring-2 ring-primary/25 ring-offset-2 ring-offset-card"
                  : "border-border/60 bg-muted/30 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-md bg-card shadow-sm",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-[13px] leading-5 font-semibold text-foreground">{stage.label}</span>
              <span className="text-xs leading-5 text-muted-foreground">{stage.caption}</span>
              <span className="mt-0.5 text-xs leading-5 font-medium text-foreground/80 tabular-nums">
                {metrics[index].primary}
              </span>
              <span className="truncate text-xs leading-4 text-muted-foreground/80">{metrics[index].secondary}</span>
              {isActive ? (
                <span className="absolute top-2 right-2 flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                  进行中
                </span>
              ) : null}
            </div>
          );

          return (
            <div key={stage.key} className="flex min-w-0 flex-1 items-center gap-2">
              {task ? (
                <Link
                  prefetch={false}
                  href={"/function/tasks/detail?id=" + task.id + "&tab=" + stage.tab}
                  className="min-w-0 flex-1 self-stretch rounded-lg focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                  aria-label={"查看" + stage.label + "阶段"}
                >
                  {body}
                </Link>
              ) : (
                <div className="min-w-0 flex-1 self-stretch">{body}</div>
              )}
              {index < STAGES.length - 1 ? (
                <ArrowRightIcon className="hidden size-4 shrink-0 text-muted-foreground/35 xl:block" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: ((active + 1) / STAGES.length) * 100 + "%" }}
          />
        </div>
        <span className="shrink-0 tabular-nums">阶段 {active + 1}/4</span>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <RotateCcwIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">基于结果的动态调整</span>
        <span className="ml-auto hidden shrink-0 items-center gap-1.5 sm:flex">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          当前：{STAGES[active].label}
        </span>
      </div>
    </SectionCard>
  );
}
