"use client";

import * as React from "react";

import Link from "@/lib/router-compat";

import { RotateCcwIcon } from "lucide-react";

import { SectionCard } from "@/components/app/section-card";
import { FindingRetestDialog } from "@/components/finding-retest-dialog";
import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import type { FindingRetest } from "@/lib/types";

const statusLabels = {
  pending: "等待启动",
  running: "复测中",
  completed: "已完成",
  failed: "复测失败",
  stopped: "已停止",
};
const verdictLabels = { reproduced: "仍可复现", fixed: "已修复", inconclusive: "无法确认" };

function active(r: FindingRetest) {
  return r.status === "pending" || r.status === "running";
}

export function FindingRetestPanel({
  findingId,
  findingName,
  readOnly = false,
  onCompleted,
}: {
  findingId: string;
  findingName?: string;
  readOnly?: boolean;
  onCompleted?: () => void;
}) {
  const [items, setItems] = React.useState<FindingRetest[] | null>(null);
  const [error, setError] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const requestSeq = React.useRef(0);
  const previousItems = React.useRef<FindingRetest[]>([]);

  const load = React.useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const rows = await api.findingRetests(findingId);
      if (seq !== requestSeq.current) return;
      const completed = previousItems.current.some(
        (item) => active(item) && rows.some((row) => row.id === item.id && !active(row)),
      );
      previousItems.current = rows;
      setItems(rows);
      setError("");
      if (completed) onCompleted?.();
    } catch (e) {
      if (seq === requestSeq.current) setError((e as Error).message);
    }
  }, [findingId, onCompleted]);

  React.useEffect(() => {
    void load();
    return () => {
      requestSeq.current++;
    };
  }, [load]);

  React.useEffect(() => {
    if (error || !items?.some(active)) return;
    const timer = setTimeout(() => void load(), 3000);
    return () => clearTimeout(timer);
  }, [error, items, load]);

  const running = items?.find(active);

  return (
    <SectionCard
      icon={RotateCcwIcon}
      title="漏洞复测"
      description="在独立会话中验证当前状态，保留每次复测的结论与证据。"
      actions={
        running?.conversation_id != null ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/function/conversations/detail?c=${running.conversation_id}`} title="查看正在进行的复测会话">
              <Spinner data-icon="inline-start" aria-hidden="true" />
              复测中
            </Link>
          </Button>
        ) : !running && !readOnly ? (
          <Button size="sm" onClick={() => setOpen(true)} disabled={items === null || !!error}>
            <RotateCcwIcon data-icon="inline-start" />
            发起复测
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              加载复测记录失败：{error}
              <Button variant="outline" size="sm" onClick={() => void load()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {!error && items === null ? <Skeleton className="h-16 w-full" /> : null}
        {!error && items?.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-surface-muted/40 px-6 py-8 text-center">
            <RotateCcwIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-[13px] font-medium text-foreground">暂无复测记录</p>
            <p className="text-[12px] leading-5 text-muted-foreground">修复部署完成后，可发起复测并比较新旧证据。</p>
          </div>
        ) : null}
        {!error && items && items.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {items.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={item.status === "completed" && item.verdict === "reproduced" ? "destructive" : "secondary"}
                  >
                    {item.status === "completed" && item.verdict
                      ? verdictLabels[item.verdict]
                      : statusLabels[item.status]}
                  </Badge>
                  <span className="text-[12px] tabular-nums text-muted-foreground">
                    #{item.id} · {fmtTime(item.created_at, "datetime")}
                  </span>
                  {item.conversation_id != null ? (
                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                      <Link href={`/function/conversations/detail?c=${item.conversation_id}`}>查看会话</Link>
                    </Button>
                  ) : (
                    <span className="text-[12px] text-muted-foreground">会话已删除</span>
                  )}
                </div>
                {item.status === "completed" && item.summary ? (
                  <p className="text-[13px] leading-5 break-words whitespace-pre-wrap">{item.summary}</p>
                ) : null}
                {item.error ? (
                  <p className="text-[13px] leading-5 break-words whitespace-pre-wrap text-destructive">{item.error}</p>
                ) : null}
                {item.notes ? (
                  <p className="text-[12px] leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                    补充说明：{item.notes}
                  </p>
                ) : null}
                {item.status === "completed" && item.evidence ? (
                  <details className="min-w-0">
                    <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground">
                      复测证据
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <Markdown text={item.evidence} />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {open ? (
        <FindingRetestDialog
          findingId={findingId}
          findingName={findingName}
          onClose={() => setOpen(false)}
          onStarted={(retest) => {
            requestSeq.current++;
            const rows = [retest, ...previousItems.current.filter((item) => item.id !== retest.id)];
            previousItems.current = rows;
            setItems(rows);
            setError("");
            void load();
          }}
        />
      ) : null}
    </SectionCard>
  );
}
