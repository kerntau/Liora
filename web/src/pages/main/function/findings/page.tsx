"use client";

import * as React from "react";

import { BugIcon, ClockIcon, InfoIcon, ShieldAlertIcon, TriangleAlertIcon } from "lucide-react";

import { FindingRetestDialog } from "@/components/finding-retest-dialog";
import { TablePagination } from "@/components/table-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { toast } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import type {
  ActiveFindingRetest,
  Finding,
  FindingAssetNode,
  FindingGroup,
  FindingStats,
  FindingStatus,
  Severity,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { AssetTreePanel } from "./_components/asset-tree-panel";
import { ExportDialog, type ExportFormat, type ExportScope } from "./_components/export-dialog";
import {
  type FindingRowProps,
  FindingsGroups,
  findingGroupKey,
  type GroupFindingsState,
} from "./_components/findings-groups";
import {
  FINDING_STATUSES,
  type FindingEdit,
  type FindingReport,
  FindingsTable,
  findingRowKey,
  isSameFinding,
  SEVERITIES,
  UNASSIGNED_TASK,
} from "./_components/findings-table";
import { FINDING_VIEWS, FindingsToolbar, FindingsViewTabs, type FindingView } from "./_components/findings-toolbar";

const FINDING_LIST_PREFERENCE_KEY = "artex_finding_list_preferences";

// 资产树的一次性快照。与另外两个视图不同,资产视图不轮询:进入视图、改筛选、
// 或本页改动了发现之后才重新查询。
interface AssetTreeState {
  nodes: FindingAssetNode[];
  findingTotal: number;
  truncated: boolean;
  droppedKinds: string[];
  loaded: boolean;
  loading: boolean;
}

const EMPTY_ASSET_TREE: AssetTreeState = {
  nodes: [],
  findingTotal: 0,
  truncated: false,
  droppedKinds: [],
  loaded: false,
  loading: false,
};

// 平铺视图的页码单独放 state(而非塞进快照),筛选一变就能连带重置并触发重新加载。
interface FlatFindingsState {
  items: Finding[];
  total: number;
  loaded: boolean;
  loading: boolean;
  /** 非轮询触发的刷新(切筛选/翻页/改行)进行中,用于表头细进度条。 */
  pending: boolean;
  /** 首载失败原因;有旧数据时保留旧数据,不把失败当空表。 */
  error: string | null;
}

const EMPTY_FLAT_STATE: FlatFindingsState = {
  items: [],
  total: 0,
  loaded: false,
  loading: false,
  pending: false,
  error: null,
};

const EMPTY_STATS: FindingStats = {
  total: 0,
  pending: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  vulnclasses: [],
  tasks: [],
};

