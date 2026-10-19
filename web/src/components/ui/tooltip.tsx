"use client";
import * as React from "react";
import MuiTooltip from "@mui/material/Tooltip";

type TooltipProps = { children?: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; openDelay?: number; closeDelay?: number };
type ContentProps = { children?: React.ReactNode; className?: string; side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end"; hidden?: boolean };
const DelayContext = React.createContext({ open: 300, close: 0 });
function TooltipProvider({ children, delayDuration, openDelay, closeDelay }: {
  children?: React.ReactNode; delayDuration?: number; skipDelayDuration?: number; openDelay?: number; closeDelay?: number;
}) {
  return <DelayContext.Provider value={{ open: openDelay ?? delayDuration ?? 300, close: closeDelay ?? 0 }}>{children}</DelayContext.Provider>;
}
function Tooltip({ children, open, onOpenChange, openDelay, closeDelay }: TooltipProps) {
  const defaults = React.useContext(DelayContext);
  let trigger: React.ReactElement | undefined;
  let content: ContentProps | undefined;
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === TooltipTrigger) trigger = (child.props as { children?: React.ReactElement }).children;
    if (child.type === TooltipContent) content = child.props as ContentProps;
  });
  if (!trigger) return <>{children}</>;
  const side = content?.side ?? "top";
  const placement = content?.align && content.align !== "center" ? `${side}-${content.align}` as const : side;
  return <MuiTooltip title={content?.hidden ? "" : content?.children ?? ""} placement={placement}
    open={open} onOpen={() => onOpenChange?.(true)} onClose={() => onOpenChange?.(false)}
    enterDelay={openDelay ?? defaults.open} leaveDelay={closeDelay ?? defaults.close}
    slotProps={{ tooltip: { className: content?.className } }} arrow>
    {trigger}
  </MuiTooltip>;
}
function TooltipTrigger({ children }: { asChild?: boolean; children?: React.ReactNode }) { return <>{children}</>; }
function TooltipContent(_props: ContentProps) { return null; }
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

