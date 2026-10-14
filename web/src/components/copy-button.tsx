import * as React from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, copyText } from "@/lib/utils";
type CopyButtonProps = { text: string | null | undefined; successMessage?: string; label?: React.ReactNode; size?: "sm" | "md" | "lg"; variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"; className?: string };
export function CopyButton({ text, successMessage = "已复制", label, size = "sm", variant = "ghost", className }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false); const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null); React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  async function handleCopy() { if (!text) return; if (await copyText(text)) { setCopied(true); toast.success(successMessage); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1500); } else toast.error("复制失败，请手动选择文本复制"); }
  const isIconOnly = !label; const muiVariant = variant === "primary" ? "contained" : variant === "outline" ? "outlined" : "text";
  return <Tooltip title={copied ? "已复制到剪贴板" : "复制到剪贴板"}><span><Button type="button" size={size === "md" ? "medium" : size === "lg" ? "large" : "small"} variant={muiVariant} color={variant === "danger" ? "error" : "primary"} className={cn(className)} disabled={!text} onClick={() => void handleCopy()} aria-label={copied ? "已复制" : "复制"} sx={isIconOnly ? { minWidth: 32, width: 32, px: 0 } : undefined}>{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}{label && <span className="ml-1.5">{copied ? "已复制" : label}</span>}</Button></span></Tooltip>;
}
