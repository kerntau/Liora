import { Loader2Icon, Trash2Icon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

// 删除意图确认框：假删除（默认，保留数据）或真删除（级联移除独占下游）。
export function CancelIntentDialog({
  session,
  reason,
  deleteMode,
  controlling,
  onReasonChange,
  onDeleteModeChange,
  onClose,
  onConfirm,
}: {
  session: Session | null;
  reason: string;
  deleteMode: "soft" | "hard";
  controlling: boolean;
  onReasonChange: (value: string) => void;
  onDeleteModeChange: (mode: "soft" | "hard") => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={session !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="max-w-[min(32rem,calc(100vw-2rem))]">
        <AlertDialogHeader>
          <AlertDialogTitle>删除 Worker #{session?.intent_id}？</AlertDialogTitle>
          <AlertDialogDescription className="break-words whitespace-normal">
            {deleteMode === "hard" ? (
              <>
                <strong>真删除</strong>会物理移除该意图，以及<strong>仅由它支撑</strong>
                的下游节点（级联到叶子，避免留下孤立数据）；共享节点、目标和任务根事实会保留。
                <strong>此操作不可恢复。</strong>规划者会收到删除通知并据此重新规划。
              </>
            ) : (
              <>
                <strong>假删除</strong>会把该意图置为「已删除」并记录删除原因，意图节点、执行记录、
                已登记的事实和漏洞<strong>都会保留</strong>。规划者会收到「该意图由用户删除 + 原因」并据此重新规划。
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={deleteMode === "soft"}
              onClick={() => onDeleteModeChange("soft")}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                deleteMode === "soft" ? "border-primary bg-primary/5" : "hover:bg-accent",
              )}
            >
              <div className="font-medium">假删除</div>
              <div className="text-xs text-muted-foreground">保留数据，可追溯</div>
            </button>
            <button
              type="button"
              aria-pressed={deleteMode === "hard"}
              onClick={() => onDeleteModeChange("hard")}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                deleteMode === "hard" ? "border-destructive bg-destructive/5" : "hover:bg-accent",
              )}
            >
              <div className="font-medium">真删除</div>
              <div className="text-xs text-muted-foreground">级联移除，不可恢复</div>
            </button>
          </div>
          <div className="grid gap-2">
            <label htmlFor="cancel-reason" className="text-sm font-medium">
              删除原因（必填）
            </label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="说明为什么删除这条意图，例如：方向判断错误 / 目标已失效 / 与其他意图重复…"
              rows={3}
              autoFocus
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>返回</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!session || controlling || !reason.trim()}
            onClick={onConfirm}
          >
            {controlling ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
            {deleteMode === "hard" ? "彻底删除" : "确认删除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 新建主 Agent 会话确认框：归档当前会话、以干净上下文继续同一任务。
export function NewMainSessionDialog({
  open,
  creating,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  creating: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[min(32rem,calc(100vw-2rem))]">
        <AlertDialogHeader>
          <AlertDialogTitle>开启新会话？</AlertDialogTitle>
          <AlertDialogDescription className="break-words whitespace-normal">
            当前会话会被归档（可随时切回），主 Agent 将以干净的上下文继续。任务的图谱、资产、目标不受影响。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={creating}>取消</AlertDialogCancel>
          <AlertDialogAction disabled={creating} onClick={onConfirm}>
            {creating ? "开启中…" : "开启新会话"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
