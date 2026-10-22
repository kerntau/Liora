"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { ArrowUpIcon, Loader2Icon, MessageCircleQuestionIcon, SquareIcon, Trash2Icon, XIcon } from "lucide-react";

import { Markdown } from "@/components/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SideQuestions } from "@/hooks/use-side-questions";
import { shouldSubmitOnKey, useChatSendMode } from "@/lib/chat-send-mode";
import { cn } from "@/lib/utils";

type ComposerLayout = "inline" | "stacked";

const preparationLabels = {
  preparing: "正在准备上下文…",
  summarizing_history: "正在整理早期旁路问答…",
  compressing_snapshot: "正在压缩旁路上下文副本…",
  retrying: "模型上下文超限，正在缩减后重试…",
  answering: "正在回答…",
};

export function SideQuestionButton({ side }: { side: SideQuestions }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(side.open);
  // 面板关闭后焦点原本掉回 body：键盘用户得从页面顶部重新 Tab 回来。关闭时把焦点
  // 交还给打开它的这个按钮（移动端抽屉由 Radix 自己还焦点，这里落到同一元素上）。
  useEffect(() => {
    if (wasOpen.current && !side.open) buttonRef.current?.focus();
    wasOpen.current = side.open;
  }, [side.open]);
  if (!side.enabled) return null;
  return (
    <Button ref={buttonRef} variant="outline" size="sm" onClick={() => side.setOpen(true)} title="/btw 旁路提问">
      <MessageCircleQuestionIcon data-icon="inline-start" />
      旁路提问
    </Button>
  );
}

