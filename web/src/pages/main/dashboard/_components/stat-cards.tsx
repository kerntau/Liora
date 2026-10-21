"use client";

import { ActivityIcon, BugIcon, NetworkIcon, TargetIcon, ZapIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { fmtTokens } from "./format";
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
      <Card className="gap-1">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <TargetIcon className="size-3" /> 活跃任务
          </div>
          <div className="flex items-baseline gap-1.5">
            <StatValue ready={tasksReady}>
              <span className="text-2xl font-semibold tabular-nums">{tasksByStatus.running ?? 0}</span>
              <span className="text-xs text-muted-foreground">/ {tasksTotal}</span>
            </StatValue>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px]">
          {(tasksByStatus.running ?? 0) > 0 && <span className="text-blue-400">探索 {tasksByStatus.running}</span>}
          {(tasksByStatus.paused ?? 0) > 0 && <span className="text-amber-400">暂停 {tasksByStatus.paused}</span>}
          {(tasksByStatus.done ?? 0) > 0 && <span className="text-emerald-400">完成 {tasksByStatus.done}</span>}
          {tasksReady && tasksTotal === 0 && <span className="text-muted-foreground">暂无任务</span>}
        </CardContent>
      </Card>

      {/* 确认发现 */}
      <Card className="gap-1">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <BugIcon className="size-3" /> 确认发现
          </div>
          <StatValue ready={fastReady}>
            <div className="text-2xl font-semibold tabular-nums">{findingsTotal}</div>
          </StatValue>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5 text-[10px]">
          <span className="text-rose-500">严重 {findingsBySev.critical}</span>
          <span className="text-red-400">高危 {findingsBySev.high}</span>
          <span className="text-amber-400">中危 {findingsBySev.medium}</span>
          <span className="text-slate-400">低危 {findingsBySev.low}</span>
        </CardContent>
      </Card>

      {/* 资产节点 */}
      <Card className="gap-1">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <NetworkIcon className="size-3" /> 资产节点
          </div>
          <StatValue ready={slowReady}>
            <div className="text-2xl font-semibold tabular-nums">{totalAssets}</div>
          </StatValue>
        </CardHeader>
        <CardContent className="text-[10px] text-muted-foreground">跨任务共享</CardContent>
      </Card>

      {/* 流量交互 */}
      <Card className="gap-1">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ActivityIcon className="size-3" /> 流量交互
          </div>
          <StatValue ready={slowReady}>
            <div className="text-2xl font-semibold tabular-nums">{trafficCount}</div>
          </StatValue>
        </CardHeader>
        <CardContent className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
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
      <Card className="gap-1">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ZapIcon className="size-3" /> Token 用量
          </div>
          <StatValue ready={fastReady}>
            <div className="text-2xl font-semibold tabular-nums">{fmtTokens(tokens.input + tokens.output) || "—"}</div>
          </StatValue>
        </CardHeader>
        <CardContent className="text-[10px] text-muted-foreground">
          入 {fmtTokens(tokens.input)}（含缓存 {fmtTokens(tokens.cacheRead)}）· 出 {fmtTokens(tokens.output)}
        </CardContent>
      </Card>
    </div>
  );
}
