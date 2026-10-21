import {
  BrainIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  ClockIcon,
  HistoryIcon,
  Loader2Icon,
  PauseIcon,
  PlusIcon,
  RadioIcon,
  RotateCwIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UserIcon,
  WifiOffIcon,
  ZapOffIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Session, SessionStatus, TokenTotal } from "@/lib/types";
import { cn } from "@/lib/utils";

import type { SessionMeta } from "../session-model";
import { TokenMetrics } from "./token-metrics";

// statusIcon maps a session status to its icon. Worker terminal states are
// distinct & color-coded: 完成(绿勾圈) / 取消停止(琥珀斜杠圈) / 出错(红叉圈) /
// 步数耗尽(紫). running=蓝色转圈, pending(待领取)=灰时钟.
function statusIcon(status: SessionStatus) {
  switch (status) {
    case "running": // 执行中
      return <Loader2Icon className="size-3.5 animate-spin text-blue-500" />;
    case "paused":
      return <PauseIcon className="size-3.5 text-amber-500" />;
    case "pending": // 待领取(open intent)
      return <ClockIcon className="size-3.5 text-muted-foreground" />;
    case "done": // 完成
      return <CircleCheckIcon className="size-3.5 text-emerald-500" />;
    case "stopped": // 取消/停止(被 planner 终止)
      return <CircleSlashIcon className="size-3.5 text-amber-500" />;
    case "blocked": // 出错
      return <CircleXIcon className="size-3.5 text-red-500" />;
    case "exhausted": // 步数耗尽(撞 max_turns)
      return <ZapOffIcon className="size-3.5 text-violet-500" />;
    case "deleted": // 用户假删除
      return <CircleSlashIcon className="size-3.5 text-muted-foreground" />;
  }
}

const roleMeta = {
  mainagent: { label: "主 Agent", icon: UserIcon },
  planner: { label: "规划 Planner", icon: BrainIcon },
  worker: { label: "Workers", icon: RadioIcon },
  system: { label: "系统审计", icon: HistoryIcon },
} as const;

