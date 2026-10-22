import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "default" | "muted" | "success" | "warning" | "danger" | "info";

/**
 * 色点跟随语义色。旧实现用 bg-current，而色点挂在 muted 的标签 span 里，
 * 于是永远只有一种灰（深色下还偏亮），tone 变了色点也不变，等于没有语义。
 * 取值与仪表盘 MetricBlock 完全一致，两个组件并排时不会出现两种灰。
 */
const TONE_DOT: Record<Tone, string> = {
  default: "bg-foreground/30",
  muted: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
};

const TONE_TEXT: Record<Tone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

/**
 * 一行「标签 — 数值」的指标展示。
 *
 * - 标签 12px/muted，数值 15px/600 等宽数字（与仪表盘 MetricBlock 同一口径：
 *   同层级数值在不同组件里必须同字号，否则并排就能看出廉价感）；
 * - items-baseline 保证标签与数值基线对齐，数值再长也不会把标签顶歪；
 * - 数值 shrink-0 右对齐、标签 truncate，长文案不会把数值挤出容器；
 * - 色点 6px，颜色随 tone。
 *
 * 行本身不带纵向内距，间距由调用方的 gap / space-y 控制（卡片内统一 8px）。
 */
export function MetricRow({
  label,
  value,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline justify-between gap-3 text-[12px] leading-5", className)}>
      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-[15px] leading-5 font-semibold tracking-tight tabular-nums",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </span>
    </div>
  );
}
