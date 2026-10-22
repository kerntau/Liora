"use client";

import { BugIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusMeta } from "@/lib/status";
import type { FindingStatus, FindingTaskOption } from "@/lib/types";

import { FINDING_STATUSES, UNASSIGNED_TASK } from "./findings-table";

// 列表视图:flat = 跨任务平铺大表(默认);grouped = 按任务分组折叠;
// asset = 左侧资产树 + 右侧该子树下的发现。
export type FindingView = "flat" | "grouped" | "asset";

export const FINDING_VIEWS: FindingView[] = ["flat", "grouped", "asset"];

interface FindingsViewTabsProps {
  view: FindingView;
  onViewChange: (view: FindingView) => void;
}

// FindingsViewTabs 是页头的视图切换,与筛选栏同属「看哪一批发现」的选择,故放在同一个文件里。
export function FindingsViewTabs({ view, onViewChange }: FindingsViewTabsProps) {
  return (
    <Tabs value={view} onValueChange={(v) => onViewChange(v as FindingView)}>
      <TabsList>
        <TabsTrigger value="flat">全部发现</TabsTrigger>
        <TabsTrigger value="grouped">按任务分组</TabsTrigger>
        <TabsTrigger value="asset">按资产</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

interface FindingsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: "all" | FindingStatus;
  onStatusChange: (value: "all" | FindingStatus) => void;
  vulnclass: string;
  onVulnclassChange: (value: string) => void;
  task: string;
  onTaskChange: (value: string) => void;
  sort: "severity" | "time";
  onSortChange: (value: "severity" | "time") => void;
  /** 漏洞类型下拉的选项,来自全表聚合。 */
  vulnclasses?: string[];
  /** 任务下拉的选项(含漏洞条数),来自全表聚合。 */
  tasks?: FindingTaskOption[];
  /** 跨页勾选的条数,为 0 时不显示。 */
  selectedCount: number;
  /** 当前筛选口径下的条数(分组视图取 finding_total)。 */
  total: number;
  /** 有任一筛选生效时给「清除筛选」,与空态里的入口一致。 */
  hasFilters: boolean;
  onClearFilters: () => void;
}

// FindingsToolbar 只渲染筛选控件与计数;筛选状态与请求时序仍由页面持有。
// 主操作(导出)放在页头,这里保持「搜索 → 筛选 → 计数」的阅读顺序。
// 严重度筛选由页首的分布卡承担,工具栏不再重复一组等级切换。
export function FindingsToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  vulnclass,
  onVulnclassChange,
  task,
  onTaskChange,
  sort,
  onSortChange,
  vulnclasses,
  tasks,
  selectedCount,
  total,
  hasFilters,
  onClearFilters,
}: FindingsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
      <InputGroup className="w-full sm:w-64">
        <InputGroupInput
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="检索漏洞内容"
          aria-label="检索漏洞内容"
          className="text-[13px]"
        />
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
      </InputGroup>

      <Select value={status} onValueChange={(v) => onStatusChange(v as "all" | FindingStatus)}>
        <SelectTrigger className="w-[calc(50%-0.25rem)] text-[13px] sm:w-32">
          <SelectValue placeholder="状态" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部状态</SelectItem>
          {FINDING_STATUSES.map((st) => (
            <SelectItem key={st} value={st}>
              {statusMeta("finding", st).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={vulnclass} onValueChange={onVulnclassChange}>
        <SelectTrigger className="w-[calc(50%-0.25rem)] text-[13px] sm:w-40">
          <SelectValue placeholder="漏洞类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部类型</SelectItem>
          {(vulnclasses ?? []).map((vc) => (
            <SelectItem key={vc} value={vc}>
              {vc}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={task} onValueChange={onTaskChange}>
        <SelectTrigger className="w-[calc(50%-0.25rem)] text-[13px] sm:w-48">
          <SelectValue placeholder="任务" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部任务</SelectItem>
          <SelectItem value={UNASSIGNED_TASK}>未关联 / 任务已删除</SelectItem>
          {(tasks ?? []).map((t) => {
            const id = String(t.id);
            const label = t.name || t.description || `任务 #${id}（已删除）`;
            return (
              <SelectItem key={id} value={id}>
                <span className="flex w-full items-center gap-2">
                  <span className="max-w-[14rem] truncate" title={label}>
                    {label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
                    <BugIcon className="size-3.5" aria-hidden="true" />
                    {t.count}
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(v) => onSortChange(v as "severity" | "time")}>
        <SelectTrigger className="w-[calc(50%-0.25rem)] text-[13px] sm:w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="severity">按严重度</SelectItem>
          <SelectItem value="time">按时间</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onClearFilters}>
          <XIcon data-icon="inline-start" />
          重置筛选
        </Button>
      )}

      {/* 计数只在这里出现一次：页头、严重度面板与列表卡片头都不再重复。 */}
      <div className="ml-auto flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        {selectedCount > 0 && (
          <span className="app-chip h-6 tabular-nums">
            已选 <span className="font-semibold text-foreground">{selectedCount}</span> 条
          </span>
        )}
        <span className="tabular-nums whitespace-nowrap">
          共 <span className="font-medium text-foreground">{total}</span> 条
        </span>
      </div>
    </div>
  );
}
