"use client";
import * as React from "react";
import Box from "@mui/material/Box";
import { cn } from "@/lib/utils";

// Preserve the viewport contract used by chat history, lazy evidence loading and
// scroll restoration. Native scrolling also keeps touch and keyboard behavior.
function ScrollArea({ className, children, type: _type, ...props }: React.ComponentProps<"div"> & { type?: "auto" | "always" | "scroll" | "hover" }) {
  return <Box data-slot="scroll-area" className={cn("relative min-h-0 min-w-0 overflow-hidden", className)} {...props}>
    <Box data-slot="scroll-area-viewport" className="size-full overflow-auto rounded-[inherit]" sx={{ maxHeight: "inherit" }} tabIndex={0}>
      {children}
    </Box>
  </Box>;
}
function ScrollBar({ orientation: _orientation, ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: string }) {
  return <div aria-hidden="true" hidden {...props} />;
}
export { ScrollArea, ScrollBar };

