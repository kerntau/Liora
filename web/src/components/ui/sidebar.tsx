import * as React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import { PanelLeftIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = 256;
const SIDEBAR_WIDTH_ICON = 64;

type SidebarContextProps = { state: "expanded" | "collapsed"; open: boolean; setOpen: (open: boolean | ((value: boolean) => boolean)) => void; openMobile: boolean; setOpenMobile: (open: boolean) => void; isMobile: boolean; toggleSidebar: () => void };
const SidebarContext = React.createContext<SidebarContextProps | null>(null);
export function useSidebar() { const context = React.useContext(SidebarContext); if (!context) throw new Error("useSidebar must be used within a SidebarProvider."); return context; }

export function SidebarProvider({ defaultOpen = true, open: openProp, onOpenChange, className, style, children, ...props }: React.ComponentProps<"div"> & { defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const isMobile = useIsMobile(); const [openMobile, setOpenMobile] = React.useState(false); const [internalOpen, setInternalOpen] = React.useState(defaultOpen); const open = openProp ?? internalOpen;
  const setOpen = React.useCallback((value: boolean | ((previous: boolean) => boolean)) => { const next = typeof value === "function" ? value(open) : value; onOpenChange?.(next); if (!onOpenChange) setInternalOpen(next); document.cookie = `${SIDEBAR_COOKIE_NAME}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`; }, [onOpenChange, open]);
  const toggleSidebar = React.useCallback(() => isMobile ? setOpenMobile((value) => !value) : setOpen((value) => !value), [isMobile, setOpen]);
  React.useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === "b" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); toggleSidebar(); } }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [toggleSidebar]);
  const context = React.useMemo(() => ({ state: open ? "expanded" : "collapsed", open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar } as SidebarContextProps), [open, setOpen, isMobile, openMobile, toggleSidebar]);
  return <SidebarContext.Provider value={context}><Box data-slot="sidebar-wrapper" className={cn("group/sidebar-wrapper", className)} style={{ "--sidebar-width": `${SIDEBAR_WIDTH}px`, "--sidebar-width-icon": `${SIDEBAR_WIDTH_ICON}px`, ...style } as React.CSSProperties} {...props}>{children}</Box></SidebarContext.Provider>;
}

export function Sidebar({ side = "left", variant = "sidebar", collapsible = "offcanvas", className, children, ...props }: React.ComponentProps<"div"> & { side?: "left" | "right"; variant?: "sidebar" | "floating" | "inset"; collapsible?: "offcanvas" | "icon" | "none" }) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar(); const width = collapsible === "icon" && state === "collapsed" ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH;
  if (isMobile) return <Drawer anchor={side} open={openMobile} onClose={() => setOpenMobile(false)} slotProps={{ paper: { sx: { width: "min(288px, 85vw)", bgcolor: "background.paper" } } }}><Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>{children}</Box></Drawer>;
  if (collapsible === "none") return <Box data-slot="sidebar" sx={{ display: "flex", flexDirection: "column", height: "100%", width }} className={className} {...props}>{children}</Box>;
  return <Box data-slot="sidebar" data-state={state} data-collapsible={state === "collapsed" ? collapsible : ""} data-variant={variant} sx={{ display: { xs: "none", md: "flex" }, width, flexShrink: 0, transition: "width 180ms ease", borderRight: side === "left" ? 1 : 0, borderLeft: side === "right" ? 1 : 0, borderColor: "divider", bgcolor: "background.paper", height: "100dvh", position: "sticky", top: 0 }} className={className} {...props}><Box sx={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0, height: "100%" }}>{children}</Box></Box>;
}

