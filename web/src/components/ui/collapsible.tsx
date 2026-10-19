"use client";

import * as React from "react";
import Collapse from "@mui/material/Collapse";
import { Slot } from "./slot";
import { useControllableState } from "./use-controllable-state";

const Context = React.createContext<{
  open: boolean; setOpen: (open: boolean) => void; disabled: boolean; id: string;
} | null>(null);

function Collapsible({ open: controlled, defaultOpen = false, onOpenChange, disabled = false, asChild = false, ...props }:
  React.ComponentProps<"div"> & { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; disabled?: boolean; asChild?: boolean }) {
  const [open, setOpen] = useControllableState(controlled, defaultOpen, onOpenChange);
  const id = React.useId();
  const Comp = asChild ? Slot : "div";
  return <Context.Provider value={{ open, setOpen, disabled, id }}>
    <Comp data-slot="collapsible" data-state={open ? "open" : "closed"} {...props} />
  </Context.Provider>;
}

function CollapsibleTrigger({ asChild, onClick, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const context = React.useContext(Context);
  const Comp = asChild ? Slot : "button";
  return <Comp type="button" data-slot="collapsible-trigger" data-state={context?.open ? "open" : "closed"}
    aria-expanded={context?.open} aria-controls={context?.id} disabled={context?.disabled}
    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented && context && !context.disabled) context.setOpen(!context.open);
    }} {...props} />;
}

function CollapsibleContent({ forceMount, children, ...props }: React.ComponentProps<"div"> & { forceMount?: boolean }) {
  const context = React.useContext(Context);
  return <Collapse in={context?.open} timeout="auto" mountOnEnter={!forceMount} unmountOnExit={!forceMount}>
    <div id={context?.id} data-slot="collapsible-content" data-state={context?.open ? "open" : "closed"}
      hidden={forceMount && !context?.open} {...props}>{children}</div>
  </Collapse>;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
