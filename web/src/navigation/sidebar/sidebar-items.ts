import {
  Brain,
  Bug,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Network,
  ScrollText,
  Settings2,
  ShieldAlert,
  Target,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "功能",
    items: [
      { id: "dashboard", title: "总览", url: "/dashboard", icon: LayoutDashboard },
      { id: "tasks", title: "测试任务", url: "/function/tasks", icon: Target },
      { id: "assets", title: "测试资产", url: "/function/assets", icon: Network },
      { id: "findings", title: "漏洞结果", url: "/function/findings", icon: Bug },
    ],
  },
  {
    id: 2,
    label: "系统",
    items: [
      { id: "llm", title: "AI 配置", url: "/system/llm", icon: Brain },
      { id: "settings", title: "系统设置", url: "/system/settings", icon: Settings2 },
    ],
  },
  {
    id: 3,
    label: "运行管理",
    items: [
      { id: "intercept", title: "拦截规则", url: "/system/intercept", icon: ShieldAlert },
      { id: "approvals", title: "审批记录", url: "/system/intercept/approvals", icon: ClipboardList },
      { id: "logs", title: "日志", url: "/system/logs", icon: ScrollText },
    ],
  },
];
