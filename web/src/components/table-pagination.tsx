import { useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
interface TablePaginationProps { page: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void; pageSizeOptions?: number[]; }
export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [10, 20, 50, 100] }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize)); const safePage = Math.min(Math.max(1, page), totalPages); const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1; const to = Math.min(safePage * pageSize, total); const onPageChangeRef = useRef(onPageChange); onPageChangeRef.current = onPageChange;
  useEffect(() => { if (page !== safePage) onPageChangeRef.current(safePage); }, [page, safePage]);
  return <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: 1, borderTop: 1, borderColor: "divider", px: { xs: 2, lg: 3 }, py: 1 }}>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Select size="small" value={String(pageSize)} aria-label="每页显示条数" onChange={(event) => onPageSizeChange(Number(event.target.value))} sx={{ minWidth: 72, height: 30, fontSize: "0.75rem" }}>{pageSizeOptions.map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}</Select><Typography variant="caption" color="text.secondary">条/页</Typography><Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>{total > 0 ? `${from}–${to} / 共 ${total} 条` : "共 0 条"}</Typography></Box>
    {totalPages > 1 && <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}><IconButton size="small" disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)} aria-label="上一页"><ChevronLeftIcon size={16} /></IconButton><Pagination count={totalPages} page={safePage} onChange={(_, value) => onPageChange(value)} size="small" shape="rounded" sx={{ "& .MuiPaginationItem-root": { minWidth: 30, height: 30, fontSize: "0.75rem" } }} /><IconButton size="small" disabled={safePage === totalPages} onClick={() => onPageChange(safePage + 1)} aria-label="下一页"><ChevronRightIcon size={16} /></IconButton></Box>}
  </Box>;
}
