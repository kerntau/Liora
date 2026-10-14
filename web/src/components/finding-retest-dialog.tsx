import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { FindingRetest } from "@/lib/types";
interface FindingRetestDialogProps { findingId: string; findingName?: string; onClose: () => void; onStarted?: (retest: FindingRetest) => void; }
export function FindingRetestDialog({ findingId, findingName, onClose, onStarted }: FindingRetestDialogProps) {
  const [notes, setNotes] = React.useState(""); const [submitting, setSubmitting] = React.useState(false); const submitLock = React.useRef(false);
  async function start() { if (submitLock.current) return; submitLock.current = true; setSubmitting(true); try { const result = await api.startFindingRetest(findingId, notes.trim()); onStarted?.(result.retest); onClose(); toast.success(result.created ? "复测已启动，可点击「复测中」查看会话" : "该漏洞正在复测，可查看已有会话"); } catch (e) { toast.error(`发起复测失败：${(e as Error).message}`); } finally { submitLock.current = false; setSubmitting(false); } }
  return <Dialog open onClose={() => !submitLock.current && onClose()} fullWidth maxWidth="sm"><DialogTitle>复测漏洞 #{findingId}</DialogTitle><DialogContent><div className="space-y-4 pt-2"><div className="space-y-1 text-sm text-muted">{findingName ? <span className="block font-medium text-foreground">{findingName}</span> : null}<p>复测 Agent 将读取原证据和测试约束，在独立会话中执行针对性验证。复测成功完成且确认修复后，漏洞状态自动改为「已修复」，其他结论保留原状态。</p></div><TextField label="补充说明（可选）" value={notes} rows={4} multiline disabled={submitting} onChange={(e) => setNotes(e.target.value)} placeholder="例如：使用原测试账号验证原接口；修复版本为 v2。" fullWidth size="small" helperText="可补充修复版本、测试条件或本次限制。" /></div></DialogContent><DialogActions><Button disabled={submitting} onClick={onClose}>取消</Button><Button disabled={submitting} onClick={() => void start()} variant="contained" startIcon={submitting ? <CircularProgress size={14} /> : <RotateCcwIcon size={16} />}>{submitting ? "正在创建…" : "开始复测"}</Button></DialogActions></Dialog>;
}

