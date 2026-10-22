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

/**
 * 放大动效参数。
 *
 * 关键取舍：只改 `transform: scale()`，**不改宽高**。
 * 参考实现（motion/react）动的是 width/height，dock 会随光标从 725px 长到 787px；
 * dock 又是 `left-1/2` 居中的，于是整条 dock 会左右滑动、光标底下的图标跟着跑。
 * 改成纯 transform 之后 dock 总宽恒定，图标以 origin-bottom 向上长，
 * 既不撑高容器，也不会把邻居推走。
 */
const MAX_SCALE = 1.7; // 20px 字形 → 最大 34px
const SCALE_REACH = 150; // 水平 ±150px 之外回到 1.0

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

/**
 * 单个图标：格子固定 40px、字形 20px。
 *
 * 视觉分三层（DOM 顺序 = 绘制顺序）：
 * 1. 底块层：绝对定位铺满 40px，**不参与 scale**。默认完全透明（.dock-tile），
 *    hover 才浮出一块极淡的圆角底（见 globals.css 末尾），激活态是 bg-primary/10
 *    —— 这样 13 个格子不再各自顶着浅灰方块，静止时整条 Dock 是连续的一整块。
 * 2. 字形层：只缩放 20px 的 SVG（origin-bottom）。放大到 34px 时向上长、底边不动，
 *    所以既不会长到 68px 顶出 Dock，也不会盖住下面 3px 处的激活点。
 * 3. 激活点：绝对定位、不参与布局，距字形底 3px。
 */
function DockIcon({ item, scale, active }: { item: FloatingDockItem; scale: number; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-label={item.title}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative z-0 flex size-10 shrink-0 items-center justify-center rounded-[10px] outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/45",
        // 放大后的字形会横向溢出格子：hover / 键盘聚焦时把整格提到最上层，
        // 邻居的图标和分隔线都不会压住它的 tooltip。
        "hover:z-30 focus-visible:z-30",
      )}
    >
      <span
        aria-hidden="true"
        data-active={active ? "true" : undefined}
        style={
          {
            // 底块相对 40px 基准的跟随变换：字形 20s 高、底边固定在格子 y=30，
            // 底块取「字形外扩 3px」→ 边长 20s+6，中心对齐字形中心。
            // scale = (20s+6)/40 = 0.5s+0.15；位移 = 字形中心 - 格子中心 = 10-10s。
            "--dock-tile-follow": `translateY(${(10 - 10 * scale).toFixed(2)}px) scale(${(0.5 * scale + 0.15).toFixed(3)})`,
          } as React.CSSProperties
        }
        className="dock-tile absolute inset-0 rounded-[10px] transition-[transform,background-color] duration-150 ease-out"
      />

      <Icon
        aria-hidden="true"
        style={{ transform: `scale(${scale})` }}
        className={cn(
          "relative size-5 origin-bottom transition-[transform,color] duration-150 ease-out will-change-transform",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />

      {active ? (
        <span
          aria-hidden="true"
          className="absolute bottom-[3px] left-1/2 z-10 size-1 -translate-x-1/2 rounded-full bg-primary"
        />
      ) : null}

      {/*
        tooltip 挂在 40px 格子上、离格子顶 12px：字形放大到 1.7 倍时最高只到格子顶上方 4px，
        所以气泡底边仍在它上方 8px，既贴得近又不会被放大后的图标压住。
      */}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 translate-y-1 rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-[var(--shadow-raised)]",
          "transition-all duration-150 ease-out",
          "group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
        )}
      >
        {item.title}
      </span>
    </Link>
  );
}

/**
 * 组间分隔线。
 *
 * 左右各 10px（px-2.5）内边距、竖线本体 20px 高：加上 flex 的 6px gap，
 * 两侧留白天然对称，不会一边贴死一边空荡。
 *
 * 组名做成 hover 才淡入、而不是常显：再塞一行常显组名会把条子顶高、
 * 并和放大后的图标打架。分隔线整格 h-10（与图标格同高）且 z-10，
 * 命中区 21px × 40px，光标停在竖线上时两侧图标还不会抢走 hover。
 */
