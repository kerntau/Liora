"use client";

import type * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { SECTION_TITLE_CLASS } from "@/lib/typography";
import { cn } from "@/lib/utils";

// 实时呼吸点：info/active 令牌（浅 600 / 深 400），仅用于"录制中"这类实时状态。
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-indigo-500 dark:bg-indigo-400",
        className,
      )}
    />
  );
}

/** 卡片内小节标题：13px/600 + 12px 右侧说明，两者同基线。 */
export function SectionTitle({
  icon: Icon,
  children,
  sub,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className={cn("truncate", SECTION_TITLE_CLASS)}>{children}</span>
      </div>
      {sub ? <span className="shrink-0 text-muted-foreground text-xs tabular-nums">{sub}</span> : null}
    </div>
  );
}

// 首载未就绪时用骨架占位，避免把 0 当成真实数据。
export function StatValue({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  if (!ready) return <Skeleton aria-hidden="true" className="h-7 w-12" />;
  return <>{children}</>;
}
