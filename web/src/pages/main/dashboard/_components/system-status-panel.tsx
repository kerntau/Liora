"use client";

import type { ReactNode } from "react";

import { GaugeIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LLMProfile, Settings, Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SectionTitle } from "./shared";

interface SystemStatusPanelProps {
  stats: Stats | null;
  settings: Settings | null;
  activeProfile: LLMProfile | undefined;
}

function StatusRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  );
}

/** 系统状态：LLM 配置、流量捕获与激活模型（原系统状态卡的完整信息）。 */
export function SystemStatusPanel({ stats, settings, activeProfile }: SystemStatusPanelProps) {
  return (
    <Card className="gap-0 p-4" role="region" aria-label="系统状态">
      <SectionTitle icon={GaugeIcon}>系统状态</SectionTitle>

      <div className="divide-y divide-border/60">
        <StatusRow label="LLM 配置">
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-2 text-[11px]",
              stats?.llm_configured
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {stats?.llm_configured ? "已配置" : "未配置"}
          </Badge>
        </StatusRow>

        <StatusRow label="流量捕获">
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-2 text-[11px]",
              settings?.traffic_capture ? "border-chart-4/30 bg-chart-4/10 text-chart-4" : "text-muted-foreground",
            )}
          >
            {settings?.traffic_capture ? "开启" : "关闭"}
          </Badge>
        </StatusRow>

        {activeProfile ? (
          <StatusRow label="激活模型">
            <span className="max-w-[60%] truncate font-mono text-xs text-foreground" title={activeProfile.model}>
              {activeProfile.model}
            </span>
          </StatusRow>
        ) : null}
      </div>
    </Card>
  );
}