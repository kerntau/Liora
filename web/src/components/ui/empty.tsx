import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * 空态：全站共用一套结构（图标 24px + 一句标题 + 一句说明 + 可选操作）。
 *
 * 尺寸纪律（REFINE-SPEC 二.7）：默认纵向内边距 24px，整体高度控制在 160px 以内
 * ——不带图标约 94px、带图标约 142px，调用方再加 py-8 也只有 158px，
 * 不会出现"空态占半屏"的廉价感。图标统一 24px（落在 40px 的浅色方块里），
 * 标题用 13/600、说明用 12/400 muted，和卡片内其它文字同一阶梯。
 */
function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl px-6 py-6 text-center text-[13px] text-balance",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-1.5", className)}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  // 与 EmptyHeader 的 gap-1.5 已经形成 6px 间距，不再额外加 mb-2（否则带图标的空态会超过 160px）。
  "flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        "text-[13px] leading-5 font-semibold tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-[12px] leading-5 text-muted-foreground text-balance [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-[12px] text-balance",
        className
      )}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
}
