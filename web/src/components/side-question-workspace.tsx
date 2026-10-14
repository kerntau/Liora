import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert, AlertDialog, Button, Chip, Drawer, ScrollShadow, Skeleton, TextArea, TextField } from "@heroui/react";
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
    return (<Button size="sm" onPress={() => side.setOpen(true)} className="gap-1.5" aria-label={"/btw 旁路提问"} variant={"ghost"}>
      <MessageCircleQuestionIcon className="size-4"/>
      <span>旁路提问</span>
      <Chip size="sm" className="font-mono text-[10px]" variant={"soft"}>
        /btw
      </Chip>
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
        <Button size="sm" isIconOnly onPress={() => setConfirm(true)} isDisabled={!side.items.length || side.busy} aria-label="清空旁路历史" variant={"ghost"}>
          <Trash2Icon className="size-4"/>
        </Button>
        <Button size="sm" isIconOnly onPress={() => side.setOpen(false)} aria-label="关闭旁路面板" variant={"ghost"}>
          <XIcon className="size-4"/>
        </Button>
      </div>

      <div className="border-b border-border px-3 py-2 text-muted text-xs">
        {side.snapshot ? (<>
            <p className="font-medium text-foreground">{side.snapshot.model.model}</p>
            <p>上下文更新于 {new Date(side.snapshot.captured_at).toLocaleString()}</p>
          </>) : ("主 Agent 首次运行后即可提问")}
      </div>

      <ScrollShadow ref={viewport} data-scrollbar="thin" onScroll={(event) => {
            const el = event.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }} className="min-h-0 flex-1 p-3" data-slot="scroll-shadow">
        {side.nextCursor > 0 && (<Button size="sm" className="w-full mb-3" onPress={() => void side.load(side.nextCursor)} variant={"ghost"}>
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
                  <Chip size="sm" color={currentStatus.color} variant={"soft"}>
                    {currentStatus.label}
                  </Chip>
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
                {item.error && (<Alert status="danger" className="mt-2">
                    <Alert.Description>{item.error}</Alert.Description>
                  </Alert>)}
              </article>);
        })}
        </div>
      </ScrollShadow>

      <div className="shrink-0 border-t border-border p-3">
        {(side.error || side.snapshot?.reason) && (<Alert status="danger" className="mb-2">
            <Alert.Description>{side.error || side.snapshot?.reason}</Alert.Description>
          </Alert>)}
        <div className={cn("relative flex rounded-lg border border-border bg-surface shadow-xs focus-within:ring-2 focus-within:ring-accent", inlineComposer ? "flex-row items-center" : "flex-col")}>
          <TextField className="contents" isDisabled={side.busy}>
            <TextArea rows={1} className={cn("w-full resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted", inlineComposer ? "max-h-40 min-h-9" : "max-h-36 min-h-16")} aria-label="旁路问题" placeholder="询问当前上下文…" value={side.draft} maxLength={4000} onChange={(event) => side.setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void side.ask(side.draft);
            }
        }}></TextArea>
          </TextField>
          <div className={cn("flex items-center px-2 py-1.5", inlineComposer ? "shrink-0" : "justify-between border-t border-separator")}>
            {!inlineComposer && <span className="text-muted text-xs">独立问答 · 无工具执行</span>}
            {side.running ? (<Button size="sm" isIconOnly className="ml-auto size-7" onPress={() => void side.stop()} aria-label="停止旁路回答" variant={"danger"}>
                <SquareIcon className="size-3.5 fill-current"/>
              </Button>) : (<Button size="sm" isIconOnly className="ml-auto size-7" onPress={() => void side.ask(side.draft)} isDisabled={side.busy || !side.draft.trim() || !side.snapshot?.available} aria-label="发送旁路问题" variant={"primary"}>
                <ArrowUpIcon className="size-3.5"/>
              </Button>)}
          </div>
        </div>
      </div>
      {inlineComposer && (<div className="shrink-0 truncate px-3 pt-0.5 pb-1 text-muted text-xs">独立问答 · 无工具执行</div>)}

      
        <AlertDialog.Backdrop isOpen={confirm} onOpenChange={setConfirm}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>清空旁路历史？</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  删除当前 Agent 的旁路问答，并停止正在生成的旁路回答。主会话和上下文快照会保留。
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant={"outline"}>
                  取消
                </Button>
                <Button onPress={() => {
            void side.clear();
            setConfirm(false);
        }} variant={"danger"}>
                  清空历史
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      
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
      
        <Drawer.Backdrop isOpen={mobile && side.open && side.enabled} onOpenChange={side.setOpen}>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog className={cn("h-full flex flex-col", "h-[85svh]")}>
              <SidePanel side={side} label={label} composerLayout={composerLayout}/>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      
    </>);
}
