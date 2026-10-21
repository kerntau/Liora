import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AsyncStatus } from "@/hooks/use-async-data";

// 把「加载 / 失败 / 空 / 有数据」四态收敛成一个渲染入口。
// 约定：首载用骨架（尺寸与最终布局一致），失败必须内联常驻并给重试，空态由调用方给下一步动作。
export type AsyncStateProps = {
  status: AsyncStatus;
  error?: Error | null;
  onRetry?: () => void;
  /** 数据已就绪但为空。 */
  isEmpty?: boolean;
  empty?: React.ReactNode;
  /** 首载占位，默认 3 行骨架。 */
  skeleton?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

function DefaultSkeleton() {
  return (
    <div className="space-y-2 py-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function AsyncState({
  status,
  error,
  onRetry,
  isEmpty = false,
  empty,
  skeleton,
  className,
  children,
}: AsyncStateProps) {
  if (status === "error" && error) {
    return (
      <div
        role="alert"
        className={cn(
          "text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-12 text-sm",
          className,
        )}
      >
        <div className="text-foreground">加载失败</div>
        <div className="max-w-md text-center text-xs">{error.message}</div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            重试
          </Button>
        )}
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className={cn(className)}>
        {skeleton ?? <DefaultSkeleton />}
      </div>
    );
  }

  if (isEmpty && empty) {
    return <>{empty}</>;
  }

  return <>{children}</>;
}
