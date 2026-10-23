"use client";

import * as React from "react";

import { ActivityIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { TrafficExchange } from "@/lib/types";
import { cn } from "@/lib/utils";

import { statusBg, statusColor } from "./format";
import { SectionTitle } from "./shared";

interface TrafficPanelProps {
  traffic: TrafficExchange[];
}

export function TrafficPanel({ traffic }: TrafficPanelProps) {
  // traffic status code breakdown
  const trafficByCodes = React.useMemo(() => {
    const m: Record<number, number> = {};
    for (const e of traffic) {
      const bucket = Math.floor(e.status / 100) * 100;
      m[bucket] = (m[bucket] ?? 0) + 1;
    }
    return Object.entries(m)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([code, n]) => ({ code: Number(code), n }));
  }, [traffic]);

  const trafficMax = Math.max(...trafficByCodes.map((x) => x.n), 1);
  const recentTraffic = [...traffic].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 5);

  return (
    <Card className="gap-0 p-4">
      <SectionTitle icon={ActivityIcon} sub={`${traffic.length} 次请求`}>
        流量状态码
      </SectionTitle>

      {/* bar chart */}
      {trafficByCodes.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground text-xs">暂无流量数据</div>
      ) : (
        <>
          <div className="mb-3 flex items-end gap-2" style={{ height: 74 }}>
            {trafficByCodes.map(({ code, n }) => (
              <div key={code} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[11px] text-muted-foreground tabular-nums">{n}</span>
                {/* 数据柱:细条 rounded-full,与资产分布/进度条同圆角同规格 */}
                <div
                  className={cn("min-h-1 w-full rounded-full", statusBg(code), "opacity-80")}
                  style={{ height: Math.max(4, (n / trafficMax) * 30) }}
                />
                <span className={cn("font-mono text-[11px]", statusColor(code))}>{code}</span>
              </div>
            ))}
          </div>

          <div className="border-border/60 border-t pt-3">
            <div className="mb-1.5 text-muted-foreground text-xs">最近请求</div>
            <div className="flex flex-col gap-2">
              {recentTraffic.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1 font-mono text-[11px] leading-4",
                      // 方法徽标:低透明度底 + 600/400 文字,蓝统一收敛为 sky
                      e.method === "GET"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
                    )}
                  >
                    {e.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
                    {e.host}
                    {e.url.replace(/^https?:\/\/[^/]+/, "").substring(0, 30)}
                  </span>
                  <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", statusColor(e.status))}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
