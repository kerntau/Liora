"use client";

import * as React from "react";

import { useRouter } from "@/lib/router-compat";

import { Search } from "lucide-react";

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
} from "@/components/ui/command";
import type { NavMainItem } from "@/navigation/sidebar/sidebar-items";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

type SearchItem = {
  id: string;
  group: string;
  label: string;
  url: string;
  icon?: NavMainItem["icon"];
  disabled?: boolean;
  newTab?: boolean;
};

const sidebarGroupLabels = new Set(sidebarItems.flatMap((group) => (group.label ? [group.label] : [])));

function getSubItemGroup(groupLabel: string | undefined, itemTitle: string) {
  return sidebarGroupLabels.has(itemTitle) ? (groupLabel ?? "其他") : itemTitle;
}

const searchItems: SearchItem[] = sidebarItems.flatMap((group) =>
  group.items.flatMap((item) => {
    if (item.subItems) {
      return item.subItems.map((sub) => ({
        id: sub.id,
        group: getSubItemGroup(group.label, item.title),
        label: sub.title,
        url: sub.url,
        icon: item.icon,
        disabled: sub.disabled,
        newTab: sub.newTab,
      }));
    }
    return [
      {
        id: item.id,
        group: group.label ?? "其他",
        label: item.title,
        url: item.url,
        icon: item.icon,
        disabled: item.disabled,
        newTab: item.newTab,
      },
    ];
  }),
);

function getAvailableItems(items: SearchItem[]) {
  return items.filter((item) => !item.disabled && !item.url.includes("coming-soon"));
}

const recommendations = getAvailableItems(searchItems);

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((item) => item.group))];
  return groups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));
}

export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [shortcutModifier, setShortcutModifier] = React.useState("Ctrl");
  const router = useRouter();

  const handleOpenChange = React.useCallback((value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  }, []);

  React.useEffect(() => {
    setShortcutModifier(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl");
    const down = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "j" &&
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

  const handleSelect = (item: SearchItem) => {
    if (item.disabled) return;
    handleOpenChange(false);
    if (item.newTab) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.url);
    }
  };

  const renderGroups = (items: SearchItem[]) =>
    groupBy(
      items.filter((item) =>
        query
          .normalize("NFKC")
          .trim()
          .toLocaleLowerCase()
          .split(/\s+/)
          .every((part) =>
            `${item.group} ${item.label} ${item.id} ${item.url}`.normalize("NFKC").toLocaleLowerCase().includes(part),
          ),
      ),
    ).map(({ group, items: groupItems }, index) => (
      <React.Fragment key={group}>
        {index > 0 && <CommandSeparator />}
        <CommandGroup heading={group}>
          {groupItems.map((item) => (
            <CommandItem
              disabled={item.disabled}
              key={`${group}-${item.id}`}
              value={`${item.group} ${item.label}`}
              keywords={[item.id, item.url]}
              onSelect={() => handleSelect(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && <item.icon aria-hidden="true" />}
                <span className="truncate">{item.label}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </React.Fragment>
    ));

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        variant="link"
        aria-label="搜索页面"
        aria-keyshortcuts="Control+j Meta+j"
        title={`搜索页面（${shortcutModifier}+J）`}
        className="px-0! font-normal text-muted-foreground hover:no-underline max-sm:size-11"
      >
        <Search data-icon="inline-start" aria-hidden="true" />
        <span className="hidden sm:inline">搜索页面</span>
        <kbd
          aria-hidden="true"
          className="hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px] md:inline-flex"
        >
          <span className="text-xs">{shortcutModifier}</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <Command>
          <CommandInput placeholder="搜索任务、资产、漏洞和设置…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>没有匹配的页面。</CommandEmpty>
            {renderGroups(recommendations)}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
