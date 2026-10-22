import { expect, test } from "@playwright/test";

import paths from "../src/routes.json" with { type: "json" };

const password = "liora-e2e-password";

// 迁移回归：重构后的框架不再有左侧固定导航，改为「顶部居中 Logo 顶栏 + ⌘K 命令面板
// + 底部浮动 Dock」。登录态、深链接、主题、字体、SSE 这些与框架无关的能力必须照旧成立；
// 页面级导航的断言改成 Dock / 命令面板 / PageHeader 返回链接。
test("authentication, deep links, theme, fonts and live SSE work with the cockpit UI", async ({ page, request }, testInfo) => {
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

  // 新框架：顶栏右侧是「当前主题」切换按钮（浅色 → 深色 → 跟随系统），
  // 旧的「布局与外观偏好」弹层（偏好设置 / 主题预设 / 居中内容）随侧栏一起被移除。
  const themeSwitcher = page.getByRole("button", { name: /当前主题：/ });
  await expect(themeSwitcher).toBeVisible();
  await themeSwitcher.click();
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

  // 主题预设改由 cookie 直接驱动（偏好设置 UI 已移除，但预设本身仍然生效）。
  await page.context().addCookies([{ name: "theme_preset", value: "soft-pop", url: page.url() }]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preset", "soft-pop");

  // 路由清单仍是生产服务器的 allowlist。
  for (const path of Object.values(paths)) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
  }
  for (const path of Object.values(paths).filter((path) => path.startsWith("/system/") || path === "/function/findings" || path === "/function/assets")) {
    if (path.endsWith("/detail")) continue;
    await page.goto(path);
    await expect(page.getByRole("button", { name: /当前主题：/ })).toBeVisible();
  }
  // 未知路由与静态资源：静态资源仍然 404；未知页面由 SPA 渲染品牌化 404（HTML 外壳 + 404 状态）。
  for (const path of ["/static/missing.js", "/lingtan-logo.png"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  // 未知路由：开发服务器（rsbuild）把一切回退到 index.html（200），内嵌的 Go 生产服务器
  // 则回退到 index.html 但保留 404 状态。两种情况下返回的都是 SPA 外壳，
  // 由前端渲染品牌化 404 页（见 ui-cockpit.spec.ts）。
  const unknown = await request.get("/unknown", { headers: { Accept: "text/html" } });
  expect(unknown.headers()["content-type"]).toContain("text/html");
  expect(await unknown.text()).toContain("<div id=\"root\">");

  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /当前主题：/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dashboard-desktop.png"), fullPage: true });

  // 页面级导航：旧框架点侧栏链接，新框架点底部 Dock 的入口。
  const dock = page.getByRole("navigation", { name: "主导航" });
  await expect(dock).toBeVisible();
  await dock.getByRole("link", { name: "测试任务" }).click();
  await expect(page).toHaveURL(/\/function\/tasks/);
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goForward();
  await expect(page).toHaveURL(/\/function\/tasks/);

  // 命令面板是第二条导航通道：Ctrl+K → 输入名称 → 回车跳转。
  await page.getByRole("button", { name: "打开命令面板" }).click();
  const palette = page.getByRole("combobox", { name: "搜索页面" });
  await expect(palette).toBeFocused();
  await palette.fill("总览");
  await page.locator('[data-slot="command-item"]').first().click();
  await expect(page).toHaveURL(/\/dashboard/);

  const token = await page.evaluate(() => localStorage.getItem("liora_token"));
  const created = await request.post("/api/tasks", {
    headers: { Authorization: `Bearer ${token}` },
    data: { description: "Liora 迁移回归", goal: "仅验证界面，不执行目标测试", seed_first_intent: false },
  });
  expect(created.status()).toBe(201);
  const task = await created.json();
  await page.goto(`/function/tasks/detail?id=${task.id}`);
  await expect(page.getByRole("heading", { name: "Liora 迁移回归" })).toBeVisible();
  // 详情页的返回入口取代了旧侧栏里的面包屑：头部左侧一个「返回上一页」箭头。
  await expect(page.getByRole("button", { name: "返回上一页" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Liora 迁移回归" })).toBeVisible();
  await page.getByRole("tab", { name: "探索链路", exact: true }).click();
  await expect(page.locator(".react-flow")).toBeVisible();
  await page.getByRole("tab", { name: "资产覆盖图", exact: true }).click();
  await expect(page.getByRole("tab", { name: "资产覆盖图", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: testInfo.outputPath("task-coverage.png"), fullPage: true });

  // 真实后端日志流必须穿过开发代理与内嵌生产服务器送达，不能硬编码后端端口。
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

  // 被拒绝的 token 必须清掉共享登录态，且不进入重定向死循环。
  // 401 现在落到 /login?expired=1，表单会说明原因。
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
