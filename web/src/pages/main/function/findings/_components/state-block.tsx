import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 列表/面板的统一空态与失败态：图标块 + 标题 + 一句说明 + 可选动作。
 * 三个发现视图（平铺 / 分组 / 资产）与资产页共用同一套排版，避免各写一份。
 */
export function StateBlock({
  icon: Icon,
  title,
  description,
  action,
  tone = "muted",
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** error 用浅红图标块，其余用中性浅色块。 */
  tone?: "muted" | "error";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 px-6 py-6 text-center", className)}>
      <Icon
        className={cn("size-6", tone === "error" ? "text-destructive" : "text-muted-foreground/60")}
        aria-hidden="true"
      />
      <p className="text-foreground text-[13px] font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-md text-[12px] leading-5 break-words">{description}</p>
      ) : null}
      {action ? <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** 表格首载占位：与最终行高一致，避免加载完成时整页跳动。 */
export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label="正在加载列表" className="px-5 py-4">
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-3">
            {Array.from({ length: columns }).map((__, col) => (
              <div
                key={col}
                className={cn(
                  "h-4 animate-pulse rounded bg-muted",
                  col === 1 ? "w-1/3" : col === 0 ? "w-16" : "flex-1",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
