"use client";

import * as React from "react";

import { NetworkIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ASSET_COLORS, ASSET_TYPE_LABELS } from "./format";
import { SectionTitle } from "./shared";

interface AssetPanelProps {
  assetCounts: Record<string, number>;
  totalAssets: number;
}

export function AssetPanel({ assetCounts, totalAssets }: AssetPanelProps) {
  // asset type breakdown
  const assetByType = React.useMemo(() => {
    return Object.entries(assetCounts)
      .filter(([, n]) => n > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [assetCounts]);

  const assetMax = assetByType[0]?.[1] ?? 1;

  return (
    <Card className="p-4">
      <SectionTitle icon={NetworkIcon} sub="按类型">
        资产分布
      </SectionTitle>

      {assetByType.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">暂无资产数据</div>
      ) : (
        <div className="flex flex-col gap-2">
          {assetByType.map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground">
                {ASSET_TYPE_LABELS[type] ?? type}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", ASSET_COLORS[type] ?? "bg-slate-400")}
                  style={{ width: `${(count / assetMax) * 100}%` }}
                />
              </div>
              <span className="w-4 text-right tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 border-t pt-3 text-[10px] text-muted-foreground">共 {totalAssets} 节点</div>
    </Card>
  );
}
