"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
} from "@/components/ui/input-group"
import { SearchIcon, CheckIcon, XIcon } from "lucide-react"

function Command({
  className,
  onKeyDownCapture,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  const composing = React.useRef(false)
  return (
    <CommandPrimitive
      data-slot="command"
      label="搜索页面"
      loop
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
        className
      )}
      {...props}
      onCompositionStart={(event) => {
        composing.current = true
        onCompositionStart?.(event)
      }}
      onCompositionEnd={(event) => {
        composing.current = false
        onCompositionEnd?.(event)
      }}
      onKeyDownCapture={(event) => {
        onKeyDownCapture?.(event)
        if (composing.current && (event.key === "Enter" || event.key === "Escape")) event.stopPropagation()
      }}
    />
  )
}

function CommandDialog({
  title = "搜索页面",
  description = "输入页面名称，使用上下方向键选择，按回车打开。",
  children,
  className,
  showCloseButton = false,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  onCloseAutoFocus?: React.ComponentProps<typeof DialogContent>["onCloseAutoFocus"]
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          "animate-scale-in top-[20%] translate-y-0 overflow-hidden rounded-xl! border border-border bg-popover p-0 shadow-[var(--shadow-raised)]",
          className
        )}
        showCloseButton={showCloseButton}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="icon-xs" className="absolute top-2 right-2" aria-label="关闭页面搜索">
            <XIcon />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          aria-label="搜索页面"
          className={cn(
            "w-full text-base outline-hidden disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60 md:text-[13px]",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-[12px] text-muted-foreground", className)}
      {...props}
    >
      <div role="status">{children}</div>
    </CommandPrimitive.Empty>
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  // 菜单里的分组分割线：与 dropdown-menu 的 separator 同口径（横向 1px + border/70）。
  // 不要与 app/page-header 的 MetaSeparator 混用——那个是 meta 行里的竖线分隔符。
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 my-1 h-px bg-border/70", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:text-muted-foreground data-[disabled=true]:opacity-60 data-selected:bg-accent data-selected:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-primary",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-[11px] tracking-widest text-muted-foreground group-data-selected/command-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
