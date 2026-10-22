"use client";

import type { ComponentProps, ReactNode } from "react";

import { ArrowUpRightIcon, ChevronRightIcon, FolderKanbanIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtTime } from "@/lib/format";
import Link from "@/lib/router-compat";
import type { Finding, FindingGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

import { FindingsTable, SEVERITIES, UNASSIGNED_TASK } from "./findings-table";
import { StateBlock, TableSkeleton } from "./state-block";

// 分组视图里每个已展开任务组自带一份分页状态,彼此独立。
export interface GroupFindingsState {
  items: Finding[];
  total: number;
  page: number;
  pageSize: number;
  loaded: boolean;
  loading: boolean;
  /** 非轮询触发的刷新(翻页/改筛选)进行中,用于表头细进度条。 */
  pending: boolean;
  /** 拉取失败原因;有旧数据时保留旧数据,不把失败当空表。 */
  error: string | null;
}

// FindingsTable 里与「哪一批行」无关的那部分 props:页面装配一次,平铺/分组/资产
// 三个视图共用同一套行交互。
export type FindingRowProps = Omit<
  ComponentProps<typeof FindingsTable>,
  "items" | "selectAllLabel" | "error" | "onRetry" | "hasFilters" | "onClearFilters"
>;

export function findingGroupKey(group: FindingGroup) {
  return group.task_id === null ? UNASSIGNED_TASK : String(group.task_id);
}

interface FindingsGroupsProps {
  groups: FindingGroup[];
  groupTotal: number;
  groupsLoaded: boolean;
  groupsPending: boolean;
  groupsError: string | null;
  expandedGroups: Set<string>;
  groupFindings: Record<string, GroupFindingsState>;
  page: number;
  pageSize: number;
  hasFilters: boolean;
  /** 行交互(勾选/展开/改名/复测/深入/删除),三个视图共用。 */
  rowProps: FindingRowProps;
  onToggleGroup: (key: string) => void;
  onLoadGroup: (key: string, page: number, pageSize: number) => void;
  onRefreshGroups: () => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

// FindingsGroups 渲染「按任务分组」视图:组头 + 组内分页表格。数据与请求仍由页面
// 持有,这里只负责呈现与转发交互。
export function FindingsGroups({
  groups,
  groupTotal,
  groupsLoaded,
  groupsPending,
  groupsError,
  expandedGroups,
  groupFindings,
  page,
  pageSize,
  hasFilters,
  rowProps,
  onToggleGroup,
  onLoadGroup,
  onRefreshGroups,
  onClearFilters,
  onPageChange,
  onPageSizeChange,
}: FindingsGroupsProps) {
  // 分组列表的空态同样区分「加载中 / 失败 / 筛选无结果 / 没有数据」。
  let emptyState: ReactNode = null;
  if (!groupsLoaded && !groupsError) {
    emptyState = (
      <Card className="gap-0 overflow-hidden py-0">
        <TableSkeleton rows={4} columns={5} />
      </Card>
    );
  } else if (groupsError && groups.length === 0) {
    emptyState = (
      <Card className="gap-0 overflow-hidden py-0">
        <StateBlock
          icon={TriangleAlertIcon}
          tone="error"
          title="加载失败"
          description={groupsError}
          action={
            <Button size="sm" variant="outline" onClick={() => onRefreshGroups()}>
              重试
            </Button>
          }
        />
      </Card>
    );
  } else if (groups.length === 0) {
    emptyState = (
      <Card className="gap-0 overflow-hidden py-0">
        {hasFilters ? (
          <StateBlock
            icon={SearchXIcon}
            title="没有匹配的发现。"
            description="当前筛选条件下没有任务分组，放宽条件后再试。"
            action={
              <Button size="sm" variant="outline" onClick={onClearFilters}>
                清除筛选
              </Button>
            }
          />
        ) : (
          <StateBlock
            icon={FolderKanbanIcon}
            title="暂无发现。"
            description="运行任务后，发现的漏洞会按任务汇总到这里。"
          />
        )}
      </Card>
    );
  }

  return (
    <div className="relative flex flex-col gap-3">
      {/* 分组列表刷新(切筛选/翻页)时压一条细进度条,不遮挡已有分组。 */}
      {groupsPending && groupsLoaded && (
        <div
          role="status"
          aria-label="正在更新分组列表"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse rounded-full bg-primary/60"
        />
      )}
      {/* 筛选/翻页失败时旧分组仍留在屏幕上(不闪空表),但必须给出失败提示,
          否则用户会把上一批筛选的分组当成新结果。 */}
      {groupsError && groups.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2 text-xs text-destructive"
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">分组列表刷新失败：{groupsError}</span>
          <Button size="sm" variant="outline" onClick={() => onRefreshGroups()}>
            重试
          </Button>
        </div>
      )}
      {groups.map((group) => {
        const key = findingGroupKey(group);
        const groupOpen = expandedGroups.has(key);
        const state = groupFindings[key] ?? {
          items: [],
          total: group.count,
          page: 1,
          pageSize: 10,
          loaded: false,
          loading: false,
          pending: false,
          error: null,
        };
        return (
          <Card key={key} className="gap-0 overflow-hidden py-0">
            <div className="flex min-w-0 flex-wrap items-center gap-3 px-5 py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                aria-expanded={groupOpen}
                onClick={() => onToggleGroup(key)}
              >
                <ChevronRightIcon
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", groupOpen && "rotate-90")}
                  aria-hidden="true"
                />
                <FolderKanbanIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="text-foreground truncate text-[13px] leading-5 font-semibold">
                      {group.task_id === null
                        ? "未关联 / 任务已删除"
                        : group.task_name
                          ? `${group.task_name}（任务 #${group.task_id}）`
                          : `任务 #${group.task_id}`}
                    </h3>
                    <span className="text-muted-foreground shrink-0 text-[12px] tabular-nums">{group.count} 条</span>
                  </div>
                  <p className="text-muted-foreground truncate text-[12px]" title={group.task_description}>
                    {group.task_description || "来源任务不可用"}
                  </p>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {group.task_status && <StatusBadge domain="task" value={group.task_status} dot />}
                {SEVERITIES.map((level) => {
                  const count = group[level];
                  if (count === 0) return null;
                  return (
                    <span key={level} className="inline-flex items-center gap-1">
                      <StatusBadge domain="severity" value={level} dot />
                      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                    </span>
                  );
                })}
                <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                  {fmtTime(group.last_found_at)}
                </span>
                {group.task_id !== null && (
                  <Button size="icon-sm" variant="ghost" asChild>
                    <Link href={`/function/tasks/detail?id=${group.task_id}`} aria-label={`查看任务 #${group.task_id}`}>
                      <ArrowUpRightIcon />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            {groupOpen && (
              <div className="border-border/60 relative border-t">
                {/* 组内翻页时同样只压一条细进度条,不遮挡已加载的行。 */}
                {state.pending && state.loaded && (
                  <div
                    role="status"
                    aria-label="正在更新列表"
                    className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary/60"
                  />
                )}
                {/* 组内翻页失败时旧行仍在,分页却已指向新页;给出行内错误与重试。 */}
                {state.error && state.items.length > 0 && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">本组刷新失败：{state.error}</span>
                    <Button size="sm" variant="outline" onClick={() => onLoadGroup(key, state.page, state.pageSize)}>
                      重试
                    </Button>
                  </div>
                )}
                {state.loading && !state.loaded && !state.error ? (
                  <TableSkeleton rows={4} columns={6} />
                ) : (
                  <>
                    <FindingsTable
                      items={state.items}
                      selectAllLabel="选择本组当前页全部"
                      error={state.error}
                      onRetry={() => void onLoadGroup(key, state.page, state.pageSize)}
                      hasFilters={hasFilters}
                      onClearFilters={onClearFilters}
                      {...rowProps}
                    />
                    {!(state.error && state.items.length === 0) && (
                      <TablePagination
                        page={state.page}
                        pageSize={state.pageSize}
                        total={state.total}
                        onPageChange={(nextPage) => void onLoadGroup(key, nextPage, state.pageSize)}
                        onPageSizeChange={(nextSize) => void onLoadGroup(key, 1, nextSize)}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
      {emptyState}
      {/* 首载中或首载失败时不给「共 0 条」,避免和 Spinner / 错误卡片互相矛盾。
          只有一页分组时不再重复一条分页条（组内分页已经展示了发现条数）。 */}
      {groupsLoaded && groupTotal > pageSize && !(groupsError && groups.length === 0) && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={groupTotal}
          onPageChange={onPageChange}
          onPageSizeChange={(nextPageSize) => {
            onPageSizeChange(nextPageSize);
            onPageChange(1);
          }}
          pageSizeOptions={[5, 10, 20]}
        />
      )}
    </div>
  );
}
