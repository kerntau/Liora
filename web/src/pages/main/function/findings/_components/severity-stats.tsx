"use client";

import { CircleAlertIcon, InfoIcon, type LucideIcon, ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";

import { SectionCard } from "@/components/app/section-card";
import type { FindingStats, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LevelMeta {
  key: Severity;
  label: string;
  icon: LucideIcon;
  /** 语义色只出现在「圆点 + 占比条」两处，四张卡的排版与字号完全一致。 */
  dot: string;
  bar: string;
}

// 颜色口径与 rail-cards 的严重度统计对齐：严重=rose、高危=red（80% 透明度降饱和）、
// 中危=amber、低危=teal；圆点与占比条共用同一色，条形同高同 rounded-full。
const LEVELS: LevelMeta[] = [
  { key: "critical", label: "严重", icon: ShieldAlertIcon, dot: "bg-rose-500", bar: "bg-rose-500" },
  { key: "high", label: "高危", icon: TriangleAlertIcon, dot: "bg-red-500/80", bar: "bg-red-500/80" },
  { key: "medium", label: "中危", icon: CircleAlertIcon, dot: "bg-amber-500", bar: "bg-amber-500" },
  { key: "low", label: "低危", icon: InfoIcon, dot: "bg-teal-500", bar: "bg-teal-500" },
];

interface SeverityStatsProps {
  stats: FindingStats;
  severity: "all" | Severity;
  onSeverityChange: (value: "all" | Severity) => void;
}

// SeverityStats 是页面顶部的严重度分布卡：四张结构相同的计数块同时充当严重度筛选入口，
// 与工具栏里的等级切换共享同一份状态（点已选中的卡片回到「全部」）。
// 总数只出现在工具栏，这里只保留「待处理」这一个不同的口径。
export function SeverityStats({ stats, severity, onSeverityChange }: SeverityStatsProps) {
  const total = stats.total;
  return (
    <SectionCard
      icon={ShieldAlertIcon}
      title="严重度分布"
      description="点击等级可直接筛选列表，统计覆盖全部发现。"
      actions={
        <span className="app-chip tabular-nums">
          <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
          待处理 <span className="font-medium text-foreground">{stats.pending}</span>
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEVELS.map((level) => {
          const value = stats[level.key] ?? 0;
          const share = total > 0 ? Math.round((value / total) * 100) : 0;
          const active = severity === level.key;
          const Icon = level.icon;
          return (
            <button
              key={level.key}
              type="button"
              aria-pressed={active}
              aria-label={`${level.label} ${value} 条`}
              title={active ? "取消该等级筛选" : `只看${level.label}`}
              onClick={() => onSeverityChange(active ? "all" : level.key)}
              className={cn(
                "flex flex-col gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                active ? "bg-primary/5 ring-1 ring-primary/30" : "bg-surface-muted/60 hover:bg-surface-muted",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-[12px] text-muted-foreground">
                  <span className={cn("size-1.5 shrink-0 rounded-full", level.dot)} aria-hidden="true" />
                  {level.label}
                </span>
                <Icon className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-[22px] text-foreground tabular-nums leading-none">{value}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">{share}%</span>
              </span>
              <span className="block h-1 w-full overflow-hidden rounded-full bg-border/60" aria-hidden="true">
                <span
                  className={cn("block h-full rounded-full transition-[width]", level.bar)}
                  style={{ width: `${share}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
