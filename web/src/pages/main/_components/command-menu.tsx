"use client";

import * as React from "react";

import { useRouter } from "@/lib/router-compat";

import { ClipboardCheck, LayoutDashboard, PlusCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import type { NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

type NavEntry = {
  id: string;
  label: string;
  url: string;
  icon?: NavMainItem["icon"];
  disabled?: boolean;
  newTab?: boolean;
};

// sidebarItems 里的页面（功能/系统/运行管理分组）打平成跳转列表；
// 不在侧栏里的系统页面（Agent/MCP/Skills/工具）在这里补齐，保证全站都能从 ⌘K 到达。
const NAV_GROUPS: { heading: string; items: NavEntry[] }[] = [
  ...sidebarItems.map((group) => ({
    heading: group.label ?? "其他",
    items: group.items.flatMap<NavEntry>((item) => {
      if (item.subItems) {
        return item.subItems.map((sub) => ({
          id: sub.id,
          label: item.title + " · " + sub.title,
          url: sub.url,
          icon: sub.icon ?? item.icon,
          disabled: sub.disabled,
          newTab: sub.newTab,
        }));
      }
      return [
        {
          id: item.id,
          label: item.title,
          url: item.url,
          icon: item.icon,
          disabled: item.disabled,
          newTab: item.newTab,
        },
      ];
    }),
  })),
  {
    heading: "系统扩展",
    items: [
      { id: "agents", label: "Agent", url: "/system/agents" },
      { id: "mcp", label: "MCP", url: "/system/mcp" },
      { id: "skills", label: "Skills", url: "/system/skills" },
      { id: "tools", label: "工具", url: "/system/tools" },
    ],
  },
];

const ACTIONS: NavEntry[] = [
  { id: "action-new-task", label: "新建任务", url: "/function/tasks", icon: PlusCircle },
  { id: "action-approvals", label: "处理待审批", url: "/system/intercept/approvals", icon: ClipboardCheck },
  { id: "action-dashboard", label: "回到总览", url: "/dashboard", icon: LayoutDashboard },
];

function filterEntries(entries: NavEntry[], query: string) {
  const parts = query
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = (entry.label + " " + entry.id + " " + entry.url).normalize("NFKC").toLocaleLowerCase();
    return parts.every((part) => haystack.includes(part));
  });
}

export function CommandMenu() {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [modifier, setModifier] = React.useState("Ctrl");
  const router = useRouter();

  const handleOpenChange = React.useCallback((value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  }, []);

  React.useEffect(() => {
    setModifier(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl");
    const down = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "k" &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.repeat &&
        !e.isComposing &&
        e.keyCode !== 229
      ) {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) setQuery("");
          return !prev;
        });
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (entry: NavEntry) => {
    if (entry.disabled) return;
    handleOpenChange(false);
    if (entry.newTab) {
      window.open(entry.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(entry.url);
    }
  };

  const renderItems = (entries: NavEntry[]) =>
    entries.map((entry) => (
      <CommandItem
        key={entry.id}
        value={entry.label}
        keywords={[entry.id, entry.url]}
        disabled={entry.disabled}
        onSelect={() => handleSelect(entry)}
      >
        {entry.icon ? <entry.icon aria-hidden="true" /> : null}
        <span className="truncate">{entry.label}</span>
        <CommandShortcut className="tracking-normal">{entry.url}</CommandShortcut>
      </CommandItem>
    ));

  const filteredActions = filterEntries(ACTIONS, query);
  const navGroups = NAV_GROUPS.map((group) => ({ ...group, items: filterEntries(group.items, query) })).filter(
    (group) => group.items.length > 0,
  );
  const isEmpty = filteredActions.length === 0 && navGroups.length === 0;

  return (
    <>
      <Button
        ref={triggerRef}
        onClick={() => handleOpenChange(true)}
        variant="outline"
        aria-label="打开命令面板"
        aria-keyshortcuts="Control+k Meta+k"
        title={"命令面板（" + modifier + "+K）"}
        className="h-9 gap-2 rounded-full border-border/70 bg-card/70 px-3 font-normal text-muted-foreground shadow-none hover:border-primary/30 hover:bg-card hover:text-foreground max-sm:size-9 max-sm:px-0"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="hidden text-xs md:inline">搜索 / 跳转</span>
        <kbd className="pointer-events-none hidden items-center gap-0.5 rounded-md border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-flex">
          <span>{modifier}</span>
          <span>K</span>
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="命令面板"
        description="搜索页面与操作，使用上下方向键选择，按回车跳转。"
        className="top-1/2 -translate-y-1/2 sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <Command>
          <CommandInput placeholder="输入页面或操作名称…" value={query} onValueChange={setQuery} />
          <CommandList>
            {isEmpty ? <CommandEmpty>没有匹配的结果。</CommandEmpty> : null}
            {filteredActions.length > 0 ? (
              <CommandGroup heading="操作">{renderItems(filteredActions)}</CommandGroup>
            ) : null}
            {navGroups.map((group, index) => (
              <React.Fragment key={group.heading}>
                {filteredActions.length > 0 || index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={"跳转 · " + group.heading}>{renderItems(group.items)}</CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
