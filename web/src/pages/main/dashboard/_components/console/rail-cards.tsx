"use client";

import type { ReactNode } from "react";

import { ArrowUpRightIcon, CoinsIcon, RadarIcon, ShieldAlertIcon } from "lucide-react";

import { Donut } from "@/components/app/donut";
import { SectionCard } from "@/components/app/section-card";
import Link from "@/lib/router-compat";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

import { cacheHitRate, fmtCount, fmtTokens } from "../format";
import { coveragePercent } from "./helpers";
import { MetricBlock } from "./metric-block";
import type { TaskCoverage } from "./use-task-console";

/** 两卡共用的环 + 指标布局：左环（72px）+ 右侧两列指标，环下 12px 说明。 */
function DonutMetricLayout({
  donutValue,
  donutColor,
  caption,
  children,
  footnote,
}: {
  donutValue: number;
  donutColor: string;
  caption: string;
  children: ReactNode;
  footnote: string;
}) {
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <Donut value={donutValue} size={72} stroke={7} color={donutColor} />
          <span className="text-muted-foreground text-xs">{caption}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col divide-y divide-border/60">{children}</div>
      </div>
      <p className="mt-3 text-muted-foreground text-xs leading-5">{footnote}</p>
    </>
  );
}

export function BudgetCard({
  tokens,
  taskCount,
}: {
  tokens: { input: number; output: number; cacheRead: number };
  taskCount?: number;
}) {
  const used = tokens.input + tokens.output;
  // 与 Token 卡同一口径：input 已含缓存读，命中率 = 缓存读 ÷ 总输入。
  const hitRate = cacheHitRate(tokens.input, tokens.cacheRead);

  return (
    <SectionCard icon={CoinsIcon} title="资源消耗" description="Token 用量 · 全局" className="min-w-0">
      <DonutMetricLayout
        donutValue={hitRate}
        donutColor="var(--success)"
        caption="缓存命中率"
        footnote="缓存命中率 = 缓存读 ÷ 总输入（输入已含缓存读）。"
      >
        <MetricBlock label="总消耗" value={fmtTokens(used)} />
        <MetricBlock label="缓存读" value={fmtTokens(tokens.cacheRead)} tone="success" />
        <MetricBlock label="覆盖任务" value={taskCount != null ? `${taskCount} 个` : "—"} tone="muted" />
      </DonutMetricLayout>
    </SectionCard>
  );
}

export function CoverageCard({ coverage, fallbackPct }: { coverage: TaskCoverage | null; fallbackPct: number | null }) {
  const enabled = Boolean(coverage?.enabled);
  const pct = enabled ? (coveragePercent(coverage?.pct) ?? 0) : (fallbackPct ?? 0);
  const total = coverage?.denominator ?? 0;
  const tested = coverage?.tested ?? 0;
  const remaining = Math.max(0, total - tested);

  if (!enabled && fallbackPct === null) {
    return (
      <SectionCard icon={RadarIcon} title="覆盖进度" description="范围内资产被验证的比例" className="min-w-0">
        <p className="py-2 text-muted-foreground text-xs">当前任务未启用资产覆盖度。</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={RadarIcon} title="覆盖进度" description="范围内资产被验证的比例" className="min-w-0">
      <DonutMetricLayout
        donutValue={pct}
        donutColor="var(--primary)"
        caption={enabled ? "已覆盖" : "整体进度"}
        footnote={
          enabled
            ? "已覆盖 ÷ 总范围（总范围 = 任务授权范围内的资产数）。"
            : "当前任务未启用资产覆盖度，环内为按目标完成情况估算的整体进度。"
        }
      >
        {enabled ? (
          <>
            <MetricBlock label="已覆盖" value={fmtCount(tested)} tone="info" />
            <MetricBlock label="待覆盖" value={fmtCount(remaining)} tone="warning" />
            <MetricBlock label="总范围" value={fmtCount(total)} />
          </>
        ) : (
          <MetricBlock label="整体进度" value={`${pct}%`} />
        )}
      </DonutMetricLayout>
    </SectionCard>
  );
}

// 严重度口径(与统计卡一致):critical=rose、high=red(仅数据条用降饱和 500 档)、
// medium=amber、low=teal;文字统一 600/400 档,条形同高(h-1.5)同圆角(rounded-full)。
const SEVERITY_META: { key: Severity; label: string; className: string; bar: string }[] = [
  {
    key: "critical",
    label: "严重",
    className: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500 dark:bg-rose-400",
  },
  { key: "high", label: "高危", className: "text-red-600 dark:text-red-400", bar: "bg-red-500/70 dark:bg-red-400/70" },
  {
    key: "medium",
    label: "中危",
    className: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500 dark:bg-amber-400",
  },
  { key: "low", label: "低危", className: "text-teal-600 dark:text-teal-400", bar: "bg-teal-500 dark:bg-teal-400" },
];

export function FindingsCard({ counts, total }: { counts: Record<Severity, number>; total: number }) {
  return (
    <SectionCard
      icon={ShieldAlertIcon}
      title="发现统计"
      className="min-w-0"
      dense
      headerClassName="px-4 pt-4 pb-2"
      bodyClassName="px-4 pb-4"
      actions={
        <Link
          prefetch={false}
          href="/function/findings"
          className="inline-flex items-center gap-1 rounded font-medium text-primary text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          查看详情 <ArrowUpRightIcon className="size-3" aria-hidden="true" />
        </Link>
      }
    >
      <div className="grid grid-cols-4 gap-1.5">
        {SEVERITY_META.map((item) => (
          <div key={item.key} className="flex items-baseline justify-center gap-1 rounded-md bg-muted/40 px-1 py-1.5">
            <span className={cn("font-semibold text-[16px] tabular-nums leading-5", item.className)}>
              {counts[item.key]}
            </span>
            <span className="text-muted-foreground text-xs">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          {SEVERITY_META.map((item) => (
            <div
              key={item.key}
              className={cn("h-full transition-[width] duration-500", item.bar)}
              style={{ width: total > 0 ? `${(counts[item.key] / total) * 100}%` : "0%" }}
            />
          ))}
        </div>
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">共 {fmtCount(total)} 条</span>
      </div>
    </SectionCard>
  );
}
