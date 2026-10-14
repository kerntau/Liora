import * as React from "react";
import { Avatar, Dropdown } from "@heroui/react";
import { EllipsisVertical, KeyRound, LogOut } from "lucide-react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getInitials } from "@/lib/utils";
import { ChangePasswordDialog } from "./change-password-dialog";
export function NavUser({ user, }: {
    readonly user: {
        readonly name: string;
        readonly email: string;
        readonly avatar: string;
    };
}) {
    const { isMobile } = useSidebar();
    const [pwOpen, setPwOpen] = React.useState(false);
    function handleLogout() {
        auth.clearToken();
    }
    return (<SidebarMenu>
      <SidebarMenuItem>
        <Dropdown>
          <SidebarMenuButton size="lg" className="data-[state=open]:bg-default data-[state=open]:text-default-foreground" asChild><Dropdown.Trigger>
              <Avatar className="h-8 w-8 rounded-lg grayscale shrink-0">
                <Avatar.Image src={user.avatar || undefined} alt={user.name}/>
                <Avatar.Fallback className="rounded-lg">{getInitials(user.name)}</Avatar.Fallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-foreground">{user.name}</span>
                <span className="truncate text-muted text-xs">{user.email}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4 text-muted"/>
            </Dropdown.Trigger></SidebarMenuButton>
          <Dropdown.Popover placement={isMobile ? "bottom" : "right"} className="min-w-56 p-1 bg-surface border border-border rounded-lg shadow-lg">
            <div className="flex items-center gap-2 px-2 py-2 text-left text-sm border-b border-border mb-1">
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <Avatar.Image src={user.avatar || undefined} alt={user.name}/>
                <Avatar.Fallback className="rounded-lg">{getInitials(user.name)}</Avatar.Fallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-foreground">{user.name}</span>
                <span className="truncate text-muted text-xs">{user.email}</span>
              </div>
            </div>
            <Dropdown.Menu aria-label="用户账户菜单" onAction={(key) => {
            if (key === "change-password") {
                setPwOpen(true);
            }
            else if (key === "logout") {
                handleLogout();
            }
        }}>
              <Dropdown.Item id="change-password" textValue="修改密码" className="flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm outline-none hover:bg-surface-secondary">
                <KeyRound className="size-4 text-muted"/>
                <span>修改密码</span>
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="退出登录" variant="danger" className="flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm outline-none text-danger hover:bg-danger/10">
                <LogOut className="size-4"/>
                <span>退出登录</span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </SidebarMenuItem>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen}/>
    </SidebarMenu>);
}
