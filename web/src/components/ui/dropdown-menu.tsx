"use client"

import * as React from "react"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Divider from "@mui/material/Divider"
import useForkRef from "@mui/utils/useForkRef"
import { CheckIcon, ChevronRightIcon } from "lucide-react"

import { Slot } from "@/components/ui/slot"
import { cn } from "@/lib/utils"

type MenuState = {
  anchor: HTMLElement | null
  setAnchor: (anchor: HTMLElement | null) => void
  open: boolean
  setOpen: (open: boolean) => void
  close: () => void
  triggerId: string
  contentId: string
}
const MenuContext = React.createContext<MenuState | null>(null)
const RadioContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({})
type RootProps = { children?: React.ReactNode; open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }
function DropdownMenu({ children, open: controlled, defaultOpen = false, onOpenChange }: RootProps) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const [inner, setInner] = React.useState(defaultOpen)
  const id = React.useId()
  const setOpen = (open: boolean) => { if (controlled === undefined) setInner(open); onOpenChange?.(open) }
  return <MenuContext.Provider value={{ anchor, setAnchor, open: controlled ?? inner, setOpen, close: () => setOpen(false), triggerId: `${id}-trigger`, contentId: `${id}-content` }}>{children}</MenuContext.Provider>
}

type TriggerProps = React.HTMLAttributes<HTMLElement> & { asChild?: boolean; disabled?: boolean }
const DropdownMenuTrigger = React.forwardRef<HTMLElement, TriggerProps>(function DropdownMenuTrigger({ asChild, children, onClick, onKeyDown, disabled, ...props }, forwardedRef) {
  const state = React.useContext(MenuContext)
  const ref = useForkRef(forwardedRef, state?.setAnchor)
  const triggerProps = {
    ...props, ref,
    id: props.id ?? state?.triggerId,
    "data-slot": "dropdown-menu-trigger",
    "data-state": state?.open ? "open" : "closed",
    "aria-haspopup": "menu" as const,
    "aria-expanded": state?.open,
    "aria-controls": state?.open ? state.contentId : undefined,
    role: "button",
    tabIndex: disabled ? -1 : props.tabIndex ?? 0,
    "aria-disabled": disabled || props["aria-disabled"],
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (disabled || event.currentTarget.getAttribute("aria-disabled") === "true" || (event.currentTarget as HTMLButtonElement).disabled) { event.preventDefault(); return }
      onClick?.(event)
      if (!event.defaultPrevented) state?.setOpen(!state.open)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || disabled || event.currentTarget.getAttribute("aria-disabled") === "true") return
      const nativeActivation = event.currentTarget.tagName === "BUTTON" || (event.currentTarget.tagName === "A" && event.currentTarget.hasAttribute("href"))
      if (event.key === "ArrowDown" || event.key === "ArrowUp" || (!nativeActivation && (event.key === "Enter" || event.key === " "))) {
        event.preventDefault()
        state?.setOpen(true)
      }
    },
  }
  return asChild ? <Slot {...triggerProps}>{children}</Slot> : <button type="button" {...triggerProps} disabled={disabled}>{children}</button>
})

