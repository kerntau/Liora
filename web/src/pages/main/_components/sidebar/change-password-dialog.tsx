import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { toast } from "sonner";
import { api } from "@/lib/api";
export function ChangePasswordDialog({ open, onOpenChange }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const [oldPassword, setOldPassword] = React.useState(""); const [newPassword, setNewPassword] = React.useState(""); const [confirmPassword, setConfirmPassword] = React.useState(""); const [saving, setSaving] = React.useState(false);
  React.useEffect(() => { if (!open) { setOldPassword(""); setNewPassword(""); setConfirmPassword(""); } }, [open]);
  function submit(event: React.FormEvent) { event.preventDefault(); if (!oldPassword || !newPassword) { toast.error("请填写当前密码和新密码"); return; } if (newPassword !== confirmPassword) { toast.error("两次输入的新密码不一致"); return; } setSaving(true); api.changePassword(oldPassword, newPassword).then(() => { toast.success("密码已修改"); onOpenChange(false); }).catch((err) => toast.error(`修改失败：${(err as Error).message}`)).finally(() => setSaving(false)); }
  return <Dialog open={open} onClose={() => onOpenChange(false)} fullWidth maxWidth="sm"><form onSubmit={submit}><DialogTitle>修改密码<Typography component="span" variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>用户名固定为 <strong>Liora</strong>。需先输入当前密码验证；修改后已签发的登录 Token 仍有效直至过期。</Typography></DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="当前密码" placeholder="输入当前密码" type="password" autoComplete="current-password" autoFocus value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} disabled={saving} fullWidth size="small" /><TextField label="新密码" placeholder="输入新密码" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={saving} fullWidth size="small" /><TextField label="确认新密码" placeholder="再次输入新密码" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={saving} fullWidth size="small" /></Stack></DialogContent><DialogActions sx={{ px: 3, pb: 2 }}><Button type="button" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button><Button type="submit" variant="contained" disabled={saving || !oldPassword || !newPassword || !confirmPassword}>{saving ? "修改中…" : "确认修改"}</Button></DialogActions></form></Dialog>;
}
