import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 多行输入：与 Input 同一字号/圆角/聚焦环；field-sizing-content 自动增高，
 * 上限 45vh，超出后内部滚动，避免粘贴大段文本把弹窗顶出视口。
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content max-h-[45vh] min-h-16 w-full overflow-auto rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[13px] md:leading-5 dark:bg-input/30 dark:disabled:bg-input/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
