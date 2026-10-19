import MuiSwitch from "@mui/material/Switch";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "./use-controllable-state";

type SwitchProps = Omit<ComponentProps<"input">, "type" | "onChange" | "size" | "color"> & {
  size?: "sm" | "default";
  onCheckedChange?: (checked: boolean) => void;
};
function Switch({ className, size = "default", checked: controlled, defaultChecked = false, onCheckedChange, ref, ...props }: SwitchProps) {
  const [checked, setChecked] = useControllableState(controlled, defaultChecked, onCheckedChange);
  const small = size === "sm";
  return <MuiSwitch data-slot="switch" data-size={size} data-state={checked ? "checked" : "unchecked"}
    className={cn("peer shrink-0 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:opacity-50", className)}
    checked={checked} onChange={(_, next) => setChecked(next)} disabled={props.disabled}
    slotProps={{ input: { ...props, ref, role: "switch" } }}
    sx={{
      width: small ? 24 : 32, height: small ? 14 : 18.4, padding: 0, borderRadius: 20, overflow: "visible",
      "& .MuiSwitch-switchBase": {
        padding: "1px", color: "var(--background)",
        "&.Mui-checked": { transform: `translateX(${small ? 10 : 14}px)`, color: "var(--background)",
          "& + .MuiSwitch-track": { backgroundColor: "var(--primary)", opacity: 1 } },
        "&:hover": { backgroundColor: "transparent" },
        "&.Mui-disabled + .MuiSwitch-track": { opacity: 1 },
      },
      "& .MuiSwitch-thumb": { width: small ? 12 : 16, height: small ? 12 : 16, boxShadow: "none" },
      "& .MuiSwitch-track": { borderRadius: 20, backgroundColor: "var(--input)", opacity: 1 },
    }} />;
}
export { Switch };
