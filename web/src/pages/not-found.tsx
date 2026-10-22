"use client";

import { ArrowLeftIcon, CompassIcon, HomeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";
import Link from "@/lib/router-compat";

/**
 * 品牌化 404：居中一张卡片（图标 + 标题 + 说明 + 返回总览），
 * 背景用极淡的网格纹理，不喧宾夺主。
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-5 py-16">
      <div
        aria-hidden="true"
        className="app-grid-bg pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
      />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="ui-card flex w-full flex-col items-center px-8 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <CompassIcon className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-5 font-mono text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Error 404
          </p>
          <h1 className="mt-1.5 text-[20px] leading-tight font-semibold tracking-tight text-foreground">页面不存在</h1>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">这个地址可能已失效，或页面已被移除。</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link prefetch={false} href="/function/tasks">
                <ArrowLeftIcon data-icon="inline-start" />
                任务列表
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link prefetch={false} href="/dashboard">
                <HomeIcon data-icon="inline-start" />
                返回总览
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-[12px] text-muted-foreground">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={APP_CONFIG.logoIcon} alt="" width={20} height={20} className="size-5 object-contain" />
          <span>{APP_CONFIG.name} · 授权测试 · 全程留证</span>
        </div>
      </div>
    </div>
  );
}
