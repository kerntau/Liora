"use client";

import * as React from "react";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import TextField from "@mui/material/TextField";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CommandEntry = { value: string; keywords: string; disabled: boolean };
type CommandContextValue = {
  query: string;
  setQuery: (value: string) => void;
  activeId: string | undefined;
  setActiveId: (value: string) => void;
  listId: string;
  shouldFilter: boolean;
  entries: Map<string, CommandEntry>;
  register: (id: string, entry: CommandEntry) => () => void;
  composing: React.MutableRefObject<boolean>;
};
const CommandContext = React.createContext<CommandContextValue | null>(null);
const useCommand = () => React.useContext(CommandContext);

function textContent(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child): string => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      return React.isValidElement<{ children?: React.ReactNode }>(child) ? textContent(child.props.children) : "";
    })
    .join(" ");
}

function matches(entry: Pick<CommandEntry, "value" | "keywords">, query: string) {
  const normalized = `${entry.value} ${entry.keywords}`.normalize("NFKC").toLocaleLowerCase();
  return query
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .every((part) => normalized.includes(part));
}

function Command({
  className,
  children,
  shouldFilter = true,
  onKeyDown,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { shouldFilter?: boolean }) {
  const [query, setQuery] = React.useState("");
  const [activeId, setActiveId] = React.useState<string>();
  const [entries, setEntries] = React.useState(new Map<string, CommandEntry>());
  const root = React.useRef<HTMLDivElement>(null);
  const composing = React.useRef(false);
  const listId = React.useId();
  const register = React.useCallback((id: string, entry: CommandEntry) => {
    setEntries((current) => new Map(current).set(id, entry));
    return () =>
      setEntries((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      });
  }, []);
  const getOptions = React.useCallback(
    () =>
      Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          '[data-slot="command-item"][data-visible="true"]:not([aria-disabled="true"])',
        ) ?? [],
      ),
    [],
  );

  React.useLayoutEffect(() => {
    const options = getOptions();
    setActiveId((current) => (options.some((option) => option.id === current) ? current : options[0]?.id));
  }, [query, entries, getOptions]);

  React.useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) {
      if (event.key === "Escape") event.stopPropagation();
      return;
    }
    const options = getOptions();
    if (event.key === "Enter") {
      const option = options.find((item) => item.id === activeId);
      if (option) {
        event.preventDefault();
        option.click();
      }
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      // Home/End still edit the search text when focus is in the field.
      if ((event.key === "Home" || event.key === "End") && event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      if (!options.length) return;
      const current = options.findIndex((option) => option.id === activeId);
      const index =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : current < 0
              ? event.key === "ArrowUp"
                ? options.length - 1
                : 0
              : event.key === "ArrowDown"
                ? (current + 1) % options.length
                : (current - 1 + options.length) % options.length;
      setActiveId(options[index].id);
    }
  };

  return (
    <CommandContext.Provider
      value={{ query, setQuery, activeId, setActiveId, listId, shouldFilter, entries, register, composing }}
    >
      <div
        ref={root}
        data-slot="command"
        className={cn("flex size-full flex-col overflow-hidden rounded-xl bg-popover p-1", className)}
        {...props}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

function CommandDialog({
  title = "搜索页面",
  description = "输入页面名称，使用上下方向键选择，按回车打开。",
  children,
  ...props
}: React.ComponentProps<typeof Dialog> & { title?: string; description?: string }) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  return (
    <Dialog {...props}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden rounded-xl p-0"
        showCloseButton={false}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <DialogHeader className="sr-only">
          <DialogTitle id={titleId}>{title}</DialogTitle>
          <DialogDescription id={descriptionId}>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>↑↓ 选择 · Enter 打开</span>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="max-sm:min-h-11" aria-label="关闭页面搜索">
              关闭 <kbd className="ml-1 hidden text-xs sm:inline">Esc</kbd>
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  onValueChange,
  onChange,
  onCompositionStart,
  onCompositionEnd,
  value,
  autoFocus = true,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { onValueChange?: (value: string) => void }) {
  const command = useCommand();
  React.useLayoutEffect(() => {
    if (value !== undefined) command?.setQuery(String(value));
  }, [value, command?.setQuery]);
  return (
    <div data-slot="command-input-wrapper" className="p-2">
      <TextField
        fullWidth
        size="small"
        variant="outlined"
        autoFocus={autoFocus}
        value={value ?? command?.query ?? ""}
        slotProps={{
          htmlInput: {
            ...props,
            className: cn("text-base sm:text-sm", className),
            "data-slot": "command-input",
            role: "combobox",
            "aria-label": props["aria-label"] ?? "搜索页面",
            "aria-autocomplete": "list",
            "aria-expanded": true,
            "aria-controls": command?.listId,
            "aria-activedescendant": command?.activeId,
            autoComplete: "off",
          },
        }}
        onChange={(event) => {
          command?.setQuery(event.target.value);
          onChange?.(event as React.ChangeEvent<HTMLInputElement>);
          onValueChange?.(event.target.value);
        }}
        onCompositionStart={(event) => {
          if (command) command.composing.current = true;
          onCompositionStart?.(event as React.CompositionEvent<HTMLInputElement>);
        }}
        onCompositionEnd={(event) => {
          if (command) command.composing.current = false;
          onCompositionEnd?.(event as React.CompositionEvent<HTMLInputElement>);
        }}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  const command = useCommand();
  return (
    <List
      data-slot="command-list"
      id={command?.listId}
      role="listbox"
      aria-label="页面搜索结果"
      className={cn("max-h-[min(360px,60dvh)] overflow-y-auto p-1", className)}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  const command = useCommand();
  if (
    command &&
    Array.from(command.entries.values()).some((entry) => !command.shouldFilter || matches(entry, command.query))
  )
    return null;
  return (
    <li
      data-slot="command-empty"
      role="status"
      className={cn("px-4 py-8 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function groupMatches(children: React.ReactNode, query: string): boolean {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement<CommandItemProps & { children?: React.ReactNode }>(child)) return false;
    if (child.type === CommandItem)
      return matches(
        {
          value: child.props.value ?? textContent(child.props.children),
          keywords: child.props.keywords?.join(" ") ?? "",
        },
        query,
      );
    return groupMatches(child.props.children, query);
  });
}

function CommandGroup({
  heading,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLLIElement> & { heading?: React.ReactNode }) {
  const command = useCommand();
  const headingId = React.useId();
  if (command?.shouldFilter && !groupMatches(children, command.query)) return null;
  return (
    <li data-slot="command-group" role="presentation" className={cn("p-1", className)} {...props}>
      {heading && (
        <div id={headingId} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      )}
      <ul role="group" aria-labelledby={heading ? headingId : undefined} className="m-0 list-none p-0">
        {children}
      </ul>
    </li>
  );
}

type CommandItemProps = Omit<React.HTMLAttributes<HTMLLIElement>, "onSelect"> & {
  value?: string;
  keywords?: string[];
  disabled?: boolean;
  onSelect?: (value: string) => void;
};
function CommandItem({
  className,
  children,
  value,
  keywords = [],
  disabled = false,
  onSelect,
  onClick,
  onMouseMove,
  onMouseDown,
  ...props
}: CommandItemProps) {
  const command = useCommand();
  const id = React.useId();
  const itemValue = value ?? textContent(children);
  const keywordText = keywords.join(" ");
  const register = command?.register;
  React.useLayoutEffect(
    () => register?.(id, { value: itemValue, keywords: keywordText, disabled }),
    [register, id, itemValue, keywordText, disabled],
  );
  const visible = !command?.shouldFilter || matches({ value: itemValue, keywords: keywordText }, command.query);
  if (!visible) return null;
  return (
    <ListItemButton
      component="li"
      data-slot="command-item"
      data-visible="true"
      data-selected={command?.activeId === id}
      data-disabled={disabled}
      id={id}
      role="option"
      aria-selected={command?.activeId === id}
      disabled={disabled}
      tabIndex={-1}
      className={cn("min-h-11 gap-2 rounded-lg px-2 py-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0", className)}
      selected={command?.activeId === id}
      {...props}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        if (!event.defaultPrevented) event.preventDefault();
      }}
      onMouseMove={(event) => {
        onMouseMove?.(event);
        if (!disabled) command?.setActiveId(id);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!disabled && !event.defaultPrevented) onSelect?.(itemValue);
      }}
    >
      {children}
    </ListItemButton>
  );
}

function CommandSeparator({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <Divider component="li" data-slot="command-separator" className={cn("mx-2 my-1", className)} {...props} />;
}
function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
