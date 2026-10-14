// Centralised status → HeroUI Chip semantics (color / variant), reused across the whole app.
// Spec: intent / task / severity / finding / engine / goal / audit / node 8 domains.
export type ChipColor = "default" | "accent" | "success" | "warning" | "danger";
export type ChipVariant = "primary" | "soft" | "secondary" | "tertiary";
export type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "rose" | "violet" | "slate";
export const toneDot: Record<Tone, string> = {
  neutral: "bg-muted",
  blue: "bg-accent",
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-danger",
  rose: "bg-danger",
  violet: "bg-accent",
  slate: "bg-muted",
};
export const toneClasses: Record<Tone, string> = {
  neutral: "bg-default text-default-foreground border-transparent",
  blue: "bg-accent-soft text-accent-soft-foreground border-accent/20",
  green: "bg-success-soft text-success-soft-foreground border-success/20",
  amber: "bg-warning-soft text-warning-soft-foreground border-warning/20",
  red: "bg-danger-soft text-danger-soft-foreground border-danger/20",
  rose: "bg-danger text-danger-foreground border-danger",
  violet: "bg-accent-soft text-accent-soft-foreground border-accent/20",
  slate: "bg-default text-default-foreground border-border",
};
export interface StatusMeta {
  label: string;
  color: ChipColor;
  variant: ChipVariant;
  tone: Tone;
}
const intent: Record<string, StatusMeta> = {
  open: { label: "待领", color: "default", variant: "soft", tone: "slate" },
  running: { label: "执行中", color: "accent", variant: "soft", tone: "blue" },
  paused: { label: "已暂停", color: "warning", variant: "soft", tone: "amber" },
  done: { label: "已完成", color: "success", variant: "soft", tone: "green" },
  blocked: { label: "执行出错", color: "danger", variant: "soft", tone: "red" },
  exhausted: { label: "预算耗尽", color: "accent", variant: "secondary", tone: "violet" },
  stopped: { label: "已停止", color: "default", variant: "secondary", tone: "slate" },
  deleted: { label: "已删除", color: "default", variant: "secondary", tone: "slate" },
};
const task: Record<string, StatusMeta> = {
  created: { label: "已创建", color: "default", variant: "soft", tone: "slate" },
  queued: { label: "排队中", color: "warning", variant: "soft", tone: "amber" },
  running: { label: "运行中", color: "accent", variant: "soft", tone: "blue" },
  paused: { label: "已暂停", color: "warning", variant: "soft", tone: "amber" },
  done: { label: "已完成", color: "success", variant: "soft", tone: "green" },
  failed: { label: "失败", color: "danger", variant: "soft", tone: "red" },
  timeout: { label: "已超时", color: "warning", variant: "soft", tone: "amber" },
};
const severity: Record<string, StatusMeta> = {
  critical: { label: "严重", color: "danger", variant: "primary", tone: "rose" },
  high: { label: "高危", color: "danger", variant: "soft", tone: "red" },
  medium: { label: "中危", color: "warning", variant: "soft", tone: "amber" },
  low: { label: "低危", color: "default", variant: "soft", tone: "slate" },
};
const finding: Record<string, StatusMeta> = {
  pending: { label: "待处理", color: "warning", variant: "soft", tone: "amber" },
  in_progress: { label: "处理中", color: "accent", variant: "soft", tone: "blue" },
  confirmed: { label: "已确认", color: "danger", variant: "soft", tone: "red" },
  resolved: { label: "已处理", color: "success", variant: "soft", tone: "green" },
  fixed: { label: "已修复", color: "success", variant: "soft", tone: "green" },
  false_positive: { label: "误报", color: "default", variant: "secondary", tone: "slate" },
  ignored: { label: "忽略", color: "default", variant: "secondary", tone: "neutral" },
  duplicate: { label: "重复", color: "default", variant: "secondary", tone: "neutral" },
  risk_accepted: { label: "风险接受", color: "accent", variant: "secondary", tone: "violet" },
};
const engine: Record<string, StatusMeta> = {
  exploring: { label: "探索中", color: "accent", variant: "soft", tone: "blue" },
  paused: { label: "已暂停", color: "warning", variant: "soft", tone: "amber" },
  stalled: { label: "停滞", color: "danger", variant: "soft", tone: "red" },
  idle: { label: "空闲", color: "default", variant: "soft", tone: "neutral" },
};
const goal: Record<string, StatusMeta> = {
  open: { label: "进行中", color: "accent", variant: "soft", tone: "blue" },
  met: { label: "已达成", color: "success", variant: "soft", tone: "green" },
  abandoned: { label: "已放弃", color: "default", variant: "secondary", tone: "slate" },
};
const audit: Record<string, StatusMeta> = {
  allow: { label: "放行", color: "success", variant: "soft", tone: "green" },
  block: { label: "拦截", color: "danger", variant: "soft", tone: "red" },
};
const node: Record<string, StatusMeta> = {
  observed: { label: "观测", color: "default", variant: "soft", tone: "slate" },
  confirmed: { label: "确认", color: "success", variant: "soft", tone: "green" },
  tombstoned: { label: "废弃", color: "default", variant: "secondary", tone: "neutral" },
};
const maps = {
  intent,
  task,
  severity,
  finding,
  engine,
  goal,
  audit,
  node,
} as const;
export type StatusDomain = keyof typeof maps;
export function statusMeta(domain: StatusDomain, key: string): StatusMeta {
  return maps[domain][key] ?? { label: key, color: "default", variant: "soft", tone: "neutral" };
}
