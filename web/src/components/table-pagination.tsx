import { useEffect, useRef } from "react";
import { Button, ListBox, Pagination, Select } from "@heroui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
interface TablePaginationProps {
    page: number; // 1-based
    pageSize: number;
    total: number; // total (after filtering)
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
    pageSizeOptions?: number[];
}
function pageWindows(page: number, total: number): (number | "...")[] {
    if (total <= 7)
        return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | "...")[] = [1];
    if (page > 3)
        out.push("...");
    const lo = Math.max(2, page - 1);
    const hi = Math.min(total - 1, page + 1);
    for (let i = lo; i <= hi; i++)
        out.push(i);
    if (page < total - 2)
        out.push("...");
    out.push(total);
    return out;
}
export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [10, 20, 50, 100], }: TablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, total);
    const onPageChangeRef = useRef(onPageChange);
    onPageChangeRef.current = onPageChange;
    useEffect(() => {
        if (page !== safePage)
            onPageChangeRef.current(safePage);
    }, [page, safePage]);
    return (<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 lg:px-6">
      <div className="text-muted flex items-center gap-2 text-xs">
        <Select selectedKey={String(pageSize)} className="w-20" aria-label="每页显示条数" onSelectionChange={(key) => {
            if (key !== null)
                ((key) => key && onPageSizeChange(Number(key)))(String(key));
        }}>
          <Select.Trigger className="h-7 text-xs">
            <Select.Value />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {pageSizeOptions.map((s) => (<ListBox.Item key={s} id={String(s)} textValue={String(s)}>
                  {s}
                </ListBox.Item>))}
            </ListBox>
          </Select.Popover>
        </Select>
        <span>条/页</span>
        {total > 0 ? (<span className="tabular-nums">
            {from}–{to} / 共 {total} 条
          </span>) : (<span>共 0 条</span>)}
      </div>

      {totalPages > 1 && (<Pagination className="mx-0 w-auto justify-end">
          <Pagination.Content className="flex items-center gap-1">
            <Pagination.Item>
              <Button size="sm" isIconOnly isDisabled={safePage === 1} onPress={() => onPageChange(safePage - 1)} aria-label="上一页" variant={"ghost"}>
                <ChevronLeftIcon className="size-4"/>
              </Button>
            </Pagination.Item>
            {pageWindows(safePage, totalPages).map((p, i) => p === "..." ? (<Pagination.Item key={`el-${i}`}>
                  <Pagination.Ellipsis />
                </Pagination.Item>) : (<Pagination.Item key={p}>
                  <Button size="sm" isIconOnly className="min-w-8 h-8 text-xs" onPress={() => onPageChange(p)} aria-current={p === safePage ? "page" : undefined} variant={p === safePage ? "outline" : "ghost"}>
                    {p}
                  </Button>
                </Pagination.Item>))}
            <Pagination.Item>
              <Button size="sm" isIconOnly isDisabled={safePage === totalPages} onPress={() => onPageChange(safePage + 1)} aria-label="下一页" variant={"ghost"}>
                <ChevronRightIcon className="size-4"/>
              </Button>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>)}
    </div>);
}
