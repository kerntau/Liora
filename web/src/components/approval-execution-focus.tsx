import * as React from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { api } from "@/lib/api";
import type { Activity, InterceptExecution } from "@/lib/types";
export function useApprovalFocus({ taskId, conversationId }: { taskId?: string; conversationId?: number }) {
  const [state, setState] = React.useState<{ id: number; source?: InterceptExecution; error?: string; loading: boolean } | null>(null); const [revision, setRevision] = React.useState(0);
  React.useEffect(() => { const q = new URLSearchParams(window.location.search); const id = Number(q.get("approval")); const matches = conversationId ? q.get("c") === String(conversationId) : q.get("id") === taskId; if (!matches || !Number.isSafeInteger(id) || id <= 0) { setState(null); return; } let cancelled = false; setState({ id, loading: true }); api.interceptExecution(id, conversationId).then((source) => { if (cancelled) return; if (conversationId ? source.conversation_id !== conversationId : source.task_id !== taskId || source.conversation_id != null) throw new Error("审批来源与当前会话不一致"); setState({ id, source, loading: false }); }).catch((e) => { if (!cancelled) setState({ id, error: (e as Error).message || "无法定位原始执行", loading: false }); }); return () => { cancelled = true; }; }, [taskId, conversationId, revision]);
  const close = React.useCallback(() => { const url = new URL(window.location.href); url.searchParams.delete("approval"); window.history.replaceState(null, "", url); setState(null); }, []);
  return { state, close, retry: () => setRevision((v) => v + 1) };
}
type HistoryPage = { items: Activity[]; hasMore: boolean };
export function useApprovalHistory(source: InterceptExecution | undefined, loaded: boolean, items: Activity[], loadPage: (before: number) => Promise<HistoryPage>, mergePage: (page: HistoryPage) => void) {
  const itemsRef = React.useRef(items); itemsRef.current = items; const [result, setResult] = React.useState<{ source: InterceptExecution; error?: string }>();
  React.useEffect(() => { if (!source || !loaded) return; let cancelled = false; void (async () => { let current = itemsRef.current; let before = current[0]?.seq ?? 0; while (!current.some((a) => a.seq === source.seq && a.kind === "tool_use")) { const page = await loadPage(before); if (cancelled) return; if (!page.items.length || (before > 0 && page.items[0].seq >= before)) throw new Error("会话中未找到对应工具调用，记录可能已删除"); mergePage(page); current = page.items; before = current[0].seq; if (!page.hasMore && !current.some((a) => a.seq === source.seq)) throw new Error("会话中未找到对应工具调用"); } if (!cancelled) setResult({ source }); })().catch((error) => { if (!cancelled) setResult({ source, error: (error as Error).message }); }); return () => { cancelled = true; }; }, [source, loaded, loadPage, mergePage]);
  return { ready: !!source && result?.source === source && !result.error, error: result?.source === source ? result?.error : undefined };
}
export function ApprovalExecutionFocus({ focus, history }: { focus: ReturnType<typeof useApprovalFocus>; history: ReturnType<typeof useApprovalHistory> }) {
  const { state } = focus; if (!state) return null; const error = state.error || history.error;
  return <Box sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider", p: 1 }}><Alert severity={error ? "error" : "info"} action={<Box sx={{ display: "flex", gap: 1 }}>{error && <Button size="small" variant="outlined" onClick={focus.retry}>重试定位</Button>}<Button size="small" color="inherit" onClick={focus.close}>取消定位</Button></Box>} sx={{ alignItems: "center", fontSize: "0.75rem", py: 0.5 }}>{error ? `无法定位：${error}` : history.ready ? `已展开审批 #${state.id} 对应的工具调用` : `正在加载审批 #${state.id} 所在的对话位置…`}</Alert></Box>;
}
