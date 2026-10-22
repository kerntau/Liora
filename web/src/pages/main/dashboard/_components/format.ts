// 仪表盘内部共享的格式化与状态色：从 page.tsx 原样搬出，输出保持不变。

export function fmtRel(ts?: string | number): string {
  if (!ts) return "—";
  const ms = Date.now() - (typeof ts === "number" ? ts * 1000 : Date.parse(ts as string));
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s 前";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m 前";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h 前";
  return Math.floor(h / 24) + "d 前";
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

/** 计数展示：过千加千分位，保证同一指标在指挥台各卡片里口径一致。 */
export function fmtCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN");
}

/**
 * 缓存命中率（全站唯一口径）：input 已含缓存读，
 * 命中率 = 缓存读 ÷ 总输入。资源消耗卡的环与 Token 卡必须共用本函数。
 */
export function cacheHitRate(input: number, cacheRead: number): number {
  if (!Number.isFinite(input) || input <= 0) return 0;
  if (!Number.isFinite(cacheRead) || cacheRead <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((cacheRead / input) * 100)));
}

// ── 活动摘要清洗 ──────────────────────────────────────────────────────────────
// 后端 activity.summary 偶尔是原始工具输出（如 {"assets":null,"count":0}）。
// 时间线上只允许出现一句话摘要：JSON 取关键字段，长文本单行截断。

/** 单行摘要上限；完整内容由调用方通过 title 提供。 */
const SUMMARY_MAX = 88;

const COUNT_KEYS = ["count", "total", "length", "size"];

/** 常见字段名的中文名，避免把英文枚举直接铺到界面上。 */
const FIELD_LABELS: Record<string, string> = {
  assets: "资产",
  asset: "资产",
  findings: "发现",
  finding: "发现",
  items: "条目",
  item: "条目",
  results: "结果",
  result: "结果",
  data: "数据",
  rows: "行",
  nodes: "节点",
  edges: "边",
  tasks: "任务",
  task: "任务",
  traffic: "流量",
  sessions: "会话",
  logs: "日志",
  records: "记录",
  count: "数量",
  total: "总数",
  ok: "成功",
  success: "成功",
  error: "错误",
  message: "消息",
  method: "方法",
  url: "地址",
  host: "主机",
  path: "路径",
  status: "状态",
  code: "状态码",
  bytes: "大小",
  duration: "耗时",
};

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "空";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "string") return value.length > 32 ? value.slice(0, 32) + "…" : value;
  if (Array.isArray(value)) return value.length + " 项";
  return "…";
}

function jsonDigest(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // 被截断的 JSON 无法还原：退化成普通文本截断，至少不再露出半个大括号。
    return null;
  }
  if (Array.isArray(parsed)) return parsed.length === 0 ? "空结果" : parsed.length + " 条记录";
  if (!parsed || typeof parsed !== "object") return scalarText(parsed);
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return "空结果";

  const countEntry = entries.find(([key, value]) => COUNT_KEYS.includes(key) && typeof value === "number");
  // 优先挑「列表/空值」字段当主语，布尔开关不适合当数量标签。
  const labelEntry =
    entries.find(([key, value]) => !COUNT_KEYS.includes(key) && (value === null || Array.isArray(value))) ??
    entries.find(([key, value]) => !COUNT_KEYS.includes(key) && typeof value !== "boolean");

  if (countEntry && labelEntry) {
    const label = FIELD_LABELS[labelEntry[0]] ?? labelEntry[0];
    const size = Array.isArray(labelEntry[1]) ? labelEntry[1].length : Number(countEntry[1]);
    return label + " " + size + " 条";
  }
  return entries
    .slice(0, 3)
    .map(([key, value]) => (FIELD_LABELS[key] ?? key) + " " + scalarText(value))
    .join(" · ");
}

/**
 * 活动摘要清洗：JSON 只取关键字段拼成一句话，长文本压成单行并截断。
 * 例：{"assets":null,"count":0} → 「资产 0 条」。
 */
export function activitySummary(raw?: string): string {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "无摘要";
  const digest = /^[[{]/.test(text) ? jsonDigest(text) : null;
  const one = (digest ?? text).replace(/\s+/g, " ").trim();
  return one.length > SUMMARY_MAX ? one.slice(0, SUMMARY_MAX) + "…" : one;
}

export const ASSET_TYPE_LABELS: Record<string, string> = {
  root_domain: "根域名",
  domain: "域名",
  ip: "IP",
  subdomain: "子域名",
  app: "应用",
  service: "服务",
  endpoint: "端点",
  url: "URL",
  company: "企业",
  certificate: "证书",
  cert: "证书",
};

export const ASSET_COLORS: Record<string, string> = {
  root_domain: "bg-blue-500",
  domain: "bg-blue-500",
  ip: "bg-indigo-400",
  subdomain: "bg-violet-500",
  app: "bg-orange-400",
  service: "bg-cyan-500",
  endpoint: "bg-emerald-500",
  url: "bg-slate-400",
  company: "bg-sky-500",
  certificate: "bg-teal-500",
  cert: "bg-teal-500",
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
