"use client";

import * as React from "react";

import { RefreshCwIcon, WaypointsIcon } from "lucide-react";

import { SectionCard } from "@/components/app/section-card";
import { ExplorationGraph } from "@/components/exploration-graph";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Edge, TaskNode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GraphTab({ taskId }: { taskId: string }) {
  const [nodes, setNodes] = React.useState<TaskNode[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  // 上一次图数据的签名:轮询拿到相同数据时跳过 setState,避免整图无谓重建(拖动时
  // 才不会被 20s 轮询打断而顿挫)。只取影响渲染的字段。
  const sigRef = React.useRef("");
  const runRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    let cancelled = false;
    sigRef.current = ""; // 换任务:强制下一次刷新
    const load = () => {
      api
        .explorationGraph(taskId)
        .then((g) => {
          if (cancelled) return;
          const ns = g.nodes ?? [];
          const es = g.edges ?? [];
          const sig = JSON.stringify([
            ns.map((n) => [n.id, n.type, n.state, n.priority, n.payload]),
            es.map((e) => [e.src, e.dst, e.rel]),
          ]);
          if (sig === sigRef.current) return; // 无变化 → 不重建
          sigRef.current = sig;
          setNodes(ns);
          setEdges(es);
        })
        .catch(() => {
          /* keep last good data */
        })
        .finally(() => {
          if (!cancelled) setLoaded(true);
        });
    };
    runRef.current = load;
    load();
    const timer = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [taskId]);

  // 手动刷新只重跑一次取数（复用同一条请求与签名去重），不改变 20s 轮询节奏。
  const refresh = () => {
    setRefreshing(true);
    runRef.current();
    window.setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <SectionCard
      icon={WaypointsIcon}
      title="探索链路"
      description="意图、事实与漏洞的上下游关系；可拖拽节点、滚轮缩放。"
      dense
      bodyClassName="px-0 pb-0"
      actions={
        <>
          <span className="hidden items-center gap-2 text-[11px] text-muted-foreground tabular-nums sm:flex">
            <span className="rounded-md border border-border/70 bg-surface-muted px-2 py-0.5">
              节点 <span className="font-medium text-foreground">{nodes.length}</span>
            </span>
            <span className="rounded-md border border-border/70 bg-surface-muted px-2 py-0.5">
              连线 <span className="font-medium text-foreground">{edges.length}</span>
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={refresh} aria-label="刷新探索链路" title="刷新探索链路">
            <RefreshCwIcon data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
            刷新
          </Button>
        </>
      }
    >
      <div className="border-t border-border/70 p-3 lg:p-4">
        <div className="relative h-[68svh] min-h-[22rem] w-full overflow-hidden rounded-xl border border-border/70 bg-surface-muted">
          <ExplorationGraph nodes={nodes} edges={edges} className="h-full" />
          {loaded && nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
              <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-2 rounded-lg border border-border/70 bg-card px-6 py-7 text-center shadow-[var(--shadow-card)]">
                <span className="grid size-10 place-items-center rounded-md border border-border/70 bg-surface-muted text-muted-foreground/60">
                  <WaypointsIcon className="size-5" aria-hidden="true" />
                </span>
                <p className="text-[13px] font-medium text-foreground">暂无探索链路</p>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  任务开始探索后，意图、事实与漏洞会在这里连成上下游链路。
                </p>
                <Button size="sm" variant="outline" onClick={refresh}>
                  刷新
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
