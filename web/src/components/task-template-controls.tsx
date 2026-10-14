import * as React from "react";
import { AlertDialog, Button, ComboBox, Description, Drawer, Input, Label, ListBox, ScrollShadow, Spinner, TextArea, TextField, } from "@heroui/react";
import { PlusIcon, SaveIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TaskTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";
interface TemplateDraft {
    name: string;
    description: string;
    goal: string;
}
interface TaskTemplateManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templates: TaskTemplate[];
    seed: Pick<TemplateDraft, "description" | "goal"> | null;
    onCreated: (template: TaskTemplate) => void;
    onUpdated: (template: TaskTemplate) => void;
    onDeleted: (id: number) => void;
}
const emptyDraft = (): TemplateDraft => ({ name: "", description: "", goal: "" });
function templateDraft(template: TaskTemplate): TemplateDraft {
    return {
        name: template.name,
        description: template.description,
        goal: template.goal,
    };
}
function TaskTemplateManager({ open, onOpenChange, templates, seed, onCreated, onUpdated, onDeleted, }: TaskTemplateManagerProps) {
    const [selectedID, setSelectedID] = React.useState<number | null>(null);
    const [draft, setDraft] = React.useState<TemplateDraft>(emptyDraft);
    const [saving, setSaving] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const wasOpen = React.useRef(false);
    React.useEffect(() => {
        if (open && !wasOpen.current) {
            if (seed) {
                setSelectedID(null);
                setDraft({ name: "", description: seed.description, goal: seed.goal });
            }
            else if (templates[0]) {
                setSelectedID(templates[0].id);
                setDraft(templateDraft(templates[0]));
            }
            else {
                setSelectedID(null);
                setDraft(emptyDraft());
            }
        }
        wasOpen.current = open;
    }, [open, seed, templates]);
    const selectTemplate = (template: TaskTemplate) => {
        setSelectedID(template.id);
        setDraft(templateDraft(template));
    };
    const startNew = () => {
        setSelectedID(null);
        setDraft(emptyDraft());
    };
    const updateDraft = (field: keyof TemplateDraft, value: string) => {
        setDraft((current) => ({ ...current, [field]: value }));
    };
    async function save() {
        const input = {
            name: draft.name.trim(),
            description: draft.description.trim(),
            goal: draft.goal.trim(),
        };
        if (!input.name || !input.description || !input.goal) {
            toast.error("请填写模板名称、描述和目标");
            return;
        }
        setSaving(true);
        try {
            if (selectedID == null) {
                const created = await api.createTaskTemplate(input);
                onCreated(created);
                setSelectedID(created.id);
                setDraft(templateDraft(created));
                toast.success("模板已创建");
            }
            else {
                const updated = await api.updateTaskTemplate(selectedID, input);
                onUpdated(updated);
                setDraft(templateDraft(updated));
                toast.success("模板已更新");
            }
        }
        catch (error) {
            toast.error(`保存失败：${(error as Error).message}`);
        }
        finally {
            setSaving(false);
        }
    }
    async function remove() {
        if (selectedID == null)
            return;
        const deletedID = selectedID;
        setDeleting(true);
        try {
            await api.deleteTaskTemplate(deletedID);
            onDeleted(deletedID);
            const next = templates.find((template) => template.id !== deletedID);
            if (next) {
                setSelectedID(next.id);
                setDraft(templateDraft(next));
            }
            else {
                startNew();
            }
            setDeleteOpen(false);
            toast.success("模板已删除");
        }
        catch (error) {
            toast.error(`删除失败：${(error as Error).message}`);
        }
        finally {
            setDeleting(false);
        }
    }
    let saveLabel = saving ? "保存中" : "保存修改";
    if (!saving && selectedID == null)
        saveLabel = "创建模板";
    return (<>
      
        <Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
          <Drawer.Content placement="right">
            <Drawer.Dialog className="w-full sm:w-[48rem] max-w-[90vw] p-0 flex flex-col bg-surface border-l border-border h-full shadow-2xl">
              <Drawer.Header className="border-b border-border px-6 py-4">
                <Drawer.Heading className="text-lg font-semibold text-foreground">任务模板管理</Drawer.Heading>
                <p className="text-xs text-muted mt-1">模板只保存描述与目标；修改不会影响已经创建的任务。</p>
              </Drawer.Header>

              <Drawer.Body className="p-0 flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-border p-3 w-full lg:w-60 shrink-0">
                  <Button type="button" size="sm" className="w-full mb-2" onPress={startNew} variant={"outline"}>
                    <PlusIcon className="size-4 mr-1.5"/>
                    新建模板
                  </Button>
                  <ScrollShadow className="flex-1 max-h-44 lg:max-h-none overflow-y-auto" data-scrollbar="thin" data-slot="scroll-shadow">
                    <ListBox aria-label="任务模板" selectionMode="single" selectedKeys={selectedID == null ? [] : [String(selectedID)]} onAction={(key) => { const template = templates.find((item) => String(item.id) === key); if (template) selectTemplate(template); }} renderEmptyState={() => <p className="p-6 text-center text-muted text-sm">暂无模板</p>}>
                      {templates.map((template) => (<ListBox.Item key={template.id} id={String(template.id)} textValue={template.name} className="flex-col items-start">
                          <span className="block truncate text-sm font-medium text-foreground">{template.name}</span>
                          <span className="block truncate text-xs text-muted">{template.description}</span>
                        </ListBox.Item>))}
                    </ListBox>
                  </ScrollShadow>
                </div>

                <ScrollShadow className="flex-1 p-6 overflow-y-auto space-y-4" data-scrollbar="thin" data-slot="scroll-shadow">
                  <TextField value={draft.name} onChange={(v) => updateDraft("name", v)} className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">模板名称</Label>
                    <Input maxLength={120} placeholder="例如：外部 Web 渗透" className="bg-surface-secondary border-border"/>
                  </TextField>

                  <TextField value={draft.description} onChange={(v) => updateDraft("description", v)} className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">描述</Label>
                    <TextArea className="min-h-28 bg-surface-secondary border-border" placeholder="测试对象与背景"/>
                  </TextField>

                  <TextField value={draft.goal} onChange={(v) => updateDraft("goal", v)} className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">目标</Label>
                    <TextArea className="min-h-28 bg-surface-secondary border-border" placeholder="任务需要达成的目标"/>
                  </TextField>
                </ScrollShadow>
              </Drawer.Body>

              <Drawer.Footer className="border-t border-border px-6 py-3 flex items-center justify-between">
                {selectedID != null ? (<Button type="button" size="sm" onPress={() => setDeleteOpen(true)} variant={"danger"}>
                    <Trash2Icon className="size-4 mr-1.5"/>
                    删除模板
                  </Button>) : (<div />)}
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" onPress={() => onOpenChange(false)} variant={"outline"}>
                    关闭
                  </Button>
                  <Button type="button" size="sm" isDisabled={saving} onPress={() => void save()} variant={"primary"}>
                    {saving ? <Spinner size="sm" className="mr-1.5"/> : <SaveIcon className="size-4 mr-1.5"/>}
                    {saveLabel}
                  </Button>
                </div>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      

      
        <AlertDialog.Backdrop isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="w-full max-w-md p-6 bg-surface border border-border rounded-xl shadow-xl outline-none">
              <AlertDialog.Header className="pb-2">
                <AlertDialog.Heading className="text-base font-semibold text-foreground">
                  删除模板「{draft.name || "未命名模板"}」？
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="py-2 text-xs text-muted">
                已由该模板创建的任务不会受到影响。
              </AlertDialog.Body>
              <AlertDialog.Footer className="pt-3 flex justify-end gap-2 border-t border-border">
                <Button size="sm" isDisabled={deleting} onPress={() => setDeleteOpen(false)} variant={"outline"}>
                  取消
                </Button>
                <Button size="sm" isDisabled={deleting} onPress={() => void remove()} variant={"danger"}>
                  {deleting && <Spinner size="sm" className="mr-1.5"/>}
                  {deleting ? "删除中" : "确认删除"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      
    </>);
}
interface TaskTemplateControlsProps {
    description: string;
    goal: string;
    selectedTemplateID: number | null;
    onSelectedTemplateIDChange: (id: number | null) => void;
    onApply: (template: TaskTemplate) => void;
    portalContainer?: React.RefObject<HTMLElement | null>;
}
export function TaskTemplateControls({ description, goal, selectedTemplateID, onSelectedTemplateIDChange, onApply, }: TaskTemplateControlsProps) {
    const [templates, setTemplates] = React.useState<TaskTemplate[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [pendingTemplate, setPendingTemplate] = React.useState<TaskTemplate | null>(null);
    const [managerOpen, setManagerOpen] = React.useState(false);
    const [managerSeed, setManagerSeed] = React.useState<Pick<TemplateDraft, "description" | "goal"> | null>(null);
    const loadTemplates = React.useCallback(async () => {
        setLoading(true);
        try {
            setTemplates(await api.taskTemplates());
        }
        catch (error) {
            setTemplates([]);
            toast.error(`加载模板失败：${(error as Error).message}`);
        }
        finally {
            setLoading(false);
        }
    }, []);
    React.useEffect(() => {
        void loadTemplates();
    }, [loadTemplates]);
    const applyTemplate = (template: TaskTemplate) => {
        onApply(template);
        onSelectedTemplateIDChange(template.id);
        setPendingTemplate(null);
    };
    const chooseTemplate = (templateID: number | null) => {
        if (!templateID) {
            onSelectedTemplateIDChange(null);
            return;
        }
        const template = templates.find((t) => t.id === templateID);
        if (!template)
            return;
        const hasContent = description.trim() !== "" || goal.trim() !== "";
        const changesContent = description !== template.description || goal !== template.goal;
        if (hasContent && changesContent) {
            setPendingTemplate(template);
            return;
        }
        applyTemplate(template);
    };
    const openManager = (seed: Pick<TemplateDraft, "description" | "goal"> | null) => {
        setManagerSeed(seed);
        setManagerOpen(true);
    };
    const upsertTemplate = (template: TaskTemplate) => {
        setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
    };
    const deleteTemplate = (id: number) => {
        setTemplates((current) => current.filter((template) => template.id !== id));
        if (selectedTemplateID === id)
            onSelectedTemplateIDChange(null);
    };
    return (<>
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs font-medium text-foreground">任务模板</Label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-7 text-xs" onPress={() => openManager(null)} variant={"outline"}>
              <Settings2Icon className="size-3.5 mr-1"/>
              管理模板
            </Button>
            <Button type="button" size="sm" className="h-7 text-xs" isDisabled={!description.trim() || !goal.trim()} onPress={() => openManager({ description, goal })} variant={"outline"}>
              <SaveIcon className="size-3.5 mr-1"/>
              另存为模板
            </Button>
          </div>
        </div>

        <ComboBox selectedKey={selectedTemplateID == null ? null : String(selectedTemplateID)} isDisabled={loading || templates.length === 0} aria-label="选择任务模板" onSelectionChange={(key) => chooseTemplate(key == null ? null : Number(key))}>
          <ComboBox.InputGroup>
            <Input placeholder={loading ? "正在加载模板…" : "搜索任务模板"}/>
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox items={templates}>
              {(template) => (<ListBox.Item id={String(template.id)} textValue={template.name}>
                  <span className="font-medium">{template.name}</span>
                  <span className="ml-2 truncate text-xs text-muted">{template.description}</span>
                </ListBox.Item>)}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <Description className="text-xs text-muted">选择后会复制模板的描述和目标，不与模板保持关联。</Description>
      </div>

      
        <AlertDialog.Backdrop isOpen={pendingTemplate != null} onOpenChange={(open) => {
            if (!open)
                setPendingTemplate(null);
        }}>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="w-full max-w-md p-6 bg-surface border border-border rounded-xl shadow-xl outline-none">
              <AlertDialog.Header className="pb-2">
                <AlertDialog.Heading className="text-base font-semibold text-foreground">
                  使用模板「{pendingTemplate?.name}」？
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body className="py-2 text-xs text-muted">
                当前已填写的描述和目标将被模板内容覆盖。
              </AlertDialog.Body>
              <AlertDialog.Footer className="pt-3 flex justify-end gap-2 border-t border-border">
                <Button size="sm" onPress={() => setPendingTemplate(null)} variant={"outline"}>
                  取消
                </Button>
                <Button size="sm" onPress={() => pendingTemplate && applyTemplate(pendingTemplate)} variant={"primary"}>
                  覆盖并使用
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      

      <TaskTemplateManager open={managerOpen} onOpenChange={setManagerOpen} templates={templates} seed={managerSeed} onCreated={upsertTemplate} onUpdated={upsertTemplate} onDeleted={deleteTemplate}/>
    </>);
}
