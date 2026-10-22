import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.AUDIT_BASE || "http://127.0.0.1:15180";
const outDir = "../docs/frontend-audit-2026-10";
const shots = outDir + "/screenshots";
mkdirSync(shots, { recursive: true });

const now = "2026-10-21T12:00:00Z";
const task = {
  id: "42", name: "示例任务：核心业务回归", description: "对示例站点做一轮完整测试", goal: "验证登录、上传与权限边界",
  status: "running", created_at: now, created_unix: 1761048000, last_activity_unix: 1761051600,
  goals_total: 6, goals_met: 4, engine_mode: "exploring", paused: false, queued: false, active: true,
  in_flight: 2, llm_profile_ids: [1], active_llm_profile_id: 1, llm_profile_id: 1, category_id: 1, category_name: "Web 应用",
  tokens: { input_tokens: 12000, output_tokens: 1800, cache_read_tokens: 4000, cache_write_tokens: 0 },
};
const task2 = { ...task, id: "43", name: "示例任务：API 资产梳理", description: "梳理开放 API 与鉴权", status: "done", active: false, in_flight: 0, goals_total: 5, goals_met: 5, created_at: "2026-10-18T09:00:00Z", completed_at: "2026-10-18T12:00:00Z" };
const finding = {
  id: "f-1", finding_id: "f-1", vulnclass: "SQL 注入", name: "登录接口 SQL 注入", severity: "high", status: "confirmed",
  summary: "登录接口的 username 参数存在报错注入。", evidence: "payload: admin' AND 1=1--", task_id: "42",
  task_description: task.name, ts: now, assets: [{ id: 1, type: "url", url: "https://demo.example/login", label: "https://demo.example/login" }],
};
const asset = { id: 1, type: "root_domain", company_id: 1, task_ids: [42], root_domain: "demo.example", domain: "demo.example", url: "https://demo.example", service_name: "HTTPS", open_ports: [{ port: 443, service: "https" }], created_at: now };
const profiles = [
  { id: 1, name: "默认配置", format: "openai", base_url: "https://api.example.com/v1", model: "deepseek-chat", rate_per_second: 5, rate_per_minute: 120, is_default: true, priority: 100, streaming: true },
  { id: 2, name: "备用配置", format: "anthropic", base_url: "https://api.example.com", model: "claude-sonnet", rate_per_second: 2, rate_per_minute: 60, is_default: false, priority: 50, streaming: true },
];
const settings = {
  traffic_capture: true, agent_traffic_binding: false, llm_record: true, web_search_enabled: false, web_search_backend: "ddgs",
  brave_key_set: false, tavily_key_set: false, workers: 3, task_concurrency_enabled: false, task_concurrency_limit: 5,
};
const agents = [
  { id: "1", key: "worker", name: "Worker", description: "执行具体测试步骤", role: "worker", builtin: true, enabled: true, max_turns: 0, mcp_count: 2, skill_count: 4, tool_count: 9 },
  { id: "2", key: "planner", name: "Planner", description: "规划测试路径", role: "planner", builtin: true, enabled: true, mcp_count: 1, skill_count: 2, tool_count: 6 },
];
const skills = [
  { name: "web-recon", description: "Web 资产侦察与指纹识别", files: ["SKILL.md"], mcps: ["fetch"], calls: 12, tasks: 3, usage_agents: ["worker"], last_used: now },
  { name: "auth-bypass", description: "认证绕过测试手册", files: ["SKILL.md"], mcps: [], calls: 4, tasks: 2, usage_agents: ["worker"] },
];
const mcps = [{ id: 1, name: "fetch", transport: "http", url: "https://mcp.example/fetch", args: [], env: {}, enabled: true, tools: ["fetch", "search"] }];
const tools = [
  { key: "http_request", system: true, description: "发送 HTTP 请求并记录流量", schema: { type: "object", properties: { url: { type: "string" } } }, agents: ["worker"], enabled: true, kind: "builtin", calls: 88 },
  { key: "shell", system: true, description: "执行 shell 命令", schema: { type: "object", properties: { cmd: { type: "string" } } }, agents: ["worker"], enabled: true, kind: "builtin", calls: 31 },
];
const rules = [
  { id: 1, name: "阻止危险删除", enabled: true, priority: 100, match_target: "tool_input", match_type: "regex", pattern: "rm\\s+-rf", action: "deny", message: "禁止删除根目录", timeout_enabled: false, timeout_seconds: 30, timeout_action: "deny", created_at: now, updated_at: now },
];
const approvals = [{ id: 1, rule_id: 1, task_id: "42", conversation_id: 7, conv_title: "示例对话", conv_agent_key: "worker", rule_name: "阻止危险删除", decision_source: "rule", tool_name: "shell", tool_input: "rm -rf /", status: "pending", created_at: now }];
const logs = [
  { seq: 1, ts: now, level: "info", tag: "server", text: "服务已启动" },
  { seq: 2, ts: now, level: "warn", tag: "llm", text: "请求重试 1/3" },
];
const conversations = [{ id: 7, title: "登录流程分析", agent_key: "worker", running: false, created_at: now, updated_at: now }];

