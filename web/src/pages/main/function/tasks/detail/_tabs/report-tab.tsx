"use client";

import * as React from "react";

import { DownloadIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { MetaSeparator } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { CopyButton } from "@/components/copy-button";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

export function ReportTab({ taskId }: { taskId: string }) {
  const [report, setReport] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestSeq = React.useRef(0);

  // 统一加载入口：首次加载展示整块 loading；手动刷新只切按钮态，失败时保留旧内容。
  const load = React.useCallback(
    async (silent = false): Promise<string | null> => {
      const seq = ++requestSeq.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const text = await api.report(taskId);
        if (seq !== requestSeq.current) return null;
        setReport(text);
        setError("");
        return text;
      } catch (e) {
        if (seq !== requestSeq.current) return null;
        if (!silent) setReport("");
        setError((e as Error).message || "报告加载失败");
        return null;
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [taskId],
  );

  React.useEffect(() => {
    void load();
    return () => {
      requestSeq.current++;
    };
  }, [load]);

  function download() {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `liora-report-${taskId}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function refresh() {
    if (refreshing || loading) return;
    const text = await load(true);
    // 失败原因已经内联常驻在卡片里，这里不再叠一条 toast。
    if (text === null) return;
    toast.success(text ? "报告已刷新" : "报告尚未生成");
  }

  let content: React.ReactNode;
  if (loading) {
    content = (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-surface-muted/40 py-12 text-center"
      >
        <Spinner className="size-6 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">加载中…</p>
      </div>
    );
  } else if (report) {
    content = (
      <div className="max-h-[65vh] overflow-auto rounded-lg bg-surface-muted/40 p-4 sm:p-6">
        <Markdown text={report} />
      </div>
    );
  } else if (error) {
    // A failed read is not an empty report: show the reason and a retry action.
    content = (
      <Alert variant="destructive">
        <AlertTitle>报告加载失败</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{error}</span>
          <Button size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
            {refreshing ? "重试中…" : "重试"}
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else {
    // 空态给出下一步：报告由 Agent 生成，用户需要知道去哪拿、怎么刷新。
    content = (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-surface-muted/40 px-4 py-10 text-center">
        <FileTextIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
        <div className="space-y-1">
          <div className="text-[13px] font-medium text-foreground">暂无报告</div>
          <div className="text-[12px] leading-5 text-muted-foreground">
            报告由 Agent 在任务中生成，生成后点「刷新」查看
          </div>
        </div>
        <Button size="sm" variant="outline" className="mt-1.5" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
          {refreshing ? "刷新中…" : "刷新"}
        </Button>
      </div>
    );
  }

  return (
    <SectionCard
      icon={FileTextIcon}
      title="渗透测试报告"
      description="Markdown 报告 · 由 Agent 在任务中生成，可复制或下载归档"
    >
      <div className="flex flex-col gap-3">
        {/* 工具栏：文件名与体量在左，复制 / 下载 / 刷新在右；窄屏自动换行。 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <FileTextIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate font-mono">liora-report-{taskId}.md</span>
            </span>
            {report ? (
              <>
                <MetaSeparator />
                <span className="shrink-0 tabular-nums">{report.length.toLocaleString("zh-CN")} 字符</span>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {report ? <CopyButton text={report} /> : null}
            <Button size="sm" variant="outline" disabled={!report} onClick={download}>
              <DownloadIcon /> 下载 Markdown
            </Button>
            <Button size="sm" variant="outline" disabled={refreshing || loading} onClick={() => void refresh()}>
              <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
              {refreshing ? "刷新中…" : "刷新"}
            </Button>
          </div>
        </div>
        {error && report ? (
          <Alert variant="destructive">
            <AlertDescription>刷新失败：{error}</AlertDescription>
          </Alert>
        ) : null}
        {content}
      </div>
    </SectionCard>
  );
}
