import * as React from "react";

import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import type { TaskConstraint, TaskGoal, TaskScopeRow } from "@/lib/types";

export interface TaskCoverage {
  enabled: boolean;
  scope_rows: number;
  denominator: number;
  tested: number;
  pct: number | null;
  by_type: { type: string; total: number; tested: number }[];
}

export interface TaskConsoleData {
  scope: TaskScopeRow[];
  goals: TaskGoal[];
  constraints: TaskConstraint[];
  coverage: TaskCoverage | null;
}

const EMPTY: TaskConsoleData = { scope: [], goals: [], constraints: [], coverage: null };

/**
 * Task-scoped data for the dashboard cockpit: scope, goals, constraints and
 * coverage. All four endpoints settle independently so one failure never wipes
 * the other cards. Refreshes every 20s while a task is selected.
 */
export function useTaskConsole(taskId: string | null) {
  const [data, setData] = React.useState<TaskConsoleData>(EMPTY);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    if (!taskId) {
      setData(EMPTY);
      setError("");
      return;
    }
    setLoading(true);
    const [scope, goals, constraints, coverage] = await Promise.allSettled([
      api.taskScope(taskId),
      api.taskGoals(taskId),
      api.taskConstraints(taskId),
      api.taskCoverage(taskId),
    ]);
    setData({
      scope: scope.status === "fulfilled" ? (scope.value.scope ?? []) : [],
      goals: goals.status === "fulfilled" ? goals.value.goals : [],
      constraints: constraints.status === "fulfilled" ? constraints.value.constraints : [],
      coverage: coverage.status === "fulfilled" ? coverage.value : null,
    });
    setError(scope.status === "rejected" && goals.status === "rejected" ? "任务范围与目标加载失败" : "");
    setLoading(false);
  }, [taskId]);

  usePolling(load, 20_000, { enabled: Boolean(taskId), resetKey: taskId });

  return { ...data, loading, error, reload: load };
}
