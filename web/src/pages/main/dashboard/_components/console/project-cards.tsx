"use client";

import * as React from "react";

import Link from "@/lib/router-compat";

import {
  ArrowUpRightIcon,
  BugIcon,
  CoinsIcon,
  PauseIcon,
  PlayIcon,
  RadarIcon,
  RefreshCwIcon,
  TimerIcon,
  WaypointsIcon,
} from "lucide-react";

import { MetaItems, MetaSeparator } from "@/components/app/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { breathe } from "@/lib/motion";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import { executionIntent, formatClock, projectCode, runSeconds, stageIndex, STAGES, taskProgress } from "./helpers";

function useNowSec(active: boolean) {
  const [now, setNow] = React.useState(() => Math.floor(Date.now() / 1000));
  React.useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

const STATUS_COPY: Record<string, string> = {
  running: "正在进行安全检测…",
  paused: "任务已暂停，等待继续",
  done: "测试已完成，结果已归档",
  failed: "任务失败，请查看执行日志",
  timeout: "任务超时结束，可查看已有结果",
  queued: "排队中，等待 Worker 接手",
  created: "任务已创建，等待启动",
};

// 大屏面板底色：比页面背景略深的品牌蓝浅色层（DESIGN-SPEC：禁深色底）。
const DECK_PANEL =
  "rounded-xl border border-primary/15 shadow-[var(--shadow-card)] " +
  "bg-[color-mix(in_srgb,var(--primary)_4%,var(--card))]";

/** HUD 指标格：只做浅底分组，不再套一层边框，避免大屏里出现卡片套卡片。 */
function DeckMetric({
  icon: Icon,
  label,
  value,
  sub,
  valueClassName,
  className,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  valueClassName?: string;
  className?: string;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col gap-0.5 rounded-lg bg-card/70 px-2.5 py-2 transition-colors",
        href && "group-hover:bg-card",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn("truncate text-[18px] leading-6 font-semibold tracking-tight tabular-nums", valueClassName)}>
        {value}
      </span>
      {sub ? <span className="truncate text-xs leading-5 text-muted-foreground">{sub}</span> : null}
    </div>
  );
  if (!href) return <div className={cn("min-w-0", className)}>{body}</div>;
  return (
    <Link
      prefetch={false}
      href={href}
      className={cn(
        "group min-w-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        className,
      )}
    >
      {body}
    </Link>
  );
}

/**
 * 实时指挥台大屏：当前聚焦任务的 HUD。浅色底 + 品牌蓝大号覆盖率 +
 * 阶段进度条 + 运行状态呼吸点；任务切换/暂停继续/刷新等操作全部保留。
 */
