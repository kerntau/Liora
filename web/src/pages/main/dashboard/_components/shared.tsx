"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-blue-400", className)} />;
}

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
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon className="size-3.5 text-muted-foreground" />
        {children}
      </div>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// 首载未就绪时用骨架占位，避免把 0 当成真实数据。
export function StatValue({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  if (!ready) return <Skeleton aria-hidden="true" className="h-7 w-12" />;
  return <>{children}</>;
}
