import * as React from "react";
import { Link } from "react-router";
import { AlertDialog, Button, buttonVariants, Card, Checkbox, Chip, Description, Fieldset, Input, Label, ListBox, Meter, Modal, NumberField, SearchField, Select, Spinner, Surface, Switch, Table, TextField, Tooltip, } from "@/components/mui-compat";
import { ArchiveIcon, ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, EyeIcon, FolderInputIcon, Loader2Icon, PauseIcon, PencilIcon, PinIcon, PinOffIcon, PlayIcon, SearchIcon, SlidersHorizontalIcon, StarIcon, Trash2Icon, Undo2Icon, } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { TablePagination } from "@/components/table-pagination";
import { api } from "@/lib/api";
import { type SortDirection } from "@/lib/sort-preference";
import type { DeleteTaskOptions, Task, TaskArchive, TaskArchiveState, TaskCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ARCHIVABLE_STATUSES, fmtDateTime, fmtDuration, fmtTokens, TaskSortField, taskControlAction, taskDuration, taskIsPinned, UNCATEGORIZED_VALUE, } from "./task-shared";
export function taskSortIcon(active: boolean, direction: SortDirection) {
    if (!active) {
        return <ArrowUpDownIcon className="size-3.5 opacity-40 transition-opacity group-hover/sort:opacity-100"/>;
    }
    if (direction === "asc")
        return <ArrowUpIcon className="size-3.5"/>;
    return <ArrowDownIcon className="size-3.5"/>;
}
export function SortableTaskHead({ field, label, activeField, direction, align = "left", className, onSort, }: {
    field: TaskSortField;
    label: string;
    activeField: TaskSortField;
    direction: SortDirection;
    align?: "left" | "right";
    className?: string;
    onSort: (field: TaskSortField) => void;
}) {
    const active = activeField === field;
    let ariaSort: React.AriaAttributes["aria-sort"] = "none";
    if (active)
        ariaSort = direction === "asc" ? "ascending" : "descending";
    let actionLabel = `按${label}倒序排序`;
    if (active)
        actionLabel = `${label}当前${direction === "asc" ? "正序" : "倒序"}，点击切换排序方向`;
    return (<Table.Column id={field} allowsSorting isRowHeader={field === "id"} className={className} aria-label={label}>
      {({ sortDirection }: { sortDirection?: "ascending" | "descending" }) => (<Table.SortableColumnHeader sortDirection={sortDirection} className={cn("cursor-pointer", align === "right" && "justify-end")}>
          {label}
        </Table.SortableColumnHeader>)}
    </Table.Column>);
}
export function ConcurrencySettingsDialog() {
    const [open, setOpen] = React.useState(false);
    const [enabled, setEnabled] = React.useState(false);
    const [limit, setLimit] = React.useState("5");
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    React.useEffect(() => {
        if (!open)
            return;
        setLoading(true);
        api
            .settings()
            .then((settings) => {
            setEnabled(!!settings.task_concurrency_enabled);
            setLimit(String(settings.task_concurrency_limit ?? 5));
        })
            .catch(() => {
            // Keep the dialog usable with defaults; reopening retries the request.
        })
            .finally(() => setLoading(false));
    }, [open]);
    async function save() {
        const nextLimit = Math.max(1, Math.floor(Number(limit) || 5));
        setSaving(true);
        try {
            await api.setSettings({ task_concurrency_enabled: enabled, task_concurrency_limit: nextLimit });
            toast.success(enabled ? `已开启并发限制：最多同时运行 ${nextLimit} 个任务` : "已关闭任务并发限制");
            setOpen(false);
        }
        catch (error) {
            toast.error(`保存失败：${(error as Error).message}`);
        }
        finally {
            setSaving(false);
        }
    }
    return (<Modal isOpen={open} onOpenChange={setOpen}>
      
        <Button size="sm" className="ml-auto" aria-label="任务并发设置" variant={"outline"}>
          <SlidersHorizontalIcon /> 并发设置
        </Button>
      
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger aria-label="关闭"/>
            <Modal.Header>
              <Modal.Heading>任务并发限制</Modal.Heading>
              <Description>
                限制同时运行的任务数量。达到上限后，新任务会按创建顺序排队并在空位出现时自动启动。
              </Description>
            </Modal.Header>
            <div className="grid gap-5 py-2">
              <div className="flex items-center justify-between gap-4">
                <div className="grid gap-1">
                  <Label htmlFor="task-concurrency-enabled">开启任务并发限制</Label>
                  <span className="text-muted text-xs">默认关闭</span>
                </div>
                <Switch id="task-concurrency-enabled" isSelected={enabled} onChange={setEnabled} isDisabled={loading} aria-label={"task-concurrency-enabled"}>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              {enabled && (<div className="grid gap-2">
                  <Label htmlFor="task-concurrency-limit">同时运行上限</Label>
                  <NumberField id="task-concurrency-limit" minValue={1} className="w-32" isDisabled={loading} onChange={(nextValue: any) => setLimit(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"task-concurrency-limit"} value={String(limit) === "" ? NaN : Number(limit)}>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                </div>)}
            </div>
            <Modal.Footer>
              <Button slot="close">
                <Button variant={"outline"}>取消</Button>
              </Button>
              <Button onPress={save} isDisabled={loading || saving}>
                {saving && <Loader2Icon className="animate-spin"/>} 保存
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>);
}
export const TaskRow = React.memo(function TaskRow({ task, nowSec, onDelete, onControl, onRename, onTogglePinned, onArchive, selected, onSelectedChange, }: {
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
    return (<Table.Row className="group border-border/60" data-state={selected ? "selected" : undefined} id={task.id}>
      <Table.Cell>
        <Checkbox slot={null} onChange={(checked: any) => onSelectedChange(task.id, checked === true)} aria-label={`选择任务 ${task.id}`} isSelected={selected === true}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      </Table.Cell>
      <Table.Cell>
        <code className="bg-surface-secondary rounded px-1.5 py-0.5 font-mono text-xs">{task.id}</code>
      </Table.Cell>
      <Table.Cell className="font-medium">
        <div className="flex max-w-xs items-center gap-2">
          <TaskNameEditor task={task} onRename={onRename}/>
          {task.active && <StarIcon className="size-4 shrink-0 fill-warning text-warning"/>}
          {taskIsPinned(task) && <PinIcon className="text-accent size-4 shrink-0" aria-label="已置顶"/>}
        </div>
      </Table.Cell>
      <Table.Cell className="text-muted max-w-xs">
        <Link to={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`} className="block truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" title={task.description}>
          {task.description}
        </Link>
      </Table.Cell>
      <Table.Cell className="text-muted max-w-xs truncate">{task.goal}</Table.Cell>
      <Table.Cell>
        <StatusBadge domain="task" value={task.status} dot/>
      </Table.Cell>
      <Table.Cell className="text-muted text-center text-xs tabular-nums">
        {typeof task.goals_total === "number" && task.goals_total > 0 ? (`${task.goals_met}/${task.goals_total}`) : (<span className="text-muted">—</span>)}
      </Table.Cell>
      <Table.Cell className="text-center text-xs tabular-nums">
        {task.in_flight && task.in_flight > 0 ? (<span className="text-foreground font-medium">{task.in_flight}</span>) : (<span className="text-muted">0</span>)}
      </Table.Cell>
      <Table.Cell className="text-muted text-right text-xs whitespace-nowrap tabular-nums">
        {fmtDateTime(task.created_unix)}
      </Table.Cell>
      <Table.Cell className="text-right text-xs whitespace-nowrap tabular-nums">
        {(() => {
            const secs = taskDuration(task, nowSec);
            if (secs <= 0)
                return <span className="text-muted">—</span>;
            return (<span className={task.status === "running" ? "text-foreground" : "text-muted"}>{fmtDuration(secs)}</span>);
        })()}
      </Table.Cell>
      <Table.Cell className="text-right text-xs whitespace-nowrap tabular-nums">
        <span title={task.tokens
            ? `输入 ${task.tokens.input_tokens} · 缓存 ${task.tokens.cache_read_tokens} · 输出 ${task.tokens.output_tokens}`
            : undefined} className="block truncate">
          {task.tokens ? (<span className="text-muted">
              入 <span className="text-foreground">{fmtTokens(task.tokens.input_tokens)}</span>
              {" · 缓 "}
              <span className="text-foreground">{fmtTokens(task.tokens.cache_read_tokens)}</span>
              {" · 出 "}
              <span className="text-foreground">{fmtTokens(task.tokens.output_tokens)}</span>
            </span>) : ("—")}
        </span>
      </Table.Cell>
      <Table.Cell className="md:sticky right-0 z-10 bg-surface text-right md:shadow-[-1px_0_0_0_var(--border)] group-hover:bg-surface-secondary/50">
        <div className="flex items-center justify-end gap-0.5">
          <Link aria-label="查看任务详情" to={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`} className={cn(buttonVariants({ variant: "ghost", size: "sm", isIconOnly: true }))}>
            <EyeIcon />
          </Link>
          <TaskControlButton task={task} onControl={onControl}/>
          <TaskPinAction task={task} onTogglePinned={onTogglePinned}/>
          <TaskArchiveAction task={task} onArchive={onArchive}/>
          <DeleteTaskDialog task={task} onDelete={onDelete}/>
        </div>
      </Table.Cell>
    </Table.Row>);
});
export function TaskNameEditor({ task, onRename, }: {
    task: Task;
    onRename: (task: Task, name: string) => Promise<void>;
}) {
    const [editing, setEditing] = React.useState(false);
    const [name, setName] = React.useState(task.name ?? "");
    const [saving, setSaving] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const cancelOnBlurRef = React.useRef(false);
    React.useEffect(() => {
        if (!editing)
            setName(task.name ?? "");
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
        }
        catch {
            requestAnimationFrame(() => inputRef.current?.focus());
        }
        finally {
            setSaving(false);
        }
    }
    if (editing) {
        return (<div className="flex min-w-0 items-center gap-1">
        <TextField className="contents" aria-label={`任务 #${task.id} 名称`} isDisabled={saving}>
          <Input ref={inputRef} value={name} maxLength={200} autoFocus aria-label={`任务 #${task.id} 名称`} className="h-7 min-w-28 max-w-48 px-2 font-medium" onFocus={(event: any) => event.currentTarget.select()} onChange={(event: any) => setName(event.target.value)} onBlur={() => void finishEditing()} onKeyDown={(event: any) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                }
                else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelOnBlurRef.current = true;
                    event.currentTarget.blur();
                }
            }}/>
        </TextField>
        {saving && <Spinner className="shrink-0"/>}
      </div>);
    }
    return (<div className="flex min-w-0 items-center gap-1">
      <Link to={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`} className="min-w-0 truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" title={task.name?.trim() ? task.name : task.description}>
        {task.name?.trim() ? task.name : <span className="text-muted">未命名</span>}
      </Link>
      <Button type="button" className="shrink-0 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100" aria-label={`重命名任务 #${task.id}`} onPress={() => {
            setName(task.name ?? "");
            setEditing(true);
        }} size="sm" isIconOnly variant={"ghost"}>
        <PencilIcon />
      </Button>
    </div>);
}
export function taskPinIcon(pinning: boolean, pinned: boolean) {
    if (pinning)
        return <Spinner />;
    if (pinned)
        return <PinOffIcon />;
    return <PinIcon />;
}
export function TaskPinAction({ task, onTogglePinned }: {
    task: Task;
    onTogglePinned: (task: Task) => Promise<void>;
}) {
    const [pinning, setPinning] = React.useState(false);
    const pinned = taskIsPinned(task);
    return (<Button type="button" isDisabled={pinning} aria-label={pinned ? `取消置顶任务 #${task.id}` : `置顶任务 #${task.id}`} onPress={async () => {
            setPinning(true);
            try {
                await onTogglePinned(task);
            }
            finally {
                setPinning(false);
            }
        }} size="sm" isIconOnly variant={"ghost"}>
      {taskPinIcon(pinning, pinned)}
    </Button>);
}
export function taskControlIcon(pending: boolean, action: "pause" | "resume" | null) {
    if (pending)
        return <Loader2Icon className="animate-spin"/>;
    if (action === "resume")
        return <PlayIcon />;
    return <PauseIcon />;
}
export function TaskControlButton({ task, onControl, }: {
    task: Task;
    onControl: (id: string, action: "pause" | "resume") => Promise<void>;
}) {
    const [pending, setPending] = React.useState(false);
    const action = taskControlAction(task.status);
    const label = action === "resume" ? "继续任务" : "暂停任务";
    return (<Button aria-label={label} isDisabled={!action || pending} onPress={async () => {
            if (!action)
                return;
            setPending(true);
            try {
                await onControl(task.id, action);
            }
            finally {
                setPending(false);
            }
        }} size="sm" isIconOnly variant={"ghost"}>
      {taskControlIcon(pending, action)}
    </Button>);
}
export function archiveBlockReason(task: Task): string {
    if (task.queued)
        return "排队中的任务必须先暂停";
    if (!ARCHIVABLE_STATUSES.has(task.status))
        return "运行中或尚未结束的任务必须先暂停";
    if (task.archive_blocked_by_task_id) {
        return `任务被未归档任务 #${task.archive_blocked_by_task_id} 直接继承，请先归档依赖任务`;
    }
    return "";
}
export function ArchiveConfirmDialog({ count, trigger, onConfirm, }: {
    count: number;
    trigger: React.ReactNode;
    onConfirm: () => Promise<void>;
}) {
    const [open, setOpen] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    return (<AlertDialog isOpen={open} onOpenChange={(next: any) => !pending && setOpen(next)}>
      {trigger}
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{count === 1 ? "归档任务" : `归档 ${count} 个任务`}</AlertDialog.Heading>
              <AlertDialog.Body className="[overflow-wrap:anywhere]">
                归档会停止任务调度，将图谱、LLM
                历史、文件以及独占资产和流量压缩到本地冷存储。归档完成后可从“已归档”中还原。
              </AlertDialog.Body>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button isDisabled={pending} slot="close" variant={"outline"}>
                取消
              </Button>
              <Button isDisabled={pending} onClick={async (event: any) => {
            event.preventDefault();
            setPending(true);
            try {
                await onConfirm();
                setOpen(false);
            }
            finally {
                setPending(false);
            }
        }}>
                {pending && <Spinner data-icon="inline-start"/>}
                确认归档
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>);
}
export function TaskArchiveAction({ task, onArchive }: {
    task: Task;
    onArchive: (task: Task) => Promise<void>;
}) {
    const reason = archiveBlockReason(task);
    const trigger = (<Button isDisabled={Boolean(reason)} aria-label={`归档任务 #${task.id}`} size="sm" isIconOnly variant={"ghost"}>
      <ArchiveIcon />
    </Button>);
    if (reason) {
        return (<Tooltip>
        <span className="inline-flex">{trigger}</span>

        <Tooltip.Content>{reason}</Tooltip.Content>
      </Tooltip>);
    }
    return <ArchiveConfirmDialog count={1} trigger={trigger} onConfirm={() => onArchive(task)}/>;
}
export const ARCHIVE_PROCESSING_STATES = new Set<TaskArchiveState>([
    "archive_queued",
    "archiving",
    "restore_queued",
    "restoring",
    "delete_queued",
    "deleting",
]);
export const ARCHIVE_FAILED_STATES = new Set<TaskArchiveState>(["archive_failed", "restore_failed", "delete_failed"]);
export function archiveStateLabel(state: TaskArchiveState): string {
    const labels: Record<TaskArchiveState, string> = {
        archive_queued: "等待归档",
        archiving: "归档中",
        archive_failed: "归档失败",
        ready: "可还原",
        restore_queued: "等待还原",
        restoring: "还原中",
        restore_failed: "还原失败",
        delete_queued: "等待删除",
        deleting: "删除中",
        delete_failed: "删除失败",
    };
    return labels[state];
}
export function ArchiveStateBadge({ state }: {
    state: TaskArchiveState;
}) {
    const failed = ARCHIVE_FAILED_STATES.has(state);
    return (<Chip size="sm" color={failed ? "danger" : ARCHIVE_PROCESSING_STATES.has(state) ? "accent" : state === "ready" ? "success" : "default"} variant="soft">
      {archiveStateLabel(state)}
    </Chip>);
}
export function formatArchiveBytes(bytes: number): string {
    if (bytes <= 0)
        return "—";
    if (bytes >= 1024 ** 3)
        return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    if (bytes >= 1024 ** 2)
        return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes >= 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
}
export function archiveCompressionLabel(archive: TaskArchive): string {
    if (archive.original_size <= 0 || archive.compressed_size <= 0)
        return "—";
    const saved = Math.max(0, 100 - (archive.compressed_size / archive.original_size) * 100);
    return `${formatArchiveBytes(archive.compressed_size)} · 节省 ${saved.toFixed(0)}%`;
}
export function archiveDataTotal(archive: TaskArchive): number {
    return Object.values(archive.data_counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}
export function archiveDate(value?: string): string {
    if (!value)
        return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "—";
    return date.toLocaleString();
}
export function ArchiveDeleteDialog({ archives, onConfirm, trigger, }: {
    archives: TaskArchive[];
    onConfirm: () => Promise<void>;
    trigger: React.ReactNode;
}) {
    const [open, setOpen] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const rows = archives.reduce((sum, archive) => sum + archiveDataTotal(archive), 0);
    const bytes = archives.reduce((sum, archive) => sum + archive.compressed_size, 0);
    return (<AlertDialog isOpen={open} onOpenChange={(next: any) => !pending && setOpen(next)}>
      {trigger}
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>永久删除 {archives.length} 个任务归档？</AlertDialog.Heading>
              <AlertDialog.Body className="[overflow-wrap:anywhere]">
                将永久删除约 {formatArchiveBytes(bytes)} 的归档包及 {rows.toLocaleString()}{" "}
                条关联数据快照。此操作不可恢复。
              </AlertDialog.Body>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <Button isDisabled={pending} slot="close" variant={"outline"}>
                取消
              </Button>
              <Button isDisabled={pending} variant={"danger"} onClick={async (event: any) => {
            event.preventDefault();
            setPending(true);
            try {
                await onConfirm();
                setOpen(false);
            }
            finally {
                setPending(false);
            }
        }}>
                {pending && <Spinner data-icon="inline-start"/>}
                永久删除
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>);
}
export function TaskArchivesPanel({ onChanged }: {
    onChanged: () => void;
}) {
    const [archives, setArchives] = React.useState<TaskArchive[]>([]);
    const [query, setQuery] = React.useState("");
    const [stateFilter, setStateFilter] = React.useState("all");
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);
    const [total, setTotal] = React.useState(0);
    const [selected, setSelected] = React.useState<Set<number>>(() => new Set());
    const [loading, setLoading] = React.useState(true);
    const pendingRestoreIDs = React.useRef(new Set<number>());
    const load = React.useCallback(async () => {
        try {
            const result = await api.taskArchives({
                page,
                size: pageSize,
                q: query.trim(),
                state: stateFilter === "all" ? undefined : stateFilter,
            });
            setArchives(result.items);
            setTotal(result.total);
            setSelected((current) => {
                const visible = new Set(result.items.map((archive) => archive.id));
                return new Set([...current].filter((id) => visible.has(id)));
            });
            const pending = [...pendingRestoreIDs.current];
            if (pending.length > 0) {
                const states = await Promise.allSettled(pending.map((id) => api.taskArchive(id)));
                let restored = false;
                states.forEach((state, index) => {
                    if (state.status !== "rejected" || !(state.reason instanceof Error))
                        return;
                    if (!state.reason.message.includes("归档不存在"))
                        return;
                    pendingRestoreIDs.current.delete(pending[index]);
                    restored = true;
                });
                if (restored)
                    onChanged();
            }
        }
        catch (error) {
            toast.error(`读取归档列表失败：${(error as Error).message}`);
        }
        finally {
            setLoading(false);
        }
    }, [onChanged, page, pageSize, query, stateFilter]);
    React.useEffect(() => {
        void load();
        const timer = setInterval(() => void load(), 2000);
        return () => clearInterval(timer);
    }, [load]);
    const selectable = React.useMemo(() => archives.filter((archive) => !ARCHIVE_PROCESSING_STATES.has(archive.state)), [archives]);
    const selectedArchives = React.useMemo(() => archives.filter((archive) => selected.has(archive.id)), [archives, selected]);
    const restorable = selectedArchives.filter((archive) => archive.state === "ready" || archive.state === "restore_failed");
    const deletable = selectedArchives.filter((archive) => archive.state === "ready" || archive.state === "delete_failed");
    const selectedAll = selectable.length > 0 && selectable.every((archive) => selected.has(archive.id));
    const selectedSome = selectable.some((archive) => selected.has(archive.id));
    const afterAction = React.useCallback(() => {
        setSelected(new Set());
        void load();
        onChanged();
    }, [load, onChanged]);
    async function restoreMany(items: TaskArchive[]) {
        try {
            const result = items.length === 1
                ? {
                    items: [
                        {
                            id: String(items[0].id),
                            ok: true,
                            queued: true,
                            archive_id: (await api.restoreTaskArchive(items[0].id)).id,
                        },
                    ],
                }
                : await api.restoreTaskArchives(items.map((archive) => archive.id));
            const succeeded = result.items.filter((item) => item.ok).length;
            const failed = result.items.length - succeeded;
            for (const item of result.items) {
                const archiveID = Number(item.archive_id ?? item.id);
                if (item.ok && Number.isSafeInteger(archiveID) && archiveID > 0)
                    pendingRestoreIDs.current.add(archiveID);
            }
            if (succeeded > 0)
                toast.success(`已将 ${succeeded} 个任务加入还原队列`);
            if (failed > 0)
                toast.error(`${failed} 个任务无法还原`);
            afterAction();
        }
        catch (error) {
            toast.error(`还原失败：${(error as Error).message}`);
        }
    }
    async function deleteMany(items: TaskArchive[]) {
        try {
            const result = items.length === 1
                ? {
                    items: [
                        {
                            id: String(items[0].id),
                            ok: true,
                            queued: true,
                            archive_id: (await api.deleteTaskArchive(items[0].id)).id,
                        },
                    ],
                }
                : await api.deleteTaskArchives(items.map((archive) => archive.id));
            const succeeded = result.items.filter((item) => item.ok).length;
            const failed = result.items.length - succeeded;
            if (succeeded > 0)
                toast.success(`已将 ${succeeded} 个归档加入永久删除队列`);
            if (failed > 0)
                toast.error(`${failed} 个归档无法删除`);
            afterAction();
        }
        catch (error) {
            toast.error(`永久删除失败：${(error as Error).message}`);
            throw error;
        }
    }
    async function retry(archive: TaskArchive) {
        try {
            if (archive.state === "archive_failed")
                await api.archiveTask(String(archive.task_id));
            if (archive.state === "restore_failed")
                await api.restoreTaskArchive(archive.id);
            if (archive.state === "delete_failed")
                await api.deleteTaskArchive(archive.id);
            toast.success("已重新加入处理队列");
            afterAction();
        }
        catch (error) {
            toast.error(`重试失败：${(error as Error).message}`);
        }
    }
    return (<Card>
      <Card.Content className="flex flex-col gap-4 px-0 pt-6">
        <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"/>
            <SearchField value={query} className="pl-8" onChange={(nextValue: any) => {
            setQuery(nextValue);
            setPage(1);
        }} aria-label={"搜索任务名称 / 描述 / ID"}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={"搜索任务名称 / 描述 / ID"}/>
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
          <Select selectedKey={stateFilter} aria-label="选择选项" onSelectionChange={(key: any) => {
            if (key !== null)
                ((value) => {
                    setStateFilter(value);
                    setPage(1);
                })(String(key));
        }}>
            <Select.Trigger className="w-36">
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <>
                  <ListBox.Item id="all" textValue="全部状态">
                    全部状态
                  </ListBox.Item>
                  <ListBox.Item id="archive_queued" textValue="等待归档">
                    等待归档
                  </ListBox.Item>
                  <ListBox.Item id="archiving" textValue="归档中">
                    归档中
                  </ListBox.Item>
                  <ListBox.Item id="ready" textValue="可还原">
                    可还原
                  </ListBox.Item>
                  <ListBox.Item id="restore_queued" textValue="等待还原">
                    等待还原
                  </ListBox.Item>
                  <ListBox.Item id="restoring" textValue="还原中">
                    还原中
                  </ListBox.Item>
                  <ListBox.Item id="delete_queued" textValue="等待删除">
                    等待删除
                  </ListBox.Item>
                  <ListBox.Item id="deleting" textValue="删除中">
                    删除中
                  </ListBox.Item>
                  <ListBox.Item id="archive_failed" textValue="归档失败">
                    归档失败
                  </ListBox.Item>
                  <ListBox.Item id="restore_failed" textValue="还原失败">
                    还原失败
                  </ListBox.Item>
                  <ListBox.Item id="delete_failed" textValue="删除失败">
                    删除失败
                  </ListBox.Item>
                </>
              </ListBox>
            </Select.Popover>
          </Select>
          <span className="text-muted text-xs tabular-nums">{total} 个归档</span>
          {selectedArchives.length > 0 && (<>
              <span className="text-xs tabular-nums">已选 {selectedArchives.length} 个</span>
              {restorable.length > 0 && (<Button size="sm" onPress={() => void restoreMany(restorable)} variant={"outline"}>
                  <Undo2Icon data-icon="inline-start"/>
                  还原 {restorable.length}
                </Button>)}
              {deletable.length > 0 && (<ArchiveDeleteDialog archives={deletable} onConfirm={() => deleteMany(deletable)} trigger={<Button size="sm" variant={"danger"}>
                      <Trash2Icon data-icon="inline-start"/>
                      永久删除 {deletable.length}
                    </Button>}/>)}
            </>)}
        </div>
        {loading ? (<div className="flex justify-center py-20">
            <Spinner />
          </div>) : archives.length === 0 ? (<Surface className={`flex flex-col items-center justify-center p-8 text-center ${"mx-4 border border-dashed lg:mx-6"}`}>
            <div className="flex flex-col items-center gap-2">
              <h3 className="font-medium">暂无任务归档</h3>
              <p className="text-sm text-muted">暂停或终态任务可从当前任务列表归档。</p>
            </div>
          </Surface>) : (<Table>
            <Table.ScrollContainer>
              <Table.Content className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4" aria-label="数据表">
                <Table.Header className="[&_tr]:border-t">
                  <Table.Column className="w-10" id="column-66100" isRowHeader>
                    <Checkbox slot={null} onChange={(checked: any) => setSelected(checked === true ? new Set(selectable.map((archive) => archive.id)) : new Set())} aria-label="选择当前页归档" isSelected={(selectedAll || (selectedSome ? "indeterminate" : false)) === true} isIndeterminate={(selectedAll || (selectedSome ? "indeterminate" : false)) === "indeterminate"}>
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </Table.Column>
                  <Table.Column id="column-66537" isRowHeader>
                    任务
                  </Table.Column>
                  <Table.Column id="column-66579" isRowHeader>
                    原状态
                  </Table.Column>
                  <Table.Column id="column-66622" isRowHeader>
                    分类
                  </Table.Column>
                  <Table.Column id="column-66664" isRowHeader>
                    归档时间
                  </Table.Column>
                  <Table.Column id="column-66708" isRowHeader>
                    压缩大小
                  </Table.Column>
                  <Table.Column id="column-66752" isRowHeader>
                    数据量
                  </Table.Column>
                  <Table.Column className="min-w-44" id="column-66795" isRowHeader>
                    处理状态
                  </Table.Column>
                  <Table.Column className="text-right" id="column-66860" isRowHeader>
                    操作
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {archives.map((archive) => {
                const processing = ARCHIVE_PROCESSING_STATES.has(archive.state);
                const canRestore = archive.state === "ready" || archive.state === "restore_failed";
                const canDelete = archive.state === "ready" || archive.state === "delete_failed";
                return (<Table.Row key={archive.id} data-state={selected.has(archive.id) ? "selected" : undefined} id={archive.id}>
                        <Table.Cell>
                          <Checkbox slot={null} isDisabled={processing} onChange={(checked: any) => setSelected((current) => {
                        const next = new Set(current);
                        if (checked === true)
                            next.add(archive.id);
                        else
                            next.delete(archive.id);
                        return next;
                    })} aria-label={`选择任务归档 #${archive.task_id}`} isSelected={selected.has(archive.id) === true}>
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </Table.Cell>
                        <Table.Cell className="max-w-sm">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">
                              {archive.task_name || archive.task_description || `任务 #${archive.task_id}`}
                            </span>
                            <span className="text-muted truncate text-xs">
                              #{archive.task_id} · {archive.task_description}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <StatusBadge domain="task" value={archive.original_status} dot/>
                        </Table.Cell>
                        <Table.Cell className="text-muted">{archive.category_name || "未分类"}</Table.Cell>
                        <Table.Cell className="text-muted whitespace-nowrap text-xs">
                          {archiveDate(archive.archived_at || archive.requested_at)}
                        </Table.Cell>
                        <Table.Cell className="whitespace-nowrap text-xs">
                          <span title={`压缩前 ${formatArchiveBytes(archive.original_size)}`} className="block truncate">
                            {archiveCompressionLabel(archive)}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-xs tabular-nums">
                          {archiveDataTotal(archive).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex min-w-0 flex-col gap-1.5">
                            <ArchiveStateBadge state={archive.state}/>
                            {processing && (<Meter value={archive.progress} aria-label="进度">
                                <Meter.Track>
                                  <Meter.Fill />
                                </Meter.Track>
                              </Meter>)}
                            {archive.error && (<p className="text-danger text-xs [overflow-wrap:anywhere]">{archive.error}</p>)}
                            {[...new Set(archive.warnings ?? [])].map((warning) => (<p key={warning} className="text-warning text-xs [overflow-wrap:anywhere] dark:text-warning">
                                {warning}
                              </p>))}
                            <span className="text-muted text-xs">
                              {archive.phase} · {archive.progress}%
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            {ARCHIVE_FAILED_STATES.has(archive.state) && (<Button onPress={() => void retry(archive)} aria-label="重试归档操作" size="sm" isIconOnly variant={"ghost"}>
                                <Undo2Icon />
                              </Button>)}
                            {canRestore && (<Button onPress={() => void restoreMany([archive])} aria-label="还原任务" size="sm" isIconOnly variant={"ghost"}>
                                <Undo2Icon />
                              </Button>)}
                            {canDelete && (<ArchiveDeleteDialog archives={[archive]} onConfirm={() => deleteMany([archive])} trigger={<Button aria-label="永久删除归档" size="sm" isIconOnly variant={"ghost"}>
                                    <Trash2Icon />
                                  </Button>}/>)}
                          </div>
                        </Table.Cell>
                      </Table.Row>);
            })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>)}
        <TablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
        }}/>
      </Card.Content>
    </Card>);
}
export const emptyDeleteOptions = (): DeleteTaskOptions => ({
    delete_assets: false,
    delete_traffic: false,
    delete_files: false,
    delete_findings: false,
    delete_llm_records: false,
});
export const deleteOptionKeys: (keyof DeleteTaskOptions)[] = [
    "delete_assets",
    "delete_traffic",
    "delete_files",
    "delete_findings",
    "delete_llm_records",
];
export function DeleteOptionFields({ idPrefix, options, onOptionsChange, disabled, }: {
    idPrefix: string;
    options: DeleteTaskOptions;
    onOptionsChange: React.Dispatch<React.SetStateAction<DeleteTaskOptions>>;
    disabled: boolean;
}) {
    const selectedCount = deleteOptionKeys.filter((key: keyof DeleteTaskOptions) => options[key]).length;
    let allChecked: boolean | "indeterminate" = false;
    if (selectedCount === deleteOptionKeys.length) {
        allChecked = true;
    }
    else if (selectedCount > 0) {
        allChecked = "indeterminate";
    }
    const updateOption = (key: keyof DeleteTaskOptions, checked: boolean) => {
        onOptionsChange((current) => ({ ...current, [key]: checked }));
    };
    const updateAllOptions = (checked: boolean) => {
        onOptionsChange({
            delete_assets: checked,
            delete_traffic: checked,
            delete_files: checked,
            delete_findings: checked,
            delete_llm_records: checked,
        });
    };
    return (<Fieldset disabled={disabled}>
      <legend className="text-sm font-medium">同时清理关联数据</legend>
      <div className={`flex flex-col gap-4 ${"gap-3"}`}>
        <div className="flex items-center gap-2">
          <Checkbox id={`delete-all-${idPrefix}`} onChange={(checked: any) => updateAllOptions(checked === true)} aria-label={`delete-all-${idPrefix}`} isSelected={allChecked === true} isIndeterminate={allChecked === "indeterminate"}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`delete-all-${idPrefix}`}>全部删除</Label>
            <Description>选中下方全部关联数据，包括资产、流量、文件、漏洞和 LLM 请求/响应记录。</Description>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`delete-assets-${idPrefix}`} onChange={(checked: any) => updateOption("delete_assets", checked === true)} aria-label={`delete-assets-${idPrefix}`} isSelected={options.delete_assets === true}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`delete-assets-${idPrefix}`}>关联资产</Label>
            <Description>删除仅属于该任务的资产；共享资产只解除当前任务关联。</Description>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`delete-traffic-${idPrefix}`} onChange={(checked: any) => updateOption("delete_traffic", checked === true)} aria-label={`delete-traffic-${idPrefix}`} isSelected={options.delete_traffic === true}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`delete-traffic-${idPrefix}`}>关联流量</Label>
            <Description>按关联资产的精确主机名删除；仍被其他任务引用的共享主机流量会保留。</Description>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`delete-files-${idPrefix}`} onChange={(checked: any) => updateOption("delete_files", checked === true)} aria-label={`delete-files-${idPrefix}`} isSelected={options.delete_files === true}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`delete-files-${idPrefix}`}>任务文件</Label>
            <Description>删除该任务工作目录中的上传文件、命令输出和其他产物。</Description>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`delete-findings-${idPrefix}`} onChange={(checked: any) => updateOption("delete_findings", checked === true)} aria-label={`delete-findings-${idPrefix}`} isSelected={options.delete_findings === true}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`delete-findings-${idPrefix}`}>关联漏洞</Label>
            <Description>永久删除该任务产生的独立漏洞记录与漏洞报告。</Description>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={`delete-llm-records-${idPrefix}`} onChange={(checked: any) => updateOption("delete_llm_records", checked === true)} aria-label={`delete-llm-records-${idPrefix}`} isSelected={options.delete_llm_records === true}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`delete-llm-records-${idPrefix}`}>LLM 请求/响应记录</Label>
            <Description>永久删除该任务录制的 LLM 请求、响应、Token 与错误详情。</Description>
          </div>
        </div>
      </div>
    </Fieldset>);
}
export function DeleteTaskDialog({ task, onDelete, }: {
    task: Task;
    onDelete: (id: string, options: DeleteTaskOptions) => Promise<void>;
}) {
    const [open, setOpen] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [options, setOptions] = React.useState<DeleteTaskOptions>(emptyDeleteOptions);
    const handleOpenChange = (next: boolean) => {
        if (deleting)
            return;
        setOpen(next);
        if (next)
            setOptions(emptyDeleteOptions());
    };
    const handleDelete = async () => {
        setDeleting(true);
        try {
            await onDelete(task.id, options);
            setOpen(false);
        }
        finally {
            setDeleting(false);
        }
    };
    return (<AlertDialog isOpen={open} onOpenChange={handleOpenChange}>
      
        <Button aria-label="删除任务" size="sm" isIconOnly variant={"outline"}>
          <Trash2Icon className="text-danger"/>
        </Button>
      
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>确认删除任务 #{task.id}？</AlertDialog.Heading>
              <AlertDialog.Body className="break-words">
                {task.description ? (<>
                    「
                    <span className="break-all">
                      {task.description.length > 80 ? `${task.description.slice(0, 80)}…` : task.description}
                    </span>
                    」
                  </>) : ("该任务")}
                的执行记录与探索链路将被永久删除。
              </AlertDialog.Body>
            </AlertDialog.Header>
            <DeleteOptionFields idPrefix={task.id} options={options} onOptionsChange={setOptions} disabled={deleting}/>
            <AlertDialog.Footer>
              <Button isDisabled={deleting} slot="close" variant={"outline"}>
                取消
              </Button>
              <Button isDisabled={deleting} variant={"danger"} onClick={(event: any) => {
            event.preventDefault();
            void handleDelete();
        }}>
                {deleting && <Spinner data-icon="inline-start"/>}
                {deleting ? "删除中" : "删除"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>);
}
export function MoveTasksCategoryDialog({ categories, count, moving, onMove, }: {
    categories: TaskCategory[];
    count: number;
    moving: boolean;
    onMove: (categoryID?: number) => Promise<void>;
}) {
    const [open, setOpen] = React.useState(false);
    const [target, setTarget] = React.useState(UNCATEGORIZED_VALUE);
    const handleOpenChange = (next: boolean) => {
        if (moving)
            return;
        setOpen(next);
        if (next)
            setTarget(UNCATEGORIZED_VALUE);
    };
    return (<Modal isOpen={open} onOpenChange={handleOpenChange}>
      
        <Button size="sm" variant={"outline"}>
          <FolderInputIcon data-icon="inline-start"/> 修改分类
        </Button>
      
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="关闭"/>
            <Modal.Header>
              <Modal.Heading>修改所选 {count} 个任务的分类</Modal.Heading>
              <Description>目标分类对所选任务统一生效；选「未分类」会把它们移出当前分类。</Description>
            </Modal.Header>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-category">目标分类</Label>
              <Select selectedKey={target} isDisabled={moving} aria-label="选择选项" onSelectionChange={(key: any) => {
            if (key !== null)
                setTarget(String(key));
        }}>
                <Select.Trigger id="bulk-category" className="w-full">
                  <Select.Value />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <>
                      <ListBox.Item id={UNCATEGORIZED_VALUE} textValue="未分类">
                        未分类
                      </ListBox.Item>
                      {categories.map((category: any) => (<ListBox.Item key={category.id} id={String(category.id)}>
                          {category.name}
                        </ListBox.Item>))}
                    </>
                  </ListBox>
                </Select.Popover>
              </Select>
              {categories.length === 0 && <Description>还没有任何分类，先用「分类管理」创建一个。</Description>}
            </div>
            <Modal.Footer>
              <Button slot="close">
                <Button isDisabled={moving} variant={"outline"}>
                  取消
                </Button>
              </Button>
              <Button isDisabled={moving} onPress={() => {
            void onMove(target === UNCATEGORIZED_VALUE ? undefined : Number(target)).then(() => setOpen(false));
        }}>
                {moving && <Spinner data-icon="inline-start"/>}
                移动
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>);
}
export function BulkDeleteTasksDialog({ ids, onDelete, }: {
    ids: string[];
    onDelete: (ids: string[], options: DeleteTaskOptions, onProgress: (done: number) => void) => Promise<void>;
}) {
    const [open, setOpen] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [done, setDone] = React.useState(0);
    const [options, setOptions] = React.useState<DeleteTaskOptions>(emptyDeleteOptions);
    const handleOpenChange = (next: boolean) => {
        if (deleting)
            return;
        setOpen(next);
        if (next) {
            setOptions(emptyDeleteOptions());
            setDone(0);
        }
    };
    const handleDelete = async () => {
        setDeleting(true);
        setDone(0);
        try {
            await onDelete(ids, options, setDone);
            setOpen(false);
        }
        finally {
            setDeleting(false);
        }
    };
    return (<AlertDialog isOpen={open} onOpenChange={handleOpenChange}>
      
        <Button size="sm" variant={"outline"}>
          <Trash2Icon className="text-danger"/> 删除所选 {ids.length}
        </Button>
      
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="max-h-[85vh] overflow-y-auto">
            <AlertDialog.Header>
              <AlertDialog.Heading>确认删除所选 {ids.length} 个任务？</AlertDialog.Heading>
              <AlertDialog.Body>
                这些任务的执行记录与探索链路将被永久删除，下方清理选项对所选任务统一生效。
              </AlertDialog.Body>
            </AlertDialog.Header>
            <div className="text-muted flex flex-wrap gap-1 text-xs">
              {ids.slice(0, 30).map((id) => (<code key={id} className="bg-surface-secondary rounded px-1.5 py-0.5 font-mono">
                  #{id}
                </code>))}
              {ids.length > 30 && <span className="self-center">…等 {ids.length} 个</span>}
            </div>
            <DeleteOptionFields idPrefix="bulk" options={options} onOptionsChange={setOptions} disabled={deleting}/>
            <AlertDialog.Footer>
              <Button isDisabled={deleting} slot="close" variant={"outline"}>
                取消
              </Button>
              <Button isDisabled={deleting} variant={"danger"} onClick={(event: any) => {
            event.preventDefault();
            void handleDelete();
        }}>
                {deleting && <Spinner data-icon="inline-start"/>}
                {deleting ? `删除中 ${done}/${ids.length}` : `删除 ${ids.length} 个任务`}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>);
}
