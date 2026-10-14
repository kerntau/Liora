import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import { toast } from "sonner";
import { CapturedTrafficViewer } from "@/components/traffic-evidence-viewer";
import { api } from "@/lib/api";
import type { FindingTrafficBinding, TrafficResp } from "@/lib/types";
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
export function TrafficPickerDialog({ findingId, contextTask, bound, onClose, onBound }: { findingId: string; contextTask?: string; bound: FindingTrafficBinding[]; onClose: () => void; onBound: () => void }) {
  const [host, setHost] = React.useState(""); const [method, setMethod] = React.useState("all"); const [query, setQuery] = React.useState(""); const [page, setPage] = React.useState(0); const [data, setData] = React.useState<TrafficResp | null>(null); const [selected, setSelected] = React.useState<Set<string>>(() => new Set()); const [preview, setPreview] = React.useState<string | null>(null); const [loading, setLoading] = React.useState(true); const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState("");
  const alreadyBound = React.useMemo(() => new Set(bound.map((b) => b.snapshot.source_traffic_id)), [bound]);
  React.useEffect(() => { let active = true; setLoading(true); setError(""); const timer = setTimeout(() => { api.traffic(page, 25, host, method === "all" ? "" : method, query).then((d) => active && setData(d)).catch((e: Error) => active && setError(e.message)).finally(() => active && setLoading(false)); }, 250); return () => { active = false; clearTimeout(timer); }; }, [page, host, method, query]);
  const rows = data?.exchanges ?? []; const selectable = rows.filter((row) => !alreadyBound.has(row.id)); const allSelected = selectable.length > 0 && selectable.every((row) => selected.has(row.id));
  function toggle(id: string, checked: boolean) { setSelected((previous) => { const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next; }); }
  async function save() { setBusy(true); setError(""); try { await api.bindFindingTraffic(findingId, [...selected].map((traffic_id) => ({ traffic_id })), contextTask); toast.success(`已绑定 ${selected.size} 条流量`); onBound(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  const setFilter = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => { setter(event.target.value); setPage(0); };
  return <><Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="xl"><DialogTitle>绑定流量</DialogTitle><DialogContent><div className="space-y-4"><p className="text-xs text-muted">筛选并多选请求/响应，已选记录会跨页保留。绑定后可设置用途、说明和顺序。</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><TextField size="small" label="目标 host" placeholder="域名或 IP" value={host} onChange={setFilter(setHost)} /><Select size="small" aria-label="请求方法" value={method} onChange={(event) => { setMethod(String(event.target.value)); setPage(0); }}><MenuItem value="all">全部方法</MenuItem>{METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select><TextField size="small" label="关键词" placeholder="URL / 正文关键词" value={query} onChange={setFilter(setQuery)} /></div>{error && <Alert severity="error">{error}</Alert>}<TableContainer sx={{ maxHeight: "45vh", border: 1, borderColor: "divider" }}><Table size="small" stickyHeader><TableHead><TableRow><TableCell padding="checkbox"><Checkbox checked={allSelected} disabled={loading || busy || selectable.length === 0} onChange={(event) => { setSelected((previous) => { const next = new Set(previous); for (const row of selectable) event.target.checked ? next.add(row.id) : next.delete(row.id); return next; }); }} /></TableCell><TableCell>方法 / URL</TableCell><TableCell>时间</TableCell><TableCell>状态码</TableCell><TableCell>操作</TableCell></TableRow></TableHead><TableBody>{loading && !rows.length ? <TableRow><TableCell colSpan={5}><Skeleton height={48} /></TableCell></TableRow> : rows.map((row) => { const disabled = alreadyBound.has(row.id); return <TableRow key={row.id} hover><TableCell padding="checkbox"><Checkbox checked={selected.has(row.id) || disabled} disabled={busy || loading || disabled} onChange={(event) => toggle(row.id, event.target.checked)} /></TableCell><TableCell><div className="flex min-w-0 items-center gap-2"><span className="truncate font-mono text-xs">{row.method} {row.url}</span>{disabled && <Chip size="small" label="已绑定" variant="outlined" />}</div></TableCell><TableCell className="whitespace-nowrap text-xs text-muted">{new Date(row.ts).toLocaleString("zh-CN")}</TableCell><TableCell><span className={row.status >= 400 ? "text-warning" : "text-success"}>{row.status}</span></TableCell><TableCell><Button size="small" onClick={() => setPreview(row.id)}>预览</Button></TableCell></TableRow>; })}{!loading && !rows.length && <TableRow><TableCell colSpan={5} align="center">没有匹配的流量</TableCell></TableRow>}</TableBody></Table></TableContainer><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted">已选 <strong className="text-foreground">{selected.size}</strong> 条 · 共 {data?.total ?? 0} 条</span><div className="flex items-center gap-2"><Button size="small" disabled={loading || page === 0} onClick={() => setPage((p) => p - 1)}>上一页</Button><span className="text-xs">第 {page + 1} 页</span><Button size="small" disabled={loading || (page + 1) * 25 >= (data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>下一页</Button></div></div></div></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>取消</Button><Button disabled={busy || selected.size === 0} variant="contained" onClick={() => void save()}>{busy ? "保存中…" : `绑定 ${selected.size} 条流量`}</Button></DialogActions></Dialog><CapturedTrafficViewer id={preview} onClose={() => setPreview(null)} /></>;
}
