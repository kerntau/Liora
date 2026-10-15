import * as React from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  Select,
  Skeleton,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpToLineIcon,
  BugIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CompassIcon,
  FlagIcon,
  FlaskConicalIcon,
  LayersIcon,
  LightbulbIcon,
  type LucideIcon,
  SearchIcon,
  TargetIcon,
  XIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { type Tone, toneClasses, toneDot } from "@/lib/status";
import { taskAssetTypeLabel } from "@/lib/task-assets";
import type { Edge, ExploreKind, FindingAsset, NewAssetType, TaskNode } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [20, 50, 100];
const POLL_MS = 8000;
type KindMeta = {
  label: string;
  icon: LucideIcon;
  dot: string;
  chip: string;
};
// 播报板自己的展示元数据。刻意不复用探索链路图那份:图是拓扑视角(节点卡片、连线配色),
// 播报是流水视角(时间轴行),两边的信息密度和配色需求不同,各自演进更省事。
const KIND_META: Record<string, KindMeta> = {
  begin: {
    label: "起点",
    icon: FlagIcon,
    dot: "bg-surface-secondary",
    chip: "bg-surface-secondary/15 text-muted dark:text-muted",
  },
  task: {
    label: "根任务",
    icon: FlagIcon,
    dot: "bg-surface-secondary",
    chip: "bg-surface-secondary/15 text-muted dark:text-muted",
  },
  goal: {
    label: "目标",
    icon: TargetIcon,
    dot: "bg-success",
    chip: "bg-success/15 text-success dark:text-success",
  },
  intent: {
    label: "意图",
    icon: CompassIcon,
    dot: "bg-accent",
    chip: "bg-accent/15 text-accent dark:text-accent",
  },
  fact: {
    label: "事实",
    icon: FlaskConicalIcon,
    dot: "bg-warning",
    chip: "bg-warning/15 text-warning dark:text-warning",
  },
  finding: {
    label: "漏洞",
    icon: BugIcon,
    dot: "bg-danger",
    chip: "bg-danger/15 text-danger dark:text-danger",
  },
  hint: {
    label: "提示",
    icon: LightbulbIcon,
    dot: "bg-accent",
    chip: "bg-accent/15 text-accent dark:text-accent",
  },
  digest: {
    label: "压缩",
    icon: LayersIcon,
    dot: "bg-success",
    chip: "bg-success/15 text-success dark:text-success",
  },
};
// 可筛选的类型。起点(fact/state=origin)不单独列,它跟着「事实」一起过滤。
const FILTER_KINDS: ExploreKind[] = ["goal", "intent", "fact", "finding", "hint", "digest"];
const REL_LABEL: Record<string, string> = {
  spawns: "派生",
  derived_from: "意图链",
  yields: "产出",
  proves: "证明",
  covers: "压缩",
};
// goal / intent 的状态语义由全局 status 表提供(StatusBadge);其余类型的状态只在
// 图和播报里出现,这里补一份。
const STATE_META: Record<
  string,
  Record<
    string,
    {
      label: string;
      tone: Tone;
    }
  >
