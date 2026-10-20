import { expect, type Page, test } from "@playwright/test";

// Keep navigation checks independent of the operator's runtime and backend data.
async function openFixture(page: Page, path = "/function/tasks") {
  await page.addInitScript(() => localStorage.setItem("liora_token", "ui-navigation-audit"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path === "/api/health") body = { version: "v2.2.0" };
    if (path === "/api/tasks") body = { tasks: [], active: "" };
    if (path === "/api/task-categories") body = { categories: [] };
    if (path === "/api/task-archives") body = { items: [], total: 0 };
    if (path === "/api/companies")
      body = [
        { id: 1, name: "正常图标企业", logo: "/liora-icon.png", asset_count: 0 },
        { id: 2, name: "故障图标企业", logo: "/avatar-missing.png", asset_count: 0 },
        { id: 3, name: "默认图标企业", asset_count: 0 },
      ];
    if (path === "/api/intercept/pending") body = { pending: [] };
    if (path === "/api/intercept/history") body = { items: [], total: 0 };
    if (path === "/api/logs") body = { items: [], logs: [], cursor: 0 };
    if (path === "/api/auth/status") body = { initialized: true };
    await route.fulfill({ json: body });
  });
  await page.goto(path);
  await expect(page.getByRole("button", { name: "搜索页面", exact: true })).toBeVisible();
}

test("page search filters, selects by mouse and keyboard, and preserves IME input", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFixture(page);
  const trigger = page.getByRole("button", { name: "搜索页面", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "搜索页面", exact: true });
  const input = dialog.getByRole("combobox", { name: "搜索页面", exact: true });
  await expect(input).toBeFocused();
  await expect(dialog.getByRole("option")).toHaveCount(9);
  await expect(dialog.getByText("没有匹配的页面。")).toHaveCount(0);

  await input.fill("不存在的页面");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toHaveText("没有匹配的页面。");
  await input.fill("系统 设置");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/function\/tasks\/?$/);
  await input.dispatchEvent("compositionend");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/system\/settings\/?$/);
  await expect(dialog).toHaveCount(0);

  await trigger.click();
  await input.fill("测试");
  const options = dialog.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await input.press("ArrowUp");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await input.press("ArrowDown");
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/function\/tasks\/?$/);
  await trigger.click();
  await input.fill("系统设置");
  await dialog.getByRole("option", { name: "系统设置", exact: true }).click();
  await expect(page).toHaveURL(/\/system\/settings\/?$/);
  expect(errors).toEqual([]);
});

test("search shortcut toggles and clears the palette and restores focus", async ({ page }) => {
  await openFixture(page);
  const trigger = page.getByRole("button", { name: "搜索页面", exact: true });
  await trigger.focus();
  await page.keyboard.press("Control+j");
  const dialog = page.getByRole("dialog", { name: "搜索页面", exact: true });
  const input = dialog.getByRole("combobox", { name: "搜索页面", exact: true });
  await expect(input).toBeFocused();
  await input.fill("设置");
  await page.keyboard.press("Control+j");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Control+j");
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await input.fill("设置");
  await dialog.getByRole("button", { name: "关闭页面搜索" }).click();
  await trigger.click();
  await expect(input).toHaveValue("");
});

test("preferences persist across reload and account menu is keyboard accessible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFixture(page);
  await page.getByRole("button", { name: "布局与外观偏好", exact: true }).click();
  const preferences = page.locator('[data-slot="popover-content"]');
  await expect(preferences.getByText("偏好设置", { exact: true })).toBeVisible();
  await preferences.getByRole("combobox", { name: "主题预设", exact: true }).click();
  await page.getByRole("option", { name: "柔和波普", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preset", "soft-pop");
  await expect(preferences).toBeVisible();
  await preferences.getByLabel("居中内容", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-content-layout", "centered");
  await preferences.getByLabel("深色主题", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preset", "soft-pop");
  await expect(page.locator("html")).toHaveAttribute("data-content-layout", "centered");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "dark");

  const account = page.locator("header").getByRole("button", { name: "账户菜单：管理员", exact: true });
  await account.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "修改密码", exact: true })).toBeVisible();
  const activeUser = page.getByRole("menuitem", { name: /管理员 操作员/ });
  await expect(activeUser.locator('[data-slot="avatar-fallback"]')).toHaveText("管");
  await expect(activeUser.locator("img")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  await page.getByRole("button", { name: /当前主题：深色/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "system");
  expect(errors).toEqual([]);
});

test("375px header controls remain in bounds and search works by touch", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openFixture(page);
  const header = page.locator("header");
  for (const name of ["切换侧边栏", "搜索页面", "布局与外观偏好", "账户菜单：管理员"]) {
    const button = header.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await header.getByRole("button", { name: "搜索页面", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "搜索页面", exact: true });
  await dialog.getByRole("combobox", { name: "搜索页面", exact: true }).fill("设置");
  await expect(dialog.getByRole("option")).toHaveCount(1);
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  await page.screenshot({ path: testInfo.outputPath("page-search-mobile.png"), fullPage: true, animations: "disabled" });
  await dialog.getByRole("button", { name: "关闭页面搜索" }).click();
  await page.screenshot({ path: testInfo.outputPath("navigation-mobile.png"), fullPage: true, animations: "disabled" });
});

test("avatars show either a loaded image or initials when images are missing or fail", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/avatar-missing.png", (route) => route.fulfill({ status: 404, body: "" }));
  await openFixture(page, "/function/assets");
  const loaded = page.getByRole("row").filter({ hasText: "正常图标企业" }).locator('[data-slot="avatar"]');
  const failed = page.getByRole("row").filter({ hasText: "故障图标企业" }).locator('[data-slot="avatar"]');
  const missing = page.getByRole("row").filter({ hasText: "默认图标企业" }).locator('[data-slot="avatar"]');
  await expect(loaded.getByRole("img")).toBeVisible();
  await expect(loaded.locator('[data-slot="avatar-fallback"]')).toHaveCount(0);
  await expect(failed.locator("img")).toBeHidden();
  await expect(failed.locator('[data-slot="avatar-fallback"]')).toHaveText("故");
  await expect(missing.locator("img")).toHaveCount(0);
  await expect(missing.locator('[data-slot="avatar-fallback"]')).toHaveText("默");
  await page.reload();
  await expect(loaded.getByRole("img")).toBeVisible();
  await expect(loaded.locator('[data-slot="avatar-fallback"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
