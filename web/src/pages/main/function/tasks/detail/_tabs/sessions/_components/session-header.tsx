import { ClockIcon, Trash2Icon } from "lucide-react";

import {
  ApprovalExecutionFocus,
  type useApprovalFocus,
  type useApprovalHistory,
} from "@/components/approval-execution-focus";
import { SideQuestionButton } from "@/components/side-question-workspace";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SideQuestions } from "@/hooks/use-side-questions";
import { fmtDuration } from "@/lib/format";
import { taskAssetSourceLabel, taskAssetTypeLabel } from "@/lib/task-assets";
import type { IntentAsset, Session, TaskLLMResolution, TokenTotal } from "@/lib/types";

import type { SessionMeta } from "../session-model";
import { TokenMetrics } from "./token-metrics";

// resolutionLabel names the LLM a session runs on. The badge shows this alone and
// keeps the model id in its tooltip. Env-backed configs can arrive without a name,
// so fall back to the model id rather than rendering an empty badge.
function resolutionLabel(r: TaskLLMResolution): string {
  return r.name || r.model || "未命名配置";
}

function truncateWorkerAssetLabel(value: string, maxChars = 30): string {
  const chars = Array.from(value.trim());
  if (chars.length <= maxChars) return chars.join("");
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join("")}…`;
}

function WorkerAssetBadge({ assets }: { assets: IntentAsset[] }) {
  const displayAssets = assets.filter(
    (asset) => asset.type === "root_domain" || asset.type === "subdomain" || asset.type === "ip",
  );
  if (displayAssets.length === 0) return null;

  const first = displayAssets[0];
  const firstRawLabel = first.label.trim() || `#${first.asset_id}`;
  const firstLabel = truncateWorkerAssetLabel(firstRawLabel);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="max-w-60 shrink-0 font-normal" title={firstRawLabel}>
          <span className="truncate">当前资产：{firstLabel}</span>
          {displayAssets.length > 1 && <span className="shrink-0 tabular-nums">+{displayAssets.length - 1}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="right" align="start" className="max-w-sm">
        <div className="flex flex-col gap-2">
          {displayAssets.map((asset) => (
            <div key={`${asset.intent_id}-${asset.asset_id}`} className="min-w-0">
              <div className="break-all font-mono text-xs">{asset.label.trim() || `#${asset.asset_id}`}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {taskAssetTypeLabel(asset.type)} · {taskAssetSourceLabel(asset.source)}
                {asset.inherited ? ` · 来源任务 #${asset.source_task_id}` : ""}
              </div>
              <div className="mt-0.5 [overflow-wrap:anywhere] text-xs">{asset.source_summary}</div>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Top of the transcript panel: session title, LLM/asset badges, per-session token
// total + run duration, the 假删除 banner, and the approval-locate banner.
export function SessionHeader({
  active,
  meta,
  side,
  resolution,
  assets,
  hasMore,
  tokens,
  duration,
  isMain,
  approvalFocus,
  approvalHistory,
  onCloseApprovalFocus,
}: {
  active: Session;
  meta?: SessionMeta;
  side: SideQuestions;
  resolution?: TaskLLMResolution;
  assets?: IntentAsset[];
  hasMore: boolean;
  tokens: TokenTotal;
  duration: number | null;
  isMain: boolean;
  approvalFocus: ReturnType<typeof useApprovalFocus>;
  approvalHistory: ReturnType<typeof useApprovalHistory>;
  onCloseApprovalFocus: () => void;
}) {
  const tokenTotal = {
    i: tokens.input_tokens,
    o: tokens.output_tokens,
    cr: tokens.cache_read_tokens,
    any:
      tokens.input_tokens + tokens.output_tokens + tokens.cache_read_tokens + tokens.cache_write_tokens > 0,
  };

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-2 sm:px-4 sm:py-2.5">
        {(() => {
          const isWorker = active.role === "worker";
          const workerMeta = isWorker ? meta : undefined;
          // Worker: the intent moved into the transcript as a message, so the
          // header shows a stable generic label (intent JSON stays on hover).
          const title = isWorker ? "Worker 执行会话" : active.title;
          const titleEl = <span className="min-w-0 truncate text-sm font-medium">{title}</span>;
          return workerMeta?.json ? (
            <Tooltip>
              <TooltipTrigger asChild>{titleEl}</TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-h-80 max-w-sm overflow-auto p-0">
                <pre className="p-2 text-[10px] leading-relaxed">{JSON.stringify(workerMeta.json, null, 2)}</pre>
              </TooltipContent>
            </Tooltip>
          ) : (
            titleEl
          );
        })()}
        <SideQuestionButton side={side} />
        {resolution && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="max-w-28 shrink-0 font-normal"
                aria-label={resolution.available ? `当前配置：${resolutionLabel(resolution)}` : "模型不可用"}
              >
                <span className="truncate">{resolution.available ? resolutionLabel(resolution) : "模型不可用"}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs [overflow-wrap:anywhere]">
              {resolution.available
                ? [resolutionLabel(resolution), resolution.model].filter(Boolean).join(" / ")
                : resolution.reason || "没有可用的 LLM 配置"}
            </TooltipContent>
          </Tooltip>
        )}
        {assets && assets.length > 0 && <WorkerAssetBadge assets={assets} />}
        {active.inherited && active.source_task_id && (
          <Badge variant="outline">来源任务 #{active.source_task_id} · 只读历史</Badge>
        )}
        {active.live && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
            <span className="size-1 animate-pulse rounded-full bg-blue-500" />
            实时
          </span>
        )}
        {hasMore && (
          <span className="text-[10px] text-muted-foreground" title="向上滚动加载更早历史">
            ↑ 更早历史
          </span>
        )}
        <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground max-sm:w-full max-sm:flex-wrap">
          {tokenTotal.any && (
            <Tooltip>
              {/* 手机端用短标签（入/缓/出）：长标签会把这一行撑成两行，进一步压缩记录区。 */}
              <TooltipTrigger asChild>
                <span className="inline-flex min-w-0 items-center">
                  <TokenMetrics input={tokenTotal.i} cache={tokenTotal.cr} output={tokenTotal.o} labels="short" className="sm:hidden" />
                  <TokenMetrics input={tokenTotal.i} cache={tokenTotal.cr} output={tokenTotal.o} labels="long" className="max-sm:hidden" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                输入 {tokens.input_tokens.toLocaleString()} · 输出 {tokens.output_tokens.toLocaleString()} · 缓存读取{" "}
                {tokens.cache_read_tokens.toLocaleString()} · 缓存写入 {tokens.cache_write_tokens.toLocaleString()}
              </TooltipContent>
            </Tooltip>
          )}
          {duration != null && (
            <span className="inline-flex items-center gap-1" title="运行时长（首步 → 末步）">
              <ClockIcon className="size-3" />
              {fmtDuration(duration, "ms")}
            </span>
          )}
          {isMain && <span>可交互</span>}
        </div>
      </div>
      {(() => {
        const dm = active.role === "worker" ? meta : undefined;
        if (!dm?.deleted) return null;
        return (
          <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs">
            <Trash2Icon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <span className="font-medium text-destructive">此意图已被用户删除</span>
              <span className="text-muted-foreground">
                （已停止执行，规划者已收到通知；意图与产出保留，可在下方查看历史）
              </span>
              {dm.deleteReason && (
                <p className="mt-1 break-words text-foreground">
                  <span className="text-muted-foreground">删除原因：</span>
                  {dm.deleteReason}
                </p>
              )}
            </div>
          </div>
        );
      })()}
      <ApprovalExecutionFocus focus={{ ...approvalFocus, close: onCloseApprovalFocus }} history={approvalHistory} />
    </>
  );
}
