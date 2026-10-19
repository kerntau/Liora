import MuiCheckbox from "@mui/material/Checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "./use-controllable-state";

type Checked = boolean | "indeterminate";
type CheckboxProps = Omit<ComponentProps<"input">, "type" | "checked" | "defaultChecked" | "onChange" | "size" | "color"> & {
  checked?: Checked;
  defaultChecked?: Checked;
  onCheckedChange?: (checked: Checked) => void;
};
function Checkbox({ className, checked: controlled, defaultChecked = false, onCheckedChange, ref, ...props }: CheckboxProps) {
  const [checked, setChecked] = useControllableState(controlled, defaultChecked, onCheckedChange);
  return <MuiCheckbox
    data-slot="checkbox" data-state={checked === "indeterminate" ? checked : checked ? "checked" : "unchecked"}
    data-checked={checked !== false ? "" : undefined}
    className={cn("peer relative inline-flex size-4 shrink-0 rounded-[4px] border border-input p-0 text-inherit dark:bg-input/30 transition-colors outline-none has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground", className)}
    checked={checked === true} indeterminate={checked === "indeterminate"} disabled={props.disabled}
    onChange={(_, next) => setChecked(next)}
    icon={<span className="size-3.5" />}
    checkedIcon={<CheckIcon className="size-3.5" />}
    indeterminateIcon={<MinusIcon className="size-3.5" />}
    sx={{ "&:hover": { backgroundColor: "transparent" } }}
    slotProps={{ input: { ...props, ref, role: "checkbox", "aria-checked": checked === "indeterminate" ? "mixed" : checked } }}
  />;
}
export { Checkbox };
