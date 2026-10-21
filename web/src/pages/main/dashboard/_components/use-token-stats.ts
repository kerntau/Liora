import * as React from "react";

import type { ConvTokenSummary, LLMProfile, Task, UsageStats } from "@/lib/types";

export type TokenVersion = "old" | "new";
export type TokenTab = number | null | "all";
export type TokenDays = 7 | 30 | 90 | 180 | 365;

export type TokenBucket = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  taskCount: number;
};

export type DisplayedTokens = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  taskCount: number;
};

export type DailyTokenPoint = {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
};

export type TokenStats = {
  tokenVersion: TokenVersion;
  setTokenVersion: React.Dispatch<React.SetStateAction<TokenVersion>>;
  tokenTab: TokenTab;
  setTokenTab: React.Dispatch<React.SetStateAction<TokenTab>>;
  tokenDays: TokenDays;
  setTokenDays: React.Dispatch<React.SetStateAction<TokenDays>>;
  tokenByProfile: Map<number | null, TokenBucket>;
  displayedTokens: DisplayedTokens;
  dailyTokenData: DailyTokenPoint[];
};

type UseTokenStatsArgs = {
  tasks: Task[];
  convTokens: ConvTokenSummary[];
  usageStats: UsageStats | null;
  llmProfiles: LLMProfile[];
  defaultProfileId: number | null;
};

