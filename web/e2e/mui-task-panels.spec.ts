import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

import type { Asset, ExploreKind, TaskNode } from "../src/lib/types";

async function createTask(page: Page, request: APIRequestContext, description: string) {
  const password = "liora-e2e-password";
  const { initialized } = await (await request.get("/api/auth/status")).json();
  const auth = await request.post(initialized ? "/api/auth/login" : "/api/auth/init", {
    data: initialized ? { username: "Liora", password } : { password },
  });
  expect(auth.ok()).toBe(true);
  const { token } = await auth.json();
  await page.addInitScript((value) => localStorage.setItem("liora_token", value), token);
  const created = await request.post("/api/tasks", {
    headers: { Authorization: `Bearer ${token}` },
    data: { description, goal: "仅验证界面，不执行外部操作", seed_first_intent: false },
  });
  expect(created.status()).toBe(201);
  return String((await created.json()).id);
}

test("task assets preserve scoped pagination, DSL typing, registration and detach confirmation", async ({
  page,
  request,
}, testInfo) => {
  const id = await createTask(page, request, "MUI 资产回归");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let roots: Asset[] = Array.from({ length: 52 }, (_, index) => ({
    id: index + 1,
    type: "root_domain",
    domain: `asset-${String(index + 1).padStart(3, "0")}.invalid`,
    task_ids: [Number(id)],
    last_seen: new Date().toISOString(),
    task_source: "manual",
    task_source_summary: "手动登记 fixture 范围",
  }));
  const queries: URL[] = [];
  const registrations: unknown[] = [];
  const detached: number[] = [];
  let globalDeletes = 0;
  await page.route("**/api/assets", async (route) => {
    if (route.request().method() !== "GET") globalDeletes++;
    await route.fulfill({ status: 400, json: { error: "unexpected unscoped asset request" } });
  });
  await page.route("**/api/assets?*", async (route) => {
    if (route.request().method() !== "GET") {
      globalDeletes++;
      await route.fulfill({ status: 400, json: { error: "unexpected global mutation" } });
      return;
    }
    const url = new URL(route.request().url());
    queries.push(url);
    const dsl = url.searchParams.get("dsl");
    if (dsl?.includes("???")) {
      await route.fulfill({ status: 400, json: { error: "fixture DSL syntax error" } });
      return;
    }
    let rows: Asset[] =
      url.searchParams.get("type") === "ip"
        ? [{ id: 100, type: "ip", ip: "192.0.2.1", task_ids: [Number(id)], last_seen: new Date().toISOString() }]
        : roots;
    if (dsl) rows = rows.filter((asset) => asset.domain === dsl.replace("domain==", ""));
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    await route.fulfill({ json: { assets: rows.slice(offset, offset + limit), total: rows.length } });
  });
  await page.route("**/api/assets/counts?*", (route) => route.fulfill({ json: { root_domain: roots.length, ip: 1 } }));
  await page.route(`**/api/tasks/${id}/assets`, async (route) => {
    registrations.push(route.request().postDataJSON());
    roots = [{ ...roots[0], id: 999, domain: "registered.fixture.invalid" }, ...roots];
    await route.fulfill({
      json: { requested: 1, assets_linked: 1, assets_existing: 0, scopes_added: 1, scopes_existing: 0 },
    });
  });
  await page.route(`**/api/tasks/${id}/assets/*`, async (route) => {
    expect(route.request().method()).toBe("DELETE");
    const assetID = Number(new URL(route.request().url()).pathname.split("/").at(-1));
    detached.push(assetID);
    roots = roots.filter((asset) => asset.id !== assetID);
    await route.fulfill({ json: { detached: 1 } });
  });
  await page.goto(`/function/tasks/detail?id=${id}`);
  await page.getByRole("tab", { name: "测试资产", exact: true }).click();
  const table = page.getByRole("table", { name: "测试资产列表" });
  await expect(table.getByText("asset-001.invalid", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "每页数量" }).click();
  await page.getByRole("option", { name: "25 / 页", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.searchParams.get("limit")).toBe("25");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(table.getByText("asset-026.invalid", { exact: true })).toBeVisible();
  const source = table.locator('[data-slot="badge"]').filter({ hasText: "人工加入" }).first();
  await source.hover();
  await expect(page.getByRole("tooltip")).toContainText("手动登记 fixture 范围");
  await page.mouse.move(0, 0);

  const search = page.getByRole("textbox", { name: "DSL 资产搜索" });
  await search.click();
  await search.pressSequentially("domain==asset-002.invalid");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("domain==asset-002.invalid");
  await search.press("Escape");
  await expect(table.getByText("asset-002.invalid", { exact: true })).toBeVisible();
  await expect.poll(() => queries.at(-1)?.searchParams.get("offset")).toBe("0");
  await search.fill("domain ???");
  await search.press("Escape");
  await expect(page.getByText("fixture DSL syntax error", { exact: true })).toBeVisible();
  // 新框架：DSL 搜索框的清除入口改成行内小图标（aria-label="清除搜索"），
  // 不再是抢占输入区的「清除」文字按钮。
  const clearSearch = search.locator("xpath=..").getByRole("button", { name: "清除搜索", exact: true });
  await expect(clearSearch).toBeVisible();
  await clearSearch.click();
  await expect(search).toHaveValue("");
  await page.getByRole("tab", { name: /^IP / }).click();
  await expect(table.getByText("192.0.2.1", { exact: true })).toBeVisible();
  await expect(search).toHaveValue("");
  await page.getByRole("tab", { name: /^根域名/ }).click();
  await expect(table.getByText("asset-001.invalid", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "新增测试资产", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "新增测试资产", exact: true });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "取消", exact: true }).click();
  await expect(drawer).toBeHidden();
  expect(registrations).toHaveLength(0);
  await page.getByRole("button", { name: "新增测试资产", exact: true }).click();
  await drawer.getByRole("textbox", { name: "测试资产与范围", exact: true }).fill("registered.fixture.invalid");
  await drawer.getByRole("button", { name: /登记 1 条/ }).click();
  await expect(drawer).toBeHidden();
  expect(registrations).toEqual([{ scope: [{ kind: "domain", value: "registered.fixture.invalid" }] }]);
  await expect(table.getByText("registered.fixture.invalid", { exact: true })).toBeVisible();
  const remove = table.getByRole("button", { name: "将资产 registered.fixture.invalid 移出任务", exact: true });
  await remove.click();
  const confirmation = page.getByRole("alertdialog", { name: "移出当前任务？", exact: true });
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();
  await expect(confirmation).toBeHidden();
  expect(detached).toHaveLength(0);
  await remove.click();
  await confirmation.getByRole("button", { name: "确认移出", exact: true }).click();
  await expect.poll(() => detached).toEqual([999]);
  await expect(table.getByText("registered.fixture.invalid", { exact: true })).toHaveCount(0);
  expect(globalDeletes).toBe(0);
  expect(queries.every((url) => url.searchParams.get("task_id") === id)).toBe(true);

  // 新框架导航：任务详情页由底部 Dock 高亮「测试任务」，旧左侧固定侧栏不再渲染。
  const dock = page.locator('nav[aria-label="主导航"]');
  await expect(dock).toBeVisible();
  await expect(dock.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(dock.locator('a[aria-current="page"]')).toHaveAttribute("href", "/function/tasks");
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("task-assets-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("broadcast preserves node relationships, filters, pagination and the live-position unread count", async ({
  page,
  request,
}, testInfo) => {
  const id = await createTask(page, request, "MUI 播报回归");
  await page.clock.install();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const now = Date.now();
  const nodes: TaskNode[] = Array.from({ length: 45 }, (_, index) => {
    const type = ["fact", "intent", "finding"][index % 3] as ExploreKind;
    return {
      id: `node-${index + 1}`,
      type,
      state: type === "intent" ? "running" : "confirmed",
      priority: 1,
      origin: "fixture",
      ts: new Date(now - index * 1000).toISOString(),
      payload: JSON.stringify({ summary: `播报 ${String(index + 1).padStart(2, "0")} fixture` }),
    };
  });
  const origin: TaskNode = {
    id: "origin",
    type: "fact",
    state: "origin",
    priority: 0,
    origin: "fixture",
    ts: new Date(now).toISOString(),
    payload: JSON.stringify({ description: "关联起点详情" }),
  };
  const queries: URL[] = [];
  let extra = 0;
  await page.route("**/api/exploration/nodes?*", async (route) => {
    const url = new URL(route.request().url());
    queries.push(url);
    let rows = [
      ...Array.from({ length: extra }, (_, index) => ({
        ...nodes[0],
        id: `fresh-${index + 1}`,
        payload: JSON.stringify({ summary: `新播报 ${index + 1}` }),
      })),
      ...nodes,
    ];
    const kinds = url.searchParams.get("kind")?.split(",");
    if (kinds?.length) rows = rows.filter((node) => kinds.includes(node.type));
    const q = url.searchParams.get("q");
    if (q) rows = rows.filter((node) => node.payload?.includes(q));
    if (url.searchParams.get("order") === "asc") rows.reverse();
    const size = Number(url.searchParams.get("size"));
    const pageNumber = Number(url.searchParams.get("page"));
    await route.fulfill({
      json: {
        items: rows.slice((pageNumber - 1) * size, pageNumber * size),
        total: rows.length,
        page: pageNumber,
        size,
        edges: [{ src: "origin", dst: "node-1", rel: "yields" }],
        refs: { origin },
        assets: { "node-1": [{ id: "asset-1", type: "root_domain", label: "broadcast.fixture.invalid" }] },
      },
    });
  });
  await page.goto(`/function/tasks/detail?id=${id}`);
  await page.getByRole("tab", { name: "播报板", exact: true }).click();
  const first = page.getByRole("button", { name: /#node-1 .*播报 01 fixture/ });
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("broadcast.fixture.invalid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "查看节点 #origin 详情", exact: true }).focus();
  await page.clock.fastForward(200);
  const preview = page.getByRole("tooltip");
  await expect(preview.getByText("关联起点详情", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-slot="hover-card-content"]')).toHaveCount(0);
  const kinds = page.getByRole("group", { name: "播报类型" });
  await kinds.getByRole("button", { name: "事实", exact: true }).click();
  await kinds.getByRole("button", { name: "漏洞", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.searchParams.get("kind")).toBe("fact,finding");
  await expect(kinds.getByRole("button", { name: "事实", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "清除", exact: true }).click();
  await expect.poll(() => queries.at(-1)?.searchParams.has("kind")).toBe(false);
  await page.getByRole("button", { name: "当前最新在前，点击改为最早在前" }).click();
  await expect(page.getByRole("button", { name: /#node-45 .*播报 45 fixture/ })).toBeVisible();
  await page.getByRole("button", { name: "当前最早在前，点击改为最新在前" }).click();
  const search = page.getByRole("textbox", { name: "搜索播报", exact: true });
  await search.fill("播报 01");
  await expect.poll(() => queries.at(-1)?.searchParams.get("q")).toBe("播报 01");
  await expect(page.getByRole("button", { name: "下一页", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "清除播报搜索" }).click();
  await expect(page.getByRole("button", { name: "下一页", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  const historical = page.getByRole("button", { name: /#node-40 .*播报 40 fixture/ });
  await expect(historical).toBeVisible();
  extra = 3;
  await page.clock.fastForward(8001);
  const unread = page.getByRole("button", { name: /3 条新播报 · 回到最新/ });
  await expect(unread).toBeVisible();
  await expect(historical).toBeVisible();
  await unread.click();
  await expect(page.getByRole("button", { name: /#fresh-1 .*新播报 1/ })).toBeVisible();
  const live = page.getByRole("button", { name: "暂停自动刷新", exact: true });
  await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/exploration/nodes"),
    live.click(),
  ]);
  await expect(page.getByRole("button", { name: "恢复自动刷新", exact: true })).toHaveAttribute("aria-pressed", "false");
  const pausedRequests = queries.length;
  await page.clock.fastForward(16000);
  expect(queries).toHaveLength(pausedRequests);
  expect(queries.every((url) => url.searchParams.get("task") === id)).toBe(true);
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  const panelId = await first.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();

  // 新框架导航：播报板所在的任务详情页高亮底部 Dock 的「测试任务」。
  const dock = page.locator('nav[aria-label="主导航"]');
  await expect(dock).toBeVisible();
  await expect(dock.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(dock.locator('a[aria-current="page"]')).toHaveAttribute("href", "/function/tasks");
  await expect(page.locator('[data-slot="sidebar"]')).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("broadcast-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("broadcast-mobile.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
