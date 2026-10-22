import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 密集指标行：左 label（12px，语义色点）+ 右数值（14px tabular-nums）。
 * 只做视觉呈现，不携带任何数据逻辑。
 *
 * 用「行 + 分隔线」而不是带边框的小格：卡片内不再套卡片，
 * 资源消耗卡与覆盖进度卡因此保持同一种呈现。
 */
export function MetricBlock({
  label,
  value,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "default" | "info" | "success" | "warning" | "danger" | "muted";
  className?: string;
}) {
  const toneDot = {
    default: "bg-foreground/30",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    muted: "bg-muted-foreground/40",
  }[tone];
  const toneValue = {
    default: "text-foreground",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className={cn("flex min-w-0 items-baseline justify-between gap-3 py-2", className)}>
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-1.5 shrink-0 rounded-full", toneDot)} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("shrink-0 text-[14px] leading-5 font-semibold tracking-tight tabular-nums", toneValue)}>
        {value}
      </span>
    </div>
  );
}