function SidePanel({
  side,
  label,
  composerLayout,
  autoFocusComposer = false,
}: {
  side: SideQuestions;
  label: string;
  composerLayout: ComposerLayout;
  /** 桌面内联面板打开即聚焦输入框；移动端抽屉交给 Radix 的焦点陷阱，避免抢焦点。 */
  autoFocusComposer?: boolean;
}) {
  const inlineComposer = composerLayout === "inline";
  const [confirm, setConfirm] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendMode = useChatSendMode();
  const pinned = useRef(true);
  // 面板是条件挂载的，挂载即「刚打开」。不把焦点送进输入框的话，键盘用户要先 Tab
  // 过整个主会话才能开始提问。但用 /btw 在输入框里直接提问时面板会跟着打开，那时
  // 焦点必须留在原输入框（用户还在打字），所以只在焦点不在文本控件里时才接管。
  useEffect(() => {
    if (!autoFocusComposer) return;
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable)
    ) {
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
  }, [autoFocusComposer]);
  const tail = side.items.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: New cumulative text scrolls only readers who remain at the bottom.
  useEffect(() => {
    if (pinned.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [tail?.answer, tail?.id]);
  const status = { running: "回答中", completed: "已完成", failed: "失败", cancelled: "已停止", interrupted: "已中断" };
  return (
    <section className="flex h-full min-h-0 flex-col bg-background" aria-label="旁路提问面板">
      <div className="flex items-center gap-2 border-b p-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            旁路提问 <span className="text-muted-foreground">/btw</span>
          </p>
          <p className="truncate text-muted-foreground text-xs">{label}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirm(true)}
          disabled={!side.items.length || side.busy}
          aria-label="清空旁路历史"
        >
          <Trash2Icon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => side.setOpen(false)} aria-label="关闭旁路面板">
          <XIcon />
        </Button>
      </div>
      <div className="border-b px-3 py-2 text-muted-foreground text-xs">
        {side.snapshot ? (
          <>
            <p>{side.snapshot.model.model}</p>
            <p>上下文更新于 {new Date(side.snapshot.captured_at).toLocaleString()}</p>
          </>
        ) : (
          "主 Agent 首次运行后即可提问"
        )}
      </div>
      <div
        ref={viewport}
        onScroll={(event) => {
          const el = event.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto p-3"
      >
        {side.nextCursor > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void side.load(side.nextCursor)}>
            加载更早的旁路问答
          </Button>
        )}
        {side.loading && <Skeleton className="h-16 w-full" />}
        {!side.loading && side.items.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>随时问一个问题</EmptyTitle>
              <EmptyDescription>根据当前 Agent 的上下文回答，主任务继续运行。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <div className="flex flex-col gap-5">
          {side.items.map((item) => (
            <article key={item.id} className="flex min-w-0 flex-col gap-2">
              <div className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-sm">{item.question}</div>
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                <Badge variant="secondary">{status[item.status]}</Badge>
                <span className="truncate">{item.model.model}</span>
                <time dateTime={item.snapshot_at} title={new Date(item.snapshot_at).toLocaleString()}>
                  上下文 {new Date(item.snapshot_at).toLocaleTimeString()}
                </time>
              </div>
              {item.context?.estimated_input_tokens != null && (
                <p className="text-muted-foreground text-xs">
                  最近 {item.context.recent_exchanges} 组问答原文
                  {item.context.history_summarized && " · 含早期问答摘要"}
                  {item.context.snapshot_summarized && " · 使用主上下文摘要"}
                </p>
              )}
              {item.answer && <Markdown text={item.answer} />}
              {!item.answer && item.status === "running" && (
                <p role="status" className="text-muted-foreground text-sm">
                  {preparationLabels[item.context?.phase ?? "answering"]}
                </p>
              )}
              {item.error && (
                <Alert variant="destructive">
                  <AlertDescription>{item.error}</AlertDescription>
                </Alert>
              )}
            </article>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t p-3">
        {(side.error || side.snapshot?.reason) && (
          <Alert variant="destructive" className="mb-2">
            <AlertDescription>{side.error || side.snapshot?.reason}</AlertDescription>
          </Alert>
        )}
        <InputGroup className={inlineComposer ? "min-h-10" : "min-h-9"}>
          <InputGroupTextarea
            ref={inputRef}
            rows={1}
            className={cn("overflow-y-auto", inlineComposer ? "max-h-40 min-h-0" : "max-h-36 min-h-9")}
            aria-label="旁路问题"
            placeholder="询问当前上下文…"
            value={side.draft}
            maxLength={4000}
            disabled={side.busy}
            onChange={(event) => side.setDraft(event.target.value)}
            onKeyDown={(event) => {
              // 与两个会话输入框共用同一套键位设置：选了「Ctrl+Enter 发送」的用户
              // 不该在旁路面板里被 Enter 直接发出去，输入法组字也不能误发。
              if (!shouldSubmitOnKey(event, sendMode)) return;
              event.preventDefault();
              void side.ask(side.draft);
            }}
          />
          <InputGroupAddon align={inlineComposer ? "inline-end" : "block-end"}>
            {!inlineComposer && <span className="text-muted-foreground text-xs">独立问答 · 无工具执行</span>}
            {side.running ? (
              <InputGroupButton
                className="ml-auto"
                variant="destructive"
                size="icon-xs"
                onClick={() => void side.stop()}
                aria-label="停止旁路回答"
              >
                <SquareIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                className="ml-auto"
                variant="default"
                size="icon-xs"
                onClick={() => void side.ask(side.draft)}
                disabled={side.busy || !side.draft.trim() || !side.snapshot?.available}
                aria-busy={side.busy || undefined}
                aria-label="发送旁路问题"
              >
                {side.busy ? <Loader2Icon className="animate-spin" /> : <ArrowUpIcon />}
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
      {inlineComposer && (
        <div className="shrink-0 truncate px-3 pt-0.5 pb-1 text-muted-foreground text-xs">独立问答 · 无工具执行</div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空旁路历史？</AlertDialogTitle>
            <AlertDialogDescription>
              删除当前 Agent 的旁路问答，并停止正在生成的旁路回答。主会话和上下文快照会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void side.clear()}>清空历史</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function SideQuestionWorkspace({
  side,
  label,
  children,
  composerLayout = "stacked",
}: {
  side: SideQuestions;
  label: string;
  children: ReactNode;
  composerLayout?: ComposerLayout;
}) {
  const mobile = useIsMobile();
  return (
    <>
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        <ResizablePanel id="main-conversation" minSize="35%" className="flex min-h-0 min-w-0 flex-col">
          {children}
        </ResizablePanel>
        {side.open && side.enabled && !mobile && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel id="side-question" defaultSize="38%" minSize="280px" maxSize="65%">
              <SidePanel side={side} label={label} composerLayout={composerLayout} autoFocusComposer />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      <Drawer open={mobile && side.open && side.enabled} onOpenChange={side.setOpen}>
        <DrawerContent className="h-[85svh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>旁路提问</DrawerTitle>
            <DrawerDescription>{label} 的独立问答</DrawerDescription>
          </DrawerHeader>
          <SidePanel side={side} label={label} composerLayout={composerLayout} />
        </DrawerContent>
      </Drawer>
    </>
  );
}
