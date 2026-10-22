// 资产单元格共享组件：全局资产页与任务「测试资产」页共用同一份实现，避免两处漂移。
//
// 注意：两页的 AssetCard 没有合并——它们的分页器、空态/加载态和多选列结构不同，
// 视觉结构也不同，因此各自保留在：
//   - web/src/pages/main/function/assets/page.tsx
//   - web/src/pages/main/function/tasks/detail/_tabs/assets-tab.tsx
//
// 两处旧实现的显示差异在这里显式保留：
//   - MethodBadge 的 className 顺序不同，渲染结果一致，取已排序的一份。
//   - Chips 在全局资产页被压到 10px（text-[10px]），任务资产页用 Badge 默认字号，
//     故保留 dense 开关，由调用方决定，不改变任一页的现有显示。

import { Badge } from "@/components/ui/badge";
import type { Asset } from "@/lib/types";
import { cn } from "@/lib/utils";

export const PAGE_SIZES = [25, 50, 100, 200];

// 浅色用 100/700 的柔和底，深色改用 15% 透明底 + 300 的文字，
// 否则深色下会出现一排刺眼的浅色小方块。
const METHOD_COLOR: Record<string, string> = {
  DELETE: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  HEAD: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  OPTIONS: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  PATCH: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

export function MethodBadge({ method }: { method: string }) {
  const normalized = method.toUpperCase();
  return (
    <span
      className={cn(
        "inline-block rounded-md px-1.5 py-0.5 font-mono font-semibold text-[11px] leading-none",
        METHOD_COLOR[normalized] ?? "bg-muted text-muted-foreground",
      )}
    >
      {normalized || "—"}
    </span>
  );
}

// 500/400 档在深色底上用 400 亮度才够清楚，浅色仍走 600。
export function statusTone(code: number) {
  if (code >= 500) return "text-red-600 dark:text-red-400";
  if (code >= 400) return "text-amber-600 dark:text-amber-400";
  if (code >= 300) return "text-blue-600 dark:text-blue-400";
  if (code >= 200) return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

export function Chips({
  items,
  mono,
  dense = false,
}: {
  items: string[];
  mono?: boolean;
  /** 全局资产页的表格更密，历史上把 chip 压到 10px；任务资产页保持 Badge 默认字号。 */
  dense?: boolean;
}) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {/* 按索引做 key：items 可能有重复标签（如接口参数都缺名称时的 "?"），用标签做 key 会撞 key。 */}
      {clean.map((item, i) => (
        <Badge key={i} variant="outline" className={cn(mono && "font-mono", dense && "text-[11px]")}>
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function firstText(values: Array<string | undefined>, fallback: string): string {
  return values.find((value) => value?.trim()) ?? fallback;
}

export function assetLabel(asset: Asset): string {
  switch (asset.type) {
    case "root_domain":
    case "subdomain":
      return firstText([asset.domain], `#${asset.id}`);
    case "ip":
      return firstText([asset.ip], `#${asset.id}`);
    case "app":
      return firstText([asset.app_name, asset.url], `#${asset.id}`);
    case "service": {
      const host = firstText([asset.ip, asset.domain], "");
      const address = [host, asset.port].filter((value) => value !== undefined && value !== "").join(":");
      return firstText([asset.url, address, asset.service_name], `#${asset.id}`);
    }
    case "endpoint":
      return firstText([[asset.method, asset.url].filter(Boolean).join(" ")], `#${asset.id}`);
  }
}
