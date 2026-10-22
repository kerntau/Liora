import { cn } from "@/lib/utils";
import {
  statusMeta,
  toneClasses,
  toneDot,
  type StatusDomain,
  type Tone,
} from "@/lib/status";

// toneClasses 的 600 档在浅色背景上只有约 3:1（amber / emerald / teal），而徽章是
// 11px 小字，需要 4.5:1。浅色下统一压深一档，深色保持原来的高亮色。
const lightToneText: Partial<Record<Tone, string>> = {
  amber: "text-amber-700 dark:text-amber-400",
  green: "text-emerald-700 dark:text-emerald-400",
  teal: "text-teal-700 dark:text-teal-300",
};

export function StatusBadge({
  domain,
  value,
  dot = false,
  className,
}: {
  domain: StatusDomain;
  value: string;
  dot?: boolean;
  className?: string;
}) {
  const meta = statusMeta(domain, value);
  // 运行中/进行中的实时状态点加呼吸动效，其余状态保持静态。
  const breathing = dot && meta.tone === "blue";
  return (
    <span
      className={cn(
        // 与 Badge 统一为 20px 胶囊：状态徽章出现在标题行、元信息行和表格里，
        // 高度不一致会让同一行的文字基线互相错位。
        "inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] leading-none font-semibold whitespace-nowrap tabular-nums",
        toneClasses[meta.tone],
        lightToneText[meta.tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            toneDot[meta.tone],
            breathing && "animate-breathe",
          )}
        />
      )}
      {meta.label}
    </span>
  );
}
