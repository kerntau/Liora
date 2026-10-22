"use client";

import * as React from "react";

import Link from "@/lib/router-compat";
import { useSearchParams } from "@/lib/router-compat";

import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  FileTextIcon,
  SearchXIcon,
  ShieldAlertIcon,
  TerminalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { CopyButton } from "@/components/copy-button";
import { FindingRetestPanel } from "@/components/finding-retest-panel";
import { FindingTrafficPanel } from "@/components/finding-traffic-panel";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import type { Finding, FindingStatus, Severity } from "@/lib/types";

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

// FieldRow is one label/value line in the right-hand status panel.
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-muted-foreground shrink-0 pt-0.5 text-[12px]">{label}</span>
      <div className="flex min-w-0 flex-col items-end gap-1 text-right text-[13px]">{children}</div>
    </div>
  );
}

function FindingDetailInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const contextTaskId = searchParams.get("context_task") ?? "";
  const [finding, setFinding] = React.useState<Finding | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [tab, setTab] = React.useState("overview");

  const load = React.useCallback(() => {
    if (!id) {
      setLoaded(true);
      return;
    }
    setLoading(true);
    api
      .getFinding(id, contextTaskId || undefined)
      .then((f) => {
        setFinding(f);
        setError("");
      })
      .catch((e: unknown) => {
        // 网络/5xx 与「确实不存在」必须区分:前者要能重试,不能误报成未找到。
        setError(String((e as Error)?.message ?? e));
      })
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }, [contextTaskId, id]);
  React.useEffect(() => {
    load();
  }, [load]);

  const changeSeverity = React.useCallback(
    async (next: Severity) => {
      if (!finding || finding.inherited || next === finding.severity) return;
      const prev = finding.severity;
      setFinding({ ...finding, severity: next });
      try {
        const updated = await api.setFindingSeverity(id, next);
        setFinding(updated);
        toast.success(`严重等级已改为「${statusMeta("severity", next).label}」`);
      } catch (e) {
        setFinding((cur) => (cur ? { ...cur, severity: prev } : cur));
        toast.error("更新失败：" + (e as Error).message);
      }
    },
    [finding, id],
  );

  const changeStatus = React.useCallback(
    async (next: FindingStatus) => {
      if (!finding || finding.inherited || next === finding.status) return;
      const prev = finding.status;
      setFinding({ ...finding, status: next });
      try {
        const updated = await api.setFindingStatus(id, next);
        setFinding(updated);
        toast.success(`处理状态已改为「${statusMeta("finding", next).label}」`);
      } catch (e) {
        setFinding((cur) => (cur ? { ...cur, status: prev } : cur));
        toast.error("更新失败：" + (e as Error).message);
      }
    },
    [finding, id],
  );

  if (!finding) {
    const missing = /(^|\D)404(\D|$)|not found|不存在/i.test(error);
    let fallbackMessage = `未找到发现 ${id}`;
    if (!loaded && !error) fallbackMessage = "加载中…";
    else if (error && !missing) fallbackMessage = "加载发现失败";
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-lg bg-surface-muted text-muted-foreground/70 ring-1 ring-border/60">
          {loaded && !error ? (
            <ShieldAlertIcon className="size-5" aria-hidden="true" />
          ) : missing ? (
            <SearchXIcon className="size-5" aria-hidden="true" />
          ) : (
            <TriangleAlertIcon className="size-5 text-destructive" aria-hidden="true" />
          )}
        </span>
        <p className="text-[13px] font-semibold text-foreground">{fallbackMessage}</p>
        {error && !missing && <p className="max-w-md text-xs break-words text-muted-foreground">{error}</p>}
        {!loaded && !error && <p className="text-xs text-muted-foreground">正在获取漏洞详情与证据。</p>}
        {loaded && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            {error && !missing && (
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? "重试中…" : "重试"}
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/function/findings">
                <ArrowLeftIcon data-icon="inline-start" /> 返回发现列表
              </Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  const title = finding.name || finding.vulnclass || "未分类";

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <PageHeader
          icon={ShieldAlertIcon}
          backTo="/function/findings"
          backLabel="返回发现列表"
          title={title}
          description={
            finding.summary ? (
              <span
                className="break-words"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {finding.summary}
              </span>
            ) : undefined
          }
          meta={[
            <span key="id" className="font-mono text-[11px] tabular-nums">
              #{finding.id}
            </span>,
            // 两枚状态徽章是一组，中间不加分隔竖线。
            <span key="status" className="inline-flex items-center gap-1.5">
              <StatusBadge domain="severity" value={finding.severity} dot />
              <StatusBadge domain="finding" value={finding.status} dot />
            </span>,
            finding.inherited && finding.source_task_id ? (
              <Badge key="source" variant="outline">
                来源任务 #{finding.source_task_id} · 只读
              </Badge>
            ) : null,
            finding.task_id ? (
              <Link
                key="task"
                href={`/function/tasks/detail?id=${finding.task_id}`}
                className="inline-flex max-w-[16rem] items-center gap-1 text-primary hover:underline"
                title={finding.task_description}
              >
                <span className="truncate">{finding.task_description || `任务 #${finding.task_id}`}</span>
                <ArrowUpRightIcon className="size-3 shrink-0" aria-hidden="true" />
              </Link>
            ) : (
              <span key="task">任务已删除</span>
            ),
            <span key="time" className="font-mono text-[11px] tabular-nums">
              {fmtTime(finding.ts, "datetime")}
            </span>,
          ]}
          actions={
            <>
              {finding.task_id ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/function/tasks/detail?id=${finding.task_id}`}>
                    查看所属任务
                    <ArrowUpRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="lineage">链路图</TabsTrigger>
          </TabsList>
          <span className="hidden text-[12px] text-muted-foreground sm:inline">
            {finding.inherited ? "继承自来源任务，只读" : "处置状态与等级可直接修改"}
          </span>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {/* 概览：左（摘要 + 证据）/ 右（状态区） */}
        <TabsContent value="overview" className="mt-0">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* 左栏 */}
            <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
              <SectionCard icon={FileTextIcon} title="摘要" description="漏洞的成因、影响与触发条件。">
                <p className="text-[13px] leading-6 break-words whitespace-pre-wrap text-foreground/90">
                  {finding.summary || "（无摘要）"}
                </p>
              </SectionCard>
              <FindingRetestPanel key={id} findingId={id} readOnly={finding.inherited} onCompleted={load} />
              <SectionCard
                icon={TerminalIcon}
                title="证据 / PoC"
                description="原始请求、响应或复现步骤。"
                actions={
                  finding.evidence ? (
                    <CopyButton text={finding.evidence} variant="ghost" className="h-7 px-2 text-xs" />
                  ) : null
                }
              >
                {finding.evidence ? (
                  <pre className="max-h-[46vh] overflow-auto rounded-lg border border-border/60 bg-surface-muted px-4 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
                    {finding.evidence}
                  </pre>
                ) : (
                  <p className="text-[13px] text-muted-foreground">（无证据）</p>
                )}
              </SectionCard>
              <FindingTrafficPanel
                key={id}
                findingId={id}
                contextTask={contextTaskId || undefined}
                readOnly={finding.inherited}
                onChanged={load}
              />
              {/* 证据下方：详细报告(Markdown 渲染) */}
              <SectionCard
                icon={FileTextIcon}
                title="详细报告"
                description="可直接导出的 Markdown 说明，随证据变化需要重新生成。"
                actions={finding.report ? <CopyButton text={finding.report} /> : null}
              >
                {finding.report_stale ? (
                  <Alert className="mb-3">
                    <AlertDescription>流量证据已变更，详细报告待更新。</AlertDescription>
                  </Alert>
                ) : null}
                {finding.report ? (
                  <div className="text-[13px]">
                    <Markdown text={finding.report} />
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">暂无详细报告。</p>
                )}
              </SectionCard>
            </div>

            {/* 右栏：状态区 */}
            <SectionCard
              icon={ActivityIcon}
              title="状态"
              description="处置状态、等级与归属。"
              className="h-fit lg:sticky lg:top-20"
            >
              <div className="divide-y divide-border/60">
                {/* 漏洞 ID */}
                <FieldRow label="漏洞 ID">
                  <code className="inline-flex h-5 items-center rounded bg-surface-muted px-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    #{finding.id}
                  </code>
                </FieldRow>

                {/* 严重等级 */}
                <FieldRow label="严重等级">
                  {finding.inherited ? (
                    <StatusBadge domain="severity" value={finding.severity} dot />
                  ) : (
                    <Select value={finding.severity} onValueChange={(v) => changeSeverity(v as Severity)}>
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-auto border-none bg-transparent px-1 shadow-none hover:bg-surface-muted"
                        aria-label={`严重等级：${statusMeta("severity", finding.severity).label}`}
                      >
                        <StatusBadge domain="severity" value={finding.severity} dot />
                      </SelectTrigger>
                      <SelectContent position="popper" align="end">
                        <SelectGroup>
                          {SEVERITIES.map((sv) => (
                            <SelectItem key={sv} value={sv}>
                              {statusMeta("severity", sv).label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </FieldRow>

                {/* 处理状态 */}
                <FieldRow label="处理状态">
                  {finding.inherited ? (
                    <StatusBadge domain="finding" value={finding.status} dot />
                  ) : (
                    <Select value={finding.status} onValueChange={(v) => changeStatus(v as FindingStatus)}>
                      <SelectTrigger
                        size="sm"
                        className="h-7 w-auto border-none bg-transparent px-1 shadow-none hover:bg-surface-muted"
                        aria-label={`处理状态：${statusMeta("finding", finding.status).label}`}
                      >
                        <StatusBadge domain="finding" value={finding.status} dot />
                      </SelectTrigger>
                      <SelectContent position="popper" align="end">
                        <SelectGroup>
                          {FINDING_STATUSES.map((st) => (
                            <SelectItem key={st} value={st}>
                              {statusMeta("finding", st).label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </FieldRow>

                {/* 漏洞类型 */}
                <FieldRow label="漏洞类型">
                  {finding.vulnclass ? (
                    <code className="inline-flex h-5 items-center rounded bg-surface-muted px-1.5 font-mono text-[11px]">
                      {finding.vulnclass}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </FieldRow>

                {/* 涉及资产 */}
                <FieldRow label="涉及资产">
                  {finding.assets && finding.assets.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-1">
                      {finding.assets.map((a) => (
                        <code
                          key={a.id}
                          className="max-w-[16rem] truncate rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                          title={`${a.type} · ${a.label}`}
                        >
                          {a.label}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </FieldRow>

                {/* 所属任务 */}
                <FieldRow label="所属任务">
                  {finding.task_id ? (
                    <Link
                      href={`/function/tasks/detail?id=${finding.task_id}`}
                      className="inline-flex max-w-[16rem] items-center gap-1 text-primary hover:underline"
                      title={finding.task_description}
                    >
                      <span className="truncate">{finding.task_description || `#${finding.task_id}`}</span>
                      <ArrowUpRightIcon className="size-3 shrink-0" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—（任务已删除）</span>
                  )}
                </FieldRow>

                {/* 发现时间 */}
                <FieldRow label="发现时间">
                  <span className="font-mono text-[11px] tabular-nums">{fmtTime(finding.ts, "datetime")}</span>
                </FieldRow>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* 链路图：从任务初始节点回溯到本漏洞节点的攻击链路 */}
        <TabsContent value="lineage" className="mt-0">
          <FindingLineageView findingId={finding.id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

// useSearchParams must sit under a Suspense boundary for static export.
export default function FindingDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <FindingDetailInner />
    </React.Suspense>
  );
}
