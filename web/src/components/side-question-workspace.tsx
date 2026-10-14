import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, Skeleton, TextField } from "@mui/material";
import { ArrowUpIcon, MessageCircleQuestionIcon, SquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/resizable-panels";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SideQuestions } from "@/hooks/use-side-questions";
import { cn } from "@/lib/utils";
type ComposerLayout = "inline" | "stacked";
const preparationLabels = {
    preparing: "正在准备上下文…",
    summarizing_history: "正在整理早期旁路问答…",
    compressing_snapshot: "正在压缩旁路上下文副本…",
    retrying: "模型上下文超限，正在缩减后重试…",
    answering: "正在回答…",
};
export function SideQuestionButton({ side }: {
    side: SideQuestions;
}) {
    if (!side.enabled)
        return null;
    return (<Button size="small" onClick={() => side.setOpen(true)} className="gap-1.5" aria-label={"/btw 旁路提问"} variant="text">
      <MessageCircleQuestionIcon className="size-4"/>
      <span>旁路提问</span>
      <Chip size="small" className="font-mono text-[10px]" label="/btw" />
    </Button>);
}
function SidePanel({ side, label, composerLayout, }: {
    side: SideQuestions;
    label: string;
    composerLayout: ComposerLayout;
}) {
    const inlineComposer = composerLayout === "inline";
    const [confirm, setConfirm] = useState(false);
    const viewport = useRef<HTMLDivElement>(null);
    const pinned = useRef(true);
    const tail = side.items.at(-1);
    // biome-ignore lint/correctness/useExhaustiveDependencies: New cumulative text scrolls only readers who remain at the bottom.
    useEffect(() => {
        if (pinned.current && viewport.current)
            viewport.current.scrollTop = viewport.current.scrollHeight;
    }, [tail?.answer, tail?.id]);
    const statusMap: Record<string, {
        label: string;
        color: "default" | "accent" | "success" | "warning" | "danger";
    }> = {
        running: { label: "回答中", color: "accent" },
        completed: { label: "已完成", color: "success" },
        failed: { label: "失败", color: "danger" },
        cancelled: { label: "已停止", color: "default" },
        interrupted: { label: "已中断", color: "warning" },
    };
    return (<section className="flex h-full min-h-0 flex-col bg-background" aria-label="旁路提问面板">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            旁路提问 <span className="text-muted">/btw</span>
          </p>
          <p className="truncate text-muted text-xs">{label}</p>
        </div>
        <IconButton size="small" onClick={() => setConfirm(true)} disabled={!side.items.length || side.busy} aria-label="清空旁路历史">
          <Trash2Icon className="size-4"/>
        </IconButton>
        <IconButton size="small" onClick={() => side.setOpen(false)} aria-label="关闭旁路面板">
          <XIcon className="size-4"/>
        </IconButton>
      </div>

      <div className="border-b border-border px-3 py-2 text-muted text-xs">
        {side.snapshot ? (<>
            <p className="font-medium text-foreground">{side.snapshot.model.model}</p>
            <p>上下文更新于 {new Date(side.snapshot.captured_at).toLocaleString()}</p>
          </>) : ("主 Agent 首次运行后即可提问")}
      </div>

      <div ref={viewport} data-scrollbar="thin" onScroll={(event) => {
            const el = event.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }} className="min-h-0 flex-1 p-3" data-slot="scroll-shadow">
        {side.nextCursor > 0 && (<Button size="small" className="w-full mb-3" onClick={() => void side.load(side.nextCursor)} variant="text">
            加载更早的旁路问答
          </Button>)}
        {side.loading && <Skeleton className="h-16 w-full rounded-md"/>}
        {!side.loading && side.items.length === 0 && (<div className="flex flex-col items-center justify-center p-8 text-center text-muted">
            <MessageCircleQuestionIcon className="size-8 mb-2 opacity-50"/>
            <p className="font-medium text-foreground">随时问一个问题</p>
            <p className="text-xs mt-1">根据当前 Agent 的上下文回答，主任务继续运行。</p>
          </div>)}
        <div className="flex flex-col gap-5">
          {side.items.map((item) => {
            const currentStatus = statusMap[item.status] ?? { label: item.status, color: "default" };
            return (<article key={item.id} className="flex min-w-0 flex-col gap-2">
                <div className="whitespace-pre-wrap break-words rounded-lg bg-surface-secondary p-3 text-sm">
                  {item.question}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-muted text-xs">
                  <Chip size="small" color={currentStatus.color === "accent" ? "primary" : currentStatus.color === "danger" ? "error" : currentStatus.color === "warning" ? "warning" : currentStatus.color === "success" ? "success" : "default"} label={currentStatus.label} />
                  <span className="truncate">{item.model.model}</span>
                  <time dateTime={item.snapshot_at} title={new Date(item.snapshot_at).toLocaleString()}>
                    上下文 {new Date(item.snapshot_at).toLocaleTimeString()}
                  </time>
                </div>
                {item.context?.estimated_input_tokens != null && (<p className="text-muted text-xs">
                    最近 {item.context.recent_exchanges} 组问答原文
                    {item.context.history_summarized && " · 含早期问答摘要"}
                    {item.context.snapshot_summarized && " · 使用主上下文摘要"}
                  </p>)}
                {item.answer && <Markdown text={item.answer}/>}
                {!item.answer && item.status === "running" && (<p role="status" className="text-muted text-sm flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-accent animate-pulse"/>
                    {preparationLabels[item.context?.phase ?? "answering"]}
                  </p>)}
                {item.error && (<Alert severity="error" className="mt-2">{item.error}</Alert>)}
              </article>);
        })}
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        {(side.error || side.snapshot?.reason) && (<Alert severity="error" className="mb-2">{side.error || side.snapshot?.reason}</Alert>)}
        <div className={cn("relative flex rounded-lg border border-border bg-surface shadow-xs focus-within:ring-2 focus-within:ring-accent", inlineComposer ? "flex-row items-center" : "flex-col")}>
          <TextField disabled={side.busy} multiline minRows={inlineComposer ? 1 : 3} maxRows={inlineComposer ? 6 : 8} fullWidth variant="standard" slotProps={{ input: { disableUnderline: true }, htmlInput: { maxLength: 4000 } }} className={cn("w-full", inlineComposer ? "max-h-40" : "max-h-36")} aria-label="旁路问题" placeholder="询问当前上下文…" value={side.draft} onChange={(event) => side.setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void side.ask(side.draft);
            }
        }} />
          <div className={cn("flex items-center px-2 py-1.5", inlineComposer ? "shrink-0" : "justify-between border-t border-separator")}>
            {!inlineComposer && <span className="text-muted text-xs">独立问答 · 无工具执行</span>}
            {side.running ? (<IconButton size="small" className="ml-auto" onClick={() => void side.stop()} aria-label="停止旁路回答" color="error">
                <SquareIcon className="size-3.5 fill-current"/>
              </IconButton>) : (<IconButton size="small" className="ml-auto" onClick={() => void side.ask(side.draft)} disabled={side.busy || !side.draft.trim() || !side.snapshot?.available} aria-label="发送旁路问题" color="primary">
                <ArrowUpIcon className="size-3.5"/>
              </IconButton>)}
          </div>
        </div>
      </div>
      {inlineComposer && (<div className="shrink-0 truncate px-3 pt-0.5 pb-1 text-muted text-xs">独立问答 · 无工具执行</div>)}

      
        <Dialog open={confirm} onClose={() => setConfirm(false)}>
              <DialogTitle>清空旁路历史？</DialogTitle>
              <DialogContent>
                <p className="text-sm text-muted">
                  删除当前 Agent 的旁路问答，并停止正在生成的旁路回答。主会话和上下文快照会保留。
                </p>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirm(false)} variant="outlined">
                  取消
                </Button>
                <Button onClick={() => {
            void side.clear();
            setConfirm(false);
        }} variant="contained" color="error">
                  清空历史
                </Button>
              </DialogActions>
        </Dialog>
      
    </section>);
}
export function SideQuestionWorkspace({ side, label, children, composerLayout = "stacked", }: {
    side: SideQuestions;
    label: string;
    children: ReactNode;
    composerLayout?: ComposerLayout;
}) {
    const mobile = useIsMobile();
    return (<>
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        <ResizablePanel id="main-conversation" minSize="35%" className="flex min-h-0 min-w-0 flex-col">
          {children}
        </ResizablePanel>
        {side.open && side.enabled && !mobile && (<>
            <ResizableHandle withHandle/>
            <ResizablePanel id="side-question" defaultSize="38%" minSize="280px" maxSize="65%">
              <SidePanel side={side} label={label} composerLayout={composerLayout}/>
            </ResizablePanel>
          </>)}
      </ResizablePanelGroup>
      
        <Drawer anchor="bottom" open={mobile && side.open && side.enabled} onClose={() => side.setOpen(false)} slotProps={{ paper: { sx: { height: "85svh" } } }}>
          <SidePanel side={side} label={label} composerLayout={composerLayout}/>
        </Drawer>
      
    </>);
}
