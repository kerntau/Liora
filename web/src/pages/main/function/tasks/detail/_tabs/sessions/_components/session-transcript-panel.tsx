import * as React from "react";

import { CircleXIcon, Loader2Icon, MessagesSquareIcon } from "lucide-react";

import { Transcript } from "@/components/transcript";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Activity } from "@/lib/types";

// Scroll container for the active session's transcript. Scroll/auto-follow behaviour
// stays in the tab (it owns the viewport refs); this panel only renders the states.
export function SessionTranscriptPanel({
  activity,
  live,
  taskId,
  isMain,
  focusedSeq,
  loadingMore,
  showLoader,
  error,
  onRetry,
  emptyHint,
  contentRef,
}: {
  activity: Activity[];
  live: boolean;
  taskId: string;
  isMain: boolean;
  focusedSeq?: number;
  loadingMore: boolean;
  showLoader: boolean;
  error?: string;
  onRetry: () => void;
  emptyHint: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    /* Force Radix's internal viewport wrapper (display:table, sizes to content)
    to block so wide/unbreakable steps (long commands, code, URLs) can't blow
    out the width and defeat the truncation below — the transcript wraps to
    the panel instead of overflowing horizontally. */
    <ScrollArea type="auto" className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!">
      <div className="mx-auto w-full max-w-[68rem] min-w-0 px-3 py-3 sm:px-5 sm:py-4" ref={contentRef}>
        {loadingMore && (
          <div className="mb-2 flex items-center justify-center gap-1.5 rounded-md border border-border/70 bg-surface-muted px-2 py-1 text-[12px] text-muted-foreground">
            <Loader2Icon className="size-3 animate-spin" />
            加载更早历史…
          </div>
        )}
        {showLoader ? (
          <div className="flex flex-col gap-2" role="status" aria-live="polite" aria-busy="true">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              加载活动流…
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <CircleXIcon className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">加载失败：{error}</span>
            <Button size="sm" variant="outline" onClick={onRetry}>
              重试
            </Button>
          </div>
        ) : activity.length ? (
          <Transcript activity={activity} live={live} taskId={taskId} chat={isMain} focusedSeq={focusedSeq} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-surface-muted/40 px-6 py-8 text-center">
            <MessagesSquareIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-[13px] font-medium text-foreground">{isMain ? "还没有对话" : "暂无活动记录"}</p>
            <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">{emptyHint}</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
