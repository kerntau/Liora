"use client";

import * as React from "react";

import Link from "@/lib/router-compat";

import { BellIcon, Clock3Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AccountSwitcher } from "./sidebar/account-switcher";
import { ThemeSwitcher } from "./sidebar/theme-switcher";
import { CommandMenu } from "./command-menu";

function useClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const date = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("/", "-");
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return { date, time };
}

/**
 * Live fleet status: how many tasks are running, how many approvals wait.
 * Polling is intentionally light (20s/15s) — the header is decoration, the
 * pages own their own refresh cadence.
 */
function useFleetStatus() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [pending, setPending] = React.useState(0);

  usePolling(async () => {
    try {
      const result = await api.tasks();
      setTasks(result.tasks);
    } catch {
      /* keep the last known state */
    }
  }, 20_000);

  usePolling(async () => {
    try {
      setPending((await api.interceptPending()).length);
    } catch {
      /* keep the last known state */
    }
  }, 15_000);

  const running = tasks.filter((task) => task.status === "running").length;
  const paused = tasks.filter((task) => task.status === "paused").length;
  return { running, paused, total: tasks.length, pending };
}

export function AppHeader({ version }: { version: string }) {
  const currentUser = useCurrentUser();
  const { running, paused, pending } = useFleetStatus();
  const { date, time } = useClock();
  const active = running > 0;
  const resting = !active && paused > 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="relative mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between gap-2 px-3 max-sm:gap-1 max-sm:px-2 lg:gap-4 lg:px-6">
        {/* 左区：运行状态 + 时钟 */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                prefetch={false}
                href="/function/tasks"
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  active
                    ? "border-success/25 bg-success/10 text-success"
                    : resting
                      ? "border-warning/25 bg-warning/10 text-warning"
                      : "border-border bg-surface-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative flex size-2">
                  {active ? <span className="absolute inline-flex size-full animate-breathe rounded-full bg-success/50" /> : null}
                  <span
                    className={cn(
                      "relative inline-flex size-2 rounded-full",
                      active ? "bg-success" : resting ? "bg-warning" : "bg-muted-foreground/40",
                    )}
                  />
                </span>
                <span className="hidden md:inline">
                  {active ? "测试进行中 · " + running : resting ? "任务已暂停 · " + paused : "系统就绪"}
                </span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              {active
                ? running + " 个任务正在运行"
                : resting
                  ? paused + " 个任务已暂停，等待继续"
                  : "当前没有运行中的任务"}
            </TooltipContent>
          </Tooltip>

          <span className="hidden items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums lg:inline-flex">
            <Clock3Icon className="size-3" aria-hidden="true" />
            {date} {time}
          </span>
          {version ? (
            <span className="hidden font-mono text-[11px] text-muted-foreground tabular-nums xl:inline">v{version}</span>
          ) : null}
        </div>

        {/* 中区：Logo 绝对居中。
            窄屏（<sm）改用方形图标版 —— 字标宽 102px，在 ≤414px 会横着压到右侧的 ⌘K 按钮上
            （实测 360px 时整个按钮被盖住，点不到）。图标版只有 28px，不会与右区打架。 */}
        <Link
          prefetch={false}
          href="/dashboard"
          aria-label={APP_CONFIG.name}
          className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          {/* 两个 img 都用空 alt：可访问名由外层链接的 aria-label 提供，
              否则无障碍树里会出现两个同名图片。 */}
          <img
            src={APP_CONFIG.logo}
            alt=""
            width={523}
            height={144}
            className="hidden h-8 w-auto object-contain sm:block"
          />
          <img
            src={APP_CONFIG.logoIcon}
            alt=""
            width={256}
            height={256}
            className="size-7 object-contain sm:hidden"
          />
        </Link>

        {/* 右区：⌘K 命令面板 + 通知 + 主题/布局 + 账户
            relative z-10：窄屏时居中的 Logo 会与右区重叠（实测 ≤414px 时盖住 ⌘K 按钮整个宽度），
            把右区抬到 Logo 之上，保证这些控件始终可点。 */}
        <div className="relative z-10 flex min-w-0 flex-1 items-center justify-end gap-1.5 max-sm:gap-1 sm:gap-2">
          <CommandMenu />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon" className="relative text-muted-foreground max-sm:size-9">
                <Link prefetch={false} href="/system/intercept/approvals" aria-label={"待审批 " + pending + " 条"}>
                  <BellIcon />
                  {pending > 0 ? (
                    <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background">
                      {pending > 99 ? "99+" : pending}
                    </span>
                  ) : null}
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{pending > 0 ? pending + " 条待审批请求" : "没有待审批请求"}</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-0.5">
            <ThemeSwitcher />
          </div>

          <AccountSwitcher users={[currentUser]} labeled />
        </div>
      </div>
    </header>
  );
}