function GroupDivider({ label }: { label?: string }) {
  return (
    <span
      aria-hidden="true"
      className="group/divider relative z-10 flex h-10 shrink-0 items-center justify-center px-2.5 hover:z-30"
    >
      <span className="h-5 w-px rounded-full bg-border" />
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
          "absolute right-0 bottom-full mb-3 w-60 origin-bottom-right rounded-2xl border border-border/60 bg-card/95 p-1.5 shadow-[var(--shadow-raised)] backdrop-blur-xl",
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
        className="relative grid size-12 place-items-center rounded-full border border-border/60 bg-card/95 text-foreground shadow-[var(--shadow-raised)] backdrop-blur-xl transition-colors active:bg-surface-muted"
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

/**
 * macOS 风格底部浮动 Dock。
 *
 * 动效全部走「React 状态 + CSS transition」，没有 motion/framer-motion：
 * - `onMouseMove` 只记录光标 X，真正的计算放在 requestAnimationFrame 里（每帧最多一次）；
 * - 每帧读一次各图标的「未 transform 的外层格子」矩形，按 `|光标X - 格子中心|` 线性映射成 scale；
 * - scale 通过内联 transform 下发，配合 `transition-transform duration-150 ease-out` 补间，
 *   所以即便每帧的离散值有跳变，视觉上也是连续的。
 */
export function FloatingDock({ items, className }: { items: FloatingDockItem[]; className?: string }) {
  const pathname = usePathname();
  const activeHref = React.useMemo(() => resolveActiveHref(pathname, items), [pathname, items]);
  const groups = React.useMemo(() => splitByGroup(items), [items]);

  const [scales, setScales] = React.useState<number[]>(() => items.map(() => 1));
  const itemRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const frameRef = React.useRef<number | null>(null);
  const pointerRef = React.useRef<number | null>(null);

  // ref 回调必须稳定：否则每帧重渲染都会先 detach 再 attach 一遍，白白多一轮 DOM 写入。
  const refSetters = React.useMemo(
    () =>
      items.map((_, index) => (element: HTMLSpanElement | null) => {
        itemRefs.current[index] = element;
      }),
    [items],
  );

  const commitScales = React.useCallback(
    (clientX: number | null) => {
      const next = items.map((_, index) => {
        const element = itemRefs.current[index];
        if (clientX === null || !element) return 1;
        // 量外层格子而不是内层图标：内层带 scale，用它算距离会自我反馈（越靠越近时抖动）。
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(clientX - (rect.left + rect.width / 2));
        if (distance >= SCALE_REACH) return 1;
        const scale = MAX_SCALE - ((MAX_SCALE - 1) * distance) / SCALE_REACH;
        return Math.round(scale * 1000) / 1000;
      });
      setScales((prev) =>
        prev.length === next.length && prev.every((value, index) => value === next[index]) ? prev : next,
      );
    },
    [items],
  );

  const handleMouseMove = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      pointerRef.current = event.clientX;
      // 一帧只算一次：mousemove 在高刷屏上可以比渲染还密，不节流就是纯浪费。
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        commitScales(pointerRef.current);
      });
    },
    [commitScales],
  );

  const handleMouseLeave = React.useCallback(() => {
    pointerRef.current = null;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    commitScales(null);
  }, [commitScales]);

  React.useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return (
    <>
      {/* 桌面端：底部居中的胶囊横条。hidden/md:block 而不是 JS 断点，首帧就不会闪。
          40px 格子 + py-2 → 总高 56px；内层不再有默认底块，整条是一条连续的 Dock。 */}
      <nav
        aria-label="主导航"
        className={cn("fixed bottom-4 left-1/2 z-50 hidden -translate-x-1/2 md:block", className)}
      >
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-card/95 px-2 py-2 shadow-[var(--shadow-raised)] backdrop-blur-xl"
        >
          {groups.map((group, groupIndex) => (
            <React.Fragment key={group.key || `dock-group-${groupIndex}`}>
              {groupIndex > 0 ? <GroupDivider label={group.label} /> : null}
              {group.entries.map(({ item, index }) => (
                <span key={item.href} ref={refSetters[index]} className="flex h-10 items-center">
                  <DockIcon
                    item={item}
                    scale={scales[index] ?? 1}
                    active={normalizePath(item.href) === activeHref}
                  />
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </nav>

      <FloatingDockMobile groups={groups} activeHref={activeHref} />
    </>
  );
}
