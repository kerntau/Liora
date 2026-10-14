import * as React from "react";
import { Button, Input, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { sseUrl } from "@/lib/api";
import type { LogLine } from "@/lib/types";
import { cn } from "@/lib/utils";
const levelTone: Record<LogLine["level"], string> = {
    info: "text-foreground/80",
    warn: "text-warning dark:text-warning",
    error: "text-danger dark:text-danger",
};
const levelDot: Record<LogLine["level"], string> = {
    info: "bg-surface-secondary/40",
    warn: "bg-warning",
    error: "bg-danger",
};
function fmtTime(ts: string) {
    const d = new Date(ts);
    if (isNaN(d.getTime()))
        return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
export default function LogsPage() {
    const [lines, setLines] = React.useState<LogLine[]>([]);
    const [q, setQ] = React.useState("");
    const [level, setLevel] = React.useState<"all" | LogLine["level"]>("all");
    const [paused, setPaused] = React.useState(false);
    const [loadingHistory, setLoadingHistory] = React.useState(false);
    const [hasMore, setHasMore] = React.useState(false);
    const bottom = React.useRef<HTMLDivElement>(null);
    const stick = React.useRef(true);
    const pausedRef = React.useRef(false);
    pausedRef.current = paused;
    // Minimum db_id seen — used as the cursor for loading older history.
    const minDbId = React.useMemo(() => {
        let min = 0;
        for (const l of lines) {
            if (l.db_id && (min === 0 || l.db_id < min))
                min = l.db_id;
        }
        return min;
    }, [lines]);
    // Live tail via SSE. on connect, replays whatever is in the ring (includes
    // DB-restored history from the last 100 rows written before restart).
    React.useEffect(() => {
        const es = new EventSource(sseUrl("/api/logs/stream?since=0"));
        es.onmessage = (e) => {
            if (pausedRef.current)
                return;
            try {
                const l = JSON.parse(e.data) as LogLine;
                setLines((prev) => (prev.some((x) => x.seq === l.seq) ? prev : [...prev, l].slice(-3000)));
            }
            catch {
                /* ignore malformed frame */
            }
        };
        return () => es.close();
    }, []);
    // Mark "has more" once we have any db_id in view.
    React.useEffect(() => {
        if (minDbId > 1)
            setHasMore(true);
    }, [minDbId]);
    async function loadOlderHistory() {
        if (loadingHistory)
            return;
        setLoadingHistory(true);
        try {
            const params = minDbId > 0 ? `?before=${minDbId}&limit=200` : `?limit=200`;
            const res = await fetch(`/api/logs/history${params}`);
            if (!res.ok)
                return;
            const data = (await res.json()) as {
                items: LogLine[];
                has_more: boolean;
            };
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
                        if (!l.db_id)
                            return true;
                        if (seen.has(l.db_id))
                            return false;
                        seen.add(l.db_id);
                        return true;
                    });
                    return deduped.slice(-5000);
                });
            }
            setHasMore(data.has_more ?? false);
        }
        finally {
            setLoadingHistory(false);
        }
    }
    const filtered = React.useMemo(() => {
        const needle = q.trim().toLowerCase();
        return lines.filter((l) => (level === "all" || l.level === level) &&
            (!needle || l.text.toLowerCase().includes(needle) || l.tag.toLowerCase().includes(needle)));
    }, [lines, q, level]);
    React.useEffect(() => {
        if (stick.current && !paused)
            bottom.current?.scrollIntoView();
    }, [filtered, paused]);
    const counts = React.useMemo(() => {
        let warn = 0, error = 0;
        for (const l of lines) {
            if (l.level === "warn")
                warn++;
            else if (l.level === "error")
                error++;
        }
        return { warn, error, total: lines.length };
    }, [lines]);
    return (<div className="flex flex-1 flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">系统日志</h1>
        <p className="text-muted text-sm">后端实时日志流(planner / worker / 数据库 / 流量 …)</p>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TextField className="contents" aria-label={"过滤(文本 / tag)…"}>
            <Input placeholder="过滤(文本 / tag)…" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 max-w-xs"/>
          </TextField>
          <ToggleButtonGroup className="flex gap-1" selectionMode="single" selectedKeys={new Set([level])}>
            {(["all", "info", "warn", "error"] as const).map((lv) => (<ToggleButton key={lv} size="sm" className="h-8" onPress={() => setLevel(lv)} id={lv}>
                {lv === "all" ? "全部" : lv}
              </ToggleButton>))}
          </ToggleButtonGroup>
          <Button size="sm" className="h-8" onPress={() => setPaused((p) => !p)} variant={paused ? "primary" : "outline"}>
            {paused ? "已暂停" : "暂停"}
          </Button>
          <Button size="sm" className="h-8" onPress={() => setLines([])} variant={"outline"}>
            清空
          </Button>
          <span className="ml-auto text-xs text-muted">
            {counts.total} 行 · <span className="text-warning dark:text-warning">{counts.warn} 警告</span> ·{" "}
            <span className="text-danger dark:text-danger">{counts.error} 错误</span>
          </span>
        </div>

        <div onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }} className="h-[calc(100vh-14rem)] overflow-auto rounded-lg border bg-surface p-2 font-mono text-xs leading-relaxed">
          {hasMore && (<div className="flex justify-center py-2">
              <Button size="sm" className="h-7 text-xs" isDisabled={loadingHistory} onPress={loadOlderHistory} variant={"outline"}>
                {loadingHistory ? "加载中…" : "加载更早日志"}
              </Button>
            </div>)}
          {filtered.length === 0 ? (<p className="py-10 text-center text-muted">暂无日志。</p>) : (filtered.map((l) => {
            const body = l.tag && l.text.startsWith("[" + l.tag + "]") ? l.text.slice(l.tag.length + 2).trimStart() : l.text;
            return (<div key={l.seq} className="flex items-start gap-2 px-1 py-0.5 hover:bg-surface-secondary/40">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", levelDot[l.level])}/>
                  <span className="shrink-0 tabular-nums text-muted">{fmtTime(l.ts)}</span>
                  {l.tag && (<span className="shrink-0 rounded bg-surface-secondary px-1 text-[10px] text-foreground/70">
                      {l.tag}
                    </span>)}
                  <span className={cn("min-w-0 whitespace-pre-wrap break-words", levelTone[l.level])}>{body}</span>
                </div>);
        }))}
          <div ref={bottom}/>
        </div>
      </div>
    </div>);
}
