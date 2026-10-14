import * as React from "react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { toast } from "sonner";
import { api } from "@/lib/api";
export function ChangePasswordDialog({ open, onOpenChange, }: {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}) {
    const [oldPassword, setOldPassword] = React.useState("");
    const [newPassword, setNewPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    React.useEffect(() => {
        if (!open) {
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        }
    }, [open]);
    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!oldPassword || !newPassword) {
            toast.error("请填写当前密码和新密码");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("两次输入的新密码不一致");
            return;
        }
        setSaving(true);
        api
            .changePassword(oldPassword, newPassword)
            .then(() => {
            toast.success("密码已修改");
            onOpenChange(false);
        })
            .catch((err) => toast.error(`修改失败：${(err as Error).message}`))
            .finally(() => setSaving(false));
    }
    return (
      <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="w-full max-w-md p-6 bg-surface border border-border rounded-xl shadow-xl outline-none">
            <form onSubmit={submit}>
              <Modal.Header className="pb-3">
                <Modal.Heading className="text-lg font-semibold text-foreground">修改密码</Modal.Heading>
                <p className="text-xs text-muted mt-1">
                  用户名固定为 <strong className="text-foreground">Liora</strong>
                  。需先输入当前密码验证；修改后已签发的登录 Token 仍有效直至过期。
                </p>
              </Modal.Header>
              <Modal.Body className="py-4 flex flex-col gap-3">
                <TextField type="password" value={oldPassword} onChange={setOldPassword} isDisabled={saving} className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">当前密码</Label>
                  <Input placeholder="输入当前密码" autoComplete="current-password" autoFocus/>
                </TextField>

                <TextField type="password" value={newPassword} onChange={setNewPassword} isDisabled={saving} className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">新密码</Label>
                  <Input placeholder="输入新密码" autoComplete="new-password"/>
                </TextField>

                <TextField type="password" value={confirmPassword} onChange={setConfirmPassword} isDisabled={saving} className="space-y-1">
                  <Label className="text-xs font-medium text-foreground">确认新密码</Label>
                  <Input placeholder="再次输入新密码" autoComplete="new-password"/>
                </TextField>
              </Modal.Body>
              <Modal.Footer className="pt-3 flex justify-end gap-2 border-t border-border">
                <Button type="button" size="sm" onPress={() => onOpenChange(false)} isDisabled={saving} variant={"outline"}>
                  取消
                </Button>
                <Button type="submit" size="sm" isDisabled={saving || !oldPassword || !newPassword || !confirmPassword} variant={"primary"}>
                  {saving ? "修改中…" : "确认修改"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
}
