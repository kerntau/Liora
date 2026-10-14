import * as React from "react";
import { Button, Tooltip } from "@heroui/react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, copyText } from "@/lib/utils";
type CopyButtonProps = {
    text: string | null | undefined;
    successMessage?: string;
    label?: React.ReactNode;
    size?: "sm" | "md" | "lg";
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
    className?: string;
};
export function CopyButton({ text, successMessage = "已复制", label, size = "sm", variant = "ghost", className, }: CopyButtonProps) {
    const [copied, setCopied] = React.useState(false);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(() => {
        return () => {
            if (timer.current)
                clearTimeout(timer.current);
        };
    }, []);
    async function handleCopy() {
        if (!text)
            return;
        const ok = await copyText(text);
        if (ok) {
            setCopied(true);
            toast.success(successMessage);
            if (timer.current)
                clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1500);
        }
        else {
            toast.error("复制失败，请手动选择文本复制");
        }
    }
    const isIconOnly = !label;
    const button = (<Button type="button" size={size} isIconOnly={isIconOnly} className={cn(className)} isDisabled={!text} onPress={handleCopy} aria-label={copied ? "已复制" : "复制"} variant={variant}>
      {copied ? <CheckIcon className="size-4 text-success"/> : <CopyIcon className="size-4"/>}
      {label && <span className="ml-1.5">{copied ? "已复制" : label}</span>}
    </Button>);
    return (<Tooltip>
      {button}
      <Tooltip.Content>{copied ? "已复制到剪贴板" : "复制到剪贴板"}</Tooltip.Content>
    </Tooltip>);
}
