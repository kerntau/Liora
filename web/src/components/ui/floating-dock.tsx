"use client";

import * as React from "react";

import { MenuIcon, type LucideIcon, XIcon } from "lucide-react";

import Link, { usePathname } from "@/lib/router-compat";

import { cn } from "@/lib/utils";

export interface FloatingDockItem {
  /** 展示名：同时作为图标 tooltip 与无障碍名。 */
  title: string;
  /**
   * lucide-react 图标组件本身（不是 JSX 节点）。
   * 这样导航数据可以放在 .ts 文件里，尺寸/颜色交给渲染层决定。
   */
  icon: LucideIcon;
  href: string;
  /** 分组键：相邻两项的 groupKey 不同时，中间插一条竖线。 */
  groupKey?: string;
  /** 分组名：桌面端 hover 分隔线时淡入，移动端常显。 */
  groupLabel?: string;
}

interface DockGroup {
  key: string;
  label?: string;
  entries: { item: FloatingDockItem; index: number }[];
}

/** 按 groupKey 切段；组名取该组第一个带 groupLabel 的条目（数据里不必每项重复）。 */
function splitByGroup(items: FloatingDockItem[]): DockGroup[] {
  const groups: DockGroup[] = [];
  items.forEach((item, index) => {
    const key = item.groupKey ?? "";
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.entries.push({ item, index });
      current.label ??= item.groupLabel;
      return;
    }
    groups.push({ key, label: item.groupLabel, entries: [{ item, index }] });
  });
  return groups;
}

/** 静态导出开了 trailingSlash，列表页 pathname 带尾斜杠；统一去掉再比对。 */
function normalizePath(pathname: string) {
  const decoded = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();
  return decoded.replace(/\/+$/, "") || "/";
}

/**
 * 当前高亮项。
 *
 * dock 里同时存在 `/system/intercept` 与 `/system/intercept/approvals`：
 * 只按 startsWith 判断，父路由在子页上也会亮，出现两个图标一起高亮。
 * 这里只保留「匹配得最长」的那一条，父路由自然让位给子路由。
 */
