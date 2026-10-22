import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * 提示条：一层卡片描边 + 8/12 的内边距（4 的倍数），图标 14px 落在首行基线上。
 * destructive 用 5% 底色而不是纯白卡片，避免"错误提示看起来和普通说明一样"。
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-lg border px-3 py-2 text-left text-[13px] leading-5 has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-16 has-[>svg]:grid-cols-[auto_minmax(0,1fr)] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-card text-card-foreground",
        destructive:
          "border-destructive/30 bg-destructive/5 text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "min-w-0 text-[13px] font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "min-w-0 text-[12px] leading-5 text-balance text-muted-foreground [overflow-wrap:anywhere] md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
