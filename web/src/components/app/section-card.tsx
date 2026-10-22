import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SECTION_TITLE_CLASS } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * 全站统一的区块卡片：一行「图标 + 标题（13px/600）+ 可选描述（12px）+ 右侧操作」，
 * 内边距与 Card 组件保持同一口径（--card-spacing = 20px）：
 * - 头部 px-5 pt-5，与正文之间 pb-4（描述在时标题与描述间距 4px）；
 * - 正文 px-5 pb-5（dense 时贴边，交给表格/列表自带内边距）；
 * - 页脚 border-t border-border/60 + bg-muted/40 + px-5 py-3，与 CardFooter 完全一致。
 *
 * 只保留一层卡片：内部分组请用 divide-y 或 bg-muted/40，不要卡片套卡片。
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  footer,
  className,
  bodyClassName,
  headerClassName,
  dense = false,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  /** 紧凑模式：正文贴边（表格/列表类内容自带内边距时使用）。 */
  dense?: boolean;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      {/* items-center：操作区（按钮/输入框通常 28~32px）与「标题 + 描述」整块垂直居中，
          而不是顶到标题行上方；左侧图标所在列仍是 items-start + mt-0.5，只对齐标题首行。 */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-5 pt-5",
          dense ? "pb-2" : "pb-4",
          headerClassName,
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          <div className="min-w-0">
            <h2 className={cn("truncate", SECTION_TITLE_CLASS)}>{title}</h2>
            {description ? (
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn(dense ? "px-0 pb-0" : "px-5 pb-5", bodyClassName)}>{children}</div>
      {footer ? (
        <div className="rounded-b-xl border-t border-border/60 bg-muted/40 px-5 py-3 text-[12px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
