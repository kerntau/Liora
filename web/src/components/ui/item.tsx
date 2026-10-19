import * as React from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Typography from "@mui/material/Typography";
import { cn } from "@/lib/utils";

function Item({ className, variant = "default", size = "default", ...props }: React.ComponentProps<"div"> & { variant?: "default" | "outline" | "muted"; size?: "default" | "sm" }) {
  return <ListItem component="div" role="listitem" data-slot="item" disablePadding
    className={cn("group/item flex w-full min-w-0 items-center gap-3 rounded-lg text-sm", size === "sm" ? "p-3" : "p-4",
      variant === "outline" && "border", variant === "muted" && "bg-muted/50", className)} {...props} />;
}
function ItemGroup({ className, ...props }: React.ComponentProps<"div">) { return <List component="div" role="list" data-slot="item-group" disablePadding className={cn("flex flex-col gap-2", className)} {...props} />; }
function ItemMedia({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="item-media" className={cn("flex shrink-0 items-center justify-center", className)} {...props} />; }
function ItemContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="item-content" className={cn("flex min-w-0 flex-1 flex-col gap-1", className)} {...props} />; }
function ItemActions({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="item-actions" className={cn("flex shrink-0 items-center gap-2", className)} {...props} />; }
function ItemTitle({ className, ...props }: React.ComponentProps<"div">) { return <Typography component="div" data-slot="item-title" className={cn("text-sm font-medium leading-snug", className)} {...props} />; }
function ItemDescription({ className, ...props }: React.ComponentProps<"p">) { return <Typography component="p" data-slot="item-description" className={cn("text-sm leading-normal text-muted-foreground", className)} {...props} />; }
function ItemHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="item-header" className={cn("flex basis-full items-center justify-between gap-2", className)} {...props} />; }
function ItemFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="item-footer" className={cn("flex basis-full items-center justify-between gap-2", className)} {...props} />; }
function ItemSeparator({ className, ...props }: React.ComponentProps<"div">) { return <div role="separator" className={cn("h-px w-full bg-border", className)} {...props} />; }
export { Item, ItemMedia, ItemContent, ItemActions, ItemGroup, ItemSeparator, ItemTitle, ItemDescription, ItemHeader, ItemFooter };