function resolveActiveHref(pathname: string, items: FloatingDockItem[]): string | null {
  const path = normalizePath(pathname);
  let best: string | null = null;
  for (const item of items) {
    const href = normalizePath(item.href);
    const matched = path === href || path.startsWith(href + "/");
    if (matched && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/** 固定尺寸的图标与底块，悬停只做 2px 上浮，避免线条与玻璃边缘因缩放发虚。 */
function DockIcon({ item, active }: { item: FloatingDockItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-label={item.title}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative z-0 flex size-10 shrink-0 items-center justify-center rounded-[12px] outline-none",
        "transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5",
        "focus-visible:ring-2 focus-visible:ring-ring/45 hover:z-30 focus-visible:z-30",
      )}
    >
      <span
        aria-hidden="true"
        data-active={active ? "true" : undefined}
        className="dock-tile absolute inset-0 rounded-[12px] transition-[background,border-color,box-shadow] duration-200 ease-out"
      />

      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className={cn(
          "relative size-5 transition-colors duration-200 ease-out",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />

      {active ? (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 z-10 size-[3px] -translate-x-1/2 rounded-full bg-primary"
        />
      ) : null}

      {/*
        提示气泡与 Dock 使用同一套玻璃材质；轻微上浮，不抢夺图标焦点。
      */}
      <span
        className={cn(
          "dock-tooltip pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 rounded-lg px-2.5 py-1 text-[11px] font-medium whitespace-nowrap opacity-0",
          "transition-all duration-150 ease-out",
          "group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
        )}
      >
        {item.title}
      </span>
    </Link>
  );
}

/** 轻量分隔线；组名只在悬停时淡入，保持 Dock 的紧凑轮廓。 */
function GroupDivider({ label }: { label?: string }) {
  return (
    <span
      aria-hidden="true"
      className="group/divider relative z-10 flex h-10 shrink-0 items-center justify-center px-1 hover:z-30"
    >
      <span className="dock-divider h-4 w-px rounded-full" />
      {label ? (
        <span
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 translate-y-1 rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground opacity-0 shadow-[var(--shadow-raised)]",
            "transition-all duration-150 ease-out",
            "group-hover/divider:translate-y-0 group-hover/divider:opacity-100",
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

function MobileDockLink({
  item,
  active,
  onNavigate,
}: {
  item: FloatingDockItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.title}</span>
      {active ? <span aria-hidden="true" className="ml-auto size-1 shrink-0 rounded-full bg-primary" /> : null}
    </Link>
  );
}

/**
 * 移动端（<md）：dock 横条不出现，改成右下角一个圆形按钮，
 * 点开向上弹出竖排列表——手机上一排 13 个图标挤在 375px 里没法点。
 * 竖排列表保留分组（用带组名的横线切段），桌面端靠 hover 才能看到的组名这里直接常显。
 */
function FloatingDockMobile({
  groups,
  activeHref,
}: {
  groups: DockGroup[];
  activeHref: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // 跳页后自动收起：这个浮层盖在正文上，跳完还留着比不弹更烦人。
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="fixed right-4 bottom-4 z-50 md:hidden">
      <div
        id="floating-dock-mobile-panel"
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "dock-glass absolute right-0 bottom-full mb-3 w-60 origin-bottom-right rounded-xl p-1.5",
          "transition-all duration-200 ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0",
        )}
      >
        <div className="max-h-[min(70dvh,26rem)] overflow-y-auto overscroll-contain">
          {groups.map((group, groupIndex) => (
            <React.Fragment key={group.key || `dock-group-${groupIndex}`}>
              {groupIndex > 0 ? (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className="h-px flex-1 bg-border/70" />
                  {group.label ? (
                    <span className="text-[10px] font-medium whitespace-nowrap text-muted-foreground">
                      {group.label}
                    </span>
                  ) : null}
                  <span className="h-px flex-1 bg-border/70" />
                </div>
              ) : null}
              {group.entries.map(({ item }) => (
                <MobileDockLink
                  key={item.href}
                  item={item}
                  active={normalizePath(item.href) === activeHref}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="floating-dock-mobile-panel"
        aria-label={open ? "收起导航" : "展开导航"}
        className="dock-glass grid size-12 place-items-center rounded-full text-foreground transition-transform active:scale-95"
      >
        <MenuIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-all duration-200",
            open ? "scale-50 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <XIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-all duration-200",
            open ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
      </button>
    </div>
  );
}

/** 底部浮动玻璃 Dock：固定图标比例、轻量悬停反馈，不引入逐帧鼠标计算。 */
export function FloatingDock({ items, className }: { items: FloatingDockItem[]; className?: string }) {
  const pathname = usePathname();
  const activeHref = React.useMemo(() => resolveActiveHref(pathname, items), [pathname, items]);
  const groups = React.useMemo(() => splitByGroup(items), [items]);

  return (
    <>
      {/* 桌面端：底部居中的胶囊横条。hidden/md:block 而不是 JS 断点，首帧就不会闪。
          40px 点击格子 + 6px 内边距，保持紧凑且清晰的连续轮廓。 */}
      <nav
        aria-label="主导航"
        className={cn("fixed bottom-4 left-1/2 z-50 hidden -translate-x-1/2 md:block", className)}
      >
        <div className="dock-glass flex items-center gap-0.5 rounded-[14px] px-1.5 py-1.5">
          {groups.map((group, groupIndex) => (
            <React.Fragment key={group.key || `dock-group-${groupIndex}`}>
              {groupIndex > 0 ? <GroupDivider label={group.label} /> : null}
              {group.entries.map(({ item }) => (
                <DockIcon key={item.href} item={item} active={normalizePath(item.href) === activeHref} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </nav>

      <FloatingDockMobile groups={groups} activeHref={activeHref} />
    </>
  );
}
