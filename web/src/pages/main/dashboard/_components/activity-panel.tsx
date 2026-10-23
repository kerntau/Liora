"use client";

import * as React from "react";

import { ActivityIcon, ArrowUpRightIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { breathe } from "@/lib/motion";
import Link from "@/lib/router-compat";
import type { Activity } from "@/lib/types";
import { SECTION_TITLE_CLASS } from "@/lib/typography";
import { cn } from "@/lib/utils";

import { activitySummary, fmtRel } from "./format";

interface ActivityPanelProps {
  activity: Activity[];
  fastReady: boolean;
}

const KIND_META: Record<string, { label: string; dot: string }> = {
  tool_use: { label: "工具调用", dot: "bg-chart-1" },
  tool_result: { label: "工具结果", dot: "bg-chart-2" },
  thinking: { label: "思考", dot: "bg-chart-4" },
  intent: { label: "执行意图", dot: "bg-primary" },
  result: { label: "结果", dot: "bg-chart-2" },
  round: { label: "规划轮次", dot: "bg-chart-5" },
  user: { label: "用户", dot: "bg-muted-foreground/50" },
  text: { label: "文本", dot: "bg-muted-foreground/50" },
  llm_switch: { label: "模型切换", dot: "bg-chart-3" },
  llm_failover: { label: "模型容灾", dot: "bg-chart-3" },
  intercept_request: { label: "审批请求", dot: "bg-destructive" },
};

function kindMeta(a: Activity): { label: string; dot: string } {
  // 未知 kind（后端新增事件类型）不要直接把英文枚举丢到界面上，统一兜底为「事件」。
  const meta = KIND_META[a.kind] ?? { label: "事件", dot: "bg-muted-foreground/50" };
  if (a.kind === "tool_use" && a.tool) return { ...meta, label: a.tool };
  if (a.is_error) return { ...meta, dot: "bg-destructive" };
  return meta;
}

/**
 * 右栏实时执行流：紧凑时间线，最新事件置顶呼吸点，
 * 状态色点区分事件类型，时间戳相对显示。
 *
 * 摘要一律经 activitySummary() 清洗成单行：原始 JSON 只留关键字段
 * （{"assets":null,"count":0} → 「资产 0 条」），完整内容放在 title 里。
 */
export function ActivityPanel({ activity, fastReady }: ActivityPanelProps) {
  const stream = React.useMemo(
    () =>
      [...activity]
        .filter((a) => a.kind !== "usage")
        .sort((a, b) => b.seq - a.seq)
        .slice(0, 12),
    [activity],
  );

  return (
    <Card className="gap-0 p-4" role="region" aria-label="实时执行流">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ActivityIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className={cn("truncate", SECTION_TITLE_CLASS)}>实时执行流</span>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{stream.length} 条</span>
        </div>
        <Link
          prefetch={false}
          href="/function/tasks"
          className="flex shrink-0 items-center gap-0.5 rounded text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          查看任务 <ArrowUpRightIcon className="size-3" aria-hidden="true" />
        </Link>
      </div>

      {stream.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-xs">
          {fastReady ? "暂无活动记录" : <Skeleton className="mx-auto h-4 w-32" />}
        </div>
      ) : (
        <div className="-mr-1 max-h-[236px] overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,black,black_calc(100%_-_24px),transparent)]">
          <ol aria-label="执行事件时间线" className="relative flex flex-col">
            {stream.map((a, index) => {
              const meta = kindMeta(a);
              const latest = index === 0;
              const summary = activitySummary(a.summary);
              return (
                <li key={a.seq} className="relative flex gap-2.5 pb-3 last:pb-0">
                  {/* 时间轴竖线,对齐 6px 色点圆心(3px) */}
                  {index < stream.length - 1 ? (
                    <span aria-hidden="true" className="absolute top-4 bottom-0 left-[2.5px] w-px bg-border/70" />
                  ) : null}
                  {/* 色点统一 6px(size-1.5);呼吸动效仅给最新一条(实时流) */}
                  <span
                    aria-hidden="true"
                    className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", meta.dot, latest && breathe.className)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-medium text-foreground text-xs">{meta.label}</span>
                      <span className="flex shrink-0 items-baseline gap-1.5 text-[11px] text-muted-foreground tabular-nums">
                        {a.worker ? (
                          <span className="max-w-20 truncate font-mono text-muted-foreground/80">{a.worker}</span>
                        ) : null}
                        <span>{fmtRel(a.ts)}</span>
                      </span>
                    </div>
                    <p
                      className="mt-0.5 truncate text-muted-foreground text-xs leading-5"
                      title={a.summary || undefined}
                    >
                      {summary}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}
