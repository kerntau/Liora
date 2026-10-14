import * as React from "react";
import { useNavigate } from "react-router";
import { Autocomplete, Button, ListBox, Modal, SearchField } from "@heroui/react";
import { Search } from "lucide-react";
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
const searchItems: SearchItem[] = sidebarItems.flatMap((group) => group.items.flatMap((item) => {
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
}));
function getAvailableItems(items: SearchItem[]) {
    return items.filter((item) => !item.disabled && !item.url.includes("coming-soon"));
}
const recommendations = getAvailableItems(searchItems);
export function SearchDialog() {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const navigate = useNavigate();
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);
    const handleOpenChange = (value: boolean) => {
        setOpen(value);
        if (!value)
            setQuery("");
    };
    const handleSelect = (item: SearchItem) => {
        if (item.disabled)
            return;
        handleOpenChange(false);
        if (item.newTab) {
            window.open(item.url, "_blank", "noopener,noreferrer");
        }
        else {
            navigate(item.url);
        }
    };
    const filteredItems = React.useMemo(() => {
        const list = query.trim() ? searchItems : recommendations;
        if (!query.trim())
            return list;
        const q = query.toLowerCase();
        return list.filter((item) => item.label.toLowerCase().includes(q) ||
            item.group.toLowerCase().includes(q) ||
            item.url.toLowerCase().includes(q));
    }, [query]);
    return (<>
      <Button size="sm" aria-label="搜索页面" onPress={() => handleOpenChange(true)} className="px-0 font-normal text-muted hover:text-foreground justify-start gap-2" variant={"ghost"}>
        <Search className="size-4"/>
        <span className="hidden md:inline">搜索页面</span>
        <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-surface-secondary px-1.5 font-medium text-[10px] text-muted">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>

      
        <Modal.Backdrop isOpen={open} onOpenChange={handleOpenChange}>
          <Modal.Container>
            <Modal.Dialog className="w-full max-w-lg p-4 bg-surface border border-border rounded-xl shadow-xl outline-none">
              <Modal.Heading className="sr-only">搜索页面</Modal.Heading>
              <Autocomplete.Filter inputValue={query} onInputChange={setQuery}>
                <SearchField aria-label="搜索页面" autoFocus>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="搜索任务、资产、漏洞和设置…"/>
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <ListBox aria-label="页面搜索结果" className="mt-3 max-h-72 overflow-y-auto" data-scrollbar="thin" items={filteredItems} renderEmptyState={() => <span className="p-4 text-muted">没有匹配的页面。</span>} onAction={(key) => {
            const item = filteredItems.find((item) => item.id === key);
            if (item)
                handleSelect(item);
        }}>
                  {(item) => (<ListBox.Item id={item.id} textValue={item.group + " " + item.label + " " + item.url}>
                      <span className="flex items-center gap-2">
                        {item.icon && <item.icon className="size-4"/>}
                        {item.label}
                      </span>
                      <span className="ml-auto text-muted text-xs">{item.group}</span>
                    </ListBox.Item>)}
                </ListBox>
              </Autocomplete.Filter>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      
    </>);
}
