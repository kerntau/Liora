import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Lightweight SVG donut. No chart dependency, crisp at any size, and the
 * percentage stays readable in both themes.
 *
 * 中心文字按尺寸分档，避免 0% / 100% / 长 caption 在小尺寸下顶到圆环：
 * - size >= 88：数字 18px / caption 12px；
 * - size < 88（如仪表盘右栏 72px）：数字 15px / caption 11px。
 * 内容宽度按内圆直径收窄并 truncate，任何极值都不会溢出圆环。
 */
export function Donut({
  value,
  size = 96,
  stroke = 9,
  color = "var(--success)",
  track = "color-mix(in srgb, var(--muted-foreground) 14%, transparent)",
  label,
  caption,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: ReactNode;
  caption?: ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  // 内圆直径（px）：viewBox 里半径 42、圆环宽 stroke，换算到实际尺寸。
  const innerDiameter = (size * (radius - stroke / 2)) / 50;
  const contentWidth = Math.round(innerDiameter * 0.9);
  const compact = size < 88;
  // 0% 时留空、100% 时首尾闭合：这两种极值不能用圆头线帽，否则会多出一个小圆点/接缝凸起。
  const cap = clamped <= 0 || clamped >= 100 ? "butt" : "round";
  return (
    <div
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap={cap}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="flex min-w-0 flex-col items-center" style={{ maxWidth: contentWidth }}>
          {/* 字号档位放在前面：tailwind-merge 会把 text-[15px] 这类任意长度值和后面的
              leading-* 视为同一组，写反了行高会被吃掉（实测过），这里顺序不能调。 */}
          <div
            className={cn(
              compact ? "text-[15px]" : "text-[18px]",
              "max-w-full truncate leading-none font-semibold tracking-tight text-foreground tabular-nums",
            )}
          >
            {label ?? `${Math.round(clamped)}%`}
          </div>
          {caption ? (
            <div
              className={cn(
                compact ? "text-[11px]" : "text-[12px]",
                "mt-1 max-w-full truncate leading-tight text-muted-foreground",
              )}
            >
              {caption}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
