"use client";

import * as React from "react";

import Link, { usePathname, useRouter, useSearchParams } from "@/lib/router-compat";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  FolderInputIcon,
  GripVerticalIcon,
  InboxIcon,
  ListChecksIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchIcon,
  SearchXIcon,
  Settings2Icon,
  TagsIcon,
  TargetIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { PageHeader } from "@/components/app/page-header";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import { type SortDirection, useStoredSortPreference } from "@/lib/sort-preference";
import type { DeleteTaskOptions, Task, TaskCategory, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { TaskArchivesPanel } from "./_components/archives-panel";
import { CreateTaskSheet } from "./_components/create-task-sheet";
import { ConcurrencySettingsDialog } from "./_components/concurrency-settings-dialog";
import { BulkDeleteTasksDialog } from "./_components/delete-task-dialogs";
import { ArchiveConfirmDialog, TaskRow, TaskRowSkeleton } from "./_components/task-row";

import {
  ARCHIVABLE_STATUSES,
  compareTasks,
  type DeleteCounts,
  deleteDetails,
  deleteSummary,
  POLL_MS,
  STATUS_OPTIONS,
  TASK_FILTER_PREFERENCE_KEY,
  TASK_SKELETON_KEYS,
  TASK_SORT_FIELDS,
  TASK_SORT_PREFERENCE_KEY,
  type TaskSortField,
  taskControlAction,
  taskIsPinned,
  UNCATEGORIZED_VALUE,
} from "./task-format";

// useSearchParams 需要 Suspense 边界,静态导出时也不会阻塞首帧。
export default function TasksPage() {
  return (
    <React.Suspense fallback={null}>
      <TasksPageInner />
    </React.Suspense>
  );
}

function TasksPageInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  // 首帧就读 URL,刷新/分享链接能还原筛选与页码;没有 URL 参数时再退回本地偏好。
  const [initialParams] = React.useState(() => new URLSearchParams(searchParams));
  const [activeTab, setActiveTab] = React.useState("current");
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [categories, setCategories] = React.useState<TaskCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = React.useState(false);
  const [query, setQuery] = React.useState(() => initialParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "all">(() => {
    const value = initialParams.get("status");
    return value && STATUS_OPTIONS.some((option) => option.value === value) ? (value as TaskStatus) : "all";
  });
  const [categoryFilter, setCategoryFilter] = React.useState(() => {
    const value = initialParams.get("category");
    if (!value) return "all";
    return value === UNCATEGORIZED_VALUE || /^\d+$/.test(value) ? value : "all";
  });
  const [filtersHydrated, setFiltersHydrated] = React.useState(false);
  const [sortPreference, setSortPreference] = useStoredSortPreference(
    TASK_SORT_PREFERENCE_KEY,
    TASK_SORT_FIELDS,
    "id",
    "desc",
  );
  const { field: sortField, direction: sortDirection } = sortPreference;
  const [page, setPage] = React.useState(() => {
    const value = Number(initialParams.get("page"));
    return Number.isSafeInteger(value) && value > 1 ? value : 1;
  });
  const [pageSize, setPageSize] = React.useState(20);
  const [nowSec, setNowSec] = React.useState(() => Math.floor(Date.now() / 1000));
  // 首载标记:列表还没回来之前不能把空数组当成「暂无任务」,否则首帧会闪一次空态。
  const [tasksLoaded, setTasksLoaded] = React.useState(false);
  // 列表加载失败:保留已拿到的任务,只在列表为空时用错误卡片替代「暂无任务」。
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // 按运行时长排序用的快照:只在点表头时定序,tick 不再参与比较。
  const [durationSortAnchorSec, setDurationSortAnchorSec] = React.useState(() => Math.floor(Date.now() / 1000));
  const [batchControlling, setBatchControlling] = React.useState<"pause" | "resume" | null>(null);
  const [movingCategory, setMovingCategory] = React.useState(false);

  React.useEffect(() => {
    // URL 里已经带了筛选条件就以 URL 为准,本地偏好只做兜底。
    const urlHasFilters = initialParams.has("status") || initialParams.has("category");
    const raw = urlHasFilters ? null : getLocalStorageValue(TASK_FILTER_PREFERENCE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { status?: unknown; category?: unknown };
        if (parsed.status === "all" || STATUS_OPTIONS.some((option) => option.value === parsed.status)) {
          setStatusFilter(parsed.status as TaskStatus | "all");
        }
        if (
          typeof parsed.category === "string" &&
          (parsed.category === "all" || parsed.category === UNCATEGORIZED_VALUE || /^\d+$/.test(parsed.category))
        ) {
          setCategoryFilter(parsed.category);
        }
      } catch {
        // Ignore malformed or legacy preferences and retain the defaults.
      }
    }
    setFiltersHydrated(true);
  }, [initialParams]);

  React.useEffect(() => {
    if (!filtersHydrated) return;
    setLocalStorageValue(
      TASK_FILTER_PREFERENCE_KEY,
      JSON.stringify({ status: statusFilter, category: categoryFilter }),
    );
  }, [categoryFilter, filtersHydrated, statusFilter]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter === UNCATEGORIZED_VALUE && t.category_id != null) return false;
      if (
        categoryFilter !== "all" &&
        categoryFilter !== UNCATEGORIZED_VALUE &&
        String(t.category_id) !== categoryFilter
      )
        return false;
      if (!q) return true;
      return (
        (t.name ?? "").toLowerCase().includes(q) ||
        (t.category_name ?? "").toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.goal.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, statusFilter, categoryFilter]);

  // 排序取点击时的时长快照:若直接用每秒变化的 nowSec,running 任务的时长每秒都变,
  // 整张表会跟着每秒重排,行的位置在用户眼皮底下漂移。
  const sortNowSec = sortField === "duration" ? durationSortAnchorSec : 0;
  const ordered = React.useMemo(() => {
    return [...filtered].sort((left, right) => compareTasks(left, right, sortField, sortDirection, sortNowSec));
  }, [filtered, sortDirection, sortField, sortNowSec]);

  const sortTasksBy = React.useCallback(
    (field: TaskSortField) => {
      // 点「运行时长」时打一次快照,本次排序期间不再随 tick 变化。
      if (field === "duration") setDurationSortAnchorSec(Math.floor(Date.now() / 1000));
      setSortPreference((current) => {
        if (current.field !== field) return { field, direction: "desc" };
        return { field, direction: current.direction === "asc" ? "desc" : "asc" };
      });
    },
    [setSortPreference],
  );

  // 搜索框清空后焦点要留在输入框里:点「清除搜索」时按钮会立刻卸载,
  // 焦点会掉到 body,键盘用户得从头 Tab 回来。
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const clearQuery = React.useCallback(() => {
    setQuery("");
    searchInputRef.current?.focus();
  }, []);

  // reset to page 1 whenever filters or ordering change
  // 首轮(含从 URL 还原)不重置,否则 ?page=3 会被立刻打回第 1 页。
  const skipPageResetRef = React.useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: both filters intentionally reset pagination.
  React.useEffect(() => {
    if (!filtersHydrated) return;
    if (skipPageResetRef.current) {
      skipPageResetRef.current = false;
      return;
    }
    setPage(1);
  }, [query, statusFilter, categoryFilter, sortField, sortDirection, filtersHydrated]);

  // 视图状态回写 URL(replace,不产生历史记录);防抖避免每敲一个字就导航一次。
  React.useEffect(() => {
    if (!filtersHydrated) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (page > 1) params.set("page", String(page));
    const next = params.toString();
    if (next === searchParams.toString()) return;
    const timer = window.setTimeout(() => {
      router.replace(next ? `${pathname}?${next}` : pathname);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [categoryFilter, filtersHydrated, page, pathname, query, router, searchParams, statusFilter]);

  // 删除/筛选后总页数可能变小,此时 page 仍停在旧值:直接用 page 切片会渲染出一张
  // 「表头 + 0 行」的空表(要等 TablePagination 的 effect 把 page 拉回才恢复)。
  // 切片统一用收敛后的页码,越界那一帧显示最后一页,而不是空表。
  const lastPage = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const paginated = React.useMemo(
    () => ordered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [ordered, currentPage, pageSize],
  );

  // 多选删除:选择跨翻页/筛选保留,只在任务真的消失(被删或后端不再返回)时收敛。
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(tasks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  const toggleSelected = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const pageIds = React.useMemo(() => paginated.map((t) => t.id), [paginated]);
  const pageSelectedCount = React.useMemo(
    () => pageIds.filter((id) => selectedIds.has(id)).length,
    [pageIds, selectedIds],
  );
  let headerChecked: boolean | "indeterminate" = false;
  if (pageIds.length > 0 && pageSelectedCount === pageIds.length) {
    headerChecked = true;
  } else if (pageSelectedCount > 0) {
    headerChecked = "indeterminate";
  }

  const toggleSelectedPage = React.useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of pageIds) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [pageIds],
  );

  // lastRef holds the previous poll's serialized payload: the list is re-fetched every
  // POLL_MS but usually comes back unchanged, and setTasks on an identical payload would
  // re-render the whole page for nothing. Bail out when it matches.
  const lastRef = React.useRef<string>("");
  // 请求序号:轮询与 mutation 后的 load 会并发,只认最后一次发出的响应,旧响应直接丢弃,
  // 避免慢请求晚到把新状态覆盖回去。
  const loadSeqRef = React.useRef(0);

  const load = React.useCallback(() => {
    const seq = ++loadSeqRef.current;
    // 返回 Promise，让 usePolling 能识别「上一轮仍在进行」并跳过重叠的一轮。
    return api
      .tasks()
      .then((r) => {
        if (seq !== loadSeqRef.current) return;
        setLoadError(null);
        const next = r.tasks.map((t) => (t.id === r.active ? { ...t, active: true } : t));
        const sig = JSON.stringify(next);
        if (sig === lastRef.current) return;
        lastRef.current = sig;
        setTasks(next);
      })
      .catch((error: unknown) => {
        // 轮询失败保留旧列表(不清空、不弹 toast),错误交给空列表的错误卡片与重试。
        if (seq !== loadSeqRef.current) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        // 首载结束(成功或失败)就收起骨架行。
        if (seq === loadSeqRef.current) setTasksLoaded(true);
      });
  }, []);

  const loadCategories = React.useCallback(() => {
    api
      .taskCategories()
      .then((next) => {
        setCategories(next);
        setCategoriesLoaded(true);
      })
      .catch(() => {
        // Category management remains retryable without blocking the task list.
      });
  }, []);

  // 分类只在进入页面时拉一次，不参与任务列表轮询。
  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // 任务列表每 POLL_MS 轮询一次；启用即执行、隐藏页暂停、重叠跳过都由 usePolling 负责。
  usePolling(load, POLL_MS);

  const refreshCategoriesAndTasks = React.useCallback(() => {
    lastRef.current = "";
    loadCategories();
    void load();
  }, [load, loadCategories]);

  const applyTaskCategoryMove = React.useCallback(
    (taskID: string, category: TaskCategory | null) => {
      setTasks((current) => {
        const next = current.map((task) =>
          task.id === taskID ? { ...task, category_id: category?.id, category_name: category?.name } : task,
        );
        lastRef.current = JSON.stringify(next);
        return next;
      });
      loadCategories();
    },
    [loadCategories],
  );

  React.useEffect(() => {
    if (!categoriesLoaded) return;
    if (categoryFilter === "all" || categoryFilter === UNCATEGORIZED_VALUE) return;
    if (!categories.some((category) => String(category.id) === categoryFilter)) setCategoryFilter("all");
  }, [categories, categoriesLoaded, categoryFilter]);

  // 只在确有 running 任务时才每秒 tick——其余情况「运行时长」是静态值,空转的 tick 会白白
  // 重渲染整张表。
  const hasRunning = React.useMemo(() => tasks.some((t) => t.status === "running"), [tasks]);

  // tick every second so running tasks' 运行时长 counts up live.
  React.useEffect(() => {
    if (!hasRunning) return;
    setNowSec(Math.floor(Date.now() / 1000));
    const i = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(i);
  }, [hasRunning]);

  const deleteTask = React.useCallback(
    async (id: string, options: DeleteTaskOptions) => {
      try {
        const result = await api.deleteTask(id, options);
        if (result.cleanup_warning) {
          toast.warning(`${deleteSummary(result)}；部分外部数据清理未完成：${result.cleanup_warning}`);
        } else {
          toast.success(deleteSummary(result));
        }
        void load();
      } catch (e) {
        toast.error("删除失败：" + (e as Error).message);
        throw e;
      }
    },
    [load],
  );

  // controlTask 是行内暂停/继续:批量走 controlTasksBatch,单行走单任务接口,省去
  // 「先勾选再点批量」。清空 lastRef 让下一次轮询即使负载相同也照单接收,否则状态
  // 回写会被去重挡掉、按钮看起来没反应。
  const controlTask = React.useCallback(
    async (id: string, action: "pause" | "resume") => {
      try {
        const result = await api.controlTask(id, action);
        toast.success(
          action === "pause" ? `任务 #${id} 已暂停` : `任务 #${id} 已继续${result.queued ? "，已进入队列" : ""}`,
        );
      } catch (e) {
        toast.error(`${action === "pause" ? "暂停" : "继续"}失败：${(e as Error).message}`);
      } finally {
        // 无论成败都刷新:失败多半是状态已变化,重新拉取才能让按钮回到正确形态。
        lastRef.current = "";
        void load();
      }
    },
    [load],
  );

  const renameTask = React.useCallback(
    async (task: Task, name: string) => {
      try {
        await api.renameTask(task.id, name);
        toast.success(`任务 #${task.id} 已重命名`);
        lastRef.current = "";
        void load();
      } catch (error) {
        toast.error(`重命名失败：${(error as Error).message}`);
        throw error;
      }
    },
    [load],
  );

  const toggleTaskPinned = React.useCallback(
    async (task: Task) => {
      const pinned = taskIsPinned(task);
      try {
        await api.pinTask(task.id, !pinned);
        toast.success(pinned ? `任务 #${task.id} 已取消置顶` : `任务 #${task.id} 已置顶`);
        lastRef.current = "";
        void load();
      } catch (error) {
        toast.error(`${pinned ? "取消置顶" : "置顶"}失败：${(error as Error).message}`);
        throw error;
      }
    },
    [load],
  );

  const queueTaskArchive = React.useCallback(
    async (task: Task) => {
      try {
        await api.archiveTask(task.id);
        toast.success(`任务 #${task.id} 已进入归档队列`);
        setActiveTab("archived");
        lastRef.current = "";
        void load();
      } catch (error) {
        toast.error(`归档失败：${(error as Error).message}`);
        throw error;
      }
    },
    [load],
  );

  // deleteTasks 逐个删除所选任务:后端没有批量接口,且单次删除会连带清理资产/流量/文件,
  // 串行执行以免一次性打爆后端;成功的从选中集移除,失败的保留以便重试。
  const deleteTasks = React.useCallback(
    async (ids: string[], options: DeleteTaskOptions, onProgress: (done: number) => void) => {
      const total: DeleteCounts = {
        assets_deleted: 0,
        assets_detached: 0,
        traffic_deleted: 0,
        files_deleted: false,
        findings_deleted: 0,
        llm_records_deleted: 0,
      };
      const deleted: string[] = [];
      const failed: { id: string; message: string }[] = [];
      const warnings: string[] = [];

      for (const id of ids) {
        try {
          const r = await api.deleteTask(id, options);
          total.assets_deleted += r.assets_deleted;
          total.assets_detached += r.assets_detached;
          total.traffic_deleted += r.traffic_deleted;
          total.files_deleted = total.files_deleted || r.files_deleted;
          total.findings_deleted += r.findings_deleted;
          total.llm_records_deleted += r.llm_records_deleted;
          if (r.cleanup_warning) warnings.push(`#${id}：${r.cleanup_warning}`);
          deleted.push(id);
        } catch (e) {
          failed.push({ id, message: (e as Error).message });
        }
        onProgress(deleted.length + failed.length);
      }

      if (deleted.length > 0) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of deleted) next.delete(id);
          return next;
        });
        const details = deleteDetails(total);
        const summary = `已删除 ${deleted.length} 个任务` + (details.length > 0 ? `（${details.join("，")}）` : "");
        if (warnings.length > 0) {
          toast.warning(`${summary}；部分外部数据清理未完成：${warnings.join("；")}`);
        } else {
          toast.success(summary);
        }
      }
      if (failed.length > 0) {
        const head = failed
          .slice(0, 3)
          .map((f) => `#${f.id}（${f.message}）`)
          .join("；");
        toast.error(`${failed.length} 个任务删除失败：${head}${failed.length > 3 ? " 等" : ""}`);
      }
      void load();
    },
    [load],
  );

  const selectedTasks = React.useMemo(() => tasks.filter((task) => selectedIds.has(task.id)), [tasks, selectedIds]);
  const pausableTaskIDs = React.useMemo(
    () => selectedTasks.filter((task) => taskControlAction(task.status) === "pause").map((task) => task.id),
    [selectedTasks],
  );
  const resumableTaskIDs = React.useMemo(
    () => selectedTasks.filter((task) => taskControlAction(task.status) === "resume").map((task) => task.id),
    [selectedTasks],
  );
  const archivableTaskIDs = React.useMemo(
    () => selectedTasks.filter((task) => ARCHIVABLE_STATUSES.has(task.status) && !task.queued).map((task) => task.id),
    [selectedTasks],
  );

  const archiveSelectedTasks = React.useCallback(async () => {
    if (archivableTaskIDs.length === 0) return;
    const result = await api.archiveTasks(archivableTaskIDs);
    const succeeded = result.items.filter((item) => item.ok);
    const failed = result.items.filter((item) => !item.ok);
    if (succeeded.length > 0) toast.success(`已将 ${succeeded.length} 个任务加入归档队列`);
    if (failed.length > 0) {
      toast.error(
        `${failed.length} 个任务无法归档：${failed
          .slice(0, 3)
          .map((item) => `#${item.id}（${item.error || "状态已变化"}）`)
          .join("；")}`,
      );
    }
    setSelectedIds(new Set());
    setActiveTab("archived");
    lastRef.current = "";
    void load();
  }, [archivableTaskIDs, load]);

  const controlSelectedTasks = React.useCallback(
    async (action: "pause" | "resume", ids: string[]) => {
      if (ids.length === 0 || batchControlling) return;
      if (ids.length > 100) {
        toast.error("一次最多控制 100 个任务");
        return;
      }
      setBatchControlling(action);
      try {
        const result = await api.controlTasksBatch(ids, action);
        const succeeded = result.items.filter((item) => item.ok);
        const failed = result.items.filter((item) => !item.ok);
        if (succeeded.length > 0) {
          toast.success(
            action === "pause"
              ? `已暂停 ${succeeded.length} 个任务`
              : `已继续 ${succeeded.length} 个任务${succeeded.some((item) => item.queued) ? "，部分任务已进入队列" : ""}`,
          );
        }
        if (failed.length > 0) {
          const details = failed
            .slice(0, 3)
            .map((item) => `#${item.id}（${item.error || "状态已变化"}）`)
            .join("；");
          toast.error(`${failed.length} 个任务操作失败：${details}${failed.length > 3 ? " 等" : ""}`);
        }
        lastRef.current = "";
        void load();
      } catch (error) {
        toast.error(`${action === "pause" ? "批量暂停" : "批量继续"}失败：${(error as Error).message}`);
      } finally {
        setBatchControlling(null);
      }
    },
    [batchControlling, load],
  );

  // 后端把整批分类写入放在一个事务里，所以失败项只可能是勾选后又被删掉的任务。
  // 返回是否真的改成功:确认框据此决定关闭还是留在原地(失败时整批都没动,
  // 关掉对话框会让用户以为已生效,还得重新勾选一遍)。
  const moveSelectedTasksCategory = React.useCallback(
    async (categoryID?: number): Promise<boolean> => {
      const ids = [...selectedIds];
      if (ids.length === 0 || movingCategory) return false;
      if (ids.length > 100) {
        toast.error("一次最多修改 100 个任务的分类");
        return false;
      }
      setMovingCategory(true);
      try {
        const result = await api.updateTasksCategory(ids, categoryID);
        const succeeded = result.items.filter((item) => item.ok);
        const failed = result.items.filter((item) => !item.ok);
        const target = result.category?.name ?? "未分类";
        if (succeeded.length > 0) {
          toast.success(`已将 ${succeeded.length} 个任务移动到「${target}」`);
          setSelectedIds(new Set());
        }
        if (failed.length > 0) {
          const details = failed
            .slice(0, 3)
            .map((item) => `#${item.id}（${item.error || "任务已不存在"}）`)
            .join("；");
          toast.error(`${failed.length} 个任务未能移动：${details}${failed.length > 3 ? " 等" : ""}`);
        }
        refreshCategoriesAndTasks();
        return succeeded.length > 0;
      } catch (error) {
        toast.error(`修改分类失败：${(error as Error).message}`);
        return false;
      } finally {
        setMovingCategory(false);
      }
    },
    [movingCategory, refreshCategoriesAndTasks, selectedIds],
  );

  // 头部轻量计数与手动刷新:纯本地视图动作,不改变轮询节奏。
  const runningCount = React.useMemo(() => tasks.filter((task) => task.status === "running").length, [tasks]);
  const refreshTasks = React.useCallback(() => {
    lastRef.current = "";
    void load();
  }, [load]);
  const resetFilters = React.useCallback(() => {
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    searchInputRef.current?.focus();
  }, []);
  // 空态里的「创建第一个任务」复用工具栏的新建任务按钮,避免出现两个同名可访问名称。
  const openCreateTask = React.useCallback(() => {
    document.getElementById("tasks-create-trigger")?.click();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={TargetIcon}
        title="测试任务"
        description="管理授权范围内的测试任务：跟踪运行状态与目标进度，归档已结束的任务。"
        actions={
          <>
            <span className="app-chip h-8 tabular-nums">
              <span
                className={cn("size-1.5 rounded-full", runningCount > 0 ? "bg-success" : "bg-muted-foreground/40")}
              />
              运行中 <span className="font-semibold text-foreground">{runningCount}</span>
            </span>
            <Button variant="outline" size="sm" aria-label="刷新任务列表" onClick={refreshTasks}>
              <RefreshCwIcon />
              刷新
            </Button>
            {/* 全页唯一的新建入口：工具栏里那个同名按钮已移除，空态按钮按 id 复用它。 */}
            <CreateTaskSheet
              triggerId="tasks-create-trigger"
              categories={categories}
              onCreated={refreshCategoriesAndTasks}
              onCategoriesChanged={refreshCategoriesAndTasks}
            />
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="current">当前任务</TabsTrigger>
          <TabsTrigger value="archived">已归档</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <SectionCard
            icon={ListChecksIcon}
            title="任务列表"
            description="按状态与分类筛选；勾选任务后可批量暂停、归档或删除。"
            dense
            className="overflow-visible"
            bodyClassName="px-0"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-5 py-3">
              <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  ref={searchInputRef}
                  aria-label="搜索任务"
                  placeholder="搜索描述 / 目标 / ID"
                  value={query}
                  onChange={(e: any) => setQuery(e.target.value)}
                  onKeyDown={(event) => {
                    // 有内容时 Esc 只清空搜索,不冒泡去关外层弹层。
                    if (event.key === "Escape" && query) {
                      event.preventDefault();
                      event.stopPropagation();
                      clearQuery();
                    }
                  }}
                  className="h-8 pl-8 text-[13px]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={clearQuery}
                    aria-label="清除搜索"
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <XIcon className="size-4" />
                  </button>
                )}
              </div>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}>
                <SelectTrigger className="w-[8.5rem] text-[13px]">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">全部状态</SelectItem>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 text-[13px]">
                  <SelectValue placeholder="任务分类" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value={UNCATEGORIZED_VALUE}>未分类</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <span className="text-muted-foreground text-[12px] whitespace-nowrap tabular-nums">
                {filtered.length === tasks.length ? (
                  <>
                    共 <span className="font-medium text-foreground">{filtered.length}</span> 条
                  </>
                ) : (
                  <>
                    筛选 <span className="font-medium text-foreground">{filtered.length}</span> / 共 {tasks.length} 条
                  </>
                )}
              </span>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <MoreManageMenu>
                  <ConcurrencySettingsDialog />
                  <CategoryManagementSheet
                    categories={categories}
                    tasks={tasks}
                    onChanged={refreshCategoriesAndTasks}
                    onTaskMoved={applyTaskCategoryMove}
                  />
                </MoreManageMenu>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="border-primary/15 bg-brand-soft flex flex-wrap items-center gap-2 border-b px-5 py-2">
                <span className="text-[13px] font-medium tabular-nums">已选 {selectedIds.size} 个</span>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  取消选择
                </Button>
                {pausableTaskIDs.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={batchControlling !== null}
                    onClick={() => void controlSelectedTasks("pause", pausableTaskIDs)}
                  >
                    {batchControlling === "pause" ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <PauseIcon data-icon="inline-start" />
                    )}
                    暂停 {pausableTaskIDs.length}
                  </Button>
                )}
                {resumableTaskIDs.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={batchControlling !== null}
                    onClick={() => void controlSelectedTasks("resume", resumableTaskIDs)}
                  >
                    {batchControlling === "resume" ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <PlayIcon data-icon="inline-start" />
                    )}
                    继续 {resumableTaskIDs.length}
                  </Button>
                )}
                {archivableTaskIDs.length > 0 && (
                  <ArchiveConfirmDialog
                    count={archivableTaskIDs.length}
                    onConfirm={archiveSelectedTasks}
                    trigger={
                      <Button size="sm" variant="outline">
                        <ArchiveIcon data-icon="inline-start" />
                        归档 {archivableTaskIDs.length}
                      </Button>
                    }
                  />
                )}
                <MoveTasksCategoryDialog
                  categories={categories}
                  count={selectedIds.size}
                  moving={movingCategory}
                  onMove={moveSelectedTasksCategory}
                />
                <BulkDeleteTasksDialog ids={[...selectedIds]} onDelete={deleteTasks} />
              </div>
            )}

            {tasksLoaded && tasks.length === 0 && loadError ? (
              <TaskEmptyState
                role="alert"
                icon={CircleAlertIcon}
                tone="destructive"
                title="任务列表加载失败"
                description={loadError}
                action={
                  <Button size="sm" variant="outline" onClick={refreshTasks}>
                    重试
                  </Button>
                }
              />
            ) : tasksLoaded && tasks.length === 0 ? (
              <TaskEmptyState
                icon={InboxIcon}
                title="暂无测试任务"
                description="新建任务并填写测试对象与目标，Agent 会按授权范围开始自动探索。"
                action={
                  // 页头已有唯一的主操作「新建任务」，空态这里只做引导，用 outline
                  // 避免同一屏出现两个 primary（REFINE-SPEC 二.8）。
                  <Button size="sm" variant="outline" onClick={openCreateTask}>
                    <PlusIcon data-icon="inline-start" />
                    创建第一个任务
                  </Button>
                }
              />
            ) : tasksLoaded && filtered.length === 0 ? (
              <TaskEmptyState
                icon={SearchXIcon}
                title="没有匹配的任务"
                description="换一个关键词，或把状态与分类筛选恢复为全部。"
                action={
                  <Button size="sm" variant="outline" onClick={resetFilters}>
                    清除筛选
                  </Button>
                }
              />
            ) : (
              <Table className="min-w-[1100px] [&_tbody_[data-slot=table-cell]]:py-2">
                <TableHeader>
                  <TableRow className="hover:bg-transparent [&_[data-slot=table-head]]:h-9">
                    <TableHead className="w-10 pl-4 lg:pl-5">
                      <Checkbox
                        checked={headerChecked}
                        onCheckedChange={(checked) => toggleSelectedPage(checked === true)}
                        aria-label="选择本页全部任务"
                      />
                    </TableHead>
                    <SortableTaskHead
                      field="id"
                      label="ID"
                      activeField={sortField}
                      direction={sortDirection}
                      className="w-16 font-mono"
                      onSort={sortTasksBy}
                    />
                    <TableHead className="w-[172px]">名称</TableHead>
                    <TableHead className="w-[196px]">描述 / 目标</TableHead>
                    <SortableTaskHead
                      field="status"
                      label="状态"
                      activeField={sortField}
                      direction={sortDirection}
                      className="w-[96px]"
                      onSort={sortTasksBy}
                    />
                    <TableHead className="w-[80px] text-center">目标进度</TableHead>
                    <SortableTaskHead
                      field="created"
                      label="创建时间"
                      activeField={sortField}
                      direction={sortDirection}
                      align="right"
                      className="w-[92px]"
                      onSort={sortTasksBy}
                    />
                    <SortableTaskHead
                      field="duration"
                      label="运行时长"
                      activeField={sortField}
                      direction={sortDirection}
                      align="right"
                      className="w-[80px]"
                      onSort={sortTasksBy}
                    />
                    <TableHead className="w-[120px] text-right">Token</TableHead>
                    <TableHead className="bg-surface-muted w-[176px] text-right md:sticky md:right-0 md:z-10 md:shadow-[-1px_0_0_0_var(--border)]">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksLoaded
                    ? paginated.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          // running 任务才吃 nowSec;其余行传 0 —— props 不变,memo 就能拦下每秒 tick
                          // 带来的整表重渲染,只让在跑的那几行走时长。
                          nowSec={task.status === "running" ? nowSec : 0}
                          onDelete={deleteTask}
                          onControl={controlTask}
                          onRename={renameTask}
                          onTogglePinned={toggleTaskPinned}
                          onArchive={queueTaskArchive}
                          selected={selectedIds.has(task.id)}
                          onSelectedChange={toggleSelected}
                        />
                      ))
                    : TASK_SKELETON_KEYS.slice(0, Math.min(pageSize, TASK_SKELETON_KEYS.length)).map((key) => (
                        <TaskRowSkeleton key={key} />
                      ))}
                </TableBody>
              </Table>
            )}
            {tasksLoaded && filtered.length > 0 && (
              <p className="text-muted-foreground px-5 pt-2 text-[12px] md:hidden">
                左右滑动表格可查看全部列与行内操作
              </p>
            )}
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="archived">
          <TaskArchivesPanel onChanged={load} onGoCurrent={() => setActiveTab("current")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// MoreManageMenu 保留「更多管理」这个原生 details 入口(e2e 与键盘都按它定位),
// 只是把它做成一枚按钮样式的触发器和浮层,并在点击外部时自动收起。
function MoreManageMenu({ children }: { children: React.ReactNode }) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null);

  React.useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      const el = detailsRef.current;
      if (!el?.open) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      el.open = false;
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, []);

  return (
    <details ref={detailsRef} className="group/more relative">
      <summary className="border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent hover:text-accent-foreground flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <Settings2Icon className="text-muted-foreground size-3.5" />
        更多管理
        <ChevronDownIcon className="text-muted-foreground size-3.5 transition-transform group-open/more:rotate-180" />
      </summary>
      <div className="border-border bg-popover absolute top-[calc(100%+6px)] right-0 z-40 w-60 rounded-lg border p-1.5 shadow-[var(--shadow-raised)]">
        <p className="text-muted-foreground px-2 pt-1 pb-1.5 text-[11px]">分类与调度</p>
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </details>
  );
}

