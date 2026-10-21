"use client";

import * as React from "react";

import { ArrowUpRightIcon, BugIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "@/lib/router-compat";
import type { Finding } from "@/lib/types";

import { fmtRel } from "./format";

interface FindingPanelProps {
  findings: Finding[];
  fastReady: boolean;
}

export function FindingPanel({ findings, fastReady }: FindingPanelProps) {
  const recentFindings = React.useMemo(
    () => [...findings].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 8),
    [findings],
  );

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <BugIcon className="size-3.5 text-muted-foreground" />
          发现
        </div>
        <Link
          href="/function/findings"
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          全部 <ArrowUpRightIcon className="size-3" />
        </Link>
      </div>

      <div className="divide-y">
        {recentFindings.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {fastReady ? "暂无发现" : <Skeleton className="mx-auto h-4 w-32" />}
          </div>
        ) : (
          recentFindings.map((f) => (
            <div key={f.id} className="flex items-start gap-2 py-2">
              <StatusBadge domain="severity" value={f.severity} className="mt-0.5 shrink-0 px-1.5 py-0 text-[10px]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold">{f.vulnclass}</span>
                  {f.task_description && (
                    <span className="truncate text-[10px] text-muted-foreground">{f.task_description}</span>
                  )}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{f.summary}</div>
              </div>
              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">{fmtRel(f.ts)}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
