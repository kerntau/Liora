"use client";

import * as React from "react";

import { ChevronRightIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { FindingAssetNode } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AssetTree, assetPathOf } from "./asset-tree";

interface AssetTreePanelProps {
  nodes: FindingAssetNode[];
  /** 当前选中的资产节点;null = 全部资产。 */
  scope: string | null;
  onScopeChange: (key: string | null) => void;
  /** 树是否已取过;loading 且未取过时先给骨架,避免闪一下空树。 */
  loaded: boolean;
  loading: boolean;
  truncated: boolean;
  droppedKinds: string[];
  /** 未选中任何资产时的发现总数,用于「全部资产」那一行。 */
  findingTotal: number;
  /** 资产视图不轮询,树的计数靠这个按钮或页面内的增删改来刷新。 */
  onRefresh: () => void;
  /** 右侧列表当前口径下的条数。 */
  total: number;
  /** 右侧列表(与平铺视图共用同一张表 + 同一份分页)。 */
  children: React.ReactNode;
}

// AssetTreePanel 是「按资产」视图的左树 + 面包屑 + 右侧列表布局。树本身复用
// asset-tree.tsx,这里只负责把资产快照接到列表上。
export function AssetTreePanel({
  nodes,
  scope,
  onScopeChange,
  loaded,
  loading,
  truncated,
  droppedKinds,
  findingTotal,
  onRefresh,
  total,
  children,
}: AssetTreePanelProps) {
  // 面包屑:从顶层到当前节点的路径,每级只显示相对上一级的增量。
  const path = React.useMemo(() => assetPathOf(nodes, scope), [nodes, scope]);

  return (
    <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
      <Card className="gap-0 py-3 lg:sticky lg:top-4">
        <CardContent className="flex max-h-[24rem] flex-col px-3 lg:max-h-[calc(100vh-14rem)]">
          {loading && !loaded ? (
            <div className="flex min-h-36 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <AssetTree
              nodes={nodes}
              selected={scope}
              onSelect={onScopeChange}
              loading={loading}
              truncated={truncated}
              droppedKinds={droppedKinds}
              findingTotal={findingTotal}
              onRefresh={onRefresh}
            />
          )}
        </CardContent>
      </Card>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button
            type="button"
            className={cn("hover:text-foreground", scope === null && "font-medium text-foreground")}
            onClick={() => onScopeChange(null)}
          >
            全部资产
          </button>
          {path.map((node) => (
            <React.Fragment key={node.key}>
              <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <button
                type="button"
                className={cn(
                  "max-w-[16rem] truncate hover:text-foreground",
                  node.key === scope && "font-medium text-foreground",
                )}
                title={node.label}
                onClick={() => onScopeChange(node.key)}
              >
                {node.display}
              </button>
            </React.Fragment>
          ))}
          <span className="ml-auto shrink-0 text-xs tabular-nums">共 {total} 条</span>
        </div>
        {children}
      </div>
    </div>
  );
}
