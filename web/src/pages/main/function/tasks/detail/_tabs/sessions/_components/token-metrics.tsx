import * as React from "react";

import { fmtTokens } from "@/lib/format";
import { cn } from "@/lib/utils";

// Compact token readout used by the session header and the task-wide total.
// One muted pill, three label/value pairs: the numbers stay scannable and
// tabular, and the pill recedes next to the session title instead of competing
// with it. Labels keep the existing short/long wording.
export const TokenMetrics = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<"span"> & {
    input: number;
    cache: number;
    output: number;
    labels?: "short" | "long";
  }
>(({ input, cache, output, labels = "short", className, ...props }, ref) => {
  const names = labels === "short" ? ["入", "缓", "出"] : ["输入", "缓存", "输出"];
  const values = [input, cache, output];
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-border/70 bg-surface-muted px-2 py-0.5",
        className,
      )}
      {...props}
    >
      {values.map((value, index) => (
        <span key={names[index]} className="inline-flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[10px] leading-4 text-muted-foreground">{names[index]}</span>
          <span className="font-mono text-[11px] leading-4 font-medium tabular-nums text-foreground">
            {fmtTokens(value)}
          </span>
        </span>
      ))}
    </span>
  );
});
TokenMetrics.displayName = "TokenMetrics";
