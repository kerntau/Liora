import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const base = process.env.AUDIT_BASE || "http://127.0.0.1:15180";
const out = "../docs/frontend-audit-2026-10";
const shots = out + "/screenshots";
const now = "2026-10-21T12:00:00Z";
const task = { id: "42", name: "示例任务：核心业务回归", description: "对示例站点做一轮完整测试", goal: "验证登录、上传与权限边界", status: "running", created_at: now, created_unix: 1761048000, last_activity_unix: 1761051600, goals_total: 6, goals_met: 4, engine_mode: "exploring", paused: false, queued: false, active: true, in_flight: 2, llm_profile_ids: [1], active_llm_profile_id: 1, llm_profile_id: 1, category_id: 1, category_name: "Web 应用", tokens: { input_tokens: 12000, output_tokens: 1800, cache_read_tokens: 4000, cache_write_tokens: 0 } };
const task2 = { ...task, id: "43", name: "示例任务：API 资产梳理", description: "梳理开放 API 与鉴权", status: "done", active: false, in_flight: 0, goals_total: 5, goals_met: 5, pinned: true, created_at: "2026-10-18T09:00:00Z" };
const profiles = [{ id: 1, name: "默认配置", format: "openai", base_url: "https://api.example.com/v1", model: "deepseek-chat", rate_per_second: 5, rate_per_minute: 120, is_default: true, priority: 100, streaming: true }];
const settings = { traffic_capture: true, agent_traffic_binding: false, llm_record: true, web_search_enabled: false, web_search_backend: "ddgs", brave_key_set: false, tavily_key_set: false, workers: 3, task_concurrency_enabled: false, task_concurrency_limit: 5 };
function fixture(path) {
  if (path === "/api/health") return { version: "v2.2.0", status: "ok" };
  if (path === "/api/tasks") return { tasks: [task, task2], active: "42" };
  if (path === "/api/tasks/42") return task;
  if (path === "/api/stats") return { assets: 128, engine_mode: "exploring", llm_configured: true, roe_enabled: true, findings_confirmed: 9, active_task: task };
  if (path === "/api/assets/counts") return { root_domain: 4, subdomain: 12, ip: 3, url: 96, service: 8 };
  if (path === "/api/llm/profiles") return { profiles };
  if (path === "/api/llm/pool") return { enabled: true, bind_fallback: false, chain: [{ id: 1, name: "默认配置", model: "deepseek-chat", state: "ok", active: true, priority: 100, failures: 0 }] };
  if (path === "/api/settings") return settings;
  if (path === "/api/task-categories") return { categories: [{ id: 1, name: "Web 应用", task_count: 2, created_at: now, updated_at: now }] };
  if (path === "/api/task-templates") return { templates: [{ id: 1, name: "Web 全量测试", description: "标准 Web 测试流程", goal: "覆盖 OWASP Top 10", created_at: now, updated_at: now }] };
  if (path === "/api/companies") return [{ id: 1, name: "示例企业", asset_count: 2, scope: [] }];
  if (path === "/api/tokens/usage") return { by_profile: [{ profile_name: "默认配置", tasks: 2, calls: 12, input_tokens: 30000, output_tokens: 3000, cache_read_tokens: 8000, cache_write_tokens: 0 }], daily: [{ profile_name: "默认配置", date: "2026-10-21", input_tokens: 30000, output_tokens: 3000, cache_read_tokens: 8000 }] };
  if (path === "/api/tokens/conversations") return [];
  if (path === "/api/traffic") return { exchanges: [{ id: "p1", host: "demo.example", url: "https://demo.example/", method: "GET", status: 200, ts: now }] };
  if (path === "/api/exploration/findings") return [];
  if (path === "/api/exploration/intents") return [];
  if (path === "/api/llm/records/by-model") return { models: [] };
  if (path === "/api/tasks/42/scope") return { scope: [] };
  if (path === "/api/tasks/42/goals") return { goals: [] };
  if (path === "/api/tasks/42/constraints") return { constraints: [] };
  if (path === "/api/exploration/nodes") return { items: [], total: 0, page: 1, size: 20, edges: [], refs: {}, assets: {} };
  if (path === "/api/auth/status") return { initialized: true };
  if (path.endsWith("/messages")) return { items: [], cursor: 0, hasMore: false, running: false };
  if (path.endsWith("/side-questions")) return { items: [], next_cursor: 0, snapshot: null };
  return {};
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript(() => localStorage.setItem("liora_token", "fixture.eyJzdWIiOiJMaW9yYSJ9.fixture"));
async function newPage() {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("EventSource")) errors.push(m.text().slice(0, 200)); });
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    let json = fixture(u.pathname);
    if (u.pathname === "/api/exploration/findings") json = u.searchParams.has("page") ? { items: [], total: 0, page: 1, page_size: 20 } : [];
    await route.fulfill({ json });
  });
  return { page, errors };
}
const steps = [];
async function step(name, fn, shot) {
  const { page, errors } = await newPage();
  const started = Date.now();
  let detail = {};
  try {
    detail = (await fn(page)) || {};
    if (shot) await page.screenshot({ path: shots + "/" + shot, fullPage: false, animations: "disabled" });
    steps.push({ name, ok: true, ms: Date.now() - started, detail, errors });
  } catch (e) {
    steps.push({ name, ok: false, ms: Date.now() - started, error: e.message.split("\n")[0], detail, errors });
    await page.screenshot({ path: shots + "/" + name.replace(/[^a-z0-9]+/gi, "-") + "-failed.png" }).catch(() => {});
  }
  await page.close();
}

