"use client";

import * as React from "react";

import { ChevronRightIcon, NetworkIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FindingAssetNode } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AssetTree, assetPathOf } from "./asset-tree";
import { StateBlock, TableSkeleton } from "./state-block";

interface AssetTreePanelProps {
  nodes: FindingAssetNode[];
  /** 当前选中的资产节点;null = 全部资产。 */
  scope: string | null;
  onScopeChange: (key: string | null) => void;
  /** 树是否已取过;loading 且未取过时先给骨架,避免闪一下空树。 */
  loaded: boolean;
  loading: boolean;
  /** 最近一次拉取失败的原因;首载失败时显示错误卡片,已有树时保留旧树并提示。 */
  error: string | null;
  truncated: boolean;
  droppedKinds: string[];
  /** 未选中任何资产时的发现总数,用于「全部资产」那一行。 */
  findingTotal: number;
  /** 资产视图不轮询,树的计数靠这个按钮或页面内的增删改来刷新。 */
  onRefresh: () => void;
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
  error,
  truncated,
  droppedKinds,
  findingTotal,
  onRefresh,
  children,
}: AssetTreePanelProps) {
  // 面包屑:从顶层到当前节点的路径,每级只显示相对上一级的增量。
  const path = React.useMemo(() => assetPathOf(nodes, scope), [nodes, scope]);

  return (
    <div className="grid min-h-0 items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="gap-0 overflow-hidden py-0 lg:sticky lg:top-20">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex min-w-0 items-start gap-2">
            <NetworkIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-foreground text-[13px] leading-5 font-semibold">资产树</h2>
              <p className="text-muted-foreground truncate text-[12px] leading-5">按企业 / 域名 / IP 下钻</p>
            </div>
          </div>
          <span className="app-chip h-6 shrink-0 tabular-nums">{nodes.length} 节点</span>
        </div>
        <div className="flex max-h-[26rem] flex-col px-3 pb-3 lg:max-h-[calc(100vh-14rem)]">
          {!loaded && error ? (
            <StateBlock
              icon={TriangleAlertIcon}
              tone="error"
              title="资产树加载失败"
              description={error}
              className="min-h-36 px-2 py-8"
              action={
                <Button size="sm" variant="outline" onClick={onRefresh}>
                  重试
                </Button>
              }
            />
          ) : loading && !loaded ? (
            <TableSkeleton rows={5} columns={2} />
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">资产树刷新失败：{error}</span>
                  <Button size="sm" variant="outline" onClick={onRefresh}>
                    重试
                  </Button>
                </div>
              )}
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
            </>
          )}
        </div>
      </Card>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="border-border/60 bg-card text-muted-foreground flex min-w-0 flex-wrap items-center gap-1 rounded-lg border px-3 py-2 text-[12px]">
          <button
            type="button"
            className={cn(
              "rounded-md px-1.5 py-0.5 transition-colors hover:text-foreground",
              scope === null && "bg-primary/10 font-medium text-primary",
            )}
            onClick={() => onScopeChange(null)}
          >
            全部资产
          </button>
          {path.map((node) => (
            <React.Fragment key={node.key}>
              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <button
                type="button"
                className={cn(
                  "max-w-[16rem] truncate rounded-md px-1.5 py-0.5 transition-colors hover:text-foreground",
                  node.key === scope && "bg-primary/10 font-medium text-primary",
                )}
                title={node.label}
                onClick={() => onScopeChange(node.key)}
              >
                {node.display}
              </button>
            </React.Fragment>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
