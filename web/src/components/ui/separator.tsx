import Divider from "@mui/material/Divider";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Separator({ className, orientation = "horizontal", decorative = true, ...props }:
  ComponentProps<"div"> & { orientation?: "horizontal" | "vertical"; decorative?: boolean }) {
  return <Divider component="div" orientation={orientation} role={decorative ? "none" : "separator"}
    data-slot="separator" data-orientation={orientation}
    data-horizontal={orientation === "horizontal" ? "" : undefined} data-vertical={orientation === "vertical" ? "" : undefined}
    className={cn("shrink-0 border-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch", className)}
    {...props} />;
}
export { Separator };
