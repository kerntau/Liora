import * as React from "react";
import { Button, Modal, Spinner, TextArea } from "@heroui/react";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { FindingRetest } from "@/lib/types";
interface FindingRetestDialogProps {
    findingId: string;
    findingName?: string;
    onClose: () => void;
    onStarted?: (retest: FindingRetest) => void;
}
export function FindingRetestDialog({ findingId, findingName, onClose, onStarted }: FindingRetestDialogProps) {
    const [notes, setNotes] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const submitLock = React.useRef(false);
    async function start() {
        if (submitLock.current)
            return;
        submitLock.current = true;
        setSubmitting(true);
        try {
            const result = await api.startFindingRetest(findingId, notes.trim());
            onStarted?.(result.retest);
            onClose();
            toast.success(result.created ? "复测已启动，可点击「复测中」查看会话" : "该漏洞正在复测，可查看已有会话");
        }
        catch (e) {
            toast.error(`发起复测失败：${(e as Error).message}`);
        }
        finally {
            submitLock.current = false;
            setSubmitting(false);
        }
    }
    return (
      <Modal.Backdrop isOpen onOpenChange={(open) => !open && !submitLock.current && onClose()}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.Header>
              <Modal.Heading>复测漏洞 #{findingId}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <div className="text-sm text-muted break-words space-y-1">
                {findingName ? <span className="block font-medium text-foreground">{findingName}</span> : null}
                <p>
                  复测 Agent
                  将读取原证据和测试约束，在独立会话中执行针对性验证。复测成功完成且确认修复后，漏洞状态自动改为「已修复」，其他结论保留原状态。
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="retest-notes" className="text-xs font-medium text-foreground">
                  补充说明（可选）
                </label>
                <TextArea id="retest-notes" value={notes} maxLength={4000} rows={4} disabled={submitting} onChange={(e) => setNotes(e.target.value)} placeholder="例如：使用原测试账号验证原接口；修复版本为 v2。" className="w-full text-xs"/>
                <p className="text-[11px] text-muted">可补充修复版本、测试条件或本次限制。</p>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button isDisabled={submitting} onPress={onClose} variant={"outline"}>
                取消
              </Button>
              <Button isDisabled={submitting} onPress={() => void start()} className="gap-1.5" variant={"primary"}>
                {submitting ? <Spinner size="sm"/> : <RotateCcwIcon className="size-4"/>}
                {submitting ? "正在创建…" : "开始复测"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
}
