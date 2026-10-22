"use client";

import * as React from "react";

import {
  BuildingIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayersIcon,
  LayoutTemplateIcon,
  LinkIcon,
  type LucideIcon,
  NetworkIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { PageHeader } from "@/components/app/page-header";
import { Chips, MethodBadge, PAGE_SIZES, statusTone } from "@/components/asset-cells";
import { TablePagination } from "@/components/table-pagination";
import { AssetDslSearch } from "@/components/asset-dsl-search";
import { AsyncState } from "@/components/async-state";
import { ScopeTextEditor } from "@/components/scope-text-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { parseCompanyScopeText } from "@/lib/company-scope";
import type { Asset, Company, CompanyScopeRule } from "@/lib/types";
import { cn } from "@/lib/utils";

// 每种资产一种颜色的小图标块：左树、列表卡片头、空态复用同一份映射，
// 与「漏洞结果 · 按资产」树里的类型色保持一致。
interface AssetTypeMeta {
  key: string;
  label: string;
  icon: LucideIcon;
  tile: string;
  description: string;
}

const TABS: AssetTypeMeta[] = [
  {
    key: "company",
    label: "企业",
    icon: BuildingIcon,
    tile: "bg-primary/10 text-primary",
    description: "组织主体与授权资产范围。",
  },
  {
    key: "root_domain",
    label: "根域名",
    icon: GlobeIcon,
    tile: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    description: "已收录的主域名与 ICP 备案。",
  },
  {
    key: "ip",
    label: "IP",
    icon: NetworkIcon,
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    description: "C 段、绑定域名与开放端口。",
  },
  {
    key: "subdomain",
    label: "子域名",
    icon: GlobeIcon,
    tile: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    description: "DNS 解析记录与所属根域名。",
  },
  {
    key: "app",
    label: "应用",
    icon: SmartphoneIcon,
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    description: "移动端应用与 Bundle ID。",
  },
  {
    key: "service",
    label: "服务",
    icon: LayoutTemplateIcon,
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    description: "端口服务、指纹与页面标题。",
  },
  {
    key: "endpoint",
    label: "接口",
    icon: LinkIcon,
    tile: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    description: "已发现的 API 与请求参数。",
  },
];

const TAB_BY_KEY = new Map(TABS.map((item) => [item.key, item]));

// 左栏按资产大类排序（组织 → 域名 → 网络 → 应用）。7 个类型一屏读完，
// 不再插组标题：那会让左栏比右侧内容高出一大截，且组标题与页签名重复。
const TAB_ORDER = ["company", "root_domain", "subdomain", "ip", "app", "service", "endpoint"];

export default function AssetsPage() {
  const [rows, setRows] = React.useState<Asset[]>([]);
  const [total, setTotal] = React.useState(0);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [tab, setTab] = React.useState("company");
  const [query, setQuery] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(50);
  const [dslError, setDslError] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const assetsRequestRef = React.useRef(0);
  const [rowsTab, setRowsTab] = React.useState("");

  // asset selection & delete
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [deleteIds, setDeleteIds] = React.useState<number[]>([]);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // company delete
  const [companyDeleteTarget, setCompanyDeleteTarget] = React.useState<Company | null>(null);
  const [companyDeleteAssets, setCompanyDeleteAssets] = React.useState(false);
  const [companyDeleting, setCompanyDeleting] = React.useState(false);

  // Companies + per-type counts (tab badges) — loaded on demand, no background polling.
  // 企业列表失败时保留上一份快照,错误交给「企业」页签内的错误卡片/重试。
  const [metaError, setMetaError] = React.useState<Error | null>(null);
  const [metaLoaded, setMetaLoaded] = React.useState(false);
  const loadMeta = React.useCallback(() => {
    api
      .companies()
      .then((next) => {
        setCompanies(next);
        setMetaError(null);
      })
      .catch((error: unknown) => {
        setMetaError(error instanceof Error ? error : new Error(String(error)));
      })
      .finally(() => setMetaLoaded(true));
    api
      .assetCounts()
      .then(setCounts)
      .catch(() => {
        /* Keep the last successful counters on a transient failure. */
      });
  }, []);

  // First load: the organization tab is the natural home, but a fresh install has
  // no companies while assets already exist. In that case open the first
  // populated type instead of showing an empty table.
  const autoPickedTab = React.useRef(false);
  React.useEffect(() => {
    if (autoPickedTab.current || !metaLoaded || Object.keys(counts).length === 0) return;
    autoPickedTab.current = true;
    if (tab === "company" && companies.length === 0 && (counts.root_domain ?? 0) > 0) {
      setTab("root_domain");
    }
  }, [metaLoaded, companies.length, counts, tab]);

  // Manual refresh: reload counts/companies and re-fetch the current page.
  const refresh = React.useCallback(() => {
    loadMeta();
    setRefreshKey((k) => k + 1);
    setSelected(new Set());
  }, [loadMeta]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: number[]) => {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => {
          next.delete(id);
        });
      } else {
        ids.forEach((id) => {
          next.add(id);
        });
      }
      return next;
    });
  };

  const openDelete = (ids: number[]) => {
    setDeleteIds(ids);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.deleteAssets(deleteIds);
      toast.success(`已删除 ${res.deleted} 条资产`);
      setSelected(new Set());
      refresh();
    } catch (e) {
      toast.error("删除失败：" + String((e as Error)?.message ?? e));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const confirmDeleteCompany = async () => {
    if (!companyDeleteTarget) return;
    setCompanyDeleting(true);
    try {
      const res = await api.deleteCompany(companyDeleteTarget.id, companyDeleteAssets);
      const msg =
        companyDeleteAssets && res.assets_deleted > 0
          ? `已删除企业，同时删除 ${res.assets_deleted} 条资产`
          : "已删除企业";
      toast.success(msg);
      refresh();
    } catch (e) {
      toast.error("删除失败：" + String((e as Error)?.message ?? e));
    } finally {
      setCompanyDeleting(false);
      setCompanyDeleteTarget(null);
      setCompanyDeleteAssets(false);
    }
  };

  React.useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  // Reset query + page + selection when switching tabs
  // biome-ignore lint/correctness/useExhaustiveDependencies: tab changes intentionally reset tab-local controls.
  React.useEffect(() => {
    setQuery("");
    setDslError("");
    setSelected(new Set());
    setRows([]);
    setRowsTab("");
    setTotal(0);
    setLoaded(false);
    // 切到「企业」时下面的加载 effect 会提前 return，不在这里复位 loading 会永久卡住刷新按钮。
    setLoading(false);
  }, [tab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: these controls intentionally reset server pagination.
  React.useEffect(() => setPage(0), [tab, size, query]);

  const dslMode = query.trim() !== "";

  // Server-side paginated page loader for the active data tab (company tab excluded).
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an explicit manual-reload trigger.
  React.useEffect(() => {
    if (tab === "company") return;
    const request = ++assetsRequestRef.current;
    const dsl = query.trim();
    const offset = page * size;
    const run = async () => {
      // 防抖等待期间不算加载中，避免输入时刷新按钮一直转。
      setLoading(true);
      try {
        const r = dsl ? await api.searchAssets(dsl, tab, size, offset) : await api.assets(tab, size, offset);
        if (assetsRequestRef.current !== request) return;
        setRows(r.assets);
        setRowsTab(tab);
        setTotal(r.total);
        setDslError("");
      } catch (e) {
        if (assetsRequestRef.current !== request) return;
        setDslError(String((e as Error)?.message ?? e));
        setRows([]);
        setRowsTab(tab);
        setTotal(0);
      } finally {
        if (assetsRequestRef.current === request) {
          setLoading(false);
          setLoaded(true);
        }
      }
    };
    const tid = setTimeout(run, dsl ? 400 : 0);
    return () => {
      clearTimeout(tid);
      if (assetsRequestRef.current === request) assetsRequestRef.current++;
    };
  }, [tab, page, size, query, refreshKey]);

  React.useEffect(() => {
    if (tab === "company") return;
    const lastPage = Math.max(0, Math.ceil(total / size) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [page, size, tab, total]);

  const companyById = React.useMemo(() => {
    const m = new Map<number, string>();
    for (const c of companies) m.set(c.id, c.name);
    return m;
  }, [companies]);

  const companyName = (id?: number) => (id ? (companyById.get(id) ?? "") : "");

  const tabCounts: Record<string, number> = { ...counts, company: companies.length };
  const totalAssets = Object.values(counts).reduce((a, b) => a + b, 0);

  // rows are already the current server-side page.
  const tabData = (type: string): Asset[] => (rowsTab === type ? rows : []);
  const currentRows = tabData(tab);
  // 切 tab 后的这一帧 rowsTab 仍是旧值：按未加载渲染骨架，不闪「暂无数据」。
  const tabLoaded = loaded && rowsTab === tab;
  const slice = <T,>(list: T[]) => list;

  const searchBox = (
    <AssetDslSearch
      query={query}
      onChange={setQuery}
      loading={loading}
      error={dslError}
      count={dslMode ? total : undefined}
    />
  );

  const cardStateProps = { error: dslError, loading, onRetry: refresh };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={NetworkIcon}
        title="测试资产"
        description="统一管理授权范围内的企业、域名、IP、应用与接口；按类型浏览，或用 DSL 精确检索后批量清理。"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading} aria-label="刷新资产列表">
              <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} /> 刷新
            </Button>
            <CompanyDialog onSaved={refresh} />
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={setTab}
        orientation="vertical"
        className="flex flex-col gap-5 lg:flex-row lg:items-start"
      >
        <Card className="gap-0 shrink-0 overflow-hidden py-0 lg:sticky lg:top-20 lg:w-60 xl:w-64">
          <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3">
            <div className="flex min-w-0 items-start gap-2">
              <LayersIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-foreground text-[13px] leading-5 font-semibold">资产分类</h2>
                <p className="text-muted-foreground mt-0.5 truncate text-[12px] leading-5 tabular-nums">
                  共 {totalAssets} 项资产
                </p>
              </div>
            </div>
          </div>
          <div className="px-3 pb-4">
            <TabsList className="bg-surface-muted/70 w-full! flex-row! items-stretch justify-start gap-0.5 overflow-x-auto rounded-lg border-0 p-1 lg:flex-col! lg:overflow-visible">
              {TAB_ORDER.map((key) => {
                const item = TAB_BY_KEY.get(key);
                if (!item) return null;
                const Icon = item.icon;
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="h-8 w-auto! flex-none! justify-start gap-2 rounded-md px-2 text-[13px] lg:w-full!"
                  >
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded-md", item.tile)}>
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="whitespace-nowrap">{item.label}</span>
                    {/* 计数统一成裸数字：选中项与未选中项同一字号、同一颜色、同一对齐。 */}
                    <span className="text-muted-foreground ml-auto text-[11px] font-medium tabular-nums">
                      {tabCounts[key] ?? 0}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </Card>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* 企业 */}
          <TabsContent value="company" className="mt-0 flex flex-col gap-5">
            <Card className="flex flex-col gap-0 overflow-hidden py-0">
              <AssetCardHead
                icon={BuildingIcon}
                title="企业"
                description="组织主体与授权资产范围。"
                actions={
                  <span className="app-chip shrink-0 tabular-nums">
                    共 <span className="text-foreground font-medium">{companies.length}</span> 家
                  </span>
                }
              />
              <AsyncState
                status={!metaLoaded ? "loading" : metaError && companies.length === 0 ? "error" : "ready"}
                error={metaError}
                onRetry={loadMeta}
                className="mx-5 mb-5"
              >
                <div className="px-5 pb-5">
                  {metaError && companies.length > 0 && (
                    <div
                      role="alert"
                      className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                    >
                      <span className="min-w-0 [overflow-wrap:anywhere]">刷新企业列表失败：{metaError.message}</span>
                      <Button size="sm" variant="outline" onClick={loadMeta}>
                        重试
                      </Button>
                    </div>
                  )}
                  <div className="border-border/60 max-h-[60vh] min-h-[10rem] overflow-auto rounded-lg border">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow>
                          <TableHead>企业</TableHead>
                          <TableHead className="w-24 text-right">资产数</TableHead>
                          <TableHead>资产范围</TableHead>
                          <TableHead className="w-36 text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companies.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CompanyAvatar name={c.name} logo={c.logo} />
                                <span className="font-medium">{c.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-[13px]">{c.asset_count}</TableCell>
                            <TableCell>
                              {c.scope?.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {c.scope.map((s, i) => (
                                    <Badge key={i} variant="secondary" className="font-mono text-[11px]">
                                      {s.raw}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">未设置范围</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <EditScopeDialog company={c} onSaved={refresh} />
                                <AppendScopeDialog company={c} onSaved={refresh} />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    setCompanyDeleteTarget(c);
                                    setCompanyDeleteAssets(false);
                                  }}
                                  aria-label={`删除企业 ${c.name}`}
                                >
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {metaLoaded && !metaError && companies.length === 0 && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={4} className="p-0 text-center whitespace-normal">
                              <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-6 text-center">
                                <BuildingIcon className="text-muted-foreground/60 size-6" aria-hidden="true" />
                                <p className="text-foreground text-[13px] font-semibold">还没有企业</p>
                                <p className="text-muted-foreground max-w-md text-[12px] leading-5">
                                  点击右上角「新增企业」并填写资产范围，系统会自动认领命中的资产。
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </AsyncState>
            </Card>
          </TabsContent>

          {/* 根域名 */}
          <TabsContent value="root_domain" className="mt-0 flex flex-col gap-3">
            <AssetCard
              {...cardStateProps}
              typeKey="root_domain"
              search={searchBox}
              onDeleteSelected={openDelete}
              cols={["", "域名", "ICP 备案", "归属企业", "操作"]}
              loaded={tabLoaded}
              total={total}
              page={page}
              size={size}
              onSize={setSize}
              onPage={setPage}
              rows={currentRows}
              selected={selected}
              onToggleAll={(ids) => toggleSelectAll(ids)}
            >
              {slice(tabData("root_domain")).map((a) => (
                <TableRow key={a.id} className={selected.has(a.id) ? "bg-muted/40" : undefined}>
                  <TableCell className="w-8 pr-0">
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      aria-label={`选择资产 ${a.domain || a.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[13px] font-medium">{a.domain}</TableCell>
                  <TableCell className="text-[13px]">{a.icp || "—"}</TableCell>
                  <TableCell className="text-[13px]">
                    {companyName(a.company_id) || <span className="text-muted-foreground">未归属</span>}
                  </TableCell>
                  <TableCell className="w-8 pl-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => openDelete([a.id])}
                      aria-label={`删除资产 ${a.domain || a.id}`}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </TabsContent>

          {/* IP */}
          <TabsContent value="ip" className="mt-0 flex flex-col gap-3">
            <AssetCard
              {...cardStateProps}
              typeKey="ip"
              search={searchBox}
              onDeleteSelected={openDelete}
              cols={["", "IP", "C段", "绑定域名", "开放端口", "操作"]}
              loaded={tabLoaded}
              total={total}
              page={page}
              size={size}
              onSize={setSize}
              onPage={setPage}
              rows={currentRows}
              selected={selected}
              onToggleAll={(ids) => toggleSelectAll(ids)}
            >
              {slice(tabData("ip")).map((a) => (
                <TableRow key={a.id} className={selected.has(a.id) ? "bg-muted/40" : undefined}>
                  <TableCell className="w-8 pr-0">
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      aria-label={`选择资产 ${a.ip || a.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[13px] font-medium">{a.ip}</TableCell>
                  <TableCell className="font-mono text-[13px]">{a.c_segment || "—"}</TableCell>
                  <TableCell>
                    <Chips items={a.bound_domains ?? []} mono dense />
                  </TableCell>
                  <TableCell>
                    <Chips
                      items={(a.open_ports ?? []).map((p) => (p.service ? `${p.port}/${p.service}` : String(p.port)))}
                      mono
                      dense
                    />
                  </TableCell>
                  <TableCell className="w-8 pl-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => openDelete([a.id])}
                      aria-label={`删除资产 ${a.ip || a.id}`}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </TabsContent>

          {/* 子域名 */}
          <TabsContent value="subdomain" className="mt-0 flex flex-col gap-3">
            <AssetCard
              {...cardStateProps}
              typeKey="subdomain"
              search={searchBox}
              onDeleteSelected={openDelete}
              cols={["", "域名", "根域名", "解析类型", "解析值", "操作"]}
              loaded={tabLoaded}
              total={total}
              page={page}
              size={size}
              onSize={setSize}
              onPage={setPage}
              rows={currentRows}
              selected={selected}
              onToggleAll={(ids) => toggleSelectAll(ids)}
            >
              {slice(tabData("subdomain")).map((a) => (
                <TableRow key={a.id} className={selected.has(a.id) ? "bg-muted/40" : undefined}>
                  <TableCell className="w-8 pr-0">
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      aria-label={`选择资产 ${a.domain || a.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[13px] font-medium">{a.domain}</TableCell>
                  <TableCell className="font-mono text-[13px]">{a.root_domain || "—"}</TableCell>
                  <TableCell className="text-[13px]">{a.record_type || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-[13px]">
                    {(Array.isArray(a.record_value) ? a.record_value.join(", ") : a.record_value) || "—"}
                  </TableCell>
                  <TableCell className="w-8 pl-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => openDelete([a.id])}
                      aria-label={`删除资产 ${a.domain || a.id}`}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </TabsContent>

          {/* 应用 */}
          <TabsContent value="app" className="mt-0 flex flex-col gap-3">
            <AssetCard
              {...cardStateProps}
              typeKey="app"
              search={searchBox}
              onDeleteSelected={openDelete}
              cols={["", "应用名", "Bundle ID", "分类", "ICP 备案", "操作"]}
              loaded={tabLoaded}
              total={total}
              page={page}
              size={size}
              onSize={setSize}
              onPage={setPage}
              rows={currentRows}
              selected={selected}
              onToggleAll={(ids) => toggleSelectAll(ids)}
            >
              {slice(tabData("app")).map((a) => (
                <TableRow key={a.id} className={selected.has(a.id) ? "bg-muted/40" : undefined}>
                  <TableCell className="w-8 pr-0">
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      aria-label={`选择资产 ${a.app_name || a.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-[13px] font-medium">{a.app_name || "—"}</TableCell>
                  <TableCell className="font-mono text-[13px]">{a.bundle_id || "—"}</TableCell>
                  <TableCell className="text-[13px]">{a.category || "—"}</TableCell>
                  <TableCell className="text-[13px]">{a.app_icp || "—"}</TableCell>
                  <TableCell className="w-8 pl-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => openDelete([a.id])}
                      aria-label={`删除资产 ${a.app_name || a.id}`}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </TabsContent>

          {/* 服务 */}
          <TabsContent value="service" className="mt-0 flex flex-col gap-3">
            <AssetCard
              {...cardStateProps}
              typeKey="service"
              search={searchBox}
              onDeleteSelected={openDelete}
              cols={["", "服务", "域名", "IP", "端口", "状态码", "标题", "指纹", "认证", "操作"]}
              loaded={tabLoaded}
              total={total}
              page={page}
              size={size}
              onSize={setSize}
              onPage={setPage}
              rows={currentRows}
              selected={selected}
              onToggleAll={(ids) => toggleSelectAll(ids)}
            >
              {slice(tabData("service")).map((asset) => {
                const isHttp = asset.service_type === "http";
                const svc = asset.service_name || (isHttp ? "http" : "") || asset.service_type || "";
                let domainCell: React.ReactNode = "—";
                if (isHttp && asset.url) {
                  domainCell = (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {asset.domain || asset.url}
                    </a>
                  );
                } else if (asset.domain) {
                  domainCell = asset.domain;
                }
                return (
                  <TableRow key={asset.id} className={selected.has(asset.id) ? "bg-muted/40" : undefined}>
                    <TableCell className="w-8 pr-0">
                      <Checkbox
                        checked={selected.has(asset.id)}
                        onCheckedChange={() => toggleSelect(asset.id)}
                        aria-label={`选择资产 ${asset.url || asset.domain || asset.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-[13px]">
                      <Badge variant={isHttp ? "default" : "secondary"} className="font-mono text-[11px]">
                        {svc || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate font-mono text-[13px]" title={asset.domain || asset.url}>
                      {domainCell}
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">{asset.ip || "—"}</TableCell>
                    <TableCell className="font-mono text-[13px] tabular-nums">{asset.port || "—"}</TableCell>
                    <TableCell>
                      {asset.status_code != null ? (
                        <span
                          className={cn("font-mono text-xs font-semibold tabular-nums", statusTone(asset.status_code))}
                        >
                          {asset.status_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate text-[13px]" title={asset.page_title}>
                      {asset.page_title || "—"}
                    </TableCell>
                    <TableCell>
                      <Chips items={asset.technologies ?? []} dense />
                    </TableCell>
                    <TableCell>
                      {(asset.auth ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        (asset.auth ?? []).map((authItem, i) => {
                          const item = authItem as Record<string, string>;
                          const label = item.type || item.username || "认证";
                          return (
                            <span key={i} className="inline-flex items-center gap-1 text-[11px]">
                              <KeyRoundIcon className="size-3 text-muted-foreground" />
                              <span className="font-mono">{label}</span>
                            </span>
                          );
                        })
                      )}
                    </TableCell>
                    <TableCell className="w-8 pl-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => openDelete([asset.id])}
                        aria-label={`删除资产 ${asset.url || asset.id}`}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </AssetCard>
          </TabsContent>

          {/* 接口 */}
          <TabsContent value="endpoint" className="mt-0 flex flex-col gap-3">
            <AssetCard
              {...cardStateProps}
              typeKey="endpoint"
              search={searchBox}
              onDeleteSelected={openDelete}
              cols={["", "方法", "完整地址", "参数", "操作"]}
              loaded={tabLoaded}
              total={total}
              page={page}
              size={size}
              onSize={setSize}
              onPage={setPage}
              rows={currentRows}
              selected={selected}
              onToggleAll={(ids) => toggleSelectAll(ids)}
            >
              {slice(tabData("endpoint")).map((a) => (
                <TableRow key={a.id} className={selected.has(a.id) ? "bg-muted/40" : undefined}>
                  <TableCell className="w-8 pr-0">
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggleSelect(a.id)}
                      aria-label={`选择资产 ${a.url || a.id}`}
                    />
                  </TableCell>
                  <TableCell className="w-16">
                    <MethodBadge method={a.method || ""} />
                  </TableCell>
                  <TableCell className="max-w-sm truncate font-mono text-[13px]" title={a.url}>
                    {a.url || "—"}
                  </TableCell>
                  <TableCell>
                    <Chips
                      items={(a.params ?? []).map((p) => {
                        const item = p as Record<string, string>;
                        return item.name ? `${item.name}(${item.location || "?"})` : "?";
                      })}
                      mono
                      dense
                    />
                  </TableCell>
                  <TableCell className="w-8 pl-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => openDelete([a.id])}
                      aria-label={`删除资产 ${a.url || a.id}`}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </TabsContent>
        </div>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          onEscapeKeyDown={(event) => {
            if (deleting) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除 <span className="font-semibold tabular-nums">{deleteIds.length}</span>{" "}
              条资产记录，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!companyDeleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCompanyDeleteTarget(null);
            setCompanyDeleteAssets(false);
          }
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={(event) => {
            if (companyDeleting) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>删除企业 · {companyDeleteTarget?.name}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>此操作将永久删除该企业及其资产范围配置，不可撤销。</p>
                <label
                  htmlFor="delete-assets-opt"
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    id="delete-assets-opt"
                    checked={companyDeleteAssets}
                    onCheckedChange={(v) => setCompanyDeleteAssets(!!v)}
                  />
                  <span className="text-sm leading-snug">
                    同时删除该企业下的所有资产
                    <span className="block text-xs text-muted-foreground">不勾选则保留资产，仅取消归属关系</span>
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={companyDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteCompany();
              }}
              disabled={companyDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {companyDeleting ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// 卡片头：与 SectionCard 的排版完全一致（14px 线性图标 + 13px 标题 + 12px 说明 + 右侧计数），
// 企业卡与各资产类型卡共用，避免两套头部样式。
function AssetCardHead({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-foreground text-[13px] leading-5 font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-0.5 truncate text-[12px] leading-5">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function AssetCard({
  typeKey,
  search,
  onDeleteSelected,
  cols,
  loaded,
  loading,
  error,
  onRetry,
  total,
  page,
  size,
  onSize,
  onPage,
  rows: dataRows,
  selected,
  onToggleAll,
  children,
}: {
  typeKey: string;
  /** DSL 检索框（共享组件，内部自带候选与命中数提示）。 */
  search: React.ReactNode;
  onDeleteSelected: (ids: number[]) => void;
  cols: string[];
  loaded: boolean;
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  total: number;
  page: number;
  size: number;
  onSize: React.Dispatch<React.SetStateAction<number>>;
  onPage: React.Dispatch<React.SetStateAction<number>>;
  rows?: Asset[];
  selected?: Set<number>;
  onToggleAll?: (ids: number[]) => void;
  children: React.ReactNode;
}) {
  const meta = TAB_BY_KEY.get(typeKey);
  const TypeIcon = meta?.icon ?? LayersIcon;
  const selectedCount = selected?.size ?? 0;
  const childRows = React.Children.toArray(children);

  const pageIds = dataRows?.map((r) => r.id) ?? [];
  const allSelected = pageIds.length > 0 && selected != null && pageIds.every((id) => selected.has(id));
  const someSelected = selected != null && pageIds.some((id) => selected.has(id));

  // 失败必须内联常驻并给重试，不能落到「暂无数据」；切 tab / 翻页期间用骨架，不闪空态。
  let tableRows: React.ReactNode;
  if (error && !loading) {
    tableRows = (
      <TableRow>
        <TableCell colSpan={cols.length} className="p-0">
          <AsyncState status="error" error={new Error(error)} onRetry={onRetry} className="border-0 py-10">
            {null}
          </AsyncState>
        </TableCell>
      </TableRow>
    );
  } else if (!loaded || (loading && childRows.length === 0)) {
    tableRows = (
      <TableRow>
        <TableCell colSpan={cols.length} className="p-0">
          <div aria-hidden="true" className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </TableCell>
      </TableRow>
    );
  } else if (childRows.length > 0) {
    tableRows = childRows;
  } else {
    tableRows = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={cols.length} className="p-0 text-center whitespace-normal">
          <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-6 text-center">
            <TypeIcon className="text-muted-foreground/60 size-6" aria-hidden="true" />
            <p className="text-foreground text-[13px] font-semibold">暂无{meta?.label ?? "资产"}</p>
            <p className="text-muted-foreground max-w-md text-[12px] leading-5">
              换个类型页签或调整 DSL 检索条件；新发现的资产会在任务运行后自动入库。
            </p>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <Card className="flex flex-col gap-0 overflow-hidden py-0">
      <AssetCardHead
        icon={TypeIcon}
        title={meta?.label ?? "资产"}
        description={meta?.description ?? "资产列表。"}
        actions={
          <span className="app-chip shrink-0 tabular-nums">
            共 <span className="text-foreground font-medium">{total}</span> 项
          </span>
        }
      />

      <div className="border-border/60 flex flex-wrap items-center gap-2 border-y px-5 py-3">
        <div className="min-w-0 flex-1">{search}</div>
        {selectedCount > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-[12px] whitespace-nowrap tabular-nums">
              已选 <span className="text-foreground font-medium">{selectedCount}</span> 项
            </span>
            <Button
              variant="destructive"
              size="sm"
              aria-label={`删除已选的 ${selectedCount} 项资产`}
              onClick={() => onDeleteSelected(Array.from(selected ?? []) as number[])}
            >
              <Trash2Icon className="size-3.5" /> 删除
            </Button>
          </div>
        )}
      </div>

      <div className="max-h-[60vh] min-h-[12rem] overflow-auto scrollbar-thin scrollbar-track-transparent">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              {cols.map((c, i) =>
                c === "" && i === 0 && onToggleAll ? (
                  <TableHead key={i} className="w-8 pr-0">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={() => onToggleAll(pageIds)}
                      aria-label="选择当前页全部资产"
                    />
                  </TableHead>
                ) : (
                  <TableHead key={c + i} className={i === cols.length - 1 ? "text-right" : undefined}>
                    {c}
                  </TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>{tableRows}</TableBody>
        </Table>
      </div>
      {/* 与任务/漏洞列表共用同一个分页条：同一套 28px 控件、同一种分隔符与文案口径。
          资产页的 page 是 0 基，这里换算成 1 基交给组件。 */}
      {total > 0 && (
        <TablePagination
          page={page + 1}
          pageSize={size}
          total={total}
          pageSizeOptions={PAGE_SIZES}
          onPageChange={(next) => onPage(Math.max(0, next - 1))}
          onPageSizeChange={(next) => onSize(next)}
        />
      )}
    </Card>
  );
}

function CompanyAvatar({ name, logo }: { name: string; logo?: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <Avatar className="size-7 shrink-0">
      {logo ? <AvatarImage src={logo} alt={name} /> : null}
      <AvatarFallback className="text-xs">{initial}</AvatarFallback>
    </Avatar>
  );
}

// 后端返回的 warnings 说的是既有数据问题（不是本次提交的行有错），保存本身已经
// 成功。给更长的停留时间，因为它需要用户去处理具体的资产，扫一眼标题不够。
function showScopeWarnings(warnings?: string[]) {
  for (const warning of warnings ?? []) {
    toast.warning(warning, { duration: 15000 });
  }
}

function savedScopeRules(company: Company): CompanyScopeRule[] {
  return (company.scope ?? [])
    .map((scope) => ({ kind: scope.kind, value: scope.raw.trim() }))
    .filter((scope) => scope.value);
}

function savedScopeText(company: Company): string {
  return savedScopeRules(company)
    .map((scope) => scope.value)
    .join("\n");
}

// 新增企业使用与任务、LLM 编辑一致的右侧抽屉。
function CompanyDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scopeText, setScopeText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const parsedScope = React.useMemo(() => parseCompanyScopeText(scopeText), [scopeText]);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setScopeText("");
  }, [open]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("请填写企业名称");
      return;
    }
    if (parsedScope.errors.length > 0) {
      toast.error("请修正无效的资产范围");
      return;
    }
    setBusy(true);
    try {
      const res = await api.createCompany(name.trim(), parsedScope.rules);
      const added = res.scope_added ?? 0;
      const invalid = res.scope_invalid ?? 0;
      if (invalid > 0) toast.warning(`已创建企业，添加 ${added} 条范围；${invalid} 行无效`);
      else toast.success(`已创建企业，添加 ${added} 条范围`);
      setOpen(false);
      onSaved();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (/:\s*409$/.test(msg)) toast.error("企业已存在，请换个名称");
      else toast.error(`保存失败：${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <BuildingIcon data-icon="inline-start" /> 新增企业
        </Button>
      </SheetTrigger>
      <SheetContent busy={busy} className="w-full! max-w-none! gap-0 p-0 sm:w-[520px]! sm:max-w-[520px]!">
        <SheetHeader className="border-b p-6">
          <SheetTitle>新增企业</SheetTitle>
          <SheetDescription>配置企业及其资产范围。关键词只作为 Agent 提示，不会自动归属资产。</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="cn-name">企业名称</FieldLabel>
              <Input
                id="cn-name"
                placeholder="如 Acme Corp（名称唯一）"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <ScopeTextEditor id="cn-scope" value={scopeText} onValueChange={setScopeText} parsed={parsedScope} />
          </FieldGroup>
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim() || parsedScope.errors.length > 0}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// 编辑（覆盖）资产范围弹窗
function EditScopeDialog({ company, onSaved }: { company: Company; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [scopeText, setScopeText] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const preservedScopeRules = React.useMemo(() => savedScopeRules(company), [company]);
  const parsedScope = React.useMemo(
    () => parseCompanyScopeText(scopeText, { preservedRules: preservedScopeRules }),
    [preservedScopeRules, scopeText],
  );

  React.useEffect(() => {
    if (!open) return;
    setScopeText(savedScopeText(company));
    setReason("");
  }, [open, company]);

  const submit = async () => {
    if (parsedScope.errors.length > 0) {
      toast.error("请修正无效的资产范围");
      return;
    }
    setBusy(true);
    try {
      const res = await api.updateCompanyScope(company.id, parsedScope.rules, reason);
      const errCount = res.invalid ?? 0;
      if (errCount > 0) toast.warning(`已保存；${errCount} 行无效`);
      else toast.success(`范围已更新，共 ${res.added} 条`);
      showScopeWarnings(res.warnings);
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`保存失败：${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          编辑
        </Button>
      </DialogTrigger>
      <DialogContent busy={busy}>
        <DialogHeader>
          <DialogTitle>编辑资产范围 · {company.name}</DialogTitle>
          <DialogDescription>
            编辑后将替换全部现有范围。ICP 精确匹配资产，企业关键词仅作为 Agent 提示。
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-2">
          <ScopeTextEditor
            id={`edit-company-scope-${company.id}`}
            value={scopeText}
            onValueChange={setScopeText}
            parsed={parsedScope}
          />
          <Field>
            <FieldLabel htmlFor="es-reason">归属依据（可选）</FieldLabel>
            <Input
              id="es-reason"
              placeholder="如 证书 / whois / ASN 佐证"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || parsedScope.errors.length > 0}>
            {busy ? "保存中…" : "覆盖保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 追加资产范围弹窗
function AppendScopeDialog({ company, onSaved }: { company: Company; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [scopeText, setScopeText] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const parsedScope = React.useMemo(() => parseCompanyScopeText(scopeText), [scopeText]);

  React.useEffect(() => {
    if (!open) return;
    setScopeText("");
    setReason("");
  }, [open]);

  const submit = async () => {
    if (parsedScope.rules.length === 0) {
      toast.error("请填写要追加的范围");
      return;
    }
    if (parsedScope.errors.length > 0) {
      toast.error("请修正无效的资产范围");
      return;
    }
    setBusy(true);
    try {
      const res = await api.addCompanyScope(company.id, parsedScope.rules, reason);
      const errCount = res.invalid ?? 0;
      if (errCount > 0) toast.warning(`已保存；${errCount} 行无效`);
      else toast.success(`已追加 ${res.added} 条范围`);
      showScopeWarnings(res.warnings);
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(`保存失败：${String((e as Error)?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7">
          追加
        </Button>
      </DialogTrigger>
      <DialogContent busy={busy}>
        <DialogHeader>
          <DialogTitle>追加资产范围 · {company.name}</DialogTitle>
          <DialogDescription>新范围会追加到现有范围。ICP 精确匹配资产，企业关键词仅作为 Agent 提示。</DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-2">
          <ScopeTextEditor
            id={`append-company-scope-${company.id}`}
            value={scopeText}
            onValueChange={setScopeText}
            parsed={parsedScope}
          />
          <Field>
            <FieldLabel htmlFor="as-reason">归属依据（可选）</FieldLabel>
            <Input
              id="as-reason"
              placeholder="如 证书 / whois / ASN 佐证"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || parsedScope.rules.length === 0 || parsedScope.errors.length > 0}>
            {busy ? "保存中…" : "追加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
