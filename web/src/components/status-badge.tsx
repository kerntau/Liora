import { Chip } from "@heroui/react";
import { type StatusDomain, statusMeta, type Tone, toneDot } from "@/lib/status";
import { cn } from "@/lib/utils";
export function StatusBadge({ domain, value, dot = false, className, }: {
    domain: StatusDomain;
    value: string;
    dot?: boolean;
    className?: string;
}) {
    const meta = statusMeta(domain, value);
    return (<Chip size="sm" color={meta.color} className={cn("whitespace-nowrap", className)} variant={meta.variant}>
      {dot && (<span className={cn("mr-1 inline-block size-1.5 rounded-full shrink-0", meta.color === "danger" && meta.variant === "primary" ? "bg-white animate-pulse" : toneDot[meta.tone])}/>)}
      <Chip.Label>{meta.label}</Chip.Label>
    </Chip>);
}
export function ToneDot({ tone }: {
    tone: Tone;
}) {
    return <span className={cn("size-2 rounded-full", toneDot[tone])}/>;
}
