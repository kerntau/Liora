import * as React from "react";
import { AlertDialog, Button, Card, Chip, Description, Drawer, ListBox, ScrollShadow, Select, Spinner, Table, Tabs, Tooltip, } from "@heroui/react";
import { ChevronLeftIcon, ChevronRightIcon, GlobeIcon, KeyRoundIcon, LayoutTemplateIcon, LinkIcon, type LucideIcon, NetworkIcon, PlusIcon, SmartphoneIcon, Trash2Icon, } from "lucide-react";
import { toast } from "sonner";
import { AssetDslSearch } from "@/components/asset-dsl-search";
import { ScopeTextEditor } from "@/components/scope-text-editor";
import { api } from "@/lib/api";
import { parseCompanyScopeText } from "@/lib/company-scope";
import { taskAssetSourceLabel } from "@/lib/task-assets";
import type { Asset, NewAssetType } from "@/lib/types";
import { cn } from "@/lib/utils";
const PAGE_SIZES = [25, 50, 100, 200];
const METHOD_COLOR: Record<string, string> = {
    DELETE: "bg-danger-soft text-danger",
    GET: "bg-success-soft text-success",
    HEAD: "bg-accent-soft text-accent",
    OPTIONS: "bg-surface-secondary text-muted",
    PATCH: "bg-warning-soft text-warning",
    POST: "bg-accent-soft text-accent",
    PUT: "bg-warning-soft text-warning",
};
const TABS: {
    key: NewAssetType;
    label: string;
    icon: LucideIcon;
}[] = [
    { key: "root_domain", label: "根域名", icon: GlobeIcon },
    { key: "ip", label: "IP", icon: NetworkIcon },
    { key: "subdomain", label: "子域名", icon: GlobeIcon },
    { key: "app", label: "应用", icon: SmartphoneIcon },
    { key: "service", label: "服务", icon: LayoutTemplateIcon },
    { key: "endpoint", label: "接口", icon: LinkIcon },
];
function firstText(values: Array<string | undefined>, fallback: string): string {
    return values.find((value) => value?.trim()) ?? fallback;
}
function assetLabel(asset: Asset): string {
    switch (asset.type) {
        case "root_domain":
        case "subdomain":
            return firstText([asset.domain], `#${asset.id}`);
        case "ip":
            return firstText([asset.ip], `#${asset.id}`);
        case "app":
            return firstText([asset.app_name, asset.url], `#${asset.id}`);
        case "service": {
            const host = firstText([asset.ip, asset.domain], "");
            const address = [host, asset.port].filter((value) => value !== undefined && value !== "").join(":");
            return firstText([asset.url, address, asset.service_name], `#${asset.id}`);
        }
        case "endpoint":
            return firstText([[asset.method, asset.url].filter(Boolean).join(" ")], `#${asset.id}`);
    }
}
function MethodBadge({ method }: {
    method: string;
}) {
    const normalized = method.toUpperCase();
    return (<span className={cn("inline-block rounded px-1.5 py-0.5 font-mono font-semibold text-[10px] leading-none", METHOD_COLOR[normalized] ?? "bg-surface-secondary text-muted")}>
      {normalized || "—"}
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
function fmtBytes(value?: number | null) {
    if (!value || !Number.isFinite(value) || value <= 0)
        return "—";
    const units = ["B", "KB", "MB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${index === 0 ? value : (value / 1024 ** index).toFixed(1)} ${units[index]}`;
}
function Chips({ items, mono }: {
    items: string[];
    mono?: boolean;
}) {
    const clean = items.filter(Boolean);
    if (clean.length === 0)
        return <span className="text-muted text-xs">—</span>;
    return (<div className="flex flex-wrap gap-1">
      {clean.map((item) => (<Chip key={item} className={cn(mono && "font-mono")} size="sm" variant={"secondary"}>
          {item}
        </Chip>))}
    </div>);
}
function SourceCell({ asset }: {
    asset: Asset;
}) {
    const source = firstText([asset.task_source], "legacy");
    const summary = firstText([asset.task_source_summary], "由历史任务资产关联迁移，暂无更详细来源说明");
    return (<Tooltip>
      <Chip className="max-w-28 shrink-0 font-normal" size="sm" variant={"secondary"}>
        <span className="truncate">{taskAssetSourceLabel(source)}</span>
      </Chip>

      <Tooltip.Content placement="left" className="max-w-sm">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-medium">{taskAssetSourceLabel(source)}</span>
          <span className="[overflow-wrap:anywhere]">{summary}</span>
          {asset.task_source_node_id ? (<span className="font-mono opacity-80">来源节点 #{asset.task_source_node_id}</span>) : null}
        </div>
      </Tooltip.Content>
    </Tooltip>);
}
function AssetCard({ children, cols, loaded, onPage, onSize, page, size, total, }: {
    children: React.ReactNode;
    cols: string[];
    loaded: boolean;
    onPage: (page: number) => void;
    onSize: (size: number) => void;
    page: number;
    size: number;
    total: number;
}) {
    const rows = React.Children.toArray(children);
    const pageCount = Math.max(1, Math.ceil(total / size));
    const start = total === 0 ? 0 : page * size + 1;
    const end = Math.min(total, page * size + rows.length);
    let tableRows: React.ReactNode;
    if (!loaded) {
        tableRows = (<Table.Row id="empty-5361">
        <Table.Cell colSpan={cols.length} className="py-14 text-center">
          <Spinner className="mx-auto"/>
        </Table.Cell>
      </Table.Row>);
    }
    else if (rows.length > 0) {
        tableRows = rows;
    }
    else {
        tableRows = (<Table.Row id="empty-5632">
        <Table.Cell colSpan={cols.length} className="py-10 text-center text-muted text-sm">
          当前分类暂无测试资产
        </Table.Cell>
      </Table.Row>);
    }
    return (<Card className="flex min-h-0 flex-1 flex-col py-0">
      <Card.Content className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-auto p-0">
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="数据表">
              <Table.Header className="sticky top-0 z-10 bg-surface">
                {cols.map((column) => (<Table.Column key={column} isRowHeader id={column}>
                    {column}
                  </Table.Column>))}
              </Table.Header>
              <Table.Body>{tableRows}</Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card.Content>
      {total > 0 ? (<Card.Footer className="gap-2 px-3 py-1.5 text-muted text-xs">
          <Select selectedKey={String(size)} aria-label="选择选项" onSelectionChange={(key) => {
                if (key !== null)
                    ((value) => {
                        onSize(Number(value));
                        onPage(0);
                    })(String(key));
            }}>
            <Select.Trigger className="w-24">
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <>
                  {PAGE_SIZES.map((value) => (<ListBox.Item key={value} id={String(value)} textValue="/ 页">
                      {value} / 页
                    </ListBox.Item>))}
                </>
              </ListBox>
            </Select.Popover>
          </Select>
          <span className="tabular-nums">
            {start}–{end} / {total}
          </span>
          {pageCount > 1 ? (<div className="ml-auto flex items-center gap-2">
              <Button isDisabled={page <= 0} onPress={() => onPage(Math.max(0, page - 1))} aria-label="上一页" size="sm" isIconOnly variant={"outline"}>
                <ChevronLeftIcon />
              </Button>
              <span className="tabular-nums">
                {page + 1} / {pageCount}
              </span>
              <Button isDisabled={page + 1 >= pageCount} onPress={() => onPage(Math.min(pageCount - 1, page + 1))} aria-label="下一页" size="sm" isIconOnly variant={"outline"}>
                <ChevronRightIcon />
              </Button>
            </div>) : null}
        </Card.Footer>) : null}
    </Card>);
}
function AddTaskAssetsSheet({ onAttached, onOpenChange, open, taskId, }: {
    onAttached: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    taskId: string;
}) {
    const [scopeText, setScopeText] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const parsedScope = React.useMemo(() => parseCompanyScopeText(scopeText), [scopeText]);
    React.useEffect(() => {
        if (!open)
            return;
        setScopeText("");
    }, [open]);
    const attach = async () => {
        if (parsedScope.rules.length === 0 || parsedScope.errors.length > 0)
            return;
        setSaving(true);
        try {
            const result = await api.registerTaskAssetScopes(taskId, parsedScope.rules);
            const assetSummary = result.assets_linked + result.assets_existing;
            toast.success(`已登记 ${result.requested} 条范围，关联 ${assetSummary} 项域名/IP 资产`);
            onAttached();
            onOpenChange(false);
        }
        catch (reason) {
            toast.error(`新增失败：${String((reason as Error)?.message ?? reason)}`);
        }
        finally {
            setSaving(false);
        }
    };
    return (
      <Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="w-full sm:max-w-xl">
            <Drawer.CloseTrigger aria-label="关闭"/>
            <Drawer.Header>
              <Drawer.Heading>新增测试资产</Drawer.Heading>
              <Description>
                直接填写测试范围。域名和 IP 会创建或复用全局资产；CIDR、ICP 和关键词作为 Agent 范围上下文。
              </Description>
            </Drawer.Header>
            <ScrollShadow className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4" data-scrollbar="thin" data-slot="scroll-shadow">
              <ScopeTextEditor id="task-asset-scope" value={scopeText} onValueChange={setScopeText} parsed={parsedScope} label="测试资产与范围" description="每行一条，自动识别域名、IP、CIDR、ICP 备案和关键词。"/>
            </ScrollShadow>
            <Drawer.Footer>
              <Button onPress={() => onOpenChange(false)} isDisabled={saving} variant={"outline"}>
                取消
              </Button>
              <Button onPress={() => void attach()} isDisabled={saving || parsedScope.rules.length === 0 || parsedScope.errors.length > 0}>
                {saving ? <Spinner data-icon="inline-start"/> : <PlusIcon data-icon="inline-start"/>}
                登记 {parsedScope.rules.length > 0 ? parsedScope.rules.length : ""} 条
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    );
}
export function AssetsTab({ taskId }: {
    taskId: string;
}) {
    const [rows, setRows] = React.useState<Asset[]>([]);
    const [total, setTotal] = React.useState(0);
    const [counts, setCounts] = React.useState<Record<string, number>>({});
    const [loaded, setLoaded] = React.useState(false);
    const [tab, setTab] = React.useState<NewAssetType>("root_domain");
    const [page, setPage] = React.useState(0);
    const [size, setSize] = React.useState(50);
    const [query, setQuery] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [dslError, setDslError] = React.useState("");
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [addOpen, setAddOpen] = React.useState(false);
    const [removeTarget, setRemoveTarget] = React.useState<Asset | null>(null);
    const [removing, setRemoving] = React.useState(false);
    const assetsRequestRef = React.useRef(0);
    const dslMode = query.trim() !== "";
    React.useEffect(() => {
        setPage(0);
        setRows([]);
        setLoaded(false);
    }, []);
    // Switching type tabs resets the search (DSL fields differ per type; matches
    // the global asset view).
    // biome-ignore lint/correctness/useExhaustiveDependencies: tab changes intentionally reset tab-local controls.
    React.useEffect(() => {
        setQuery("");
        setDslError("");
    }, [tab]);
    // Query / tab / page-size changes restart server pagination.
    // biome-ignore lint/correctness/useExhaustiveDependencies: these controls intentionally reset server pagination.
    React.useEffect(() => setPage(0), [tab, size, query]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey is an explicit manual-reload trigger.
    React.useEffect(() => {
        let active = true;
        const dsl = query.trim();
        const request = ++assetsRequestRef.current;
        const load = async () => {
            setLoading(true);
            try {
                // The search always stays within this task's assets: taskAssets and
                // searchTaskAssets both pin task_id server-side.
                const [current, nextCounts] = await Promise.all([
                    dsl
                        ? api.searchTaskAssets(taskId, dsl, tab, size, page * size)
                        : api.taskAssets(taskId, tab, size, page * size),
                    api.assetCounts(taskId),
                ]);
                if (!active || assetsRequestRef.current !== request)
                    return;
                setRows(current.assets);
                setTotal(current.total);
                setCounts(nextCounts ?? {});
                setDslError("");
            }
            catch (reason) {
                if (!active || assetsRequestRef.current !== request)
                    return;
                const message = String((reason as Error)?.message ?? reason);
                if (dsl) {
                    setDslError(message);
                    setRows([]);
                    setTotal(0);
                }
                else {
                    toast.error(`加载任务资产失败：${message}`);
                }
            }
            finally {
                if (active && assetsRequestRef.current === request) {
                    setLoading(false);
                    setLoaded(true);
                }
            }
        };
        // Debounce DSL keystrokes; plain (re)loads and polling run immediately.
        const debounce = setTimeout(() => void load(), dsl ? 400 : 0);
        const timer = setInterval(() => void load(), 10000);
        return () => {
            active = false;
            clearTimeout(debounce);
            clearInterval(timer);
        };
    }, [page, query, refreshKey, size, tab, taskId]);
    React.useEffect(() => {
        const maxPage = Math.max(0, Math.ceil(total / size) - 1);
        if (page > maxPage)
            setPage(maxPage);
    }, [page, size, total]);
    const refresh = React.useCallback(() => {
        setLoaded(false);
        setRefreshKey((current) => current + 1);
    }, []);
    const remove = async () => {
        if (!removeTarget)
            return;
        setRemoving(true);
        try {
            await api.detachTaskAsset(taskId, removeTarget.id);
            toast.success(`已将 ${assetLabel(removeTarget)} 移出当前任务`);
            setRemoveTarget(null);
            refresh();
        }
        catch (reason) {
            toast.error(`移出失败：${String((reason as Error)?.message ?? reason)}`);
        }
        finally {
            setRemoving(false);
        }
    };
    const removeButton = (asset: Asset) => (<Button onPress={() => setRemoveTarget(asset)} aria-label={`将资产 ${assetLabel(asset)} 移出任务`} size="sm" isIconOnly variant={"ghost"}>
      <Trash2Icon />
    </Button>);
    const commonCardProps = { loaded, onPage: setPage, onSize: setSize, page, size, total };
    const totalAll = TABS.reduce((sum, item) => sum + (counts[item.key] ?? 0), 0);
    const searchBox = (<AssetDslSearch query={query} onChange={setQuery} loading={loading} error={dslError} count={dslMode ? total : undefined}/>);
    return (<div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium text-sm">测试资产</h2>
          <p className="text-muted text-xs">当前任务共关联 {totalAll} 项资产</p>
        </div>
        <Button size="sm" onPress={() => setAddOpen(true)}>
          <PlusIcon data-icon="inline-start"/>
          新增测试资产
        </Button>
      </div>

      <Tabs selectedKey={tab} className="flex min-h-0 flex-1 flex-col gap-2" onSelectionChange={(key) => ((value) => setTab(value as NewAssetType))(String(key))}>
        <div className="overflow-x-auto overflow-y-hidden">
          <Tabs.ListContainer>
            <Tabs.List className="w-max">
              {TABS.map((item) => (<Tabs.Tab key={item.key} id={item.key}>
                  <item.icon data-icon="inline-start"/>
                  {item.label}
                  <span className="text-muted tabular-nums">{counts[item.key] ?? 0}</span>
                  <Tabs.Indicator />
                </Tabs.Tab>))}
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        {searchBox}

        <Tabs.Panel id="root_domain" className="mt-0 flex min-h-0 flex-1 flex-col">
          <AssetCard cols={["域名", "ICP 备案", "来源", "操作"]} {...commonCardProps}>
            {rows.map((asset) => (<Table.Row key={asset.id} id={asset.id}>
                <Table.Cell className="font-medium font-mono text-xs">{asset.domain}</Table.Cell>
                <Table.Cell className="text-xs">{asset.icp || "—"}</Table.Cell>
                <Table.Cell>
                  <SourceCell asset={asset}/>
                </Table.Cell>
                <Table.Cell className="w-16">{removeButton(asset)}</Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        <Tabs.Panel id="ip" className="mt-0 flex min-h-0 flex-1 flex-col">
          <AssetCard cols={["IP", "C段", "绑定域名", "开放端口", "来源", "操作"]} {...commonCardProps}>
            {rows.map((asset) => (<Table.Row key={asset.id} id={asset.id}>
                <Table.Cell className="font-medium font-mono text-xs">{asset.ip}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{asset.c_segment || "—"}</Table.Cell>
                <Table.Cell>
                  <Chips items={asset.bound_domains ?? []} mono/>
                </Table.Cell>
                <Table.Cell>
                  <Chips items={(asset.open_ports ?? []).map((item) => item.service ? `${item.port}/${item.service}` : String(item.port))} mono/>
                </Table.Cell>
                <Table.Cell>
                  <SourceCell asset={asset}/>
                </Table.Cell>
                <Table.Cell className="w-16">{removeButton(asset)}</Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        <Tabs.Panel id="subdomain" className="mt-0 flex min-h-0 flex-1 flex-col">
          <AssetCard cols={["域名", "根域名", "解析类型", "解析值", "来源", "操作"]} {...commonCardProps}>
            {rows.map((asset) => (<Table.Row key={asset.id} id={asset.id}>
                <Table.Cell className="font-medium font-mono text-xs">{asset.domain}</Table.Cell>
                <Table.Cell className="font-mono text-xs">{asset.root_domain || "—"}</Table.Cell>
                <Table.Cell className="text-xs">{asset.record_type || "—"}</Table.Cell>
                <Table.Cell className="max-w-xs truncate font-mono text-xs">
                  {(Array.isArray(asset.record_value) ? asset.record_value.join(", ") : asset.record_value) || "—"}
                </Table.Cell>
                <Table.Cell>
                  <SourceCell asset={asset}/>
                </Table.Cell>
                <Table.Cell className="w-16">{removeButton(asset)}</Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        <Tabs.Panel id="app" className="mt-0 flex min-h-0 flex-1 flex-col">
          <AssetCard cols={["应用", "地址", "分类", "标题", "指纹", "来源", "操作"]} {...commonCardProps}>
            {rows.map((asset) => (<Table.Row key={asset.id} id={asset.id}>
                <Table.Cell className="max-w-48 truncate font-medium text-xs">{asset.app_name || "—"}</Table.Cell>
                <Table.Cell className="max-w-xs truncate font-mono text-xs">
                  <span title={asset.url} className="block truncate">
                    {asset.url || "—"}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-xs">{asset.category || "—"}</Table.Cell>
                <Table.Cell className="max-w-48 truncate text-xs">{asset.page_title || "—"}</Table.Cell>
                <Table.Cell>
                  <Chips items={asset.technologies ?? []}/>
                </Table.Cell>
                <Table.Cell>
                  <SourceCell asset={asset}/>
                </Table.Cell>
                <Table.Cell className="w-16">{removeButton(asset)}</Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>

        <Tabs.Panel id="service" className="mt-0 flex min-h-0 flex-1 flex-col">
          <AssetCard cols={["地址 / 服务", "状态码", "标题", "响应长度", "指纹", "认证", "来源", "操作"]} {...commonCardProps}>
            {rows.map((asset) => {
            const isHttp = asset.service_type === "http";
            const address = isHttp
                ? asset.url || ""
                : asset.service_name || [asset.ip || asset.domain, asset.port].filter(Boolean).join(":");
            return (<Table.Row key={asset.id} id={asset.id}>
                  <Table.Cell className="max-w-xs truncate font-mono text-xs">
                    <span title={address} className="block truncate">
                      {address || "—"}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {asset.status_code != null ? (<span className={cn("font-mono font-semibold text-xs tabular-nums", statusTone(asset.status_code))}>
                        {asset.status_code}
                      </span>) : ("—")}
                  </Table.Cell>
                  <Table.Cell className="max-w-48 truncate text-xs">{asset.page_title || "—"}</Table.Cell>
                  <Table.Cell className="text-xs tabular-nums">{fmtBytes(asset.content_length)}</Table.Cell>
                  <Table.Cell>
                    <Chips items={asset.technologies ?? []}/>
                  </Table.Cell>
                  <Table.Cell>
                    {(asset.auth ?? []).length === 0 ? (<span className="text-muted text-xs">—</span>) : ((asset.auth ?? []).map((authItem) => {
                    const item = authItem as Record<string, string>;
                    return (<span key={`${asset.id}-${item.type ?? ""}-${item.username ?? ""}-${JSON.stringify(item)}`} className="inline-flex items-center gap-1 text-[11px]">
                            <KeyRoundIcon className="size-3 text-muted"/>
                            <span className="font-mono">{item.type || item.username || "认证"}</span>
                          </span>);
                }))}
                  </Table.Cell>
                  <Table.Cell>
                    <SourceCell asset={asset}/>
                  </Table.Cell>
                  <Table.Cell className="w-16">{removeButton(asset)}</Table.Cell>
                </Table.Row>);
        })}
          </AssetCard>
        </Tabs.Panel>

        <Tabs.Panel id="endpoint" className="mt-0 flex min-h-0 flex-1 flex-col">
          <AssetCard cols={["方法", "完整地址", "参数", "来源", "操作"]} {...commonCardProps}>
            {rows.map((asset) => (<Table.Row key={asset.id} id={asset.id}>
                <Table.Cell className="w-16">
                  <MethodBadge method={asset.method || ""}/>
                </Table.Cell>
                <Table.Cell className="max-w-sm truncate font-mono text-xs">
                  <span title={asset.url} className="block truncate">
                    {asset.url || "—"}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Chips items={(asset.params ?? []).map((param) => {
                const item = param as Record<string, string>;
                return item.name ? `${item.name}(${item.location || item.in || "?"})` : "?";
            })} mono/>
                </Table.Cell>
                <Table.Cell>
                  <SourceCell asset={asset}/>
                </Table.Cell>
                <Table.Cell className="w-16">{removeButton(asset)}</Table.Cell>
              </Table.Row>))}
          </AssetCard>
        </Tabs.Panel>
      </Tabs>

      <AddTaskAssetsSheet onAttached={refresh} onOpenChange={setAddOpen} open={addOpen} taskId={taskId}/>

      
        <AlertDialog.Backdrop isOpen={Boolean(removeTarget)} onOpenChange={(open) => !open && !removing && setRemoveTarget(null)}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>移出当前任务？</AlertDialog.Heading>
                <AlertDialog.Body className="[overflow-wrap:anywhere]">
                  {removeTarget ? `将“${assetLabel(removeTarget)}”从当前任务的测试资产中移出。` : ""}
                  全局资产、关联流量和历史黑板锚点会继续保留。
                </AlertDialog.Body>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <Button isDisabled={removing} slot="close" variant={"outline"}>
                  取消
                </Button>
                <Button isDisabled={removing} variant={"danger"} onClick={(event) => {
            event.preventDefault();
            void remove();
        }}>
                  {removing ? <Spinner data-icon="inline-start"/> : <Trash2Icon data-icon="inline-start"/>}
                  {removing ? "移出中" : "确认移出"}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      
    </div>);
}