function SessionItem({
  s,
  active,
  displayTitle,
  hasPending,
  unread,
  onClick,
  onCancel,
  controlling,
  deleted,
}: {
  s: Session;
  active: boolean;
  displayTitle: string;
  hasPending?: boolean;
  unread?: number;
  onClick: () => void;
  onCancel?: () => void;
  controlling?: boolean;
  deleted?: boolean;
}) {
  const icon = deleted ? (
    <Trash2Icon className="size-3.5 text-destructive" />
  ) : s.role === "worker" ? (
    statusIcon(s.status)
  ) : s.live ? (
    <Loader2Icon className="size-3.5 animate-spin text-blue-500" />
  ) : null;

  const cancellable =
    s.role === "worker" &&
    !s.inherited &&
    !deleted &&
    // pending = 待领(open)意图;连同运行中/已暂停都允许删除。
    (s.status === "running" || s.status === "paused" || s.status === "pending");
  return (
    <div
      className={cn(
        "group/session flex w-full items-center rounded-md transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5 text-left text-sm"
      >
        {icon ?? <span className="size-3.5 shrink-0" />}
        {s.intent_id && (
          <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            #{s.intent_id}
          </span>
        )}
        {s.inherited && s.source_task_id && (
          <Badge variant="outline" className="shrink-0">
            来源 #{s.source_task_id}
          </Badge>
        )}
        <span
          className={cn("min-w-0 flex-1 truncate text-sm font-medium", deleted && "text-muted-foreground line-through")}
        >
          {displayTitle}
        </span>
        {deleted && (
          <Badge variant="outline" className="shrink-0 border-destructive/40 text-destructive">
            已删除
          </Badge>
        )}
        {hasPending && <ShieldAlertIcon className="size-3.5 shrink-0 text-amber-500" />}
        {!active && unread ? (
          <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-blue-500/15 px-1 text-[10px] font-medium tabular-nums text-blue-600 dark:text-blue-400">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
        {s.live && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
            <span className="size-1 animate-pulse rounded-full bg-blue-500" />
            实时
          </span>
        )}
      </button>
      {cancellable && (
        <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/session:opacity-100 sm:group-focus-within/session:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            disabled={controlling}
            title="删除该意图（需填写原因，可选假删除/真删除）"
            aria-label="删除该意图（需填写原因，可选假删除/真删除）"
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon />
          </Button>
        </div>
      )}
    </div>
  );
}

// Left column: the grouped session list (role sections, unread/live badges, pending
// approval icons) plus the mobile collapse header and the task-wide token total.
export function SessionList({
  sessions,
  activeId,
  sessionMeta,
  unreadOf,
  hasPending,
  controllingIntent,
  onSelect,
  onCancel,
  sseLive,
  taskTokens,
  listOpen,
  onToggleList,
  activeDisplayTitle,
  hiddenUnread,
  creatingMain,
  onNewMain,
  intentsHasMore,
  loadingOlderIntents,
  olderIntentsError,
  onLoadOlderIntents,
  mainLoaded,
  workerCount,
}: {
  sessions: Session[];
  activeId: string;
  sessionMeta: Map<string, SessionMeta>;
  unreadOf: (s: Session) => number | undefined;
  hasPending: (s: Session) => boolean;
  controllingIntent: string | null;
  onSelect: (s: Session) => void;
  onCancel: (s: Session) => void;
  sseLive: boolean;
  taskTokens: TokenTotal | null;
  listOpen: boolean;
  onToggleList: () => void;
  activeDisplayTitle: string;
  hiddenUnread: number;
  creatingMain: boolean;
  onNewMain: () => void;
  intentsHasMore: boolean;
  loadingOlderIntents: boolean;
  olderIntentsError: string;
  onLoadOlderIntents: () => void;
  mainLoaded: boolean;
  workerCount: number;
}) {
  const grouped = {
    mainagent: sessions.filter((s) => s.role === "mainagent"),
    planner: sessions.filter((s) => s.role === "planner"),
    worker: sessions.filter((s) => s.role === "worker"),
    system: sessions.filter((s) => s.role === "system"),
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleList}
            aria-expanded={listOpen}
            aria-controls="session-list-panel"
            className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs font-medium text-muted-foreground lg:pointer-events-none"
          >
            <ChevronDownIcon
              className={cn("size-3.5 shrink-0 transition-transform lg:hidden", !listOpen && "-rotate-90")}
            />
            <span className="shrink-0">会话列表</span>
            {!listOpen && (
              <>
                <span className="min-w-0 truncate text-foreground lg:hidden" title={activeDisplayTitle}>
                  · {activeDisplayTitle}
                </span>
                {hiddenUnread > 0 && (
                  <span className="inline-flex min-w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/15 px-1 text-[10px] font-medium tabular-nums text-blue-600 lg:hidden dark:text-blue-400">
                    {hiddenUnread > 99 ? "99+" : hiddenUnread}
                  </span>
                )}
              </>
            )}
          </button>
          {(
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px]",
                sseLive ? "text-emerald-500" : "text-amber-500",
              )}
              title={sseLive ? "实时连接正常" : "实时连接中断，正在自动重连（历史仍可见）"}
            >
              {sseLive ? (
                <>
                  <span className="size-1 animate-pulse rounded-full bg-emerald-500" />
                  实时
                </>
              ) : (
                <>
                  <WifiOffIcon className="size-3" />
                  重连中
                </>
              )}
            </span>
          )}
        </div>
        {taskTokens && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <span>任务总计</span>
                <span>·</span>
                <TokenMetrics
                  input={taskTokens.input_tokens}
                  cache={taskTokens.cache_read_tokens}
                  output={taskTokens.output_tokens}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              输入 {taskTokens.input_tokens.toLocaleString()} · 输出 {taskTokens.output_tokens.toLocaleString()} ·
              缓存读取 {taskTokens.cache_read_tokens.toLocaleString()} · 缓存写入{" "}
              {taskTokens.cache_write_tokens.toLocaleString()}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <ScrollArea
        id="session-list-panel"
        type="auto"
        className={cn("min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!", !listOpen && "max-lg:hidden")}
      >
        <div className="flex w-full flex-col gap-3 p-2">
          {(["mainagent", "planner", "system", "worker"] as const).map((role) => {
            const items = grouped[role];
            if (!items.length) return null;
            const Meta = roleMeta[role];
            return (
              <div key={role} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                  <Meta.icon className="size-3.5" />
                  {Meta.label}
                  {role === "mainagent" && (
                    <button
                      type="button"
                      onClick={onNewMain}
                      disabled={creatingMain}
                      title="新建主 Agent 会话（清空上下文，任务状态保留）"
                      aria-label="新建主 Agent 会话"
                      className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground disabled:opacity-50"
                    >
                      {creatingMain ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <PlusIcon className="size-3.5" />
                      )}
                      新建
                    </button>
                  )}
                </div>
                {items.map((s) => {
                  const meta = s.role === "worker" ? sessionMeta.get(s.id) : undefined;
                  return (
                    <SessionItem
                      key={s.id}
                      s={s}
                      active={s.id === activeId}
                      displayTitle={meta?.title ?? s.title}
                      hasPending={hasPending(s)}
                      unread={unreadOf(s)}
                      onClick={() => onSelect(s)}
                      controlling={controllingIntent === s.intent_id}
                      deleted={meta?.deleted}
                      onCancel={() => onCancel(s)}
                    />
                  );
                })}
                {role === "worker" && intentsHasMore && (
                  <>
                    <button
                      type="button"
                      onClick={onLoadOlderIntents}
                      disabled={loadingOlderIntents}
                      className="mt-0.5 flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50"
                    >
                      {loadingOlderIntents ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCwIcon className="size-3.5" />
                      )}
                      加载更早的 Worker
                    </button>
                    {olderIntentsError && !loadingOlderIntents && (
                      <p className="px-2 text-center text-[11px] text-red-500" role="alert">
                        加载更早的 Worker 失败：{olderIntentsError}，可再次点击重试
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {mainLoaded && !workerCount && (
            <div className="px-2 py-1 text-xs text-muted-foreground">暂无运行中的 Worker 会话。</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
