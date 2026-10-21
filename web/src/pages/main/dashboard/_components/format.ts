// 仪表盘内部共享的格式化与状态色：从 page.tsx 原样搬出，输出保持不变。

export function fmtRel(ts?: string | number): string {
  if (!ts) return "—";
  const ms = Date.now() - (typeof ts === "number" ? ts * 1000 : Date.parse(ts as string));
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s 前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m 前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h 前`;
  return `${Math.floor(h / 24)}d 前`;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  root_domain: "根域名",
  ip: "IP",
  subdomain: "子域名",
  app: "应用",
  service: "服务",
  endpoint: "端点",
};

export const ASSET_COLORS: Record<string, string> = {
  root_domain: "bg-blue-500",
  ip: "bg-indigo-400",
  subdomain: "bg-violet-500",
  app: "bg-orange-400",
  service: "bg-cyan-500",
  endpoint: "bg-emerald-500",
};

export function statusColor(code: number): string {
  if (code < 300) return "text-emerald-500";
  if (code < 400) return "text-blue-400";
  if (code < 500) return "text-amber-400";
  return "text-red-400";
}

export function statusBg(code: number): string {
  if (code < 300) return "bg-emerald-500";
  if (code < 400) return "bg-blue-400";
  if (code < 500) return "bg-amber-400";
  return "bg-red-400";
}
