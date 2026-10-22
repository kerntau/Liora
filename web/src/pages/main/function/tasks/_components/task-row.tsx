"use client";

import * as React from "react";

import Link from "@/lib/router-compat";

import {
  ArchiveIcon,
  EyeIcon,
  Loader2Icon,
  PauseIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlayIcon,
  StarIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DeleteTaskOptions, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  ARCHIVABLE_STATUSES,
  fmtDateTime,
  fmtDuration,
  fmtTokens,
  taskControlAction,
  taskDuration,
  taskIsPinned,
} from "../task-format";

import { DeleteTaskDialog } from "./delete-task-dialogs";

// TaskRowSkeleton 是首载占位行:列数与行高跟 TaskRow 对齐,整表骨架而不是居中 Spinner,
// 数据回来时表格不会从空态跳成满屏行。
export function TaskRowSkeleton() {
  return (
    <TableRow aria-hidden className="border-border/60">
      <TableCell className="pl-4 lg:pl-5">
        <div className="bg-muted h-4 w-4 animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="bg-muted h-4 w-10 animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="bg-muted h-4 w-28 animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1.5">
          <div className="bg-muted h-3.5 w-40 animate-pulse rounded" />
          <div className="bg-muted h-3 w-24 animate-pulse rounded" />
        </div>
      </TableCell>
      <TableCell>
        <div className="bg-muted h-5 w-16 animate-pulse rounded-md" />
      </TableCell>
      <TableCell>
        <div className="bg-muted mx-auto h-3.5 w-10 animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="bg-muted ml-auto h-4 w-16 animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="bg-muted ml-auto h-4 w-14 animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="bg-muted ml-auto h-4 w-12 animate-pulse rounded" />
      </TableCell>
      <TableCell>
        <div className="bg-muted ml-auto h-4 w-24 animate-pulse rounded" />
      </TableCell>
    </TableRow>
  );
}

// 行内图标按钮:默认是低对比的次要色,悬停整行才提到正文色,避免操作列抢走数据列的注意力。
const rowActionClass = "text-muted-foreground transition-colors group-hover:text-foreground";

