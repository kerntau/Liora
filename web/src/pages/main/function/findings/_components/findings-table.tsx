"use client";

import * as React from "react";

import Link from "@/lib/router-compat";

import {
  ArrowUpRightIcon,
  BugIcon,
  ChevronRightIcon,
  FileTextIcon,
  FlaskConicalIcon,
  RotateCcwIcon,
  SearchXIcon,
  TerminalIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtTime } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import type { ActiveFindingRetest, Finding, FindingStatus, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

import { StateBlock } from "./state-block";

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

export type FindingReport = { status: "loading" | "done" | "error"; text: string };

// Exploration node ids are only unique inside a task. Prefer the persisted
// finding id and otherwise namespace the node id by task so editing one group
// cannot update a similarly-named node in another expanded group.
export function findingRowKey(finding: Finding): string {
  if (finding.finding_id) return `finding:${finding.finding_id}`;
  return `node:${finding.task_id ?? UNASSIGNED_TASK}:${finding.id}`;
}

export function isSameFinding(left: Finding, right: Finding): boolean {
  return findingRowKey(left) === findingRowKey(right);
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
  /** 当前页首载失败的原因;为空表示没有失败,用于和「空结果」区分。 */
  error?: string | null;
  /** 重新拉取当前页,失败态下给重试。 */
  onRetry?: () => void;
  /** 列表为空时是否处于筛选状态,决定空态是否给「清除筛选」。 */
  hasFilters?: boolean;
  onClearFilters?: () => void;
  /** 资产视图左侧已有资产树，隐藏重复的「资产」列以在 1440 内放下表格。 */
  hideAssetColumn?: boolean;
}

// FindingsTable 是发现列表的表格主体,平铺视图与按任务分组视图共用同一份行渲染
// (勾选 / 行内展开 / 行内改名与改状态 / 复测 / 深入 / 删除),差异只在外层容器与分页。
export function FindingsTable({
  items,
  selectedIds,
  onToggleSelected,
  onToggleSelectedPage,
  expandedKey,
  onToggleRow,
  reports,
  edit,
  onEditChange,
  saving,
  onSave,
  onStatusChange,
  onRetest,
  activeRetests,
  onDeepen,
  onDelete,
  selectAllLabel = "选择当前页全部",
  error = null,
  onRetry,
  hasFilters = false,
  onClearFilters,
  hideAssetColumn = false,
}: FindingsTableProps) {
  const selectableIds = items.map((finding) => finding.finding_id).filter((id): id is string => Boolean(id));
  const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
  let headerChecked: boolean | "indeterminate" = false;
  if (selectableIds.length > 0 && selectedCount === selectableIds.length) {
    headerChecked = true;
  } else if (selectedCount > 0) {
    headerChecked = "indeterminate";
  }

  // 空表分三种:失败(给重试)、筛选没命中(给清除筛选)、本来就没有数据(给下一步说明)。
  let emptyContent: React.ReactNode;
  if (error) {
    emptyContent = (
      <StateBlock
        icon={TriangleAlertIcon}
        tone="error"
        title="加载失败"
        description={error}
        action={
          onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              重试
            </Button>
          )
        }
      />
    );
  } else if (hasFilters) {
    emptyContent = (
      <StateBlock
        icon={SearchXIcon}
        title="没有匹配的发现。"
        description="当前筛选条件下没有结果，放宽等级、状态或关键词后再试。"
        action={
          onClearFilters && (
            <Button size="sm" variant="outline" onClick={onClearFilters}>
              清除筛选
            </Button>
          )
        }
      />
    );
  } else {
    emptyContent = (
      <StateBlock
        icon={BugIcon}
        title="暂无发现。"
        description="运行任务后，发现的漏洞会汇总到这里。"
      />
    );
  }

  return (
    /* 固定列宽保证展开内容不撑开表格；窄屏只在表格内部横向滚动。 */
    <Table className={cn("table-fixed", hideAssetColumn ? "min-w-[53rem]" : "min-w-[64rem]")}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-9 pl-4">
            <Checkbox
              checked={headerChecked}
              onCheckedChange={(checked) => onToggleSelectedPage(selectableIds, checked === true)}
              aria-label={selectAllLabel}
            />
          </TableHead>
          <TableHead className="w-7" />
          <TableHead className="w-[5.5rem]">严重度</TableHead>
          <TableHead>漏洞名称</TableHead>
          {!hideAssetColumn && <TableHead className="w-44">资产</TableHead>}
          <TableHead className="w-28">状态</TableHead>
          <TableHead className="w-32">所属任务</TableHead>
          <TableHead className="w-24">时间</TableHead>
          <TableHead className="sticky right-0 z-20 w-52 border-l border-border/70 bg-surface-muted pr-4 text-right">
            操作
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((f) => {
          const rowKey = findingRowKey(f);
          const open = expandedKey === rowKey;
          const retest = f.finding_id ? activeRetests[f.finding_id] : undefined;
          return (
            <React.Fragment key={rowKey}>
              <TableRow
                className={cn(
                  "group/row cursor-pointer align-top focus-visible:outline-2 focus-visible:outline-ring",
                  open && "bg-surface-muted/60",
                )}
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => onToggleRow(f)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                  event.preventDefault();
                  onToggleRow(f);
                }}
              >
                <TableCell className="pt-3.5 pl-4">
                  {f.finding_id && (
                    <Checkbox
                      checked={selectedIds.has(f.finding_id)}
                      onCheckedChange={(c) => onToggleSelected(f.finding_id as string, c === true)}
                      aria-label="选择该漏洞"
                    />
                  )}
                </TableCell>
                <TableCell className="pt-3.5">
                  <ChevronRightIcon
                    className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-90")}
                    aria-hidden="true"
                  />
                </TableCell>
                <TableCell className="pt-3.5">
                  <StatusBadge domain="severity" value={f.severity} dot />
                </TableCell>
                <TableCell className="max-w-md py-3 whitespace-normal">
                  {/* 两行封顶：标题行尾挂证据条数，摘要单行截断，行高从 98px 收到 ~68px。 */}
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex min-w-0 items-center gap-2">
                      {f.finding_id ? (
                        <Link
                          href={`/function/findings/detail?id=${f.finding_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 truncate text-[13px] leading-5 font-semibold text-foreground hover:text-primary hover:underline"
                          title="查看发现详情"
                        >
                          {f.name || f.vulnclass || "未分类"}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate text-[13px] leading-5 font-semibold text-foreground">
                          {f.name || f.vulnclass || "未分类"}
                        </span>
                      )}
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
                        <FileTextIcon className="size-3" aria-hidden="true" />
                        流量证据 {f.traffic_count ?? 0} 条
                      </span>
                    </div>
                    {f.summary ? (
                      <p className="line-clamp-1 text-xs leading-5 break-words text-muted-foreground">{f.summary}</p>
                    ) : null}
                  </div>
                </TableCell>
                {!hideAssetColumn && (
                <TableCell className="py-3 whitespace-normal">
                  {f.assets && f.assets.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {f.assets.slice(0, 3).map((a) => (
                        <code
                          key={a.id}
                          className="max-w-full truncate rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                          title={`${a.type} · ${a.label}`}
                        >
                          {a.label}
                        </code>
                      ))}
                      {f.assets.length > 3 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">+{f.assets.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                )}
                <TableCell className="pt-3" onClick={(e) => e.stopPropagation()}>
                  {f.finding_id ? (
                    <Select value={f.status} onValueChange={(v) => onStatusChange(f, v as FindingStatus)}>
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-full border-none bg-transparent px-1 shadow-none hover:bg-surface-muted"
                      >
                        <StatusBadge domain="finding" value={f.status} dot />
                      </SelectTrigger>
                      <SelectContent position="popper" align="end">
                        {FINDING_STATUSES.map((st) => (
                          <SelectItem key={st} value={st}>
                            {statusMeta("finding", st).label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge domain="finding" value={f.status} dot />
                  )}
                </TableCell>
                <TableCell className="pt-3.5">
                  {f.task_id ? (
                    <Link
                      href={`/function/tasks/detail?id=${f.task_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                      title={f.task_description}
                    >
                      <span className="truncate">{f.task_description}</span>
                      <ArrowUpRightIcon className="size-3 shrink-0" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="pt-3.5 font-mono text-xs text-muted-foreground tabular-nums">
                  {fmtTime(f.ts, "short")}
                </TableCell>
                <TableCell
                  className="sticky right-0 z-10 border-l border-border/70 bg-card py-2.5 pr-4 group-hover/row:bg-[color-mix(in_srgb,var(--muted)_55%,transparent)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-0.5">
                    {retest ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/function/conversations/detail?c=${retest.conversation_id}`}
                          title="查看正在进行的复测会话"
                        >
                          <Spinner data-icon="inline-start" />
                          复测中
                        </Link>
                      </Button>
                    ) : null}
                    {!retest && f.finding_id && !f.inherited ? (
                      <Button size="sm" variant="ghost" onClick={() => onRetest(f)} title="在独立会话中复测该漏洞">
                        <RotateCcwIcon data-icon="inline-start" />
                        复测
                      </Button>
                    ) : null}
                    {f.finding_id && f.task_id && (
                      <Button size="sm" variant="ghost" onClick={() => onDeepen(f)}>
                        <FlaskConicalIcon data-icon="inline-start" />
                        深入
                      </Button>
                    )}
                    {f.finding_id && (
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground"
                      >
                        <Link
                          href={`/function/findings/detail?id=${f.finding_id}`}
                          aria-label="查看漏洞详情"
                          title="查看漏洞详情"
                        >
                          <ArrowUpRightIcon className="size-4" />
                        </Link>
                      </Button>
                    )}
                    {f.finding_id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            aria-label="删除漏洞"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除该漏洞？</AlertDialogTitle>
                            <AlertDialogDescription className="break-words">
                              「
                              <span className="break-all">
                                {f.name || f.vulnclass || f.summary || `#${f.finding_id}`}
                              </span>
                              」将被永久删除， 同时从发现列表、任务发现 Tab 与探索图中移除，此操作不可撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(f)}>删除</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {open && (
                <TableRow className="hover:bg-transparent">
                  {/* whitespace-normal 覆盖 TableCell 默认的 nowrap,否则展开区文字
                      被强制单行、直接溢出单元格。 */}
                  <TableCell colSpan={COLUMN_COUNT} className="bg-surface-muted/50 px-4 py-4 whitespace-normal">
                    <div className="flex flex-col gap-3">
                      {/* 行内编辑:名称/类别/严重等级,可改并保存(仅独立 finding 行)。 */}
                      {f.finding_id && edit && (
                        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/70 bg-card px-3.5 py-3">
                          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                            <Label className="text-[11px] text-muted-foreground">漏洞名称</Label>
                            <Input
                              value={edit.name}
                              onChange={(e) => onEditChange((s) => (s ? { ...s, name: e.target.value } : s))}
                              placeholder="可读标题，留空回退类别"
                            />
                          </div>
                          <div className="flex min-w-[10rem] flex-col gap-1">
                            <Label className="text-[11px] text-muted-foreground">类别</Label>
                            <Input
                              value={edit.vulnclass}
                              onChange={(e) => onEditChange((s) => (s ? { ...s, vulnclass: e.target.value } : s))}
                              placeholder="如 SQL Injection"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-[11px] text-muted-foreground">严重等级</Label>
                            <Select
                              value={edit.severity}
                              onValueChange={(v) => onEditChange((s) => (s ? { ...s, severity: v as Severity } : s))}
                            >
                              <SelectTrigger size="sm" className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SEVERITIES.map((sv) => (
                                  <SelectItem key={sv} value={sv}>
                                    {statusMeta("severity", sv).label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="sm" disabled={saving} onClick={() => onSave(f)}>
                            {saving ? "保存中…" : "保存"}
                          </Button>
                        </div>
                      )}

                      <div className="rounded-lg border border-border/70 bg-card p-3.5">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            <TerminalIcon className="size-3.5" aria-hidden="true" />
                            证据
                          </span>
                          {f.vulnclass && (
                            <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {f.vulnclass}
                            </code>
                          )}
                          {f.param_id && (
                            <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {f.param_id}
                            </code>
                          )}
                          {f.assets && f.assets.length > 0 && (
                            <span className="flex flex-wrap items-center gap-1">
                              {f.assets.map((a) => (
                                <code
                                  key={a.id}
                                  className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                                  title={a.type}
                                >
                                  {a.label}
                                </code>
                              ))}
                            </span>
                          )}
                        </div>
                        <pre className="max-h-72 overflow-auto rounded-lg border border-border/60 bg-surface-muted px-3 py-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
                          {f.evidence}
                        </pre>
                      </div>

                      {/* 详细报告(Markdown):展开时按 finding_id 懒加载,免进详情页即可查看。 */}
                      {f.finding_id && (
                        <div className="rounded-lg border border-border/70 bg-card p-3.5">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                              <FileTextIcon className="size-3.5" aria-hidden="true" />
                              详细报告
                            </span>
                            {reports[rowKey]?.status === "done" && reports[rowKey]?.text.trim() && (
                              <CopyButton
                                text={reports[rowKey]?.text}
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                              />
                            )}
                          </div>
                          {(() => {
                            const rep = reports[rowKey];
                            if (!rep || rep.status === "loading")
                              return <p className="text-xs text-muted-foreground">加载中…</p>;
                            if (rep.status === "error")
                              return <p className="text-xs text-muted-foreground">报告加载失败。</p>;
                            if (!rep.text.trim())
                              return <p className="text-xs text-muted-foreground">暂无详细报告。</p>;
                            return (
                              // break-words 会继承到段落/列表,pre 另加
                              // whitespace-pre-wrap 让代码块也换行——否则长代码行/长 URL
                              // 会撑宽 colSpan 单元格,把整张表挤出横向滚动条。
                              <div className="min-w-0 text-[13px] break-words [&_pre]:whitespace-pre-wrap">
                                <Markdown text={rep.text} />
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
        {items.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={COLUMN_COUNT} className="p-0 text-center whitespace-normal">
              {emptyContent}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
