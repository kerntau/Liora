import { expect, type Page, test } from "@playwright/test";

async function fixture(page: Page) {
  await page.addInitScript(() => localStorage.setItem("liora_token", "ui-foundation-fixture"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data: Record<string, unknown> = {
      "/api/tasks": { tasks: [{ id: "ui-audit", description: "界面交互检查", goal: "仅验证界面", status: "created", created_at: "2026-10-19T00:00:00Z" }] },
      "/api/task-categories": { categories: [] },
      "/api/task-archives": { items: [], total: 0 },
      "/api/llm/profiles": { profiles: [] },
      "/api/intercept/pending": { pending: [] },
      "/api/settings": { workers: 3 },
      "/api/findings": { findings: [], items: [], total: 0 },
      "/api/exploration/findings": { items: [], total: 0 },
      "/api/exploration/findings/stats": { total: 0, pending: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0, vulnclasses: [], tasks: [] },
      "/api/health": { version: "ui-audit" },
    };
    await route.fulfill({ json: data[path] ?? {} });
  });
}

test("tabs, navigation and checkbox styles reflect their actual state", async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto("/function/tasks");
  const current = page.getByRole("tab", { name: "当前任务", exact: true });
  await expect(current).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "已归档", exact: true })).toHaveAttribute("aria-selected", "false");
  const panel = page.getByRole("tabpanel", { name: "当前任务", exact: true });
  const tabBox = await current.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(panelBox!.y).toBeGreaterThanOrEqual(tabBox!.y + tabBox!.height);
  await expect(page.locator('[data-slot="sidebar-menu-button"][data-active]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: "测试任务", exact: true })).toHaveAttribute("aria-current", "page");
  const selection = page.getByRole("checkbox", { name: "选择任务 ui-audit", exact: true });
  await selection.check();
  await expect(selection).toBeChecked();
  await expect(selection).toHaveAttribute("data-state", "checked");
  await selection.uncheck();
  await expect(selection).toHaveAttribute("data-state", "unchecked");
  await page.screenshot({ path: testInfo.outputPath("tasks-desktop.png"), fullPage: true });
});

test("confirmation fits a small screen and cancellation restores focus without deleting", async ({ page }) => {
  await fixture(page);
  const deletes: string[] = [];
  page.on("request", (request) => { if (request.method() === "DELETE") deletes.push(request.url()); });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/function/tasks");
  const trigger = page.getByRole("button", { name: "删除任务", exact: true });
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: "确认删除任务 #ui-audit？", exact: true });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.height).toBeLessThanOrEqual(667 * 0.91);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(deletes).toEqual([]);

  await page.setViewportSize({ width: 667, height: 375 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await trigger.click();
  await expect(dialog).toBeVisible();
  const landscapeBounds = await dialog.boundingBox();
  expect(landscapeBounds!.x).toBeGreaterThanOrEqual(0);
  expect(landscapeBounds!.x + landscapeBounds!.width).toBeLessThanOrEqual(667);
  expect(landscapeBounds!.height).toBeLessThanOrEqual(375 * 0.91);
});

test("export radios retain independent controlled groups and keyboard selection", async ({ page }) => {
  await fixture(page);
  await page.goto("/function/findings");
  const trigger = page.getByRole("button", { name: "导出", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "导出发现", exact: true });
  await expect(dialog).toBeVisible();
  const all = dialog.getByRole("radio", { name: "导出全部", exact: true });
  await all.check();
  const csv = dialog.getByRole("radio", { name: "CSV 表格（.csv）", exact: true });
  await csv.check();
  await expect(all).toBeChecked();
  await expect(csv).toBeChecked();
  await csv.focus();
  await page.keyboard.down("ArrowDown");
  await expect(dialog.getByRole("radio", { name: "JSON（.json）", exact: true })).toBeChecked();
  await page.keyboard.up("ArrowDown");
  await expect(dialog.getByRole("radio", { name: "导出勾选的 0 条", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("theme text pairs stay readable in all presets and reduced motion removes transitions", async ({ page }, testInfo) => {
  await fixture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/function/tasks");
  await expect(page.getByRole("tab", { name: "当前任务", exact: true })).toBeVisible();
  const pairs = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const luminance = (color: string) => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((n) => {
        const v = n / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const results: { preset: string; mode: string; pair: string; ratio: number }[] = [];
    for (const preset of ["default", "brutalist", "soft-pop", "tangerine"]) {
      document.documentElement.dataset.themePreset = preset;
      for (const mode of ["light", "dark"]) {
        document.documentElement.classList.toggle("dark", mode === "dark");
        const styles = getComputedStyle(document.documentElement);
        for (const [fg, bg] of [["foreground", "background"], ["card-foreground", "card"], ["popover-foreground", "popover"], ["primary-foreground", "primary"], ["secondary-foreground", "secondary"], ["muted-foreground", "muted"]]) {
          const a = luminance(styles.getPropertyValue("--" + fg));
          const b = luminance(styles.getPropertyValue("--" + bg));
          results.push({ preset, mode, pair: fg + "/" + bg, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
        }
      }
    }
    document.documentElement.dataset.themePreset = "default";
    document.documentElement.classList.remove("dark");
    return results;
  });
  await testInfo.attach("theme-contrast", { body: JSON.stringify(pairs, null, 2), contentType: "application/json" });
  for (const pair of pairs) expect.soft(pair.ratio, JSON.stringify(pair)).toBeGreaterThanOrEqual(4.5);
  const duration = await page.locator('[data-slot="sidebar-container"]').evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration.split(",").every((part) => parseFloat(part) < 0.001)).toBe(true);
});
