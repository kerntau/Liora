import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { EllipsisVertical, KeyRound, LogOut } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getInitials } from "@/lib/utils";
import { ChangePasswordDialog } from "./change-password-dialog";

export function NavUser({ user }: {
  readonly user: { readonly name: string; readonly email: string; readonly avatar: string };
}) {
  const { isMobile } = useSidebar();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [pwOpen, setPwOpen] = React.useState(false);
  const menuOpen = Boolean(anchorEl);

  function handleLogout() {
    auth.clearToken();
  }

  function closeMenu() {
    setAnchorEl(null);
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          aria-haspopup="true"
          aria-expanded={menuOpen ? "true" : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{ width: "100%", justifyContent: "flex-start", gap: 1, textAlign: "left" }}
        >
          <Avatar src={user.avatar || undefined} alt={user.name} sx={{ width: 32, height: 32, borderRadius: 1, filter: "grayscale(1)" }}>
            {getInitials(user.name)}
          </Avatar>
          <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
          <EllipsisVertical size={16} className="ml-auto text-muted-foreground" />
        </SidebarMenuButton>
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={closeMenu}
          anchorOrigin={{ vertical: isMobile ? "bottom" : "top", horizontal: isMobile ? "left" : "right" }}
          transformOrigin={{ vertical: isMobile ? "top" : "bottom", horizontal: isMobile ? "left" : "right" }}
          slotProps={{ paper: { sx: { minWidth: 224, borderRadius: 1.5, mt: 0.5 } } }}
        >
          <StackUser user={user} />
          <Divider />
          <MenuItem onClick={() => { closeMenu(); setPwOpen(true); }}>
            <ListItemIcon><KeyRound size={17} /></ListItemIcon>
            <ListItemText>修改密码</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { closeMenu(); handleLogout(); }} sx={{ color: "error.main" }}>
            <ListItemIcon sx={{ color: "inherit" }}><LogOut size={17} /></ListItemIcon>
            <ListItemText>退出登录</ListItemText>
          </MenuItem>
        </Menu>
      </SidebarMenuItem>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </SidebarMenu>
  );
}

function StackUser({ user }: { readonly user: { readonly name: string; readonly email: string; readonly avatar: string } }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Avatar src={user.avatar || undefined} alt={user.name} sx={{ width: 32, height: 32, borderRadius: 1 }}>
        {getInitials(user.name)}
      </Avatar>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </div>
    </div>
  );
}
