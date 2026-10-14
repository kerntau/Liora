import Chip from "@mui/material/Chip";
import type { ChipProps } from "@mui/material/Chip";
import { type StatusDomain, statusMeta, type Tone, toneDot } from "@/lib/status";
import { cn } from "@/lib/utils";
const colorMap: Record<string, ChipProps["color"]> = { default: "default", accent: "primary", success: "success", warning: "warning", danger: "error" };
export function StatusBadge({ domain, value, dot = false, className }: { domain: StatusDomain; value: string; dot?: boolean; className?: string }) {
  const meta = statusMeta(domain, value);
  return <Chip size="small" color={colorMap[meta.color] ?? "default"} variant={meta.variant === "primary" ? "filled" : "outlined"} className={cn("whitespace-nowrap", className)} label={<span className="inline-flex items-center">{dot && <span className={cn("mr-1 inline-block size-1.5 rounded-full shrink-0", toneDot[meta.tone])} />}{meta.label}</span>} sx={{ height: 24, fontSize: "0.72rem", borderRadius: 1.25, ...(meta.variant !== "primary" && { borderColor: "divider" }) }} />;
}
export function ToneDot({ tone }: { tone: Tone }) { return <span className={cn("size-2 rounded-full", toneDot[tone])} />; }
