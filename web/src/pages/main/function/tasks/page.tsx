import * as React from "react";
import { Button, Card, Checkbox, Disclosure, ListBox, SearchField, Select, Spinner, Table, Tabs } from "@/components/mui-compat";
import { ArchiveIcon, PauseIcon, PlayIcon, SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { TablePagination } from "@/components/table-pagination";
import { api } from "@/lib/api";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import { useStoredSortPreference } from "@/lib/sort-preference";
import type { DeleteTaskOptions, Task, TaskCategory, TaskStatus } from "@/lib/types";
import { CategoryManagementSheet, CreateTaskSheet } from "./_components/task-category-controls";
import { ArchiveConfirmDialog, BulkDeleteTasksDialog, ConcurrencySettingsDialog, MoveTasksCategoryDialog, SortableTaskHead, TaskArchivesPanel, TaskRow, } from "./_components/task-rows-and-dialogs";
import { ARCHIVABLE_STATUSES, compareTasks, DeleteCounts, deleteDetails, deleteSummary, POLL_MS, STATUS_OPTIONS, TASK_FILTER_PREFERENCE_KEY, TASK_SORT_FIELDS, TASK_SORT_PREFERENCE_KEY, TaskSortField, taskControlAction, taskIsPinned, UNCATEGORIZED_VALUE, } from "./_components/task-shared";
export default function TasksPage() {
    const [activeTab, setActiveTab] = React.useState("current");
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [categories, setCategories] = React.useState<TaskCategory[]>([]);
    const [categoriesLoaded, setCategoriesLoaded] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<TaskStatus | "all">("all");
    const [categoryFilter, setCategoryFilter] = React.useState("all");
    const [filtersHydrated, setFiltersHydrated] = React.useState(false);
    const [sortPreference, setSortPreference] = useStoredSortPreference(TASK_SORT_PREFERENCE_KEY, TASK_SORT_FIELDS, "id", "desc");
    const { field: sortField, direction: sortDirection } = sortPreference;
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(20);
    const [nowSec, setNowSec] = React.useState(() => Math.floor(Date.now() / 1000));
    const [batchControlling, setBatchControlling] = React.useState<"pause" | "resume" | null>(null);
    const [movingCategory, setMovingCategory] = React.useState(false);
    React.useEffect(() => {
        const raw = getLocalStorageValue(TASK_FILTER_PREFERENCE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as {
                    status?: unknown;
                    category?: unknown;
                };
                if (parsed.status === "all" || STATUS_OPTIONS.some((option) => option.value === parsed.status)) {
                    setStatusFilter(parsed.status as TaskStatus | "all");
                }
                if (typeof parsed.category === "string" &&
                    (parsed.category === "all" || parsed.category === UNCATEGORIZED_VALUE || /^\d+$/.test(parsed.category))) {
                    setCategoryFilter(parsed.category);
                }
            }
            catch {
                // Ignore malformed or legacy preferences and retain the defaults.
            }
        }
        setFiltersHydrated(true);
    }, []);
    React.useEffect(() => {
        if (!filtersHydrated)
            return;
        setLocalStorageValue(TASK_FILTER_PREFERENCE_KEY, JSON.stringify({ status: statusFilter, category: categoryFilter }));
    }, [categoryFilter, filtersHydrated, statusFilter]);
    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        return tasks.filter((t) => {
            if (statusFilter !== "all" && t.status !== statusFilter)
                return false;
            if (categoryFilter === UNCATEGORIZED_VALUE && t.category_id != null)
                return false;
            if (categoryFilter !== "all" &&
                categoryFilter !== UNCATEGORIZED_VALUE &&
                String(t.category_id) !== categoryFilter)
                return false;
            if (!q)
                return true;
            return ((t.name ?? "").toLowerCase().includes(q) ||
                (t.category_name ?? "").toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.goal.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q));
        });
    }, [tasks, query, statusFilter, categoryFilter]);
    const sortNowSec = sortField === "duration" ? nowSec : 0;
    const ordered = React.useMemo(() => {
        return [...filtered].sort((left, right) => compareTasks(left, right, sortField, sortDirection, sortNowSec));
    }, [filtered, sortDirection, sortField, sortNowSec]);
    const sortTasksBy = React.useCallback((field: TaskSortField) => {
        setSortPreference((current) => {
            if (current.field !== field)
                return { field, direction: "desc" };
            return { field, direction: current.direction === "asc" ? "desc" : "asc" };
        });
    }, [setSortPreference]);
    // reset to page 1 whenever filters or ordering change
    // biome-ignore lint/correctness/useExhaustiveDependencies: both filters intentionally reset pagination.
    React.useEffect(() => {
        setPage(1);
    }, [query, statusFilter, categoryFilter, sortField, sortDirection]);
    const paginated = React.useMemo(() => ordered.slice((page - 1) * pageSize, page * pageSize), [ordered, page, pageSize]);
    // 多选删除:选择跨翻页/筛选保留,只在任务真的消失(被删或后端不再返回)时收敛。
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
    React.useEffect(() => {
        setSelectedIds((prev) => {
            if (prev.size === 0)
                return prev;
            const live = new Set(tasks.map((t) => t.id));
            const next = new Set([...prev].filter((id) => live.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [tasks]);
    const toggleSelected = React.useCallback((id: string, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked)
                next.add(id);
            else
                next.delete(id);
            return next;
        });
    }, []);
    const pageIds = React.useMemo(() => paginated.map((t) => t.id), [paginated]);
    const pageSelectedCount = React.useMemo(() => pageIds.filter((id) => selectedIds.has(id)).length, [pageIds, selectedIds]);
    let headerChecked: boolean | "indeterminate" = false;
    if (pageIds.length > 0 && pageSelectedCount === pageIds.length) {
        headerChecked = true;
    }
    else if (pageSelectedCount > 0) {
        headerChecked = "indeterminate";
    }
    const toggleSelectedPage = React.useCallback((checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            for (const id of pageIds) {
                if (checked)
                    next.add(id);
                else
                    next.delete(id);
            }
            return next;
        });
    }, [pageIds]);
    // lastRef holds the previous poll's serialized payload: the list is re-fetched every
    // POLL_MS but usually comes back unchanged, and setTasks on an identical payload would
    // re-render the whole page for nothing. Bail out when it matches.
    const lastRef = React.useRef<string>("");
    const load = React.useCallback(() => {
        api
            .tasks()
            .then((r) => {
            const next = r.tasks.map((t) => (t.id === r.active ? { ...t, active: true } : t));
            const sig = JSON.stringify(next);
            if (sig === lastRef.current)
                return;
            lastRef.current = sig;
            setTasks(next);
        })
            .catch(() => {
            // Polling is best-effort; the next interval retries automatically.
        });
    }, []);
    const loadCategories = React.useCallback(() => {
        api
            .taskCategories()
            .then((next: any) => {
            setCategories(next);
            setCategoriesLoaded(true);
        })
            .catch(() => {
            // Category management remains retryable without blocking the task list.
        });
    }, []);
    React.useEffect(() => {
        load();
        loadCategories();
        const i = setInterval(load, POLL_MS);
        return () => clearInterval(i);
    }, [load, loadCategories]);
    const refreshCategoriesAndTasks = React.useCallback(() => {
        lastRef.current = "";
        loadCategories();
        load();
    }, [load, loadCategories]);
    const applyTaskCategoryMove = React.useCallback((taskID: string, category: TaskCategory | null) => {
        setTasks((current) => {
            const next = current.map((task) => task.id === taskID ? { ...task, category_id: category?.id, category_name: category?.name } : task);
            lastRef.current = JSON.stringify(next);
            return next;
        });
        loadCategories();
    }, [loadCategories]);
    React.useEffect(() => {
        if (!categoriesLoaded)
            return;
        if (categoryFilter === "all" || categoryFilter === UNCATEGORIZED_VALUE)
            return;
        if (!categories.some((category: any) => String(category.id) === categoryFilter))
            setCategoryFilter("all");
    }, [categories, categoriesLoaded, categoryFilter]);
    // 只在确有 running 任务时才每秒 tick——其余情况「运行时长」是静态值,空转的 tick 会白白
    // 重渲染整张表。
    const hasRunning = React.useMemo(() => tasks.some((t) => t.status === "running"), [tasks]);
    // tick every second so running tasks' 运行时长 counts up live.
    React.useEffect(() => {
        if (!hasRunning)
            return;
        setNowSec(Math.floor(Date.now() / 1000));
        const i = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(i);
    }, [hasRunning]);
    const deleteTask = React.useCallback(async (id: string, options: DeleteTaskOptions) => {
        try {
            const result = await api.deleteTask(id, options);
            if (result.cleanup_warning) {
                toast.warning(`${deleteSummary(result)}；部分外部数据清理未完成：${result.cleanup_warning}`);
            }
            else {
                toast.success(deleteSummary(result));
            }
            load();
        }
        catch (e) {
            toast.error("删除失败：" + (e as Error).message);
            throw e;
        }
    }, [load]);
    // controlTask 是行内暂停/继续:批量走 controlTasksBatch,单行走单任务接口,省去
    // 「先勾选再点批量」。清空 lastRef 让下一次轮询即使负载相同也照单接收,否则状态
    // 回写会被去重挡掉、按钮看起来没反应。
    const controlTask = React.useCallback(async (id: string, action: "pause" | "resume") => {
        try {
            const result = await api.controlTask(id, action);
            toast.success(action === "pause" ? `任务 #${id} 已暂停` : `任务 #${id} 已继续${result.queued ? "，已进入队列" : ""}`);
        }
        catch (e) {
            toast.error(`${action === "pause" ? "暂停" : "继续"}失败：${(e as Error).message}`);
        }
        finally {
            // 无论成败都刷新:失败多半是状态已变化,重新拉取才能让按钮回到正确形态。
            lastRef.current = "";
            load();
        }
    }, [load]);
    const renameTask = React.useCallback(async (task: Task, name: string) => {
        try {
            await api.renameTask(task.id, name);
            toast.success(`任务 #${task.id} 已重命名`);
            lastRef.current = "";
            load();
        }
        catch (error) {
            toast.error(`重命名失败：${(error as Error).message}`);
            throw error;
        }
    }, [load]);
    const toggleTaskPinned = React.useCallback(async (task: Task) => {
        const pinned = taskIsPinned(task);
        try {
            await api.pinTask(task.id, !pinned);
            toast.success(pinned ? `任务 #${task.id} 已取消置顶` : `任务 #${task.id} 已置顶`);
            lastRef.current = "";
            load();
        }
        catch (error) {
            toast.error(`${pinned ? "取消置顶" : "置顶"}失败：${(error as Error).message}`);
            throw error;
        }
    }, [load]);
    const queueTaskArchive = React.useCallback(async (task: Task) => {
        try {
            await api.archiveTask(task.id);
            toast.success(`任务 #${task.id} 已进入归档队列`);
            setActiveTab("archived");
            lastRef.current = "";
            load();
        }
        catch (error) {
            toast.error(`归档失败：${(error as Error).message}`);
            throw error;
        }
    }, [load]);
    // deleteTasks 逐个删除所选任务:后端没有批量接口,且单次删除会连带清理资产/流量/文件,
    // 串行执行以免一次性打爆后端;成功的从选中集移除,失败的保留以便重试。
    const deleteTasks = React.useCallback(async (ids: string[], options: DeleteTaskOptions, onProgress: (done: number) => void) => {
        const total: DeleteCounts = {
            assets_deleted: 0,
            assets_detached: 0,
            traffic_deleted: 0,
            files_deleted: false,
            findings_deleted: 0,
            llm_records_deleted: 0,
        };
        const deleted: string[] = [];
        const failed: {
            id: string;
            message: string;
        }[] = [];
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
                if (r.cleanup_warning)
                    warnings.push(`#${id}：${r.cleanup_warning}`);
                deleted.push(id);
            }
            catch (e) {
                failed.push({ id, message: (e as Error).message });
            }
            onProgress(deleted.length + failed.length);
        }
        if (deleted.length > 0) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const id of deleted)
                    next.delete(id);
                return next;
            });
            const details = deleteDetails(total);
            const summary = `已删除 ${deleted.length} 个任务` + (details.length > 0 ? `（${details.join("，")}）` : "");
            if (warnings.length > 0) {
                toast.warning(`${summary}；部分外部数据清理未完成：${warnings.join("；")}`);
            }
            else {
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
        load();
    }, [load]);
    const selectedTasks = React.useMemo(() => tasks.filter((task) => selectedIds.has(task.id)), [tasks, selectedIds]);
    const pausableTaskIDs = React.useMemo(() => selectedTasks.filter((task) => taskControlAction(task.status) === "pause").map((task) => task.id), [selectedTasks]);
    const resumableTaskIDs = React.useMemo(() => selectedTasks.filter((task) => taskControlAction(task.status) === "resume").map((task) => task.id), [selectedTasks]);
    const archivableTaskIDs = React.useMemo(() => selectedTasks.filter((task) => ARCHIVABLE_STATUSES.has(task.status) && !task.queued).map((task) => task.id), [selectedTasks]);
    const archiveSelectedTasks = React.useCallback(async () => {
        if (archivableTaskIDs.length === 0)
            return;
        const result = await api.archiveTasks(archivableTaskIDs);
        const succeeded = result.items.filter((item) => item.ok);
        const failed = result.items.filter((item) => !item.ok);
        if (succeeded.length > 0)
            toast.success(`已将 ${succeeded.length} 个任务加入归档队列`);
        if (failed.length > 0) {
            toast.error(`${failed.length} 个任务无法归档：${failed
                .slice(0, 3)
                .map((item) => `#${item.id}（${item.error || "状态已变化"}）`)
                .join("；")}`);
        }
        setSelectedIds(new Set());
        setActiveTab("archived");
        lastRef.current = "";
        load();
    }, [archivableTaskIDs, load]);
    const controlSelectedTasks = React.useCallback(async (action: "pause" | "resume", ids: string[]) => {
        if (ids.length === 0 || batchControlling)
            return;
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
                toast.success(action === "pause"
                    ? `已暂停 ${succeeded.length} 个任务`
                    : `已继续 ${succeeded.length} 个任务${succeeded.some((item) => item.queued) ? "，部分任务已进入队列" : ""}`);
            }
            if (failed.length > 0) {
                const details = failed
                    .slice(0, 3)
                    .map((item) => `#${item.id}（${item.error || "状态已变化"}）`)
                    .join("；");
                toast.error(`${failed.length} 个任务操作失败：${details}${failed.length > 3 ? " 等" : ""}`);
            }
            lastRef.current = "";
            load();
        }
        catch (error) {
            toast.error(`${action === "pause" ? "批量暂停" : "批量继续"}失败：${(error as Error).message}`);
        }
        finally {
            setBatchControlling(null);
        }
    }, [batchControlling, load]);
    // 后端把整批分类写入放在一个事务里，所以失败项只可能是勾选后又被删掉的任务。
    const moveSelectedTasksCategory = React.useCallback(async (categoryID?: number) => {
        const ids = [...selectedIds];
        if (ids.length === 0 || movingCategory)
            return;
        if (ids.length > 100) {
            toast.error("一次最多修改 100 个任务的分类");
            return;
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
        }
        catch (error) {
            toast.error(`修改分类失败：${(error as Error).message}`);
        }
        finally {
            setMovingCategory(false);
        }
    }, [movingCategory, refreshCategoriesAndTasks, selectedIds]);
    return (<Tabs selectedKey={activeTab} className="gap-4" onSelectionChange={(key: any) => setActiveTab(String(key))}>
      <Tabs.ListContainer>
        <Tabs.List className="mx-4 lg:mx-6">
          <Tabs.Tab id="current">
            当前任务
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="archived">
            已归档
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="current">
        <Card>
          <Card.Content className="flex flex-col gap-4 px-0 pt-6">
            <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
              <div className="relative w-full sm:max-w-xs">
                <SearchIcon className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"/>
                <SearchField value={query} className="pl-8" onChange={(nextValue: any) => setQuery(nextValue)} aria-label={"搜索描述 / 目标 / ID"}>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={"搜索描述 / 目标 / ID"}/>
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                {query && (<Button type="button" onClick={() => setQuery("")} aria-label="清除搜索" className="text-muted hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2" variant="ghost" size="sm">
                    <XIcon className="size-4"/>
                  </Button>)}
              </div>
              <Select selectedKey={statusFilter} aria-label="选择选项" onSelectionChange={(key: any) => {
            if (key !== null)
                ((v: any) => setStatusFilter(v as TaskStatus | "all"))(String(key));
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
                      {STATUS_OPTIONS.map((s) => (<ListBox.Item key={s.value} id={s.value}>
                          {s.label}
                        </ListBox.Item>))}
                    </>
                  </ListBox>
                </Select.Popover>
              </Select>
              <Select selectedKey={categoryFilter} aria-label="选择选项" onSelectionChange={(key: any) => {
            if (key !== null)
                setCategoryFilter(String(key));
        }}>
                <Select.Trigger className="w-40">
                  <Select.Value />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <>
                      <ListBox.Item id="all" textValue="全部分类">
                        全部分类
                      </ListBox.Item>
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
              <span className="text-muted text-xs tabular-nums">
                {filtered.length}/{tasks.length} 条
              </span>
              {selectedIds.size > 0 && (<>
                  <span className="text-xs tabular-nums">已选 {selectedIds.size} 个</span>
                  <Button size="sm" onPress={() => setSelectedIds(new Set())} variant={"ghost"}>
                    取消选择
                  </Button>
                  {pausableTaskIDs.length > 0 && (<Button size="sm" isDisabled={batchControlling !== null} onPress={() => void controlSelectedTasks("pause", pausableTaskIDs)} variant={"outline"}>
                      {batchControlling === "pause" ? (<Spinner data-icon="inline-start"/>) : (<PauseIcon data-icon="inline-start"/>)}
                      暂停 {pausableTaskIDs.length}
                    </Button>)}
                  {resumableTaskIDs.length > 0 && (<Button size="sm" isDisabled={batchControlling !== null} onPress={() => void controlSelectedTasks("resume", resumableTaskIDs)} variant={"outline"}>
                      {batchControlling === "resume" ? (<Spinner data-icon="inline-start"/>) : (<PlayIcon data-icon="inline-start"/>)}
                      继续 {resumableTaskIDs.length}
                    </Button>)}
                  {archivableTaskIDs.length > 0 && (<ArchiveConfirmDialog count={archivableTaskIDs.length} onConfirm={archiveSelectedTasks} trigger={<Button size="sm" variant={"outline"}>
                          <ArchiveIcon data-icon="inline-start"/>
                          归档 {archivableTaskIDs.length}
                        </Button>}/>)}
                  <MoveTasksCategoryDialog categories={categories} count={selectedIds.size} moving={movingCategory} onMove={moveSelectedTasksCategory}/>
                  <BulkDeleteTasksDialog ids={[...selectedIds]} onDelete={deleteTasks}/>
                </>)}
              <Disclosure className="rounded-lg border px-3 py-1.5">
                <Disclosure.Heading>
                  <Disclosure.Trigger className="cursor-pointer text-sm font-medium">更多管理</Disclosure.Trigger>
                </Disclosure.Heading>
                <Disclosure.Content>
                  <Disclosure.Body>
                    <div className="flex flex-wrap gap-2 pt-3">
                      <ConcurrencySettingsDialog />
                      <CategoryManagementSheet categories={categories} tasks={tasks} onChanged={refreshCategoriesAndTasks} onTaskMoved={applyTaskCategoryMove}/>
                    </div>
                  </Disclosure.Body>
                </Disclosure.Content>
              </Disclosure>
              <CreateTaskSheet categories={categories} onCreated={refreshCategoriesAndTasks} onCategoriesChanged={refreshCategoriesAndTasks}/>
            </div>

            {tasks.length === 0 ? (<div className="text-muted mx-4 flex items-center justify-center rounded-lg border border-dashed py-20 text-sm lg:mx-6">
                暂无任务，点击右上角「新建任务」开始。
              </div>) : filtered.length === 0 ? (<div className="text-muted mx-4 flex items-center justify-center rounded-lg border border-dashed py-20 text-sm lg:mx-6">
                没有匹配的任务。
              </div>) : (<Table>
                <Table.ScrollContainer>
                  <Table.Content className="**:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4" aria-label="任务列表" sortDescriptor={{ column: sortField, direction: sortDirection === "asc" ? "ascending" : "descending" }} onSortChange={(descriptor: any) => sortTasksBy(descriptor.column as TaskSortField)} selectionMode="multiple" selectedKeys={selectedIds} onSelectionChange={(keys: any) => setSelectedIds(new Set(keys === "all" ? paginated.map((task) => task.id) : Array.from(keys).map(String)))}>
                    <Table.Header className="[&_tr]:border-t">
                      <Table.Column className="w-10" id="column-33570" isRowHeader>
                        <Checkbox slot={null} onChange={(checked: any) => toggleSelectedPage(checked === true)} aria-label="选择本页全部任务" isSelected={headerChecked === true} isIndeterminate={headerChecked === "indeterminate"}>
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </Table.Column>
                      <SortableTaskHead field="id" label="ID" activeField={sortField} direction={sortDirection} className="font-mono" onSort={sortTasksBy}/>
                      <Table.Column id="column-34203" isRowHeader>
                        名称
                      </Table.Column>
                      <Table.Column id="column-34249" isRowHeader>
                        描述
                      </Table.Column>
                      <Table.Column id="column-34295" isRowHeader>
                        目标
                      </Table.Column>
                      <SortableTaskHead field="status" label="状态" activeField={sortField} direction={sortDirection} onSort={sortTasksBy}/>
                      <Table.Column className="text-center" id="column-34609" isRowHeader>
                        目标进度
                      </Table.Column>
                      <Table.Column className="text-center" id="column-34681" isRowHeader>
                        运行中 Worker
                      </Table.Column>
                      <SortableTaskHead field="created" label="创建时间" activeField={sortField} direction={sortDirection} align="right" onSort={sortTasksBy}/>
                      <SortableTaskHead field="duration" label="运行时长" activeField={sortField} direction={sortDirection} align="right" onSort={sortTasksBy}/>
                      <Table.Column className="text-right" id="column-35374" isRowHeader>
                        Token
                      </Table.Column>
                      <Table.Column className="md:sticky right-0 z-10 bg-surface text-right md:shadow-[-1px_0_0_0_var(--border)]" id="column-35446" isRowHeader>
                        操作
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {paginated.map((task) => (<TaskRow key={task.id} task={task} 
            // running 任务才吃 nowSec;其余行传 0 —— props 不变,memo 就能拦下每秒 tick
            // 带来的整表重渲染,只让在跑的那几行走时长。
            nowSec={task.status === "running" ? nowSec : 0} onDelete={deleteTask} onControl={controlTask} onRename={renameTask} onTogglePinned={toggleTaskPinned} onArchive={queueTaskArchive} selected={selectedIds.has(task.id)} onSelectedChange={toggleSelected}/>))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>)}
            <TablePagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
        }}/>
          </Card.Content>
        </Card>
      </Tabs.Panel>
      <Tabs.Panel id="archived">
        <TaskArchivesPanel onChanged={load}/>
      </Tabs.Panel>
    </Tabs>);
}