function fixture(path) {
  if (path === "/api/health") return { version: "v2.2.0", status: "ok" };
  if (path === "/api/tasks") return { tasks: [task, task2], active: "42" };
  if (path === "/api/tasks/42") return task;
  if (path === "/api/stats") return { assets: 128, engine_mode: "exploring", llm_configured: true, roe_enabled: true, findings_confirmed: 9, active_task: task };
  if (path === "/api/assets/counts") return { root_domain: 4, subdomain: 12, ip: 3, url: 96, service: 8 };
  if (path === "/api/llm/profiles") return { profiles };
  if (path === "/api/llm/pool") return { enabled: true, bind_fallback: false, chain: [{ id: 1, name: "默认配置", model: "deepseek-chat", state: "ok", active: true, priority: 100, cooldown_until: null, failures: 0 }] };
  if (path === "/api/llm/retry-policy") return { llm: { retries: 2, interval_ms: 1000 }, http: { retries: 1, interval_ms: 500 }, tool: { retries: 0, interval_ms: 0 }, parse: { retries: 1, interval_ms: 0 }, stream: { retries: 1, interval_ms: 0 } };
  if (path === "/api/intercept/judge") return { enabled: true, profile_id: 0, prompt: "当没有规则命中时，判断该工具调用是否安全。", timeout_seconds: 30, fail_action: "ask", ask_timeout_seconds: 300, ask_timeout_action: "deny" };
  if (path === "/api/intercept/tool-config") return { enabled_tools: ["http_request", "shell"] };
  if (path === "/api/companies") return [{ id: 1, name: "示例企业", asset_count: 2, scope: [] }];
  if (path === "/api/exploration/findings/stats") return { total: 1, pending: 0, critical: 0, high: 1, medium: 0, low: 0, vulnclasses: ["SQL 注入"], tasks: [{ id: "42", name: task.name, description: task.description, count: 1 }] };
  if (path === "/api/exploration/findings/groups") return { items: [{ task_id: "42", task_name: task.name, task_description: task.description, task_status: "running", count: 1, critical: 0, high: 1, medium: 0, low: 0, last_found_at: now }], total: 1, finding_total: 1, page: 1, page_size: 20 };
  if (path === "/api/exploration/findings/asset-tree") return { nodes: [{ key: "demo.example", kind: "root_domain", label: "demo.example", self: 0, total: 1, critical: 0, high: 1, medium: 0, low: 0, last_found_at: now }], finding_total: 1, truncated: false };
  if (path === "/api/exploration/findings/retests/active") return { retests: [] };
  if (path === "/api/exploration/findings/f-1/retests") return { retests: [] };
  if (path === "/api/exploration/findings/f-1/traffic") return { finding_id: "f-1", version: 1, report_version: 1, bindings: [] };
  if (path === "/api/settings") return settings;
  if (path === "/api/task-categories") return { categories: [{ id: 1, name: "Web 应用", task_count: 2, created_at: now, updated_at: now }] };
  if (path === "/api/task-templates") return { templates: [{ id: 1, name: "Web 全量测试", description: "标准 Web 测试流程", goal: "覆盖 OWASP Top 10", created_at: now, updated_at: now }] };
  if (path === "/api/agents") return { agents };
  if (path === "/api/skills") return { skills };
  if (path === "/api/mcp/servers" || path === "/api/mcp") return { servers: mcps, tools: mcps[0].tools };
  if (path === "/api/tools") return { tools };
  if (path === "/api/intercept/rules") return { rules };
  if (path === "/api/intercept/approvals") return { approvals, total: 1 };
  if (path === "/api/logs") return { lines: logs };
  if (path === "/api/conversations") return { conversations };
  if (path === "/api/conversations/7") return conversations[0];
  if (path === "/api/findings") return { findings: [finding], total: 1, stats: { confirmed: 1, pending: 0 } };
  if (path === "/api/findings/f-1") return finding;
  if (path === "/api/assets") return { assets: [asset], total: 1 };
  if (path === "/api/tokens/usage") return { by_profile: [{ profile_name: "默认配置", tasks: 2, calls: 12, input_tokens: 30000, output_tokens: 3000, cache_read_tokens: 8000, cache_write_tokens: 0 }], daily: [{ profile_name: "默认配置", date: "2026-10-21", input_tokens: 30000, output_tokens: 3000, cache_read_tokens: 8000 }] };
  if (path === "/api/tokens/conversations") return [];
  if (path === "/api/traffic") return { exchanges: [{ id: "p1", host: "demo.example", url: "https://demo.example/", method: "GET", status: 200, ts: now }] };
  if (path === "/api/exploration/findings") return [];
  if (path === "/api/exploration/graph") return { nodes: [], edges: [] };
  if (path === "/api/auth/status") return { initialized: true };
  if (path === "/api/current-user" || path === "/api/me") return { id: "1", name: "管理员", username: "Liora", role: "operator" };
  if (path.endsWith("/messages")) return { items: [], cursor: 0, hasMore: false, running: false };
  if (path.endsWith("/side-questions")) return { items: [], next_cursor: 0, snapshot: null };
  if (path.startsWith("/api/tasks/42/")) return {};
  if (path.startsWith("/api/findings/")) return {};
  if (path.startsWith("/api/agents/")) return { agent: agents[0], prompt: "你是测试执行 Agent。", variables: [], versions: [], visibility: { mcp: [], skill: [] } };
  if (path.startsWith("/api/skills/")) return { ...skills[0], content: "# Web Recon\n\n步骤说明" };
  if (path.startsWith("/api/conversations/7/")) return { items: [], cursor: 0, hasMore: false, running: false };
  return {};
}

