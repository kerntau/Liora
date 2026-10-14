import { useState } from "react";
import { Avatar, Button, Dropdown } from "@heroui/react";
import { Check, KeyRound, LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { cn, getInitials } from "@/lib/utils";
import { ChangePasswordDialog } from "./change-password-dialog";
export function AccountSwitcher({ users, }: {
    readonly users: ReadonlyArray<{
        readonly id: string;
        readonly name: string;
        readonly email: string;
        readonly avatar: string;
        readonly role: string;
    }>;
}) {
    const [activeUser, setActiveUser] = useState(users[0]);
    const [pwOpen, setPwOpen] = useState(false);
    function handleLogout() {
        auth.clearToken();
    }
    if (!activeUser) {
        return null;
    }
    return (<>
      <Dropdown>
        
          <Button type="button" className="cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent" variant="ghost" size="sm">
            <Avatar className="size-8 rounded-lg">
              <Avatar.Image src={activeUser.avatar || undefined} alt={activeUser.name}/>
              <Avatar.Fallback>{getInitials(activeUser.name)}</Avatar.Fallback>
            </Avatar>
          </Button>
        
        <Dropdown.Popover className="min-w-56 p-1 bg-surface border border-border rounded-lg shadow-lg">
          <Dropdown.Menu aria-label="账号切换与操作" onAction={(key) => {
            if (key === "change-password") {
                setPwOpen(true);
            }
            else if (key === "logout") {
                handleLogout();
            }
            else {
                const found = users.find((u) => u.id === key);
                if (found)
                    setActiveUser(found);
            }
        }}>
            <Dropdown.Section aria-label="用户列表">
              {users.map((user) => (<Dropdown.Item key={user.id} id={user.id} textValue={user.name} className={cn("flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm outline-none hover:bg-surface-secondary", user.id === activeUser.id && "bg-surface-secondary font-medium")}>
                  <Avatar className="size-8 rounded-lg shrink-0">
                    <Avatar.Image src={user.avatar || undefined} alt={user.name}/>
                    <Avatar.Fallback>{getInitials(user.name)}</Avatar.Fallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left text-xs leading-tight">
                    <span className="truncate font-semibold text-foreground">{user.name}</span>
                    <span className="truncate text-muted capitalize">{user.role}</span>
                  </div>
                  {user.id === activeUser.id && <Check className="size-4 text-accent shrink-0"/>}
                </Dropdown.Item>))}
            </Dropdown.Section>

            <Dropdown.Section aria-label="操作选项" className="border-t border-border mt-1 pt-1">
              <Dropdown.Item id="change-password" textValue="修改密码" className="flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm outline-none hover:bg-surface-secondary">
                <KeyRound className="size-4 text-muted"/>
                <span>修改密码</span>
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="退出登录" variant="danger" className="flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm outline-none text-danger hover:bg-danger/10">
                <LogOut className="size-4"/>
                <span>退出登录</span>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen}/>
    </>);
}
