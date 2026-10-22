"use client";

import Link from "@/lib/router-compat";

import { CheckIcon, CrossIcon, ExternalLinkIcon, ShieldCheckIcon, TargetIcon } from "lucide-react";

import { SectionCard } from "@/components/app/section-card";
import type { Task, TaskConstraint, TaskGoal, TaskScopeRow } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SCOPE_KIND_LABELS, scopeValue } from "./helpers";

const DEFAULT_RULES = ["仅在授权范围内测试", "不进行破坏性操作", "全程记录并保留证据", "遵守相关安全测试规范"];

export function ScopeCard({
  task,
  scope,
  goals,
  constraints,
  loading,
}: {
  task: Task | null;
  scope: TaskScopeRow[];
  goals: TaskGoal[];
  constraints: TaskConstraint[];
  loading: boolean;
}) {
  const roots = unique(scope.filter((row) => row.kind === "root_domain").map(scopeValue));
  const address =
    roots.length > 0
      ? roots.slice(0, 2).join("、") + (roots.length > 2 ? " 等 " + roots.length + " 个" : "")
      : scope[0]
        ? scopeValue(scope[0])
        : "未设置范围";

  const counts = scope.reduce<Record<string, number>>((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    return acc;
  }, {});
  const scopeTags = Object.entries(counts)
    .filter(([kind]) => SCOPE_KIND_LABELS[kind])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  // 后端可能返回未登记的类型（如 domain）：不要在「N 条」的同时又说「尚未设置范围」。
  const unknownRows = scope.length - scopeTags.reduce((sum, [, count]) => sum + count, 0);

  return (
    <SectionCard
      icon={TargetIcon}
      title="目标范围"
      className="min-w-0"
      actions={
        task ? (
          <Link
            prefetch={false}
            href={"/function/tasks/detail?id=" + task.id + "&tab=overview"}
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            编辑 <ExternalLinkIcon className="size-3" aria-hidden="true" />
          </Link>
        ) : null
      }
    >
      <div className="rounded-lg bg-muted/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-card text-primary">
              <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="truncate text-[13px] font-semibold text-foreground">授权测试目标</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-success">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            已授权
          </span>
        </div>

        <dl className="mt-2 grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs leading-5">
          <dt className="text-muted-foreground">目标名称</dt>
          <dd className="truncate font-medium text-foreground">{task?.name || task?.description || "—"}</dd>
          <dt className="text-muted-foreground">目标地址</dt>
          <dd className="truncate font-mono text-foreground/80" title={address}>
            {address}
          </dd>
          <dt className="text-muted-foreground">目标说明</dt>
          <dd className="line-clamp-1 text-foreground/80">{task?.goal || task?.description || "未填写测试目标"}</dd>
        </dl>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">测试范围</span>
          <span className="text-xs text-muted-foreground tabular-nums">{scope.length} 条</span>
        </div>
        {loading && scope.length === 0 ? (
          <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
        ) : scopeTags.length > 0 || unknownRows > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {scopeTags.map(([kind, count]) => (
              <span
                key={kind}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-foreground/80"
              >
                {SCOPE_KIND_LABELS[kind]}
                <span className="font-semibold text-foreground tabular-nums">{count}</span>
              </span>
            ))}
            {unknownRows > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-foreground/80">
                其他
                <span className="font-semibold text-foreground tabular-nums">{unknownRows}</span>
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">尚未设置测试范围</p>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">测试规则</span>
          {/* 这里列的是约束（constraints），计数不能拿 goals 凑 —— 语义不同，会让人以为有 2 条规则。 */}
          {constraints.length > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">{constraints.length} 条</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/70">默认规则</span>
          )}
        </div>
        <ul className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
          {(constraints.length > 0
            ? constraints.slice(0, 4).map((constraint) => ({
                key: constraint.id,
                text: constraint.text,
                deny: constraint.kind === "deny",
              }))
            : DEFAULT_RULES.map((text, index) => ({ key: String(index), text, deny: false }))
          ).map((rule) => (
            <li key={rule.key} className="flex min-w-0 items-start gap-1.5 text-xs leading-5">
              <span
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                  rule.deny ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
                )}
                aria-hidden="true"
              >
                {rule.deny ? <CrossIcon className="size-2.5" /> : <CheckIcon className="size-2.5" />}
              </span>
              <span className="line-clamp-1 text-foreground/75">{rule.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
