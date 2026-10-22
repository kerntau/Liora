"use client";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** 导出范围:当前筛选 / 全部 / 勾选项。 */
export type ExportScope = "filtered" | "all" | "selected";

/** 导出格式:md 单文件 / md 分文件 zip / csv / json。 */
export type ExportFormat = "md-single" | "md-zip" | "csv" | "json";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: ExportScope;
  onScopeChange: (scope: ExportScope) => void;
  format: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  /** 「当前筛选」口径下的条数:平铺/资产视图取列表总数,分组视图取组接口的 finding_total。 */
  filteredTotal: number;
  /** 跨页勾选的条数;为 0 时「导出勾选」不可选。 */
  selectedCount: number;
  exporting: boolean;
  onExport: () => void;
}

// ExportDialog 只负责「范围 × 格式」的选择与提交按钮,真正的导出请求由页面发起。
export function ExportDialog({
  open,
  onOpenChange,
  scope,
  onScopeChange,
  format,
  onFormatChange,
  filteredTotal,
  selectedCount,
  exporting,
  onExport,
}: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent busy={exporting}>
        <DialogHeader>
          <DialogTitle>导出发现</DialogTitle>
          <DialogDescription>选择导出范围与格式,生成后浏览器会自动下载。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">导出范围</span>
            <RadioGroup value={scope} onValueChange={(v) => onScopeChange(v as ExportScope)}>
              <label htmlFor="export-scope-filtered" className="flex items-center gap-2 text-sm">
                <RadioGroupItem id="export-scope-filtered" value="filtered" /> 导出当前筛选结果（共 {filteredTotal} 条）
              </label>
              <label htmlFor="export-scope-all" className="flex items-center gap-2 text-sm">
                <RadioGroupItem id="export-scope-all" value="all" /> 导出全部
              </label>
              <label
                htmlFor="export-scope-selected"
                className={cn("flex items-center gap-2 text-sm", selectedCount === 0 && "text-muted-foreground")}
              >
                <RadioGroupItem id="export-scope-selected" value="selected" disabled={selectedCount === 0} />
                导出勾选的 {selectedCount} 条
              </label>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">导出格式</span>
            <RadioGroup value={format} onValueChange={(v) => onFormatChange(v as ExportFormat)}>
              <label htmlFor="export-format-md-single" className="flex items-center gap-2 text-sm">
                <RadioGroupItem id="export-format-md-single" value="md-single" /> Markdown 汇总报告（单个 .md 文件）
              </label>
              <label htmlFor="export-format-md-zip" className="flex items-center gap-2 text-sm">
                <RadioGroupItem id="export-format-md-zip" value="md-zip" /> Markdown 分文件（一漏洞一 .md，打包 .zip）
              </label>
              <label htmlFor="export-format-csv" className="flex items-center gap-2 text-sm">
                <RadioGroupItem id="export-format-csv" value="csv" /> CSV 表格（.csv）
              </label>
              <label htmlFor="export-format-json" className="flex items-center gap-2 text-sm">
                <RadioGroupItem id="export-format-json" value="json" /> JSON（.json）
              </label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            取消
          </Button>
          <Button onClick={onExport} disabled={exporting || (scope === "selected" && selectedCount === 0)}>
            <DownloadIcon /> {exporting ? "导出中…" : "导出"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