type ContentProps = React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; side?: "top" | "right" | "bottom" | "left"; sideOffset?: number }
function DropdownMenuContent({ className, children, side = "bottom", align = "start", sideOffset = 4, style, ...props }: ContentProps) {
  const state = React.useContext(MenuContext)
  const verticalSide = side === "top" || side === "bottom"
  const horizontalAlign = align === "start" ? "left" : align === "end" ? "right" : "center"
  const verticalAlign = align === "start" ? "top" : align === "end" ? "bottom" : "center"
  return (
    <Menu
      open={!!state?.open && !!state.anchor}
      anchorEl={state?.anchor}
      onClose={() => state?.close()}
      variant="menu"
      anchorOrigin={{ vertical: verticalSide ? side : verticalAlign, horizontal: verticalSide ? horizontalAlign : side }}
      transformOrigin={{ vertical: verticalSide ? side === "bottom" ? "top" : "bottom" : verticalAlign, horizontal: verticalSide ? horizontalAlign : side === "right" ? "left" : "right" }}
      slotProps={{
        paper: {
          className: cn("min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md", className),
          style: {
            "--radix-dropdown-menu-trigger-width": `${state?.anchor?.getBoundingClientRect().width ?? 0}px`,
            marginTop: verticalSide ? side === "bottom" ? sideOffset : -sideOffset : undefined,
            marginLeft: !verticalSide ? side === "right" ? sideOffset : -sideOffset : undefined,
            ...style,
          } as React.CSSProperties,
        },
        list: {
          ...props,
          id: props.id ?? state?.contentId,
          "aria-labelledby": state?.anchor?.id ?? state?.triggerId,
          "data-slot": "dropdown-menu-content",
          sx: { p: 0 },
        } as React.HTMLAttributes<HTMLUListElement>,
      }}
    >
      {children}
    </Menu>
  )
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) { return <>{children}</> }
function DropdownMenuGroup({ children }: { children?: React.ReactNode }) { return <>{children}</> }
type ItemProps = React.HTMLAttributes<HTMLLIElement> & { inset?: boolean; variant?: "default" | "destructive"; asChild?: boolean; disabled?: boolean; onSelect?: (event: Event) => void }
function DropdownMenuItem({ className, inset, variant = "default", onClick, onSelect, children, asChild, disabled, ...props }: ItemProps) {
  const state = React.useContext(MenuContext)
  return (
    <MenuItem
      {...props}
      component={asChild ? Slot : "li"}
      disabled={disabled}
      data-slot="dropdown-menu-item"
      className={cn("gap-1.5 rounded-md text-sm [&>svg]:size-4 [&>svg]:shrink-0", variant === "destructive" && "text-destructive", inset && "pl-7", className)}
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        if (disabled) { event.preventDefault(); return }
        onClick?.(event as React.MouseEvent<HTMLLIElement>)
        if (event.defaultPrevented) return
        const selectEvent = new Event("select", { cancelable: true })
        onSelect?.(selectEvent)
        if (!selectEvent.defaultPrevented) state?.close()
      }}
    >
      {children}
    </MenuItem>
  )
}

function DropdownMenuCheckboxItem({ checked, children, onCheckedChange, onClick, disabled, ...props }: Omit<ItemProps, "asChild"> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) {
  return <DropdownMenuItem {...props} disabled={disabled} role="menuitemcheckbox" aria-checked={checked} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented && !disabled) onCheckedChange?.(!checked) }}><span aria-hidden="true" className="mr-2 w-4">{checked && <CheckIcon className="size-4" />}</span>{children}</DropdownMenuItem>
}
function DropdownMenuRadioGroup({ children, value, onValueChange }: { children?: React.ReactNode; value?: string; onValueChange?: (value: string) => void }) { return <RadioContext.Provider value={{ value, onValueChange }}>{children}</RadioContext.Provider> }
function DropdownMenuRadioItem({ children, value, onClick, disabled, ...props }: ItemProps & { value: string }) {
  const group = React.useContext(RadioContext)
  return <DropdownMenuItem {...props} disabled={disabled} role="menuitemradio" aria-checked={group.value === value} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented && !disabled) group.onValueChange?.(value) }}><span aria-hidden="true" className="mr-2 w-4">{group.value === value && <CheckIcon className="size-4" />}</span>{children}</DropdownMenuItem>
}
function DropdownMenuLabel({ className, inset, ...props }: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) { return <div className={cn("px-1.5 py-1 text-xs font-medium text-muted-foreground", inset && "pl-7", className)} {...props} /> }
DropdownMenuLabel.muiSkipListHighlight = true
function DropdownMenuSeparator({ className }: { className?: string }) { return <Divider className={cn("my-1", className)} /> }
DropdownMenuSeparator.muiSkipListHighlight = true
function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) { return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} /> }
function DropdownMenuSub({ children }: { children?: React.ReactNode }) { return <DropdownMenu>{children}</DropdownMenu> }
function DropdownMenuSubTrigger({ className, children, inset, ...props }: React.HTMLAttributes<HTMLLIElement> & { inset?: boolean }) {
  return <DropdownMenuTrigger asChild><MenuItem {...props} className={cn("gap-1.5 rounded-md text-sm", inset && "pl-7", className)}>{children}<ChevronRightIcon className="ml-auto size-4" /></MenuItem></DropdownMenuTrigger>
}
function DropdownMenuSubContent(props: ContentProps) { return <DropdownMenuContent side="right" align="start" {...props} /> }

export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent }
