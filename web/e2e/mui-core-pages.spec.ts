import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  const password = "liora-e2e-password";
  const { initialized } = await (await request.get("/api/auth/status")).json();
  const auth = await request.post(initialized ? "/api/auth/login" : "/api/auth/init", {
    data: initialized ? { username: "Liora", password } : { password },
  });
  expect(auth.ok()).toBe(true);
  const { token } = await auth.json();
  await page.addInitScript((value) => localStorage.setItem("liora_token", value), token);
}

/**
 * 新框架的导航断言（替代旧的左侧固定侧栏断言）：
 * - 底部浮动 Dock（nav[aria-label="主导航"]）承担页面导航，当前项带 aria-current=page；
 * - 顶部顶栏的 Logo 绝对居中（旧版 Logo 在左上角）；
 * - 旧的左侧固定侧栏不再渲染，内容区从视口左缘开始；
 * - ⌘K 命令面板负责搜索式跳转。
 */
async function expectNewFrameworkNavigation(page: import("@playwright/test").Page, currentHref: string) {
  const dock = page.locator('nav[aria-label="主导航"]');
  await expect(dock).toBeVisible();
  await expect(dock.locator("a")).toHaveCount(13);
  const active = dock.locator('a[aria-current="page"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute("href", currentHref);

  // 旧侧栏已移除：DOM 里不再有 sidebar 组件，内容区贴着视口左缘。
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);
  const contentLeft = await page.evaluate(() => {
    const header = document.querySelector("header");
    const content = header?.nextElementSibling as HTMLElement | null;
    return content ? content.getBoundingClientRect().x : -1;
  });
  expect(contentLeft).toBeLessThanOrEqual(1);

  // 顶栏 Logo 水平居中（不再是左上角）。
  const logo = page.locator('header a[aria-label="Liora · 灵探"]');
  await expect(logo).toBeVisible();
  const viewportWidth = page.viewportSize()?.width ?? 1440;
  const logoBox = await logo.boundingBox();
  expect(logoBox).not.toBeNull();
  expect(Math.abs(logoBox!.x + logoBox!.width / 2 - viewportWidth / 2)).toBeLessThanOrEqual(2);
}

test("asset, finding and task pages render with the new top-bar, command palette and bottom dock navigation", async ({
  page,
  request,
}) => {
  await login(page, request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/function/assets");
  await expect(page.getByRole("heading", { name: "测试资产", exact: true })).toBeVisible();
  await expectNewFrameworkNavigation(page, "/function/assets");
  await expect(page.getByRole("tab", { name: /企业/ })).toBeVisible();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  const rootDomainTab = page.getByRole("tab", { name: /根域名/ });
  await rootDomainTab.click();
  await expect(rootDomainTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();

  await page.goto("/function/findings");
  await expect(page.getByRole("heading", { name: "漏洞结果", exact: true })).toBeVisible();
  await expectNewFrameworkNavigation(page, "/function/findings");
  await expect(page.getByRole("tab", { name: "全部发现", exact: true })).toBeVisible();
  const groupedTab = page.getByRole("tab", { name: "按任务分组", exact: true });
  await groupedTab.click();
  await expect(groupedTab).toHaveAttribute("aria-selected", "true");

  await page.goto("/function/tasks");
  await expect(page.getByRole("heading", { name: "测试任务", exact: true })).toBeVisible();
  await expectNewFrameworkNavigation(page, "/function/tasks");
  await expect(page.getByRole("tab", { name: "当前任务", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "已归档", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();

  // ⌘K 命令面板：替代旧的侧栏搜索框，输入名称回车即可跳转。
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  const paletteInput = palette.getByPlaceholder("输入页面或操作名称…");
  await expect(paletteInput).toBeVisible();
  await paletteInput.fill("测试资产");
  await paletteInput.press("Enter");
  await expect(page).toHaveURL(/\/function\/assets\/?$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNewFrameworkNavigation(page, "/function/assets");

  expect(errors).toEqual([]);
});
