import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 驾驶舱内容骨架：主区 + 右栏的响应式栅格容器。
 * 宽屏（lg+）右栏固定在主区右侧，窄屏折到主区下方；整栏 max-w-screen-2xl 居中。
 */
export function CockpitShell({
  main,
  rail,
  className,
  mainClassName,
  railClassName,
}: {
  /** 主区内容（驾驶舱大屏、图表等）。 */
  main: ReactNode;
  /** 右栏内容（实时流、漏洞分布等）；不传则主区独占整行。 */
  rail?: ReactNode;
  className?: string;
  mainClassName?: string;
  railClassName?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-4 md:gap-5",
        rail ? "lg:grid-cols-[minmax(0,1fr)_340px]" : null,
        className,
      )}
    >
      <div className={cn("flex min-w-0 flex-col gap-4 md:gap-5", mainClassName)}>{main}</div>
      {rail ? (
        <aside className={cn("flex min-w-0 flex-col gap-4 md:gap-5", railClassName)} aria-label="驾驶舱右栏">
          {rail}
        </aside>
      ) : null}
    </div>
  );
}