export function SidebarTrigger({ className, onPress, ...props }: Omit<React.ComponentProps<typeof IconButton>, "onClick"> & { onPress?: () => void }) { const { toggleSidebar } = useSidebar(); return <IconButton size="small" aria-label="切换侧边栏" className={cn(className)} onClick={() => { onPress?.(); toggleSidebar(); }} {...props}><PanelLeftIcon size={18} /></IconButton>; }
export function SidebarRail({ className, ...props }: React.ComponentProps<"button">) { const { toggleSidebar } = useSidebar(); return <button aria-label="切换侧边栏" onClick={toggleSidebar} className={className} {...props} />; }
export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) { return <Box component="main" data-slot="sidebar-inset" sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: "100dvh", bgcolor: "background.default" }} className={className} {...props} />; }
export function SidebarInput({ className, ...props }: React.ComponentProps<"input">) { return <Box component="input" data-slot="sidebar-input" sx={{ width: "100%", height: 34, px: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default", color: "text.primary", outline: "none", "&:focus": { borderColor: "primary.main" } }} className={className} {...props} />; }
export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) { return <Box data-slot="sidebar-header" sx={{ p: 1.5 }} className={className} {...props} />; }
export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) { return <Box data-slot="sidebar-footer" sx={{ p: 1.5, mt: "auto" }} className={className} {...props} />; }
export function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Divider>) { return <Divider data-slot="sidebar-separator" sx={{ mx: 1.5 }} className={className} {...props} />; }
export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) { return <Box data-slot="sidebar-content" sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }} className={className} {...props} />; }
export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) { return <Box data-slot="sidebar-group" sx={{ px: 1.5, py: 1 }} className={className} {...props} />; }
export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) { return <Box data-slot="sidebar-group-label" sx={{ px: 1, py: 1, fontSize: "0.72rem", fontWeight: 600, color: "text.secondary" }} className={className} {...props} />; }
export function SidebarGroupAction({ className, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) { return <button className={className} {...props} />; }
export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) { return <Box data-slot="sidebar-group-content" className={className} {...props} />; }
export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) { return <Box component="ul" data-slot="sidebar-menu" sx={{ display: "flex", flexDirection: "column", gap: 0.5, listStyle: "none", p: 0, m: 0 }} className={className} {...props} />; }
export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) { return <Box component="li" data-slot="sidebar-menu-item" sx={{ position: "relative" }} className={className} {...props} />; }

type MenuButtonProps = Omit<React.ComponentProps<typeof ButtonBase>, "children"> & { asChild?: boolean; isActive?: boolean; tooltip?: string | React.ReactNode; size?: "default" | "sm" | "lg"; children?: React.ReactNode };
export function SidebarMenuButton({ asChild = false, isActive = false, tooltip, className, children, ...props }: MenuButtonProps) { const { isMobile, state } = useSidebar(); const content = asChild && React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ className?: string }>, { className: cn("sidebar-menu-button", className, isActive && "is-active") }) : <ButtonBase className={cn("sidebar-menu-button", className, isActive && "is-active")} {...props}>{children}</ButtonBase>; if (!tooltip || isMobile || state !== "collapsed") return content; return <Tooltip title={tooltip} placement="right">{content}</Tooltip>; }
export function SidebarMenuAction({ className, ...props }: React.ComponentProps<"button"> & { asChild?: boolean; showOnHover?: boolean }) { return <button className={className} {...props} />; }
export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) { return <Box data-slot="sidebar-menu-badge" sx={{ position: "absolute", right: 8, top: 8, minWidth: 20, px: 0.5, textAlign: "center", fontSize: "0.7rem", borderRadius: 1, bgcolor: "action.selected", color: "text.secondary" }} className={className} {...props} />; }
export function SidebarMenuSkeleton({ className, showIcon = false, ...props }: React.ComponentProps<"div"> & { showIcon?: boolean }) { return <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 0.75 }} className={className} {...props}>{showIcon && <Skeleton variant="rounded" width={24} height={24} />}<Skeleton variant="rounded" width="70%" height={18} /></Box>; }
export function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) { return <Box component="ul" sx={{ display: "flex", flexDirection: "column", gap: 0.5, listStyle: "none", m: 0, ml: 2, pl: 1.5, borderLeft: 1, borderColor: "divider" }} className={className} {...props} />; }
export function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) { return <Box component="li" className={className} {...props} />; }
export function SidebarMenuSubButton({ asChild = false, isActive = false, className, children, ...props }: React.ComponentProps<"a"> & { asChild?: boolean; size?: "sm" | "md"; isActive?: boolean }) { const content = asChild && React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ className?: string }>, { className: cn("sidebar-sub-button", className, isActive && "is-active") }) : <ButtonBase component="a" className={cn("sidebar-sub-button", className, isActive && "is-active")} {...props}>{children}</ButtonBase>; return content; }
