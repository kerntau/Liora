"use client"

import * as React from "react"
import useAutocomplete, { type UseAutocompleteReturnValue } from "@mui/material/useAutocomplete"
import ButtonBase from "@mui/material/ButtonBase"
import Chip from "@mui/material/Chip"
import ClickAwayListener from "@mui/material/ClickAwayListener"
import Divider from "@mui/material/Divider"
import InputBase from "@mui/material/InputBase"
import ListItemButton from "@mui/material/ListItemButton"
import Paper from "@mui/material/Paper"
import Popper from "@mui/material/Popper"
import useForkRef from "@mui/utils/useForkRef"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type Selection<Item, Multiple extends boolean> = Multiple extends true ? Item[] : Item | null
type RootProps<Item, Multiple extends boolean> = {
  items?: Item[]
  multiple?: Multiple
  value?: Selection<Item, Multiple>
  defaultValue?: Selection<Item, Multiple>
  onValueChange?: (value: Selection<Item, Multiple>) => void
  inputValue?: string
  onInputValueChange?: (value: string) => void
  itemToStringLabel?: (item: Item) => string
  itemToStringValue?: (item: Item) => string
  disabled?: boolean
  children?: React.ReactNode
}
type ComboboxState = {
  api: UseAutocompleteReturnValue<unknown, boolean, false, false>
  disabled: boolean
  multiple: boolean
  labelFor: (item: unknown) => string
  keyFor: (item: unknown) => string
  close: () => void
}
const ComboboxContext = React.createContext<ComboboxState | null>(null)
const ChipIndexContext = React.createContext(0)
function useCombobox() {
  const state = React.useContext(ComboboxContext)
  if (!state) throw new Error("Combobox controls must be inside Combobox")
  return state
}

function Combobox<Item = string, Multiple extends boolean = false>({
  items = [], multiple = false as Multiple, value, defaultValue, onValueChange,
  inputValue, onInputValueChange, itemToStringLabel, itemToStringValue, disabled = false, children,
}: RootProps<Item, Multiple>) {
  const [open, setOpen] = React.useState(false)
  const labelFor = (item: unknown) => String(itemToStringLabel?.(item as Item) ?? itemToStringValue?.(item as Item) ?? item ?? "")
  const keyFor = (item: unknown) => String(itemToStringValue?.(item as Item) ?? labelFor(item))
  const api = useAutocomplete<unknown, boolean, false, false>({
    options: items,
    multiple,
    value,
    defaultValue,
    inputValue,
    disabled,
    open: open && !disabled,
    openOnFocus: true,
    autoHighlight: true,
    clearOnBlur: false,
    disableCloseOnSelect: multiple,
    getOptionLabel: labelFor,
    getOptionKey: keyFor,
    isOptionEqualToValue: (option, selected) => keyFor(option) === keyFor(selected),
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onChange: (_event, next) => onValueChange?.(next as Selection<Item, Multiple>),
    onInputChange: (_event, next) => onInputValueChange?.(next),
  })
  return (
    <ComboboxContext.Provider value={{ api, disabled, multiple, keyFor, labelFor, close: () => setOpen(false) }}>
      <ClickAwayListener onClickAway={() => setOpen(false)} mouseEvent="onMouseDown">
        <div
          {...api.getRootProps({
            onKeyDown: (event: React.KeyboardEvent & { defaultMuiPrevented?: boolean }) => {
              // Respect consumers such as the category creator before MUI
              // handles Enter, and leave composing IME keystrokes untouched.
              if (event.defaultPrevented || event.nativeEvent.isComposing) event.defaultMuiPrevented = true
            },
          })}
          ref={api.setAnchorEl}
          data-slot="combobox"
          className="min-w-0 w-full"
        >
          {children}
        </div>
      </ClickAwayListener>
    </ComboboxContext.Provider>
  )
}

type ValueProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & {
  children?: React.ReactNode | ((value: any) => React.ReactNode)
}
function ComboboxValue({ children, ...props }: ValueProps) {
  const { api, labelFor } = useCombobox()
  const content = typeof children === "function" ? children(api.value) : children
  return (
    <span data-slot="combobox-value" className="contents" {...props}>
      {content == null ? (Array.isArray(api.value) ? api.value.map(labelFor).join(", ") : api.value == null ? null : labelFor(api.value)) :
        React.Children.map(content, (child, index) => <ChipIndexContext.Provider value={index}>{child}</ChipIndexContext.Provider>)}
    </span>
  )
}

function ComboboxTrigger({ children, onClick, disabled, ...props }: React.ComponentProps<typeof ButtonBase>) {
  const state = useCombobox()
  const trigger = state.api.getPopupIndicatorProps()
  return <ButtonBase {...trigger} {...props} type="button" data-slot="combobox-trigger" aria-label={state.api.popupOpen ? "收起选项" : "展开选项"} disabled={disabled || state.disabled} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) trigger.onClick?.(event) }}>{children ?? <ChevronDownIcon className="size-4 opacity-60" />}</ButtonBase>
}

type InputProps = React.ComponentProps<"input"> & { showClear?: boolean }
function ComboboxInput({ className, showClear = false, ...props }: InputProps) {
  return (
    <div data-slot="combobox-input" className={cn("flex h-8 w-full items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", className)}>
      <ComboboxChipsInput {...props} />
      {showClear && <ComboboxClear />}
      <ComboboxTrigger disabled={props.disabled} className="size-5 shrink-0" />
    </div>
  )
}

