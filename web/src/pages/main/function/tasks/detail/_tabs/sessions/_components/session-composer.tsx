import * as React from "react";

import { ArrowUpIcon, Loader2Icon, PaperclipIcon, SquareIcon, XIcon } from "lucide-react";

import { MentionTextarea } from "@/components/mention-textarea";
import { TodoPopover } from "@/components/todo-popover";
import { InputGroup, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { shouldSubmitOnKey, useChatSendMode } from "@/lib/chat-send-mode";
import { fmtBytes } from "@/lib/format";
import { isBtwCommand } from "@/lib/side-questions";
import type { ChatAttachment, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

import { MAX_WORKER_MESSAGE_CHARS, workerMessageCharCount } from "../session-model";

// Footer of the transcript panel: the main-agent composer (attachments + mention +
// send/stop), the worker composer (message + pause/resume), or the read-only Todo
// popover for sessions that take no input. Send/stop handlers stay in the tab.
export function SessionComposer({
  isMain,
  active,
  input,
  onInputChange,
  attachments,
  onRemoveAttachment,
  uploading,
  fileInputRef,
  onFilesSelected,
  sending,
  stopping,
  mainBusy,
  onSend,
  onStop,
  workerMessage,
  onWorkerMessageChange,
  workerMessageSending,
  onSendWorker,
  controllingIntent,
  onPauseWorker,
  onResumeWorker,
  latestTodoSeq,
  fetchTodoDetail,
}: {
  isMain: boolean;
  active: Session;
  input: string;
  onInputChange: (value: string) => void;
  attachments: ChatAttachment[];
  onRemoveAttachment: (path: string) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null) => void;
  sending: boolean;
  stopping: boolean;
  mainBusy: boolean;
  onSend: () => void;
  onStop: () => void;
  workerMessage: string;
  onWorkerMessageChange: (value: string) => void;
  workerMessageSending: boolean;
  onSendWorker: () => void;
  controllingIntent: string | null;
  onPauseWorker: () => void;
  onResumeWorker: () => void;
  latestTodoSeq: number | null;
  fetchTodoDetail: (seq: number) => Promise<string>;
}) {
  // 发送键位由系统设置决定（localStorage），默认 Enter 发送。
  const sendMode = useChatSendMode();
  const sendHint = sendMode === "enter" ? "Enter 发送 · Shift+Enter 换行" : "Ctrl/⌘ + Enter 发送 · Enter 换行";

  return isMain ? (
    <div className="border-t border-border/70 bg-surface-muted/60 p-2.5 sm:p-3">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <div
              key={a.path}
              className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2 py-1 text-xs"
              title={a.path}
            >
              <PaperclipIcon className="size-3 shrink-0 text-primary" />
              <span className="max-w-[160px] truncate">{a.name}</span>
              <span className="text-muted-foreground">{fmtBytes(a.size)}</span>
              <button
                type="button"
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => onRemoveAttachment(a.path)}
                title="移除"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFilesSelected(e.target.files)}
      />
      <InputGroup className="min-h-9 border-border/70 bg-card has-disabled:opacity-100">
        <MentionTextarea
          inputGroup
          rows={1}
          aria-label="给主 Agent 发消息"
          placeholder={mainBusy ? "主 Agent 正在运行，可输入 /btw 提问…" : "给主 Agent 发消息，@ 引用漏洞、资产等…"}
          value={input}
          disabled={sending}
          onValueChange={onInputChange}
          onKeyDown={(e) => {
            if (!shouldSubmitOnKey(e, sendMode)) return;
            e.preventDefault();
            onSend();
          }}
          className="max-h-36 min-h-9 overflow-y-auto text-[13px] md:text-[13px]"
        />
        <InputGroupAddon align="block-end">
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={mainBusy || uploading}
            title="上传文件"
            aria-label="上传文件"
          >
            {uploading ? <Loader2Icon className="animate-spin" /> : <PaperclipIcon />}
          </InputGroupButton>
          {mainBusy && isBtwCommand(input) && (
            <InputGroupButton size="icon-xs" onClick={onSend} aria-label="发送旁路问题">
              <ArrowUpIcon />
            </InputGroupButton>
          )}
          {mainBusy ? (
            <InputGroupButton
              className="ml-auto"
              size="icon-xs"
              variant="destructive"
              onClick={onStop}
              disabled={stopping}
              title="停止当前执行"
              aria-label="停止当前执行"
            >
              {stopping ? <Loader2Icon className="animate-spin" /> : <SquareIcon />}
            </InputGroupButton>
          ) : (
            <InputGroupButton
              className="ml-auto"
              size="icon-xs"
              variant="default"
              onClick={onSend}
              disabled={(!input.trim() && attachments.length === 0) || sending}
              title="发送消息"
              aria-label="发送消息"
            >
              {sending ? <Loader2Icon className="animate-spin" /> : <ArrowUpIcon />}
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[12px] text-muted-foreground">
        <span>{sendHint}</span>
        <span className="hidden sm:inline">支持 @ 引用漏洞、资产与记录</span>
      </div>
    </div>
  ) : active.role === "worker" && !active.inherited && (active.status === "running" || active.status === "paused") ? (
    <div className="border-t border-border/70 bg-surface-muted/60 p-2.5 sm:p-3">
      <InputGroup className="min-h-9 border-border/70 bg-card has-disabled:opacity-100">
        <MentionTextarea
          inputGroup
          rows={1}
          aria-label={`给 Worker #${active.intent_id} 发消息`}
          placeholder={`给 Worker #${active.intent_id} 发消息，@ 引用记录，调整执行方向…`}
          value={workerMessage}
          onValueChange={onWorkerMessageChange}
          onKeyDown={(event) => {
            if (!shouldSubmitOnKey(event, sendMode)) return;
            event.preventDefault();
            onSendWorker();
          }}
          disabled={workerMessageSending}
          aria-invalid={workerMessageCharCount(workerMessage) > MAX_WORKER_MESSAGE_CHARS}
          className="max-h-36 min-h-9 overflow-y-auto text-[13px] md:text-[13px]"
        />
        <InputGroupAddon align="block-end">
          <span
            className={cn(
              "px-1 text-[11px] tabular-nums text-muted-foreground",
              workerMessageCharCount(workerMessage) > MAX_WORKER_MESSAGE_CHARS && "text-destructive",
            )}
          >
            {workerMessageCharCount(workerMessage)}/{MAX_WORKER_MESSAGE_CHARS}
          </span>
          {active.status === "running" && isBtwCommand(workerMessage) && (
            <InputGroupButton size="icon-xs" onClick={onSendWorker} aria-label="发送旁路问题">
              <ArrowUpIcon />
            </InputGroupButton>
          )}
          {active.status === "running" ? (
            <InputGroupButton
              className="ml-auto"
              size="icon-xs"
              variant="destructive"
              onClick={onPauseWorker}
              disabled={controllingIntent === active.intent_id}
              title="暂停当前 Worker"
              aria-label="暂停当前 Worker"
            >
              {controllingIntent === active.intent_id ? <Loader2Icon className="animate-spin" /> : <SquareIcon />}
            </InputGroupButton>
          ) : (
            <>
              <InputGroupButton
                className="ml-auto"
                size="xs"
                variant="ghost"
                onClick={onResumeWorker}
                disabled={controllingIntent === active.intent_id || workerMessageSending}
                title="不发消息，直接继续执行"
                aria-label="直接继续执行"
              >
                {controllingIntent === active.intent_id ? <Loader2Icon className="animate-spin" /> : "直接继续"}
              </InputGroupButton>
              <InputGroupButton
                size="icon-xs"
                variant="default"
                onClick={onSendWorker}
                disabled={
                  workerMessageSending ||
                  !workerMessage.trim() ||
                  workerMessageCharCount(workerMessage) > MAX_WORKER_MESSAGE_CHARS
                }
                title="发送消息"
                aria-label="发送消息"
              >
                {workerMessageSending ? <Spinner /> : <ArrowUpIcon />}
              </InputGroupButton>
            </>
          )}
        </InputGroupAddon>
      </InputGroup>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[12px] text-muted-foreground">
        <span>{sendHint}</span>
        <span>发送后会立即继续执行该 Worker</span>
      </div>
    </div>
  ) : (
    <div className="flex items-center border-t border-border/70 bg-surface-muted/50 px-5 py-2">
      <TodoPopover seq={latestTodoSeq} fetchDetail={fetchTodoDetail} />
    </div>
  );
}
