"use client";

import * as React from "react";

import { SearchIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import type { TaskArchive, TaskArchiveState } from "@/lib/types";

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

function ArchiveStateBadge({ state }: { state: TaskArchiveState }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  if (state === "ready") variant = "secondary";
  if (ARCHIVE_PROCESSING_STATES.has(state)) variant = "default";
  if (ARCHIVE_FAILED_STATES.has(state)) variant = "destructive";
  return <Badge variant={variant}>{archiveStateLabel(state)}</Badge>;
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
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
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

export function TaskArchivesPanel({ onChanged }: { onChanged: () => void }) {
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

  const afterAction = React.useCallback(() => {
    setSelected(new Set());
    void load();
    onChanged();
  }, [load, onChanged]);

  async function restoreMany(items: TaskArchive[]) {
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
  }

  async function deleteMany(items: TaskArchive[]) {
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
      throw error;
    }
  }

  async function retry(archive: TaskArchive) {
    try {
      if (archive.state === "archive_failed") await api.archiveTask(String(archive.task_id));
      if (archive.state === "restore_failed") await api.restoreTaskArchive(archive.id);
      if (archive.state === "delete_failed") await api.deleteTaskArchive(archive.id);
      toast.success("已重新加入处理队列");
      afterAction();
    } catch (error) {
      toast.error(`重试失败：${(error as Error).message}`);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 px-0 pt-6">
        <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="搜索任务名称 / 描述 / ID"
              className="pl-8"
            />
          </div>
          <Select
            value={stateFilter}
            onValueChange={(value: any) => {
              setStateFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-36">
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
            <span className="text-muted-foreground text-xs tabular-nums">{total} 个归档</span>
          )}
          {selectedArchives.length > 0 && (
            <>
              <span className="text-xs tabular-nums">已选 {selectedArchives.length} 个</span>
              {restorable.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => void restoreMany(restorable)}>
                  <Undo2Icon data-icon="inline-start" />
                  还原 {restorable.length}
                </Button>
              )}
              {deletable.length > 0 && (
                <ArchiveDeleteDialog
                  archives={deletable}
                  onConfirm={() => deleteMany(deletable)}
                  trigger={
                    <Button size="sm" variant="destructive">
                      <Trash2Icon data-icon="inline-start" />
                      永久删除 {deletable.length}
                    </Button>
                  }
                />
              )}
            </>
          )}
        </div>
        {loadError && (
          <div
            role="alert"
            className="mx-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-sm lg:mx-6"
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">读取归档列表失败：{loadError}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              重试
            </Button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : archives.length === 0 ? (
          loadError ? null : (
            <Empty className="mx-4 border border-dashed lg:mx-6">
              <EmptyHeader>
                <EmptyTitle>暂无任务归档</EmptyTitle>
                <EmptyDescription>暂停或终态任务可从当前任务列表归档。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : (
          <Table className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader className="[&_tr]:border-t">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedAll || (selectedSome ? "indeterminate" : false)}
                    onCheckedChange={(checked) =>
                      setSelected(checked === true ? new Set(selectable.map((archive) => archive.id)) : new Set())
                    }
                    aria-label="选择当前页归档"
                  />
                </TableHead>
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
              {archives.map((archive) => {
                const processing = ARCHIVE_PROCESSING_STATES.has(archive.state);
                const canRestore = archive.state === "ready" || archive.state === "restore_failed";
                const canDelete = archive.state === "ready" || archive.state === "delete_failed";
                return (
                  <TableRow key={archive.id} data-state={selected.has(archive.id) ? "selected" : undefined}>
                    <TableCell>
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
                    <TableCell className="max-w-sm">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium">
                          {archive.task_name || archive.task_description || `任务 #${archive.task_id}`}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          #{archive.task_id} · {archive.task_description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge domain="task" value={archive.original_status} dot />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{archive.category_name || "未分类"}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {archiveDate(archive.archived_at || archive.requested_at)}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-xs"
                      title={`压缩前 ${formatArchiveBytes(archive.original_size)}`}
                    >
                      {archiveCompressionLabel(archive)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{archiveDataTotal(archive).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <ArchiveStateBadge state={archive.state} />
                        {processing && <Progress value={archive.progress} />}
                        {archive.error && (
                          <p className="text-destructive text-xs [overflow-wrap:anywhere]">{archive.error}</p>
                        )}
                        {[...new Set(archive.warnings ?? [])].map((warning) => (
                          <p
                            key={warning}
                            className="text-amber-700 text-xs [overflow-wrap:anywhere] dark:text-amber-400"
                          >
                            {warning}
                          </p>
                        ))}
                        <span className="text-muted-foreground text-xs">
                          {archive.phase} · {archive.progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        {ARCHIVE_FAILED_STATES.has(archive.state) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void retry(archive)}
                            aria-label="重试归档操作"
                            title="重试"
                          >
                            <Undo2Icon />
                          </Button>
                        )}
                        {canRestore && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => void restoreMany([archive])}
                            aria-label="还原任务"
                            title="还原任务"
                          >
                            <Undo2Icon />
                          </Button>
                        )}
                        {canDelete && (
                          <ArchiveDeleteDialog
                            archives={[archive]}
                            onConfirm={() => deleteMany([archive])}
                            trigger={
                              <Button size="icon" variant="ghost" aria-label="永久删除归档" title="永久删除">
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
      </CardContent>
    </Card>
  );
}