// TaskEmptyState 统一了「加载失败 / 暂无任务 / 无匹配」三种空态:图标块 + 标题 + 说明 + 动作,
// 让列表在没有数据时仍然给出下一步,而不是一条居中的灰字。
function TaskEmptyState({
  icon: Icon,
  title,
  description,
  action,
  role,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
  role?: React.AriaRole;
  tone?: "neutral" | "destructive";
}) {
  return (
    <div role={role} className="flex flex-col items-center justify-center gap-1.5 px-6 py-6 text-center">
      <Icon
        className={cn("size-6", tone === "destructive" ? "text-destructive" : "text-muted-foreground/60")}
        aria-hidden="true"
      />
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-foreground text-[13px] font-semibold">{title}</p>
        <p className="text-muted-foreground text-[12px] leading-5 [overflow-wrap:anywhere]">{description}</p>
      </div>
      {action ? <div className="flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

function taskSortIcon(active: boolean, direction: SortDirection) {
  if (!active) {
    return <ArrowUpDownIcon className="size-3.5 opacity-40 transition-opacity group-hover/sort:opacity-100" />;
  }
  if (direction === "asc") return <ArrowUpIcon className="size-3.5" />;
  return <ArrowDownIcon className="size-3.5" />;
}

function SortableTaskHead({
  field,
  label,
  activeField,
  direction,
  align = "left",
  className,
  onSort,
}: {
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
  if (active) ariaSort = direction === "asc" ? "ascending" : "descending";

  let actionLabel = `按${label}倒序排序`;
  if (active) actionLabel = `${label}当前${direction === "asc" ? "正序" : "倒序"}，点击切换排序方向`;

  return (
    <TableHead className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className={cn(
          "group/sort inline-flex h-full w-full items-center gap-1 outline-none focus-visible:underline",
          align === "right" && "justify-end",
        )}
        aria-label={actionLabel}
        onClick={() => onSort(field)}
      >
        <span>{label}</span>
        {taskSortIcon(active, direction)}
      </button>
    </TableHead>
  );
}

// BulkDeleteTasksDialog deletes every checked task with one shared set of cleanup options.
// The backend has no batch endpoint, so deletion runs one task at a time (see deleteTasks)
// and the button shows live progress.
// MoveTasksCategoryDialog confirms a target before applying, so a mis-click on a
// large selection cannot silently re-file every task. UNCATEGORIZED_VALUE stands
// in for "no category" because Select rejects an empty string value.
function MoveTasksCategoryDialog({
  categories,
  count,
  moving,
  onMove,
}: {
  categories: TaskCategory[];
  count: number;
  moving: boolean;
  // 返回 false 表示整批都没改成:确认框保持打开,用户可直接换个分类重试。
  onMove: (categoryID?: number) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState(UNCATEGORIZED_VALUE);

  const handleOpenChange = (next: boolean) => {
    if (moving) return;
    setOpen(next);
    if (next) setTarget(UNCATEGORIZED_VALUE);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FolderInputIcon data-icon="inline-start" /> 修改分类
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改所选 {count} 个任务的分类</DialogTitle>
          <DialogDescription>目标分类对所选任务统一生效；选「未分类」会把它们移出当前分类。</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="bulk-category">目标分类</FieldLabel>
          <Select value={target} onValueChange={setTarget} disabled={moving}>
            <SelectTrigger id="bulk-category" className="w-full">
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={UNCATEGORIZED_VALUE}>未分类</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {categories.length === 0 && <FieldDescription>还没有任何分类，先用「分类管理」创建一个。</FieldDescription>}
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={moving}>
              取消
            </Button>
          </DialogClose>
          <Button
            disabled={moving}
            onClick={() => {
              void onMove(target === UNCATEGORIZED_VALUE ? undefined : Number(target)).then((moved) => {
                if (moved) setOpen(false);
              });
            }}
          >
            {moving && <Spinner data-icon="inline-start" />}
            移动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CategoryManagementView = number | "uncategorized" | "new";

function CategoryDropTarget({
  value,
  name,
  count,
  selected,
  disabled,
  onSelect,
}: {
  value: string;
  name: string;
  count: number;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `category:${value}`, disabled });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "min-w-0 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
        isOver && "border-primary bg-primary/10 text-foreground",
      )}
      onClick={onSelect}
    >
      <span className="block truncate font-medium text-sm">{name}</span>
      <span className="block truncate text-muted-foreground text-xs">{isOver ? "松开以移动" : `${count} 个任务`}</span>
    </button>
  );
}

function DraggableCategoryTask({ task, disabled, moving }: { task: Task; disabled: boolean; moving: boolean }) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: `task:${task.id}`,
    disabled,
  });

  return (
    <Item ref={setNodeRef} variant="outline" size="sm" className={cn(isDragging && "opacity-40")}>
      <ItemMedia className="group-has-data-[slot=item-description]/item:self-center group-has-data-[slot=item-description]/item:translate-y-0">
        {moving ? (
          <Spinner />
        ) : (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="touch-none cursor-grab active:cursor-grabbing"
            disabled={disabled}
            {...listeners}
            {...attributes}
            aria-label={`拖动任务 #${task.id}`}
            title="拖动任务"
          >
            <GripVerticalIcon />
          </Button>
        )}
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0">
          <Link href={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`} className="truncate hover:underline">
            {task.name?.trim() || task.description || `任务 #${task.id}`}
          </Link>
        </ItemTitle>
        <ItemDescription className="line-clamp-1">
          #{task.id} · {task.description}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <StatusBadge domain="task" value={task.status} />
      </ItemActions>
    </Item>
  );
}

function CategoryTaskDragPreview({ task }: { task: Task }) {
  return (
    <Item variant="outline" size="sm" className="w-80 bg-background shadow-lg">
      <ItemMedia className="group-has-data-[slot=item-description]/item:self-center group-has-data-[slot=item-description]/item:translate-y-0">
        <GripVerticalIcon className="size-4 text-muted-foreground" />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full min-w-0 truncate">
          {task.name?.trim() || task.description || `任务 #${task.id}`}
        </ItemTitle>
        <ItemDescription className="line-clamp-1">#{task.id}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function CategoryManagementSheet({
  categories,
  tasks,
  onChanged,
  onTaskMoved,
}: {
  categories: TaskCategory[];
  tasks: Task[];
  onChanged: () => void;
  onTaskMoved: (taskID: string, category: TaskCategory | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedView, setSelectedView] = React.useState<CategoryManagementView>("new");
  const [draftName, setDraftName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [movingTaskID, setMovingTaskID] = React.useState<string | null>(null);
  const [activeTaskID, setActiveTaskID] = React.useState<string | null>(null);
  const wasOpen = React.useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  React.useEffect(() => {
    if (open && !wasOpen.current) {
      const first = categories[0];
      if (first) {
        setSelectedView(first.id);
        setDraftName(first.name);
      } else if (tasks.some((task) => task.category_id == null)) {
        setSelectedView("uncategorized");
        setDraftName("");
      } else {
        setSelectedView("new");
        setDraftName("");
      }
    }
    wasOpen.current = open;
  }, [categories, open, tasks]);

  const selectedCategory = React.useMemo(
    () =>
      typeof selectedView === "number" ? (categories.find((category) => category.id === selectedView) ?? null) : null,
    [categories, selectedView],
  );

  const uncategorizedCount = React.useMemo(() => tasks.filter((task) => task.category_id == null).length, [tasks]);

  const visibleTasks = React.useMemo(() => {
    if (selectedView === "uncategorized") return tasks.filter((task) => task.category_id == null);
    if (typeof selectedView === "number") return tasks.filter((task) => task.category_id === selectedView);
    return [];
  }, [selectedView, tasks]);

  const activeTask = React.useMemo(() => tasks.find((task) => task.id === activeTaskID) ?? null, [activeTaskID, tasks]);

  const selectCategory = (category: TaskCategory) => {
    setSelectedView(category.id);
    setDraftName(category.name);
  };

  const selectUncategorized = () => {
    setSelectedView("uncategorized");
    setDraftName("");
  };

  const startNew = () => {
    setSelectedView("new");
    setDraftName("");
  };

  async function saveCategory() {
    const name = draftName.trim();
    if (!name || saving || selectedView === "uncategorized") return;
    setSaving(true);
    try {
      if (selectedView === "new") {
        const created = await api.createTaskCategory(name);
        setSelectedView(created.id);
        setDraftName(created.name);
        toast.success("分类已创建");
      } else {
        const updated = await api.renameTaskCategory(selectedView, name);
        setDraftName(updated.name);
        toast.success("分类已更新");
      }
      onChanged();
    } catch (error) {
      toast.error(`${selectedView === "new" ? "创建" : "更新"}分类失败：${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory() {
    if (!selectedCategory || deleting) return;
    const deletedID = selectedCategory.id;
    setDeleting(true);
    try {
      await api.deleteTaskCategory(deletedID);
      const next = categories.find((category) => category.id !== deletedID);
      if (next) selectCategory(next);
      else selectUncategorized();
      toast.success("分类已删除，关联任务已移入未分类");
      setDeleteOpen(false);
      onChanged();
    } catch (error) {
      toast.error(`删除分类失败：${(error as Error).message}`);
    } finally {
      setDeleting(false);
    }
  }

  async function moveTask(task: Task, destination: string) {
    if (movingTaskID) return;
    const category =
      destination === "uncategorized" ? null : (categories.find((item) => item.id === Number(destination)) ?? null);
    if (destination !== "uncategorized" && !category) {
      toast.error("目标分类不存在，请刷新后重试");
      return;
    }
    if (task.category_id === category?.id || (task.category_id == null && category == null)) return;

    setMovingTaskID(task.id);
    try {
      await api.updateTaskCategory(task.id, category?.id);
      onTaskMoved(task.id, category);
      toast.success(`任务 #${task.id} 已移至「${category?.name ?? "未分类"}」`);
    } catch (error) {
      toast.error(`移动任务失败：${(error as Error).message}`);
    } finally {
      setMovingTaskID(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveTaskID(id.startsWith("task:") ? id.slice("task:".length) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeID = String(event.active.id);
    const taskID = activeID.startsWith("task:") ? activeID.slice("task:".length) : null;
    setActiveTaskID(null);
    if (!taskID || !event.over) return;
    const destination = String(event.over.id);
    if (!destination.startsWith("category:")) return;
    const task = tasks.find((item) => item.id === taskID);
    if (!task) return;
    void moveTask(task, destination.slice("category:".length));
  }

  const saveLabel = saving ? "保存中" : selectedView === "new" ? "创建分类" : "保存修改";

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" variant="ghost" className="w-full justify-start">
            <TagsIcon data-icon="inline-start" />
            分类管理
          </Button>
        </SheetTrigger>
        <SheetContent className="grid h-full w-full! max-w-none! grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-[48rem]! sm:max-w-[48rem]!">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>任务分类管理</SheetTitle>
            <SheetDescription>分类用于任务筛选与归档；修改不会影响任务执行，删除后任务会移入未分类。</SheetDescription>
          </SheetHeader>
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragCancel={() => setActiveTaskID(null)}
            onDragEnd={handleDragEnd}
          >
            <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[15rem_minmax(0,1fr)] lg:overflow-hidden">
              <div className="flex min-h-0 flex-col border-b p-3 lg:border-r lg:border-b-0">
                <Button type="button" variant="outline" className="w-full" onClick={startNew}>
                  <PlusIcon data-icon="inline-start" />
                  新建分类
                </Button>
                <ScrollArea className="mt-2 max-h-44 lg:max-h-none lg:flex-1">
                  <div className="flex flex-col gap-1 pr-2">
                    <CategoryDropTarget
                      value="uncategorized"
                      name="未分类"
                      count={uncategorizedCount}
                      selected={selectedView === "uncategorized"}
                      disabled={movingTaskID != null}
                      onSelect={selectUncategorized}
                    />
                    {categories.map((category) => (
                      <CategoryDropTarget
                        key={category.id}
                        value={String(category.id)}
                        name={category.name}
                        count={category.task_count}
                        selected={selectedView === category.id}
                        disabled={movingTaskID != null}
                        onSelect={() => selectCategory(category)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <ScrollArea className="min-h-0">
                <FieldGroup className="p-6">
                  {selectedView !== "uncategorized" && (
                    <Field>
                      <FieldLabel htmlFor="task-category-name">分类名称</FieldLabel>
                      <Input
                        id="task-category-name"
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        placeholder="例如：外网评估"
                        maxLength={80}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void saveCategory();
                        }}
                      />
                      <FieldDescription>
                        {selectedCategory
                          ? `当前有 ${selectedCategory.task_count} 个任务使用该分类。重命名后会同步更新任务列表。`
                          : "创建后可在新建任务和任务列表筛选中使用。"}
                      </FieldDescription>
                    </Field>
                  )}
                  {selectedView !== "new" && (
                    <Field>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-1">
                          <FieldLabel>{selectedCategory ? "分类任务" : "未分类任务"}</FieldLabel>
                          <FieldDescription>
                            {selectedCategory
                              ? `该分类包含 ${visibleTasks.length} 个任务。`
                              : `当前有 ${visibleTasks.length} 个任务尚未分类。`}
                          </FieldDescription>
                        </div>
                      </div>
                      {visibleTasks.length === 0 ? (
                        <Empty className="min-h-36 border">
                          <EmptyHeader>
                            <EmptyTitle>{selectedCategory ? "该分类暂无任务" : "暂无未分类任务"}</EmptyTitle>
                            <EmptyDescription>此处将在任务归入后显示内容。</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      ) : (
                        <ItemGroup className="gap-2">
                          {visibleTasks.map((task) => (
                            <DraggableCategoryTask
                              key={task.id}
                              task={task}
                              moving={movingTaskID === task.id}
                              disabled={movingTaskID != null}
                            />
                          ))}
                        </ItemGroup>
                      )}
                    </Field>
                  )}
                </FieldGroup>
              </ScrollArea>
            </div>
            <DragOverlay>{activeTask ? <CategoryTaskDragPreview task={activeTask} /> : null}</DragOverlay>
          </DndContext>
          <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:items-center">
            {selectedCategory && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={saving || deleting}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" />
                删除分类
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
            {selectedView !== "uncategorized" && (
              <Button
                type="button"
                disabled={!draftName.trim() || saving || deleting}
                onClick={() => void saveCategory()}
              >
                {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                {saveLabel}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分类「{selectedCategory?.name || "未命名分类"}」？</AlertDialogTitle>
            <AlertDialogDescription>
              分类删除后，其中 {selectedCategory?.task_count ?? 0} 个任务会自动移入“未分类”，任务数据不会被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteCategory();
              }}
            >
              {deleting && <Spinner data-icon="inline-start" />}
              {deleting ? "删除中" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
