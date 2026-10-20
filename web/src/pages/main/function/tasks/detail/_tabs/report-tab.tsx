"use client";

import * as React from "react";

import { CheckIcon, CopyIcon, DownloadIcon, FileTextIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { copyText } from "@/lib/utils";

export function ReportTab({ taskId }: { taskId: string }) {
  const [report, setReport] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState("");
  const requestSeq = React.useRef(0);

  // 统一加载入口：首次加载展示整块 loading；手动刷新只切按钮态，失败时保留旧内容。
  const load = React.useCallback(
    async (silent = false): Promise<boolean> => {
      const seq = ++requestSeq.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const text = await api.report(taskId);
        if (seq !== requestSeq.current) return false;
        setReport(text);
        setError("");
        return true;
      } catch (e) {
        if (seq !== requestSeq.current) return false;
        if (!silent) setReport("");
        setError((e as Error).message || "报告加载失败");
        return false;
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

  async function copy() {
    if (!report) return;
    const ok = await copyText(report);
    if (ok) {
      setCopied(true);
      toast.success("已复制 Markdown");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("复制失败，请手动选择文本复制");
    }
  }

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
    if (refreshing) return;
    const ok = await load(true);
    if (ok) toast.success("报告已刷新");
    else toast.error("刷新失败，请稍后重试");
  }

  let content: React.ReactNode;
  if (loading) {
    content = (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-muted-foreground text-sm">
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
    content = (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-16 text-muted-foreground text-sm">
        <FileTextIcon className="size-8 opacity-40" />
        暂无报告
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
          {report && (
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />} 复制
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={!report} onClick={download}>
            <DownloadIcon /> 下载 Markdown
          </Button>
          <Button size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh()}>
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
