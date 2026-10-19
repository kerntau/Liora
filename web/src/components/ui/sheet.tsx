"use client";
import * as React from "react";
import MuiDrawer from "@mui/material/Drawer";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Slot } from "./slot";
import { XIcon } from "lucide-react";

type ContextValue = {
  open: boolean; setOpen: (open: boolean) => void; titleId: string; descriptionId: string;
  hasDescription: boolean; setHasDescription: (value: boolean) => void;
};
const Context = React.createContext<ContextValue | null>(null);
type Props = { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode };
function Sheet({ open: controlled, defaultOpen = false, onOpenChange, children }: Props) {
  const [inner, setInner] = React.useState(defaultOpen);
  const [hasDescription, setHasDescription] = React.useState(false);
  const id = React.useId();
  const setOpen = (next: boolean) => { if (controlled === undefined) setInner(next); onOpenChange?.(next); };
  return <Context.Provider value={{ open: controlled ?? inner, setOpen, titleId: id + "-title", descriptionId: id + "-description", hasDescription, setHasDescription }}>{children}</Context.Provider>;
}
function SheetTrigger({ asChild, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(Context);
  const Comp = asChild ? Slot : "button";
  return <Comp type="button" data-slot="sheet-trigger" aria-haspopup="dialog" aria-expanded={ctx?.open} {...props}
    onClick={(event: React.MouseEvent<HTMLButtonElement>) => { onClick?.(event); if (!event.defaultPrevented) ctx?.setOpen(true); }} />;
}
function SheetClose({ asChild, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(Context);
  const Comp = asChild ? Slot : "button";
  return <Comp type="button" data-slot="sheet-close" {...props}
    onClick={(event: React.MouseEvent<HTMLButtonElement>) => { onClick?.(event); if (!event.defaultPrevented) ctx?.setOpen(false); }} />;
}
function SheetPortal({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
function SheetOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("fixed inset-0 z-50 bg-black/50", className)} {...props} />; }
const SheetContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "right" | "bottom" | "left"; showCloseButton?: boolean;
}>(function SheetContent({ className, children, side = "right", showCloseButton = true, "aria-labelledby": labelledBy, "aria-describedby": describedBy, ...props }, ref) {
  const ctx = React.useContext(Context);
  return <MuiDrawer open={!!ctx?.open} onClose={() => ctx?.setOpen(false)} anchor={side}
    slotProps={{ paper: {
      ...props, ref, role: "dialog", "aria-modal": true, "aria-labelledby": labelledBy ?? ctx?.titleId,
      "aria-describedby": describedBy ?? (ctx?.hasDescription ? ctx.descriptionId : undefined),
      ...{ "data-slot": "sheet-content", "data-side": side },
      className: cn("relative flex min-h-0 flex-col gap-4 overflow-y-auto bg-popover text-sm text-popover-foreground shadow-lg",
        side === "right" || side === "left" ? "w-[min(90vw,24rem)]" : "max-h-[90dvh] w-full", className),
    } }}>
    {children}
    {showCloseButton && <SheetClose asChild><Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" aria-label="关闭面板"><XIcon /></Button></SheetClose>}
  </MuiDrawer>;
});
function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="sheet-header" className={cn("flex flex-col gap-1 p-4 pr-12", className)} {...props} />; }
function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />; }
function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const ctx = React.useContext(Context);
  return <h2 id={ctx?.titleId} data-slot="sheet-title" className={cn("font-heading text-base font-medium", className)} {...props} />;
}
function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const ctx = React.useContext(Context);
  const setHasDescription = ctx?.setHasDescription;
  React.useEffect(() => { setHasDescription?.(true); return () => setHasDescription?.(false); }, [setHasDescription]);
  return <p id={ctx?.descriptionId} data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetPortal, SheetOverlay };

