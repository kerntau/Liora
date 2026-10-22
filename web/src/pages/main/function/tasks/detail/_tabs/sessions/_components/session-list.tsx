import * as React from "react";

import {
  BotIcon,
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
  SearchIcon,
  ShieldAlertIcon,
  Trash2Icon,
  WifiOffIcon,
  ZapOffIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { statusMeta } from "@/lib/status";
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
      return <Loader2Icon className="size-3.5 animate-spin text-primary" />;
    case "paused":
      return <PauseIcon className="size-3.5 text-warning" />;
    case "pending": // 待领取(open intent)
      return <ClockIcon className="size-3.5 text-muted-foreground" />;
    case "done": // 完成
      return <CircleCheckIcon className="size-3.5 text-success" />;
    case "stopped": // 取消/停止(被 planner 终止)
      return <CircleSlashIcon className="size-3.5 text-warning" />;
    case "blocked": // 出错
      return <CircleXIcon className="size-3.5 text-destructive" />;
    case "exhausted": // 步数耗尽(撞 max_turns)
      return <ZapOffIcon className="size-3.5 text-chart-4" />;
    case "deleted": // 用户假删除
      return <CircleSlashIcon className="size-3.5 text-muted-foreground" />;
  }
}

// 会话列表动辄上百个 Worker，只能靠 Tab 遍历的话键盘用户基本走不到底。方向键在
// 会话项之间移动焦点，Home/End 跳到首尾；不改 role、不接管 Enter/Space——选中仍然
// 由原生 button 的点击语义完成，鼠标与读屏行为不变。
function focusSibling(event: React.KeyboardEvent<HTMLButtonElement>, move: "prev" | "next" | "first" | "last") {
  const list = event.currentTarget.closest("[data-session-list]");
  if (!list) return;
  const items = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-session-item]"));
  if (!items.length) return;
  const current = items.indexOf(event.currentTarget);
  let index = 0;
  if (move === "last") index = items.length - 1;
  else if (move === "next") index = Math.min(items.length - 1, Math.max(0, current) + 1);
  else if (move === "prev") index = Math.max(0, (current < 0 ? 0 : current) - 1);
  event.preventDefault();
  items[index]?.focus();
}

