import { expect, test } from "@playwright/test";

import paths from "../src/routes.json" with { type: "json" };

const password = "liora-e2e-password";

test("authentication, deep links, theme, fonts and live SSE work with the restored original UI", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const status = await (await request.get("/api/auth/status")).json();
  await page.goto("/function/tasks/detail?id=missing");
  if (!status.initialized) {
    await expect(page).toHaveURL(/\/setup$/);
    await page.getByPlaceholder("至少 8 位").fill(password);
    await page.getByPlaceholder("再次输入密码").fill(password);
    await page.locator('button[type="submit"]').click();
  } else {
    await expect(page).toHaveURL(/\/login$/);
    await page.getByPlaceholder("请输入密码").fill(password);
    await page.getByRole("button", { name: "登录" }).click();
  }
  await expect(page).toHaveURL(/\/function\/tasks$/);
  await expect(page).toHaveTitle(/Liora · 灵探/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("liora_token"))).toBeTruthy();
  await expect(page.locator('img[src="/liora-logo.png"]').first()).toBeVisible();
  await page.getByRole("button", { name: "布局与外观偏好", exact: true }).click();
  const preferences = page.locator('[data-slot="popover-content"]');
  await expect(preferences.getByText("偏好设置", { exact: true })).toBeVisible();
  await preferences.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "柔和波普" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preset", "soft-pop");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preset", "soft-pop");
  await expect(page.getByRole("button", { name: /当前主题：/ })).toBeVisible();
  await page.getByRole("button", { name: /当前主题：/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        await document.fonts.load('14px "Geist"');
        return document.fonts.check('14px "Geist"');
      }),
    )
    .toBe(true);

  // The current route manifest is also the production server's allowlist.
  for (const path of Object.values(paths)) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
  }
  for (const path of Object.values(paths).filter((path) => path.startsWith("/system/") || path === "/function/findings" || path === "/function/assets")) {
    if (path.endsWith("/detail")) continue;
    await page.goto(path);
    await expect(page.getByRole("button", { name: /当前主题：/ })).toBeVisible();
  }
  for (const path of ["/unknown", "/function/traffic", "/static/missing.js", "/lingtan-logo.png"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /当前主题：/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true });
  await page.getByRole("link", { name: "测试任务", exact: true }).first().click();
  await expect(page).toHaveURL(/\/function\/tasks/);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goForward();
  await expect(page).toHaveURL(/\/function\/tasks/);

  const token = await page.evaluate(() => localStorage.getItem("liora_token"));
  const created = await request.post("/api/tasks", {
    headers: { Authorization: `Bearer ${token}` },
    data: { description: "Liora 迁移回归", goal: "仅验证界面，不执行目标测试", seed_first_intent: false },
  });
  expect(created.status()).toBe(201);
  const task = await created.json();
  await page.goto(`/function/tasks/detail?id=${task.id}`);
  await expect(page.getByRole("heading", { name: "Liora 迁移回归" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Liora 迁移回归" })).toBeVisible();
  await page.getByRole("tab", { name: "探索链路", exact: true }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.getByRole("tab", { name: "资产覆盖图", exact: true }).click();
  await expect(page.getByRole("tab", { name: "资产覆盖图", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: testInfo.outputPath("task-coverage.png"), fullPage: true });

  // A real backend log stream must deliver a frame through the development proxy
  // and from the embedded production server, without a hardcoded backend port.
  const stream = await page.evaluate(async () => {
    const token = localStorage.getItem("liora_token");
    return await new Promise<string>((resolve, reject) => {
      const source = new EventSource(`/api/logs/stream?since=0&token=${encodeURIComponent(token ?? "")}`);
      const timer = setTimeout(() => {
        source.close();
        reject(new Error("SSE timed out"));
      }, 8000);
      source.onmessage = (event) => {
        clearTimeout(timer);
        source.close();
        resolve(event.data);
      };
      source.onerror = () => {
        clearTimeout(timer);
        source.close();
        reject(new Error("SSE failed"));
      };
    });
  });
  expect(JSON.parse(stream)).toHaveProperty("seq");
  await page.goto("/system/logs");
  await expect(page.getByText(/backend listening/).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/function/tasks");
  await expect(page.getByRole("button", { name: /当前主题：/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("tasks-mobile.png"), fullPage: true });

  // A rejected token must clear the shared auth state without a redirect loop.
  // The 401 path now lands on /login?expired=1 so the form can explain why.
  await page.evaluate(() => localStorage.setItem("liora_token", "invalid-token"));
  await page.goto("/function/tasks");
  await expect(page).toHaveURL(/\/login(\?expired=1)?$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("liora_token"))).toBeNull();
  await page.getByPlaceholder("请输入密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/function\/tasks$/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "账户菜单：管理员", exact: true }).click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
