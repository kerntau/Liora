"use client";

import * as React from "react";

import { toast } from "@/components/ui/sonner";

import { HttpCodeBlock } from "@/components/http-code-block";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { FindingTrafficDetail, TrafficDetail } from "@/lib/types";

// 超过内联阈值的正文会被后端替换成一行指针（见 traffic/traffic.go assembleRaw），
// 原文留在 blob 存储里，可按 hash 取回。
const BLOB_MARKER_RE = /…\[truncated\] @blob sha256:([0-9a-f]{64}) \(len=(\d+)\)/;
// 内联预览最多保留这么多字节（traffic.go blobPreview），去重窗口只需覆盖它。
const BLOB_PREVIEW_LIMIT = 8 * 1024;

type TrafficSide = "request" | "response";
const TRAFFIC_SIDES: readonly TrafficSide[] = ["request", "response"];

interface BlobMarker {
  hash: string;
  len: number;
  index: number;
  length: number;
}

interface BlobLoad {
  status: "idle" | "loading" | "loaded";
  text?: string;
}

// 每种加载状态对应的提示与按钮文案。
const BLOB_HINT: Record<BlobLoad["status"], string> = {
  idle: "当前为预览",
  loading: "正在加载完整正文…",
  loaded: "已加载完整正文",
};
const BLOB_ACTION: Record<BlobLoad["status"], string> = {
  idle: "加载完整正文",
  loading: "加载中…",
  loaded: "已加载完整正文",
};

function emptyBlobLoads(): Record<TrafficSide, BlobLoad> {
  return { request: { status: "idle" }, response: { status: "idle" } };
}

function findBlobMarker(raw: string): BlobMarker | null {
  const match = BLOB_MARKER_RE.exec(raw);
  if (!match) return null;
  return { hash: match[1], len: Number(match[2]), index: match.index, length: match[0].length };
}

// 指针前面的内联预览就是同一份正文的开头，只替换指针会把这些字节打印两遍。
// 先裁掉与全文开头重合的那段后缀；内联部分不是全文前缀时（二进制正文只留一行摘要）
// 什么都不裁，退化成只替换指针本身。
function expandBlobMarker(raw: string, marker: BlobMarker, full: string): string {
  const before = raw.slice(0, marker.index);
  // 指针单独占一行，它前面的换行属于指针而不是正文，替换时一并去掉。
  let separator = "";
  if (before.endsWith("\r\n")) separator = "\r\n";
  else if (before.endsWith("\n")) separator = "\n";
  const text = before.slice(0, before.length - separator.length);
  const overlap = sharedSuffixLength(text, full);
  return text.slice(0, text.length - overlap) + full + raw.slice(marker.index + marker.length);
}

function sharedSuffixLength(before: string, full: string): number {
  const max = Math.min(before.length, full.length, BLOB_PREVIEW_LIMIT);
  for (let n = max; n > 0; n--) {
    if (before.charCodeAt(before.length - n) !== full.charCodeAt(0)) continue;
    if (full.startsWith(before.slice(before.length - n))) return n;
  }
  return 0;
}

