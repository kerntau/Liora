"use client";

import { ArrowUpRightIcon, ShieldCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "@/lib/router-compat";
import type { InterceptPending, LLMProfile, Settings, Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SectionTitle } from "./shared";

interface ApprovalPanelProps {
  stats: Stats | null;
  settings: Settings | null;
  activeProfile: LLMProfile | undefined;
  pending: InterceptPending[];
}

export function ApprovalPanel({ stats, settings, activeProfile, pending }: ApprovalPanelProps) {
  const pendingCount = pending.length;

  return (
    <Card className="p-4">
      <SectionTitle icon={ShieldCheckIcon}>系统状态</SectionTitle>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">LLM 配置</div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              stats?.llm_configured
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-400",
            )}
          >
            {stats?.llm_configured ? "已配置" : "未配置"}
          </Badge>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">流量捕获</div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              settings?.traffic_capture
                ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                : "text-muted-foreground",
            )}
          >
            {settings?.traffic_capture ? "开启" : "关闭"}
          </Badge>
        </div>

        {activeProfile && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">激活模型</div>
            <span className="font-mono text-[10px]">{activeProfile.model}</span>
          </div>
        )}
      </div>

      {/* pending approvals */}
      {pendingCount > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-medium text-amber-400">待审批 ({pendingCount})</div>
          <div className="flex flex-col gap-1.5">
            {pending.slice(0, 3).map((p) => (
              <Link
                key={p.id}
                href="/system/intercept/approvals"
                className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 hover:bg-amber-500/10"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-medium">{p.tool_name}</div>
                  <div className="text-[9px] text-muted-foreground">{p.agent_name}</div>
                </div>
                <ArrowUpRightIcon className="size-3 shrink-0 text-amber-400" />
              </Link>
            ))}
            {pendingCount > 3 && (
              <Link
                href="/system/intercept/approvals"
                className="text-center text-[10px] text-muted-foreground hover:text-foreground"
              >
                还有 {pendingCount - 3} 条…
              </Link>
            )}
          </div>
        </div>
      )}

      {pendingCount === 0 && (
        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-3 text-center text-[10px] text-muted-foreground">
          <ShieldCheckIcon className="mx-auto mb-1 size-4 text-emerald-500/50" />
          无待审批拦截
        </div>
      )}
    </Card>
  );
}