> = {
  fact: {
    origin: { label: "起点", tone: "slate" },
    confirmed: { label: "已确认", tone: "green" },
    dismissed: { label: "已否定", tone: "slate" },
  },
  finding: {
    confirmed: { label: "已确认", tone: "red" },
    dismissed: { label: "已排除", tone: "slate" },
  },
  hint: {
    active: { label: "待采纳", tone: "violet" },
    consumed: { label: "已采纳", tone: "slate" },
  },
  digest: {
    active: { label: "生效中", tone: "green" },
    superseded: { label: "已替代", tone: "slate" },
  },
};
// 任务根是 state=origin 的 fact,播报里读作「起点」。
function viewKind(n: TaskNode): string {
  return n.type === "fact" && n.state === "origin" ? "begin" : n.type;
}
const SUMMARY_FIELDS: Record<string, string[]> = {
  begin: ["summary", "description"],
  task: ["summary", "description"],
  goal: ["text"],
  intent: ["summary"],
  fact: ["summary"],
  finding: ["name", "summary"],
  hint: ["text", "summary"],
  digest: ["body", "summary"],
};
function summaryOf(n: TaskNode): string {
  const raw = n.payload ?? "";
  if (!raw.trim()) return "";
  for (const field of SUMMARY_FIELDS[viewKind(n)] ?? []) {
    try {
      const obj: unknown = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        const v = (obj as Record<string, unknown>)[field];
        if (typeof v === "string" && v.trim()) return v;
      }
    } catch {
      return raw; // 非 JSON payload:原样播报
    }
  }
  return raw;
}
function prettyPayload(raw?: string): string {
  if (!raw?.trim()) return "（无 payload）";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
function relTime(ts: number, now: number): string {
  if (!now || !ts) return "";
  const sec = Math.max(0, (now - ts) / 1000);
  if (sec < 60) return "刚刚";
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  return `${Math.floor(sec / 86400)} 天前`;
}
const dayFmt = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" });
const clockFmt = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
function NodeStateBadge({ node }: { node: TaskNode }) {
  if (node.type === "goal") return <StatusBadge domain="goal" value={node.state} dot />;
  if (node.type === "intent") return <StatusBadge domain="intent" value={node.state} dot />;
  const meta = STATE_META[node.type]?.[node.state];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[meta.tone],
      )}
    >
      <span className={cn("size-1.5 rounded-full", toneDot[meta.tone])} />
      {meta.label}
    </span>
  );
}
function KindChip({ kind }: { kind: string }) {
  const meta = KIND_META[kind] ?? KIND_META.fact;
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", meta.chip)}>{meta.label}</span>
  );
}
// 节点锚定的资产:类型标签 + 可辨识文本。数据随播报页一起下发(node id → 资产),
// 展开时直接展示,不额外请求。
function AssetList({ assets, dense = false }: { assets: FindingAsset[]; dense?: boolean }) {
  if (assets.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted">涉及资产 · {assets.length}</div>
      <ul className="flex flex-wrap gap-1.5">
        {assets.map((a) => {
          // 运行时 a.type 可能是标签表未覆盖的类型,退回原始字符串。转一层类型让回退不被判成多余。
          const typeLabel =
            (taskAssetTypeLabel as (t: NewAssetType) => string | undefined)(a.type as NewAssetType) || a.type;
          return (
            <li
              key={a.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-0.5",
                dense && "text-xs",
              )}
              title={`${typeLabel} · ${a.label}`}
            >
              <span className="shrink-0 rounded bg-surface-secondary px-1 text-[10px] text-muted">{typeLabel}</span>
              <code className="min-w-0 break-all font-mono text-xs">{a.label}</code>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
// 悬停在上下游条目上时弹出的节点名片:类型/状态/来源/时间 + 摘要 + payload 片段 + 涉及资产。
// 数据来自本页已经拿到的 refs,不额外发请求——播报接口已经把邻居节点整份带回来了。
function RelatedNodeCard({ node, assets }: { node: TaskNode; assets: FindingAsset[] }) {
  const kind = viewKind(node);
  const meta = KIND_META[kind] ?? KIND_META.fact;
  const ts = Date.parse(node.ts);
  const summary = summaryOf(node);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <KindChip kind={kind} />
        <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs text-muted">#{node.id}</code>
        <NodeStateBadge node={node} />
        {node.priority > 0 && (kind === "goal" || kind === "intent") && (
          <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-xs text-muted">P{node.priority}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span>类型 {meta.label}</span>
        <span>来源 {node.origin || "system"}</span>
        <span>{Number.isNaN(ts) ? node.ts : new Date(ts).toLocaleString("zh-CN")}</span>
      </div>
      <p className="line-clamp-4 text-xs break-words">{summary || "（无摘要）"}</p>
      <AssetList assets={assets} dense />
      <pre className="max-h-40 overflow-auto rounded border bg-surface-secondary/40 p-2 font-mono text-[11px] whitespace-pre-wrap">
        {prettyPayload(node.payload)}
      </pre>
    </div>
  );
}
// 一条播报涉及的上下游:上游 = 指向本节点的边,下游 = 本节点指出去的边。
function RelatedNodePreview({ node, assets }: { node: TaskNode; assets: FindingAsset[] }) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);
  return (
    <>
      <Button
        type="button"
        variant="text"
        size="small"
        aria-label={`查看节点 #${node.id} 详情`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchorEl)}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ minWidth: 0, maxWidth: "100%", textAlign: "left", justifyContent: "flex-start", gap: 1 }}
      >
        <KindChip kind={viewKind(node)} />
        <span className="truncate">{summaryOf(node) || `节点 #${node.id}`}</span>
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box
          role="dialog"
          aria-label={`节点 #${node.id} 详情`}
          sx={{ width: 384, maxWidth: "calc(100vw - 32px)", p: 2 }}
        >
          <RelatedNodeCard node={node} assets={assets} />
        </Box>
      </Popover>
    </>
  );
}
function RelatedList({
  title,
  rows,
  refs,
  assets,
}: {
  title: string;
  rows: Array<{
    rel: string;
    id: string;
  }>;
  refs: Record<string, TaskNode>;
  assets: Record<string, FindingAsset[]>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 text-xs font-medium text-muted">{title}</div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const node = refs[row.id];
          return (
            <li key={`${row.rel}-${row.id}`} className="flex min-w-0 items-center gap-2 text-xs">
              <span className="shrink-0 rounded bg-surface-secondary px-1.5 py-0.5 text-muted">
                {REL_LABEL[row.rel] ?? row.rel}
              </span>
              {node ? (
                <RelatedNodePreview node={node} assets={assets[node.id] ?? []} />
              ) : (
                <span className="text-muted">节点 #{row.id}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
function BroadcastRow({
  node,
  edges,
  refs,
  assets,
  now,
  fresh,
}: {
  node: TaskNode;
  edges: Edge[];
  refs: Record<string, TaskNode>;
  assets: Record<string, FindingAsset[]>;
  now: number;
  fresh: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const kind = viewKind(node);
  const meta = KIND_META[kind] ?? KIND_META.fact;
  const Icon = meta.icon;
  const ts = Date.parse(node.ts);
  const summary = summaryOf(node);
  const upstream = edges.filter((e) => e.dst === node.id).map((e) => ({ rel: e.rel, id: e.src }));
  const downstream = edges.filter((e) => e.src === node.id).map((e) => ({ rel: e.rel, id: e.dst }));
  return (
    <div className={cn("relative grid grid-cols-[4.5rem_1.75rem_1fr] gap-x-2", fresh && "bg-accent/5")}>
      {/* 时间列 */}
      <div className="py-3 text-right text-xs text-muted tabular-nums">
        <div>{Number.isNaN(ts) ? "--:--:--" : clockFmt.format(ts)}</div>
        <div className="text-[11px] opacity-70">{relTime(ts, now)}</div>
      </div>

      {/* 时间轴:竖线 + 类型圆点 */}
      <div className="relative flex justify-center">
        <span className="absolute inset-y-0 w-px bg-border" />
        <span
          className={cn(
            "relative mt-3.5 flex size-6 items-center justify-center rounded-full text-white ring-4 ring-background",
            meta.dot,
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>

      {/* 内容列 */}
      <div className="min-w-0 border-b py-3 pr-1 last:border-b-0">
        <Accordion
          expanded={open}
          onChange={(_, value) => setOpen(value)}
          disableGutters
          elevation={0}
          sx={{ bgcolor: "transparent", "&:before": { display: "none" } }}
        >
          <AccordionSummary
            className="flex w-full min-w-0 items-start gap-2 text-left"
            sx={{
              p: 0,
              minHeight: 32,
              "& .MuiAccordionSummary-content": { my: 0, minWidth: 0, gap: 1, alignItems: "flex-start" },
            }}
          >
            <ChevronRightIcon
              className={cn("mt-0.5 size-3.5 shrink-0 text-muted transition-transform", open && "rotate-90")}
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <KindChip kind={kind} />
                <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs text-muted">
                  #{node.id}
                </code>
                <NodeStateBadge node={node} />
                {node.priority > 0 && (kind === "goal" || kind === "intent") && (
                  <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-xs text-muted">
                    P{node.priority}
                  </span>
                )}
                {fresh && (
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                    新
                  </span>
                )}
                <span className="ml-auto shrink-0 text-xs text-muted">{node.origin || "system"}</span>
              </div>
              <p className={cn("mt-1 text-sm", !open && "line-clamp-2")}>{summary || `节点 #${node.id}`}</p>
            </div>
          </AccordionSummary>

          <AccordionDetails sx={{ p: 0 }}>
            {open && (
              <div className="mt-2 flex flex-col gap-3 rounded-md border bg-surface-secondary/30 p-3 sm:ml-5">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    节点 <code className="font-mono">#{node.id}</code>
                  </span>
                  <span>类型 {meta.label}</span>
                  <span>来源 {node.origin || "system"}</span>
                  <span>{Number.isNaN(ts) ? node.ts : new Date(ts).toLocaleString("zh-CN")}</span>
                </div>
                {node.state === "deleted" && node.delete_reason && (
                  <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs">
                    <span className="font-medium text-danger">删除原因</span>
                    <span className="ml-2 break-words text-muted">{node.delete_reason}</span>
                  </div>
                )}
                <AssetList assets={assets[node.id] ?? []} />
                {(upstream.length > 0 || downstream.length > 0) && (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <RelatedList title="上游 · 由此而来" rows={upstream} refs={refs} assets={assets} />
                    <RelatedList title="下游 · 由此产生" rows={downstream} refs={refs} assets={assets} />
                  </div>
                )}
                <div>
                  <div className="mb-1.5 text-xs font-medium text-muted">payload</div>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-background p-3 font-mono text-xs whitespace-pre-wrap">
                    {prettyPayload(node.payload)}
                  </pre>
                </div>
              </div>
            )}
          </AccordionDetails>
        </Accordion>
      </div>
    </div>
  );
}
export function BroadcastTab({ taskId }: { taskId: string }) {
  const [kinds, setKinds] = React.useState<ExploreKind[]>([]);
  const [queryInput, setQueryInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [order, setOrder] = React.useState<"asc" | "desc">("desc");
  const [page, setPage] = React.useState(1);
  const [size, setSize] = React.useState(20);
  const [live, setLive] = React.useState(true);
  const [items, setItems] = React.useState<TaskNode[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [refs, setRefs] = React.useState<Record<string, TaskNode>>({});
  const [assets, setAssets] = React.useState<Record<string, FindingAsset[]>>({});
  const [total, setTotal] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [freshIDs, setFreshIDs] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState(0);
  const [now, setNow] = React.useState(0);
  const seenRef = React.useRef<Set<string>>(new Set());
  const baselineRef = React.useRef<number | null>(null);
  const streamRef = React.useRef("");
  // 只有「最新在前的第 1 页」才是真正的直播位；其余位置轮询只更新未读计数，
  // 不动列表，免得翻页/展开时内容在脚下变。
  const atLive = page === 1 && order === "desc";
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  // 输入防抖:打字停 300ms 才真正查询,并回到第一页。
  React.useEffect(() => {
    const t = setTimeout(() => {
      setQuery(queryInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [queryInput]);
  React.useEffect(() => {
    let alive = true;
    let rendered = false; // 本次查询是否已经把内容渲染出来过
    // 换任务/筛选/排序 = 换了一条播报流:清掉「新」标记和未读基线。翻页不算换流,
    // 否则回到最新时就没有未读计数可算了。
    const stream = `${taskId}|${kinds.join(",")}|${query}|${order}`;
    if (streamRef.current !== stream) {
      streamRef.current = stream;
      seenRef.current = new Set();
      baselineRef.current = null;
      setPending(0);
    }
    const load = () =>
      api
        .explorationNodes(taskId, { page, size, kinds, q: query, order })
        .then((r) => {
          if (!alive) return;
          // 直播位每轮都刷新;其它位置只渲染第一次,之后轮询仅更新未读计数。
          if (atLive || !rendered) {
            rendered = true;
            setItems(r.items);
            setEdges(r.edges);
            setRefs(r.refs);
            setAssets(r.assets);
          }
          setTotal(r.total);
          if (atLive) {
            const seen = seenRef.current;
            setFreshIDs(seen.size === 0 ? new Set() : new Set(r.items.filter((n) => !seen.has(n.id)).map((n) => n.id)));
            seenRef.current = new Set(r.items.map((n) => n.id));
            baselineRef.current = r.total;
            setPending(0);
          } else {
            const base = baselineRef.current;
            setPending(base === null ? 0 : Math.max(0, r.total - base));
          }
          setLoaded(true);
        })
        .catch(() => {
          // 轮询是尽力而为:保留上一次成功的播报内容,下一轮自动重试。
        });
    void load();
    if (!live) {
      return () => {
        alive = false;
      };
    }
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [taskId, page, size, kinds, query, order, live, atLive]);
  const backToLive = () => {
    setPage(1);
    setOrder("desc");
    setPending(0);
  };
  // 服务端的 refs 只补「不在本页的邻居」,同页节点之间的引用要靠 items 自己兜底,
  // 否则相邻两条播报互相引用时会退化成光秃秃的「节点 #id」。
  const nodeIndex = React.useMemo(() => {
    const idx: Record<string, TaskNode> = { ...refs };
    for (const n of items) idx[n.id] = n;
    return idx;
  }, [refs, items]);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const start = total === 0 ? 0 : (page - 1) * size + 1;
  const end = (page - 1) * size + items.length;
  // 换任务或筛选后条数变少时,把越界的页码收回来。
  React.useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  // 按天分组:播报流按日期断行,长任务翻页时还能认出「这是哪天的事」。
  const groups: Array<{
    day: string;
    rows: TaskNode[];
  }> = [];
  for (const node of items) {
    const ts = Date.parse(node.ts);
    const day = Number.isNaN(ts) ? "未知日期" : dayFmt.format(ts);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(node);
    else groups.push({ day, rows: [node] });
  }
  return (
    <Card className="overflow-hidden py-0" sx={{ minWidth: 0 }}>
      {/* 工具条 */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <div className="relative w-full sm:w-64">
          <TextField
            label="搜索播报"
            placeholder="搜索内容 / 来源 / 节点 id"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
                endAdornment: queryInput ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="清除播报搜索" onClick={() => setQueryInput("")}>
                      <XIcon size={16} />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        </div>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          <ToggleButtonGroup
            value={kinds}
            onChange={(_, value: ExploreKind[]) => {
              setKinds(value);
              setPage(1);
            }}
            size="small"
            aria-label="播报类型"
            sx={{ flexWrap: "wrap" }}
          >
            {FILTER_KINDS.map((kind) => {
              const meta = KIND_META[kind];
              return (
                <ToggleButton key={kind} value={kind} sx={{ px: 1, fontSize: 12 }}>
                  {meta.label}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
          {kinds.length > 0 && (
            <Button
              className="h-7 px-2 text-xs"
              onClick={() => {
                setKinds([]);
                setPage(1);
              }}
              size="small"
              variant="text"
            >
              清除
            </Button>
          )}
        </Box>
        <div className="ml-auto flex items-center gap-2">
          <Button
            className="h-8"
            onClick={() => {
              setOrder((o) => (o === "desc" ? "asc" : "desc"));
              setPage(1);
            }}
            aria-label={order === "desc" ? "当前最新在前，点击改为最早在前" : "当前最早在前，点击改为最新在前"}
            size="small"
            variant="outlined"
          >
            {order === "desc" ? <ArrowDownIcon /> : <ArrowUpIcon />}
            {order === "desc" ? "最新在前" : "最早在前"}
          </Button>
          <FormControlLabel
            label="实时"
            sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: 12 } }}
            control={
              <Switch
                checked={live}
                onChange={(event) => setLive(event.target.checked)}
                slotProps={{ input: { "aria-label": "实时刷新" } }}
                size="small"
              />
            }
          />
        </div>
      </div>

      {/* 离开直播位时的未读提示 */}
      {!atLive && pending > 0 && (
        <Button
          type="button"
          onClick={backToLive}
          className="flex w-full items-center justify-center gap-1.5 border-b bg-accent/10 py-1.5 text-xs font-medium text-accent hover:bg-accent/15"
          size="small"
          variant="text"
        >
          <ArrowUpToLineIcon className="size-3.5" />
          {pending > 99 ? "99+" : pending} 条新播报 · 回到最新
        </Button>
      )}

      <CardContent className="px-4 py-0" sx={{ px: 2, py: 0 }}>
        {!loaded ? (
          <div className="flex flex-col gap-3 py-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {query || kinds.length > 0 ? "没有符合条件的播报。" : "这个任务还没有产生探索节点。"}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.day}>
              <div className="py-2 pl-[6.25rem] text-xs font-medium text-muted">{group.day}</div>
              {group.rows.map((node) => (
                <BroadcastRow
                  key={node.id}
                  node={node}
                  edges={edges}
                  refs={nodeIndex}
                  assets={assets}
                  now={now}
                  fresh={freshIDs.has(node.id)}
                />
              ))}
            </div>
          ))
        )}
      </CardContent>

      <CardActions
        className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5 text-xs text-muted"
        sx={{ flexWrap: "wrap", gap: 1, px: 2, py: 1 }}
      >
        <Select
          size="small"
          value={String(size)}
          onChange={(event) => {
            setSize(Number(event.target.value));
            setPage(1);
          }}
          inputProps={{ "aria-label": "每页数量" }}
          sx={{ minWidth: 100 }}
        >
          {PAGE_SIZES.map((n) => (
            <MenuItem key={n} value={String(n)}>
              {n} / 页
            </MenuItem>
          ))}
        </Select>
        <span className="tabular-nums">
          {start}–{end} / {total}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <IconButton
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="上一页"
            size="small"
          >
            <ChevronLeftIcon />
          </IconButton>
          <span className="tabular-nums">
            {page} / {pageCount}
          </span>
          <IconButton
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            aria-label="下一页"
            size="small"
          >
            <ChevronRightIcon />
          </IconButton>
        </div>
      </CardActions>
    </Card>
  );
}
