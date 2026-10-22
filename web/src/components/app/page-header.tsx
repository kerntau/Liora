import { type ReactNode } from "react";

import { ArrowLeftIcon, type LucideIcon } from "lucide-react";

import Link from "@/lib/router-compat";
import { META_TEXT_CLASS, PAGE_DESC_CLASS, PAGE_TITLE_CLASS } from "@/lib/typography";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
 * meta 分隔符：全站唯一口径
 * ────────────────────────────────────────────────────────────────────────────
 * 旧写法是页面自己在 JSX 里手搓 `<span>·</span>`：容器 gap 不同（gap-x-2 / gap-x-3）、
 * 圆点颜色不同（text-border 在浅色下几乎不可见），于是同一条 meta 行看起来
 * 「间距忽宽忽窄」，深色下还几乎看不见分隔。任务详情页更混用了 `|`。
 *
 * 现在统一为：
 *   - 分隔符 = 1px × 12px 竖线，颜色 muted-foreground/25（浅色/深色都可见但克制）；
 *   - 分隔符左右各恒定 8px（gap-x-2），不依赖字形左右边距，所以不会「忽宽忽窄」；
 *   - 12px 文字行高 20px 中线对齐；换行时「条目 + 自己的分隔符」作为一组整体换行，
 *     不会出现行首孤立的分隔符。
 *
 * 用法（页面直接调用，不要再手写分隔符）：
 *
 *   // 1) 最常用：数组交给 PageHeader，自动套 MetaItems
 *   <PageHeader title="Agent 管理" meta={[`${n} 个 Agent`, `内置 ${b}`, `自定义 ${c}`]} />
 *
 *   // 2) 显式写法（需要富节点、图标、徽章时）
 *   <PageHeader
 *     title="系统日志"
 *     meta={
 *       <MetaItems
 *         items={[
 *           <span className="tabular-nums">{total} 条</span>,
 *           <span className="inline-flex items-center gap-1">
 *             <ClockIcon className="size-3" aria-hidden="true" /> 实时
 *           </span>,
 *         ]}
 *       />
 *     }
 *   />
 *
 *   // 3) 页面内其它 meta 行（不走 PageHeader，例如详情页的自定义头部）
 *   <MetaItems items={[`创建 ${day}`, `最近活动 ${time}`]} />
 *
 *   // 4) 相邻是胶囊/徽章、加竖线反而更脏时：divider="none"（只保留 8px 间距）
 *   <MetaItems divider="none" items={[<StatusBadge ... />, <Badge ... />]} />
 *
 * 数组里传 null / undefined / false / "" 会被自动跳过（条件项不用自己拼）。
 * ──────────────────────────────────────────────────────────────────────────── */

/** meta 分隔符。默认 1px 竖线；divider="dot" 时退回统一的「·」（同样左右各 8px）。 */
export function MetaSeparator({
  variant = "line",
  className,
}: {
  variant?: "line" | "dot";
  className?: string;
}) {
  if (variant === "dot") {
    return (
      <span
        aria-hidden="true"
        className={cn("shrink-0 select-none text-[12px] leading-none text-muted-foreground/40", className)}
      >
        ·
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-3 w-px shrink-0 align-middle rounded-full bg-muted-foreground/25", className)}
    />
  );
}

/** 一条 meta 行：条目之间自动插入恒定间距的分隔符（见文件顶部说明）。 */
export function MetaItems({
  items,
  divider = "line",
  className,
}: {
  items: ReactNode[];
  /** line（默认 1px 竖线）| dot（统一的 ·）| none（只有 8px 间距，适合徽章/胶囊相邻）。 */
  divider?: "line" | "dot" | "none";
  className?: string;
}) {
  const visible = items.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  if (visible.length === 0) return null;
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", META_TEXT_CLASS, className)}>
      {visible.map((item, index) => (
        <span key={index} className="inline-flex min-w-0 items-center gap-x-2">
          <span className="inline-flex min-w-0 items-center">{item}</span>
          {divider !== "none" && index < visible.length - 1 ? <MetaSeparator variant={divider} /> : null}
        </span>
      ))}
    </span>
  );
}

export type PageHeaderProps = {
  /** 页面图标（16px，落在 36px/40px 的浅色圆角方块里）。 */
  icon?: LucideIcon;
  /**
   * 兼容旧调用保留：REFINE-SPEC 规定一级页不再显示面包屑，
   * 该参数现在不会渲染任何内容（避免各页传入报错）。
   */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /**
   * 一行 meta。传数组时自动套 <MetaItems />（推荐），传单个节点则原样渲染。
   * 不要再在页面里手写 `·` 或 `|` 分隔符。
   */
  meta?: ReactNode | ReactNode[];
  actions?: ReactNode;
  className?: string;
  /**
   * 详情页唯一允许的导航：一条最简返回链接（如「← 返回任务列表」）。
   * 不传则不渲染任何面包屑/返回条。
   */
  backTo?: string;
  backLabel?: ReactNode;
};

/**
 * 全站统一的页头：图标 + 标题（20px/600）+ 一句描述 + 右侧操作。
 *
 * 不再渲染 eyebrow 面包屑（REFINE-SPEC 一.1）；详情页需要导航时只传 backTo，
 * 由组件渲染唯一一条「← 返回…」链接。
 *
 * 窄屏（≤640px）图标缩到 36px，给 20px 标题留出更多宽度；操作区换行后靠右对齐。
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  meta,
  actions,
  className,
  backTo,
  backLabel = "返回",
}: PageHeaderProps) {
  // 数组里可能全是条件项（null/false），过滤后为空时连 mt-2 的容器都不要渲染，避免头部多出 8px 空档。
  const metaNode = Array.isArray(meta) ? <MetaItems items={meta} /> : meta;
  const hasMeta = Array.isArray(meta)
    ? meta.some((item) => item !== null && item !== undefined && item !== false && item !== "")
    : Boolean(meta);
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10 sm:size-10 sm:rounded-xl">
            <Icon className="size-4 sm:size-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="min-w-0">
          {backTo ? (
            <Link
              prefetch={false}
              href={backTo}
              className="mb-1 inline-flex items-center gap-1 rounded-sm text-[12px] leading-5 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              {backLabel}
            </Link>
          ) : null}
          <h1 className={cn("truncate", PAGE_TITLE_CLASS)}>{title}</h1>
          {description ? <p className={cn("mt-1", PAGE_DESC_CLASS)}>{description}</p> : null}
          {hasMeta ? (
            <div className={cn("mt-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1", META_TEXT_CLASS)}>
              {metaNode}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export {
  BODY_TEXT_CLASS,
  META_TEXT_CLASS,
  NUMERIC_CLASS,
  PAGE_DESC_CLASS,
  PAGE_STACK_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_TITLE_CLASS,
  TOOLBAR_CLASS,
  uiText,
} from "@/lib/typography";
