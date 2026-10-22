"use client";

import * as React from "react";

import { ArrowUpRightIcon, BugIcon } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SECTION_TITLE_CLASS } from "@/lib/typography";
import Link from "@/lib/router-compat";
import type { Finding } from "@/lib/types";
import { cn } from "@/lib/utils";

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
    <Card className="gap-0 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <BugIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("truncate", SECTION_TITLE_CLASS)}>发现</span>
        </div>
        <Link
          prefetch={false}
          href="/function/findings"
          className="flex shrink-0 items-center gap-0.5 rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          全部 <ArrowUpRightIcon className="size-3" aria-hidden="true" />
        </Link>
      </div>

      <div className="divide-y divide-border/60">
        {recentFindings.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {fastReady ? "暂无发现" : <Skeleton className="mx-auto h-4 w-32" />}
          </div>
        ) : (
          recentFindings.map((f) => (
            <div key={f.id} className="flex items-start gap-2 py-2.5">
              <StatusBadge
                domain="severity"
                value={f.severity}
                className="mt-0.5 shrink-0 px-1.5 py-0 text-[11px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate text-xs font-semibold text-foreground">{f.vulnclass}</span>
                  {f.task_description ? (
                    <span className="truncate text-[11px] text-muted-foreground">{f.task_description}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{f.summary}</div>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{fmtRel(f.ts)}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
