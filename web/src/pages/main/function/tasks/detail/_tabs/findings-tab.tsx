"use client";

import * as React from "react";

import Link from "@/lib/router-compat";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  InboxIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { AsyncState } from "@/components/async-state";
import { SectionCard } from "@/components/app/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { useStoredSortPreference } from "@/lib/sort-preference";
import { statusMeta, toneClasses, toneDot } from "@/lib/status";
import { isTaskNotFoundError } from "@/lib/task-not-found";
import type { Finding, FindingStatus, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

type FindingSortField = "time";

const FINDING_SORT_FIELDS: readonly FindingSortField[] = ["time"];
const FINDING_SORT_PREFERENCE_KEY = "artex_task_findings_sort";

// 严重度从高到低：概览数字既是统计，也是筛选入口。
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

// lib/status.ts 尚未收录的后端状态：直接交给 StatusBadge 会把英文枚举（open /
// retesting）露到界面上，这里补一层中文文案与语义色。
const FALLBACK_STATUS: Record<string, { label: string; tone: "amber" | "blue" }> = {
  open: { label: "待处理", tone: "amber" },
  retesting: { label: "复测中", tone: "blue" },
};

function FindingStatusBadge({ value, dot }: { value: string; dot?: boolean }) {
  const fallback = FALLBACK_STATUS[value];
  if (fallback) {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] leading-none font-semibold whitespace-nowrap",
          toneClasses[fallback.tone],
        )}
      >
        {dot ? <span className={cn("size-1.5 rounded-full", toneDot[fallback.tone])} /> : null}
        {fallback.label}
      </span>
    );
  }
  return <StatusBadge domain="finding" value={value} dot={dot} />;
}

function findingLabel(finding: Finding): string {
  if (finding.name?.trim()) return finding.name;
  if (finding.vulnclass?.trim()) return finding.vulnclass;
  return "未分类";
}

