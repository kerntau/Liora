import * as React from "react";
import { Link, useLocation } from "react-router";
import Collapse from "@mui/material/Collapse";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { ChevronRight } from "lucide-react";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar";
import { api } from "@/lib/api";
import type { NavBadge, NavGroup, NavMainItem, NavMainLinkItem, NavMainParentItem } from "@/navigation/sidebar/sidebar-items";

export function NavMain({ items }: { readonly items: readonly NavGroup[] }) {
  const rawPath = useLocation().pathname; const path = decodeURIComponent(rawPath);
  const isActive = (item: NavMainItem) => item.subItems ? item.subItems.some((sub) => path.startsWith(sub.url)) : path === item.url;
  return <>{items.map((group) => <SidebarGroup key={group.id}>{group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}<SidebarGroupContent><SidebarMenu>{group.items.map((item) => <NavItem key={item.id} item={item} active={isActive(item)} path={path} />)}</SidebarMenu></SidebarGroupContent></SidebarGroup>)}</>;
}
function NavItem({ item, active, path }: { item: NavMainItem; active: boolean; path: string }) {
  const { state, isMobile } = useSidebar(); const collapsed = state === "collapsed" && !isMobile;
  if (!("subItems" in item) || !item.subItems?.length) return <NavLink item={item as NavMainLinkItem} active={active} collapsed={collapsed} />;
  if (collapsed) return <CollapsedMenu item={item} active={active} path={path} />;
  return <ExpandedMenu item={item} active={active} path={path} />;
}
function NavLink({ item, active, collapsed }: { item: NavMainLinkItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon; return <SidebarMenuItem><SidebarMenuButton asChild isActive={active} tooltip={item.title}><Link to={item.url} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noreferrer" : undefined}>{Icon ? <Icon size={17} /> : collapsed ? <Fallback title={item.title} /> : null}<span>{item.title}</span></Link></SidebarMenuButton>{item.id === "approvals" ? <InterceptPendingBadge /> : <NavItemBadge badge={item.badge} />}</SidebarMenuItem>;
}
function ExpandedMenu({ item, active, path }: { item: NavMainParentItem; active: boolean; path: string }) {
  const [open, setOpen] = React.useState(active); const Icon = item.icon;
  return <SidebarMenuItem><SidebarMenuButton isActive={active} onClick={() => setOpen((value) => !value)}>{Icon && <Icon size={17} />}<span>{item.title}</span><ChevronRight size={16} style={{ marginLeft: "auto", transform: open ? "rotate(90deg)" : undefined, transition: "transform 160ms ease" }} /></SidebarMenuButton><NavItemBadge badge={item.badge} /><Collapse in={open} unmountOnExit><SidebarMenuSub>{item.subItems.map((sub) => { const SubIcon = sub.icon; return <SidebarMenuSubItem key={sub.id}><SidebarMenuSubButton asChild isActive={path === sub.url}><Link to={sub.url} target={sub.newTab ? "_blank" : undefined} rel={sub.newTab ? "noreferrer" : undefined}>{SubIcon && <SubIcon size={15} />}<span>{sub.title}</span></Link></SidebarMenuSubButton></SidebarMenuSubItem>; })}</SidebarMenuSub></Collapse></SidebarMenuItem>;
}
function CollapsedMenu({ item, active, path }: { item: NavMainParentItem; active: boolean; path: string }) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null); const Icon = item.icon;
  return <SidebarMenuItem><SidebarMenuButton isActive={active} tooltip={item.title} onClick={(event) => setAnchor(event.currentTarget as HTMLElement)}>{Icon ? <Icon size={17} /> : <Fallback title={item.title} />}</SidebarMenuButton><Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>{item.subItems.map((sub) => { const SubIcon = sub.icon; return <MenuItem key={sub.id} component={Link} to={sub.url} selected={path === sub.url} onClick={() => setAnchor(null)}>{SubIcon && <ListItemIcon><SubIcon size={16} /></ListItemIcon>}<ListItemText primary={sub.title} /></MenuItem>; })}</Menu></SidebarMenuItem>;
}
function Fallback({ title }: { title: string }) { return <span style={{ width: 18, height: 18, display: "grid", placeItems: "center", border: "1px solid currentColor", borderRadius: 4, fontSize: 10 }}>{title.slice(0, 1)}</span>; }
function InterceptPendingBadge() { const [count, setCount] = React.useState(0); React.useEffect(() => { let live = true; const poll = () => api.interceptPending().then((list) => { if (live) setCount(list.length); }).catch(() => undefined); poll(); const timer = setInterval(poll, 5000); return () => { live = false; clearInterval(timer); }; }, []); return count ? <SidebarMenuBadge>{count > 99 ? "99+" : count}</SidebarMenuBadge> : null; }
function NavItemBadge({ badge }: { badge?: NavBadge }) { return badge ? <SidebarMenuBadge>{badge}</SidebarMenuBadge> : null; }
