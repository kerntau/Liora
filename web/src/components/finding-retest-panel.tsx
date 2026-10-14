import * as React from "react";
import { Link } from "react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { RotateCcwIcon, ChevronDownIcon } from "lucide-react";
import { FindingRetestDialog } from "@/components/finding-retest-dialog";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/api";
import type { FindingRetest } from "@/lib/types";
const statusLabels: Record<string, string> = { pending: "等待启动", running: "复测中", completed: "已完成", failed: "复测失败", stopped: "已停止" };
const verdictLabels: Record<string, string> = { reproduced: "仍可复现", fixed: "已修复", inconclusive: "无法确认" };
function active(r: FindingRetest) { return r.status === "pending" || r.status === "running"; }
export function FindingRetestPanel({ findingId, findingName, readOnly = false, onCompleted }: { findingId: string; findingName?: string; readOnly?: boolean; onCompleted?: () => void }) {
  const [items, setItems] = React.useState<FindingRetest[] | null>(null); const [error, setError] = React.useState(""); const [open, setOpen] = React.useState(false); const requestSeq = React.useRef(0); const previousItems = React.useRef<FindingRetest[]>([]);
  const load = React.useCallback(async () => { const seq = ++requestSeq.current; try { const rows = await api.findingRetests(findingId); if (seq !== requestSeq.current) return; const completed = previousItems.current.some((item) => active(item) && rows.some((row) => row.id === item.id && !active(row))); previousItems.current = rows; setItems(rows); setError(""); if (completed) onCompleted?.(); } catch (e) { if (seq === requestSeq.current) setError((e as Error).message); } }, [findingId, onCompleted]);
  React.useEffect(() => { void load(); return () => { requestSeq.current++; }; }, [load]); React.useEffect(() => { if (error || !items?.some(active)) return; const timer = setTimeout(() => void load(), 3000); return () => clearTimeout(timer); }, [error, items, load]);
  const running = items?.find(active);
  return <Card variant="outlined"><CardHeader title={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>漏洞复测</Typography>} subheader={<Typography variant="caption" color="text.secondary">在独立会话中验证当前状态，保留每次复测的结论与证据。</Typography>} action={<Stack direction="row" spacing={1}>{running?.conversation_id != null && <Button component={Link} to={`/function/conversations/detail?c=${running.conversation_id}`} size="small" variant="outlined" startIcon={<CircularProgress size={14} />}>复测中</Button>}{!running && !readOnly && <Button size="small" variant="contained" disabled={items === null || !!error} startIcon={<RotateCcwIcon size={16} />} onClick={() => setOpen(true)}>发起复测</Button>}</Stack>} /><CardContent><Stack spacing={1.5}>{error && <Alert severity="error" action={<Button size="small" onClick={() => void load()}>重试</Button>}>加载复测记录失败：{error}</Alert>}{!error && items === null && <Skeleton variant="rounded" height={64} />}{!error && items?.length === 0 && <Stack sx={{ alignItems: "center", gap: 0.5, py: 4 }}><RotateCcwIcon size={30} className="opacity-50" /><Typography sx={{ fontWeight: 600 }}>暂无复测记录</Typography><Typography variant="caption" color="text.secondary">修复部署完成后，可发起复测并比较新旧证据。</Typography></Stack>}{items?.map((item) => <RetestRow key={item.id} item={item} />)}</Stack></CardContent>{open && <FindingRetestDialog findingId={findingId} findingName={findingName} onClose={() => setOpen(false)} onStarted={(retest) => { requestSeq.current++; const rows = [retest, ...previousItems.current.filter((item) => item.id !== retest.id)]; previousItems.current = rows; setItems(rows); setError(""); void load(); }} />}</Card>;
}
function RetestRow({ item }: { item: FindingRetest }) {
  const [expanded, setExpanded] = React.useState(false); const isReproduced = item.status === "completed" && item.verdict === "reproduced"; const isFixed = item.status === "completed" && item.verdict === "fixed";
  return <Stack spacing={1} sx={{ minWidth: 0, border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover", p: 1.5 }}><Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}><Chip size="small" color={isReproduced ? "error" : isFixed ? "success" : "default"} variant="outlined" label={item.status === "completed" && item.verdict ? verdictLabels[item.verdict] : statusLabels[item.status]} /><Typography variant="caption" color="text.secondary">#{item.id} · {new Date(item.created_at).toLocaleString("zh-CN")}</Typography>{item.conversation_id != null ? <Button component={Link} to={`/function/conversations/detail?c=${item.conversation_id}`} size="small" sx={{ ml: "auto" }}>查看会话</Button> : <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>会话已删除</Typography>}</Stack>{item.status === "completed" && item.summary && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{item.summary}</Typography>}{item.error && <Typography variant="body2" color="error" sx={{ whiteSpace: "pre-wrap" }}>{item.error}</Typography>}{item.notes && <Typography variant="caption" color="text.secondary">补充说明：{item.notes}</Typography>}{item.status === "completed" && item.evidence && <><Button size="small" onClick={() => setExpanded((v) => !v)} endIcon={<ChevronDownIcon size={16} className={expanded ? "rotate-180" : ""} />} sx={{ alignSelf: "flex-start" }}>复测证据</Button><Collapse in={expanded}><div className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface p-3"><Markdown text={item.evidence} /></div></Collapse></>}</Stack>;
}