await step("command-palette", async (page) => {
  await page.goto(base + "/function/tasks"); await page.waitForTimeout(1500);
  await page.keyboard.press("Control+j");
  const dialog = page.getByRole("dialog", { name: "搜索页面" });
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  const initial = await dialog.getByRole("option").count();
  await page.keyboard.type("漏洞");
  await page.waitForTimeout(500);
  const filtered = await dialog.getByRole("option").allTextContents();
  await page.screenshot({ path: shots + "/interaction-command-palette.png" });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const url = new URL(page.url()).pathname;
  await page.keyboard.press("Control+j"); await page.waitForTimeout(300);
  await page.keyboard.type("zzzz-no-match"); await page.waitForTimeout(400);
  const empty = await dialog.getByText("没有匹配的页面。").count();
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const closed = await page.getByRole("dialog", { name: "搜索页面" }).count();
  return { initial, filtered: filtered.slice(0, 6), navigatedTo: url, emptyState: empty > 0, closed: closed === 0, focusReturned: await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute("aria-label"), text: (document.activeElement?.textContent || "").trim().slice(0, 20) })) };
}, null);

await step("sidebar-toggle", async (page) => {
  await page.goto(base + "/dashboard"); await page.waitForTimeout(1200);
  const width = () => page.evaluate(() => { const el = document.querySelector('[data-slot="sidebar-container"]'); return el ? Math.round(el.getBoundingClientRect().width) : -1; });
  const before = await width();
  await page.keyboard.press("Control+b"); await page.waitForTimeout(600);
  const after = await width();
  const state = await page.evaluate(() => document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state"));
  await page.screenshot({ path: shots + "/interaction-sidebar-collapsed.png" });
  await page.keyboard.press("Control+b"); await page.waitForTimeout(600);
  return { before, after, state, restored: await width() };
}, null);

await step("theme-cycle", async (page) => {
  await page.goto(base + "/dashboard"); await page.waitForTimeout(1200);
  const mode = () => page.evaluate(() => ({ cls: document.documentElement.className, theme: document.documentElement.dataset.theme || "", preset: document.documentElement.dataset.themePreset || "" }));
  const start = await mode();
  const button = page.getByRole("button", { name: /当前主题/ });
  const label0 = await button.getAttribute("aria-label");
  await button.click(); await page.waitForTimeout(500);
  const after1 = await mode();
  const label1 = await button.getAttribute("aria-label");
  await button.click(); await page.waitForTimeout(500);
  const after2 = await mode();
  await button.click(); await page.waitForTimeout(500);
  const after3 = await mode();
  return { start, label0, after1, label1, after2, after3 };
}, "interaction-theme-dark.png");

await step("create-task-sheet", async (page) => {
  await page.goto(base + "/function/tasks"); await page.waitForTimeout(1400);
  const trigger = page.getByRole("button", { name: "新建任务", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "新建任务", exact: true });
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  const fields = await dialog.locator("input,textarea,button[role=combobox]").count();
  const required = await dialog.locator("[required]").count();
  await page.screenshot({ path: shots + "/interaction-create-task.png" });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  const closed = await page.getByRole("dialog", { name: "新建任务", exact: true }).count();
  return { fields, required, closed: closed === 0, focusReturned: await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20)) };
}, null);

