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
    <Card className="p-4">
      <SectionTitle icon={ActivityIcon} sub={`${traffic.length} 次请求`}>
        流量状态码
      </SectionTitle>

      {/* bar chart */}
      {trafficByCodes.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">暂无流量数据</div>
      ) : (
        <>
          <div className="mb-3 flex items-end gap-2" style={{ height: 52 }}>
            {trafficByCodes.map(({ code, n }) => (
              <div key={code} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[9px] tabular-nums text-muted-foreground">{n}</span>
                <div
                  className={cn("w-full min-h-1 rounded-sm", statusBg(code), "opacity-80")}
                  style={{ height: Math.max(4, (n / trafficMax) * 36) }}
                />
                <span className={cn("text-[9px] font-mono", statusColor(code))}>{code}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-2.5">
            <div className="mb-1.5 text-[10px] text-muted-foreground">最近请求</div>
            <div className="flex flex-col gap-1.5">
              {recentTraffic.map((e) => (
                <div key={e.id} className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1 py-0 font-mono text-[9px]",
                      e.method === "GET"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-400",
                    )}
                  >
                    {e.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {e.host}
                    {e.url.replace(/^https?:\/\/[^/]+/, "").substring(0, 30)}
                  </span>
                  <span className={cn("shrink-0 font-mono text-[9px]", statusColor(e.status))}>{e.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
