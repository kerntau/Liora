import * as React from "react";

import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayoutTemplateIcon,
  LinkIcon,
  type LucideIcon,
  NetworkIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
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
function MethodBadge({ method }: { method: string }) {
  const normalized = method.toUpperCase();
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 font-mono font-semibold text-[10px] leading-none",
        METHOD_COLOR[normalized] ?? "bg-surface-secondary text-muted",
      )}
    >
      {normalized || "—"}
    </span>
  );
}
function statusTone(code: number) {
  if (code >= 500) return "text-danger";
  if (code >= 400) return "text-warning";
  if (code >= 300) return "text-accent";
  if (code >= 200) return "text-success";
  return "text-muted";
}
function fmtBytes(value?: number | null) {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
  const units = ["B", "KB", "MB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${index === 0 ? value : (value / 1024 ** index).toFixed(1)} ${units[index]}`;
}
function Chips({ items, mono }: { items: string[]; mono?: boolean }) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return <span className="text-muted text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {clean.map((item) => (
        <Chip
          key={item}
          className={cn(mono && "font-mono")}
          size="small"
          variant="outlined"
          label={<span>{item}</span>}
        />
      ))}
    </div>
  );
}
function SourceCell({ asset }: { asset: Asset }) {
  const source = firstText([asset.task_source], "legacy");
  const summary = firstText([asset.task_source_summary], "由历史任务资产关联迁移，暂无更详细来源说明");
  return (
    <Tooltip
      title={
        <Box sx={{ maxWidth: 360 }}>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium">{taskAssetSourceLabel(source)}</span>
            <span className="[overflow-wrap:anywhere]">{summary}</span>
            {asset.task_source_node_id ? (
              <span className="font-mono opacity-80">来源节点 #{asset.task_source_node_id}</span>
            ) : null}
          </div>
        </Box>
      }
      placement="left"
    >
      <Chip
        tabIndex={0}
        className="max-w-28 shrink-0 font-normal"
        size="small"
        variant="outlined"
        label={
          <span>
            <span className="truncate">{taskAssetSourceLabel(source)}</span>
          </span>
        }
      />
    </Tooltip>
  );
}
function AssetCard({
  children,
  cols,
  loaded,
  onPage,
  onSize,
  page,
  size,
  total,
}: {
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
    tableRows = (
      <TableRow>
        <TableCell colSpan={cols.length} className="py-14 text-center">
          <CircularProgress size={18} aria-label="加载中" />
        </TableCell>
      </TableRow>
    );
  } else if (rows.length > 0) {
    tableRows = rows;
  } else {
    tableRows = (
      <TableRow>
        <TableCell colSpan={cols.length} className="py-10 text-center text-muted text-sm">
          当前分类暂无测试资产
        </TableCell>
      </TableRow>
    );
  }
  return (
    <Card className="flex min-h-0 flex-1 flex-col py-0" sx={{ minWidth: 0 }}>
      <CardContent
        className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-auto p-0"
        sx={{ p: 0 }}
      >
        <TableContainer>
          <Table
            size="small"
            aria-label="测试资产列表"
            sx={{ minWidth: cols.length > 6 ? 960 : 640, "& th": { whiteSpace: "nowrap" } }}
          >
            <TableHead className="sticky top-0 z-10 bg-surface">
              <TableRow>
                {cols.map((column) => (
                  <TableCell key={column}>{column}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>{tableRows}</TableBody>
          </Table>
        </TableContainer>
      </CardContent>
      {total > 0 ? (
        <CardActions className="gap-2 px-3 py-1.5 text-muted text-xs" sx={{ flexWrap: "wrap", gap: 1, px: 2, py: 1 }}>
          <Select
            size="small"
            value={String(size)}
            onChange={(event) => {
              onSize(Number(event.target.value));
              onPage(0);
            }}
            inputProps={{ "aria-label": "每页数量" }}
            sx={{ minWidth: 100 }}
          >
            {PAGE_SIZES.map((value) => (
              <MenuItem key={value} value={String(value)}>
                {value} / 页
              </MenuItem>
            ))}
          </Select>
          <span className="tabular-nums">
            {start}–{end} / {total}
          </span>
          {pageCount > 1 ? (
            <div className="ml-auto flex items-center gap-2">
              <IconButton
                disabled={page <= 0}
                onClick={() => onPage(Math.max(0, page - 1))}
                aria-label="上一页"
                size="small"
              >
                <ChevronLeftIcon />
              </IconButton>
              <span className="tabular-nums">
                {page + 1} / {pageCount}
              </span>
              <IconButton
                disabled={page + 1 >= pageCount}
                onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
                aria-label="下一页"
                size="small"
              >
                <ChevronRightIcon />
              </IconButton>
            </div>
          ) : null}
        </CardActions>
      ) : null}
    </Card>
  );
}
function AddTaskAssetsSheet({
  onAttached,
  onOpenChange,
  open,
  taskId,
}: {
  onAttached: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  taskId: string;
}) {
  const [scopeText, setScopeText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const parsedScope = React.useMemo(() => parseCompanyScopeText(scopeText), [scopeText]);
  React.useEffect(() => {
    if (!open) return;
    setScopeText("");
  }, [open]);
  const attach = async () => {
    if (parsedScope.rules.length === 0 || parsedScope.errors.length > 0) return;
    setSaving(true);
    try {
      const result = await api.registerTaskAssetScopes(taskId, parsedScope.rules);
      const assetSummary = result.assets_linked + result.assets_existing;
      toast.success(`已登记 ${result.requested} 条范围，关联 ${assetSummary} 项域名/IP 资产`);
      onAttached();
      onOpenChange(false);
    } catch (reason) {
      toast.error(`新增失败：${String((reason as Error)?.message ?? reason)}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => {
        if (!saving) onOpenChange(false);
      }}
      slotProps={{ paper: { sx: { width: 560, maxWidth: "100vw" } } }}
    >
      <Stack role="dialog" aria-labelledby="task-add-assets-title" sx={{ height: "100%", minHeight: 0 }}>
        <Box sx={{ p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Typography component="h2" variant="h6" id="task-add-assets-title">
              新增测试资产
            </Typography>
            <IconButton aria-label="关闭新增测试资产" disabled={saving} onClick={() => onOpenChange(false)}>
              <XIcon size={20} />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            直接填写测试范围。域名和 IP 会创建或复用全局资产；CIDR、ICP 和关键词作为 Agent 范围上下文。
          </Typography>
        </Box>
        <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", p: 2 }} data-scrollbar="thin" data-slot="scroll-shadow">
          <ScopeTextEditor
            id="task-asset-scope"
            value={scopeText}
            onValueChange={setScopeText}
            parsed={parsedScope}
            label="测试资产与范围"
            description="每行一条，自动识别域名、IP、CIDR、ICP 备案和关键词。"
          />
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{ justifyContent: "flex-end", borderTop: 1, borderColor: "divider", p: 2 }}
        >
          <Button onClick={() => onOpenChange(false)} disabled={saving} size="small" variant="outlined">
            取消
          </Button>
          <Button
            onClick={() => void attach()}
            disabled={saving || parsedScope.rules.length === 0 || parsedScope.errors.length > 0}
            size="small"
            variant="contained"
          >
            {saving ? <CircularProgress size={18} aria-label="加载中" /> : <PlusIcon data-icon="inline-start" />}
            登记 {parsedScope.rules.length > 0 ? parsedScope.rules.length : ""} 条
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
export function AssetsTab({ taskId }: { taskId: string }) {
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
        if (!active || assetsRequestRef.current !== request) return;
        setRows(current.assets);
        setTotal(current.total);
        setCounts(nextCounts ?? {});
        setDslError("");
      } catch (reason) {
        if (!active || assetsRequestRef.current !== request) return;
        const message = String((reason as Error)?.message ?? reason);
        if (dsl) {
          setDslError(message);
          setRows([]);
          setTotal(0);
        } else {
          toast.error(`加载任务资产失败：${message}`);
        }
      } finally {
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
    if (page > maxPage) setPage(maxPage);
  }, [page, size, total]);
  const refresh = React.useCallback(() => {
    setLoaded(false);
    setRefreshKey((current) => current + 1);
  }, []);
  const remove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.detachTaskAsset(taskId, removeTarget.id);
      toast.success(`已将 ${assetLabel(removeTarget)} 移出当前任务`);
      setRemoveTarget(null);
      refresh();
    } catch (reason) {
      toast.error(`移出失败：${String((reason as Error)?.message ?? reason)}`);
    } finally {
      setRemoving(false);
    }
  };
  const removeButton = (asset: Asset) => (
    <IconButton onClick={() => setRemoveTarget(asset)} aria-label={`将资产 ${assetLabel(asset)} 移出任务`} size="small">
      <Trash2Icon />
    </IconButton>
  );
  const commonCardProps = { loaded, onPage: setPage, onSize: setSize, page, size, total };
  const totalAll = TABS.reduce((sum, item) => sum + (counts[item.key] ?? 0), 0);
  const searchBox = (
    <AssetDslSearch
      query={query}
      onChange={setQuery}
      loading={loading}
      error={dslError}
      count={dslMode ? total : undefined}
    />
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium text-sm">测试资产</h2>
          <p className="text-muted text-xs">当前任务共关联 {totalAll} 项资产</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="small" variant="contained">
          <PlusIcon data-icon="inline-start" />
          新增测试资产
        </Button>
      </div>

      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }}>
        <div className="overflow-x-auto overflow-y-hidden">
          <Tabs
            value={tab}
            onChange={(_, value: NewAssetType) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="资产分类"
          >
            {TABS.map((item) => (
              <Tab
                key={item.key}
                value={item.key}
                id={`task-asset-tab-${item.key}`}
                aria-controls={`task-asset-panel-${item.key}`}
                label={
                  <span className="inline-flex items-center gap-1">
                    <item.icon data-icon="inline-start" />
                    {item.label}
                    <span className="text-muted tabular-nums">{counts[item.key] ?? 0}</span>
                  </span>
                }
              />
            ))}
          </Tabs>
        </div>

        {searchBox}

        {tab === "root_domain" && (
          <Box
            role="tabpanel"
            id="task-asset-panel-root_domain"
            aria-labelledby="task-asset-tab-root_domain"
            sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
          >
            <AssetCard cols={["域名", "ICP 备案", "来源", "操作"]} {...commonCardProps}>
              {rows.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium font-mono text-xs">{asset.domain}</TableCell>
                  <TableCell className="text-xs">{asset.icp || "—"}</TableCell>
                  <TableCell>
                    <SourceCell asset={asset} />
                  </TableCell>
                  <TableCell className="w-16">{removeButton(asset)}</TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </Box>
        )}

        {tab === "ip" && (
          <Box
            role="tabpanel"
            id="task-asset-panel-ip"
            aria-labelledby="task-asset-tab-ip"
            sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
          >
            <AssetCard cols={["IP", "C段", "绑定域名", "开放端口", "来源", "操作"]} {...commonCardProps}>
              {rows.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium font-mono text-xs">{asset.ip}</TableCell>
                  <TableCell className="font-mono text-xs">{asset.c_segment || "—"}</TableCell>
                  <TableCell>
                    <Chips items={asset.bound_domains ?? []} mono />
                  </TableCell>
                  <TableCell>
                    <Chips
                      items={(asset.open_ports ?? []).map((item) =>
                        item.service ? `${item.port}/${item.service}` : String(item.port),
                      )}
                      mono
                    />
                  </TableCell>
                  <TableCell>
                    <SourceCell asset={asset} />
                  </TableCell>
                  <TableCell className="w-16">{removeButton(asset)}</TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </Box>
        )}

        {tab === "subdomain" && (
          <Box
            role="tabpanel"
            id="task-asset-panel-subdomain"
            aria-labelledby="task-asset-tab-subdomain"
            sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
          >
            <AssetCard cols={["域名", "根域名", "解析类型", "解析值", "来源", "操作"]} {...commonCardProps}>
              {rows.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-medium font-mono text-xs">{asset.domain}</TableCell>
                  <TableCell className="font-mono text-xs">{asset.root_domain || "—"}</TableCell>
                  <TableCell className="text-xs">{asset.record_type || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs">
                    {(Array.isArray(asset.record_value) ? asset.record_value.join(", ") : asset.record_value) || "—"}
                  </TableCell>
                  <TableCell>
                    <SourceCell asset={asset} />
                  </TableCell>
                  <TableCell className="w-16">{removeButton(asset)}</TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </Box>
        )}

        {tab === "app" && (
          <Box
            role="tabpanel"
            id="task-asset-panel-app"
            aria-labelledby="task-asset-tab-app"
            sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
          >
            <AssetCard cols={["应用", "地址", "分类", "标题", "指纹", "来源", "操作"]} {...commonCardProps}>
              {rows.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="max-w-48 truncate font-medium text-xs">{asset.app_name || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs">
                    <span title={asset.url} className="block truncate">
                      {asset.url || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{asset.category || "—"}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs">{asset.page_title || "—"}</TableCell>
                  <TableCell>
                    <Chips items={asset.technologies ?? []} />
                  </TableCell>
                  <TableCell>
                    <SourceCell asset={asset} />
                  </TableCell>
                  <TableCell className="w-16">{removeButton(asset)}</TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </Box>
        )}

        {tab === "service" && (
          <Box
            role="tabpanel"
            id="task-asset-panel-service"
            aria-labelledby="task-asset-tab-service"
            sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
          >
            <AssetCard
              cols={["地址 / 服务", "状态码", "标题", "响应长度", "指纹", "认证", "来源", "操作"]}
              {...commonCardProps}
            >
              {rows.map((asset) => {
                const isHttp = asset.service_type === "http";
                const address = isHttp
                  ? asset.url || ""
                  : asset.service_name || [asset.ip || asset.domain, asset.port].filter(Boolean).join(":");
                return (
                  <TableRow key={asset.id}>
                    <TableCell className="max-w-xs truncate font-mono text-xs">
                      <span title={address} className="block truncate">
                        {address || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {asset.status_code != null ? (
                        <span
                          className={cn("font-mono font-semibold text-xs tabular-nums", statusTone(asset.status_code))}
                        >
                          {asset.status_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs">{asset.page_title || "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmtBytes(asset.content_length)}</TableCell>
                    <TableCell>
                      <Chips items={asset.technologies ?? []} />
                    </TableCell>
                    <TableCell>
                      {(asset.auth ?? []).length === 0 ? (
                        <span className="text-muted text-xs">—</span>
                      ) : (
                        (asset.auth ?? []).map((authItem) => {
                          const item = authItem as Record<string, string>;
                          return (
                            <span
                              key={`${asset.id}-${item.type ?? ""}-${item.username ?? ""}-${JSON.stringify(item)}`}
                              className="inline-flex items-center gap-1 text-[11px]"
                            >
                              <KeyRoundIcon className="size-3 text-muted" />
                              <span className="font-mono">{item.type || item.username || "认证"}</span>
                            </span>
                          );
                        })
                      )}
                    </TableCell>
                    <TableCell>
                      <SourceCell asset={asset} />
                    </TableCell>
                    <TableCell className="w-16">{removeButton(asset)}</TableCell>
                  </TableRow>
                );
              })}
            </AssetCard>
          </Box>
        )}

        {tab === "endpoint" && (
          <Box
            role="tabpanel"
            id="task-asset-panel-endpoint"
            aria-labelledby="task-asset-tab-endpoint"
            sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
          >
            <AssetCard cols={["方法", "完整地址", "参数", "来源", "操作"]} {...commonCardProps}>
              {rows.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="w-16">
                    <MethodBadge method={asset.method || ""} />
                  </TableCell>
                  <TableCell className="max-w-sm truncate font-mono text-xs">
                    <span title={asset.url} className="block truncate">
                      {asset.url || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chips
                      items={(asset.params ?? []).map((param) => {
                        const item = param as Record<string, string>;
                        return item.name ? `${item.name}(${item.location || item.in || "?"})` : "?";
                      })}
                      mono
                    />
                  </TableCell>
                  <TableCell>
                    <SourceCell asset={asset} />
                  </TableCell>
                  <TableCell className="w-16">{removeButton(asset)}</TableCell>
                </TableRow>
              ))}
            </AssetCard>
          </Box>
        )}
      </Box>

      <AddTaskAssetsSheet onAttached={refresh} onOpenChange={setAddOpen} open={addOpen} taskId={taskId} />

      <Dialog
        open={Boolean(removeTarget)}
        onClose={() => {
          if (!removing) setRemoveTarget(null);
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="remove-task-asset-title"
      >
        <DialogTitle id="remove-task-asset-title">移出当前任务？</DialogTitle>
        <DialogContent sx={{ overflowWrap: "anywhere" }}>
          {removeTarget ? `将“${assetLabel(removeTarget)}”从当前任务的测试资产中移出。` : ""}
          全局资产、关联流量和历史黑板锚点会继续保留。
        </DialogContent>
        <DialogActions>
          <Button disabled={removing} size="small" variant="outlined" onClick={() => setRemoveTarget(null)}>
            取消
          </Button>
          <Button
            disabled={removing}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
            size="small"
            variant="contained"
            color="error"
          >
            {removing ? <CircularProgress size={18} aria-label="加载中" /> : <Trash2Icon data-icon="inline-start" />}
            {removing ? "移出中" : "确认移出"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
