import * as React from "react";
import { Link } from "react-router";
import { AlertDialog, Button, buttonVariants, Checkbox, Chip, Input, Label, ListBox, Select, Spinner, Table, TextField, } from "@heroui/react";
import { ArrowUpRightIcon, ChevronRightIcon, FileTextIcon, FlaskConicalIcon, RotateCcwIcon, ShieldAlertIcon, Trash2Icon, } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import { statusMeta } from "@/lib/status";
import type { ActiveFindingRetest, Finding, FindingStatus, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
export const FINDING_STATUSES: FindingStatus[] = [
    "pending",
    "in_progress",
    "confirmed",
    "resolved",
    "fixed",
    "false_positive",
    "ignored",
    "duplicate",
    "risk_accepted",
];
export const UNASSIGNED_TASK = "__unassigned__";
// 行内编辑缓冲:当前展开行的名称/类别/严重等级。
export interface FindingEdit {
    name: string;
    vulnclass: string;
    severity: Severity;
}
export type FindingReport = {
    status: "loading" | "done" | "error";
    text: string;
};
// Exploration node ids are only unique inside a task. Prefer the persisted
// finding id and otherwise namespace the node id by task so editing one group
// cannot update a similarly-named node in another expanded group.
export function findingRowKey(finding: Finding): string {
    if (finding.finding_id)
        return `finding:${finding.finding_id}`;
    return `node:${finding.task_id ?? UNASSIGNED_TASK}:${finding.id}`;
}
export function isSameFinding(left: Finding, right: Finding): boolean {
    return findingRowKey(left) === findingRowKey(right);
}
export function fmtTime(ts: string) {
    return new Date(ts).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
const COLUMN_COUNT = 9;
interface FindingsTableProps {
    items: Finding[];
    selectedIds: Set<string>;
    onToggleSelected: (id: string, checked: boolean) => void;
    onToggleSelectedPage: (ids: string[], checked: boolean) => void;
    /** 当前展开行的 findingRowKey;null = 全部收起。 */
    expandedKey: string | null;
    onToggleRow: (finding: Finding) => void;
    reports: Record<string, FindingReport>;
    edit: FindingEdit | null;
    onEditChange: React.Dispatch<React.SetStateAction<FindingEdit | null>>;
    saving: boolean;
    onSave: (finding: Finding) => void;
    onStatusChange: (finding: Finding, next: FindingStatus) => void;
    onRetest: (finding: Finding) => void;
    activeRetests: Record<string, ActiveFindingRetest>;
    onDeepen: (finding: Finding) => void;
    onDelete: (finding: Finding) => void;
    /** 全选框的无障碍标签,平铺视图与分组视图措辞不同。 */
    selectAllLabel?: string;
}
// FindingsTable 是发现列表的表格主体,平铺视图与按任务分组视图共用同一份行渲染
// (勾选 / 行内展开 / 行内改名与改状态 / 复测 / 深入 / 删除),差异只在外层容器与分页。
export function FindingsTable({ items, selectedIds, onToggleSelected, onToggleSelectedPage, expandedKey, onToggleRow, reports, edit, onEditChange, saving, onSave, onStatusChange, onRetest, activeRetests, onDeepen, onDelete, selectAllLabel = "选择当前页全部", }: FindingsTableProps) {
    const selectableIds = items.map((finding) => finding.finding_id).filter((id): id is string => Boolean(id));
    const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
    let headerChecked: boolean | "indeterminate" = false;
    if (selectableIds.length > 0 && selectedCount === selectableIds.length) {
        headerChecked = true;
    }
    else if (selectedCount > 0) {
        headerChecked = "indeterminate";
    }
    return (<Table>
      <Table.ScrollContainer>
        <Table.Content className="min-w-[60rem] table-fixed" aria-label="数据表" selectionMode="multiple" selectedKeys={selectedIds} disabledKeys={new Set(items.filter((item) => !item.finding_id).map((item) => findingRowKey(item)))} disabledBehavior="selection" onSelectionChange={(keys) => {
            for (const id of selectableIds) {
                const checked = keys === "all" || keys.has(id);
                if (checked !== selectedIds.has(id))
                    onToggleSelected(id, checked);
            }
        }}>
          <Table.Header>
            <Table.Column className="w-8" id="column-4404" isRowHeader>
              <Checkbox slot={null} onChange={(checked) => onToggleSelectedPage(selectableIds, checked === true)} aria-label={selectAllLabel} isSelected={headerChecked === true} isIndeterminate={headerChecked === "indeterminate"}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
            </Table.Column>
            <Table.Column className="w-8" id="column-4681" isRowHeader/>
            <Table.Column className="w-20" id="column-4721" isRowHeader>
              严重度
            </Table.Column>
            <Table.Column id="column-4775" isRowHeader>
              漏洞名称
            </Table.Column>
            <Table.Column className="w-44" id="column-4813" isRowHeader>
              资产
            </Table.Column>
            <Table.Column className="w-28" id="column-4866" isRowHeader>
              状态
            </Table.Column>
            <Table.Column className="w-32" id="column-4919" isRowHeader>
              所属任务
            </Table.Column>
            <Table.Column className="w-24" id="column-4974" isRowHeader>
              时间
            </Table.Column>
            <Table.Column className="w-48" id="column-5027" isRowHeader>
              操作
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {items.map((f) => {
            const rowKey = findingRowKey(f);
            const open = expandedKey === rowKey;
            const retest = f.finding_id ? activeRetests[f.finding_id] : undefined;
            return (<React.Fragment key={rowKey}>
                  <Table.Row className="cursor-pointer" aria-expanded={open} onAction={() => onToggleRow(f)} id={f.finding_id ?? findingRowKey(f)}>
                    <Table.Cell onClick={(e) => e.stopPropagation()}>
                      {f.finding_id && (<Checkbox slot={null} onChange={(c) => onToggleSelected(f.finding_id as string, c === true)} aria-label="选择该漏洞" isSelected={selectedIds.has(f.finding_id) === true}>
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>)}
                    </Table.Cell>
                    <Table.Cell>
                      <ChevronRightIcon className={cn("size-4 text-muted transition-transform", open && "rotate-90")}/>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge domain="severity" value={f.severity} dot/>
                    </Table.Cell>
                    <Table.Cell className="max-w-md">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {f.finding_id ? (<Link to={`/function/findings/detail?id=${f.finding_id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:text-accent hover:underline" title="查看发现详情">
                            {f.name || f.vulnclass || "未分类"}
                          </Link>) : (<span className="truncate font-medium">{f.name || f.vulnclass || "未分类"}</span>)}
                        <span className="truncate text-xs text-muted">{f.summary}</span>
                        <Chip size="sm" variant={"secondary"}>
                          流量证据 {f.traffic_count ?? 0} 条
                        </Chip>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {f.assets && f.assets.length > 0 ? (<div className="flex flex-wrap gap-1">
                          {f.assets.slice(0, 3).map((a) => (<code key={a.id} className="max-w-full truncate rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs" title={`${a.type} · ${a.label}`}>
                              {a.label}
                            </code>))}
                          {f.assets.length > 3 && <span className="text-xs text-muted">+{f.assets.length - 3}</span>}
                        </div>) : (<span className="text-muted">—</span>)}
                    </Table.Cell>
                    <Table.Cell onClick={(e) => e.stopPropagation()}>
                      {f.finding_id ? (<Select selectedKey={f.status} aria-label="选择选项" onSelectionChange={(key) => {
                        if (key !== null)
                            ((v) => onStatusChange(f, v as FindingStatus))(String(key));
                    }}>
                          <Select.Trigger className="h-7 w-full border-none px-1 shadow-none focus-visible:ring-0">
                            <StatusBadge domain="finding" value={f.status} dot/>
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {FINDING_STATUSES.map((st) => (<ListBox.Item key={st} id={st}>
                                  {statusMeta("finding", st).label}
                                </ListBox.Item>))}
                            </ListBox>
                          </Select.Popover>
                        </Select>) : (<StatusBadge domain="finding" value={f.status} dot/>)}
                    </Table.Cell>
                    <Table.Cell>
                      {f.task_id ? (<Link to={`/function/tasks/detail?id=${f.task_id}`} onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-1 text-accent hover:underline" title={f.task_description}>
                          <span className="truncate">{f.task_description}</span>
                          <ArrowUpRightIcon className="size-3 shrink-0"/>
                        </Link>) : (<span className="text-muted">—</span>)}
                    </Table.Cell>
                    <Table.Cell className="text-xs text-muted tabular-nums">{fmtTime(f.ts)}</Table.Cell>
                    <Table.Cell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {retest ? (<Link to={`/function/conversations/detail?c=${retest.conversation_id}`} title="查看正在进行的复测会话" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                            <Spinner data-icon="inline-start"/>
                            复测中
                          </Link>) : null}
                        {!retest && f.finding_id && !f.inherited ? (<Button size="sm" onPress={() => onRetest(f)} aria-label={"在独立会话中复测该漏洞"} variant={"ghost"}>
                            <RotateCcwIcon data-icon="inline-start"/>
                            复测
                          </Button>) : null}
                        {f.finding_id && f.task_id && (<Button size="sm" onPress={() => onDeepen(f)} variant={"ghost"}>
                            <FlaskConicalIcon data-icon="inline-start"/>
                            深入
                          </Button>)}
                        {f.finding_id && (<AlertDialog>
                            
                              <Button className="size-7 text-muted hover:text-danger" aria-label="删除漏洞" size="sm" isIconOnly variant={"ghost"}>
                                <Trash2Icon className="size-4"/>
                              </Button>
                            
                            <AlertDialog.Backdrop>
                              <AlertDialog.Container>
                                <AlertDialog.Dialog>
                                  <AlertDialog.Header>
                                    <AlertDialog.Heading>确认删除该漏洞？</AlertDialog.Heading>
                                    <AlertDialog.Body className="break-words">
                                      「
                                      <span className="break-all">
                                        {f.name || f.vulnclass || f.summary || `#${f.finding_id}`}
                                      </span>
                                      」将被永久删除， 同时从发现列表、任务发现 Tab 与探索图中移除，此操作不可撤销。
                                    </AlertDialog.Body>
                                  </AlertDialog.Header>
                                  <AlertDialog.Footer>
                                    <Button slot="close" variant={"outline"}>
                                      取消
                                    </Button>
                                    <Button onPress={() => onDelete(f)} slot="close">
                                      删除
                                    </Button>
                                  </AlertDialog.Footer>
                                </AlertDialog.Dialog>
                              </AlertDialog.Container>
                            </AlertDialog.Backdrop>
                          </AlertDialog>)}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                  {open && (<Table.Row className="hover:bg-transparent" id={`${rowKey}-detail-11558`}>
                      {/* whitespace-normal 覆盖 TableCell 默认的 nowrap,否则展开区文字
                                被强制单行、直接溢出单元格。 */}
                      <Table.Cell colSpan={COLUMN_COUNT} className="bg-surface-secondary/30 whitespace-normal">
                        <div className="flex flex-col gap-2 px-2 py-1">
                          {/* 行内编辑:名称/类别/严重等级,可改并保存(仅独立 finding 行)。 */}
                          {f.finding_id && edit && (<div className="flex flex-wrap items-end gap-3 rounded-md border bg-background px-3 py-2.5">
                              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                                <Label className="text-xs text-muted">漏洞名称</Label>
                                <TextField className="contents" aria-label={"可读标题，留空回退类别"}>
                                  <Input value={edit.name} onChange={(e) => onEditChange((s) => (s ? { ...s, name: e.target.value } : s))} placeholder="可读标题，留空回退类别"/>
                                </TextField>
                              </div>
                              <div className="flex min-w-[10rem] flex-col gap-1">
                                <Label className="text-xs text-muted">类别</Label>
                                <TextField className="contents" aria-label={"如 SQL Injection"}>
                                  <Input value={edit.vulnclass} onChange={(e) => onEditChange((s) => (s ? { ...s, vulnclass: e.target.value } : s))} placeholder="如 SQL Injection"/>
                                </TextField>
                              </div>
                              <div className="flex flex-col gap-1">
                                <Label className="text-xs text-muted">严重等级</Label>
                                <Select selectedKey={edit.severity} aria-label="选择选项" onSelectionChange={(key) => {
                            if (key !== null)
                                ((v) => onEditChange((s) => (s ? { ...s, severity: v as Severity } : s)))(String(key));
                        }}>
                                  <Select.Trigger className="w-28">
                                    <Select.Value />
                                  </Select.Trigger>
                                  <Select.Popover>
                                    <ListBox>
                                      {SEVERITIES.map((sv) => (<ListBox.Item key={sv} id={sv}>
                                          {statusMeta("severity", sv).label}
                                        </ListBox.Item>))}
                                    </ListBox>
                                  </Select.Popover>
                                </Select>
                              </div>
                              <Button size="sm" isDisabled={saving} onPress={() => onSave(f)}>
                                {saving ? "保存中…" : "保存"}
                              </Button>
                            </div>)}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <ShieldAlertIcon className="size-3.5"/>
                            证据
                            {f.vulnclass && (<span>
                                · 类型：
                                <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono">
                                  {f.vulnclass}
                                </code>
                              </span>)}
                            {f.param_id && (<code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono">{f.param_id}</code>)}
                            {f.assets && f.assets.length > 0 && (<span className="flex flex-wrap items-center gap-1">
                                · 资产：
                                {f.assets.map((a) => (<code key={a.id} className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono" title={a.type}>
                                    {a.label}
                                  </code>))}
                              </span>)}
                          </div>
                          <pre className="overflow-x-auto rounded-md bg-surface-secondary px-3 py-2 font-mono text-xs whitespace-pre-wrap">
                            {f.evidence}
                          </pre>

                          {/* 详细报告(Markdown):展开时按 finding_id 懒加载,免进详情页即可查看。 */}
                          {f.finding_id && (<div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                                <span className="flex items-center gap-2">
                                  <FileTextIcon className="size-3.5"/>
                                  详细报告
                                </span>
                                {reports[rowKey]?.status === "done" && reports[rowKey]?.text.trim() && (<CopyButton text={reports[rowKey]?.text} successMessage="已复制详细报告" variant="ghost" className="h-6 px-2 text-xs"/>)}
                              </div>
                              {(() => {
                            const rep = reports[rowKey];
                            if (!rep || rep.status === "loading")
                                return <p className="text-xs text-muted">加载中…</p>;
                            if (rep.status === "error")
                                return <p className="text-xs text-muted">报告加载失败。</p>;
                            if (!rep.text.trim())
                                return <p className="text-xs text-muted">暂无详细报告。</p>;
                            return (<div className="min-w-0 break-words rounded-md border bg-background px-3 py-2 [&_pre]:whitespace-pre-wrap">
                                    <Markdown text={rep.text}/>
                                  </div>);
                        })()}
                            </div>)}
                        </div>
                      </Table.Cell>
                    </Table.Row>)}
                </React.Fragment>);
        })}
            {items.length === 0 && (<Table.Row id="empty-17103">
                <Table.Cell colSpan={COLUMN_COUNT} className="py-12 text-center text-sm text-muted">
                  没有匹配的发现。
                </Table.Cell>
              </Table.Row>)}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>);
}