function ComboboxChipsInput({ className, ref: forwardedRef, onChange, onFocus, onBlur, onMouseDown, disabled, ...props }: React.ComponentProps<"input">) {
  const { api, disabled: rootDisabled } = useCombobox()
  const { ref: inputRef, ...input } = api.getInputProps()
  const ref = useForkRef(inputRef, forwardedRef)
  return (
    <InputBase
      sx={{ display: "contents" }}
      inputRef={ref}
      disabled={disabled || rootDisabled}
      slotProps={{ input: {
        ...input, ...props,
        ...{ "data-slot": "combobox-chips-input" },
        disabled: disabled || rootDisabled,
        className: cn("h-7 min-w-16 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => { onChange?.(event); if (!event.defaultPrevented) input.onChange?.(event) },
        onFocus: (event: React.FocusEvent<HTMLInputElement>) => { onFocus?.(event); if (!event.defaultPrevented) input.onFocus?.(event) },
        onBlur: (event: React.FocusEvent<HTMLInputElement>) => { onBlur?.(event); if (!event.defaultPrevented) input.onBlur?.(event) },
        onMouseDown: (event: React.MouseEvent<HTMLInputElement>) => { onMouseDown?.(event); if (!event.defaultPrevented) input.onMouseDown?.(event) },
      } }}
    />
  )
}

function ComboboxContent({ children, className, portalContainer, ...props }: React.HTMLAttributes<HTMLDivElement> & { portalContainer?: React.RefObject<HTMLElement | null> }) {
  const { api } = useCombobox()
  return (
    <Popper
      role="presentation"
      open={api.popupOpen && !!api.anchorEl}
      anchorEl={api.anchorEl}
      placement="bottom-start"
      container={portalContainer ? () => portalContainer.current : undefined}
      style={{ width: api.anchorEl?.getBoundingClientRect().width }}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
    >
      <Paper
        {...props}
        data-slot="combobox-content"
        className={cn("max-h-80 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md", className)}
        onMouseDown={(event) => { props.onMouseDown?.(event); event.preventDefault() }}
      >
        {children}
      </Paper>
    </Popper>
  )
}

type ListProps = Omit<React.HTMLAttributes<HTMLUListElement>, "children"> & { children?: React.ReactNode | ((item: any) => React.ReactNode) }
function ComboboxList({ children, className, ...props }: ListProps) {
  const { api } = useCombobox()
  return <ul {...api.getListboxProps()} {...props} data-slot="combobox-list" className={cn("m-0 list-none p-0 outline-none", className)}>{typeof children === "function" ? api.groupedOptions.map(children) : children}</ul>
}

function ComboboxItem({ children, value, className, disabled, onClick, onMouseMove, ...props }: Omit<React.HTMLAttributes<HTMLLIElement>, "value"> & { value: unknown; disabled?: boolean }) {
  const { api, keyFor, disabled: rootDisabled } = useCombobox()
  const index = api.groupedOptions.findIndex((item) => keyFor(item) === keyFor(value))
  if (index < 0) return null
  const { key: _key, ...option } = api.getOptionProps({ option: value, index })
  const isDisabled = disabled || rootDisabled
  return (
    <ListItemButton
      component="li"
      {...option} {...props}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      selected={!!option["aria-selected"]}
      data-slot="combobox-item"
      className={cn("gap-2 rounded-md text-sm [&.Mui-focused]:bg-accent [&.Mui-focusVisible]:bg-accent", className)}
      onMouseMove={(event) => { onMouseMove?.(event); if (!event.defaultPrevented && !isDisabled) option.onMouseMove?.(event) }}
      onClick={(event) => { onClick?.(event); if (!event.defaultPrevented && !isDisabled) option.onClick?.(event) }}
    >
      {children}<CheckIcon aria-hidden="true" className={cn("ml-auto size-4 shrink-0", !option["aria-selected"] && "invisible")} />
    </ListItemButton>
  )
}

function ComboboxEmpty({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { api } = useCombobox()
  return api.groupedOptions.length ? null : <div role="status" className={cn("px-2 py-2 text-center text-sm text-muted-foreground", className)} {...props} />
}
function ComboboxChips({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="combobox-chips" className={cn("flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", className)} {...props} />
}
function ComboboxChip({ children, className, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, "color">) {
  const { api, disabled, labelFor } = useCombobox()
  const index = React.useContext(ChipIndexContext)
  const item = api.getItemProps({ index })
  const { key: _key, ...itemProps } = item as typeof item & { key?: number }
  const selected = Array.isArray(api.value) ? api.value[index] : api.value
  return <Chip {...itemProps} {...props} data-slot="combobox-chip" size="small" disabled={disabled} label={children} className={cn("max-w-full rounded-md bg-muted text-foreground", className)} deleteIcon={<XIcon aria-label={`移除 ${labelFor(selected)}`} className="size-3" />} onDelete={disabled ? undefined : itemProps.onDelete} sx={{ fontFamily: "inherit", fontSize: "0.75rem", height: "1.5rem", "& .MuiChip-label": { px: 0.75 } }} />
}
function ComboboxClear(props: React.ComponentProps<typeof ButtonBase>) {
  const { api, disabled } = useCombobox()
  if (!api.dirty) return null
  return <ButtonBase {...api.getClearProps()} {...props} disabled={disabled || props.disabled} aria-label="清除选择" className={cn("size-5 shrink-0 rounded-sm", props.className)}><XIcon className="size-3.5" /></ButtonBase>
}
function ComboboxGroup(props: React.HTMLAttributes<HTMLDivElement>) { return <div role="group" {...props} /> }
function ComboboxLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn("px-2 py-1 text-xs font-medium text-muted-foreground", className)} {...props} /> }
function ComboboxCollection({ children }: { children?: React.ReactNode | ((item: any) => React.ReactNode) }) { const { api } = useCombobox(); return <>{typeof children === "function" ? api.groupedOptions.map(children) : children}</> }
function ComboboxSeparator({ className }: { className?: string }) { return <Divider className={cn("my-1", className)} /> }
function useComboboxAnchor() { return React.useRef<HTMLDivElement | null>(null) }

export { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxGroup, ComboboxLabel, ComboboxCollection, ComboboxEmpty, ComboboxSeparator, ComboboxChips, ComboboxChip, ComboboxChipsInput, ComboboxTrigger, ComboboxValue, ComboboxClear, useComboboxAnchor }
