"use client";

import { useEffect, useRef } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { MetaSeparator } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  page: number; // 1-based
  pageSize: number;
  total: number; // total (after filtering)
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  pageSizeOptions?: number[];
}

// pageWindows returns the sequence of page numbers / ellipsis to render.
function pageWindows(page: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  if (page > 3) out.push("...");
  const lo = Math.max(2, page - 1);
  const hi = Math.min(total - 1, page + 1);
  for (let i = lo; i <= hi; i++) out.push(i);
  if (page < total - 2) out.push("...");
  out.push(total);
  return out;
}

/**
 * Compact pagination bar that sits inside the same card as its table.
 * Order matches the console toolbar convention: page size → range/total on the
 * left, page controls on the right. Every control keeps its aria name because
 * the e2e suite drives the bar by role.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    if (page !== safePage) onPageChangeRef.current(safePage);
  }, [page, safePage]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 px-5 py-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger
            aria-label="每页数量"
            size="sm"
            className="h-7 w-[70px] rounded-lg bg-card text-xs tabular-nums"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="whitespace-nowrap">条/页</span>
        {/* 全站唯一分隔符（1px 竖线，左右各 8px 由行内 gap-2 提供），不再手写 · 或 |。 */}
        <MetaSeparator />
        {total > 0 ? (
          <span className="whitespace-nowrap tabular-nums">
            {from}–{to} / 共 <span className="font-medium text-foreground">{total}</span> 条
          </span>
        ) : (
          <span className="whitespace-nowrap">共 0 条</span>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination className="mx-0 ml-auto w-auto justify-end">
          <PaginationContent className="gap-1">
            <PaginationItem>
              <Button
                variant="outline"
                size="icon-sm"
                className="size-7 rounded-lg bg-card"
                disabled={safePage === 1}
                onClick={() => onPageChange(safePage - 1)}
                aria-label="上一页"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
            </PaginationItem>
            {pageWindows(safePage, totalPages).map((p, i) =>
              p === "..." ? (
                <PaginationItem key={`el-${i}`}>
                  <PaginationEllipsis className="size-7 text-muted-foreground" />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <Button
                    variant={p === safePage ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() => onPageChange(p)}
                    aria-current={p === safePage ? "page" : undefined}
                    className={cn(
                      "size-7 rounded-lg text-xs tabular-nums",
                      p === safePage
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </Button>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <Button
                variant="outline"
                size="icon-sm"
                className="size-7 rounded-lg bg-card"
                disabled={safePage === totalPages}
                onClick={() => onPageChange(safePage + 1)}
                aria-label="下一页"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
