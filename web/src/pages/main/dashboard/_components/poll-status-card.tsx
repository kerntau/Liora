"use client";

import { RadioIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { SectionTitle } from "./shared";

type SourceState = "pending" | "ok" | "error";

const SOURCES = [
  { key: "tasks", label: "任务列表", interval: "5s", detail: "任务状态、进度与 Token 用量" },
  { key: "fast", label: "实时面板", interval: "5s", detail: "发现、审批、活动流与会话用量" },
  { key: "slow", label: "系统与资产", interval: "15s", detail: "流量、资产、模型与用量统计" },
] as const;

const STATE_META: Record<SourceState, { label: string; text: string; dot: string }> = {
  pending: { label: "加载中", text: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  ok: { label: "正常", text: "text-success", dot: "bg-success" },
  error: { label: "失败", text: "text-destructive", dot: "bg-destructive" },
};

/**
 * 数据源与轮询状态：把页面里三路轮询（5s / 5s / 15s）的健康度显式呈现，
 * 失败面板在此逐项列出（顶部横幅只给汇总）。纯展示，不发起任何请求。
 */
export function PollStatusCard({
  sources,
  failedPanels,
}: {
  sources: Record<string, SourceState>;
  failedPanels: Record<string, string[]>;
}) {
  const failed = Object.values(failedPanels).flat();

  return (
    <Card className="gap-0 p-4" role="region" aria-label="数据源与轮询">
      <SectionTitle icon={RadioIcon} sub="后台轮询">
        数据源状态
      </SectionTitle>

      <div className="divide-y divide-border/60">
        {SOURCES.map((source) => {
          const state = STATE_META[sources[source.key] ?? "pending"];
          return (
            <div key={source.key} className="flex items-start justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", state.dot)} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground">{source.label}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{source.detail}</div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px]">
                <span className="font-mono text-muted-foreground tabular-nums">{source.interval}</span>
                <span className={cn("font-medium", state.text)}>{state.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {failed.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          失败面板：<span className="text-warning">{failed.join("、")}</span>（保留上次结果，自动重试）
        </p>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">页面不可见时暂停轮询，回到前台立即补跑。</p>
      )}
    </Card>
  );
}