export function TrafficEvidenceViewer({
  findingId,
  bindingId,
  contextTask,
  onClose,
}: {
  findingId: string;
  bindingId: string | null;
  contextTask?: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<FindingTrafficDetail | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!bindingId) return;
    let active = true;
    setDetail(null);
    setError("");
    api
      .findingTrafficDetail(findingId, bindingId, contextTask)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [findingId, bindingId, contextTask]);

  async function more(side: "request" | "response") {
    if (!detail || !bindingId) return;
    setBusy(true);
    try {
      const next = await api.findingTrafficBody(findingId, bindingId, side, detail[side].next_offset, contextTask);
      setDetail((current) =>
        current?.binding.id === bindingId
          ? { ...current, [side]: { ...next, content: current[side].content + next.content } }
          : current,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={bindingId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>流量证据 #{bindingId}</DialogTitle>
          <DialogDescription className="break-all">
            {detail?.binding.snapshot.url ?? "查看绑定时保存的请求与响应"}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : detail ? (
          <Tabs defaultValue="request">
            <TabsList>
              <TabsTrigger value="request">请求 Request</TabsTrigger>
              <TabsTrigger value="response">响应 Response</TabsTrigger>
            </TabsList>
            {(["request", "response"] as const).map((side) => (
              <TabsContent key={side} value={side}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    正文 {detail[side].total.toLocaleString()} 字节{detail[side].truncated ? " · 当前为预览" : ""}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void api
                        .downloadFindingTrafficBody(findingId, detail.binding.id, side, contextTask)
                        .catch((e: Error) => toast.error(e.message))
                    }
                  >
                    下载完整{side === "request" ? "请求" : "响应"}正文
                  </Button>
                </div>
                <HttpCodeBlock
                  raw={`${(side === "request" ? detail.binding.snapshot.req_head : detail.binding.snapshot.resp_head)?.trimEnd() ?? ""}\n\n${detail[side].content}`}
                />
                {detail[side].truncated && !detail[side].binary ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void more(side)}>
                    加载更多正文
                  </Button>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Skeleton className="h-56 w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CapturedTrafficViewer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [detail, setDetail] = React.useState<TrafficDetail | null>(null);
  const [error, setError] = React.useState("");
  // 两个 Tab 各存一份加载状态，互不影响。
  const [blobs, setBlobs] = React.useState<Record<TrafficSide, BlobLoad>>(emptyBlobLoads);
  // 记住当前展示的流量 ID，切换后丢弃上一轮迟到的 blob 结果。
  const currentId = React.useRef(id);
  React.useEffect(() => {
    currentId.current = id;
    if (!id) return;
    let active = true;
    setDetail(null);
    setError("");
    setBlobs(emptyBlobLoads());
    api
      .trafficExchange(id)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function loadBlob(side: TrafficSide, hash: string) {
    const forId = id;
    setBlobs((current) => ({ ...current, [side]: { status: "loading" } }));
    try {
      const text = await api.trafficBlobText(hash);
      if (currentId.current !== forId) return;
      setBlobs((current) => ({ ...current, [side]: { status: "loaded", text } }));
    } catch (e) {
      if (currentId.current !== forId) return;
      setBlobs((current) => ({ ...current, [side]: { status: "idle" } }));
      toast.error((e as Error).message);
    }
  }

  const views = React.useMemo(() => {
    if (!detail) return null;
    const out = {} as Record<TrafficSide, { text: string; marker: BlobMarker | null }>;
    for (const side of TRAFFIC_SIDES) {
      const raw = side === "request" ? detail.req : detail.resp;
      const marker = findBlobMarker(raw);
      const loaded = blobs[side].status === "loaded" ? blobs[side].text : undefined;
      out[side] = {
        marker,
        text: marker && loaded !== undefined ? expandBlobMarker(raw, marker, loaded) : raw,
      };
    }
    return out;
  }, [detail, blobs]);

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>预览流量</DialogTitle>
          <DialogDescription>流量 ID：{id}。绑定时会保存完整正文。</DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : detail ? (
          <Tabs defaultValue="request">
            <TabsList>
              <TabsTrigger value="request">请求 Request</TabsTrigger>
              <TabsTrigger value="response">响应 Response</TabsTrigger>
            </TabsList>
            {views
              ? TRAFFIC_SIDES.map((side) => {
                  const state = blobs[side];
                  const marker = views[side].marker;
                  return (
                    <TabsContent key={side} value={side}>
                      {marker ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-muted-foreground text-xs">
                            正文共 {marker.len.toLocaleString()} 字节，{BLOB_HINT[state.status]}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={state.status !== "idle"}
                            onClick={() => void loadBlob(side, marker.hash)}
                          >
                            {BLOB_ACTION[state.status]}
                          </Button>
                        </div>
                      ) : null}
                      <HttpCodeBlock raw={views[side].text} />
                    </TabsContent>
                  );
                })
              : null}
          </Tabs>
        ) : (
          <Skeleton className="h-56 w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}
