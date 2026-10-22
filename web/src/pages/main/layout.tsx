"use client";

import type { ReactNode } from "react";
import * as React from "react";

import { FloatingDock } from "@/components/ui/floating-dock";
import { auth } from "@/lib/auth";
import { dockItems } from "@/lib/dock-items";

import { MainContent } from "./_components/main-content";

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  // Client-side auth gate — replaces the Next proxy/middleware that static export
  // disables. No token → bounce to /login; render nothing until confirmed so no
  // protected UI (or its API calls) flashes for a logged-out visitor.
  const [authed, setAuthed] = React.useState(false);
  React.useEffect(() => {
    if (auth.getToken()) {
      setAuthed(true);
    } else {
      // 客户端守卫认为未登录时，必须同时清掉 cookie：否则 proxy.ts 仅凭
      // “cookie 存在”就把我们从 /login 又重定向回主界面，与本守卫来回弹跳
      // 形成无限重定向 → 白屏（cookie 与 localStorage 不一致时触发）。
      auth.clearToken();
      window.location.href = "/login";
    }
  }, []);

  if (!authed) return null;

  // 驾驶舱框架：不再渲染固定左侧导航。页面导航由底部浮动 Dock 承担
  // （⌘K 命令面板仍然保留，负责搜索式跳转）；顶栏只管状态、搜索与账户。
  return (
    <div className="flex min-h-svh w-full flex-col bg-background">
      <MainContent>{children}</MainContent>
      <FloatingDock items={dockItems} />
    </div>
  );
}
