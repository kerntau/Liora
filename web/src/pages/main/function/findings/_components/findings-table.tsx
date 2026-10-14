import * as React from "react";
import { Link } from "react-router";
import { Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Table as MuiTable, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
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
    const [deleteTarget, setDeleteTarget] = React.useState<Finding | null>(null);
    const selectableIds = items.map((finding) => finding.finding_id).filter((id): id is string => Boolean(id));
    const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
    let headerChecked: boolean | "indeterminate" = false;
    if (selectableIds.length > 0 && selectedCount === selectableIds.length) {
        headerChecked = true;
    }
    else if (selectedCount > 0) {
        headerChecked = "indeterminate";
    }
    return (<TableContainer><MuiTable size="small" sx={{ minWidth: 960 }} aria-label="数据表">
          <TableHead><TableRow>
            <TableCell className="w-8"><Checkbox onChange={(event) => onToggleSelectedPage(selectableIds, event.target.checked)} slotProps={{ input: { "aria-label": selectAllLabel } }} checked={headerChecked === true} indeterminate={headerChecked === "indeterminate"} /></TableCell>
            <TableCell className="w-8" />
            <TableCell className="w-20">
              严重度
            </TableCell>
            <TableCell>
              漏洞名称
            </TableCell>
            <TableCell className="w-44">
              资产
            </TableCell>
            <TableCell className="w-28">
              状态
            </TableCell>
            <TableCell className="w-32">
              所属任务
            </TableCell>
            <TableCell className="w-24">
              时间
            </TableCell>
            <TableCell className="w-48">
              操作
            </TableCell>
          </TableRow></TableHead>
          <TableBody>
            {items.map((f) => {
            const rowKey = findingRowKey(f);
            const open = expandedKey === rowKey;
            const retest = f.finding_id ? activeRetests[f.finding_id] : undefined;
            return (<React.Fragment key={rowKey}>
                  <TableRow className="cursor-pointer" aria-expanded={open} onClick={() => onToggleRow(f)} id={f.finding_id ?? findingRowKey(f)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {f.finding_id && (<Checkbox checked={selectedIds.has(f.finding_id)} onChange={(event) => onToggleSelected(f.finding_id as string, event.target.checked)} slotProps={{ input: { "aria-label": "选择该漏洞" } }} />)}
                    </TableCell>
                    <TableCell>
                      <ChevronRightIcon className={cn("size-4 text-muted transition-transform", open && "rotate-90")}/>
                    </TableCell>
                    <TableCell>
                      <StatusBadge domain="severity" value={f.severity} dot/>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {f.finding_id ? (<Link to={`/function/findings/detail?id=${f.finding_id}`} onClick={(e) => e.stopPropagation()} className="truncate font-medium hover:text-accent hover:underline" title="查看发现详情">
                            {f.name || f.vulnclass || "未分类"}
                          </Link>) : (<span className="truncate font-medium">{f.name || f.vulnclass || "未分类"}</span>)}
                        <span className="truncate text-xs text-muted">{f.summary}</span>
                        <Chip size="small" variant="outlined" label={`流量证据 ${f.traffic_count ?? 0} 条`} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {f.assets && f.assets.length > 0 ? (<div className="flex flex-wrap gap-1">
                          {f.assets.slice(0, 3).map((a) => (<code key={a.id} className="max-w-full truncate rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs" title={`${a.type} · ${a.label}`}>
                              {a.label}
                            </code>))}
                          {f.assets.length > 3 && <span className="text-xs text-muted">+{f.assets.length - 3}</span>}
                        </div>) : (<span className="text-muted">—</span>)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {f.finding_id ? (<Select value={f.status} size="small" aria-label="选择状态" onChange={(event) => onStatusChange(f, event.target.value as FindingStatus)} sx={{ minWidth: 112 }}>
                        {FINDING_STATUSES.map((st) => (<MenuItem key={st} value={st}>{statusMeta("finding", st).label}</MenuItem>))}
                      </Select>) : (<StatusBadge domain="finding" value={f.status} dot/>)}
                    </TableCell>
                    <TableCell>
                      {f.task_id ? (<Link to={`/function/tasks/detail?id=${f.task_id}`} onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-1 text-accent hover:underline" title={f.task_description}>
                          <span className="truncate">{f.task_description}</span>
                          <ArrowUpRightIcon className="size-3 shrink-0"/>
                        </Link>) : (<span className="text-muted">—</span>)}
                    </TableCell>
                    <TableCell className="text-xs text-muted tabular-nums">{fmtTime(f.ts)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {retest ? (<Link to={`/function/conversations/detail?c=${retest.conversation_id}`} title="查看正在进行的复测会话" className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-gray-100">
                            <CircularProgress size={14}/>
                            复测中
                          </Link>) : null}
                        {!retest && f.finding_id && !f.inherited ? (<Button size="small" onClick={() => onRetest(f)} aria-label={"在独立会话中复测该漏洞"} variant="text" startIcon={<RotateCcwIcon size={15}/> }>
                            复测
                          </Button>) : null}
                        {f.finding_id && f.task_id && (<Button size="small" onClick={() => onDeepen(f)} variant="text" startIcon={<FlaskConicalIcon size={15}/> }>
                            深入
                          </Button>)}
                        {f.finding_id && (<IconButton size="small" aria-label="删除漏洞" onClick={() => setDeleteTarget(f)} color="error">
                          <Trash2Icon size={16}/>
                        </IconButton>)}
                      </div>
                    </TableCell>
                  </TableRow>
                  {open && (<TableRow className="hover:bg-transparent" id={`${rowKey}-detail-11558`}>
                      {/* whitespace-normal 覆盖 TableCell 默认的 nowrap,否则展开区文字
                                被强制单行、直接溢出单元格。 */}
                      <TableCell colSpan={COLUMN_COUNT} className="bg-surface-secondary/30 whitespace-normal">
                        <div className="flex flex-col gap-2 px-2 py-1">
                          {/* 行内编辑:名称/类别/严重等级,可改并保存(仅独立 finding 行)。 */}
                          {f.finding_id && edit && (<div className="flex flex-wrap items-end gap-3 rounded-md border bg-background px-3 py-2.5">
                              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                                <TextField label="漏洞名称" value={edit.name} onChange={(e) => onEditChange((s) => (s ? { ...s, name: e.target.value } : s))} placeholder="可读标题，留空回退类别" size="small" fullWidth />
                              </div>
                              <div className="flex min-w-[10rem] flex-col gap-1">
                                <TextField label="类别" value={edit.vulnclass} onChange={(e) => onEditChange((s) => (s ? { ...s, vulnclass: e.target.value } : s))} placeholder="如 SQL Injection" size="small" fullWidth />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Select value={edit.severity} size="small" aria-label="选择严重等级" onChange={(event) => onEditChange((s) => (s ? { ...s, severity: event.target.value as Severity } : s))}>
                                  {SEVERITIES.map((sv) => (<MenuItem key={sv} value={sv}>{statusMeta("severity", sv).label}</MenuItem>))}
                                </Select>
                              </div>
                              <Button size="small" disabled={saving} onClick={() => onSave(f)} variant="contained">
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
                      </TableCell>
                    </TableRow>)}
                </React.Fragment>);
        })}
            {items.length === 0 && (<TableRow id="empty-17103">
                <TableCell colSpan={COLUMN_COUNT} className="py-12 text-center text-sm text-muted">
                  没有匹配的发现。
                </TableCell>
              </TableRow>)}
          </TableBody>
        </MuiTable>
        <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
          <DialogTitle>确认删除该漏洞？</DialogTitle>
          <DialogContent>
            「<span className="break-all">{deleteTarget?.name || deleteTarget?.vulnclass || deleteTarget?.summary || (deleteTarget?.finding_id ? `#${deleteTarget.finding_id}` : "")}</span>」将被永久删除，同时从发现列表、任务发现 Tab 与探索图中移除，此操作不可撤销。
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button color="error" variant="contained" onClick={() => { if (deleteTarget) onDelete(deleteTarget); setDeleteTarget(null); }}>删除</Button>
          </DialogActions>
        </Dialog>
      </TableContainer>);
}

