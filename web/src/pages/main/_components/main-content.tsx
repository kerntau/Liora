"use client";

import { type ReactNode, useEffect, useState } from "react";

import { usePathname } from "@/lib/router-compat";

import { api } from "@/lib/api";

import { AppHeader } from "./app-header";

function normalizePath(pathname: string) {
  const p = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();
  // 静态导出开了 trailingSlash，列表页自身的 pathname 是 "/function/tasks/"，
  // 先去掉尾斜杠再判前缀，否则列表页会被误判成详情页而丢掉全局头部。
  return p.replace(/\/+$/, "") || "/";
}

// 静态导出没有框架级的 metadata，按路由统一维护 document.title。
const BRAND = "Liora · 灵探";
const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "总览",
  "/function/tasks": "测试任务",
  "/function/tasks/detail": "任务详情",
  "/function/assets": "测试资产",
  "/function/findings": "漏洞结果",
  "/function/findings/detail": "漏洞详情",
  "/function/conversations/detail": "对话详情",
  "/system/llm": "AI 配置",
  "/system/settings": "系统设置",
  "/system/intercept": "拦截规则",
  "/system/intercept/approvals": "审批记录",
  "/system/logs": "日志",
  "/system/agents": "Agent",
  "/system/agents/detail": "Agent",
  "/system/mcp": "MCP",
  "/system/skills": "Skills",
  "/system/tools": "工具",
};

export function MainContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [version, setVersion] = useState("");

  useEffect(() => {
    api
      .health()
      .then((h) => setVersion((h.version ?? "").replace(/^v(?=\d)/, "")))
      .catch(() => setVersion(""));
  }, []);

  useEffect(() => {
    const page = ROUTE_TITLES[normalizePath(pathname)];
    document.title = page ? page + " · " + BRAND : BRAND;
  }, [pathname]);

  return (
    <>
      <AppHeader version={version} />
      {/* 底部留白给浮动 Dock（桌面端 64px 横条 + 16px 边距，移动端 48px 圆钮 + 16px 边距），
          否则页面最后一个卡片会被压在 Dock 底下点不到。 */}
      <div className="mx-auto min-h-0 w-full max-w-screen-2xl min-w-0 flex-1 overflow-x-hidden px-4 pt-4 pb-20 md:px-6 md:pt-5 md:pb-24">
        {children}
      </div>
    </>
  );
}
