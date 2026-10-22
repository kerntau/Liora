import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

type SpinnerProps = React.ComponentProps<"svg"> & {
  /** 读屏文案；默认中文，避免 aria-label 泄漏英文枚举。 */
  label?: string
}

function Spinner({ className, label = "加载中", ...props }: SpinnerProps) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={cn("size-4 shrink-0 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