export function CommandDeck({
  tasks,
  task,
  selectedId,
  onSelect,
  refreshing,
  onRefresh,
  coveragePct,
  verifiedFindings,
  tokensUsed,
  controlling,
  onControl,
}: {
  tasks: Task[];
  task: Task | null;
  selectedId: string;
  onSelect: (id: string) => void;
  refreshing: boolean;
  onRefresh: () => void;
  coveragePct: number | null;
  verifiedFindings: number;
  tokensUsed: { input: number; output: number };
  controlling: boolean;
  onControl: (action: "pause" | "resume") => void;
}) {
  const running = task?.status === "running";
  const nowSec = useNowSec(Boolean(running));
  const progress = taskProgress(task, coveragePct);
  const activeStage = stageIndex(task);
  const seconds = task ? runSeconds(task, nowSec) : 0;
  const canPause = task ? ["created", "queued", "running"].includes(task.status) : false;
  const canResume = task?.status === "paused";
  const title = task ? task.name || task.description || "任务 #" + task.id : "";
  const intent = executionIntent(task);

  if (!task) {
    return (
      <section aria-label="实时指挥台" className={cn(DECK_PANEL, "flex flex-col items-center gap-2 px-6 py-9 text-center")}>
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <RadarIcon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-[16px] font-semibold text-foreground">指挥台待命中</h2>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          创建第一个授权测试任务后，覆盖率、确认漏洞、执行意图与 Token 消耗会实时出现在这里。
        </p>
        <Button asChild size="sm">
          <Link prefetch={false} href="/function/tasks">
            新建任务
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="实时指挥台" className={cn(DECK_PANEL, "flex flex-col gap-3 px-4 py-3 sm:px-5")}>
      {/* 头部：任务名 + 状态呼吸点 + 任务切换/控制 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              running
                ? cn("bg-success", breathe.className)
                : task.status === "paused"
                  ? "bg-warning"
                  : "bg-muted-foreground/40",
            )}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="max-w-full truncate text-[16px] leading-6 font-semibold tracking-tight text-foreground"
                title={title}
              >
                {title}
              </h2>
              <StatusBadge domain="task" value={task.status} dot />
              {task.pinned ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  已置顶
                </span>
              ) : null}
            </div>
            <MetaItems
              items={[
                <span className="font-mono">{projectCode(task)}</span>,
                <span>{STATUS_COPY[task.status] ?? "状态未知"}</span>,
              ]}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger size="sm" className="h-8 w-[180px] bg-card/80" aria-label="切换聚焦任务">
              <SelectValue placeholder="选择任务" />
            </SelectTrigger>
            <SelectContent align="end">
              {tasks.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <span className="font-mono text-[11px] text-muted-foreground">#{item.id}</span>
                  <span className="max-w-48 truncate">{item.name || item.description || "未命名任务"}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canPause || canResume ? (
            <Button
              size="sm"
              variant="outline"
              disabled={controlling}
              onClick={() => onControl(canResume ? "resume" : "pause")}
              className={cn(
                "bg-card/80",
                canResume
                  ? "border-primary/30 text-primary hover:bg-accent"
                  : "border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive",
              )}
            >
              {canResume ? <PlayIcon data-icon="inline-start" /> : <PauseIcon data-icon="inline-start" />}
              {canResume ? "继续运行" : "暂停任务"}
            </Button>
          ) : null}
          <Button asChild size="icon-sm" variant="ghost" aria-label="打开任务详情" title="打开任务详情">
            <Link prefetch={false} href={"/function/tasks/detail?id=" + task.id + "&tab=overview"}>
              <ArrowUpRightIcon />
            </Link>
          </Button>
        </div>
      </div>

      {/* HUD 指标带 */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <DeckMetric
          icon={RadarIcon}
          label="覆盖率"
          value={
            <span className="inline-flex items-baseline gap-0.5 text-primary">
              <span>{coveragePct ?? progress}</span>
              <span className="text-xs font-medium">%</span>
            </span>
          }
          sub={coveragePct !== null ? "范围内资产验证比例" : "按目标完成情况估算"}
        />
        <DeckMetric
          icon={BugIcon}
          label="确认漏洞"
          value={verifiedFindings}
          sub="已确认 / 修复的发现"
          valueClassName={verifiedFindings > 0 ? "text-destructive" : undefined}
          href="/function/findings"
        />
        <DeckMetric
          icon={WaypointsIcon}
          label="执行意图"
          value={
            <span className="block truncate text-[13px] leading-6 font-medium" title={intent}>
              {intent}
            </span>
          }
          sub={"当前阶段：" + STAGES[activeStage].label + " · " + STAGES[activeStage].caption}
        />
        <DeckMetric
          icon={CoinsIcon}
          label="Token 消耗"
          value={fmtCompact(tokensUsed.input + tokensUsed.output)}
          sub={"入 " + fmtCompact(tokensUsed.input) + " · 出 " + fmtCompact(tokensUsed.output)}
        />
        <DeckMetric
          icon={TimerIcon}
          label="已运行时长"
          className="max-md:col-span-2"
          value={<span className="font-mono">{formatClock(seconds)}</span>}
          sub={running ? "实时计时中" : "运行已停止"}
        />
      </div>

      {/* 阶段进度条 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            阶段 <span className="font-semibold text-foreground tabular-nums">{activeStage + 1}/4</span>
            <MetaSeparator className="mx-2" />
            整体进度 <span className="font-semibold text-primary tabular-nums">{progress}%</span>
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={onRefresh}
            disabled={refreshing}
            aria-busy={refreshing || undefined}
            className="-mr-1.5 text-muted-foreground hover:text-primary"
          >
            <RefreshCwIcon data-icon="inline-start" className={cn(refreshing && "animate-spin")} />
            {refreshing ? "刷新中…" : "刷新态势"}
          </Button>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="任务整体进度"
          className="flex h-1.5 items-center gap-1"
        >
          {STAGES.map((stage, index) => (
            <div key={stage.key} className="h-full flex-1 overflow-hidden rounded-full bg-foreground/8">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700",
                  index < activeStage
                    ? "bg-primary"
                    : index === activeStage
                      ? running
                        ? "bg-primary"
                        : "bg-warning"
                      : "bg-transparent",
                )}
                style={{
                  width: index < activeStage ? "100%" : index === activeStage ? Math.max(progress, 6) + "%" : "0%",
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground/85">
          {STAGES.map((stage, index) => (
            <span key={stage.key} className={cn(index === activeStage && "font-semibold text-primary")}>
              {stage.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 大屏内的紧凑 Token 数字（k/M），与 format.ts 的 fmtTokens 口径一致。 */
function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
