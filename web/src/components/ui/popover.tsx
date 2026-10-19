"use client"

import * as React from "react"
import MuiPopover from "@mui/material/Popover"
import Paper from "@mui/material/Paper"
import Popper from "@mui/material/Popper"
import useForkRef from "@mui/utils/useForkRef"

import { Slot } from "@/components/ui/slot"
import { cn } from "@/lib/utils"

type PopoverState = {
  open: boolean
  setOpen: (open: boolean) => void
  anchor: HTMLElement | null
  setAnchor: (anchor: HTMLElement | null) => void
  trigger: HTMLElement | null
  setTrigger: (trigger: HTMLElement | null) => void
  modal: boolean
  id: string
}
const PopoverContext = React.createContext<PopoverState | null>(null)
const activePopovers: string[] = []
type RootProps = { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; modal?: boolean; children?: React.ReactNode }
function Popover({ open: controlled, defaultOpen = false, onOpenChange, modal = false, children }: RootProps) {
  const [inner, setInner] = React.useState(defaultOpen)
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const [trigger, setTrigger] = React.useState<HTMLElement | null>(null)
  const id = React.useId()
  const setOpen = (open: boolean) => { if (controlled === undefined) setInner(open); onOpenChange?.(open) }
  return <PopoverContext.Provider value={{ open: controlled ?? inner, setOpen, anchor: anchor ?? trigger, setAnchor, trigger, setTrigger, modal, id }}>{children}</PopoverContext.Provider>
}

type TriggerProps = React.HTMLAttributes<HTMLElement> & { asChild?: boolean; disabled?: boolean }
const PopoverTrigger = React.forwardRef<HTMLElement, TriggerProps>(function PopoverTrigger({ asChild, children, onClick, disabled, ...props }, forwardedRef) {
  const state = React.useContext(PopoverContext)
  const ref = useForkRef(forwardedRef, state?.setTrigger)
  const trigger = {
    ...props, ref,
    "data-slot": "popover-trigger",
    "data-state": state?.open ? "open" : "closed",
    "aria-expanded": state?.open,
    "aria-haspopup": "dialog" as const,
    "aria-controls": state?.open ? state.id : undefined,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      if (disabled || event.currentTarget.getAttribute("aria-disabled") === "true" || (event.currentTarget as HTMLButtonElement).disabled) { event.preventDefault(); return }
      onClick?.(event)
      if (!event.defaultPrevented) state?.setOpen(!state.open)
    },
  }
  return asChild ? <Slot {...trigger}>{children}</Slot> : <button type="button" {...trigger} disabled={disabled}>{children}</button>
})

const PopoverAnchor = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }>(function PopoverAnchor({ asChild, children, ...props }, forwardedRef) {
  const state = React.useContext(PopoverContext)
  const ref = useForkRef(forwardedRef, state?.setAnchor)
  return asChild ? <Slot {...props} ref={ref}>{children}</Slot> : <div {...props} ref={ref as React.Ref<HTMLDivElement>}>{children}</div>
})

type ContentProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
  onInteractOutside?: (event: Event | React.SyntheticEvent) => void
}