export function useTokenStats({
  tasks,
  convTokens,
  usageStats,
  llmProfiles,
  defaultProfileId,
}: UseTokenStatsArgs): TokenStats {
  // 数据源开关：旧版 = activity（task.tokens + 会话），新版 = llm_usage 计量账本。
  const [tokenVersion, setTokenVersion] = React.useState<"old" | "new">("old");
  // selected profile tab: "all" = 全部; number = specific profile id
  const [tokenTab, setTokenTab] = React.useState<number | null | "all">("all");
  // day range for the daily bar chart
  const [tokenDays, setTokenDays] = React.useState<7 | 30 | 90 | 180 | 365>(30);

  // profile 名 → id，用于把 llm_usage 的 profile_name 映射到现有 profile 分栏。
  const profileIdByName = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const p of llmProfiles) m.set(p.name, Number(p.id));
    return m;
  }, [llmProfiles]);

  // 旧版：按 profile 归桶（来自 activity 的 task.tokens + 会话用量）。
  const tokenByProfileOld = React.useMemo<Map<number | null, TokenBucket>>(() => {
    const m = new Map<number | null, TokenBucket>();
    const fold = (key: number | null, inp: number, out: number, cr: number, cw: number, addTask: boolean) => {
      const prev = m.get(key) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, taskCount: 0 };
      m.set(key, {
        input: prev.input + inp,
        output: prev.output + out,
        cacheRead: prev.cacheRead + cr,
        cacheWrite: prev.cacheWrite + cw,
        taskCount: prev.taskCount + (addTask ? 1 : 0),
      });
    };
    for (const t of tasks) {
      fold(
        t.llm_profile_id ?? defaultProfileId,
        t.tokens?.input_tokens ?? 0,
        t.tokens?.output_tokens ?? 0,
        t.tokens?.cache_read_tokens ?? 0,
        t.tokens?.cache_write_tokens ?? 0,
        true,
      );
    }
    for (const c of convTokens) {
      fold(
        c.llm_profile_id ?? defaultProfileId,
        c.input_tokens,
        c.output_tokens,
        c.cache_read_tokens,
        c.cache_write_tokens,
        false,
      );
    }
    return m;
  }, [tasks, convTokens, defaultProfileId]);

  // 新版：按 profile 归桶（来自 llm_usage 全局聚合，逐次调用精确）。
  const tokenByProfileNew = React.useMemo<Map<number | null, TokenBucket>>(() => {
    const m = new Map<number | null, TokenBucket>();
    for (const p of usageStats?.by_profile ?? []) {
      // 未匹配到现有 profile（改名/删除/空名）→ 落到默认桶，仍计入「全部」。
      const key = profileIdByName.get(p.profile_name) ?? defaultProfileId;
      const prev = m.get(key) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, taskCount: 0 };
      m.set(key, {
        input: prev.input + p.input_tokens,
        output: prev.output + p.output_tokens,
        cacheRead: prev.cacheRead + p.cache_read_tokens,
        cacheWrite: prev.cacheWrite + p.cache_write_tokens,
        taskCount: prev.taskCount + p.tasks,
      });
    }
    return m;
  }, [usageStats, profileIdByName, defaultProfileId]);

  const tokenByProfile = tokenVersion === "new" ? tokenByProfileNew : tokenByProfileOld;

  const displayedTokens = React.useMemo(() => {
    if (tokenTab === "all") {
      let input = 0,
        output = 0,
        cacheRead = 0,
        cacheWrite = 0,
        taskCount = 0;
      for (const v of tokenByProfile.values()) {
        input += v.input;
        output += v.output;
        cacheRead += v.cacheRead;
        cacheWrite += v.cacheWrite;
        taskCount += v.taskCount;
      }
      return { input, output, cacheRead, cacheWrite, taskCount };
    }
    const v = tokenByProfile.get(tokenTab as number | null);
    return v
      ? { input: v.input, output: v.output, cacheRead: v.cacheRead, cacheWrite: v.cacheWrite, taskCount: v.taskCount }
      : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, taskCount: 0 };
  }, [tokenTab, tokenByProfile]);

  // 旧版每日：把任务/会话的总量按其创建日期归桶（近似，非真实每日消耗）。
  const dailyTokenDataOld = React.useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - tokenDays);
    const cutoff = now.toISOString().slice(0, 10);
    const m = new Map<string, { input: number; output: number; cacheRead: number }>();
    const fold = (date: string, inp: number, out: number, cr: number) => {
      if (date < cutoff) return;
      const prev = m.get(date) ?? { input: 0, output: 0, cacheRead: 0 };
      m.set(date, { input: prev.input + inp, output: prev.output + out, cacheRead: prev.cacheRead + cr });
    };
    for (const t of tasks) {
      if (tokenTab !== "all" && (t.llm_profile_id ?? defaultProfileId) !== tokenTab) continue;
      fold(
        t.created_at.slice(0, 10),
        t.tokens?.input_tokens ?? 0,
        t.tokens?.output_tokens ?? 0,
        t.tokens?.cache_read_tokens ?? 0,
      );
    }
    for (const c of convTokens) {
      if (tokenTab !== "all" && (c.llm_profile_id ?? defaultProfileId) !== tokenTab) continue;
      fold(c.created_at.slice(0, 10), c.input_tokens, c.output_tokens, c.cache_read_tokens);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [tasks, convTokens, tokenDays, tokenTab, defaultProfileId]);

  // 新版每日：来自 llm_usage 的真实每日消耗（ts 是实际调用时刻）。
  const dailyTokenDataNew = React.useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - tokenDays);
    const cutoff = now.toISOString().slice(0, 10);
    const m = new Map<string, { input: number; output: number; cacheRead: number }>();
    for (const d of usageStats?.daily ?? []) {
      if (d.date < cutoff) continue;
      if (tokenTab !== "all" && (profileIdByName.get(d.profile_name) ?? defaultProfileId) !== tokenTab) continue;
      const prev = m.get(d.date) ?? { input: 0, output: 0, cacheRead: 0 };
      m.set(d.date, {
        input: prev.input + d.input_tokens,
        output: prev.output + d.output_tokens,
        cacheRead: prev.cacheRead + d.cache_read_tokens,
      });
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [usageStats, tokenDays, tokenTab, profileIdByName, defaultProfileId]);

  const dailyTokenData = tokenVersion === "new" ? dailyTokenDataNew : dailyTokenDataOld;

  return {
    tokenVersion,
    setTokenVersion,
    tokenTab,
    setTokenTab,
    tokenDays,
    setTokenDays,
    tokenByProfile,
    displayedTokens,
    dailyTokenData,
  };
}