// TaskRow renders one row of the task table. Memoized so the per-second 运行时长 tick and
// the POLL_MS list refresh only re-render the rows whose data actually moved — a table page
// is 20 rows × (StatusBadge + Link + a Radix AlertDialog tree), far too heavy to rebuild
// wholesale on every parent render.
export const TaskRow = React.memo(function TaskRow({
  task,
  nowSec,
  onDelete,
  onControl,
  onRename,
  onTogglePinned,
  onArchive,
  selected,
  onSelectedChange,
}: {
  task: Task;
  nowSec: number;
  onDelete: (id: string, options: DeleteTaskOptions) => Promise<void>;
  onControl: (id: string, action: "pause" | "resume") => Promise<void>;
  onRename: (task: Task, name: string) => Promise<void>;
  onTogglePinned: (task: Task) => Promise<void>;
  onArchive: (task: Task) => Promise<void>;
  selected: boolean;
  onSelectedChange: (id: string, checked: boolean) => void;
}) {
  const hasGoals = typeof task.goals_total === "number" && task.goals_total > 0;
  const inFlight = task.in_flight ?? 0;
  return (
    <TableRow className="group border-border/60" data-state={selected ? "selected" : undefined}>
      <TableCell className="pl-4 lg:pl-5">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(task.id, checked === true)}
          aria-label={`选择任务 ${task.id}`}
        />
      </TableCell>
      <TableCell>
        <code className="bg-surface-muted text-muted-foreground rounded-sm px-1.5 py-0.5 font-mono text-[11px]">
          {task.id}
        </code>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex min-w-0 items-center gap-1.5">
          <TaskNameEditor task={task} onRename={onRename} />
          {task.active && <StarIcon className="fill-warning text-warning size-3.5 shrink-0" aria-label="当前活动任务" />}
          {taskIsPinned(task) && <PinIcon className="text-primary size-3.5 shrink-0" aria-label="已置顶" />}
        </div>
      </TableCell>
      <TableCell className="whitespace-normal">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`}
            className="text-foreground block truncate rounded-sm text-[13px] hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            title={task.description}
          >
            {task.description}
          </Link>
          <span className="text-muted-foreground block truncate text-[12px]" title={task.goal}>
            <span className="text-muted-foreground/70">目标 · </span>
            {task.goal}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge domain="task" value={task.status} dot />
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-foreground text-[13px] tabular-nums">
            {hasGoals ? `${task.goals_met}/${task.goals_total}` : <span className="text-muted-foreground">—</span>}
          </span>
          <span
            className={cn(
              "text-[12px] whitespace-nowrap tabular-nums",
              inFlight > 0 ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            Worker {inFlight}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap tabular-nums">
        {fmtDateTime(task.created_unix)}
      </TableCell>
      <TableCell className="text-right text-xs whitespace-nowrap tabular-nums">
        {(() => {
          const secs = taskDuration(task, nowSec);
          if (secs <= 0) return <span className="text-muted-foreground">—</span>;
          return (
            <span className={task.status === "running" ? "text-foreground font-medium" : "text-muted-foreground"}>
              {fmtDuration(secs)}
            </span>
          );
        })()}
      </TableCell>
      <TableCell
        className="text-right text-[12px] tabular-nums"
        title={
          task.tokens
            ? `输入 ${task.tokens.input_tokens} · 缓存 ${task.tokens.cache_read_tokens} · 输出 ${task.tokens.output_tokens}`
            : undefined
        }
      >
        {task.tokens ? (
          <div className="flex flex-col items-end gap-0.5 leading-tight">
            <span className="text-foreground">入 {fmtTokens(task.tokens.input_tokens)}</span>
            <span className="text-muted-foreground">
              出 {fmtTokens(task.tokens.output_tokens)} · 缓 {fmtTokens(task.tokens.cache_read_tokens)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="bg-card text-right group-hover:bg-[color-mix(in_srgb,var(--muted)_55%,transparent)] group-data-[state=selected]:bg-accent md:sticky md:right-0 md:z-10 md:shadow-[-1px_0_0_0_var(--border)]">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            asChild
            aria-label="查看任务详情"
            title="查看任务详情"
            className={rowActionClass}
          >
            <Link href={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`}>
              <EyeIcon />
            </Link>
          </Button>
          <TaskControlButton task={task} onControl={onControl} />
          <TaskPinAction task={task} onTogglePinned={onTogglePinned} />
          <TaskArchiveAction task={task} onArchive={onArchive} />
          <DeleteTaskDialog task={task} onDelete={onDelete} />
        </div>
      </TableCell>
    </TableRow>
  );
});

function TaskNameEditor({ task, onRename }: { task: Task; onRename: (task: Task, name: string) => Promise<void> }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(task.name ?? "");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cancelOnBlurRef = React.useRef(false);

  React.useEffect(() => {
    if (!editing) setName(task.name ?? "");
  }, [editing, task.name]);

  async function finishEditing() {
    if (cancelOnBlurRef.current) {
      cancelOnBlurRef.current = false;
      setName(task.name ?? "");
      setEditing(false);
      return;
    }

    const next = name.trim();
    if (!next || next === task.name?.trim()) {
      setName(task.name ?? "");
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onRename(task, next);
      setEditing(false);
    } catch {
      requestAnimationFrame(() => inputRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <Input
          ref={inputRef}
          value={name}
          maxLength={200}
          autoFocus
          disabled={saving}
          aria-label={`任务 #${task.id} 名称`}
          className="h-7 min-w-28 max-w-48 px-2 font-medium"
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void finishEditing()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelOnBlurRef.current = true;
              event.currentTarget.blur();
            }
          }}
        />
        {saving && <Spinner className="shrink-0" />}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Link
        href={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`}
        className="min-w-0 truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={task.name?.trim() ? task.name : task.description}
      >
        {task.name?.trim() ? task.name : <span className="text-muted-foreground">未命名</span>}
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground shrink-0 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
        aria-label={`重命名任务 #${task.id}`}
        title="重命名"
        onClick={() => {
          setName(task.name ?? "");
          setEditing(true);
        }}
      >
        <PencilIcon />
      </Button>
    </div>
  );
}

