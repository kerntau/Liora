"use client";

import * as React from "react";

import { ArchiveIcon, CircleAlertIcon, SearchIcon, Trash2Icon, Undo2Icon, XIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/status-badge";
import { TablePagination } from "@/components/table-pagination";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { TaskArchive, TaskArchiveState } from "@/lib/types";
import { cn } from "@/lib/utils";

const ARCHIVE_PROCESSING_STATES = new Set<TaskArchiveState>([
  "archive_queued",
  "archiving",
  "restore_queued",
  "restoring",
  "delete_queued",
  "deleting",
]);

const ARCHIVE_FAILED_STATES = new Set<TaskArchiveState>(["archive_failed", "restore_failed", "delete_failed"]);

function archiveStateLabel(state: TaskArchiveState): string {
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

// 归档状态与任务状态共用同一套语义色:成功/进行中/失败/排队,不再用 Badge 的实心色块,
// 避免归档列表里出现一整片高饱和按钮色。
function archiveStateTone(state: TaskArchiveState): string {
  if (state === "ready") return "border-success/20 bg-success/10 text-success";
  if (ARCHIVE_FAILED_STATES.has(state)) return "border-destructive/20 bg-destructive/10 text-destructive";
  if (state === "archiving" || state === "restoring" || state === "deleting") {
    return "border-primary/20 bg-primary/10 text-primary";
  }
  return "border-warning/20 bg-warning/10 text-warning-foreground";
}

function ArchiveStatePill({ state }: { state: TaskArchiveState }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        archiveStateTone(state),
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {archiveStateLabel(state)}
    </span>
  );
}

function formatArchiveBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function archiveCompressionLabel(archive: TaskArchive): string {
  if (archive.original_size <= 0 || archive.compressed_size <= 0) return "—";
  const saved = Math.max(0, 100 - (archive.compressed_size / archive.original_size) * 100);
  return `${formatArchiveBytes(archive.compressed_size)} · 节省 ${saved.toFixed(0)}%`;
}

function archiveDataTotal(archive: TaskArchive): number {
  return Object.values(archive.data_counts).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function archiveDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function ArchiveDeleteDialog({
  archives,
  onConfirm,
  trigger,
}: {
  archives: TaskArchive[];
  onConfirm: () => Promise<void>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const rows = archives.reduce((sum, archive) => sum + archiveDataTotal(archive), 0);
  const bytes = archives.reduce((sum, archive) => sum + archive.compressed_size, 0);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>永久删除 {archives.length} 个任务归档？</AlertDialogTitle>
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            将永久删除约 {formatArchiveBytes(bytes)} 的归档包及 {rows.toLocaleString()} 条关联数据快照。此操作不可恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={async (event) => {
              event.preventDefault();
              if (pending) return;
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                // 删除失败时保持确认框打开(失败原因已由 onConfirm toast),避免
                // 用户以为已经删掉;也避免 void 化的 Promise 变成未处理拒绝。
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Spinner data-icon="inline-start" />}
            永久删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TaskArchivesPanel({
  onChanged,
  onGoCurrent,
}: {
  onChanged: () => void;
  // 空态里的「查看当前任务」:切回当前任务页签(纯本地视图动作)。
  onGoCurrent?: () => void;
}) {
  const [archives, setArchives] = React.useState<TaskArchive[]>([]);
  const [query, setQuery] = React.useState("");
  const [stateFilter, setStateFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set());
  const [loading, setLoading] = React.useState(true);
  // 面板内错误条:轮询失败保留上一份归档列表,不再每 2 秒弹一次 toast。
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const pendingRestoreIDs = React.useRef(new Set<number>());
  // 2s 轮询下同一视图可能有多个请求在飞,只让最后一次请求写回,避免旧响应覆盖新响应。
  const requestRef = React.useRef(0);
  // 上一轮同一视图(page/筛选未变)可见的 id:轮询只据此移除「刚消失」的归档,
  // 不再把选中集裁成当前页,跨页勾选不会被静默清掉。
  const visibleRef = React.useRef<{ key: string; ids: Set<number> }>({ key: "", ids: new Set() });

  const load = React.useCallback(async () => {
    const id = ++requestRef.current;
    try {
      const result = await api.taskArchives({
        page,
        size: pageSize,
        q: query.trim(),
        state: stateFilter === "all" ? undefined : stateFilter,
      });
      if (id !== requestRef.current) return;
      setLoadError(null);
      setArchives(result.items);
      setTotal(result.total);
      const viewKey = `${page}|${pageSize}|${query.trim()}|${stateFilter}`;
      const visible = new Set(result.items.map((archive) => archive.id));
      const previous = visibleRef.current;
      visibleRef.current = { key: viewKey, ids: visible };
      setSelected((current) => {
        if (current.size === 0) return current;
        // 换页/换筛选后上一轮的可见集合已不适用,这一轮不动选中集。
        if (previous.key !== viewKey) return current;
        const gone = [...current].filter((id) => previous.ids.has(id) && !visible.has(id));
        if (gone.length === 0) return current;
        const next = new Set(current);
        for (const id of gone) next.delete(id);
        return next;
      });
      const pending = [...pendingRestoreIDs.current];
      if (pending.length > 0) {
        const states = await Promise.allSettled(pending.map((id: any) => api.taskArchive(id)));
        if (id !== requestRef.current) return;
        let restored = false;
        states.forEach((state, index) => {
          if (state.status !== "rejected" || !(state.reason instanceof Error)) return;
          if (!state.reason.message.includes("归档不存在")) return;
          pendingRestoreIDs.current.delete(pending[index]);
          restored = true;
        });
        if (restored) onChanged();
      }
    } catch (error) {
      if (id !== requestRef.current) return;
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [onChanged, page, pageSize, query, stateFilter]);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 2_000);
    return () => clearInterval(timer);
  }, [load]);

  const selectable = React.useMemo(
    () => archives.filter((archive) => !ARCHIVE_PROCESSING_STATES.has(archive.state)),
    [archives],
  );
  const selectedArchives = React.useMemo(
    () => archives.filter((archive) => selected.has(archive.id)),
    [archives, selected],
  );
  const restorable = selectedArchives.filter(
    (archive) => archive.state === "ready" || archive.state === "restore_failed",
  );
  const deletable = selectedArchives.filter(
    (archive) => archive.state === "ready" || archive.state === "delete_failed",
  );
  const selectedAll = selectable.length > 0 && selectable.every((archive) => selected.has(archive.id));
  const selectedSome = selectable.some((archive) => selected.has(archive.id));

  // 清空搜索后焦点留在输入框:清除按钮随即卸载,不处理的话焦点会掉到 body。
  const archiveSearchRef = React.useRef<HTMLInputElement>(null);
  const clearArchiveQuery = React.useCallback(() => {
    setQuery("");
    setPage(1);
    archiveSearchRef.current?.focus();
  }, []);

  const afterAction = React.useCallback(() => {
    setSelected(new Set());
    void load();
    onChanged();
  }, [load, onChanged]);

  // 还原 / 永久删除 / 重试共用一把互斥锁:请求在飞时按钮禁用。这几个动作都会让
  // 归档重新入队,连点会产生重复队列项,后端随后返回一串「状态已变化」的失败。
  const actionBusyRef = React.useRef(false);
  const [actionBusy, setActionBusy] = React.useState(false);

  async function runExclusive(task: () => Promise<void>): Promise<boolean> {
    if (actionBusyRef.current) return false;
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      await task();
      return true;
    } finally {
      actionBusyRef.current = false;
      setActionBusy(false);
    }
  }

  async function restoreMany(items: TaskArchive[]) {
    await runExclusive(async () => {
      try {
        const result =
          items.length === 1
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
          if (item.ok && Number.isSafeInteger(archiveID) && archiveID > 0) pendingRestoreIDs.current.add(archiveID);
        }
        if (succeeded > 0) toast.success(`已将 ${succeeded} 个任务加入还原队列`);
        if (failed > 0) toast.error(`${failed} 个任务无法还原`);
        afterAction();
      } catch (error) {
        toast.error(`还原失败：${(error as Error).message}`);
      }
    });
  }

  async function deleteMany(items: TaskArchive[]) {
    await runExclusive(async () => {
      try {
        const result =
          items.length === 1
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
        if (succeeded > 0) toast.success(`已将 ${succeeded} 个归档加入永久删除队列`);
        if (failed > 0) toast.error(`${failed} 个归档无法删除`);
        afterAction();
      } catch (error) {
        toast.error(`永久删除失败：${(error as Error).message}`);
        // 抛回确认框:失败时它保持打开,用户可以重试。
        throw error;
      }
    });
  }

  async function retry(archive: TaskArchive) {
    await runExclusive(async () => {
      try {
        if (archive.state === "archive_failed") await api.archiveTask(String(archive.task_id));
        if (archive.state === "restore_failed") await api.restoreTaskArchive(archive.id);
        if (archive.state === "delete_failed") await api.deleteTaskArchive(archive.id);
        toast.success("已重新加入处理队列");
        afterAction();
      } catch (error) {
        toast.error(`重试失败：${(error as Error).message}`);
      }
    });
  }

  return (
    <SectionCard
      icon={ArchiveIcon}
      title="归档任务"
      description="归档会把暂停或终态任务压缩进冷存储，可随时还原。"
      dense
      bodyClassName="px-0"
    >
      <div className="border-border/60 flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            ref={archiveSearchRef}
            aria-label="搜索任务归档"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            onKeyDown={(event) => {
              // 有内容时 Esc 只清空搜索,不冒泡去关外层弹层。
              if (event.key === "Escape" && query) {
                event.preventDefault();
                event.stopPropagation();
                clearArchiveQuery();
              }
            }}
            placeholder="搜索任务名称 / 描述 / ID"
            className="h-8 pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={clearArchiveQuery}
              aria-label="清除归档搜索"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <Select
          value={stateFilter}
          onValueChange={(value: any) => {
            setStateFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[8.5rem]">
            <SelectValue placeholder="处理状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="archive_queued">等待归档</SelectItem>
              <SelectItem value="archiving">归档中</SelectItem>
              <SelectItem value="ready">可还原</SelectItem>
              <SelectItem value="restore_queued">等待还原</SelectItem>
              <SelectItem value="restoring">还原中</SelectItem>
              <SelectItem value="delete_queued">等待删除</SelectItem>
              <SelectItem value="deleting">删除中</SelectItem>
              <SelectItem value="archive_failed">归档失败</SelectItem>
              <SelectItem value="restore_failed">还原失败</SelectItem>
              <SelectItem value="delete_failed">删除失败</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {(archives.length > 0 || !loadError) && (
          <span className="text-muted-foreground text-[12px] whitespace-nowrap tabular-nums">
            共 <span className="text-foreground font-medium">{total}</span> 个归档
          </span>
        )}
      </div>

      {selectedArchives.length > 0 && (
        <div className="border-primary/15 bg-brand-soft flex flex-wrap items-center gap-2 border-b px-5 py-2">
          <span className="text-[13px] font-medium tabular-nums">已选 {selectedArchives.length} 个</span>
          {restorable.length > 0 && (
            <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => void restoreMany(restorable)}>
              <Undo2Icon data-icon="inline-start" />
              还原 {restorable.length}
            </Button>
          )}
          {deletable.length > 0 && (
            <ArchiveDeleteDialog
              archives={deletable}
              onConfirm={() => deleteMany(deletable)}
              trigger={
                <Button size="sm" variant="destructive" disabled={actionBusy}>
                  <Trash2Icon data-icon="inline-start" />
                  永久删除 {deletable.length}
                </Button>
              }
            />
          )}
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/5 mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-[13px]"
        >
          <span className="text-destructive flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]">
            <CircleAlertIcon className="size-4 shrink-0" />
            读取归档列表失败：{loadError}
          </span>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            重试
          </Button>
        </div>
      )}

      {loading ? (
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4 lg:pl-5" />
              <TableHead>任务</TableHead>
              <TableHead>原状态</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>归档时间</TableHead>
              <TableHead>压缩大小</TableHead>
              <TableHead>数据量</TableHead>
              <TableHead className="min-w-44">处理状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[0, 1, 2, 3, 4].map((key) => (
              <TableRow key={key} aria-hidden className="border-border/60">
                <TableCell className="pl-4 lg:pl-5">
                  <div className="bg-muted h-4 w-4 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    <div className="bg-muted h-3.5 w-40 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-24 animate-pulse rounded" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="bg-muted h-5 w-16 animate-pulse rounded-full" />
                </TableCell>
                <TableCell>
                  <div className="bg-muted h-4 w-16 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="bg-muted h-4 w-20 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="bg-muted h-4 w-10 animate-pulse rounded" />
                </TableCell>
                <TableCell>
                  <div className="bg-muted h-5 w-20 animate-pulse rounded-full" />
                </TableCell>
                <TableCell>
                  <div className="bg-muted ml-auto h-4 w-16 animate-pulse rounded" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : archives.length === 0 ? (
        loadError ? null : (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <ArchiveIcon className="text-muted-foreground/60 size-6" aria-hidden="true" />
            <div className="flex max-w-md flex-col gap-1">
              <p className="text-foreground text-[13px] font-semibold">暂无任务归档</p>
              <p className="text-muted-foreground text-[12px] leading-5">
                暂停或终态任务可从当前任务列表归档，归档后在这里还原或永久删除。
              </p>
            </div>
            {onGoCurrent && (
              <Button size="sm" variant="outline" className="mt-1" onClick={onGoCurrent}>
                查看当前任务
              </Button>
            )}
          </div>
        )
      ) : (
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4 lg:pl-5">
                <Checkbox
                  checked={selectedAll || (selectedSome ? "indeterminate" : false)}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? new Set(selectable.map((archive) => archive.id)) : new Set())
                  }
                  aria-label="选择当前页归档"
                />
              </TableHead>
              <TableHead className="w-[240px]">任务</TableHead>
              <TableHead className="w-[96px]">原状态</TableHead>
              <TableHead className="w-[92px]">分类</TableHead>
              <TableHead className="w-[116px]">归档时间</TableHead>
              <TableHead className="w-[120px]">压缩大小</TableHead>
              <TableHead className="w-[72px] text-right">数据量</TableHead>
              <TableHead className="w-[184px]">处理状态</TableHead>
              <TableHead className="bg-surface-muted w-[104px] text-right md:sticky md:right-0 md:z-10 md:shadow-[-1px_0_0_0_var(--border)]">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {archives.map((archive) => {
              const processing = ARCHIVE_PROCESSING_STATES.has(archive.state);
              const canRestore = archive.state === "ready" || archive.state === "restore_failed";
              const canDelete = archive.state === "ready" || archive.state === "delete_failed";
              return (
                <TableRow
                  key={archive.id}
                  className="group border-border/60"
                  data-state={selected.has(archive.id) ? "selected" : undefined}
                >
                  <TableCell className="pl-4 lg:pl-5">
                    <Checkbox
                      checked={selected.has(archive.id)}
                      disabled={processing}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (checked === true) next.add(archive.id);
                          else next.delete(archive.id);
                          return next;
                        })
                      }
                      aria-label={`选择任务归档 #${archive.task_id}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-foreground truncate text-[13px] font-medium">
                        {archive.task_name || archive.task_description || `任务 #${archive.task_id}`}
                      </span>
                      <span className="text-muted-foreground truncate text-[11px]">
                        #{archive.task_id} · {archive.task_description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge domain="task" value={archive.original_status} dot />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <span className="block max-w-[88px] truncate">{archive.category_name || "未分类"}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {archiveDate(archive.archived_at || archive.requested_at)}
                  </TableCell>
                  <TableCell
                    className="text-xs whitespace-nowrap"
                    title={`压缩前 ${formatArchiveBytes(archive.original_size)}`}
                  >
                    {archiveCompressionLabel(archive)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {archiveDataTotal(archive).toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <ArchiveStatePill state={archive.state} />
                      {processing && <Progress value={archive.progress} className="h-1.5" />}
                      <span className="text-muted-foreground text-[11px] tabular-nums">
                        {archive.phase} · {archive.progress}%
                      </span>
                      {archive.error && (
                        <p className="text-destructive text-[11px] [overflow-wrap:anywhere]">{archive.error}</p>
                      )}
                      {[...new Set(archive.warnings ?? [])].map((warning) => (
                        <p key={warning} className="text-warning text-[11px] [overflow-wrap:anywhere]">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="bg-card text-right group-hover:bg-[color-mix(in_srgb,var(--muted)_55%,transparent)] group-data-[state=selected]:bg-accent md:sticky md:right-0 md:z-10 md:shadow-[-1px_0_0_0_var(--border)]">
                    <div className="flex items-center justify-end gap-0.5">
                      {ARCHIVE_FAILED_STATES.has(archive.state) && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={actionBusy}
                          onClick={() => void retry(archive)}
                          aria-label="重试归档操作"
                          title="重试"
                          className="text-muted-foreground hover:text-foreground group-hover:text-foreground"
                        >
                          <Undo2Icon />
                        </Button>
                      )}
                      {canRestore && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={actionBusy}
                          onClick={() => void restoreMany([archive])}
                          aria-label="还原任务"
                          title="还原任务"
                          className="text-muted-foreground hover:text-foreground group-hover:text-foreground"
                        >
                          <Undo2Icon />
                        </Button>
                      )}
                      {canDelete && (
                        <ArchiveDeleteDialog
                          archives={[archive]}
                          onConfirm={() => deleteMany([archive])}
                          trigger={
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={actionBusy}
                              aria-label="永久删除归档"
                              title="永久删除"
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:text-foreground"
                            >
                              <Trash2Icon />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </SectionCard>
  );
}