const routes = [
  ["/dashboard", "dashboard"],
  ["/function/tasks", "tasks"],
  ["/function/tasks/detail?id=42", "task-detail"],
  ["/function/assets", "assets"],
  ["/function/findings", "findings"],
  ["/function/findings/detail?id=f-1", "finding-detail"],
  ["/function/conversations/detail?c=7", "conversation-detail"],
  ["/system/llm", "llm"],
  ["/system/settings", "settings"],
  ["/system/intercept", "intercept"],
  ["/system/intercept/approvals", "approvals"],
  ["/system/logs", "logs"],
  ["/system/agents", "agents"],
  ["/system/agents/detail?key=worker", "agent-detail"],
  ["/system/mcp", "mcp"],
  ["/system/skills", "skills"],
  ["/system/tools", "tools"],
  ["/not-a-page", "not-found"],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
await context.addInitScript(() => localStorage.setItem("liora_token", "fixture.eyJzdWIiOiJMaW9yYSJ9.fixture"));

const results = [];
const allRequests = new Set();
for (const [route, name] of routes) {
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  const pageRequests = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
  page.on("requestfailed", (r) => failed.push(r.method() + " " + r.url() + " :: " + (r.failure()?.errorText || "")));
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname;
    allRequests.add(route.request().method() + " " + path + u.search);
    pageRequests.push(route.request().method() + " " + path + u.search);
    let json = fixture(path);
    if (path === "/api/exploration/findings") {
      json = u.searchParams.has("page")
        ? { items: [finding], total: 1, page: 1, page_size: 20 }
        : [finding];
    }
    await route.fulfill({ json });
  });
  const started = Date.now();
  try {
    await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(700);
  } catch (e) {
    errors.push("goto: " + e.message.split("\n")[0]);
  }
  const metrics = await page.evaluate(() => {
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const nameOf = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || (el.textContent || "").trim() || el.getAttribute("placeholder") || el.getAttribute("alt") || "").trim();
    const all = [...document.querySelectorAll("button,a,input,textarea,select,[role=button],[role=tab],[role=menuitem],[role=switch],[role=checkbox]")].filter(visible);
    const unnamed = all.filter((el) => !nameOf(el) && !(el.labels && el.labels.length));
    const byTag = {};
    for (const el of all) { const k = el.tagName.toLowerCase() + (el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""); byTag[k] = (byTag[k] || 0) + 1; }
    return {
      title: document.title, h1: document.querySelector("h1")?.textContent?.trim() || "", h2: [...document.querySelectorAll("h2")].map(e => e.textContent?.trim()).filter(Boolean).slice(0, 8),
      interactive: all.length, unnamed: unnamed.length, unnamedSamples: unnamed.slice(0, 6).map(e => e.tagName + "." + (e.className || "").toString().slice(0, 60)),
      byTag, overflowX: document.documentElement.scrollWidth > innerWidth + 1, docHeight: document.documentElement.scrollHeight,
      headings: [...document.querySelectorAll("h1,h2,h3")].length, dialogs: document.querySelectorAll('[role=dialog]').length,
    };
  });
  const shot = shots + "/" + name + "-desktop.png";
  await page.screenshot({ path: shot, fullPage: metrics.docHeight < 5000, animations: "disabled" }).catch(() => {});
  results.push({ route, name, ms: Date.now() - started, ...metrics, errors: [...new Set(errors)].slice(0, 10), failed: failed.slice(0, 5), requests: [...new Set(pageRequests)], screenshot: shot.split("/").slice(-1)[0] });
  await page.close();
}

