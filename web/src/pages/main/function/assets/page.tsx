import * as React from "react";
import { AlertDialog, Avatar, Button, Card, Checkbox, Chip, Description, Drawer, Input, Label, ListBox, Modal, ScrollShadow, Select, Table, Tabs, TextField, } from "@heroui/react";
import { BuildingIcon, ChevronLeftIcon, ChevronRightIcon, GlobeIcon, KeyRoundIcon, LayoutTemplateIcon, LinkIcon, type LucideIcon, NetworkIcon, RefreshCwIcon, SmartphoneIcon, Trash2Icon, } from "lucide-react";
import { toast } from "sonner";
import { AssetDslSearch } from "@/components/asset-dsl-search";
import { ScopeTextEditor } from "@/components/scope-text-editor";
import { api } from "@/lib/api";
import { parseCompanyScopeText } from "@/lib/company-scope";
import type { Asset, Company, CompanyScopeRule } from "@/lib/types";
import { cn } from "@/lib/utils";
const METHOD_COLOR: Record<string, string> = {
    GET: "bg-success-soft text-success",
    POST: "bg-accent-soft text-accent",
    PUT: "bg-warning-soft text-warning",
    PATCH: "bg-warning-soft text-warning",
    DELETE: "bg-danger-soft text-danger",
    HEAD: "bg-accent-soft text-accent",
    OPTIONS: "bg-surface-secondary text-muted",
};
function MethodBadge({ method }: {
    method: string;
}) {
    const m = method.toUpperCase();
    return (<span className={cn("inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none", METHOD_COLOR[m] ?? "bg-surface-secondary text-muted")}>
      {m || "—"}
    </span>);
}
function statusTone(code: number) {
    if (code >= 500)
        return "text-danger";
    if (code >= 400)
        return "text-warning";
    if (code >= 300)
        return "text-accent";
    if (code >= 200)
        return "text-success";
    return "text-muted";
}
const PAGE_SIZES = [25, 50, 100, 200];
const TABS: {
    key: string;
    label: string;
    icon: LucideIcon;
}[] = [
    { key: "company", label: "企业", icon: BuildingIcon },
    { key: "root_domain", label: "根域名", icon: GlobeIcon },
    { key: "ip", label: "IP", icon: NetworkIcon },
    { key: "subdomain", label: "子域名", icon: GlobeIcon },
    { key: "app", label: "应用", icon: SmartphoneIcon },
    { key: "service", label: "服务", icon: LayoutTemplateIcon },
    { key: "endpoint", label: "接口", icon: LinkIcon },
];
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
    const loadMeta = React.useCallback(() => {
        api
            .companies()
            .then(setCompanies)
            .catch(() => {
            /* Keep the last successful company snapshot on a transient failure. */
        });
        api
            .assetCounts()
            .then(setCounts)
            .catch(() => {
            /* Keep the last successful counters on a transient failure. */
        });
    }, []);
    // Manual refresh: reload counts/companies and re-fetch the current page.
    const refresh = React.useCallback(() => {
        loadMeta();
        setRefreshKey((k) => k + 1);
        setSelected(new Set());
    }, [loadMeta]);
    const toggleSelect = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
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
            }
            else {
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
        }
        catch (e) {
            toast.error("删除失败：" + String((e as Error)?.message ?? e));
        }
        finally {
            setDeleting(false);
            setDeleteOpen(false);
        }
    };
    const confirmDeleteCompany = async () => {
        if (!companyDeleteTarget)
            return;
        setCompanyDeleting(true);
        try {
            const res = await api.deleteCompany(companyDeleteTarget.id, companyDeleteAssets);
            const msg = companyDeleteAssets && res.assets_deleted > 0
                ? `已删除企业，同时删除 ${res.assets_deleted} 条资产`
                : "已删除企业";
            toast.success(msg);
            refresh();
        }
        catch (e) {
            toast.error("删除失败：" + String((e as Error)?.message ?? e));
        }
        finally {
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
    }, [tab]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: these controls intentionally reset server pagination.
    React.useEffect(() => setPage(0), [tab, size, query]);
    const dslMode = query.trim() !== "";
    // Server-side paginated page loader for the active data tab (company tab excluded).
    // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an explicit manual-reload trigger.
    React.useEffect(() => {
        if (tab === "company")
            return;
        const request = ++assetsRequestRef.current;
        const dsl = query.trim();
        setLoading(true);
        const offset = page * size;
        const run = async () => {
            try {
                const r = dsl ? await api.searchAssets(dsl, tab, size, offset) : await api.assets(tab, size, offset);
                if (assetsRequestRef.current !== request)
                    return;
                setRows(r.assets);
                setRowsTab(tab);
                setTotal(r.total);
                setDslError("");
            }
            catch (e) {
                if (assetsRequestRef.current !== request)
                    return;
                setDslError(String((e as Error)?.message ?? e));
                setRows([]);
                setRowsTab(tab);
                setTotal(0);
            }
            finally {
                if (assetsRequestRef.current === request) {
                    setLoading(false);
                    setLoaded(true);
                }
            }
        };
        const tid = setTimeout(run, dsl ? 400 : 0);
        return () => {
            clearTimeout(tid);
            if (assetsRequestRef.current === request)
                assetsRequestRef.current++;
        };
    }, [tab, page, size, query, refreshKey]);
    React.useEffect(() => {
        if (tab === "company")
            return;
        const lastPage = Math.max(0, Math.ceil(total / size) - 1);
        if (page > lastPage)
            setPage(lastPage);
    }, [page, size, tab, total]);
    const companyById = React.useMemo(() => {
        const m = new Map<number, string>();
        for (const c of companies)
            m.set(c.id, c.name);
        return m;
    }, [companies]);
    const companyName = (id?: number) => (id ? (companyById.get(id) ?? "") : "");
    const tabCounts: Record<string, number> = { ...counts, company: companies.length };
    const totalAssets = Object.values(counts).reduce((a, b) => a + b, 0);
    // rows are already the current server-side page.
    const tabData = (type: string): Asset[] => (rowsTab === type ? rows : []);
    const currentRows = tabData(tab);
    const slice = <T,>(list: T[]) => list;
    const searchBox = (<AssetDslSearch query={query} onChange={setQuery} loading={loading} error={dslError} count={dslMode ? total : undefined}/>);
    return (<div className="flex h-[calc(100vh-6rem)] min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">资产</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            共 <span className="tabular-nums">{totalAssets}</span> 项资产
          </span>
          {selected.size > 0 && (<Button size="sm" onPress={() => openDelete(Array.from(selected) as number[])} variant={"danger"}>
              <Trash2Icon className="size-3.5"/> 删除已选 ({selected.size})
            </Button>)}
          <Button size="sm" onPress={refresh} isDisabled={loading} variant={"outline"}>
            <RefreshCwIcon className={cn("size-4", loading && "animate-spin")}/> 刷新
          </Button>
          <CompanyDialog onSaved={refresh}/>
        </div>
      </div>

      <Tabs selectedKey={tab} className="flex min-h-0 flex-1 flex-col gap-4" onSelectionChange={(key) => setTab(String(key))}>
        <div className="overflow-x-auto overflow-y-hidden">
          <Tabs.ListContainer>
            <Tabs.List>
              {TABS.map((t) => (<Tabs.Tab key={t.key} id={t.key}>
                  <t.icon className="size-3.5"/>
                  {t.label}
                  <span className="ml-1 tabular-nums text-muted">{tabCounts[t.key]}</span>
                  <Tabs.Indicator />
                </Tabs.Tab>))}
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        {/* 企业 */}
        <Tabs.Panel id="company" className="mt-0 flex min-h-0 flex-1 flex-col">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="数据表">
                    <Table.Header className="sticky top-0 z-10 bg-surface">
                      <Table.Column id="column-11754" isRowHeader>
                        企业
                      </Table.Column>
                      <Table.Column className="w-24 text-right" id="column-11800" isRowHeader>
                        资产数
                      </Table.Column>
                      <Table.Column id="column-11875" isRowHeader>
                        资产范围
                      </Table.Column>
                      <Table.Column className="w-36 text-right" id="column-11923" isRowHeader>
                        操作
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {companies.map((c) => (<Table.Row key={c.id} id={c.id}>
                          <Table.Cell>
                            <div className="flex items-center gap-2">
                              <CompanyAvatar name={c.name} logo={c.logo}/>
                              <span className="font-medium">{c.name}</span>
                            </div>
                          </Table.Cell>
                          <Table.Cell className="text-right tabular-nums text-sm">{c.asset_count}</Table.Cell>
                          <Table.Cell>
                            {c.scope?.length ? (<div className="flex flex-wrap gap-1">
                                {c.scope.map((s, i) => (<Chip key={i} className="font-mono text-[11px]" size="sm" variant={"soft"}>
                                    {s.raw}
                                  </Chip>))}
                              </div>) : (<span className="text-xs text-muted">未设置范围</span>)}
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <EditScopeDialog company={c} onSaved={refresh}/>
                              <AppendScopeDialog company={c} onSaved={refresh}/>
                              <Button className="size-7 text-muted hover:text-danger" onPress={() => {
                setCompanyDeleteTarget(c);
                setCompanyDeleteAssets(false);
            }} aria-label={`删除企业 ${c.name}`} size="sm" isIconOnly variant={"ghost"}>
                                <Trash2Icon className="size-3.5"/>
                              </Button>
                            </div>
                          </Table.Cell>
                        </Table.Row>))}
                      {companies.length === 0 && (<Table.Row id="empty-13829">
                          <Table.Cell colSpan={4} className="py-10 text-center text-sm text-muted">
                            还没有企业。点击右上角「新增企业」并填写资产范围，系统会自动认领命中的资产。
                          </Table.Cell>
                        </Table.Row>)}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </div>
          </Card>
        </Tabs.Panel>

        {/* 根域名 */}
        <Tabs.Panel id="root_domain" className="mt-0 flex min-h-0 flex-1 flex-col gap-2">
          {searchBox}
          <AssetCard cols={["", "域名", "ICP 备案", "归属企业", ""]} loaded={loaded} total={total} page={page} size={size} onSize={setSize} onPage={setPage} rows={currentRows} selected={selected} onToggleAll={(ids) => toggleSelectAll(ids)}>
            {slice(tabData("root_domain")).map((a) => (<Table.Row key={a.id} className={selected.has(a.id) ? "bg-surface-secondary/40" : undefined} id={a.id}>
                <Table.Cell className="w-8 pr-0">
                  <Checkbox slot={null} onChange={() => toggleSelect(a.id)} aria-label="选择" isSelected={selected.has(a.id) === true}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Cell>
                <Table.Cell className="font-mono text-xs font-medium">{a.domain}</Table.Cell>
                <Table.Cell className="text-xs">{a.icp || "—"}</Table.Cell>
                <Table.Cell className="text-xs">
                  {companyName(a.company_id) || <span className="text-muted">未归属</span>}
                </Table.Cell>
                <Table.Cell className="w-8 pl-0">
                  <Button className="size-7 text-muted hover:text-danger" onPress={() => openDelete([a.id])} aria-label={`删除资产 ${a.domain || a.id}`} size="sm" isIconOnly variant={"ghost"}>
                    <Trash2Icon className="size-3.5"/>
                  </Button>
                </Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        {/* IP */}
        <Tabs.Panel id="ip" className="mt-0 flex min-h-0 flex-1 flex-col gap-2">
          {searchBox}
          <AssetCard cols={["", "IP", "C段", "绑定域名", "开放端口", ""]} loaded={loaded} total={total} page={page} size={size} onSize={setSize} onPage={setPage} rows={currentRows} selected={selected} onToggleAll={(ids) => toggleSelectAll(ids)}>
            {slice(tabData("ip")).map((a) => (<Table.Row key={a.id} className={selected.has(a.id) ? "bg-surface-secondary/40" : undefined} id={a.id}>
                <Table.Cell className="w-8 pr-0">
                  <Checkbox slot={null} onChange={() => toggleSelect(a.id)} aria-label="选择" isSelected={selected.has(a.id) === true}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Cell>
                <Table.Cell className="font-mono text-xs font-medium">{a.ip}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{a.c_segment || "—"}</Table.Cell>
                <Table.Cell>
                  <Chips items={a.bound_domains ?? []} mono/>
                </Table.Cell>
                <Table.Cell>
                  <Chips items={(a.open_ports ?? []).map((p) => (p.service ? `${p.port}/${p.service}` : String(p.port)))} mono/>
                </Table.Cell>
                <Table.Cell className="w-8 pl-0">
                  <Button className="size-7 text-muted hover:text-danger" onPress={() => openDelete([a.id])} aria-label={`删除资产 ${a.ip || a.id}`} size="sm" isIconOnly variant={"ghost"}>
                    <Trash2Icon className="size-3.5"/>
                  </Button>
                </Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        {/* 子域名 */}
        <Tabs.Panel id="subdomain" className="mt-0 flex min-h-0 flex-1 flex-col gap-2">
          {searchBox}
          <AssetCard cols={["", "域名", "根域名", "解析类型", "解析值", ""]} loaded={loaded} total={total} page={page} size={size} onSize={setSize} onPage={setPage} rows={currentRows} selected={selected} onToggleAll={(ids) => toggleSelectAll(ids)}>
            {slice(tabData("subdomain")).map((a) => (<Table.Row key={a.id} className={selected.has(a.id) ? "bg-surface-secondary/40" : undefined} id={a.id}>
                <Table.Cell className="w-8 pr-0">
                  <Checkbox slot={null} onChange={() => toggleSelect(a.id)} aria-label="选择" isSelected={selected.has(a.id) === true}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Cell>
                <Table.Cell className="font-mono text-xs font-medium">{a.domain}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{a.root_domain || "—"}</Table.Cell>
                <Table.Cell className="text-xs">{a.record_type || "—"}</Table.Cell>
                <Table.Cell className="max-w-xs truncate font-mono text-xs">
                  {(Array.isArray(a.record_value) ? a.record_value.join(", ") : a.record_value) || "—"}
                </Table.Cell>
                <Table.Cell className="w-8 pl-0">
                  <Button className="size-7 text-muted hover:text-danger" onPress={() => openDelete([a.id])} aria-label={`删除资产 ${a.domain || a.id}`} size="sm" isIconOnly variant={"ghost"}>
                    <Trash2Icon className="size-3.5"/>
                  </Button>
                </Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        {/* 应用 */}
        <Tabs.Panel id="app" className="mt-0 flex min-h-0 flex-1 flex-col gap-2">
          {searchBox}
          <AssetCard cols={["", "应用名", "Bundle ID", "分类", "ICP 备案", ""]} loaded={loaded} total={total} page={page} size={size} onSize={setSize} onPage={setPage} rows={currentRows} selected={selected} onToggleAll={(ids) => toggleSelectAll(ids)}>
            {slice(tabData("app")).map((a) => (<Table.Row key={a.id} className={selected.has(a.id) ? "bg-surface-secondary/40" : undefined} id={a.id}>
                <Table.Cell className="w-8 pr-0">
                  <Checkbox slot={null} onChange={() => toggleSelect(a.id)} aria-label="选择" isSelected={selected.has(a.id) === true}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Cell>
                <Table.Cell className="text-xs font-medium">{a.app_name || "—"}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{a.bundle_id || "—"}</Table.Cell>
                <Table.Cell className="text-xs">{a.category || "—"}</Table.Cell>
                <Table.Cell className="text-xs">{a.app_icp || "—"}</Table.Cell>
                <Table.Cell className="w-8 pl-0">
                  <Button className="size-7 text-muted hover:text-danger" onPress={() => openDelete([a.id])} aria-label={`删除资产 ${a.app_name || a.id}`} size="sm" isIconOnly variant={"ghost"}>
                    <Trash2Icon className="size-3.5"/>
                  </Button>
                </Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        {/* 服务 */}
        <Tabs.Panel id="service" className="mt-0 flex min-h-0 flex-1 flex-col gap-2">
          {searchBox}
          <AssetCard cols={["", "服务", "域名", "IP", "端口", "状态码", "标题", "指纹", "认证", ""]} loaded={loaded} total={total} page={page} size={size} onSize={setSize} onPage={setPage} rows={currentRows} selected={selected} onToggleAll={(ids) => toggleSelectAll(ids)}>
            {slice(tabData("service")).map((a) => {
            const isHttp = a.service_type === "http";
            const svc = a.service_name || (isHttp ? "http" : "") || a.service_type || "";
            let domainCell: React.ReactNode = "—";
            if (isHttp && a.url) {
                domainCell = (<a href={a.url} target="_blank" rel="noreferrer" className="text-accent hover:underline dark:text-accent">
                    {a.domain || a.url}
                  </a>);
            }
            else if (a.domain) {
                domainCell = a.domain;
            }
            return (<Table.Row key={a.id} className={selected.has(a.id) ? "bg-surface-secondary/40" : undefined} id={a.id}>
                  <Table.Cell className="w-8 pr-0">
                    <Checkbox slot={null} onChange={() => toggleSelect(a.id)} aria-label="选择" isSelected={selected.has(a.id) === true}>
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </Table.Cell>
                  <Table.Cell className="text-xs">
                    <Chip className="font-mono text-[10px]" size="sm" variant={isHttp ? "primary" : "secondary"}>
                      {svc || "—"}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell className="max-w-[14rem] truncate font-mono text-xs">
                    <span title={a.domain || a.url} className="block truncate">
                      {domainCell}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="font-mono text-xs">{a.ip || "—"}</Table.Cell>
                  <Table.Cell className="font-mono text-xs tabular-nums">{a.port || "—"}</Table.Cell>
                  <Table.Cell>
                    {a.status_code != null ? (<span className={cn("font-mono text-xs font-semibold tabular-nums", statusTone(a.status_code))}>
                        {a.status_code}
                      </span>) : ("—")}
                  </Table.Cell>
                  <Table.Cell className="max-w-[12rem] truncate text-xs">
                    <span title={a.page_title} className="block truncate">
                      {a.page_title || "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Chips items={a.technologies ?? []}/>
                  </Table.Cell>
                  <Table.Cell>
                    {(a.auth ?? []).length === 0 ? (<span className="text-xs text-muted">—</span>) : ((a.auth ?? []).map((authItem, i) => {
                    const item = authItem as Record<string, string>;
                    const label = item.type || item.username || "认证";
                    return (<span key={i} className="inline-flex items-center gap-1 text-[11px]">
                            <KeyRoundIcon className="size-3 text-muted"/>
                            <span className="font-mono">{label}</span>
                          </span>);
                }))}
                  </Table.Cell>
                  <Table.Cell className="w-8 pl-0">
                    <Button className="size-7 text-muted hover:text-danger" onPress={() => openDelete([a.id])} aria-label={`删除资产 ${a.url || a.id}`} size="sm" isIconOnly variant={"ghost"}>
                      <Trash2Icon className="size-3.5"/>
                    </Button>
                  </Table.Cell>
                </Table.Row>);
        })}
          </AssetCard>
        </Tabs.Panel>

        {/* 接口 */}
        <Tabs.Panel id="endpoint" className="mt-0 flex min-h-0 flex-1 flex-col gap-2">
          {searchBox}
          <AssetCard cols={["", "方法", "完整地址", "参数", ""]} loaded={loaded} total={total} page={page} size={size} onSize={setSize} onPage={setPage} rows={currentRows} selected={selected} onToggleAll={(ids) => toggleSelectAll(ids)}>
            {slice(tabData("endpoint")).map((a) => (<Table.Row key={a.id} className={selected.has(a.id) ? "bg-surface-secondary/40" : undefined} id={a.id}>
                <Table.Cell className="w-8 pr-0">
                  <Checkbox slot={null} onChange={() => toggleSelect(a.id)} aria-label="选择" isSelected={selected.has(a.id) === true}>
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </Table.Cell>
                <Table.Cell className="w-16">
                  <MethodBadge method={a.method || ""}/>
                </Table.Cell>
                <Table.Cell className="max-w-sm truncate font-mono text-xs">
                  <span title={a.url} className="block truncate">
                    {a.url || "—"}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Chips items={(a.params ?? []).map((p) => {
                const item = p as Record<string, string>;
                return item.name ? `${item.name}(${item.location || "?"})` : "?";
            })} mono/>
                </Table.Cell>
                <Table.Cell className="w-8 pl-0">
                  <Button className="size-7 text-muted hover:text-danger" onPress={() => openDelete([a.id])} aria-label={`删除资产 ${a.url || a.id}`} size="sm" isIconOnly variant={"ghost"}>
                    <Trash2Icon className="size-3.5"/>
                  </Button>
                </Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>
      </Tabs>

      
        <AlertDialog.Backdrop isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>确认删除</AlertDialog.Heading>
                <AlertDialog.Body>
                  将永久删除 <span className="font-semibold tabular-nums">{deleteIds.length}</span>{" "}
                  条资产记录，此操作不可撤销。
                </AlertDialog.Body>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <Button isDisabled={deleting} slot="close" variant={"outline"}>
                  取消
                </Button>
                <Button isDisabled={deleting} className="bg-danger text-danger-foreground hover:bg-danger/90" onClick={(e) => {
            e.preventDefault();
            void confirmDelete();
        }}>
                  {deleting ? "删除中…" : "确认删除"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      

      
        <AlertDialog.Backdrop isOpen={!!companyDeleteTarget} onOpenChange={(o) => {
            if (!o) {
                setCompanyDeleteTarget(null);
                setCompanyDeleteAssets(false);
            }
        }}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>删除企业 · {companyDeleteTarget?.name}</AlertDialog.Heading>
                <AlertDialog.Body>
                  <div className="space-y-3">
                    <p>此操作将永久删除该企业及其资产范围配置，不可撤销。</p>
                    <Checkbox id="delete-assets-opt" onChange={(v) => setCompanyDeleteAssets(!!v)} aria-label={"delete-assets-opt"} isSelected={companyDeleteAssets === true}>
                      <Checkbox.Content className="flex cursor-pointer items-center gap-2.5 rounded-md border p-3 hover:bg-surface-secondary/50">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label>
                          <span className="text-sm leading-snug">
                            同时删除该企业下的所有资产
                            <span className="block text-xs text-muted">不勾选则保留资产，仅取消归属关系</span>
                          </span>
                        </Label>
                      </Checkbox.Content>
                    </Checkbox>
                  </div>
                </AlertDialog.Body>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <Button isDisabled={companyDeleting} slot="close" variant={"outline"}>
                  取消
                </Button>
                <Button isDisabled={companyDeleting} className="bg-danger text-danger-foreground hover:bg-danger/90" onClick={(e) => {
            e.preventDefault();
            void confirmDeleteCompany();
        }}>
                  {companyDeleting ? "删除中…" : "确认删除"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      
    </div>);
}
function AssetCard({ cols, loaded, total, page, size, onSize, onPage, rows: dataRows, selected, onToggleAll, children, }: {
    cols: string[];
    loaded: boolean;
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
    const childRows = React.Children.toArray(children);
    const pageCount = Math.max(1, Math.ceil(total / size));
    const start = total === 0 ? 0 : page * size + 1;
    const end = page * size + childRows.length;
    const pageIds = dataRows?.map((r) => r.id) ?? [];
    const allSelected = pageIds.length > 0 && selected != null && pageIds.every((id) => selected.has(id));
    const someSelected = selected != null && pageIds.some((id) => selected.has(id));
    return (<Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin scrollbar-track-transparent">
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="数据表">
              <Table.Header className="sticky top-0 z-10 bg-surface">
                {cols.map((c, i) => c === "" && i === 0 && onToggleAll ? (<Table.Column key={i} className="w-8 pr-0" isRowHeader id={i}>
                      <Checkbox slot={null} onChange={() => onToggleAll(pageIds)} aria-label="选择" isSelected={(allSelected ? true : someSelected ? "indeterminate" : false) === true} isIndeterminate={(allSelected ? true : someSelected ? "indeterminate" : false) === "indeterminate"}>
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    </Table.Column>) : (<Table.Column key={c + i} isRowHeader id={c + i}>
                      {c}
                    </Table.Column>))}
              </Table.Header>
              <Table.Body>
                {childRows.length > 0 ? (childRows) : (<Table.Row id="empty-31345">
                    <Table.Cell colSpan={cols.length} className="py-12 text-center text-sm text-muted">
                      {loaded ? "暂无数据。" : "加载中…"}
                    </Table.Cell>
                  </Table.Row>)}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>
      {total > 0 && (<div className="flex shrink-0 items-center gap-2 border-t px-3 py-1.5 text-xs text-muted">
          <Select selectedKey={String(size)} aria-label="选择选项" onSelectionChange={(key) => {
                if (key !== null)
                    ((v) => onSize(Number(v)))(String(key));
            }}>
            <Select.Trigger className="h-7 w-24">
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <>
                  {PAGE_SIZES.map((n) => (<ListBox.Item key={n} id={String(n)} textValue="/ 页">
                      {n} / 页
                    </ListBox.Item>))}
                </>
              </ListBox>
            </Select.Popover>
          </Select>
          <span className="tabular-nums">
            {start}–{end} / {total}
          </span>
          {pageCount > 1 && (<div className="flex items-center gap-2">
              <Button className="size-7" isDisabled={page <= 0} onPress={() => onPage((p) => Math.max(0, p - 1))} size="sm" isIconOnly variant={"outline"}>
                <ChevronLeftIcon />
              </Button>
              <span className="tabular-nums">
                {page + 1} / {pageCount}
              </span>
              <Button className="size-7" isDisabled={page + 1 >= pageCount} onPress={() => onPage((p) => Math.min(pageCount - 1, p + 1))} size="sm" isIconOnly variant={"outline"}>
                <ChevronRightIcon />
              </Button>
            </div>)}
        </div>)}
    </Card>);
}
function Chips({ items, mono }: {
    items: string[];
    mono?: boolean;
}) {
    const clean = items.filter(Boolean);
    if (clean.length === 0)
        return <span className="text-xs text-muted">—</span>;
    return (<div className="flex flex-wrap gap-1">
      {clean.map((s, i) => (<Chip key={i} className={cn("text-[10px]", mono && "font-mono")} size="sm" variant={"secondary"}>
          {s}
        </Chip>))}
    </div>);
}
function CompanyAvatar({ name, logo }: {
    name: string;
    logo?: string;
}) {
    const initial = (name.trim()[0] ?? "?").toUpperCase();
    return (<Avatar className="size-7 shrink-0">
      {logo ? <Avatar.Image src={logo} alt={name}/> : null}
      <Avatar.Fallback className="text-xs">{initial}</Avatar.Fallback>
    </Avatar>);
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
function CompanyDialog({ onSaved }: {
    onSaved: () => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState("");
    const [scopeText, setScopeText] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const parsedScope = React.useMemo(() => parseCompanyScopeText(scopeText), [scopeText]);
    React.useEffect(() => {
        if (!open)
            return;
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
            if (invalid > 0)
                toast.warning(`已创建企业，添加 ${added} 条范围；${invalid} 行无效`);
            else
                toast.success(`已创建企业，添加 ${added} 条范围`);
            setOpen(false);
            onSaved();
        }
        catch (e) {
            const msg = String((e as Error)?.message ?? e);
            if (/:\s*409$/.test(msg))
                toast.error("企业已存在，请换个名称");
            else
                toast.error(`保存失败：${msg}`);
        }
        finally {
            setBusy(false);
        }
    };
    return (<Drawer isOpen={open} onOpenChange={setOpen}>
      
        <Button size="sm">
          <BuildingIcon data-icon="inline-start"/> 新增企业
        </Button>
      
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full! max-w-none! gap-0 p-0 sm:w-[520px]! sm:max-w-[520px]!">
            <Drawer.CloseTrigger aria-label="关闭"/>
            <Drawer.Header className="border-b p-6">
              <Drawer.Heading>新增企业</Drawer.Heading>
              <Description>配置企业及其资产范围。关键词只作为 Agent 提示，不会自动归属资产。</Description>
            </Drawer.Header>
            <ScrollShadow className="flex-1 overflow-y-auto p-6" data-scrollbar="thin" data-slot="scroll-shadow">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cn-name">企业名称</Label>
                  <TextField className="contents" aria-label={"如 Acme Corp（名称唯一）"}>
                    <Input id="cn-name" placeholder="如 Acme Corp（名称唯一）" value={name} onChange={(e) => setName(e.target.value)}/>
                  </TextField>
                </div>
                <ScopeTextEditor id="cn-scope" value={scopeText} onValueChange={setScopeText} parsed={parsedScope}/>
              </div>
            </ScrollShadow>
            <Drawer.Footer className="flex-row justify-end gap-2 border-t p-4">
              <Button onPress={() => setOpen(false)} isDisabled={busy} variant={"outline"}>
                取消
              </Button>
              <Button onPress={submit} isDisabled={busy || !name.trim() || parsedScope.errors.length > 0}>
                {busy ? "保存中…" : "保存"}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>);
}
// 编辑（覆盖）资产范围弹窗
function EditScopeDialog({ company, onSaved }: {
    company: Company;
    onSaved: () => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [scopeText, setScopeText] = React.useState("");
    const [reason, setReason] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const preservedScopeRules = React.useMemo(() => savedScopeRules(company), [company]);
    const parsedScope = React.useMemo(() => parseCompanyScopeText(scopeText, { preservedRules: preservedScopeRules }), [preservedScopeRules, scopeText]);
    React.useEffect(() => {
        if (!open)
            return;
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
            if (errCount > 0)
                toast.warning(`已保存；${errCount} 行无效`);
            else
                toast.success(`范围已更新，共 ${res.added} 条`);
            showScopeWarnings(res.warnings);
            setOpen(false);
            onSaved();
        }
        catch (e) {
            toast.error(`保存失败：${String((e as Error)?.message ?? e)}`);
        }
        finally {
            setBusy(false);
        }
    };
    return (<Modal isOpen={open} onOpenChange={setOpen}>
      
        <Button size="sm" className="h-7" variant={"outline"}>
          编辑
        </Button>
      
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="关闭"/>
            <Modal.Header>
              <Modal.Heading>编辑资产范围 · {company.name}</Modal.Heading>
              <Description>编辑后将替换全部现有范围。ICP 精确匹配资产，企业关键词仅作为 Agent 提示。</Description>
            </Modal.Header>
            <div className={`flex flex-col gap-4 ${"py-2"}`}>
              <ScopeTextEditor id={`edit-company-scope-${company.id}`} value={scopeText} onValueChange={setScopeText} parsed={parsedScope}/>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="es-reason">归属依据（可选）</Label>
                <TextField className="contents" aria-label={"如 证书 / whois / ASN 佐证"}>
                  <Input id="es-reason" placeholder="如 证书 / whois / ASN 佐证" value={reason} onChange={(e) => setReason(e.target.value)}/>
                </TextField>
              </div>
            </div>
            <Modal.Footer>
              <Button onPress={() => setOpen(false)} isDisabled={busy} variant={"outline"}>
                取消
              </Button>
              <Button onPress={submit} isDisabled={busy || parsedScope.errors.length > 0}>
                {busy ? "保存中…" : "覆盖保存"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>);
}
// 追加资产范围弹窗
function AppendScopeDialog({ company, onSaved }: {
    company: Company;
    onSaved: () => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [scopeText, setScopeText] = React.useState("");
    const [reason, setReason] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const parsedScope = React.useMemo(() => parseCompanyScopeText(scopeText), [scopeText]);
    React.useEffect(() => {
        if (!open)
            return;
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
            if (errCount > 0)
                toast.warning(`已保存；${errCount} 行无效`);
            else
                toast.success(`已追加 ${res.added} 条范围`);
            showScopeWarnings(res.warnings);
            setOpen(false);
            onSaved();
        }
        catch (e) {
            toast.error(`保存失败：${String((e as Error)?.message ?? e)}`);
        }
        finally {
            setBusy(false);
        }
    };
    return (<Modal isOpen={open} onOpenChange={setOpen}>
      
        <Button size="sm" className="h-7" variant={"outline"}>
          追加
        </Button>
      
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label="关闭"/>
            <Modal.Header>
              <Modal.Heading>追加资产范围 · {company.name}</Modal.Heading>
              <Description>新范围会追加到现有范围。ICP 精确匹配资产，企业关键词仅作为 Agent 提示。</Description>
            </Modal.Header>
            <div className={`flex flex-col gap-4 ${"py-2"}`}>
              <ScopeTextEditor id={`append-company-scope-${company.id}`} value={scopeText} onValueChange={setScopeText} parsed={parsedScope}/>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="as-reason">归属依据（可选）</Label>
                <TextField className="contents" aria-label={"如 证书 / whois / ASN 佐证"}>
                  <Input id="as-reason" placeholder="如 证书 / whois / ASN 佐证" value={reason} onChange={(e) => setReason(e.target.value)}/>
                </TextField>
              </div>
            </div>
            <Modal.Footer>
              <Button onPress={() => setOpen(false)} isDisabled={busy} variant={"outline"}>
                取消
              </Button>
              <Button onPress={submit} isDisabled={busy || parsedScope.rules.length === 0 || parsedScope.errors.length > 0}>
                {busy ? "保存中…" : "追加"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>);
}
