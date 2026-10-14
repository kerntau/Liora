import * as React from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Typography from "@mui/material/Typography";
import { CheckIcon, CopyIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { api } from "@/lib/api";
import { copyText } from "@/lib/utils";
export function ReportTab({ taskId }: { taskId: string }) { const [report, setReport] = React.useState(""); const [loading, setLoading] = React.useState(true); const [copied, setCopied] = React.useState(false); React.useEffect(() => { let active = true; setLoading(true); api.report(taskId).then((text) => active && setReport(text)).catch(() => active && setReport("")).finally(() => active && setLoading(false)); return () => { active = false; }; }, [taskId]); async function copy() { if (!report) return; if (await copyText(report)) { setCopied(true); toast.success("已复制 Markdown"); setTimeout(() => setCopied(false), 1500); } else toast.error("复制失败，请手动选择文本复制"); } const content = loading ? <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-muted text-sm"><FileTextIcon size={32} className="opacity-40" />加载中…</div> : report ? <div className="max-h-[60vh] overflow-auto rounded-md border bg-surface-secondary/20 p-4"><Markdown text={report} /></div> : <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-muted text-sm"><FileTextIcon size={32} className="opacity-40" />暂无报告</div>; return <Card variant="outlined"><CardHeader title={<Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 1 }}><FileTextIcon size={16} />渗透测试报告（Markdown）</Typography>} action={report ? <Button size="small" variant="outlined" onClick={copy} startIcon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}>复制</Button> : undefined} /><CardContent>{content}</CardContent></Card>; }