// Anonymous auth pages
const anon = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
for (const [route, name] of [["/login", "login"], ["/setup", "setup"], ["/", "home-redirect"]]) {
  const page = await anon.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (r) => r.fulfill({ json: fixture(new URL(r.request().url()).pathname) }));
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => ({
    title: document.title, url: location.pathname + location.search,
    interactive: [...document.querySelectorAll("button,a,input,textarea,select")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height; }).length,
    forms: document.querySelectorAll("form").length,
    labels: document.querySelectorAll("label").length,
    passwordInputs: document.querySelectorAll('input[type=password]').length,
  }));
  await page.screenshot({ path: shots + "/" + name + "-desktop.png", fullPage: true, animations: "disabled" });
  results.push({ route, name, anonymous: true, ...m, errors, screenshot: name + "-desktop.png" });
  await page.close();
}
await anon.close();

// Mobile pass
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
await mobile.addInitScript(() => localStorage.setItem("liora_token", "fixture.eyJzdWIiOiJMaW9yYSJ9.fixture"));
for (const [route, name] of [["/dashboard", "dashboard"], ["/function/tasks", "tasks"], ["/system/settings", "settings"]]) {
  const page = await mobile.newPage();
  await page.route("**/api/**", async (r) => r.fulfill({ json: fixture(new URL(r.request().url()).pathname) }));
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await page.screenshot({ path: shots + "/" + name + "-mobile.png", fullPage: false, animations: "disabled" });
  results.push({ route, name: name + "-mobile", mobile: true, overflowX, screenshot: name + "-mobile.png" });
  await page.close();
}
await mobile.close();

writeFileSync(outDir + "/data/runtime-crawl.json", JSON.stringify({ base, generatedAt: new Date().toISOString(), routes: results, apiRequests: [...allRequests].sort() }, null, 2));
console.log(JSON.stringify({ routes: results.map(r => ({ name: r.name, interactive: r.interactive, unnamed: r.unnamed, errors: r.errors?.length || 0, overflowX: r.overflowX, ms: r.ms })), apiRequests: allRequests.size }, null, 2));
await browser.close();
