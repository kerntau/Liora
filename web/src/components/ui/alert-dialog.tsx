"use client";
import * as React from "react";
import MuiDialog from "@mui/material/Dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Slot } from "./slot";

type ContextValue = { open: boolean; setOpen: (open: boolean) => void; titleId: string; descriptionId: string };
const Context = React.createContext<ContextValue | null>(null);
type Props = { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode };
function AlertDialog({ open: controlled, defaultOpen = false, onOpenChange, children }: Props) {
  const [inner, setInner] = React.useState(defaultOpen);
  const id = React.useId();
  const setOpen = (next: boolean) => { if (controlled === undefined) setInner(next); onOpenChange?.(next); };
  return <Context.Provider value={{ open: controlled ?? inner, setOpen, titleId: id + "-title", descriptionId: id + "-description" }}>{children}</Context.Provider>;
}
function AlertDialogTrigger({ asChild, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(Context);
  const Comp = asChild ? Slot : "button";
  return <Comp type="button" data-slot="alert-dialog-trigger" aria-haspopup="dialog" aria-expanded={ctx?.open} {...props}
    onClick={(event: React.MouseEvent<HTMLButtonElement>) => { onClick?.(event); if (!event.defaultPrevented) ctx?.setOpen(true); }} />;
}
function AlertDialogContent({ className, size = "default", children, ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: "default" | "sm" }) {
  const ctx = React.useContext(Context);
  return <MuiDialog open={!!ctx?.open} onClose={(_, reason) => { if (reason === "escapeKeyDown") ctx?.setOpen(false); }}
    role="alertdialog" aria-labelledby={ctx?.titleId} aria-describedby={ctx?.descriptionId} fullWidth maxWidth={false}
    slotProps={{ paper: {
      ...props, ...{ "data-slot": "alert-dialog-content", "data-size": size },
      className: cn("m-4 grid max-h-[90dvh] w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        size === "sm" ? "max-w-sm" : "max-w-lg", className),
    } }}>{children}</MuiDialog>;
}
function AlertDialogPortal({ children }: { children?: React.ReactNode }) { return <>{children}</>; }
function AlertDialogOverlay(props: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="alert-dialog-overlay" {...props} />; }
function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="alert-dialog-header" className={cn("grid gap-1.5 text-center sm:text-left", className)} {...props} />; }
function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="alert-dialog-footer" className={cn("-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end", className)} {...props} />; }
function AlertDialogMedia({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div data-slot="alert-dialog-media" className={cn("mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted", className)} {...props} />; }
function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const ctx = React.useContext(Context);
  return <h2 id={ctx?.titleId} data-slot="alert-dialog-title" className={cn("font-heading text-base font-medium", className)} {...props} />;
}
function AlertDialogDescription({ className, asChild, children, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { asChild?: boolean }) {
  const ctx = React.useContext(Context);
  const Comp = asChild ? Slot : "p";
  return <Comp id={ctx?.descriptionId} data-slot="alert-dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props}>{children}</Comp>;
}
type ActionProps = React.ComponentProps<typeof Button>;
function AlertDialogAction({ onClick, ...props }: ActionProps) {
  const ctx = React.useContext(Context);
  return <Button {...props} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) ctx?.setOpen(false); }} />;
}
function AlertDialogCancel({ variant = "outline", onClick, ...props }: ActionProps) {
  const ctx = React.useContext(Context);
  return <Button variant={variant} autoFocus {...props} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) ctx?.setOpen(false); }} />;
}
export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger };

