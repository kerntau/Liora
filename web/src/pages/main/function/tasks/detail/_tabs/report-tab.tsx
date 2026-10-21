"use client";

import * as React from "react";

import { DownloadIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { CopyButton } from "@/components/copy-button";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-muted-foreground text-sm"
      >
        <FileTextIcon className="size-8 opacity-40" />
        加载中…
      </div>
    );
  } else if (report) {
    content = (
      <div className="max-h-[60vh] overflow-auto rounded-md border bg-muted/20 p-4">
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 py-16 text-center text-muted-foreground text-sm">
        <FileTextIcon className="size-8 opacity-40" />
        <div className="space-y-1">
          <div className="text-foreground">暂无报告</div>
          <div className="text-xs">报告由 Agent 在任务中生成，生成后点「刷新」查看</div>
        </div>
        <Button size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
          {refreshing ? "刷新中…" : "刷新"}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileTextIcon className="size-4" /> 渗透测试报告（Markdown）
        </CardTitle>
        <div className="flex gap-2">
          {report && <CopyButton text={report} />}
          <Button size="sm" variant="outline" disabled={!report} onClick={download}>
            <DownloadIcon /> 下载 Markdown
          </Button>
          <Button size="sm" variant="outline" disabled={refreshing || loading} onClick={() => void refresh()}>
            <RefreshCwIcon className={refreshing ? "animate-spin" : undefined} />
            {refreshing ? "刷新中…" : "刷新"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && report ? (
          <Alert variant="destructive">
            <AlertDescription>刷新失败：{error}</AlertDescription>
          </Alert>
        ) : null}
        {content}
      </CardContent>
    </Card>
  );
}
