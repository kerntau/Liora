import { expect, test } from "@playwright/test";

import type { Task } from "../src/lib/types";

test("dashboard filters both token sources by profile and date without losing refresh or deep links", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("liora_token", "mui-dashboard-fixture"));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const today = new Date().toISOString();
  const earlier = new Date(Date.now() - 35 * 86400_000).toISOString();
  const tasks: Task[] = [
    {
      id: "alpha-task",
      description: "Alpha fixture task",
      goal: "UI regression",
      status: "running",
      created_at: today,
      llm_profile_id: 1,
      goals_total: 4,
      goals_met: 1,
      engine_mode: "exploring",
      tokens: { input_tokens: 1000, output_tokens: 100, cache_read_tokens: 100, cache_write_tokens: 0 },
    },
    {
      id: "beta-task",
      description: "Beta fixture task",
      goal: "UI regression",
      status: "done",
      created_at: earlier,
      llm_profile_id: 2,
      tokens: { input_tokens: 2000, output_tokens: 200, cache_read_tokens: 100, cache_write_tokens: 0 },
    },
  ];
  let taskRequests = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = {};
    if (path === "/api/tasks") {
      taskRequests++;
      json = { tasks };
    } else if (path === "/api/llm/profiles") {
      json = {
        profiles: [
          { id: 1, name: "Alpha", model: "alpha-model", format: "openai", is_default: true },
          { id: 2, name: "Beta", model: "beta-model", format: "openai", is_default: false },
        ],
      };
    } else if (path === "/api/tokens/usage") {
      json = {
        by_profile: [
          {
            profile_name: "Alpha",
            tasks: 1,
            calls: 1,
            input_tokens: 10000,
            output_tokens: 1000,
            cache_read_tokens: 1000,
            cache_write_tokens: 0,
          },
          {
            profile_name: "Beta",
            tasks: 1,
            calls: 1,
            input_tokens: 20000,
            output_tokens: 2000,
            cache_read_tokens: 2000,
            cache_write_tokens: 0,
          },
        ],
        daily: [
          {
            profile_name: "Alpha",
            date: today.slice(0, 10),
            input_tokens: 10000,
            output_tokens: 1000,
            cache_read_tokens: 1000,
          },
          {
            profile_name: "Beta",
            date: earlier.slice(0, 10),
            input_tokens: 20000,
            output_tokens: 2000,
            cache_read_tokens: 2000,
          },
        ],
      };
    } else if (["/api/exploration/findings", "/api/tokens/conversations"].includes(path)) {
      json = [];
    } else if (path === "/api/assets/counts") {
      json = { root_domain: 2, endpoint: 1 };
    } else if (path === "/api/stats") {
      json = { assets: 3, engine_mode: "exploring", llm_configured: true, findings_confirmed: 0 };
    } else if (path === "/api/traffic") {
      json = {
        exchanges: [
          {
            id: "packet-1",
            host: "fixture.example",
            url: "https://fixture.example/",
            method: "GET",
            status: 200,
            ts: today,
          },
        ],
      };
    }
    await route.fulfill({ json });
  });
  await page.goto("/dashboard");

  // 新框架首屏是「指挥台」：页头标题 + 下方四个明细页签，不再是旧版纵向平铺的面板。
  await expect(page.getByRole("heading", { name: "指挥台", exact: true })).toBeVisible();
  for (const tab of ["任务与用量", "发现与资产", "流量", "系统状态"]) {
    await expect(page.getByRole("tab", { name: new RegExp(tab) })).toBeVisible();
  }
  await expect(page.getByRole("tabpanel")).toBeVisible();

  const panel = page.getByRole("region", { name: "LLM Token 消耗" });
  await expect(panel.getByText("3.3k", { exact: true })).toBeVisible();
  const beta = panel.getByRole("button", { name: "Beta", exact: true });
  await beta.focus();
  await page.keyboard.press("Enter");
  await expect(beta).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText("2.2k", { exact: true })).toBeVisible();
  const ledger = panel.getByRole("button", { name: "新版", exact: true });
  await ledger.click();
  await expect(ledger).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText("22.0k", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "7天", exact: true }).click();
  await expect(panel.getByRole("img", { name: "近 7 天 Token 使用趋势" })).toHaveText(/0 个日期/);
  await panel.getByRole("button", { name: "3月", exact: true }).click();
  await expect(panel.getByRole("img", { name: "近 90 天 Token 使用趋势" })).toHaveText(/1 个日期/);
  await panel.getByRole("button", { name: "全部", exact: true }).click();
  await expect(panel.getByText("33.0k", { exact: true })).toBeVisible();
  await expect(panel.getByRole("img", { name: "近 90 天 Token 使用趋势" })).toHaveText(/2 个日期/);
  await ledger.click();
  await expect(ledger).toHaveAttribute("aria-pressed", "true");

  // 手动刷新：新框架里页头动作区的按钮名为「刷新」（旧版叫「刷新仪表盘数据」）。
  const previous = taskRequests;
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect.poll(() => taskRequests).toBeGreaterThan(previous);

  // 任务深链：指挥台大屏的「打开任务详情」按钮指向任务详情页（带 tab 参数）。
  const taskLink = page.getByRole("link", { name: "打开任务详情" });
  await expect(taskLink).toHaveAttribute("href", "/function/tasks/detail?id=alpha-task&tab=overview");

  // 整体进度：新框架用指挥台大屏的阶段进度条（旧版是无障碍名「进度」的进度条）。
  const progress = page.getByRole("progressbar", { name: "任务整体进度" });
  await expect(progress).toHaveAttribute("aria-valuenow", "25");

  // 新框架导航：底部 Dock 承担页面导航，当前项 aria-current=page；左侧固定侧栏已移除。
  const dock = page.locator('nav[aria-label="主导航"]');
  await expect(dock).toBeVisible();
  await expect(dock.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(dock.locator('a[aria-current="page"]')).toHaveAttribute("href", "/dashboard");
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);
  const contentLeft = await page.evaluate(() => {
    const header = document.querySelector("header");
    const content = header?.nextElementSibling as HTMLElement | null;
    return content ? content.getBoundingClientRect().x : -1;
  });
  expect(contentLeft).toBeLessThanOrEqual(1);

  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
