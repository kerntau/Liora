"use client";

import type { ElementType, ReactNode } from "react";

import { ActivityIcon, BugIcon, NetworkIcon, TargetIcon, ZapIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { fmtCount, fmtTokens } from "./format";
import { LiveDot, StatValue } from "./shared";

interface StatCardsProps {
  tasksReady: boolean;
  tasksTotal: number;
  tasksByStatus: Record<string, number>;
  fastReady: boolean;
  findingsTotal: number;
  findingsBySev: { critical: number; high: number; medium: number; low: number };
  slowReady: boolean;
  totalAssets: number;
  trafficCount: number;
  trafficCapture: boolean | undefined;
  tokens: { input: number; output: number; cacheRead: number };
}

/** 统计卡头部：12px 标签 + 14px 图标，五张卡同尺寸同基线。 */
function StatLabel({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </div>
  );
}

export function StatCards({
  tasksReady,
  tasksTotal,
  tasksByStatus,
  fastReady,
  findingsTotal,
  findingsBySev,
  slowReady,
  totalAssets,
  trafficCount,
  trafficCapture,
  tokens,
}: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {/* 活跃任务 */}
      <Card size="sm" className="gap-1.5">
        <CardHeader className="pb-0">
          <StatLabel icon={TargetIcon}>活跃任务</StatLabel>
          <div className="flex items-baseline gap-1.5">
            <StatValue ready={tasksReady}>
              <span className="font-semibold text-2xl tabular-nums leading-8 tracking-tight">
                {tasksByStatus.running ?? 0}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">/ {fmtCount(tasksTotal)}</span>
            </StatValue>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs">
          {/* 状态计数文字:浅底 600 / 深底 400,数字加 tabular-nums */}
          {(tasksByStatus.running ?? 0) > 0 && (
            <span className="text-sky-600 tabular-nums dark:text-sky-400">探索 {tasksByStatus.running}</span>
          )}
          {(tasksByStatus.paused ?? 0) > 0 && (
            <span className="text-amber-600 tabular-nums dark:text-amber-400">暂停 {tasksByStatus.paused}</span>
          )}
          {(tasksByStatus.done ?? 0) > 0 && (
            <span className="text-emerald-600 tabular-nums dark:text-emerald-400">完成 {tasksByStatus.done}</span>
          )}
          {tasksReady && tasksTotal === 0 && <span className="text-muted-foreground">暂无任务</span>}
        </CardContent>
      </Card>

      {/* 确认发现 */}
      <Card size="sm" className="gap-1.5">
        <CardHeader className="pb-0">
          <StatLabel icon={BugIcon}>确认发现</StatLabel>
          <StatValue ready={fastReady}>
            <div className="font-semibold text-2xl tabular-nums leading-8 tracking-tight">
              {fmtCount(findingsTotal)}
            </div>
          </StatValue>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5 text-xs tabular-nums">
          {/* 严重度文字:critical=rose-600、high=red 降饱和用 600 档、medium=amber、low=slate */}
          <span className="text-rose-600 dark:text-rose-400">严重 {findingsBySev.critical}</span>
          <span className="text-red-600 dark:text-red-400">高危 {findingsBySev.high}</span>
          <span className="text-amber-600 dark:text-amber-400">中危 {findingsBySev.medium}</span>
          <span className="text-slate-500 dark:text-slate-400">低危 {findingsBySev.low}</span>
        </CardContent>
      </Card>

      {/* 资产节点 */}
      <Card size="sm" className="gap-1.5">
        <CardHeader className="pb-0">
          <StatLabel icon={NetworkIcon}>资产节点</StatLabel>
          <StatValue ready={slowReady}>
            <div className="font-semibold text-2xl tabular-nums leading-8 tracking-tight">{fmtCount(totalAssets)}</div>
          </StatValue>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">跨任务共享</CardContent>
      </Card>

      {/* 流量交互 */}
      <Card size="sm" className="gap-1.5">
        <CardHeader className="pb-0">
          <StatLabel icon={ActivityIcon}>流量交互</StatLabel>
          <StatValue ready={slowReady}>
            <div className="font-semibold text-2xl tabular-nums leading-8 tracking-tight">{fmtCount(trafficCount)}</div>
          </StatValue>
        </CardHeader>
        <CardContent className="flex items-center gap-1.5 text-muted-foreground text-xs">
          {trafficCapture ? (
            <>
              <LiveDot />
              <span>录制中</span>
            </>
          ) : (
            <span>捕获未开启</span>
          )}
        </CardContent>
      </Card>

      {/* LLM 用量 */}
      <Card size="sm" className="gap-1.5">
        <CardHeader className="pb-0">
          <StatLabel icon={ZapIcon}>Token 用量</StatLabel>
          <StatValue ready={fastReady}>
            <div className="font-semibold text-2xl tabular-nums leading-8 tracking-tight">
              {fmtTokens(tokens.input + tokens.output) || "—"}
            </div>
          </StatValue>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          入 {fmtTokens(tokens.input)}（含缓存 {fmtTokens(tokens.cacheRead)}）· 出 {fmtTokens(tokens.output)}
        </CardContent>
      </Card>
    </div>
  );
}
