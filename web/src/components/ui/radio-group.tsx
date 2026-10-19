"use client";
import * as React from "react";
import MuiRadioGroup from "@mui/material/RadioGroup";
import MuiRadio from "@mui/material/Radio";
import { cn } from "@/lib/utils";
import { useControllableState } from "./use-controllable-state";
const Context = React.createContext<{ value?: string; setValue: (value: string) => void; name: string } | null>(null);
function RadioGroup({ className, children, value: controlled, defaultValue = "", onValueChange, ...props }:
  Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> & { value?: string; defaultValue?: string; onValueChange?: (value: string) => void }) {
  const [value, setValue] = useControllableState(controlled, defaultValue, onValueChange);
  const name = React.useId();
  return <Context.Provider value={{ value, setValue, name }}>
    <MuiRadioGroup value={value} name={name} className={cn("grid w-full gap-2", className)} {...props}>{children}</MuiRadioGroup>
  </Context.Provider>;
}
function RadioGroupItem({ className, value, ref, onChange, ...props }: Omit<React.ComponentProps<"input">, "type" | "size" | "color">) {
  const ctx = React.useContext(Context);
  const selected = ctx?.value === String(value);
  return <MuiRadio data-slot="radio-group-item" value={value} checked={selected} disabled={props.disabled} name={ctx?.name}
    className={cn("size-4 shrink-0 p-0 text-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50", className)}
    onChange={(event) => { onChange?.(event); if (!event.defaultPrevented) ctx?.setValue(String(value)); }}
    slotProps={{ input: { ...props, ref } }} sx={{ "& .MuiSvgIcon-root": { fontSize: 18 } }} />;
}
export { RadioGroup, RadioGroupItem };

