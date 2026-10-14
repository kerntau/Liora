import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { Check, KeyRound, LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { getInitials } from "@/lib/utils";
import { ChangePasswordDialog } from "./change-password-dialog";
export function AccountSwitcher({ users }: { readonly users: ReadonlyArray<{ readonly id: string; readonly name: string; readonly email: string; readonly avatar: string; readonly role: string }> }) {
  const [activeUser, setActiveUser] = useState(users[0]); const [pwOpen, setPwOpen] = useState(false); const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!activeUser) return null;
  return <><IconButton size="small" aria-label="账户菜单" onClick={(event) => setAnchor(event.currentTarget)}><Avatar src={activeUser.avatar || undefined} sx={{ width: 32, height: 32, fontSize: 13 }}>{getInitials(activeUser.name)}</Avatar></IconButton><Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
    {users.map((user) => <MenuItem key={user.id} selected={user.id === activeUser.id} onClick={() => { setActiveUser(user); setAnchor(null); }}><ListItemIcon><Avatar src={user.avatar || undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>{getInitials(user.name)}</Avatar></ListItemIcon><ListItemText primary={user.name} secondary={user.role} />{user.id === activeUser.id && <Check size={16} />}</MenuItem>)}
    <Divider /><MenuItem onClick={() => { setAnchor(null); setPwOpen(true); }}><ListItemIcon><KeyRound size={17} /></ListItemIcon><ListItemText primary="修改密码" /></MenuItem><MenuItem onClick={() => auth.clearToken()}><ListItemIcon><LogOut size={17} /></ListItemIcon><ListItemText primary="退出登录" /></MenuItem>
  </Menu><ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} /></>;
}