const PopoverContent = React.forwardRef<HTMLDivElement, ContentProps>(function PopoverContent({
  className, align = "center", side = "bottom", sideOffset = 4, children, style,
  onOpenAutoFocus, onCloseAutoFocus, onInteractOutside, ...props
}, forwardedRef) {
  const state = React.useContext(PopoverContext)
  const [paper, setPaper] = React.useState<HTMLDivElement | null>(null)
  const ref = useForkRef(forwardedRef, setPaper)
  const callbacks = React.useRef({ onOpenAutoFocus, onCloseAutoFocus, onInteractOutside, setOpen: state?.setOpen })
  callbacks.current = { onOpenAutoFocus, onCloseAutoFocus, onInteractOutside, setOpen: state?.setOpen }
  const open = !!state?.open && !!state.anchor
  const anchor = state?.anchor
  const id = state?.id
  const modal = state?.modal

  React.useLayoutEffect(() => {
    if (!open || !paper || !id) return
    activePopovers.push(id)
    const previousFocus = document.activeElement as HTMLElement | null
    const focusEvent = new Event("openAutoFocus", { cancelable: true })
    callbacks.current.onOpenAutoFocus?.(focusEvent)
    if (!focusEvent.defaultPrevented) {
      const focusable = Array.from(paper.querySelectorAll<HTMLElement>("[autofocus],button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")).find((element) => element.getClientRects().length > 0)
      ;(focusable ?? paper).focus({ preventScroll: true })
    }
    function isTopLayer() {
      if (activePopovers.at(-1) !== id) return false
      // A nested MUI Select/Menu or confirmation owns Escape and outside
      // interaction until it closes. A containing dialog remains underneath.
      const topModal = Array.from(document.querySelectorAll<HTMLElement>('.MuiModal-root:not(.MuiModal-hidden):not([aria-hidden="true"])')).at(-1)
      return !topModal || topModal.contains(paper) || (!!anchor && topModal.contains(anchor))
    }
    function outside(event: MouseEvent | FocusEvent) {
      if (!isTopLayer() || modal) return
      const target = event.target as Node | null
      if (!target || paper?.contains(target) || anchor?.contains(target)) return
      // Clicks in a child Popper (for example a combobox) belong to this
      // layer even when the child is portaled to the document body.
      if (target instanceof Element && target.closest('[data-slot="combobox-content"]')) return
      const interaction = new Event("interactOutside", { cancelable: true })
      Object.defineProperty(interaction, "target", { value: event.target })
      callbacks.current.onInteractOutside?.(interaction)
      if (!interaction.defaultPrevented) {
        callbacks.current.setOpen?.(false)
        if (event.type === "click" && target instanceof Element && (target.closest(".MuiBackdrop-root") || target.classList.contains("MuiDialog-container"))) event.stopPropagation()
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.isComposing || !isTopLayer()) return
      if (event.target instanceof Element && event.target.closest('[role="combobox"][aria-expanded="true"]')) return
      event.preventDefault()
      event.stopPropagation()
      callbacks.current.setOpen?.(false)
    }
    document.addEventListener("click", outside, true)
    document.addEventListener("focusin", outside, true)
    document.addEventListener("keydown", escape, true)
    return () => {
      const index = activePopovers.lastIndexOf(id)
      if (index >= 0) activePopovers.splice(index, 1)
      document.removeEventListener("click", outside, true)
      document.removeEventListener("focusin", outside, true)
      document.removeEventListener("keydown", escape, true)
      const closeEvent = new Event("closeAutoFocus", { cancelable: true })
      callbacks.current.onCloseAutoFocus?.(closeEvent)
      if (!closeEvent.defaultPrevented && previousFocus?.isConnected && (!document.activeElement || document.activeElement === document.body || paper.contains(document.activeElement))) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [open, paper, id, anchor, modal])

  const paperProps = {
    ...props, ref,
    id: props.id ?? id,
    "data-slot": "popover-content",
    "data-state": open ? "open" : "closed",
    "data-side": side,
    role: props.role ?? "dialog",
    tabIndex: -1,
    className: cn("flex w-72 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none", className),
    style: { "--radix-popover-trigger-width": `${anchor?.getBoundingClientRect().width ?? 0}px`, ...style } as React.CSSProperties,
  }
  if (!modal) {
    const placement = `${side}${align === "center" ? "" : `-${align}`}` as "bottom" | "bottom-start" | "bottom-end"
    return <Popper role="presentation" open={open} anchorEl={anchor} placement={placement} container={anchor?.closest<HTMLElement>('[role="dialog"]') ?? undefined} modifiers={[{ name: "offset", options: { offset: [0, sideOffset] } }]} sx={{ zIndex: (theme) => theme.zIndex.modal - 1 }}><Paper {...paperProps}>{children}</Paper></Popper>
  }
  const verticalSide = side === "top" || side === "bottom"
  const horizontalAlign = align === "start" ? "left" : align === "end" ? "right" : "center"
  const verticalAlign = align === "start" ? "top" : align === "end" ? "bottom" : "center"
  return (
    <MuiPopover
      open={open}
      anchorEl={anchor}
      disableAutoFocus
      disableRestoreFocus
      onClose={(event) => { callbacks.current.onInteractOutside?.(event as Event); if (!(event as Event).defaultPrevented) state?.setOpen(false) }}
      anchorOrigin={{ vertical: verticalSide ? side : verticalAlign, horizontal: verticalSide ? horizontalAlign : side }}
      transformOrigin={{ vertical: verticalSide ? side === "bottom" ? "top" : "bottom" : verticalAlign, horizontal: verticalSide ? horizontalAlign : side === "right" ? "left" : "right" }}
      slotProps={{ paper: { ...paperProps, style: { ...paperProps.style, marginTop: verticalSide ? side === "bottom" ? sideOffset : -sideOffset : undefined, marginLeft: !verticalSide ? side === "right" ? sideOffset : -sideOffset : undefined } } }}
    >
      {children}
    </MuiPopover>
  )
})

function PopoverHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="popover-header" className={cn("flex flex-col gap-0.5 text-sm", className)} {...props} /> }
function PopoverTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h3 data-slot="popover-title" className={cn("font-medium", className)} {...props} /> }
function PopoverDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p data-slot="popover-description" className={cn("text-muted-foreground", className)} {...props} /> }

export { Popover, PopoverAnchor, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger }
