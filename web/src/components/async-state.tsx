import * as React from "react";

import { Loader2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type AsyncStatus, deriveAsyncView } from "@/lib/async-status";
import { cn } from "@/lib/utils";

// 把「加载 / 失败 / 空 / 有数据」四态收敛成一个渲染入口。
// 约定：首载用骨架（尺寸与最终布局一致），失败必须内联常驻并给重试，空态由调用方给下一步动作。
// 刷新不换内容：旧数据继续渲染，只在右上角提示「更新中」；刷新失败也只加窄条。
export type AsyncStateProps = {
  status: AsyncStatus;
  error?: Error | null;
  onRetry?: () => void;
  /** 有数据且请求进行中：保留内容，仅显示非遮挡的「更新中」。 */
  refreshing?: boolean;
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
  refreshing,
  isEmpty = false,
  empty,
  skeleton,
  className,
  children,
}: AsyncStateProps) {
  // 记住被关掉的那一条错误：同一条不再打扰，新错误（新对象）会重新出现。
  const [dismissedError, setDismissedError] = React.useState<Error | null>(null);
  const view = deriveAsyncView({
    // 新语义下只有 ready 代表「有数据」，loading / error 都是无数据态。
    hasData: status === "ready",
    // loading 本身就是请求中；refreshing 只对「已有数据」的 ready 有意义，
    // 不能因为调用方传了 refreshing={false} 就把首载骨架误判成空态。
    pending: status === "loading" || (status === "ready" && refreshing === true),
    error,
    isEmpty,
  });

  if (view.showError) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-12 text-muted-foreground text-sm",
          className,
        )}
      >
        <div className="text-foreground">加载失败</div>
        {error ? <div className="max-w-md text-center text-xs">{error.message}</div> : null}
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            重试
          </Button>
        )}
      </div>
    );
  }

  if (view.showSkeleton) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className={cn(className)}>
        {skeleton ?? <DefaultSkeleton />}
      </div>
    );
  }

  const staleError = view.showStaleError && error && error !== dismissedError ? error : null;
  if (!staleError && !view.refreshing) {
    return view.showEmpty && empty ? empty : children;
  }

  return (
    <div className={cn("relative", className)}>
      {view.refreshing && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none absolute -top-5 right-0 z-10 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-muted-foreground text-xs shadow-sm"
        >
          <Loader2Icon aria-hidden="true" className="size-3 animate-spin" />
          更新中
        </div>
      )}
      {staleError && (
        <div
          role="alert"
          className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs"
        >
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            刷新失败：{staleError.message}（当前显示上次成功的数据）
          </span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="shrink-0 text-foreground underline underline-offset-2">
              重试
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissedError(staleError)}
            aria-label="关闭刷新失败提示"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <XIcon aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      )}
      {view.showEmpty && empty ? empty : children}
    </div>
  );
}