await step("task-row-actions", async (page) => {
  await page.goto(base + "/function/tasks"); await page.waitForTimeout(1400);
  const pin = page.getByRole("button", { name: "置顶任务 #42" });
  const pinVisible = await pin.count();
  let pinLabel = "";
  if (pinVisible) {
    await pin.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(700);
    pinLabel = (await page.getByRole("button", { name: /置顶任务 #42|取消置顶任务 #42/ }).first().getAttribute("aria-label").catch(() => "")) || "";
  }
  const pause = page.getByRole("button", { name: "暂停任务" }).first();
  const pauseVisible = await pause.count();
  if (pauseVisible) { await pause.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); }
  const archive = page.getByRole("button", { name: "归档任务 #42" });
  const archiveVisible = await archive.count();
  let dialogTitle = "";
  if (archiveVisible) {
    await archive.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    dialogTitle = await page.evaluate(() => (document.querySelector('[role=alertdialog]')?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80));
    await page.screenshot({ path: shots + "/interaction-archive-confirm.png" });
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  return { pinVisible, pinLabel, pauseVisible, archiveVisible, dialogTitle, archiveClosed: (await page.getByRole("alertdialog").count()) === 0 };
}, null);

await step("task-detail-tabs", async (page) => {
  await page.goto(base + "/function/tasks/detail?id=42"); await page.waitForTimeout(1600);
  const tabs = ["执行过程", "总览", "探索链路", "播报板", "漏洞结果", "测试资产", "资产覆盖图", "拦截审批", "报告"];
  const results = [];
  for (const label of tabs) {
    const tab = page.getByRole("tab", { name: label, exact: true });
    if (!(await tab.count())) { results.push({ label, missing: true }); continue; }
    await tab.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(350);
    const selected = await tab.getAttribute("aria-selected");
    const panelText = await page.evaluate(() => [...document.querySelectorAll('[role=tabpanel]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(e => e.textContent || "").join(" "));
    results.push({ label, selected, panelChars: panelText.replace(/\s+/g, " ").trim().length });
  }
  await page.getByRole("tab", { name: "总览", exact: true }).focus();
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(300);
  const keyboard = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
  await page.screenshot({ path: shots + "/interaction-task-tabs.png" });
  return { results, keyboardFocus: keyboard };
}, null);

await step("settings-keyboard-select", async (page) => {
  await page.goto(base + "/system/settings"); await page.waitForTimeout(1500);
  const select = page.getByRole("combobox", { name: /发送方式/ });
  await select.focus();
  await page.keyboard.press("ArrowDown"); await page.waitForTimeout(400);
  const listbox = await page.getByRole("listbox").count();
  const focusedOption = await page.evaluate(() => document.activeElement?.textContent?.trim());
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  return { listboxVisible: listbox > 0, focusedOption, focusBack: await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.id) };
}, null);

await step("mobile-sidebar", async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/dashboard"); await page.waitForTimeout(1500);
  const trigger = page.getByRole("button", { name: "切换侧边栏" });
  const triggerBefore = await trigger.isVisible().catch(() => false);
  await trigger.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600);
  const dialog = await page.getByRole("dialog").count();
  await page.screenshot({ path: shots + "/interaction-mobile-sidebar.png" });
  return { triggerBefore, dialogCount: dialog, bodyScrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), innerWidth: await page.evaluate(() => innerWidth) };
}, null);

await step("focus-visibility", async (page) => {
  await page.goto(base + "/function/tasks"); await page.waitForTimeout(1400);
  const samples = [];
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab"); await page.waitForTimeout(80);
    samples.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const s = getComputedStyle(el);
      return { tag: el.tagName, name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24), outline: s.outlineStyle + " " + s.outlineWidth, shadow: s.boxShadow === "none" ? "" : "shadow" };
    }));
  }
  await page.screenshot({ path: shots + "/interaction-focus.png" });
  return { count: samples.length, withOutline: samples.filter(s => s && s.outline.includes("solid") && !s.outline.endsWith("0px")).length, withShadow: samples.filter(s => s && s.shadow).length, samples: samples.slice(0, 8) };
}, null);

await step("not-found-client", async (page) => {
  await page.goto(base + "/function/tasks"); await page.waitForTimeout(1200);
  await page.evaluate(() => { history.pushState({}, "", "/not-a-page"); dispatchEvent(new PopStateEvent("popstate")); });
  await page.waitForTimeout(600);
  const h1 = await page.locator("h1").textContent().catch(() => "");
  const button = await page.getByRole("button", { name: "返回首页" }).count();
  await page.screenshot({ path: shots + "/interaction-not-found.png" });
  return { h1, button };
}, null);

// login validation in anon context
{
  const anon = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await anon.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/**", r => r.fulfill({ json: fixture(new URL(r.request().url()).pathname) }));
  await page.goto(base + "/login"); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /登录/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  const text = await page.locator("form").innerText().catch(() => "");
  const validity = await page.evaluate(() => { const form = document.querySelector("form"); const inputs = [...document.querySelectorAll("input")]; return { formValid: form?.checkValidity?.(), invalid: inputs.filter(i => !i.checkValidity()).map(i => ({ name: i.name, message: i.validationMessage })) }; });
  await page.screenshot({ path: shots + "/interaction-login-validation.png" });
  steps.push({ name: "login-validation", ok: true, detail: { hasError: /必填|请输入|不能为空/.test(text), text: text.replace(/\s+/g, " ").slice(0, 160), ...validity }, errors });
  await anon.close();
}

writeFileSync(out + "/data/interactions.json", JSON.stringify({ generatedAt: new Date().toISOString(), steps }, null, 2));
console.log(JSON.stringify(steps.map(s => ({ name: s.name, ok: s.ok, error: s.error, detail: s.detail, errors: s.errors?.length })), null, 2));
await browser.close();
