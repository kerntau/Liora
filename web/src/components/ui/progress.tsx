import LinearProgress from "@mui/material/LinearProgress";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Progress({ className, value = 0, max = 100, ...props }:
  Omit<ComponentProps<"span">, "color"> & { value?: number | null; max?: number }) {
  const normalized = Math.max(0, Math.min(100, (value ?? 0) / (max > 0 ? max : 100) * 100));
  return <LinearProgress data-slot="progress" variant="determinate" value={normalized}
    className={cn("relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted", className)}
    sx={{ "& .MuiLinearProgress-bar": { backgroundColor: "var(--primary)" } }} {...props} />;
}
export { Progress };
