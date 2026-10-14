import * as React from "react";
import { Link } from "react-router";
import { useLocation } from "react-router";
import { Disclosure, Dropdown } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar, } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NavBadge, NavGroup, NavMainItem, NavMainLinkItem, NavMainParentItem, } from "@/navigation/sidebar/sidebar-items";
interface NavMainProps {
    readonly items: readonly NavGroup[];
}
interface NavItemProps {
    readonly item: NavMainItem;
    readonly isItemActive: (item: NavMainItem) => boolean;
    readonly isSubItemActive: (url: string) => boolean;
    readonly isSubmenuOpen: (item: NavMainParentItem) => boolean;
}
interface NavLinkItemProps {
    readonly item: NavMainLinkItem;
    readonly isActive: boolean;
    readonly showIconFallback: boolean;
}
interface NavLinkIconProps {
    readonly item: NavMainLinkItem;
    readonly showFallback: boolean;
}
interface NavDropdownItemProps {
    readonly item: NavMainParentItem;
    readonly isActive: boolean;
    readonly isSubItemActive: (url: string) => boolean;
}
interface NavCollapsibleItemProps {
    readonly item: NavMainParentItem;
    readonly isActive: boolean;
    readonly defaultOpen: boolean;
    readonly isSubItemActive: (url: string) => boolean;
}
function CollapsedIconFallback({ title }: {
    title: string;
}) {
    return (<span className="flex size-4 shrink-0 items-center justify-center rounded-xs font-medium text-[10px] outline">
      {title.slice(0, 1)}
    </span>);
}
function hasSubItems(item: NavMainItem): item is NavMainParentItem {
    return Boolean(item.subItems?.length);
}
export function NavMain({ items }: NavMainProps) {
    const { pathname: rawPath } = useLocation();
    const path = (() => {
        try {
            return decodeURIComponent(rawPath);
        }
        catch {
            return rawPath;
        }
    })();
    const isItemActive = (item: NavMainItem) => {
        if (hasSubItems(item)) {
            return item.subItems.some((sub) => path.startsWith(sub.url));
        }
        return path === item.url;
    };
    const isSubItemActive = (url: string) => {
        return path === url;
    };
    const isSubmenuOpen = (item: NavMainParentItem) => {
        return item.subItems.some((sub) => path.startsWith(sub.url));
    };
    return (<>
      {items.map((group) => (<SidebarGroup key={group.id}>
          {group.label && (<SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
              {group.label}
            </SidebarGroupLabel>)}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (<NavItem key={item.id} item={item} isItemActive={isItemActive} isSubItemActive={isSubItemActive} isSubmenuOpen={isSubmenuOpen}/>))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>))}
    </>);
}
function NavItem({ item, isItemActive, isSubItemActive, isSubmenuOpen }: NavItemProps) {
    const { state, isMobile } = useSidebar();
    const isCollapsedDesktop = state === "collapsed" && !isMobile;
    if (!hasSubItems(item)) {
        return <NavLinkItem item={item} isActive={isItemActive(item)} showIconFallback={isCollapsedDesktop}/>;
    }
    if (isCollapsedDesktop) {
        return <NavDropdownItem item={item} isActive={isItemActive(item)} isSubItemActive={isSubItemActive}/>;
    }
    return (<NavCollapsibleItem item={item} isActive={isItemActive(item)} defaultOpen={isSubmenuOpen(item)} isSubItemActive={isSubItemActive}/>);
}
function InterceptPendingBadge() {
    const [count, setCount] = React.useState(0);
    React.useEffect(() => {
        let live = true;
        async function poll() {
            try {
                const list = await api.interceptPending();
                if (live)
                    setCount(list.length);
            }
            catch {
                /* ignore */
            }
        }
        poll();
        const t = setInterval(poll, 5000);
        return () => {
            live = false;
            clearInterval(t);
        };
    }, []);
    if (count === 0)
        return null;
    return (<SidebarMenuBadge className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-1 ring-warning/40">
      {count > 99 ? "99+" : count}
    </SidebarMenuBadge>);
}
function NavLinkItem({ item, isActive, showIconFallback }: NavLinkItemProps) {
    return (<SidebarMenuItem>
      <SidebarMenuButton asChild aria-disabled={item.disabled} tooltip={item.title} isActive={isActive}>
        <Link to={item.url} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noreferrer" : undefined}>
          <NavLinkIcon item={item} showFallback={showIconFallback}/>
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {item.id === "approvals" ? <InterceptPendingBadge /> : <NavItemBadge badge={item.badge}/>}
    </SidebarMenuItem>);
}
function NavLinkIcon({ item, showFallback }: NavLinkIconProps) {
    const Icon = item.icon;
    if (Icon) {
        return <Icon className="size-4"/>;
    }
    if (showFallback) {
        return <CollapsedIconFallback title={item.title}/>;
    }
    return null;
}
function NavDropdownItem({ item, isActive, isSubItemActive }: NavDropdownItemProps) {
    const Icon = item.icon;
    return (<SidebarMenuItem>
      <Dropdown>
        <SidebarMenuButton tooltip={item.title} isActive={isActive} disabled={item.disabled} asChild><Dropdown.Trigger>
            {Icon ? <Icon className="size-4"/> : <CollapsedIconFallback title={item.title}/>}
            <span>{item.title}</span>
          </Dropdown.Trigger></SidebarMenuButton>
        <Dropdown.Popover placement="right" className="w-48 p-1 bg-surface border border-border rounded-lg shadow-lg">
          <Dropdown.Menu aria-label={item.title}>
            {item.subItems.map((subItem) => {
            const SubIcon = subItem.icon;
            return (<Dropdown.Item key={subItem.id} id={subItem.id} textValue={subItem.title} className={cn("flex items-center gap-2 p-1.5 rounded-md cursor-pointer text-sm outline-none hover:bg-surface-secondary", isSubItemActive(subItem.url) && "bg-surface-secondary font-medium")}>
                  <Link to={subItem.url} target={subItem.newTab ? "_blank" : undefined} rel={subItem.newTab ? "noreferrer" : undefined} className="flex items-center gap-2 w-full text-foreground">
                    {SubIcon && <SubIcon className="size-4 text-muted"/>}
                    <span>{subItem.title}</span>
                  </Link>
                </Dropdown.Item>);
        })}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </SidebarMenuItem>);
}
function NavCollapsibleItem({ item, isActive, defaultOpen, isSubItemActive }: NavCollapsibleItemProps) {
    const Icon = item.icon;
    const [expanded, setExpanded] = React.useState(defaultOpen);
    return (<Disclosure isExpanded={expanded} onExpandedChange={setExpanded}>
      <SidebarMenuItem>
        
          <Disclosure.Heading>
            <Disclosure.Trigger className="w-full text-left" isDisabled={item.disabled}>
              {Icon && <Icon className="size-4"/>}
              <span>{item.title}</span>
              <ChevronRight className={cn("ml-auto size-4 transition-transform duration-200", expanded && "rotate-90")}/>
            </Disclosure.Trigger>
          </Disclosure.Heading>
        
        <NavItemBadge badge={item.badge}/>

        <Disclosure.Content>
          <SidebarMenuSub>
            {item.subItems.map((subItem) => {
            const SubIcon = subItem.icon;
            return (<SidebarMenuSubItem key={subItem.id}>
                  <SidebarMenuSubButton asChild aria-disabled={subItem.disabled} isActive={isSubItemActive(subItem.url)}>
                    <Link to={subItem.url} target={subItem.newTab ? "_blank" : undefined} rel={subItem.newTab ? "noreferrer" : undefined}>
                      {SubIcon && <SubIcon className="size-4"/>}
                      <span>{subItem.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>);
        })}
          </SidebarMenuSub>
        </Disclosure.Content>
      </SidebarMenuItem>
    </Disclosure>);
}
function NavItemBadge({ badge }: {
    badge?: NavBadge;
}) {
    if (!badge) {
        return null;
    }
    return (<SidebarMenuBadge className={cn("rounded-sm border capitalize", badge === "new" && "border-success text-success", badge === "soon" && "border-border text-muted")}>
      {badge}
    </SidebarMenuBadge>);
}
