"use client";

import { ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SECTION_TITLE_CLASS } from "@/lib/typography";
import Link from "@/lib/router-compat";
import { breathe } from "@/lib/motion";
import type { InterceptPending } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ApprovalPanelProps {
  pending: InterceptPending[];
}

/**
 * 右栏待审批入口：有待审批拦截时高亮置顶显示，点击直达审批页。
 * 系统状态明细（LLM 配置/流量捕获/激活模型）在下方看板的系统状态卡中呈现。
 */
export function ApprovalPanel({ pending }: ApprovalPanelProps) {
  const pendingCount = pending.length;

  return (
    <Card
      role="region"
      aria-label="待审批拦截"
      className={cn(
        "gap-0 p-4",
        pendingCount > 0 && "border-warning/40 bg-[color-mix(in_srgb,var(--warning)_6%,var(--card))]",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ShieldCheckIcon
            className={cn("size-3.5 shrink-0", pendingCount > 0 ? "text-warning" : "text-success")}
            aria-hidden="true"
          />
          <span className={SECTION_TITLE_CLASS}>待审批</span>
        </div>
        {pendingCount > 0 ? (
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-warning/35 bg-warning/10 px-2 text-[11px] text-warning"
          >
            {pendingCount} 条待处理
          </Badge>
        ) : null}
      </div>

      {pendingCount === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
          <ShieldCheckIcon className="size-4 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">无待审批拦截</p>
            <p className="mt-0.5 text-xs text-muted-foreground">所有敏感操作均已放行</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-warning/20">
          {pending.slice(0, 3).map((p, index) => (
            <Link
              key={p.id}
              prefetch={false}
              href="/system/intercept/approvals"
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-1 py-2 transition-colors first:pt-0",
                "hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 shrink-0 rounded-full bg-warning", index === 0 && breathe.className)}
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-foreground">{p.tool_name}</div>
                  {p.agent_name ? (
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{p.agent_name}</div>
                  ) : null}
                </div>
              </div>
              <TriangleAlertIcon className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
            </Link>
          ))}
          <Link
            prefetch={false}
            href="/system/intercept/approvals"
            className="mt-2 rounded text-center text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {pendingCount > 3 ? "前往审批中心处理全部 " + pendingCount + " 条 →" : "前往审批中心 →"}
          </Link>
        </div>
      )}
    </Card>
  );
}
