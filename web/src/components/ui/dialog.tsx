"use client";
import * as React from "react";
import MuiDialog from "@mui/material/Dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slot } from "./slot";
import { XIcon } from "lucide-react";

type ContextValue = {
  open: boolean; setOpen: (open: boolean) => void; titleId: string; descriptionId: string;
  hasDescription: boolean; setHasDescription: (value: boolean) => void;
};
const Context = React.createContext<ContextValue | null>(null);
type DialogProps = { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode };
function Dialog({ open: controlled, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [inner, setInner] = React.useState(defaultOpen);
  const [hasDescription, setHasDescription] = React.useState(false);
  const id = React.useId();
  const open = controlled ?? inner;
  const setOpen = React.useCallback((next: boolean) => {
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);
  return <Context.Provider value={{ open, setOpen, titleId: id + "-title", descriptionId: id + "-description", hasDescription, setHasDescription }}>{children}</Context.Provider>;
}
function DialogTrigger({ asChild, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(Context);
  const Comp = asChild ? Slot : "button";
  return <Comp type="button" data-slot="dialog-trigger" aria-haspopup="dialog" aria-expanded={ctx?.open} {...props}
    onClick={(event: React.MouseEvent<HTMLButtonElement>) => { onClick?.(event); if (!event.defaultPrevented) ctx?.setOpen(true); }} />;
}
function DialogClose({ asChild, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(Context);
  const Comp = asChild ? Slot : "button";
  return <Comp type="button" data-slot="dialog-close" {...props}
    onClick={(event: React.MouseEvent<HTMLButtonElement>) => { onClick?.(event); if (!event.defaultPrevented) ctx?.setOpen(false); }} />;
}
function DialogPortal({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
function DialogOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="dialog-overlay" className={cn("fixed inset-0 bg-black/50", className)} {...props} />;
}
function DialogContent({ className, children, showCloseButton = true, "aria-labelledby": labelledBy, "aria-describedby": describedBy, ...props }:
  React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) {
  const ctx = React.useContext(Context);
  return <MuiDialog open={!!ctx?.open} onClose={() => ctx?.setOpen(false)} fullWidth maxWidth={false}
    aria-labelledby={labelledBy ?? ctx?.titleId} aria-describedby={describedBy ?? (ctx?.hasDescription ? ctx.descriptionId : undefined)}
    slotProps={{ paper: {
      ...props, ...{ "data-slot": "dialog-content" },
      className: cn("relative m-4 grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10", className),
    } }}>
    {children}
    {showCloseButton && <DialogClose asChild><Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" aria-label="关闭弹窗"><XIcon /></Button></DialogClose>}
  </MuiDialog>;
}
function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="dialog-header" className={cn("flex flex-col gap-2 pr-8", className)} {...props} />; }
function DialogFooter({ className, showCloseButton = false, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { showCloseButton?: boolean }) {
  return <div data-slot="dialog-footer" className={cn("-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end", className)} {...props}>
    {children}{showCloseButton && <DialogClose asChild><Button variant="outline">关闭</Button></DialogClose>}
  </div>;
}
function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const ctx = React.useContext(Context);
  return <h2 id={ctx?.titleId} data-slot="dialog-title" className={cn("font-heading text-base leading-snug font-medium", className)} {...props} />;
}
function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const ctx = React.useContext(Context);
  const setHasDescription = ctx?.setHasDescription;
  React.useEffect(() => { setHasDescription?.(true); return () => setHasDescription?.(false); }, [setHasDescription]);
  return <p id={ctx?.descriptionId} data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger };

