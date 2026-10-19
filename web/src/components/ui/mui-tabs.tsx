import * as React from "react";
import MuiTabs from "@mui/material/Tabs";
import MuiTab, { type TabProps } from "@mui/material/Tab";
import { useControllableState } from "./use-controllable-state";

type RootProps = Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical"; activationMode?: "automatic" | "manual";
};
const Context = React.createContext<{
  value: string; setValue: (value: string) => void; id: string;
  orientation: "horizontal" | "vertical"; automatic: boolean;
} | null>(null);
function useTabs() {
  const context = React.useContext(Context);
  if (!context) throw new Error("Tabs components require a Tabs parent");
  return context;
}
function Root({ value: controlled, defaultValue = "", onValueChange, orientation = "horizontal", activationMode = "automatic", children, ...props }: RootProps) {
  const [value, setValue] = useControllableState(controlled, defaultValue, onValueChange);
  const id = React.useId();
  return <Context.Provider value={{ value, setValue, id, orientation, automatic: activationMode === "automatic" }}>
    <div data-orientation={orientation} data-horizontal={orientation === "horizontal" ? "" : undefined} data-vertical={orientation === "vertical" ? "" : undefined} {...props}>{children}</div>
  </Context.Provider>;
}
function List({ children, ...props }: Omit<React.ComponentProps<"div">, "onChange" | "color">) {
  const context = useTabs();
  return <MuiTabs value={context.value || false} onChange={(_, value: string) => context.setValue(value)}
    orientation={context.orientation} selectionFollowsFocus={context.automatic}
    sx={{ minHeight: 0, overflow: "visible", "& .MuiTabs-indicator": { display: "none" },
      "& .MuiTabs-scroller": { overflow: "visible !important" },
      "& .MuiTabs-list": { height: "100%", gap: "inherit" } }} {...props}>{children}</MuiTabs>;
}
type TriggerProps = Omit<React.ComponentProps<"button">, "value" | "color" | "onChange"> & {
  value: string; selected?: boolean; onChange?: TabProps<"button">["onChange"];
  selectionFollowsFocus?: boolean;
};
function Trigger({ children, value, ...props }: TriggerProps) {
  const context = useTabs();
  return <MuiTab component="button" value={value} label={children}
    id={`${context.id}-tab-${value}`} aria-controls={`${context.id}-panel-${value}`}
    data-state={context.value === value ? "active" : "inactive"}
    data-active={context.value === value ? "" : undefined}
    sx={{ minWidth: 0, minHeight: 0, opacity: 1, lineHeight: "inherit", textTransform: "none", maxWidth: "none" }}
    {...props} />;
}
function Content({ value, forceMount, children, ...props }: React.ComponentProps<"div"> & { value: string; forceMount?: true }) {
  const context = useTabs();
  const active = context.value === value;
  if (!active && !forceMount) return null;
  return <div role="tabpanel" tabIndex={0} hidden={!active}
    id={`${context.id}-panel-${value}`} aria-labelledby={`${context.id}-tab-${value}`}
    data-state={active ? "active" : "inactive"} data-active={active ? "" : undefined} {...props}>{children}</div>;
}
export const TabsPrimitive = { Root, List, Trigger, Content };

