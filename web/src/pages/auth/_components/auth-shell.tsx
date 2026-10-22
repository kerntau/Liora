import type { ReactNode } from "react";

import type { LucideIcon } from "lucide-react";
import { Loader2Icon } from "lucide-react";

import { APP_CONFIG } from "@/config/app-config";

export type AuthPoint = {
  icon: LucideIcon;
  title: string;
  description: string;
};

/**
 * Split-screen shell shared by /login and /setup: deep-navy brand panel on the
 * left, a single white form card on the right. Below lg the panel collapses to
 * a slim brand bar so the form keeps the whole viewport on a 390px phone.
 * The shell only owns layout — forms, validation and redirects stay in pages.
 */
export function AuthShell({
  points,
  children,
  footnote,
}: {
  points: AuthPoint[];
  children: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="relative hidden overflow-hidden border-transparent bg-sidebar text-sidebar-foreground lg:flex lg:w-[46%] lg:max-w-[640px] lg:flex-col lg:justify-between lg:border-r lg:p-12 xl:p-14 dark:lg:border-sidebar-border">
        <div aria-hidden="true" className="app-grid-bg pointer-events-none absolute inset-0 opacity-[0.05]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -bottom-36 size-[420px] rounded-full border border-sidebar-border"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -bottom-24 size-[280px] rounded-full border border-sidebar-border"
        />

        <div className="relative flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={APP_CONFIG.logoIcon} alt="" width={28} height={28} className="size-7 object-contain" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-sidebar-accent-foreground">{APP_CONFIG.name}</p>
            <p className="text-[11px] tracking-[0.16em] text-sidebar-foreground/70 uppercase">Security Console</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <span className="app-chip border-sidebar-border bg-sidebar-accent text-[11px] text-sidebar-foreground">
            AI 自动化渗透测试平台
          </span>
          <h2 className="mt-5 text-[24px] leading-9 font-semibold tracking-tight text-sidebar-accent-foreground">
            让安全验证更简单、更可靠
          </h2>
          <p className="mt-3 text-[13px] leading-6 text-sidebar-foreground/80">
            AI 辅助决策、自动化测试、漏洞验证与报告生成，集中在一个控制台里完成。
          </p>

          <ul className="mt-9 flex flex-col gap-4">
            {points.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-sidebar-accent-foreground">{point.title}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-sidebar-foreground/70">{point.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-sidebar-foreground/60">
          <span>{APP_CONFIG.copyright}</span>
          <span aria-hidden="true" className="size-1 rounded-full bg-sidebar-foreground/30" />
          <span className="font-mono tabular-nums">v{APP_CONFIG.version}</span>
          <span aria-hidden="true" className="size-1 rounded-full bg-sidebar-foreground/30" />
          <span>授权测试 · 全程留证</span>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-4 lg:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={APP_CONFIG.logoIcon}
            alt={APP_CONFIG.name}
            width={28}
            height={28}
            className="size-7 object-contain"
          />
          <span className="truncate text-[13px] font-semibold text-foreground">{APP_CONFIG.name}</span>
          <span className="ml-auto truncate text-[11px] text-muted-foreground">AI 自动化渗透测试平台</span>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div className="app-card p-6 sm:p-7">{children}</div>
            {footnote ? <div className="mt-4 text-center">{footnote}</div> : null}
            <p className="mt-4 text-center text-[11px] text-muted-foreground lg:hidden">{APP_CONFIG.copyright}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Full-screen status while the one-time auth probe is in flight. */
export function AuthChecking({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={APP_CONFIG.logoIcon} alt="" width={40} height={40} className="size-10 object-contain" />
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin text-primary" aria-hidden="true" />
        {message}
      </div>
    </div>
  );
}