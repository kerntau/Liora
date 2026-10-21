"use client";

import * as React from "react";

import { ActivityIcon, ArrowUpRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "@/lib/router-compat";
import type { Activity } from "@/lib/types";
import { cn } from "@/lib/utils";

import { fmtRel } from "./format";

interface ActivityPanelProps {
  activity: Activity[];
  fastReady: boolean;
}

export function ActivityPanel({ activity, fastReady }: ActivityPanelProps) {
  const recentActivity = React.useMemo(
    () =>
      [...activity]
        .filter((a) => a.kind !== "usage")
        .sort((a, b) => b.seq - a.seq)
        .slice(0, 6),
    [activity],
  );

  function kindLabel(a: Activity): string {
    if (a.kind === "tool_use") return a.tool ?? "tool_use";
    if (a.kind === "tool_result") return "tool_result";
    return a.kind;
  }

  function workerBg(w: string): string {
    if (w === "planner") return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    if (w === "mainagent") return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <ActivityIcon className="size-3.5 text-muted-foreground" />
          活动流
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {activity.filter((a) => a.kind !== "usage").length} 条事件
          </span>
          <Link
            href="/function/tasks"
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            查看任务 <ArrowUpRightIcon className="size-3" />
          </Link>
        </div>
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {(["tool_use", "tool_result", "text", "thinking", "result"] as const).map((kind) => {
          const count = activity.filter((a) => a.kind === kind).length;
          if (count === 0) return null;
          return (
            <span key={kind} className="rounded border bg-muted/20 px-1.5 py-0.5 text-[9px] text-muted-foreground">
              {kind} <strong className="text-foreground/70">{count}</strong>
            </span>
          );
        })}
      </div>

      <div className="divide-y">
        {recentActivity.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {fastReady ? "暂无活动记录" : <Skeleton className="mx-auto h-4 w-32" />}
          </div>
        ) : (
          recentActivity.map((a) => (
            <div key={a.seq} className="flex gap-2.5 py-2">
              <span
                className={cn(
                  "shrink-0 self-start rounded border px-1.5 py-0.5 font-mono text-[9px]",
                  workerBg(a.worker),
                )}
              >
                {a.worker}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium">{kindLabel(a)}</div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{a.summary}</div>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant="outline" className="px-1.5 py-0 text-[9px] text-muted-foreground">
                  {a.kind}
                </Badge>
                <div className="mt-0.5 text-[9px] tabular-nums text-muted-foreground">{fmtRel(a.ts)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
