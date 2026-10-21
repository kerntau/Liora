import * as React from "react";

import { CircleXIcon, Loader2Icon } from "lucide-react";

import { Transcript } from "@/components/transcript";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <div className="min-w-0 max-w-full p-4" ref={contentRef}>
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 pb-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            加载更早历史…
          </div>
        )}
        {showLoader ? (
          <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            加载活动流…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 pl-9 text-xs text-red-500">
            <CircleXIcon className="size-3.5" />
            加载失败：{error}
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onRetry}>
              重试
            </Button>
          </div>
        ) : activity.length ? (
          <Transcript activity={activity} live={live} taskId={taskId} chat={isMain} focusedSeq={focusedSeq} />
        ) : (
          <div className="pl-9 text-xs text-muted-foreground">{emptyHint}</div>
        )}
      </div>
    </ScrollArea>
  );
}
