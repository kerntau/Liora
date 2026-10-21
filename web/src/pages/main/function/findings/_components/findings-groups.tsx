"use client";

import type { ComponentProps, ReactNode } from "react";

import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { fmtTime } from "@/lib/format";
import Link from "@/lib/router-compat";
import type { Finding, FindingGroup } from "@/lib/types";
import { cn } from "@/lib/utils";

import { FindingsTable, SEVERITIES, UNASSIGNED_TASK } from "./findings-table";

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
      <Card>
        <CardContent className="flex min-h-36 items-center justify-center">
          <Spinner />
        </CardContent>
      </Card>
    );
  } else if (groupsError && groups.length === 0) {
    emptyState = (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <span className="text-foreground">加载失败</span>
          <span className="max-w-md break-words text-xs">{groupsError}</span>
          <Button size="sm" variant="outline" onClick={() => onRefreshGroups()}>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  } else if (groups.length === 0) {
    emptyState = (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <span>{hasFilters ? "没有匹配的发现。" : "暂无发现。运行任务后，发现的漏洞会按任务汇总到这里。"}</span>
          {hasFilters && (
            <Button size="sm" variant="outline" onClick={onClearFilters}>
              清除筛选
            </Button>
          )}
        </CardContent>
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
          <Card key={key} className="gap-0 py-0">
            <CardHeader className="px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={groupOpen}
                  onClick={() => onToggleGroup(key)}
                >
                  <ChevronRightIcon
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      groupOpen && "rotate-90",
                    )}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="truncate text-sm">
                      {group.task_id === null
                        ? "未关联 / 任务已删除"
                        : group.task_name
                          ? `${group.task_name}（任务 #${group.task_id}）`
                          : `任务 #${group.task_id}`}
                    </CardTitle>
                    <CardDescription className="truncate" title={group.task_description}>
                      {group.task_description || "来源任务不可用"}
                    </CardDescription>
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
                        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                      </span>
                    );
                  })}
                  <span className="text-xs tabular-nums text-muted-foreground">{fmtTime(group.last_found_at)}</span>
                  {group.task_id !== null && (
                    <Button size="icon-sm" variant="ghost" asChild>
                      <Link
                        href={`/function/tasks/detail?id=${group.task_id}`}
                        aria-label={`查看任务 #${group.task_id}`}
                      >
                        <ArrowUpRightIcon />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {groupOpen && (
              <CardContent className="relative px-0">
                {/* 组内翻页时同样只压一条细进度条,不遮挡已加载的行。 */}
                {state.pending && state.loaded && (
                  <div
                    role="status"
                    aria-label="正在更新列表"
                    className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary/60"
                  />
                )}
                {state.loading && !state.loaded && !state.error ? (
                  <div className="flex min-h-36 items-center justify-center">
                    <Spinner />
                  </div>
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
              </CardContent>
            )}
          </Card>
        );
      })}
      {emptyState}
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
    </div>
  );
}
