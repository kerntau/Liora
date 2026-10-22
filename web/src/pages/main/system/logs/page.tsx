"use client";

import * as React from "react";
import { EraserIcon, HistoryIcon, PauseIcon, PlayIcon, ScrollTextIcon, SearchIcon, TerminalIcon } from "lucide-react";

import { MetaItems, PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sseUrl } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import type { LogLine } from "@/lib/types";
import { cn } from "@/lib/utils";

const levelTone: Record<LogLine["level"], string> = {
  info: "text-foreground/85",
  warn: "text-warning",
  error: "text-destructive",
};
const levelDot: Record<LogLine["level"], string> = {
  info: "bg-muted-foreground/50",
  warn: "bg-warning",
  error: "bg-destructive",
};
const levelPill: Record<LogLine["level"], string> = {
  info: "border-border bg-muted text-muted-foreground",
  warn: "border-warning/25 bg-warning/10 text-warning",
  error: "border-destructive/25 bg-destructive/10 text-destructive",
};
// 级别不只靠颜色区分：给读屏用户提供同义文本。
const levelLabel: Record<LogLine["level"], string> = {
  info: "信息",
  warn: "警告",
  error: "错误",
};

export default function LogsPage() {
  const [lines, setLines] = React.useState<LogLine[]>([]);
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState<"all" | LogLine["level"]>("all");
  const [paused, setPaused] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  // SSE 连接态：首连成功前都算"重连中"，断线时 EventSource 会自动重试。
  const [liveState, setLiveState] = React.useState<"live" | "reconnecting">("reconnecting");
  // 只滚动日志面板本身：scrollIntoView 会连带把 MainContent 滚到底，页面标题会被顶出视口。
  const scrollRef = React.useRef<HTMLElement>(null);
  const stick = React.useRef(true);
  const pausedRef = React.useRef(false);
  pausedRef.current = paused;

  // Minimum db_id seen — used as the cursor for loading older history.
  const minDbId = React.useMemo(() => {
    let min = 0;
    for (const l of lines) {
      if (l.db_id && (min === 0 || l.db_id < min)) min = l.db_id;
    }
    return min;
  }, [lines]);

  // Live tail via SSE. on connect, replays whatever is in the ring (includes
  // DB-restored history from the last 100 rows written before restart).
  React.useEffect(() => {
    const es = new EventSource(sseUrl("/api/logs/stream?since=0"));
    es.onopen = () => setLiveState("live");
    es.onerror = () => setLiveState("reconnecting");
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const l = JSON.parse(e.data) as LogLine;
        setLines((prev) => (prev.some((x) => x.seq === l.seq) ? prev : [...prev, l].slice(-3000)));
      } catch {
        /* ignore malformed frame */
      }
    };
    return () => es.close();
  }, []);

  // Mark "has more" once we have any db_id in view.
  React.useEffect(() => {
    if (minDbId > 1) setHasMore(true);
  }, [minDbId]);

  async function loadOlderHistory() {
    if (loadingHistory) return;
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const params = minDbId > 0 ? `?before=${minDbId}&limit=200` : `?limit=200`;
      const res = await fetch(`/api/logs/history${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { items: LogLine[]; has_more: boolean };
      if (data.items?.length) {
        // Assign synthetic seq numbers below current minimum to keep dedup working.
        setLines((prev) => {
          const minSeq = prev.reduce((m, l) => Math.min(m, l.seq ?? 0), 0);
          const older = data.items.map((l, i) => ({
            ...l,
            seq: minSeq - data.items.length + i,
          }));
          // Prepend, dedup by db_id, cap at 5000.
          const merged = [...older, ...prev];
          const seen = new Set<number>();
          const deduped = merged.filter((l) => {
            if (!l.db_id) return true;
            if (seen.has(l.db_id)) return false;
            seen.add(l.db_id);
            return true;
          });
          return deduped.slice(-5000);
        });
      }
      setHasMore(data.has_more ?? false);
    } catch (e) {
      setHistoryError((e as Error).message || "请求失败");
    } finally {
      setLoadingHistory(false);
    }
  }

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lines.filter(
      (l) =>
        (level === "all" || l.level === level) &&
        (!needle || l.text.toLowerCase().includes(needle) || l.tag.toLowerCase().includes(needle)),
    );
  }, [lines, q, level]);

  React.useEffect(() => {
    if (!stick.current || paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered, paused]);

  const counts = React.useMemo(() => {
    let warn = 0,
      error = 0;
    for (const l of lines) {
      if (l.level === "warn") warn++;
      else if (l.level === "error") error++;
    }
    return { warn, error, total: lines.length };
  }, [lines]);

  const filtering = q.trim() !== "" || level !== "all";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        icon={ScrollTextIcon}
        title="系统日志"
        description="后端实时日志流（planner / worker / 数据库 / 流量 …），断线自动重连。"
        meta={
          // 相邻是胶囊，加竖线反而脏：divider="none" 只保留 8px 间距。
          <MetaItems
            divider="none"
            items={[
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  liveState === "live"
                    ? "border-success/25 bg-success/10 text-success"
                    : "border-warning/25 bg-warning/10 text-warning",
                )}
              >
                <span className={cn("size-1.5 rounded-full", liveState === "live" ? "bg-success" : "bg-warning")} />
                {liveState === "live" ? "实时" : "重连中"}
              </span>,
              paused ? <span className="text-warning">已暂停接收新日志</span> : null,
            ]}
          />
        }
        actions={
          <>
            <Button size="sm" variant={paused ? "default" : "outline"} onClick={() => setPaused((p) => !p)}>
              {paused ? <PlayIcon /> : <PauseIcon />}
              {paused ? "已暂停" : "暂停"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLines([])}>
              <EraserIcon /> 清空
            </Button>
          </>
        }
      />

      <SectionCard
        icon={TerminalIcon}
        title="实时日志流"
        description="最新 3000 行；暂停后不再接收新日志，历史仍可继续加载。"
        bodyClassName="px-0 pb-0"
        dense
      >
        <div className="flex flex-col gap-2 border-y border-border/70 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="过滤系统日志"
              placeholder="过滤(文本 / tag)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 pl-8 font-mono text-[13px]"
            />
          </div>
          <div
            role="group"
            aria-label="日志级别筛选"
            className="flex h-8 items-center gap-0.5 rounded-lg border border-border/70 bg-surface-muted p-0.5"
          >
            {(["all", "info", "warn", "error"] as const).map((lv) => (
              <Button
                key={lv}
                size="sm"
                variant={level === lv ? "default" : "ghost"}
                className="h-7 px-2.5 text-[12px]"
                aria-pressed={level === lv}
                onClick={() => setLevel(lv)}
              >
                {lv === "all" ? "全部" : levelLabel[lv]}
              </Button>
            ))}
          </div>
          <MetaItems
            className="sm:ml-auto"
            items={[
              filtering ? <span className="tabular-nums">匹配 {filtered.length} 行</span> : null,
              <span className="tabular-nums">共 {counts.total} 行</span>,
              <span className="tabular-nums text-warning">{counts.warn} 警告</span>,
              <span className="tabular-nums text-destructive">{counts.error} 错误</span>,
            ]}
          />
        </div>

        {/* 日志区自己滚动：不给它 tabIndex 的话键盘用户根本滚不动这块内容，
            只能靠鼠标滚轮 / 触控板。 */}
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: 可滚动容器必须能获得焦点，否则键盘无法滚动日志（WCAG 2.1.1） */}
        <section
          ref={scrollRef}
          tabIndex={0}
          aria-label="系统日志内容"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
          className={cn(
            "overflow-auto overscroll-contain px-2 py-2 font-mono text-xs leading-relaxed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            lines.length > 0 ? "h-[calc(100dvh-27rem)] min-h-[320px]" : "min-h-[160px]",
          )}
        >
          {hasMore && (
            <div className="flex flex-col items-center gap-1 py-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                disabled={loadingHistory}
                onClick={loadOlderHistory}
              >
                <HistoryIcon className="size-3.5" />
                {loadingHistory ? "加载中…" : "加载更早日志"}
              </Button>
              {historyError && (
                <p role="alert" className="text-destructive text-xs">
                  更早日志加载失败：{historyError}
                </p>
              )}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 text-center font-sans">
              <ScrollTextIcon className="size-6 text-muted-foreground/50" />
              <p className="text-[13px] font-medium text-foreground">暂无日志</p>
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                {filtering ? "当前过滤条件下没有匹配的日志，试试放宽级别或关键词。" : "等待后端输出日志，或确认服务正在运行。"}
              </p>
              {filtering && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => {
                    setQ("");
                    setLevel("all");
                  }}
                >
                  清除筛选
                </Button>
              )}
            </div>
          ) : (
            filtered.map((l) => {
              const body =
                l.tag && l.text.startsWith("[" + l.tag + "]")
                  ? l.text.slice(l.tag.length + 2).trimStart()
                  : l.text;
              return (
                <div
                  key={l.seq}
                  className="flex flex-col gap-1 rounded-lg px-2 py-1.5 hover:bg-muted/50 sm:grid sm:grid-cols-[76px_148px_minmax(0,1fr)] sm:items-start sm:gap-3"
                >
                  <div className="flex items-center gap-2 sm:contents">
                    {/* 直接显示中文级别：既不再泄漏 info/warn/error 这类英文枚举，
                        读屏与视觉也是同一份文案，无需再加一份 sr-only 副本。 */}
                    <span
                      className={cn(
                        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-sans text-[11px] font-semibold",
                        levelPill[l.level],
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", levelDot[l.level])} />
                      {levelLabel[l.level]}
                    </span>
                    <time className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {fmtTime(l.ts, "datetime")}
                    </time>
                  </div>
                  <div className="min-w-0">
                    {l.tag && (
                      <span className="mr-1.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {l.tag}
                      </span>
                    )}
                    <span className={cn("text-[12px] whitespace-pre-wrap break-words", levelTone[l.level])}>{body}</span>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </SectionCard>
    </div>
  );
}
