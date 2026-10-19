"use client"

import * as React from "react"
import MuiSelect from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import Divider from "@mui/material/Divider"
import ListSubheader from "@mui/material/ListSubheader"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type ItemProps = React.HTMLAttributes<HTMLLIElement> & { value: string; disabled?: boolean }
type ContentProps = React.HTMLAttributes<HTMLDivElement> & { position?: string; align?: "start" | "center" | "end" }
type SelectState = {
  value: string
  disabled: boolean
  open: boolean
  setOpen: (open: boolean) => void
  setValue: (value: string) => void
  items: React.ReactElement<ItemProps>[]
  content?: ContentProps
  menuChildren: React.ReactNode[]
}
const SelectContext = React.createContext<SelectState | null>(null)

type RootProps<Value extends string> = {
  value?: Value
  defaultValue?: Value
  onValueChange?: (value: Value) => void
  disabled?: boolean
  children?: React.ReactNode
}

function Select<Value extends string = string>({ value: controlled, defaultValue, onValueChange, disabled = false, children }: RootProps<Value>) {
  const [inner, setInner] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  const value = controlled ?? inner ?? ""
  const items: React.ReactElement<ItemProps>[] = []
  const menuChildren: React.ReactNode[] = []
  let content: ContentProps | undefined

  // Read the declared options before the menu mounts, so the first render has
  // its display label. MUI Select also requires options without group wrappers.
  function collect(nodes: React.ReactNode, inContent = false) {
    React.Children.forEach(nodes, (node) => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return
      if (node.type === SelectContent) {
        content = node.props as ContentProps
        collect(node.props.children, true)
      } else if (node.type === SelectItem) {
        const item = node as React.ReactElement<ItemProps>
        items.push(item)
        const { children: label, className, ...props } = item.props
        menuChildren.push(
          <MenuItem {...props} key={item.key ?? props.value} className={cn("gap-2 rounded-md text-sm", className)}>
            <span aria-hidden="true" className="w-4 shrink-0">{value === props.value && <CheckIcon className="size-4" />}</span>
            {label}
          </MenuItem>,
        )
      } else if (node.type === SelectLabel || node.type === SelectSeparator) {
        menuChildren.push(React.cloneElement(node, { key: node.key ?? `decoration-${menuChildren.length}` }))
      } else if (node.type === SelectGroup || node.type === React.Fragment || !inContent) {
        collect(node.props.children, inContent)
      }
    })
  }
  collect(children)

  return (
    <SelectContext.Provider value={{
      value, disabled, open: open && !disabled, setOpen,
      setValue: (next) => {
        if (disabled) return
        if (controlled === undefined) setInner(next as Value)
        onValueChange?.(next as Value)
      },
      items, content, menuChildren,
    }}>
      {children}
    </SelectContext.Provider>
  )
}

function SelectTrigger({ className, size = "default", children, disabled, id, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "default" }) {
  const state = React.useContext(SelectContext)
  const [labelId, setLabelId] = React.useState<string>()
  React.useLayoutEffect(() => {
    if (!id) return
    const label = Array.from(document.querySelectorAll<HTMLLabelElement>("label[for]")).find((element) => element.htmlFor === id)
    if (!label) return
    if (!label.id) label.id = `${id}-label`
    setLabelId(label.id)
  }, [id])
  const horizontal = state?.content?.align === "end" ? "right" : state?.content?.align === "center" ? "center" : "left"
  return (
    <MuiSelect
      variant="standard"
      disableUnderline
      displayEmpty
      labelId={labelId}
      disabled={disabled || state?.disabled}
      value={state?.items.some((item) => item.props.value === state.value) ? state.value : ""}
      open={state?.open ?? false}
      onOpen={() => state?.setOpen(true)}
      onClose={() => state?.setOpen(false)}
      onChange={(event) => state?.setValue(event.target.value)}
      renderValue={() => children}
      IconComponent={ChevronDownIcon}
      className={cn("h-8 w-fit rounded-lg border border-input bg-transparent px-2.5 text-sm whitespace-nowrap focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 disabled:opacity-50", className)}
      SelectDisplayProps={{
        ...props,
        id,
        onClick: onClick as unknown as React.MouseEventHandler<HTMLDivElement>,
        "data-slot": "select-trigger",
        "data-size": size,
      } as React.HTMLAttributes<HTMLDivElement>}
      sx={{
        fontFamily: "inherit", fontSize: "inherit", color: "var(--foreground)",
        "&.Mui-disabled": { opacity: 0.5 },
        "& .MuiSelect-select": { display: "flex", alignItems: "center", gap: "0.375rem", padding: "0 1.5rem 0 0 !important", minHeight: "0 !important", height: "100%", boxSizing: "border-box" },
        "& .MuiSelect-icon": { right: 0, width: "1rem", height: "1rem", color: "currentColor", opacity: 0.6 },
      }}
      MenuProps={{
        anchorOrigin: { vertical: "bottom", horizontal },
        transformOrigin: { vertical: "top", horizontal },
        slotProps: {
          paper: { className: cn("min-w-32 rounded-lg bg-popover p-1 text-popover-foreground shadow-md", state?.content?.className) },
          list: { ...{ "data-slot": "select-content" }, sx: { p: 0 } },
        },
      }}
    >
      {state?.menuChildren}
    </MuiSelect>
  )
}

function SelectValue({ placeholder, children }: { placeholder?: React.ReactNode; children?: React.ReactNode }) {
  const state = React.useContext(SelectContext)
  const label = state?.items.find((item) => item.props.value === state.value)?.props.children
  return <span data-slot="select-value" className="truncate">{children ?? (state?.value ? label ?? state.value : placeholder)}</span>
}

function SelectContent(_props: ContentProps) { return null }
function SelectItem({ className, ...props }: ItemProps) { return <MenuItem className={cn("gap-2 rounded-md text-sm", className)} {...props} /> }
function SelectGroup({ children }: { children?: React.ReactNode }) { return <>{children}</> }
function SelectLabel({ className, ...props }: Omit<React.HTMLAttributes<HTMLLIElement>, "color">) { return <ListSubheader className={cn("px-2 py-1 text-xs font-medium text-muted-foreground", className)} {...props} /> }
SelectLabel.muiSkipListHighlight = true
function SelectSeparator({ className }: { className?: string }) { return <Divider className={cn("my-1", className)} /> }
SelectSeparator.muiSkipListHighlight = true
function SelectScrollUpButton() { return null }
function SelectScrollDownButton() { return null }

export { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue }
