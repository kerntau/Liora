import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { toast } from "sonner";
import { HttpCodeBlock } from "@/components/http-code-block";
import { api } from "@/lib/api";
import type { FindingTrafficDetail, TrafficDetail } from "@/lib/types";
export function TrafficEvidenceViewer({ findingId, bindingId, contextTask, onClose }: { findingId: string; bindingId: string | null; contextTask?: string; onClose: () => void }) {
  const [detail, setDetail] = React.useState<FindingTrafficDetail | null>(null); const [error, setError] = React.useState(""); const [busy, setBusy] = React.useState(false); const [tab, setTab] = React.useState<"request" | "response">("request");
  React.useEffect(() => { if (!bindingId) return; let active = true; setDetail(null); setError(""); api.findingTrafficDetail(findingId, bindingId, contextTask).then((d) => active && setDetail(d)).catch((e: Error) => active && setError(e.message)); return () => { active = false; }; }, [findingId, bindingId, contextTask]);
  async function more(side: "request" | "response") { if (!detail || !bindingId) return; setBusy(true); try { const next = await api.findingTrafficBody(findingId, bindingId, side, detail[side].next_offset, contextTask); setDetail((current) => current?.binding.id === bindingId ? { ...current, [side]: { ...next, content: current[side].content + next.content } } : current); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }
  return <Dialog open={bindingId !== null} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle>流量证据 #{bindingId}<Typography component="span" variant="caption" color="text.secondary" sx={{ mt: 0.5, wordBreak: "break-all", display: "block" }}>{detail?.binding.snapshot.url ?? "查看绑定时保存的请求与响应"}</Typography></DialogTitle><DialogContent>{error ? <Alert severity="error">{error}</Alert> : detail ? <><Tabs value={tab} onChange={(_, value) => setTab(value)}><Tab value="request" label="请求 Request" /><Tab value="response" label="响应 Response" /></Tabs>{(["request", "response"] as const).map((side) => tab === side && <div key={side} className="space-y-3 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><Typography variant="caption" color="text.secondary">正文 {detail[side].total.toLocaleString()} 字节{detail[side].truncated ? " · 当前为预览" : ""}</Typography><Button size="small" variant="outlined" onClick={() => void api.downloadFindingTrafficBody(findingId, detail.binding.id, side, contextTask).catch((e: Error) => toast.error(e.message))}>下载完整{side === "request" ? "请求" : "响应"}正文</Button></div><HttpCodeBlock raw={`${(side === "request" ? detail.binding.snapshot.req_head : detail.binding.snapshot.resp_head)?.trimEnd() ?? ""}\n\n${detail[side].content}`} />{detail[side].truncated && !detail[side].binary && <Button size="small" disabled={busy} variant="outlined" onClick={() => void more(side)}>加载更多正文</Button>}</div>)}</> : <Skeleton variant="rounded" height={320} />}</DialogContent><DialogActions><Button onClick={onClose}>关闭</Button></DialogActions></Dialog>;
}
export function CapturedTrafficViewer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [detail, setDetail] = React.useState<TrafficDetail | null>(null); const [error, setError] = React.useState(""); const [tab, setTab] = React.useState<"request" | "response">("request");
  React.useEffect(() => { if (!id) return; let active = true; setDetail(null); setError(""); api.trafficExchange(id).then((d) => active && setDetail(d)).catch((e: Error) => active && setError(e.message)); return () => { active = false; }; }, [id]);
  return <Dialog open={id !== null} onClose={onClose} fullWidth maxWidth="lg"><DialogTitle>预览流量<Typography component="span" variant="caption" sx={{ display: "block" }} color="text.secondary">流量 ID：{id}。绑定时会保存完整正文。</Typography></DialogTitle><DialogContent>{error ? <Alert severity="error">{error}</Alert> : detail ? <><Tabs value={tab} onChange={(_, value) => setTab(value)}><Tab value="request" label="请求 Request" /><Tab value="response" label="响应 Response" /></Tabs>{tab === "request" ? <HttpCodeBlock raw={detail.req} /> : <HttpCodeBlock raw={detail.resp} />}</> : <Skeleton variant="rounded" height={320} />}</DialogContent><DialogActions><Button onClick={onClose}>关闭</Button></DialogActions></Dialog>;
}


