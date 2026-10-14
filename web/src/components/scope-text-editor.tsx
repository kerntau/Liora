import * as React from "react";
import Chip from "@mui/material/Chip";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { ParsedCompanyScopeText } from "@/lib/company-scope";
import type { CompanyScopeKind } from "@/lib/types";
const SCOPE_KIND_LABELS: Record<CompanyScopeKind, string> = { domain: "域名", ip: "IP", cidr: "CIDR", icp: "ICP", keyword: "关键词" };
export function ScopeTextEditor({ id, value, onValueChange, parsed, label = "资产范围", description = "每行一条，自动识别域名、IP、CIDR、ICP 备案和企业关键词。" }: { id: string; value: string; onValueChange: (value: string) => void; parsed: ParsedCompanyScopeText; label?: string; description?: string }) {
  const counts = React.useMemo(() => { const result = new Map<CompanyScopeKind, number>(); for (const rule of parsed.rules) result.set(rule.kind, (result.get(rule.kind) ?? 0) + 1); return result; }, [parsed.rules]);
  return <Stack spacing={1}><TextField id={id} label={label} helperText={description} value={value} onChange={(event) => onValueChange(event.target.value)} multiline rows={8} placeholder={"example.com\n203.0.113.10\n198.51.100.0/24\n京ICP备12345678号-1\n企业名称关键词"} fullWidth size="small" error={parsed.errors.length > 0} sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.85rem" } }} />{parsed.rules.length > 0 && <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75 }}><Typography variant="caption" color="text.secondary">已识别 {parsed.rules.length} 条</Typography>{Object.entries(SCOPE_KIND_LABELS).map(([kind, kindLabel]) => { const count = counts.get(kind as CompanyScopeKind) ?? 0; return count > 0 ? <Chip key={kind} size="small" label={`${kindLabel} ${count}`} variant="outlined" sx={{ fontFamily: "monospace", fontSize: "0.7rem" }} /> : null; })}</Stack>}{parsed.errors.length > 0 && <FormHelperText error>{parsed.errors.slice(0, 5).map((item) => <span key={`${item.line}-${item.error}`} className="block">第 {item.line} 行：{item.error}</span>)}{parsed.errors.length > 5 && <span className="block">另有 {parsed.errors.length - 5} 行错误</span>}</FormHelperText>}</Stack>;
}