const FINDING_STATUSES: FindingStatus[] = [
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

function Row({
  f,
  contextTaskId,
  onStatus,
}: {
  f: Finding;
  contextTaskId: string;
  onStatus: (f: Finding, next: FindingStatus) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-border/70 last:border-b-0">
      <div className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-muted/60 sm:flex-row sm:items-center sm:gap-3 lg:px-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <ChevronRightIcon
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <StatusBadge domain="severity" value={f.severity} dot />
              <span className="min-w-0 max-w-full truncate text-[13px] font-medium text-foreground">
                {findingLabel(f)}
              </span>
              {f.inherited && f.source_task_id && (
                <Badge variant="outline" className="shrink-0">
                  来源 #{f.source_task_id} · 只读
                </Badge>
              )}
            </div>
            <p className="line-clamp-2 text-[12px] leading-5 text-muted-foreground">{f.summary}</p>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-surface-muted px-2 py-0.5 tabular-nums">
                流量证据 {f.traffic_count ?? 0} 条
              </span>
              {f.assets && f.assets.length > 0 && (
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  {f.assets.slice(0, 2).map((a) => (
                    <code
                      key={a.id}
                      className="max-w-[12rem] truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                      title={`${a.type} · ${a.label}`}
                    >
                      {a.label}
                    </code>
                  ))}
                  {f.assets.length > 2 && <span>+{f.assets.length - 2}</span>}
                </span>
              )}
              <span className="hidden tabular-nums md:inline">{fmtTime(f.ts, "datetime")}</span>
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
          {f.finding_id && !f.inherited ? (
            <Select value={f.status} onValueChange={(v) => onStatus(f, v as FindingStatus)}>
              <SelectTrigger size="sm" className="h-7 w-28 shrink-0 border-none px-1 shadow-none focus-visible:ring-0">
                <FindingStatusBadge value={f.status} dot />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                <SelectGroup>
                  {FINDING_STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {statusMeta("finding", st).label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <FindingStatusBadge value={f.status} dot />
          )}
          {f.finding_id && (
            <Link
              href={
                f.inherited
                  ? `/function/findings/detail?id=${f.finding_id}&context_task=${contextTaskId}`
                  : `/function/findings/detail?id=${f.finding_id}`
              }
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              title="查看漏洞详情"
            >
              详情
              <ArrowUpRightIcon className="size-3" />
            </Link>
          )}
        </div>
      </div>
      {open && (
        <div className="border-t border-border/60 bg-surface-muted/60 px-4 py-3 sm:pl-[3.25rem] lg:px-5 lg:pl-[3.25rem]">
          <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">证据 / PoC</div>
          <pre className="max-h-80 overflow-auto rounded-xl border border-border/70 bg-card p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {f.evidence}
          </pre>
        </div>
      )}
    </div>
  );
}

export function FindingsTab({ taskId }: { taskId: string }) {
  const [findings, setFindings] = React.useState<Finding[]>([]);
  // 首载/失败分开记录:首载用骨架,失败才显示错误卡片,轮询失败保留旧数据。
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<Error | null>(null);
  // 任务已被删除/归档时后端回 404：单独标记，显示明确文案而不是通用「加载失败」。
  const [notFound, setNotFound] = React.useState(false);
  const [sortPreference, setSortPreference] = useStoredSortPreference(
    FINDING_SORT_PREFERENCE_KEY,
    FINDING_SORT_FIELDS,
    "time",
    "desc",
  );
  // 纯前端检索与严重度筛选：默认不筛选，不改变数据来源与轮询。
  const [query, setQuery] = React.useState("");
  const [severity, setSeverity] = React.useState<Severity | "all">("all");
  const searchRef = React.useRef<HTMLInputElement>(null);

  // 请求序号 + taskId 快照：手动重试可能和轮询并发，迟到的旧响应直接丢弃。
  const requestRef = React.useRef(0);
  const taskIdRef = React.useRef(taskId);
  taskIdRef.current = taskId;

  const load = React.useCallback(async () => {
    const request = ++requestRef.current;
    const requestedTaskId = taskId;
    try {
      const fs = await api.findings(requestedTaskId);
      if (requestRef.current !== request || taskIdRef.current !== requestedTaskId) return;
      setFindings(fs);
      setLoadError(null);
      setNotFound(false);
      setLoaded(true);
    } catch (error: unknown) {
      // Keep the last successful snapshot during transient refresh failures.
      if (requestRef.current !== request || taskIdRef.current !== requestedTaskId) return;
      const cause = error instanceof Error ? error : new Error(String(error));
      setLoadError(cause);
      setNotFound(isTaskNotFoundError(cause));
      setLoaded(true);
    }
  }, [taskId]);

  // 切到另一个任务时立即刷新一次；首轮由 usePolling 的「启用即执行」负责。
  const refreshedOnce = React.useRef(false);
  React.useEffect(() => {
    if (!refreshedOnce.current) {
      refreshedOnce.current = true;
      return;
    }
    void load();
  }, [load]);
  usePolling(load, 3000);

  const retry = React.useCallback(() => {
    setLoaded(false);
    setLoadError(null);
    void load();
  }, [load]);

  const onStatus = React.useCallback(async (f: Finding, next: FindingStatus) => {
    if (f.inherited || !f.finding_id || next === f.status) return;
    const prev = f.status;
    setFindings((cur) => cur.map((x) => (x.id === f.id ? { ...x, status: next } : x)));
    try {
      await api.setFindingStatus(f.finding_id, next);
      toast.success(`已标记为「${statusMeta("finding", next).label}」`);
    } catch (e) {
      setFindings((cur) => cur.map((x) => (x.id === f.id ? { ...x, status: prev } : x)));
      toast.error("更新失败：" + (e as Error).message);
    }
  }, []);

  const items = React.useMemo(
    () =>
      findings
        .filter((f) => f.task_id === taskId || f.inherited)
        .sort((a, b) => {
          const compared = Date.parse(a.ts) - Date.parse(b.ts);
          if (compared !== 0) return sortPreference.direction === "asc" ? compared : -compared;
          return b.id.localeCompare(a.id, undefined, { numeric: true });
        }),
    [findings, taskId, sortPreference.direction],
  );

  const counts = React.useMemo(() => {
    const next: Record<string, number> = {};
    for (const f of items) next[f.severity] = (next[f.severity] ?? 0) + 1;
    return next;
  }, [items]);

  const keyword = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    return items.filter((f) => {
      if (severity !== "all" && f.severity !== severity) return false;
      if (!keyword) return true;
      return (
        findingLabel(f).toLowerCase().includes(keyword) ||
        (f.summary ?? "").toLowerCase().includes(keyword) ||
        (f.vulnclass ?? "").toLowerCase().includes(keyword) ||
        (f.assets ?? []).some((a) => a.label.toLowerCase().includes(keyword))
      );
    });
  }, [items, keyword, severity]);

  const hasFilter = severity !== "all" || keyword.length > 0;
  const clearFilters = () => {
    setSeverity("all");
    setQuery("");
    searchRef.current?.focus();
  };

  if (notFound) {
    return (
      <Card className="overflow-hidden py-0">
        <CardContent className="px-0">
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center text-muted-foreground text-sm"
          >
            <span className="grid size-10 place-items-center rounded-md border border-border/70 bg-surface-muted text-muted-foreground/60">
              <InboxIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="text-foreground">任务不存在或已归档</div>
            <p className="text-xs">无法加载该任务的漏洞结果，请确认任务是否仍然存在。</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <SectionCard
      icon={ShieldAlertIcon}
      title="漏洞结果"
      description="本任务及直接关联任务产出的漏洞；点开可查看证据 / PoC。"
      dense
      bodyClassName="px-0 pb-0"
    >
      <div className="grid grid-cols-2 gap-2 border-b border-border/70 px-4 py-3 sm:grid-cols-4 lg:px-5">
        {SEVERITIES.map((sev) => {
          const meta = statusMeta("severity", sev);
          const active = severity === sev;
          return (
            <button
              key={sev}
              type="button"
              aria-pressed={active}
              onClick={() => setSeverity(active ? "all" : sev)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
                active
                  ? "border-primary/30 bg-brand-soft"
                  : "border-border/70 bg-surface-muted/50 hover:border-border hover:bg-surface-muted",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={cn("size-2 shrink-0 rounded-full", toneDot[meta.tone])} />
                <span className="truncate text-[12px] text-muted-foreground">{meta.label}</span>
              </span>
              <span className="text-[18px] leading-6 font-semibold tabular-nums text-foreground">
                {counts[sev] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5 lg:px-5">
        <div className="relative w-full min-w-0 sm:max-w-xs sm:flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索漏洞名称 / 摘要 / 资产"
            aria-label="搜索漏洞"
            className="h-9 pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清除漏洞搜索"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        {severity !== "all" && (
          <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium", toneClasses[statusMeta("severity", severity).tone])}>
            {statusMeta("severity", severity).label}
            <button
              type="button"
              onClick={() => setSeverity("all")}
              aria-label="清除严重度筛选"
              className="opacity-70 hover:opacity-100"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        )}
        <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
          {hasFilter ? `${filtered.length} / ${items.length} 条` : `${items.length} 条`}
        </span>
        <button
          type="button"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-colors hover:border-primary/30 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          aria-label={`发现时间当前${sortPreference.direction === "asc" ? "正序" : "倒序"}，点击切换排序方向`}
          onClick={() =>
            setSortPreference((current) => ({
              field: "time",
              direction: current.direction === "asc" ? "desc" : "asc",
            }))
          }
        >
          <span>发现时间</span>
          {sortPreference.direction === "asc" ? (
            <ArrowUpIcon className="size-3.5" />
          ) : (
            <ArrowDownIcon className="size-3.5" />
          )}
        </button>
      </div>

      {loadError && items.length > 0 && (
        <div
          role="alert"
          className="mx-4 my-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-warning/40 bg-warning/5 px-3 py-2 text-[11px] text-muted-foreground lg:mx-5"
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">刷新漏洞列表失败：{loadError.message}</span>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={retry}>
            重试
          </Button>
        </div>
      )}

      <AsyncState
        status={!loaded ? "loading" : loadError && items.length === 0 ? "error" : "ready"}
        error={loadError}
        onRetry={retry}
        isEmpty={loaded && !loadError && filtered.length === 0}
        empty={
          hasFilter ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <span className="grid size-10 place-items-center rounded-xl border border-border/70 bg-surface-muted text-muted-foreground/60">
                <SearchIcon className="size-5" aria-hidden="true" />
              </span>
              <p className="text-[13px] font-medium text-foreground">没有匹配的漏洞</p>
              <p className="max-w-sm text-[11px] text-muted-foreground">换个关键词，或清除筛选查看全部漏洞结果。</p>
              <Button size="sm" variant="outline" onClick={clearFilters}>
                清除筛选
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <span className="grid size-10 place-items-center rounded-xl border border-border/70 bg-surface-muted text-muted-foreground/60">
                <ShieldCheckIcon className="size-5" aria-hidden="true" />
              </span>
              <p className="text-[13px] font-medium text-foreground">暂无漏洞结果</p>
              <p className="max-w-sm text-[11px] leading-5 text-muted-foreground">
                本任务及直接关联任务暂无确认发现。Agent 确认漏洞后会实时出现在这里。
              </p>
              <Button size="sm" variant="outline" onClick={retry}>
                刷新
              </Button>
            </div>
          )
        }
        className="p-4"
      >
        <div>{filtered.map((f) => <Row key={f.id} f={f} contextTaskId={taskId} onStatus={onStatus} />)}</div>
      </AsyncState>
    </SectionCard>
  );
}