function taskPinIcon(pinning: boolean, pinned: boolean) {
  if (pinning) return <Spinner />;
  if (pinned) return <PinOffIcon />;
  return <PinIcon />;
}

function TaskPinAction({ task, onTogglePinned }: { task: Task; onTogglePinned: (task: Task) => Promise<void> }) {
  const [pinning, setPinning] = React.useState(false);
  const pinned = taskIsPinned(task);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pinning}
      aria-label={pinned ? `取消置顶任务 #${task.id}` : `置顶任务 #${task.id}`}
      title={pinned ? "取消置顶" : "置顶"}
      className={rowActionClass}
      onClick={async () => {
        if (pinning) return;
        setPinning(true);
        try {
          await onTogglePinned(task);
        } catch {
          // 失败提示由 onTogglePinned toast;这里吞掉异常避免未处理的 Promise 拒绝,
          // 按钮在 finally 里恢复可点,用户可直接重试。
        } finally {
          setPinning(false);
        }
      }}
    >
      {taskPinIcon(pinning, pinned)}
    </Button>
  );
}

// 三态图标分开写而非嵌套三元:仓库 Biome 基线禁 noNestedTernary。
function taskControlIcon(pending: boolean, action: "pause" | "resume" | null) {
  if (pending) return <Loader2Icon className="animate-spin" />;
  if (action === "resume") return <PlayIcon />;
  return <PauseIcon />;
}

// TaskControlButton 是行内的暂停/继续开关。终态任务渲染为 disabled 而不是隐藏,
// 这样各行操作列宽度一致,按钮位置不会随状态跳动。
function TaskControlButton({
  task,
  onControl,
}: {
  task: Task;
  onControl: (id: string, action: "pause" | "resume") => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false);
  const action = taskControlAction(task.status);
  const label = action === "resume" ? "继续任务" : "暂停任务";
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={action ? label : "该状态不可暂停或继续"}
      disabled={!action || pending}
      className={rowActionClass}
      onClick={async () => {
        if (!action) return;
        setPending(true);
        try {
          await onControl(task.id, action);
        } finally {
          setPending(false);
        }
      }}
    >
      {taskControlIcon(pending, action)}
    </Button>
  );
}

function archiveBlockReason(task: Task): string {
  if (task.queued) return "排队中的任务必须先暂停";
  if (!ARCHIVABLE_STATUSES.has(task.status)) return "运行中或尚未结束的任务必须先暂停";
  if (task.archive_blocked_by_task_id) {
    return `任务被未归档任务 #${task.archive_blocked_by_task_id} 直接继承，请先归档依赖任务`;
  }
  return "";
}

export function ArchiveConfirmDialog({
  count,
  trigger,
  onConfirm,
}: {
  count: number;
  trigger: React.ReactNode;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{count === 1 ? "归档任务" : `归档 ${count} 个任务`}</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            归档会停止任务调度，将图谱、LLM 历史、文件以及独占资产和流量压缩到本地冷存储。归档完成后可从“已归档”中还原。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={async (event) => {
              event.preventDefault();
              if (pending) return;
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                // 归档失败时保持确认框打开(失败原因已由 onConfirm toast),便于重试。
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Spinner data-icon="inline-start" />}
            确认归档
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TaskArchiveAction({ task, onArchive }: { task: Task; onArchive: (task: Task) => Promise<void> }) {
  const reason = archiveBlockReason(task);
  const trigger = (
    <Button
      size="icon-sm"
      variant="ghost"
      disabled={Boolean(reason)}
      aria-label={`归档任务 #${task.id}`}
      title="归档任务"
      className={rowActionClass}
    >
      <ArchiveIcon />
    </Button>
  );
  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{trigger}</span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    );
  }
  return <ArchiveConfirmDialog count={1} trigger={trigger} onConfirm={() => onArchive(task)} />;
}
