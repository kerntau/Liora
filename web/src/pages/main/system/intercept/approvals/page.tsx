"use client";

import * as React from "react";
import { ClipboardListIcon, RefreshCwIcon } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { ApprovalRecords } from "@/components/approval-records";
import { Button } from "@/components/ui/button";

export default function ApprovalsPage() {
  // 只作为页面级刷新信号，不改变 ApprovalRecords 内部的 5s 轮询。
  const [refreshSignal, setRefreshSignal] = React.useState(0);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <PageHeader
        icon={ClipboardListIcon}
        title="审批记录"
        description="查看工具调用的审批裁决、判定来源与执行结果，并处理待审批请求。"
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshSignal((n) => n + 1)}>
            <RefreshCwIcon className="size-4" />
            刷新
          </Button>
        }
      />
      <ApprovalRecords embedded refreshSignal={refreshSignal} />
    </div>
  );
}
