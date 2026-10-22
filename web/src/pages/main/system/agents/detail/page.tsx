"use client";

import * as React from "react";

import { useSearchParams } from "@/lib/router-compat";

import { BotIcon } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { AgentEditor } from "@/components/agent-editor";

// Deep-link editor page for one agent. The primary flow is the drawer on
// /system/agents; this page reuses the same AgentEditor component full-width so a
// direct URL (or an external link) still opens the editor.
function AgentDetailInner() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key") ?? "";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        icon={BotIcon}
        backTo="/system/agents"
        backLabel="返回 Agent 列表"
        title="Agent 详情"
        description="编辑提示词、模型、可见资源与工具绑定；改动按区块分别保存。"
        meta={
          key ? (
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground">{key}</code>
          ) : (
            <span className="text-warning">缺少 key 参数</span>
          )
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
        <AgentEditor agentKey={key} />
      </div>
    </div>
  );
}

// useSearchParams must sit under a Suspense boundary for static export.
export default function AgentDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <AgentDetailInner />
    </React.Suspense>
  );
}
