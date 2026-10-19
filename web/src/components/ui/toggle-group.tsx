"use client";

import * as React from "react";
import MuiToggleButton from "@mui/material/ToggleButton";
import MuiToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { cn } from "@/lib/utils";
import { useControllableState } from "./use-controllable-state";

type Value = string | string[];
const Context = React.createContext<{ value: Value; variant?: string; size?: string } | null>(null);

function ToggleGroup({ className, children, type = "single", value: controlled, defaultValue, onValueChange,
  variant = "default", size = "default", spacing = 1, orientation = "horizontal", disabled, ...props }:
  Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "color"> & {
    type?: "single" | "multiple"; value?: Value; defaultValue?: Value; onValueChange?: (value: any) => void;
    variant?: string; size?: string; spacing?: number; orientation?: "horizontal" | "vertical"; disabled?: boolean;
  }) {
  const [value, setValue] = useControllableState(controlled, defaultValue ?? (type === "multiple" ? [] : ""), onValueChange);
  return <Context.Provider value={{ value, variant, size }}>
    <MuiToggleButtonGroup data-slot="toggle-group" value={value} exclusive={type === "single"} disabled={disabled}
      orientation={orientation} onChange={(_, next) => setValue(next ?? "")}
      className={cn("flex w-fit items-center", orientation === "vertical" && "flex-col", className)}
      sx={{ gap: `${spacing * 4}px` }} {...props}>{children}</MuiToggleButtonGroup>
  </Context.Provider>;
}

function ToggleGroupItem({ className, variant, size, ...props }:
  Omit<React.ComponentProps<typeof MuiToggleButton>, "size" | "value"> & { value: string; variant?: string; size?: string }) {
  const context = React.useContext(Context);
  const selected = Array.isArray(context?.value) ? context.value.includes(props.value) : context?.value === props.value;
  return <MuiToggleButton data-slot="toggle-group-item" data-state={selected ? "on" : "off"}
    className={cn("inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium normal-case transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
      (size ?? context?.size) === "sm" ? "h-8 px-2.5" : "h-9",
      (variant ?? context?.variant) === "outline" ? "border border-input" : "border-transparent",
      selected && "bg-accent text-accent-foreground", className)} {...props} />;
}

export { ToggleGroup, ToggleGroupItem };
