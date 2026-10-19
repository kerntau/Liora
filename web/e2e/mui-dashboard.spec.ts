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
  const previous = taskRequests;
  await page.getByRole("button", { name: "刷新仪表盘数据" }).click();
  await expect.poll(() => taskRequests).toBeGreaterThan(previous);
  const taskLink = page.getByRole("link", { name: /Alpha fixture task/ });
  await expect(taskLink).toHaveAttribute("href", "/function/tasks/detail?id=alpha-task");
  await expect(page.getByRole("progressbar", { name: "进度", exact: true })).toHaveAttribute("aria-valuenow", "25");
  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("dashboard-mobile.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
