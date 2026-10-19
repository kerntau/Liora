"use client";
import * as React from "react";
import MuiTooltip from "@mui/material/Tooltip";
import { cn } from "@/lib/utils";

type ContentProps = { className?: string; children?: React.ReactNode; side?: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end" };
function HoverCard({ children, openDelay = 200, closeDelay = 100 }: { children?: React.ReactNode; openDelay?: number; closeDelay?: number }) {
  let trigger: React.ReactElement | undefined;
  let content: ContentProps | undefined;
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === HoverCardTrigger) trigger = (child.props as { children: React.ReactElement }).children;
    if (child.type === HoverCardContent) content = child.props as ContentProps;
  });
  if (!trigger) return <>{children}</>;
  const side = content?.side ?? "bottom";
  const placement = content?.align && content.align !== "center" ? `${side}-${content.align}` as const : side;
  return <MuiTooltip title={<div className={cn("w-64 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-2.5 text-sm text-popover-foreground", content?.className)}>{content?.children}</div>}
    enterDelay={openDelay} leaveDelay={closeDelay} placement={placement}
    slotProps={{ tooltip: { className: "max-w-none bg-popover p-0 shadow-lg ring-1 ring-border" } }}>
    {trigger}
  </MuiTooltip>;
}
function HoverCardTrigger({ children }: { asChild?: boolean; children?: React.ReactNode }) { return <>{children}</>; }
function HoverCardContent(_props: ContentProps) { return null; }
export { HoverCard, HoverCardTrigger, HoverCardContent };