const roleMeta = {
  mainagent: { label: "主 Agent", icon: BotIcon },
  planner: { label: "规划 Planner", icon: BrainIcon },
  worker: { label: "Worker", icon: RadioIcon },
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
    <Loader2Icon className="size-3.5 animate-spin text-primary" />
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
        "group/session flex w-full items-center gap-0.5 rounded-lg border transition-colors",
        active
          ? "border-primary/20 bg-brand-soft"
          : "border-transparent hover:border-border/70 hover:bg-surface-muted",
      )}
    >
      <button
        type="button"
        data-session-item
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        title={displayTitle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") focusSibling(event, "next");
          else if (event.key === "ArrowUp") focusSibling(event, "prev");
          else if (event.key === "Home") focusSibling(event, "first");
          else if (event.key === "End") focusSibling(event, "last");
        }}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="grid size-4 shrink-0 place-items-center">{icon}</span>
        {s.role === "worker" && !deleted && <span className="sr-only">{statusMeta("intent", s.status).label}</span>}
        {s.intent_id && (
          <span className="inline-flex h-4 shrink-0 items-center rounded bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground">
            #{s.intent_id}
          </span>
        )}
        {s.inherited && s.source_task_id && (
          <Badge variant="outline" className="shrink-0">
            来源 #{s.source_task_id}
          </Badge>
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            active ? "font-medium text-foreground" : "text-foreground/90",
            deleted && "text-muted-foreground line-through",
          )}
        >
          {displayTitle}
        </span>
        {deleted && (
          <Badge variant="outline" className="shrink-0 border-destructive/40 text-destructive">
            已删除
          </Badge>
        )}
        {hasPending && (
          <span className="inline-flex shrink-0" title="有待审批的拦截请求">
            <ShieldAlertIcon className="size-3.5 text-warning" />
          </span>
        )}
        {!active && unread ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary/15 px-1 text-[10px] font-medium tabular-nums text-primary">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
        {s.live && (
          <span className="inline-flex h-4 items-center gap-1 rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            <span className="size-1 animate-pulse rounded-full bg-primary" />
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
  // 上百个 Worker 时靠滚动找会话很费劲；这里只做本地过滤，不触发任何请求，
  // 也不改变选中态与折叠逻辑。
  const [query, setQuery] = React.useState("");
  const keyword = query.trim().toLowerCase();
  const titleOf = React.useCallback(
    (s: Session) => (s.role === "worker" ? (sessionMeta.get(s.id)?.title ?? s.title) : s.title),
    [sessionMeta],
  );
  const visible = React.useMemo(() => {
    if (!keyword) return sessions;
    return sessions.filter((s) => {
      if (titleOf(s).toLowerCase().includes(keyword)) return true;
      if ((s.intent_id ?? "").toLowerCase().includes(keyword)) return true;
      return s.id.toLowerCase().includes(keyword);
    });
  }, [keyword, sessions, titleOf]);

  const grouped = {
    mainagent: visible.filter((s) => s.role === "mainagent"),
    planner: visible.filter((s) => s.role === "planner"),
    worker: visible.filter((s) => s.role === "worker"),
    system: visible.filter((s) => s.role === "system"),
  };

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-2 border-b border-border/70 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleList}
            aria-expanded={listOpen}
            aria-controls="session-list-panel"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left lg:pointer-events-none"
          >
            <ChevronDownIcon
              className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform lg:hidden", !listOpen && "-rotate-90")}
            />
            <span className="shrink-0 text-[13px] font-semibold text-foreground">会话列表</span>
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">{visible.length}</span>
            {!listOpen && (
              <>
                <span className="min-w-0 truncate text-[12px] text-muted-foreground lg:hidden" title={activeDisplayTitle}>
                  · {activeDisplayTitle}
                </span>
                {hiddenUnread > 0 && (
                  <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded bg-primary/15 px-1 text-[10px] font-medium tabular-nums text-primary lg:hidden">
                    {hiddenUnread > 99 ? "99+" : hiddenUnread}
                  </span>
                )}
              </>
            )}
          </button>
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center gap-1 rounded-md border px-1.5 text-[11px] leading-none",
              // warning 令牌在浅色下只有约 2.3:1，文字用 700 档；深色保留高亮色。
              sseLive
                ? "border-success/25 bg-success/10 text-success"
                : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}
            title={sseLive ? "实时连接正常" : "实时连接中断，正在自动重连（历史仍可见）"}
          >
            {sseLive ? (
              <>
                <span className="size-1 animate-pulse rounded-full bg-success" />
                实时
              </>
            ) : (
              <>
                <WifiOffIcon className="size-3" />
                重连中
              </>
            )}
          </span>
        </div>
        <div className={cn("relative", !listOpen && "max-lg:hidden")}>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索会话 / 编号"
            aria-label="搜索会话"
            className="h-8 pl-8 text-[12px] md:text-[12px]"
          />
        </div>
      </div>
      <ScrollArea
        id="session-list-panel"
        type="auto"
        className={cn("min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:block!", !listOpen && "max-lg:hidden")}
      >
        <div data-session-list className="flex w-full flex-col gap-3 px-3 py-2">
          {(["mainagent", "planner", "system", "worker"] as const).map((role) => {
            const items = grouped[role];
            if (!items.length) return null;
            const Meta = roleMeta[role];
            return (
              <div key={role} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-muted-foreground">
                  <Meta.icon className="size-3.5" />
                  {Meta.label}
                  <span className="tabular-nums text-muted-foreground/80">{items.length}</span>
                  {role === "mainagent" && (
                    <button
                      type="button"
                      onClick={onNewMain}
                      disabled={creatingMain}
                      title="新建主 Agent 会话（清空上下文，任务状态保留）"
                      aria-label="新建主 Agent 会话"
                      className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
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
                      displayTitle={titleOf(s)}
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
                      className="mt-0.5 flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-60"
                    >
                      {loadingOlderIntents ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCwIcon className="size-3.5" />
                      )}
                      加载更早的 Worker
                    </button>
                    {olderIntentsError && !loadingOlderIntents && (
                      <p className="px-2 text-center text-[12px] text-destructive" role="alert">
                        加载更早的 Worker 失败：{olderIntentsError}，可再次点击重试
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {keyword && visible.length === 0 && (
            <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">没有匹配的会话。</p>
          )}
          {!keyword && mainLoaded && !workerCount && (
            <div className="rounded-lg border border-dashed border-border/70 px-3 py-2 text-[12px] text-muted-foreground">
              暂无运行中的 Worker 会话。
            </div>
          )}
        </div>
      </ScrollArea>
      {taskTokens && (
        <div className="border-t border-border/70 px-3 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="shrink-0">任务总计</span>
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
        </div>
      )}
    </div>
  );
}
