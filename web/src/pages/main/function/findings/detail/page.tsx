import * as React from "react";
import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { Alert, Button, Card, Chip, Divider, MenuItem, Select, Tab, Tabs as MuiTabs } from "@mui/material";
import { ArrowLeftIcon, ArrowUpRightIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { FindingRetestPanel } from "@/components/finding-retest-panel";
import { FindingTrafficPanel } from "@/components/finding-traffic-panel";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { statusMeta } from "@/lib/status";
import type { Finding, FindingStatus, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FindingLineageView } from "./lineage";
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const FINDING_STATUSES: FindingStatus[] = [
    "pending",
    "in_progress",
    "confirmed",
    "resolved",
    "fixed",
    "false_positive",
    "ignored",
    "duplicate",
    "risk_accepted",
];
function fmtTime(ts: string) {
    return new Date(ts).toLocaleString("zh-CN");
}
// FieldRow is one label/value line in the right-hand status panel.
function FieldRow({ label, children }: {
    label: string;
    children: React.ReactNode;
}) {
    return (<div className="flex items-start justify-between gap-3 py-2.5">
      <span className="shrink-0 pt-0.5 text-xs text-muted">{label}</span>
      <div className="flex min-w-0 flex-col items-end gap-1 text-right text-sm">{children}</div>
    </div>);
}
function FindingDetailInner() {
    const [searchParams] = useSearchParams();
    const id = searchParams.get("id") ?? "";
    const contextTaskId = searchParams.get("context_task") ?? "";
    const [finding, setFinding] = React.useState<Finding | null>(null);
    const [loaded, setLoaded] = React.useState(false);
    const [tab, setTab] = React.useState("overview");
    const load = React.useCallback(() => {
        if (!id) {
            setLoaded(true);
            return;
        }
        api
            .getFinding(id, contextTaskId || undefined)
            .then((f) => setFinding(f))
            .catch(() => setFinding(null))
            .finally(() => setLoaded(true));
    }, [contextTaskId, id]);
    React.useEffect(() => {
        load();
    }, [load]);
    const changeSeverity = React.useCallback(async (next: Severity) => {
        if (!finding || finding.inherited || next === finding.severity)
            return;
        const prev = finding.severity;
        setFinding({ ...finding, severity: next });
        try {
            const updated = await api.setFindingSeverity(id, next);
            setFinding(updated);
            toast.success(`严重等级已改为「${statusMeta("severity", next).label}」`);
        }
        catch (e) {
            setFinding((cur) => (cur ? { ...cur, severity: prev } : cur));
            toast.error("更新失败：" + (e as Error).message);
        }
    }, [finding, id]);
    const changeStatus = React.useCallback(async (next: FindingStatus) => {
        if (!finding || finding.inherited || next === finding.status)
            return;
        const prev = finding.status;
        setFinding({ ...finding, status: next });
        try {
            const updated = await api.setFindingStatus(id, next);
            setFinding(updated);
            toast.success(`处理状态已改为「${statusMeta("finding", next).label}」`);
        }
        catch (e) {
            setFinding((cur) => (cur ? { ...cur, status: prev } : cur));
            toast.error("更新失败：" + (e as Error).message);
        }
    }, [finding, id]);
    if (!finding) {
        return (<div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-muted">{loaded ? `未找到发现 ${id}` : "加载中…"}</p>
        {loaded && (<Button component={Link} to="/function/findings" variant="outlined" size="small">
            <ArrowLeftIcon /> 返回发现列表
          </Button>)}
      </div>);
    }
    const title = finding.name || finding.vulnclass || "未分类";
    return (<div className="flex flex-1 flex-col gap-0">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <SidebarTrigger className="-ml-1"/>
          <Button component={Link} to="/function/findings" variant="text" size="small" aria-label="返回发现列表" sx={{ minWidth: 28, p: 0 }}>
            <ArrowLeftIcon />
          </Button>
          <ShieldAlertIcon className="size-4 text-muted"/>
          <h1 className="max-w-md truncate text-sm font-semibold" title={title}>
            {title}
          </h1>
          <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs text-muted">#{finding.id}</code>
          <Divider orientation="vertical" flexItem className="mx-1"/>
          <StatusBadge domain="severity" value={finding.severity} dot/>
          <StatusBadge domain="finding" value={finding.status} dot/>
          {finding.inherited && finding.source_task_id && <Chip size="small" label={`来源任务 #${finding.source_task_id} · 只读`} />}
        </div>
        <MuiTabs value={tab} onChange={(_, value) => setTab(value)}><Tab value="overview" label="概览" /><Tab value="lineage" label="链路图" /></MuiTabs>
      </header>

      {/* Tab content */}
      <div className="flex-1 p-4 lg:p-6">
        {/* 概览：左（摘要 + 证据）/ 右（状态区） */}
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 左栏 */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              <Card variant="outlined"><div className="border-b p-4 text-sm font-semibold">摘要</div><div className="p-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{finding.summary || "（无摘要）"}</p>
                </div></Card>
              <FindingRetestPanel key={id} findingId={id} readOnly={finding.inherited} onCompleted={load}/>
              <Card variant="outlined"><div className="border-b p-4 text-sm font-semibold">证据 / PoC</div><div className="p-4">
                  {finding.evidence ? (<pre className="max-h-[46vh] overflow-auto rounded-md bg-surface-secondary px-3 py-2 font-mono text-xs whitespace-pre-wrap">
                      {finding.evidence}
                    </pre>) : (<p className="text-sm text-muted">（无证据）</p>)}
                </div></Card>
              <FindingTrafficPanel key={id} findingId={id} contextTask={contextTaskId || undefined} readOnly={finding.inherited} onChanged={load}/>
              {/* 证据下方：详细报告(Markdown 渲染) */}
              <Card variant="outlined"><div className="flex items-center justify-between border-b p-4"><div className="text-sm font-semibold">详细报告</div>
                  {finding.report && <CopyButton text={finding.report} successMessage="已复制详细报告"/>}
                </div><div className="p-4">
                  {finding.report_stale ? <Alert severity="warning">流量证据已变更，详细报告待更新。</Alert> : null}
                  {finding.report ? (<Markdown text={finding.report}/>) : (<p className="text-sm text-muted">暂无详细报告。</p>)}
                </div></Card>
            </div>

            {/* 右栏：状态区 */}
            <Card variant="outlined" className="h-fit lg:sticky lg:top-24"><div className="border-b p-4 text-sm font-semibold">状态</div><div className="divide-y p-4">
                {/* 漏洞 ID */}
                <FieldRow label="漏洞 ID">
                  <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs text-muted">
                    #{finding.id}
                  </code>
                </FieldRow>

                {/* 严重等级 */}
                <FieldRow label="严重等级">
                  {finding.inherited ? <StatusBadge domain="severity" value={finding.severity} dot/> : <Select size="small" value={finding.severity} onChange={(event) => void changeSeverity(event.target.value as Severity)}>{SEVERITIES.map((sv) => <MenuItem key={sv} value={sv}>{statusMeta("severity", sv).label}</MenuItem>)}</Select>}
                </FieldRow>

                {/* 处理状态 */}
                <FieldRow label="处理状态">
                  {finding.inherited ? <StatusBadge domain="finding" value={finding.status} dot/> : <Select size="small" value={finding.status} onChange={(event) => void changeStatus(event.target.value as FindingStatus)}>{FINDING_STATUSES.map((st) => <MenuItem key={st} value={st}>{statusMeta("finding", st).label}</MenuItem>)}</Select>}
                </FieldRow>

                {/* 漏洞类型 */}
                <FieldRow label="漏洞类型">
                  {finding.vulnclass ? (<code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs">
                      {finding.vulnclass}
                    </code>) : (<span className="text-muted">—</span>)}
                </FieldRow>

                {/* 涉及资产 */}
                <FieldRow label="涉及资产">
                  {finding.assets && finding.assets.length > 0 ? (<div className="flex flex-wrap justify-end gap-1">
                      {finding.assets.map((a) => (<code key={a.id} className="max-w-[16rem] truncate rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs" title={`${a.type} · ${a.label}`}>
                          {a.label}
                        </code>))}
                    </div>) : (<span className="text-muted">—</span>)}
                </FieldRow>

                {/* 所属任务 */}
                <FieldRow label="所属任务">
                  {finding.task_id ? (<Link to={`/function/tasks/detail?id=${finding.task_id}`} className="inline-flex max-w-[16rem] items-center gap-1 text-accent hover:underline" title={finding.task_description}>
                      <span className="truncate">{finding.task_description || `#${finding.task_id}`}</span>
                      <ArrowUpRightIcon className="size-3 shrink-0"/>
                    </Link>) : (<span className="text-muted">—（任务已删除）</span>)}
                </FieldRow>

                {/* 发现时间 */}
                <FieldRow label="发现时间">
                  <span className="tabular-nums">{fmtTime(finding.ts)}</span>
                </FieldRow>
              </div></Card>
          </div>
        )}

        {/* 链路图：从任务初始节点回溯到本漏洞节点的攻击链路 */}
        {tab === "lineage" && (
          <FindingLineageView findingId={finding.id}/>
        )}
      </div>
    </div>);
}
export default function FindingDetailPage() {
    return (<React.Suspense fallback={null}>
      <FindingDetailInner />
    </React.Suspense>);
}
