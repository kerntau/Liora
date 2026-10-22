"use client";

import * as React from "react";

import { ClipboardCheckIcon, RefreshCwIcon } from "lucide-react";

import { ApprovalRecords } from "@/components/approval-records";
import { Button } from "@/components/ui/button";

// 任务详情里的审批页签：标题与刷新由页签提供，记录本体沿用全局审批组件（业务逻辑、
// 筛选与 5s 轮询都在组件内），embedded 模式避免标题与卡片重复嵌套。
export function InterceptTab({ taskId }: { taskId: string }) {
  const [refreshSignal, setRefreshSignal] = React.useState(0);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheckIcon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] leading-5 font-semibold text-foreground">拦截审批</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
              本任务的工具调用审批：展开记录查看请求、裁决依据与执行结果。
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshSignal((v) => v + 1)}>
          <RefreshCwIcon data-icon="inline-start" />
          刷新
        </Button>
      </div>
      <ApprovalRecords key={taskId} taskId={taskId} embedded refreshSignal={refreshSignal} />
    </div>
  );
}
