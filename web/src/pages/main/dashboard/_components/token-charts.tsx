"use client";

import { ZapIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { LLMProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

import { cacheHitRate, fmtTokens } from "./format";
import type {
  DailyTokenPoint,
  DisplayedTokens,
  TokenBucket,
  TokenDays,
  TokenTab,
  TokenVersion,
} from "./use-token-stats";

// 配色锁定 chart-1..5 变量（DESIGN-SPEC 统一基准）。
const dailyTrendConfig = {
  input: { label: "输入", color: "var(--chart-1)" },
  output: { label: "输出", color: "var(--chart-4)" },
  cacheRead: { label: "缓存读", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** 分段控件（数据源 / 时间范围共用同一规格，避免同页两种开关样式）。 */
const SEGMENT_GROUP = "flex shrink-0 gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5";
const SEGMENT_ITEM =
  "h-6 rounded-md px-2 text-[11px] font-medium whitespace-nowrap transition-colors " +
  "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none";

interface TokenChartsProps {
  llmProfiles: LLMProfile[];
  defaultProfileId: number | null;
  tokenVersion: TokenVersion;
  onTokenVersionChange: (value: TokenVersion) => void;
  tokenTab: TokenTab;
  onTokenTabChange: (value: TokenTab) => void;
  tokenDays: TokenDays;
  onTokenDaysChange: (value: TokenDays) => void;
  tokenByProfile: Map<number | null, TokenBucket>;
  displayedTokens: DisplayedTokens;
  dailyTokenData: DailyTokenPoint[];
}

export function TokenCharts({
  llmProfiles,
  defaultProfileId,
  tokenVersion,
  onTokenVersionChange,
  tokenTab,
  onTokenTabChange,
  tokenDays,
  onTokenDaysChange,
  tokenByProfile,
  displayedTokens,
  dailyTokenData,
}: TokenChartsProps) {
  const total = displayedTokens.input + displayedTokens.output;
  const hitPct = cacheHitRate(displayedTokens.input, displayedTokens.cacheRead);

  return (
    <Card role="region" aria-label="LLM Token 消耗" className="min-w-0 p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ZapIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="text-[13px] leading-5 font-semibold">LLM Token 消耗</span>
          {/* 数据源开关：旧版=activity 统计（含历史任务），新版=llm_usage 计量账本（更准，仅覆盖启用后） */}
          <div className={cn(SEGMENT_GROUP, "ml-0.5")}>
            {(
              [
                { v: "old", label: "旧版" },
                { v: "new", label: "新版" },
              ] as const
            ).map(({ v, label }) => (
              <button
                type="button"
                key={v}
                onClick={() => onTokenVersionChange(v)}
                aria-pressed={tokenVersion === v}
                title={
                  v === "new"
                    ? "新版：来自 llm_usage 计量账本，逐次调用精确、含中断消耗；仅覆盖启用后的数据"
                    : "旧版：来自 activity 统计（含历史任务），中断消耗不计、无法精确到模型"
                }
                className={cn(
                  SEGMENT_ITEM,
                  tokenVersion === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {tokenVersion === "new" ? "llm_usage" : "activity"}
          </span>
        </div>

        {/* Profile tabs */}
        <div role="group" aria-label="按 LLM 配置筛选" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onTokenTabChange("all")}
            aria-pressed={tokenTab === "all"}
            className={cn(
              "flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              tokenTab === "all"
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "bg-muted/30 text-muted-foreground hover:text-foreground",
            )}
          >
            全部
          </button>
          {llmProfiles.map((p) => {
            const key = Number(p.id);
            const hasData = tokenByProfile.has(key) || (p.is_default && tokenByProfile.has(defaultProfileId));
            const resolvedKey = tokenByProfile.has(key) ? key : p.is_default ? defaultProfileId : key;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => onTokenTabChange(resolvedKey)}
                aria-pressed={tokenTab === resolvedKey}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                  tokenTab === resolvedKey
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "bg-muted/30 text-muted-foreground hover:text-foreground",
                  !hasData && "opacity-40",
                )}
              >
                {p.name}
                {p.is_default && (
                  <span
                    className={cn(
                      "rounded px-1 text-[11px] leading-4",
                      tokenTab === resolvedKey
                        ? "bg-foreground/10 text-foreground"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    默认
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body: metrics left + bar chart right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* Left: key metrics */}
        <div className="flex flex-col gap-4">
          {/* Total */}
          <div>
            <div className="text-xs text-muted-foreground">合计（输入 + 输出）</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
              {fmtTokens(total) || "—"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {displayedTokens.taskCount} 个任务
            </div>
          </div>

          {/* Per-type bars */}
          <div className="space-y-3">
            {[
              {
                label: "输入（未命中）",
                value: displayedTokens.input - displayedTokens.cacheRead,
                barColor: dailyTrendConfig.input.color,
                text: "text-chart-1",
              },
              {
                label: "缓存命中",
                value: displayedTokens.cacheRead,
                barColor: dailyTrendConfig.cacheRead.color,
                text: "text-chart-2",
              },
              {
                label: "输出",
                value: displayedTokens.output,
                barColor: dailyTrendConfig.output.color,
                text: "text-chart-4",
              },
            ].map(({ label, value, barColor, text }) => {
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{label}</span>
                    <span className={cn("shrink-0 font-mono font-semibold tabular-nums", text)}>
                      {fmtTokens(value)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: pct + "%", background: barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cache hit rate —— 与资源消耗卡同一口径（缓存读 ÷ 总输入） */}
          <div
            className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs"
            title="缓存命中率 = 缓存读 ÷ 总输入（输入已含缓存读）"
          >
            <span className="text-muted-foreground">缓存命中率</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                hitPct > 50 ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400",
              )}
            >
              {hitPct}%
            </span>
          </div>
        </div>

        {/* Right: daily bar chart */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-3 text-xs text-muted-foreground">
              {(["input", "output", "cacheRead"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-sm" style={{ background: dailyTrendConfig[k].color }} />
                  {dailyTrendConfig[k].label}
                </span>
              ))}
            </div>
            <div className={SEGMENT_GROUP}>
              {(
                [
                  { days: 7, label: "7天" },
                  { days: 30, label: "30天" },
                  { days: 90, label: "3月" },
                  { days: 180, label: "6月" },
                  { days: 365, label: "一年" },
                ] as const
              ).map(({ days, label }) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => onTokenDaysChange(days)}
                  aria-pressed={tokenDays === days}
                  className={cn(
                    SEGMENT_ITEM,
                    tokenDays === days
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div role="img" aria-label={"近 " + tokenDays + " 天 Token 使用趋势"}>
            <span className="sr-only">{dailyTokenData.length} 个日期，输入、输出与缓存读的每日用量。</span>
            {dailyTokenData.length === 0 ? (
              <div
                className="flex flex-1 items-center justify-center rounded-lg border border-border/60 bg-muted/10 text-xs text-muted-foreground"
                style={{ minHeight: 180 }}
              >
                暂无数据
              </div>
            ) : (
              <ChartContainer config={dailyTrendConfig} className="h-[200px] w-full">
                <BarChart data={dailyTokenData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} maxBarSize={40}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    tickMargin={6}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => fmtTokens(Number(v))}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    width={44}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="line"
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span>
                              {(dailyTrendConfig as Record<string, { label: string }>)[String(name)]?.label ??
                                String(name)}
                            </span>
                            <span className="font-mono font-semibold tabular-nums">{fmtTokens(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="input" stackId="1" fill="var(--color-input)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="output" stackId="1" fill="var(--color-output)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="cacheRead" stackId="1" fill="var(--color-cacheRead)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