export default function FindingsPage() {
  const [view, setView] = React.useState<FindingView>("flat");
  const [severity, setSeverity] = React.useState<"all" | Severity>("all");
  const [status, setStatus] = React.useState<"all" | FindingStatus>("all");
  const [vulnclass, setVulnclass] = React.useState<string>("all");
  const [task, setTask] = React.useState<string>("all");
  const [sort, setSort] = React.useState<"severity" | "time">("severity");
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [flat, setFlat] = React.useState<FlatFindingsState>(EMPTY_FLAT_STATE);
  const [flatPage, setFlatPage] = React.useState(1);
  const [flatPageSize, setFlatPageSize] = React.useState(20);
  const [assetTree, setAssetTree] = React.useState<AssetTreeState>(EMPTY_ASSET_TREE);
  const [assetScope, setAssetScope] = React.useState<string | null>(null);
  const [groups, setGroups] = React.useState<FindingGroup[]>([]);
  const [groupTotal, setGroupTotal] = React.useState(0);
  const [groupsLoaded, setGroupsLoaded] = React.useState(false);
  const [groupsPending, setGroupsPending] = React.useState(false);
  const [groupsError, setGroupsError] = React.useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(() => new Set());
  const [groupFindings, setGroupFindings] = React.useState<Record<string, GroupFindingsState>>({});
  const [total, setTotal] = React.useState(0);
  const [stats, setStats] = React.useState<FindingStats>(EMPTY_STATS);
  const [statsLoaded, setStatsLoaded] = React.useState(false);
  const [preferencesHydrated, setPreferencesHydrated] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [deepenFinding, setDeepenFinding] = React.useState<Finding | null>(null);
  const [retestFinding, setRetestFinding] = React.useState<Finding | null>(null);
  const [activeRetests, setActiveRetests] = React.useState<Record<string, ActiveFindingRetest>>({});
  const activeRetestFingerprint = Object.values(activeRetests)
    .map((item) => item.id)
    .join(",");
  const retestRefreshVersion = React.useRef(0);
  const [deepenDescription, setDeepenDescription] = React.useState("");
  const [deepening, setDeepening] = React.useState(false);
  const filterFingerprint = JSON.stringify([severity, status, vulnclass, task, sort, query]);
  const activeFilterFingerprint = React.useRef(filterFingerprint);
  activeFilterFingerprint.current = filterFingerprint;

  // 一个轻量请求覆盖所有行/视图，避免逐行拉取完整复测历史；调度交给 usePolling
  // (上一轮没结束就跳过本轮)，请求序号与失败提示仍在这里维护。
  const retestPollFailed = React.useRef(false);
  usePolling(async () => {
    const version = retestRefreshVersion.current;
    try {
      const rows = await api.activeFindingRetests();
      if (version !== retestRefreshVersion.current) return;
      setActiveRetests(Object.fromEntries(rows.map((item) => [item.finding_id, item])));
      retestPollFailed.current = false;
    } catch (error) {
      if (!retestPollFailed.current) toast.error(`加载复测状态失败：${(error as Error).message}`);
      retestPollFailed.current = true;
    }
  }, 3000);

  React.useEffect(() => {
    const raw = getLocalStorageValue(FINDING_LIST_PREFERENCE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          view?: unknown;
          severity?: unknown;
          status?: unknown;
          vulnclass?: unknown;
          task?: unknown;
          sort?: unknown;
        };
        if (FINDING_VIEWS.includes(parsed.view as FindingView)) setView(parsed.view as FindingView);
        if (parsed.severity === "all" || SEVERITIES.includes(parsed.severity as Severity)) {
          setSeverity(parsed.severity as "all" | Severity);
        }
        if (parsed.status === "all" || FINDING_STATUSES.includes(parsed.status as FindingStatus)) {
          setStatus(parsed.status as "all" | FindingStatus);
        }
        if (typeof parsed.vulnclass === "string" && parsed.vulnclass) setVulnclass(parsed.vulnclass);
        if (typeof parsed.task === "string" && parsed.task) setTask(parsed.task);
        if (parsed.sort === "severity" || parsed.sort === "time") setSort(parsed.sort);
      } catch {
        // Ignore malformed or legacy preferences and retain the defaults.
      }
    }
    setPreferencesHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!preferencesHydrated) return;
    setLocalStorageValue(
      FINDING_LIST_PREFERENCE_KEY,
      JSON.stringify({ view, severity, status, vulnclass, task, sort }),
    );
  }, [preferencesHydrated, severity, sort, status, task, view, vulnclass]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // setFindings 同时改写两个视图缓存里的同一条发现,切换视图不会看到过期状态。
  const setFindings = React.useCallback((update: (current: Finding[]) => Finding[]) => {
    setFlat((current) => ({ ...current, items: update(current.items) }));
    setGroupFindings((current) => {
      const next: Record<string, GroupFindingsState> = {};
      for (const [key, state] of Object.entries(current)) {
        next[key] = { ...state, items: update(state.items) };
      }
      return next;
    });
  }, []);

  // 勾选导出:按 finding_id(独立表 id)记选中项,跨页保留。
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  // 导出弹窗状态:范围(当前筛选/全部/选中) × 格式(md 单文件/md 分文件 zip/csv/json)。
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exportScope, setExportScope] = React.useState<ExportScope>("filtered");
  const [exportFormat, setExportFormat] = React.useState<ExportFormat>("md-single");
  const [exporting, setExporting] = React.useState(false);

  const toggleSelected = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectedPage = React.useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  // 打开导出弹窗时,若有勾选项则默认范围切到「选中」,否则「当前筛选」。
  function openExport() {
    setExportScope(selectedIds.size > 0 ? "selected" : "filtered");
    setExportOpen(true);
  }

  async function doExport() {
    setExporting(true);
    try {
      await api.exportFindings({
        format: exportFormat,
        scope: exportScope,
        filters: { severity, status, vulnclass, task, query, sort },
        ids: [...selectedIds],
      });
      setExportOpen(false);
      toast.success("已开始下载导出文件");
    } catch (e) {
      toast.error(`导出失败：${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  const flatRequest = React.useRef(0);
  const assetTreeRequest = React.useRef(0);
  const groupRequests = React.useRef<Record<string, number>>({});
  const groupsRequest = React.useRef(0);
  const flatStateRef = React.useRef(flat);
  // 当前列表数据对应的筛选指纹;筛选切换失败时用来判断是不是「旧筛选的行」。
  const flatFilterRef = React.useRef<string | null>(null);
  const expandedGroupsRef = React.useRef(expandedGroups);
  const groupFindingsRef = React.useRef(groupFindings);
  const visibleGroupKeysRef = React.useRef<Set<string>>(new Set());
  flatStateRef.current = flat;
  expandedGroupsRef.current = expandedGroups;
  groupFindingsRef.current = groupFindings;
  visibleGroupKeysRef.current = new Set(groups.map(findingGroupKey));

  // 资产视图右侧列表 = 平铺列表 + 选中子树的筛选,所以两个视图共用一份列表状态。
  const activeAssetScope = view === "asset" ? assetScope : null;

  // loadFlat 拉取平铺视图的当前页;task 筛选交给后端,与分组视图共用同一批筛选条件。
  // background = 轮询触发:不点亮 pending,也不清掉上一次的错误,避免每 5 秒闪一下。
  const loadFlat = React.useCallback(
    async (background = false) => {
      const requestFilter = filterFingerprint;
      if (activeFilterFingerprint.current !== requestFilter) return;
      const request = ++flatRequest.current;
      setFlat((current) => ({
        ...current,
        loading: true,
        pending: !background,
        // 手动重试先收起错误交给首载骨架;后台轮询保留错误,由用户决定何时重试。
        error: background ? current.error : null,
      }));
      try {
        const result = await api.findingsPage({
          page: flatPage,
          pageSize: flatPageSize,
          severity,
          status,
          vulnclass,
          task,
          query,
          sort,
          assetScope: activeAssetScope ?? undefined,
        });
        if (request !== flatRequest.current || activeFilterFingerprint.current !== requestFilter) return;
        flatFilterRef.current = requestFilter;
        setFlat({
          items: result.items,
          total: result.total,
          loaded: true,
          loading: false,
          pending: false,
          error: null,
        });
      } catch (e) {
        if (request !== flatRequest.current || activeFilterFingerprint.current !== requestFilter) return;
        // 首载失败留成错误态(可重试);同一筛选下的轮询失败保留上一次成功的快照。
        // 换筛选后失败则不能继续展示旧筛选的行,清空并报错,否则失败会被误读成「没有结果」。
        setFlat((current) => {
          const stale = flatFilterRef.current !== requestFilter;
          return {
            ...current,
            items: stale ? [] : current.items,
            total: stale ? 0 : current.total,
            loaded: stale ? false : current.loaded,
            loading: false,
            pending: false,
            error: stale || !current.loaded ? (e as Error).message : current.error,
          };
        });
      }
    },
    [activeAssetScope, filterFingerprint, flatPage, flatPageSize, severity, status, vulnclass, task, query, sort],
  );

  // loadAssetTree 取整棵资产树。树不随选中节点变化(否则选一下就塌成一条链),
  // 所以这里不带 assetScope。
  const loadAssetTree = React.useCallback(async () => {
    const requestFilter = filterFingerprint;
    if (activeFilterFingerprint.current !== requestFilter) return;
    const request = ++assetTreeRequest.current;
    setAssetTree((current) => ({ ...current, loading: true }));
    try {
      const result = await api.findingAssetTree({ severity, status, vulnclass, task, query, sort });
      if (request !== assetTreeRequest.current || activeFilterFingerprint.current !== requestFilter) return;
      setAssetTree({
        nodes: result.nodes ?? [],
        findingTotal: result.finding_total ?? 0,
        truncated: Boolean(result.truncated),
        droppedKinds: result.dropped_kinds ?? [],
        loaded: true,
        loading: false,
      });
    } catch (e) {
      if (request !== assetTreeRequest.current || activeFilterFingerprint.current !== requestFilter) return;
      setAssetTree((current) => ({ ...current, loading: false }));
      toast.error(`资产树加载失败：${(e as Error).message}`);
    }
  }, [filterFingerprint, severity, status, vulnclass, task, query, sort]);

  // background = 轮询触发:不点亮 pending,失败也不清空上一次成功的分组。
  const refreshGroups = React.useCallback(
    async (background = false) => {
      const requestFilter = filterFingerprint;
      if (activeFilterFingerprint.current !== requestFilter) return;
      const request = ++groupsRequest.current;
      if (!background) {
        setGroupsPending(true);
        setGroupsError(null);
      }
      try {
        const result = await api.findingGroups({
          page,
          pageSize,
          severity,
          status,
          vulnclass,
          task,
          query,
          sort,
        });
        if (request !== groupsRequest.current || activeFilterFingerprint.current !== requestFilter) return;
        setGroups(result.items);
        setGroupTotal(result.total);
        setTotal(result.finding_total);
        setGroupsLoaded(true);
        setGroupsError(null);
      } catch (e) {
        if (request !== groupsRequest.current || activeFilterFingerprint.current !== requestFilter) return;
        // 失败要能看出来(而不是变成「没有匹配的发现」);旧分组仍在时只忽略错误。
        setGroupsError((e as Error).message);
      } finally {
        if (request === groupsRequest.current) setGroupsPending(false);
      }
    },
    [filterFingerprint, page, pageSize, severity, status, vulnclass, task, query, sort],
  );

  const loadGroup = React.useCallback(
    async (key: string, groupPage: number, groupPageSize: number, background = false) => {
      const request = (groupRequests.current[key] ?? 0) + 1;
      const requestFilter = filterFingerprint;
      if (activeFilterFingerprint.current !== requestFilter) return;
      groupRequests.current[key] = request;
      setGroupFindings((current) => ({
        ...current,
        [key]: {
          items: current[key]?.items ?? [],
          total: current[key]?.total ?? 0,
          page: groupPage,
          pageSize: groupPageSize,
          loaded: current[key]?.loaded ?? false,
          loading: true,
          pending: !background,
          error: background ? (current[key]?.error ?? null) : null,
        },
      }));
      try {
        const result = await api.findingsPage({
          page: groupPage,
          pageSize: groupPageSize,
          severity,
          status,
          vulnclass,
          task: key,
          query,
          sort,
        });
        if (groupRequests.current[key] !== request || activeFilterFingerprint.current !== requestFilter) return;
        setGroupFindings((current) => ({
          ...current,
          [key]: {
            items: result.items,
            total: result.total,
            page: result.page,
            pageSize: result.page_size,
            loaded: true,
            loading: false,
            pending: false,
            error: null,
          },
        }));
      } catch (e) {
        if (groupRequests.current[key] !== request || activeFilterFingerprint.current !== requestFilter) return;
        setGroupFindings((current) => ({
          ...current,
          [key]: {
            ...(current[key] ?? {
              items: [],
              total: 0,
              page: groupPage,
              pageSize: groupPageSize,
              loaded: false,
            }),
            loading: false,
            pending: false,
            // 失败留成错误态(可重试),不伪装成「没有匹配的发现」。
            error: (e as Error).message,
          },
        }));
      }
    },
    [filterFingerprint, severity, status, vulnclass, query, sort],
  );

  React.useEffect(() => {
    for (const [key, state] of Object.entries(groupFindings)) {
      if (!state.loaded || state.loading) continue;
      const lastPage = Math.max(1, Math.ceil(state.total / state.pageSize));
      if (state.page > lastPage) void loadGroup(key, lastPage, state.pageSize);
    }
  }, [groupFindings, loadGroup]);

  const toggleGroup = React.useCallback(
    (key: string) => {
      const opening = !expandedGroups.has(key);
      const next = new Set(expandedGroups);
      if (opening) next.add(key);
      else next.delete(key);
      setExpandedGroups(next);
      const state = groupFindings[key];
      if (opening && !state?.loaded && !state?.loading) {
        void loadGroup(key, state?.page ?? 1, state?.pageSize ?? 10);
      }
    },
    [expandedGroups, groupFindings, loadGroup],
  );

  // 行内改动后刷新当前视图:平铺视图重拉当前页,分组视图刷组头 + 该发现所在的组。
  const refreshAfterMutation = React.useCallback(
    (finding: Finding, removed = false) => {
      if (view === "asset") {
        // 资产视图不轮询,所以改完要顺带把树的计数也重新算一次。
        void loadFlat();
        void loadAssetTree();
        return;
      }
      if (view === "flat") {
        // 删空最后一页时,页码由越界修正 effect 回退并连带重新加载。
        void loadFlat();
        return;
      }
      void refreshGroups();
      const key = finding.task_id ?? UNASSIGNED_TASK;
      const state = groupFindingsRef.current[key];
      if (state?.loaded) {
        const nextTotal = Math.max(0, state.total - (removed ? 1 : 0));
        const lastPage = Math.max(1, Math.ceil(nextTotal / state.pageSize));
        void loadGroup(key, Math.min(state.page, lastPage), state.pageSize);
      }
    },
    [loadAssetTree, loadFlat, loadGroup, refreshGroups, view],
  );

  // Reset every view's pagination and expansion when a shared finding filter changes.
  React.useEffect(() => {
    void filterFingerprint;
    setPage(1);
    setExpanded(null);
    setExpandedGroups(new Set());
    setGroupFindings({});
    setFlatPage(1);
    // 保留上一批行直到新筛选返回,由表头细进度条提示刷新中,不再整表退回首载 Spinner。
    // 筛选变了树也会变,原先选中的节点可能已经不在树里,退回「全部资产」。
    setAssetScope(null);
    setAssetTree(EMPTY_ASSET_TREE);
  }, [filterFingerprint]);

  // 换资产节点等于换了一份结果集,回到第一页。
  React.useEffect(() => {
    void assetScope;
    setFlatPage(1);
  }, [assetScope]);

  // 资产树只在进入视图 / 筛选变化时查一次(以及本页改动发现后由
  // refreshAfterMutation 主动重拉),不做轮询。
  React.useEffect(() => {
    if (!preferencesHydrated || view !== "asset") return;
    void activeRetestFingerprint; // 复测结束可能改变状态筛选下的资产计数。
    void loadAssetTree();
  }, [activeRetestFingerprint, loadAssetTree, preferencesHydrated, view]);

  // 只刷新当前视图:平铺视图刷当前页,分组视图刷组头与每个已展开的组(其分页彼此独立)。
  // background = 定时轮询:不点亮 pending 进度条,避免每 5 秒闪一次。
  const refresh = React.useCallback(
    (background = false) => {
      if (view === "flat" || view === "asset") {
        // 前台刷新(切筛选/翻页)不能被在途的轮询挡住,否则新筛选要等下一个轮询周期。
        if (background && flatStateRef.current.loading) return;
        void loadFlat(background);
        return;
      }
      void refreshGroups(background);
      for (const key of expandedGroupsRef.current) {
        if (!visibleGroupKeysRef.current.has(key)) continue;
        const state = groupFindingsRef.current[key];
        if (state?.loaded && !state.loading) void loadGroup(key, state.page, state.pageSize, background);
      }
    },
    [loadFlat, loadGroup, refreshGroups, view],
  );

  // 视图/筛选/翻页变化时立即前台刷新一次。首轮由 usePolling 的「启用即执行」负责,
  // 这里跳过第一次,避免水合时连发两个请求。
  const refreshedOnce = React.useRef(false);
  React.useEffect(() => {
    if (!preferencesHydrated) return;
    void activeRetestFingerprint; // 包括不定时轮询的资产视图，也在复测结束后刷新处置状态。
    if (!refreshedOnce.current) {
      refreshedOnce.current = true;
      return;
    }
    refresh();
  }, [activeRetestFingerprint, preferencesHydrated, refresh]);

  // 定时轮询当前视图(5s):首跑按前台处理,之后按后台;资产视图的左树是导航结构,
  // 没必要每 5 秒重算,所以 tick 直接返回,只在进入视图/筛选变化时查一次。
  const firstPollRun = React.useRef(true);
  const pollCurrentView = React.useCallback(() => {
    const first = firstPollRun.current;
    firstPollRun.current = false;
    if (first) {
      refresh();
      return;
    }
    if (view === "asset") return;
    refresh(true);
  }, [refresh, view]);
  usePolling(pollCurrentView, 5000, { enabled: preferencesHydrated });

  React.useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(groupTotal / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [groupTotal, page, pageSize]);

  React.useEffect(() => {
    if (!flat.loaded) return;
    const lastPage = Math.max(1, Math.ceil(flat.total / flatPageSize));
    if (flatPage > lastPage) setFlatPage(lastPage);
  }, [flat.loaded, flat.total, flatPage, flatPageSize]);

  // Whole-table aggregates (stat cards + vuln-class options) — independent of the
  // current page, so they stay exact.
  usePolling(
    () =>
      api
        .findingStats()
        .then((snapshot) => {
          setStats(snapshot);
          setStatsLoaded(true);
        })
        .catch(() => {
          // Keep the previous aggregate snapshot until the next poll.
        }),
    5000,
  );

  React.useEffect(() => {
    if (!statsLoaded) return;
    if (vulnclass !== "all" && !stats.vulnclasses.includes(vulnclass)) setVulnclass("all");
    if (
      task !== "all" &&
      task !== UNASSIGNED_TASK &&
      !(stats.tasks ?? []).some((option) => String(option.id) === task)
    ) {
      setTask("all");
    }
  }, [stats, statsLoaded, task, vulnclass]);

  // updateStatus optimistically flips one finding's triage state, reverting on error.
  const updateStatus = React.useCallback(
    async (f: Finding, next: FindingStatus) => {
      if (!f.finding_id || next === f.status) return;
      const prev = f.status;
      setFindings((cur) => cur.map((x) => (isSameFinding(x, f) ? { ...x, status: next } : x)));
      try {
        await api.setFindingStatus(f.finding_id, next);
        // 行内状态已乐观更新,不再弹成功提示,避免同一结果双重反馈。
        // refresh stat cards (pending count) and drop the row if it no longer matches the status filter
        api
          .findingStats()
          .then(setStats)
          .catch(() => {
            // The row update remains valid even if the aggregate refresh fails.
          });
        if (status !== "all" && next !== status) {
          setFindings((cur) => cur.filter((x) => !isSameFinding(x, f)));
          setTotal((t) => Math.max(0, t - 1));
          setFlat((cur) => ({ ...cur, total: Math.max(0, cur.total - 1) }));
        }
        refreshAfterMutation(f);
      } catch (e) {
        setFindings((cur) => cur.map((x) => (isSameFinding(x, f) ? { ...x, status: prev } : x)));
        toast.error(`更新失败：${(e as Error).message}`);
      }
    },
    [refreshAfterMutation, setFindings, status],
  );

  // 行内展开的详细报告缓存按全局稳定行键存。report 是大段 Markdown,列表查询不带它,
  // 故展开时才按 finding_id 单独拉取一次;done 且文本为空 = 该漏洞暂无报告。
  const [reports, setReports] = React.useState<Record<string, FindingReport>>({});

  // 行内可编辑缓冲:当前展开行的名称/类别/严重等级,展开时用该行数据初始化,收起清空。
  // 单行展开,故一份缓冲即可。
  const [edit, setEdit] = React.useState<FindingEdit | null>(null);
  const [saving, setSaving] = React.useState(false);

  // toggle 展开/收起一行;新展开时初始化编辑缓冲,并(尚未取过时)按 finding_id 拉一次报告缓存。
  const toggleRow = React.useCallback(
    (f: Finding) => {
      const key = findingRowKey(f);
      const willOpen = expanded !== key;
      setExpanded(willOpen ? key : null);
      if (!willOpen) {
        setEdit(null);
        return;
      }
      setEdit({ name: f.name ?? "", vulnclass: f.vulnclass, severity: f.severity });
      if (!f.finding_id || reports[key]) return;
      const fid = f.finding_id;
      setReports((r) => ({ ...r, [key]: { status: "loading", text: "" } }));
      api
        .getFinding(fid)
        .then((full) => setReports((r) => ({ ...r, [key]: { status: "done", text: full.report ?? "" } })))
        .catch(() => setReports((r) => ({ ...r, [key]: { status: "error", text: "" } })));
    },
    [expanded, reports],
  );

  // saveEdit 保存当前展开行的名称/类别/严重等级,回写本地列表并刷新统计(类别下拉/严重计数可能变)。
  const saveEdit = React.useCallback(
    async (f: Finding) => {
      if (!f.finding_id || !edit) return;
      setSaving(true);
      try {
        const updated = await api.updateFinding(f.finding_id, {
          name: edit.name.trim(),
          vulnclass: edit.vulnclass.trim(),
          severity: edit.severity,
        });
        setFindings((cur) =>
          cur.map((x) =>
            isSameFinding(x, f)
              ? { ...x, name: updated.name, vulnclass: updated.vulnclass, severity: updated.severity }
              : x,
          ),
        );
        toast.success("已保存");
        api
          .findingStats()
          .then(setStats)
          .catch(() => {
            // The edit remains valid even if the aggregate refresh fails.
          });
        refreshAfterMutation(f);
      } catch (e) {
        toast.error(`保存失败：${(e as Error).message}`);
      } finally {
        setSaving(false);
      }
    },
    [edit, refreshAfterMutation, setFindings],
  );

  // deleteFinding 删除一个漏洞(需二次确认):删成功后从列表移除、收起行、刷新统计。
  const deleteFinding = React.useCallback(
    async (f: Finding) => {
      if (!f.finding_id) return;
      try {
        await api.deleteFinding(f.finding_id);
        setFindings((cur) => cur.filter((x) => !isSameFinding(x, f)));
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(f.finding_id as string);
          return next;
        });
        setTotal((t) => Math.max(0, t - 1));
        setFlat((cur) => ({ ...cur, total: Math.max(0, cur.total - 1) }));
        const rowKey = findingRowKey(f);
        setExpanded((cur) => (cur === rowKey ? null : cur));
        toast.success("已删除漏洞");
        api
          .findingStats()
          .then(setStats)
          .catch(() => {
            // The deletion remains valid even if the aggregate refresh fails.
          });
        refreshAfterMutation(f, true);
      } catch (e) {
        toast.error(`删除失败：${(e as Error).message}`);
      }
    },
    [refreshAfterMutation, setFindings],
  );

  const openDeepen = React.useCallback((f: Finding) => {
    setDeepenFinding(f);
    setDeepenDescription("");
  }, []);

  async function submitDeepen() {
    if (!deepenFinding?.finding_id || !deepenDescription.trim() || deepening) return;
    setDeepening(true);
    try {
      const result = await api.deepenFinding(deepenFinding.finding_id, deepenDescription.trim());
      toast.success(
        result.queued
          ? `深入意图 #${result.intent_id} 已进入任务队列`
          : `已创建高优先级 Worker 意图 #${result.intent_id}`,
      );
      refreshAfterMutation(deepenFinding);
      setDeepenFinding(null);
      setDeepenDescription("");
    } catch (error) {
      toast.error(`提交失败：${(error as Error).message}`);
    } finally {
      setDeepening(false);
    }
  }

  const statCards = [
    { label: "发现总数", value: stats.total, icon: BugIcon },
    { label: "待处理", value: stats.pending, tone: "text-amber-500", icon: ClockIcon },
    { label: "严重", value: stats.critical, tone: "text-rose-600", icon: ShieldAlertIcon },
    { label: "高危", value: stats.high, tone: "text-red-500", icon: TriangleAlertIcon },
    { label: "中危", value: stats.medium, tone: "text-amber-500", icon: TriangleAlertIcon },
    { label: "低危", value: stats.low, tone: "text-slate-500", icon: InfoIcon },
  ];

  // 导出弹窗里「当前筛选」的条数:两个视图的筛选一致,只是统计口径来源不同。
  // 平铺与资产视图共用 flat 列表状态,分组视图的口径来自组接口的 finding_total。
  const filteredTotal = view === "grouped" ? total : flat.total;
  // 空表要区分「本来没有发现」和「筛选没命中」,后者给一键清除筛选。
  const hasFilters = severity !== "all" || status !== "all" || vulnclass !== "all" || task !== "all" || query !== "";
  const clearFilters = React.useCallback(() => {
    setSeverity("all");
    setStatus("all");
    setVulnclass("all");
    setTask("all");
    setSearch("");
    setQuery("");
  }, []);
  const rowProps: FindingRowProps = {
    selectedIds,
    onToggleSelected: toggleSelected,
    onToggleSelectedPage: toggleSelectedPage,
    expandedKey: expanded,
    onToggleRow: toggleRow,
    reports,
    edit,
    onEditChange: setEdit,
    saving,
    onSave: saveEdit,
    onStatusChange: updateStatus,
    onRetest: setRetestFinding,
    activeRetests,
    onDeepen: openDeepen,
    onDelete: deleteFinding,
  };

  // 平铺视图与资产视图右侧是同一张表 + 同一份分页,只是筛选条件不同。
  const flatListCard = (
    <Card className="gap-0 py-0">
      <CardContent className="relative px-0">
        {/* 非首载刷新(切筛选/翻页/改行)只在表头压一条细进度条,不遮挡已加载的行。 */}
        {flat.pending && flat.loaded && (
          <div
            role="status"
            aria-label="正在更新列表"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-primary/60"
          />
        )}
        {!flat.loaded && !flat.error ? (
          <div className="flex min-h-36 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <FindingsTable
              items={flat.items}
              selectAllLabel="选择当前页全部"
              error={flat.error}
              onRetry={() => void loadFlat()}
              hasFilters={hasFilters}
              onClearFilters={clearFilters}
              {...rowProps}
            />
            {/* 加载失败时不给「共 0 条」的分页,避免和错误态互相矛盾。 */}
            {!(flat.error && flat.items.length === 0) && (
              <TablePagination
                page={flatPage}
                pageSize={flatPageSize}
                total={flat.total}
                onPageChange={setFlatPage}
                onPageSizeChange={(nextSize) => {
                  setFlatPageSize(nextSize);
                  setFlatPage(1);
                }}
                pageSizeOptions={[10, 20, 50, 100]}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">发现</h1>
          <p className="text-muted-foreground text-sm">跨任务漏洞汇总</p>
        </div>
        <FindingsViewTabs view={view} onViewChange={setView} />
      </div>
      <div className="flex flex-1 flex-col gap-4 md:gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <Card key={stat.label} className="gap-1 py-4">
                <CardHeader className="px-4">
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className={cn("flex items-center gap-2 text-2xl tabular-nums", stat.tone)}>
                    <StatIcon className="size-5" aria-hidden="true" />
                    {stat.value}
                  </CardTitle>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <FindingsToolbar
          search={search}
          onSearchChange={setSearch}
          severity={severity}
          onSeverityChange={setSeverity}
          status={status}
          onStatusChange={setStatus}
          vulnclass={vulnclass}
          onVulnclassChange={setVulnclass}
          task={task}
          onTaskChange={setTask}
          sort={sort}
          onSortChange={setSort}
          vulnclasses={stats.vulnclasses}
          tasks={stats.tasks}
          selectedCount={selectedIds.size}
          onExport={openExport}
        />

        {view === "flat" && flatListCard}

        {view === "asset" && (
          <AssetTreePanel
            nodes={assetTree.nodes}
            scope={assetScope}
            onScopeChange={setAssetScope}
            loaded={assetTree.loaded}
            loading={assetTree.loading}
            truncated={assetTree.truncated}
            droppedKinds={assetTree.droppedKinds}
            findingTotal={assetTree.findingTotal}
            onRefresh={() => void loadAssetTree()}
            total={flat.total}
          >
            {flatListCard}
          </AssetTreePanel>
        )}

        {view === "grouped" && (
          <FindingsGroups
            groups={groups}
            groupTotal={groupTotal}
            groupsLoaded={groupsLoaded}
            groupsPending={groupsPending}
            groupsError={groupsError}
            expandedGroups={expandedGroups}
            groupFindings={groupFindings}
            page={page}
            pageSize={pageSize}
            hasFilters={hasFilters}
            rowProps={rowProps}
            onToggleGroup={toggleGroup}
            onLoadGroup={loadGroup}
            onRefreshGroups={() => void refreshGroups()}
            onClearFilters={clearFilters}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {retestFinding?.finding_id ? (
        <FindingRetestDialog
          key={retestFinding.finding_id}
          findingId={retestFinding.finding_id}
          findingName={retestFinding.name || retestFinding.vulnclass || retestFinding.summary}
          onStarted={(retest) => {
            const findingId = retestFinding.finding_id;
            if (!findingId || retest.conversation_id == null || !["pending", "running"].includes(retest.status)) return;
            retestRefreshVersion.current++;
            const active: ActiveFindingRetest = {
              id: retest.id,
              finding_id: findingId,
              conversation_id: retest.conversation_id,
              status: retest.status === "pending" ? "pending" : "running",
            };
            setActiveRetests((current) => ({ ...current, [findingId]: active }));
          }}
          onClose={() => setRetestFinding(null)}
        />
      ) : null}

      <Dialog
        open={deepenFinding !== null}
        onOpenChange={(open) => {
          if (open || deepening) return;
          setDeepenFinding(null);
          setDeepenDescription("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>深入利用漏洞</DialogTitle>
            <DialogDescription className="break-words">
              将在原任务 #{deepenFinding?.task_id} 中创建优先级 10 的 Worker 意图，基于当前漏洞开展二次验证：
              {deepenFinding?.name || deepenFinding?.vulnclass || deepenFinding?.summary}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="finding-deepen-description">利用描述</FieldLabel>
              <Textarea
                id="finding-deepen-description"
                value={deepenDescription}
                onChange={(event) => setDeepenDescription(event.target.value)}
                maxLength={4000}
                placeholder="描述需要验证的利用路径、边界条件、目标或期望证据"
                disabled={deepening}
              />
              <FieldDescription className="flex justify-between gap-3">
                <span>新意图会继承该漏洞的资产锚点。</span>
                <span className="shrink-0 tabular-nums">{deepenDescription.length} / 4000</span>
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeepenFinding(null);
                setDeepenDescription("");
              }}
              disabled={deepening}
            >
              取消
            </Button>
            <Button onClick={submitDeepen} disabled={deepening || !deepenDescription.trim()}>
              {deepening && <Spinner data-icon="inline-start" />}
              创建深入意图
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        scope={exportScope}
        onScopeChange={setExportScope}
        format={exportFormat}
        onFormatChange={setExportFormat}
        filteredTotal={filteredTotal}
        selectedCount={selectedIds.size}
        exporting={exporting}
        onExport={doExport}
      />
    </div>
  );
}
