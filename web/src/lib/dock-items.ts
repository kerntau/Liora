import {
  Bot,
  Brain,
  Bug,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Network,
  Plug,
  ScrollText,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";

/**
 * 底部 Dock 的导航条目。
 *
 * 数据与 `@/navigation/sidebar/sidebar-items` 同源（同一批页面、同一批中文标题），
 * 但顺序按「日常使用频率」重排，并补齐侧栏里没有、只能从 ⌘K 到达的系统页
 * （Agent / Skills / 工具 / MCP）。图标一律取 lucide-react 组件本身而不是 JSX，
 * 这样本文件可以保持 .ts，渲染层再决定尺寸与颜色。
 *
 * 分组键只在每组第一项上带 groupLabel：Dock 渲染时按 groupKey 切段，
 * 分隔线取「它后面那一组」的组名（见 floating-dock.tsx 的 splitByGroup）。
 */
export interface DockNavItem {
  /** 展示名：同时作为图标 tooltip 与无障碍名。 */
  title: string;
  icon: LucideIcon;
  href: string;
  /** 分组键：相邻两项的 groupKey 不同时，在中间画一条竖线。 */
  groupKey?: string;
  /** 分组名：桌面端 hover 分隔线时淡入，移动端直接显示。 */
  groupLabel?: string;
}

/** 三组语义：功能（干活的地方）/ 运行管理（盯运行的地方）/ 系统配置（配环境的地方）。 */
export const DOCK_GROUPS = {
  feature: "功能",
  ops: "运行管理",
  system: "系统配置",
} as const;

export const dockItems: DockNavItem[] = [
  // 功能
  { title: "总览", icon: LayoutDashboard, href: "/dashboard", groupKey: "feature", groupLabel: DOCK_GROUPS.feature },
  { title: "测试任务", icon: Target, href: "/function/tasks", groupKey: "feature" },
  { title: "测试资产", icon: Network, href: "/function/assets", groupKey: "feature" },
  { title: "漏洞结果", icon: Bug, href: "/function/findings", groupKey: "feature" },

  // 运行管理
  { title: "拦截规则", icon: ShieldAlert, href: "/system/intercept", groupKey: "ops", groupLabel: DOCK_GROUPS.ops },
  { title: "审批记录", icon: ClipboardList, href: "/system/intercept/approvals", groupKey: "ops" },
  { title: "日志", icon: ScrollText, href: "/system/logs", groupKey: "ops" },

  // 系统配置
  { title: "AI 配置", icon: Brain, href: "/system/llm", groupKey: "system", groupLabel: DOCK_GROUPS.system },
  { title: "Agent", icon: Bot, href: "/system/agents", groupKey: "system" },
  { title: "Skills", icon: Sparkles, href: "/system/skills", groupKey: "system" },
  { title: "工具", icon: Wrench, href: "/system/tools", groupKey: "system" },
  { title: "MCP", icon: Plug, href: "/system/mcp", groupKey: "system" },
  { title: "设置", icon: Settings2, href: "/system/settings", groupKey: "system" },
];
