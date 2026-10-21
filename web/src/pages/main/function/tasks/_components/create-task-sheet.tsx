"use client";

import * as React from "react";

import { ChevronRightIcon, Loader2Icon, PaperclipIcon, PlusIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { TaskTemplateControls } from "@/components/task-template-controls";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { LLMProfile, TaskCategory } from "@/lib/types";

import { appendUploads } from "../task-format";

// CategoryPicker 是新建任务里的单选分类选择器：可搜索已有分类；输入库里没有的名称后
// 回车（或点下拉里的「创建」）即时新建分类并选中，选中项以可移除的 tag 展示。分类是
// 全局资源，这里即时创建与「分类管理」里手动新建等价。只允许一个分类。
function CategoryPicker({
  categories,
  value,
  onValueChange,
  onCategoryCreated,
  portalContainer,
}: {
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
    for (const category of categories) byID.set(category.id, category);
    for (const category of localExtra) if (!byID.has(category.id)) byID.set(category.id, category);
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
    if (!trimmed || creating) return;
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
    } catch (e) {
      toast.error(`创建分类失败：${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Combobox
      items={categoryIDs}
      itemToStringValue={(id: any) => byID.get(id)?.name ?? id}
      multiple
      value={selectedIDs}
      onValueChange={(next: string[]) => {
        // 单选：取最新选中的一个；移除 chip（清空）则回到未分类。
        const last = next[next.length - 1];
        onValueChange(last ? Number(last) : undefined);
        setInputValue("");
      }}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
    >
      <ComboboxChips>
        <ComboboxValue>
          {selectedIDs.map((id: any) => (
            <ComboboxChip key={id}>{byID.get(id)?.name ?? "未知分类"}</ComboboxChip>
          ))}
        </ComboboxValue>
        <ComboboxChipsInput
          id="task-category"
          placeholder={selectedIDs.length ? "" : "搜索分类，或输入新名称后回车创建"}
          onKeyDown={(e: any) => {
            // 完全无匹配时回车 = 创建；有匹配项时保留 base-ui 的「回车选中高亮项」。
            if (e.key === "Enter" && matchCount === 0 && trimmed) {
              e.preventDefault();
              void createAndSelect();
            }
          }}
        />
      </ComboboxChips>
      <ComboboxContent portalContainer={portalContainer}>
        <ComboboxList>
          {(id: string) => (
            <ComboboxItem key={id} value={id}>
              {byID.get(id)?.name ?? id}
            </ComboboxItem>
          )}
        </ComboboxList>
        {matchCount === 0 &&
          (trimmed ? (
            <button
              type="button"
              disabled={creating}
              onClick={() => void createAndSelect()}
              className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {creating ? <Spinner className="size-4" /> : <PlusIcon className="size-4" />}
              创建分类「{trimmed}」
            </button>
          ) : (
            <div className="px-2 py-2 text-sm text-muted-foreground">输入名称以搜索或创建分类</div>
          ))}
      </ComboboxContent>
    </Combobox>
  );
}

export function CreateTaskSheet({
  categories,
  onCreated,
  onCategoriesChanged,
}: {
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
    if (!files || files.length === 0) return;
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
    } catch (e) {
      toast.error("上传失败：" + (e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-picking the same file
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
    } catch (e) {
      toast.error("创建失败：" + (e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <PlusIcon /> 新建任务
        </Button>
      </SheetTrigger>
      {/* 45vw 宽的右侧抽屉:整屏高度可滚动,长表单不再受弹窗高度限制。窄屏退化为全宽。
            内容为 flex 列:头/脚固定,中间字段区 flex-1 独立滚动。 */}
      <SheetContent
        ref={sheetContentRef}
        side="right"
        className="w-full! max-w-none! gap-0 p-0 sm:w-[45vw]! sm:max-w-[45vw]!"
      >
        <SheetHeader className="border-b p-6">
          <SheetTitle>新建任务</SheetTitle>
          <SheetDescription>填写测试对象与目标，高级参数可按需展开。</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-5">
            <TaskTemplateControls
              description={description}
              goal={goal}
              selectedTemplateID={selectedTemplateID}
              onSelectedTemplateIDChange={setSelectedTemplateID}
              onApply={(template) => {
                setDescription(template.description);
                setGoal(template.goal);
                setUploadCount(0);
              }}
              portalContainer={sheetContentRef}
            />
            <div className="grid gap-2">
              <Label htmlFor="name">名称（可选）</Label>
              <Input
                id="name"
                placeholder="例如：官网安全测试"
                value={name}
                onChange={(e: any) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                className="min-h-32"
                placeholder="测试对象与背景，例如：测试 example.com 这个站点"
                value={description}
                onChange={(e: any) => setDescription(e.target.value)}
              />
              {/* 上传文件(可多选):暂存到 drafts/,把绝对路径追加进上方描述,worker 据此 Read/Bash 打开。 */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e: any) => void pickFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2Icon className="animate-spin" /> : <PaperclipIcon />}
                  上传文件
                </Button>
                <span className="text-muted-foreground text-xs">
                  {uploadCount > 0
                    ? `已上传 ${uploadCount} 个文件，绝对路径已追加到描述末尾（可编辑）`
                    : "可多选；上传后把文件的绝对路径追加到描述，供 worker 用 Read/Bash 打开"}
                </span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="goal">目标</Label>
              <Textarea
                id="goal"
                className="min-h-32"
                placeholder="例如：检查 SQL 注入和 XSS，验证发现并生成报告"
                value={goal}
                onChange={(e: any) => setGoal(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-model">AI 配置</Label>
              <Select value={llmProfileID} onValueChange={setLLMProfileID}>
                <SelectTrigger id="task-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">使用默认配置</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={String(profile.id)}>
                      {profile.name} · {profile.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 分类与超时按需展开，调度参数沿用原默认值。 */}
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center gap-2 border-t pt-4 text-sm font-medium">
                <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-90" />
                高级设置
                <span className="text-muted-foreground ml-auto text-xs font-normal">任务分类 · 超时</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-5 pt-5">
                <Field>
                  <FieldLabel htmlFor="task-category">任务分类</FieldLabel>
                  <CategoryPicker
                    categories={categories}
                    value={categoryID}
                    onValueChange={setCategoryID}
                    onCategoryCreated={onCategoriesChanged}
                    portalContainer={sheetContentRef}
                  />
                  <FieldDescription>可选，单个分类；用于任务列表筛选和归档，不影响 Agent 执行。</FieldDescription>
                </Field>
                <div className="grid gap-2">
                  <Label htmlFor="timeout-min">任务超时（分钟，可选）</Label>
                  <Input
                    id="timeout-min"
                    type="number"
                    min={0}
                    className="w-40"
                    placeholder="留空 = 不限时"
                    value={timeoutMin}
                    onChange={(e: any) => setTimeoutMin(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    到点后触发优雅收尾（各 agent 写回 + planner 终局判定），任务进入 timeout 终态。
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t p-4">
          <SheetClose asChild>
            <Button variant="outline">取消</Button>
          </SheetClose>
          <Button onClick={createTask} disabled={creating || uploading}>
            {creating && <Spinner data-icon="inline-start" />}
            {creating ? "创建中" : "创建"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
