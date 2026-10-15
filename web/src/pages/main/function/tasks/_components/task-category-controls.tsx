import * as React from "react";
import { Link } from "react-router";
import { DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, } from "@dnd-kit/core";
import { AlertDialog, Button, ComboBox, Description, Disclosure, Drawer, Input, Label, ListBox, NumberField, ScrollShadow, Select, Spinner, Surface, TextArea, TextField, } from "@/components/mui-compat";
import { ChevronRightIcon, GripVerticalIcon, Loader2Icon, PaperclipIcon, PlusIcon, SaveIcon, TagsIcon, Trash2Icon, } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { TaskTemplateControls } from "@/components/task-template-controls";
import { api } from "@/lib/api";
import type { LLMProfile, Task, TaskCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { appendUploads } from "./task-shared";
export function CategoryPicker({ categories, value, onValueChange, onCategoryCreated, portalContainer, }: {
    categories: TaskCategory[];
    value?: number;
    onValueChange: (categoryID?: number) => void;
    onCategoryCreated: () => void;
    portalContainer?: React.RefObject<HTMLElement | null>;
}) {
    const [inputValue, setInputValue] = React.useState("");
    const [creating, setCreating] = React.useState(false);
    // 新建的分类要等父层重新拉取才回流到 categories，先本地留一份，避免选中的 chip 和
    // 下拉在这段窗口里显示成「未知分类」。
    const [localExtra, setLocalExtra] = React.useState<TaskCategory[]>([]);
    const allCategories = React.useMemo(() => {
        const byID = new Map<number, TaskCategory>();
        for (const category of categories)
            byID.set(category.id, category);
        for (const category of localExtra)
            if (!byID.has(category.id))
                byID.set(category.id, category);
        return [...byID.values()];
    }, [categories, localExtra]);
    const byID = React.useMemo(() => new Map(allCategories.map((c) => [String(c.id), c])), [allCategories]);
    const categoryIDs = React.useMemo(() => allCategories.map((c) => String(c.id)), [allCategories]);
    const selectedIDs = value != null ? [String(value)] : [];
    const trimmed = inputValue.trim();
    const lower = trimmed.toLowerCase();
    // 与 base-ui 默认子串过滤保持一致，用来判断「有没有相关分类」。
    const matchCount = trimmed
        ? allCategories.filter((c) => c.name.toLowerCase().includes(lower)).length
        : allCategories.length;
    const createAndSelect = async () => {
        if (!trimmed || creating)
            return;
        // 精确同名已存在则直接选中，不重复创建。
        const existing = allCategories.find((c) => c.name.toLowerCase() === lower);
        if (existing) {
            onValueChange(existing.id);
            setInputValue("");
            return;
        }
        setCreating(true);
        try {
            const created = await api.createTaskCategory(trimmed);
            setLocalExtra((prev) => [...prev, created]);
            onValueChange(created.id);
            setInputValue("");
            onCategoryCreated();
            toast.success(`已创建分类「${created.name}」`);
        }
        catch (e) {
            toast.error(`创建分类失败：${(e as Error).message}`);
        }
        finally {
            setCreating(false);
        }
    };
    return (<ComboBox selectionMode="single" aria-label="任务分类" selectedKey={value == null ? null : String(value)} inputValue={inputValue} onInputChange={setInputValue} onSelectionChange={(key: any) => {
            onValueChange(key == null ? undefined : Number(key));
            setInputValue("");
        }} allowsCustomValue>
      <ComboBox.InputGroup>
        <Input id="task-category" placeholder={selectedIDs.length ? byID.get(selectedIDs[0])?.name : "搜索分类，或输入新名称后回车创建"} onKeyDown={(event: any) => {
            if (event.key === "Enter" && matchCount === 0 && trimmed) {
                event.preventDefault();
                void createAndSelect();
            }
        }}/>
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox items={allCategories} renderEmptyState={() => <span className="p-3 text-muted text-sm">没有匹配的分类</span>}>
          {(category: any) => (<ListBox.Item id={String(category.id)} textValue={category.name}>
              {category.name}
            </ListBox.Item>)}
        </ListBox>
        {matchCount === 0 && trimmed && (<Button variant="ghost" className="w-full" isDisabled={creating} onPress={() => void createAndSelect()}>
            {creating ? <Spinner size="sm"/> : <PlusIcon className="size-4"/>}创建分类「{trimmed}」
          </Button>)}
      </ComboBox.Popover>
      {value != null && (<Button variant="ghost" size="sm" onPress={() => onValueChange(undefined)}>
          清除分类
        </Button>)}
    </ComboBox>);
}
export type CategoryManagementView = number | "uncategorized" | "new";
export function CategoryDropTarget({ value, name, count, selected, disabled, onSelect, }: {
    value: string;
    name: string;
    count: number;
    selected: boolean;
    disabled: boolean;
    onSelect: () => void;
}) {
    const { isOver, setNodeRef } = useDroppable({ id: `category:${value}`, disabled });
    return (<Button ref={setNodeRef} type="button" className={cn("min-w-0 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors", selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50", isOver && "border-accent bg-accent/10 text-foreground")} onClick={onSelect} variant="ghost" size="sm">
      <span className="block truncate font-medium text-sm">{name}</span>
      <span className="block truncate text-muted text-xs">{isOver ? "松开以移动" : `${count} 个任务`}</span>
    </Button>);
}
export function DraggableCategoryTask({ task, disabled, moving }: {
    task: Task;
    disabled: boolean;
    moving: boolean;
}) {
    const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
        id: `task:${task.id}`,
        disabled,
    });
    return (<Surface ref={setNodeRef} className={`flex items-center gap-3 border border-border rounded-lg p-3 ${cn(isDragging && "opacity-40")}`}>
      <div className="group-has-data-[slot=item-description]/item:self-center group-has-data-[slot=item-description]/item:translate-y-0">
        {moving ? (<Spinner />) : (<Button type="button" className="touch-none cursor-grab active:cursor-grabbing" isDisabled={disabled} {...listeners} {...attributes} aria-label={`拖动任务 #${task.id}`} size="sm" isIconOnly variant={"ghost"}>
            <GripVerticalIcon />
          </Button>)}
      </div>
      <div className={`min-w-0 flex-1 ${"min-w-0"}`}>
        <div className="w-full min-w-0">
          <Link to={`/function/tasks/detail?id=${encodeURIComponent(task.id)}`} className="truncate hover:underline">
            {task.name?.trim() || task.description || `任务 #${task.id}`}
          </Link>
        </div>
        <Description className="line-clamp-1">
          #{task.id} · {task.description}
        </Description>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge domain="task" value={task.status}/>
      </div>
    </Surface>);
}
export function CategoryTaskDragPreview({ task }: {
    task: Task;
}) {
    return (<Surface className={`flex items-center gap-3 border border-border rounded-lg p-3 ${"w-80 bg-background shadow-lg"}`}>
      <div className="group-has-data-[slot=item-description]/item:self-center group-has-data-[slot=item-description]/item:translate-y-0">
        <GripVerticalIcon className="size-4 text-muted"/>
      </div>
      <div className={`min-w-0 flex-1 ${"min-w-0"}`}>
        <div className="w-full min-w-0 truncate">{task.name?.trim() || task.description || `任务 #${task.id}`}</div>
        <Description className="line-clamp-1">#{task.id}</Description>
      </div>
    </Surface>);
}
export function CategoryManagementSheet({ categories, tasks, onChanged, onTaskMoved, }: {
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
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
    React.useEffect(() => {
        if (open && !wasOpen.current) {
            const first = categories[0];
            if (first) {
                setSelectedView(first.id);
                setDraftName(first.name);
            }
            else if (tasks.some((task) => task.category_id == null)) {
                setSelectedView("uncategorized");
                setDraftName("");
            }
            else {
                setSelectedView("new");
                setDraftName("");
            }
        }
        wasOpen.current = open;
    }, [categories, open, tasks]);
    const selectedCategory = React.useMemo(() => typeof selectedView === "number" ? (categories.find((category: any) => category.id === selectedView) ?? null) : null, [categories, selectedView]);
    const uncategorizedCount = React.useMemo(() => tasks.filter((task) => task.category_id == null).length, [tasks]);
    const visibleTasks = React.useMemo(() => {
        if (selectedView === "uncategorized")
            return tasks.filter((task) => task.category_id == null);
        if (typeof selectedView === "number")
            return tasks.filter((task) => task.category_id === selectedView);
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
        if (!name || saving || selectedView === "uncategorized")
            return;
        setSaving(true);
        try {
            if (selectedView === "new") {
                const created = await api.createTaskCategory(name);
                setSelectedView(created.id);
                setDraftName(created.name);
                toast.success("分类已创建");
            }
            else {
                const updated = await api.renameTaskCategory(selectedView, name);
                setDraftName(updated.name);
                toast.success("分类已更新");
            }
            onChanged();
        }
        catch (error) {
            toast.error(`${selectedView === "new" ? "创建" : "更新"}分类失败：${(error as Error).message}`);
        }
        finally {
            setSaving(false);
        }
    }
    async function deleteCategory() {
        if (!selectedCategory || deleting)
            return;
        const deletedID = selectedCategory.id;
        setDeleting(true);
        try {
            await api.deleteTaskCategory(deletedID);
            const next = categories.find((category: any) => category.id !== deletedID);
            if (next)
                selectCategory(next);
            else
                selectUncategorized();
            toast.success("分类已删除，关联任务已移入未分类");
            setDeleteOpen(false);
            onChanged();
        }
        catch (error) {
            toast.error(`删除分类失败：${(error as Error).message}`);
        }
        finally {
            setDeleting(false);
        }
    }
    async function moveTask(task: Task, destination: string) {
        if (movingTaskID)
            return;
        const category = destination === "uncategorized" ? null : (categories.find((item) => item.id === Number(destination)) ?? null);
        if (destination !== "uncategorized" && !category) {
            toast.error("目标分类不存在，请刷新后重试");
            return;
        }
        if (task.category_id === category?.id || (task.category_id == null && category == null))
            return;
        setMovingTaskID(task.id);
        try {
            await api.updateTaskCategory(task.id, category?.id);
            onTaskMoved(task.id, category);
            toast.success(`任务 #${task.id} 已移至「${category?.name ?? "未分类"}」`);
        }
        catch (error) {
            toast.error(`移动任务失败：${(error as Error).message}`);
        }
        finally {
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
        if (!taskID || !event.over)
            return;
        const destination = String(event.over.id);
        if (!destination.startsWith("category:"))
            return;
        const task = tasks.find((item) => item.id === taskID);
        if (!task)
            return;
        void moveTask(task, destination.slice("category:".length));
    }
    const saveLabel = saving ? "保存中" : selectedView === "new" ? "创建分类" : "保存修改";
    return (<>
      <Drawer isOpen={open} onOpenChange={setOpen}>
        
          <Button size="sm" variant={"outline"}>
            <TagsIcon data-icon="inline-start"/>
            分类管理
          </Button>
        
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog className="grid h-full w-full! max-w-none! grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-[48rem]! sm:max-w-[48rem]!">
              <Drawer.CloseTrigger aria-label="关闭"/>
              <Drawer.Header className="border-b px-6 py-5">
                <Drawer.Heading>任务分类管理</Drawer.Heading>
                <Description>分类用于任务筛选与归档；修改不会影响任务执行，删除后任务会移入未分类。</Description>
              </Drawer.Header>
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragCancel={() => setActiveTaskID(null)} onDragEnd={handleDragEnd}>
                <ScrollShadow className="grid min-h-0 overflow-y-auto lg:grid-cols-[15rem_minmax(0,1fr)] lg:overflow-hidden" data-scrollbar="thin" data-slot="scroll-shadow">
                  <div className="flex min-h-0 flex-col border-b p-3 lg:border-r lg:border-b-0">
                    <Button type="button" className="w-full" onPress={startNew} variant={"outline"}>
                      <PlusIcon data-icon="inline-start"/>
                      新建分类
                    </Button>
                    <ScrollShadow className="mt-2 max-h-44 lg:max-h-none lg:flex-1" data-slot="scroll-shadow" data-scrollbar="thin">
                      <div className="flex flex-col gap-1 pr-2">
                        <CategoryDropTarget value="uncategorized" name="未分类" count={uncategorizedCount} selected={selectedView === "uncategorized"} disabled={movingTaskID != null} onSelect={selectUncategorized}/>
                        {categories.map((category: any) => (<CategoryDropTarget key={category.id} value={String(category.id)} name={category.name} count={category.task_count} selected={selectedView === category.id} disabled={movingTaskID != null} onSelect={() => selectCategory(category)}/>))}
                      </div>
                    </ScrollShadow>
                  </div>
                  <ScrollShadow className="min-h-0" data-slot="scroll-shadow" data-scrollbar="thin">
                    <div className={`flex flex-col gap-4 ${"p-6"}`}>
                      {selectedView !== "uncategorized" && (<div className="flex flex-col gap-1.5">
                          <Label htmlFor="task-category-name">分类名称</Label>
                          <TextField className="contents" aria-label={"例如：外网评估"}>
                            <Input id="task-category-name" value={draftName} onChange={(event: any) => setDraftName(event.target.value)} placeholder="例如：外网评估" maxLength={80} onKeyDown={(event: any) => {
                if (event.key === "Enter")
                    void saveCategory();
            }}/>
                          </TextField>
                          <Description>
                            {selectedCategory
                ? `当前有 ${selectedCategory.task_count} 个任务使用该分类。重命名后会同步更新任务列表。`
                : "创建后可在新建任务和任务列表筛选中使用。"}
                          </Description>
                        </div>)}
                      {selectedView !== "new" && (<div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-end justify-between gap-2">
                            <div className="flex min-w-0 flex-col gap-1">
                              <Label>{selectedCategory ? "分类任务" : "未分类任务"}</Label>
                              <Description>
                                {selectedCategory
                ? `该分类包含 ${visibleTasks.length} 个任务。`
                : `当前有 ${visibleTasks.length} 个任务尚未分类。`}
                              </Description>
                            </div>
                          </div>
                          {visibleTasks.length === 0 ? (<Surface className={`flex flex-col items-center justify-center p-8 text-center ${"min-h-36 border"}`}>
                              <div className="flex flex-col items-center gap-2">
                                <h3 className="font-medium">
                                  {selectedCategory ? "该分类暂无任务" : "暂无未分类任务"}
                                </h3>
                                <p className="text-sm text-muted">此处将在任务归入后显示内容。</p>
                              </div>
                            </Surface>) : (<div className={`flex flex-col gap-2 ${"gap-2"}`}>
                              {visibleTasks.map((task) => (<DraggableCategoryTask key={task.id} task={task} moving={movingTaskID === task.id} disabled={movingTaskID != null}/>))}
                            </div>)}
                        </div>)}
                    </div>
                  </ScrollShadow>
                </ScrollShadow>
                <DragOverlay>{activeTask ? <CategoryTaskDragPreview task={activeTask}/> : null}</DragOverlay>
              </DndContext>
              <Drawer.Footer className="border-t px-6 py-4 sm:flex-row sm:items-center">
                {selectedCategory && (<Button type="button" className="sm:mr-auto" isDisabled={saving || deleting} onPress={() => setDeleteOpen(true)} variant={"danger"}>
                    <Trash2Icon data-icon="inline-start"/>
                    删除分类
                  </Button>)}
                <Button type="button" onPress={() => setOpen(false)} variant={"outline"}>
                  关闭
                </Button>
                {selectedView !== "uncategorized" && (<Button type="button" isDisabled={!draftName.trim() || saving || deleting} onPress={() => void saveCategory()}>
                    {saving ? <Spinner data-icon="inline-start"/> : <SaveIcon data-icon="inline-start"/>}
                    {saveLabel}
                  </Button>)}
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      
        <AlertDialog.Backdrop isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>删除分类「{selectedCategory?.name || "未命名分类"}」？</AlertDialog.Heading>
                <AlertDialog.Body>
                  分类删除后，其中 {selectedCategory?.task_count ?? 0} 个任务会自动移入“未分类”，任务数据不会被删除。
                </AlertDialog.Body>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <Button isDisabled={deleting} slot="close" variant={"outline"}>
                  取消
                </Button>
                <Button isDisabled={deleting} variant={"danger"} onClick={(event: any) => {
            event.preventDefault();
            void deleteCategory();
        }}>
                  {deleting && <Spinner data-icon="inline-start"/>}
                  {deleting ? "删除中" : "删除"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      
    </>);
}
export function CreateTaskSheet({ categories, onCreated, onCategoriesChanged, }: {
    categories: TaskCategory[];
    onCreated: () => void;
    onCategoriesChanged: () => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState("");
    const [categoryID, setCategoryID] = React.useState<number | undefined>(undefined);
    const [description, setDescription] = React.useState("");
    const [goal, setGoal] = React.useState("");
    const [selectedTemplateID, setSelectedTemplateID] = React.useState<number | null>(null);
    const [profiles, setProfiles] = React.useState<LLMProfile[]>([]);
    const [llmProfileID, setLLMProfileID] = React.useState("default");
    const [creating, setCreating] = React.useState(false);
    const [timeoutMin, setTimeoutMin] = React.useState(""); // 任务级超时(分钟);空/0 = 不限时
    // 方式1 文件上传:建任务前把文件暂存到 drafts/<draftId>/uploads/,拿回绝对路径追加进描述。
    const [uploading, setUploading] = React.useState(false);
    const [uploadCount, setUploadCount] = React.useState(0);
    const draftIdRef = React.useRef<string>("");
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const sheetContentRef = React.useRef<HTMLDivElement>(null);
    // load LLM profiles once for the create-task profile picker.
    React.useEffect(() => {
        api
            .llmProfiles()
            .then(setProfiles)
            .catch(() => setProfiles([]));
    }, []);
    // pickFiles uploads the chosen files into this draft's staging dir and appends their
    // absolute paths to the description; the task's agents open them by path via Read/Bash.
    async function pickFiles(files: FileList | null) {
        if (!files || files.length === 0)
            return;
        // crypto.randomUUID 仅在安全上下文可用(https/localhost);经 IP+http 访问时降级。
        if (!draftIdRef.current) {
            draftIdRef.current =
                globalThis.crypto?.randomUUID?.() ?? `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
        }
        setUploading(true);
        try {
            const r = await api.chatUpload("staging", draftIdRef.current, Array.from(files));
            setDescription((prev) => appendUploads(prev, r.attachments));
            setUploadCount((n) => n + r.attachments.length);
        }
        catch (e) {
            toast.error("上传失败：" + (e as Error).message);
        }
        finally {
            setUploading(false);
            if (fileInputRef.current)
                fileInputRef.current.value = ""; // allow re-picking the same file
        }
    }
    async function createTask() {
        if (!description.trim() || !goal.trim()) {
            toast.error("请填写描述与目标");
            return;
        }
        setCreating(true);
        try {
            const timeoutSec = Math.max(0, Math.floor(Number(timeoutMin) || 0)) * 60;
            await api.createTask({
                name: name.trim(),
                categoryId: categoryID,
                description: description.trim(),
                goal: goal.trim(),
                llmProfileIds: llmProfileID === "default" ? [] : [Number(llmProfileID)],
                timeoutSeconds: timeoutSec,
                seedFirstIntent: false,
                planHeartbeatSeconds: 600,
                coverageEnabled: true,
            });
            toast.success("任务已创建");
            setName("");
            setCategoryID(undefined);
            setDescription("");
            setGoal("");
            setSelectedTemplateID(null);
            setLLMProfileID("default");
            setTimeoutMin("");
            setUploadCount(0);
            draftIdRef.current = "";
            setOpen(false);
            onCreated();
        }
        catch (e) {
            toast.error("创建失败：" + (e as Error).message);
        }
        finally {
            setCreating(false);
        }
    }
    return (<Drawer isOpen={open} onOpenChange={setOpen}>
      
        <Button size="sm">
          <PlusIcon /> 新建任务
        </Button>
      
      {/* 45vw 宽的右侧抽屉:整屏高度可滚动,长表单不再受弹窗高度限制。窄屏退化为全宽。
                              内容为 flex 列:头/脚固定,中间字段区 flex-1 独立滚动。 */}
      <Drawer.Backdrop>
        <Drawer.Content placement={"right"}>
          <Drawer.Dialog className="w-full! max-w-none! gap-0 p-0 sm:w-[45vw]! sm:max-w-[45vw]!">
            <div ref={sheetContentRef} className="contents">
              <Drawer.CloseTrigger aria-label="关闭"/>
              <Drawer.Header className="border-b p-6">
                <Drawer.Heading>新建任务</Drawer.Heading>
                <Description>填写测试对象与目标，高级参数可按需展开。</Description>
              </Drawer.Header>

              <ScrollShadow className="flex-1 overflow-y-auto p-6" data-scrollbar="thin" data-slot="scroll-shadow">
                <div className="grid gap-5">
                  <TaskTemplateControls description={description} goal={goal} selectedTemplateID={selectedTemplateID} onSelectedTemplateIDChange={setSelectedTemplateID} onApply={(template) => {
            setDescription(template.description);
            setGoal(template.goal);
            setUploadCount(0);
        }} portalContainer={sheetContentRef}/>
                  <div className="grid gap-2">
                    <Label htmlFor="name">名称（可选）</Label>
                    <TextField className="contents" aria-label={"例如：官网安全测试"}>
                      <Input id="name" placeholder="例如：官网安全测试" value={name} onChange={(e: any) => setName(e.target.value)}/>
                    </TextField>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">描述</Label>
                    <TextField className="contents" aria-label={"测试对象与背景，例如：测试 example.com 这个站点"}>
                      <TextArea id="description" className="min-h-32" placeholder="测试对象与背景，例如：测试 example.com 这个站点" value={description} onChange={(e: any) => setDescription(e.target.value)}/>
                    </TextField>
                    {/* 上传文件(可多选):暂存到 drafts/,把绝对路径追加进上方描述,worker 据此 Read/Bash 打开。 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e: any) => void pickFiles(e.target.files)}/>
                      <Button type="button" size="sm" onPress={() => fileInputRef.current?.click()} isDisabled={uploading} variant={"outline"}>
                        {uploading ? <Loader2Icon className="animate-spin"/> : <PaperclipIcon />}
                        上传文件
                      </Button>
                      <span className="text-muted text-xs">
                        {uploadCount > 0
            ? `已上传 ${uploadCount} 个文件，绝对路径已追加到描述末尾（可编辑）`
            : "可多选；上传后把文件的绝对路径追加到描述，供 worker 用 Read/Bash 打开"}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="goal">目标</Label>
                    <TextField className="contents" aria-label={"例如：检查 SQL 注入和 XSS，验证发现并生成报告"}>
                      <TextArea id="goal" className="min-h-32" placeholder="例如：检查 SQL 注入和 XSS，验证发现并生成报告" value={goal} onChange={(e: any) => setGoal(e.target.value)}/>
                    </TextField>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="task-model">AI 配置</Label>
                    <Select selectedKey={llmProfileID} aria-label="选择选项" onSelectionChange={(key: any) => {
            if (key !== null)
                setLLMProfileID(String(key));
        }}>
                      <Select.Trigger id="task-model">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="default" textValue="使用默认配置">
                            使用默认配置
                          </ListBox.Item>
                          {profiles.map((profile) => (<ListBox.Item key={profile.id} id={String(profile.id)} textValue={`${profile.name} · ${profile.model}`}>
                              {profile.name} · {profile.model}
                            </ListBox.Item>))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {/* 分类与超时按需展开，调度参数沿用原默认值。 */}
                  <Disclosure>
                    <Disclosure.Heading>
                      <Disclosure.Trigger className="group flex w-full items-center gap-2 border-t pt-4 text-sm font-medium">
                        <ChevronRightIcon className="text-muted size-4 transition-transform group-data-[state=open]:rotate-90"/>
                        高级设置
                        <span className="text-muted ml-auto text-xs font-normal">任务分类 · 超时</span>
                      </Disclosure.Trigger>
                    </Disclosure.Heading>
                    <Disclosure.Content className="grid gap-5 pt-5">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="task-category">任务分类</Label>
                        <CategoryPicker categories={categories} value={categoryID} onValueChange={setCategoryID} onCategoryCreated={onCategoriesChanged} portalContainer={sheetContentRef}/>
                        <Description>可选，单个分类；用于任务列表筛选和归档，不影响 Agent 执行。</Description>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="timeout-min">任务超时（分钟，可选）</Label>
                        <NumberField id="timeout-min" minValue={0} className="w-40" onChange={(nextValue: any) => setTimeoutMin(Number.isNaN(nextValue) ? "" : String(nextValue))} aria-label={"留空 = 不限时"} value={String(timeoutMin) === "" ? NaN : Number(timeoutMin)}>
                          <NumberField.Group>
                            <NumberField.DecrementButton />
                            <NumberField.Input />
                            <NumberField.IncrementButton />
                          </NumberField.Group>
                        </NumberField>
                        <p className="text-muted text-xs">
                          到点后触发优雅收尾（各 agent 写回 + planner 终局判定），任务进入 timeout 终态。
                        </p>
                      </div>
                    </Disclosure.Content>
                  </Disclosure>
                </div>
              </ScrollShadow>

              <Drawer.Footer className="flex-row justify-end gap-2 border-t p-4">
                <Button slot="close" variant={"outline"} isDisabled={creating || uploading}>取消</Button>
                <Button onPress={createTask} isDisabled={creating || uploading || !description.trim() || !goal.trim()}>
                  {creating && <Spinner data-icon="inline-start"/>}
                  {creating ? "创建中" : "创建"}
                </Button>
              </Drawer.Footer>
            </div>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>);
}
