// UI census · runtime slice: real-browser DOM + accessible-name census.
// Run:  node scripts/ui-census-runtime.mjs
// Env:  CENSUS_BASE (default http://127.0.0.1:15182), CENSUS_ONLY (comma separated page names), CENSUS_NO_MOBILE=1
// Writes: ../docs/ui-census-2026-10/data/runtime.json + ../docs/ui-census-2026-10/screenshots/*.png
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const base = process.env.CENSUS_BASE || "http://127.0.0.1:15182";
const outDir = "../docs/ui-census-2026-10";
const shotsDir = outDir + "/screenshots";
mkdirSync(shotsDir, { recursive: true });
mkdirSync(outDir + "/data", { recursive: true });

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

const activity = [
  { id: "a1", ts: now, kind: "finding", level: "high", title: "发现 SQL 注入", text: "登录接口存在 SQL 注入", task_id: "42", task_name: task.name },
];

function fixture(path, opts = {}) {
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
  if (path === "/api/intercept/pending") return { items: [], total: 0 };
  if (path === "/api/companies") return [{ id: 1, name: "示例企业", asset_count: 2, scope: [] }];
  if (path === "/api/exploration/findings/stats") return { total: 1, pending: 0, critical: 0, high: 1, medium: 0, low: 0, vulnclasses: ["SQL 注入"], tasks: [{ id: "42", name: task.name, description: task.description, count: 1 }] };
  if (path === "/api/exploration/findings/groups") return { items: [{ task_id: "42", task_name: task.name, task_description: task.description, task_status: "running", count: 1, critical: 0, high: 1, medium: 0, low: 0, last_found_at: now }], total: 1, finding_total: 1, page: 1, page_size: 20 };
  if (path === "/api/exploration/findings/asset-tree") return { nodes: [{ key: "demo.example", kind: "root_domain", label: "demo.example", self: 0, total: 1, critical: 0, high: 1, medium: 0, low: 0, last_found_at: now }], finding_total: 1, truncated: false };
  if (path === "/api/exploration/findings/retests/active") return { retests: [] };
  if (path === "/api/exploration/findings/f-1/retests") return { retests: [] };
  if (path === "/api/exploration/findings/f-1/traffic") return { finding_id: "f-1", version: 1, report_version: 1, bindings: [] };
  if (path === "/api/exploration/findings/f-1") return finding;
  if (path === "/api/exploration/findings/f-1/retests") return { retests: [] };
  if (path === "/api/exploration/intents") return { items: [], has_more: false };
  if (path === "/api/exploration/main-sessions") return { sessions: [{ seq: 1, created_at: now }], current: 1 };
  if (path === "/api/exploration/activity/history") return { items: [], snapshot_cursor: 0, earliest_cursor: 0, has_more: false };
  if (path === "/api/intercept/task/42") return { items: [], total: 0 };
  if (path === "/api/intercept/history") return { items: [], total: 0, page: 1, page_size: 20 };
  if (path.startsWith("/api/visibility/")) return { agents: ["worker"] };
  // SSE endpoints: answer with an event-stream body so EventSource does not log a MIME error.
  if (path === "/api/logs/stream" || path === "/api/exploration/activity/stream") return { __sse: true };
  if (path === "/api/exploration/activity") return { items: activity, total: activity.length };
  if (path === "/api/exploration/tokens") return { total: { input_tokens: 30000, output_tokens: 3000, cache_read_tokens: 8000, cache_write_tokens: 0 }, daily: [] };
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
  if (path === "/api/logs/history") return { lines: logs };
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
  if (path === "/api/auth/status") return { initialized: opts.initialized !== false };
  if (path === "/api/current-user" || path === "/api/me") return { id: "1", name: "管理员", username: "Liora", role: "operator" };
  if (path.endsWith("/messages")) return { items: [], cursor: 0, hasMore: false, running: false };
  if (path.endsWith("/side-questions")) return { items: [], next_cursor: 0, snapshot: null };
  if (path.startsWith("/api/tasks/42/")) return {};
  if (path.startsWith("/api/findings/")) return {};
  if (path.startsWith("/api/agents/")) return { agent: agents[0], prompt: "你是测试执行 Agent。", variables: [], versions: [], visibility: { mcp: [], skill: [] } };
  if (path.startsWith("/api/skills/")) return { ...skills[0], content: "# Web Recon\n\n步骤说明" };
  if (path.startsWith("/api/conversations/7/")) return { items: [], cursor: 0, hasMore: false, running: false };
  return undefined; // unhandled -> {} + recorded in meta.unknownEndpoints
}

const pages = [
  { path: "/dashboard", name: "dashboard", slug: "dashboard" },
  { path: "/function/tasks", name: "tasks", slug: "tasks" },
  { path: "/function/tasks/detail?id=42", name: "task-detail", slug: "task-detail" },
  { path: "/function/assets", name: "assets", slug: "assets" },
  { path: "/function/findings", name: "findings", slug: "findings" },
  { path: "/function/findings/detail?id=f-1", name: "finding-detail", slug: "finding-detail" },
  { path: "/function/conversations/detail?c=7", name: "conversation-detail", slug: "conversation-detail" },
  { path: "/system/llm", name: "llm", slug: "llm" },
  { path: "/system/settings", name: "settings", slug: "settings" },
  { path: "/system/intercept", name: "intercept", slug: "intercept" },
  { path: "/system/intercept/approvals", name: "approvals", slug: "approvals" },
  { path: "/system/logs", name: "logs", slug: "logs" },
  { path: "/system/agents", name: "agents", slug: "agents" },
  { path: "/system/agents/detail?key=worker", name: "agent-detail", slug: "agent-detail" },
  { path: "/system/mcp", name: "mcp", slug: "mcp" },
  { path: "/system/skills", name: "skills", slug: "skills" },
  { path: "/system/tools", name: "tools", slug: "tools" },
];
const anonPages = [
  { path: "/login", name: "login", slug: "login", initialized: true },
  { path: "/setup", name: "setup", slug: "setup", initialized: false },
];
const notFoundPage = { path: "/not-a-page", name: "not-found", slug: "not-found" };
const mobilePages = ["dashboard", "tasks", "settings"];

const SELECTOR = [
  "button", "a[href]", "input", "textarea", "select",
  "[role=button]", "[role=link]", "[role=tab]", "[role=menuitem]", "[role=menuitemcheckbox]", "[role=menuitemradio]",
  "[role=switch]", "[role=checkbox]", "[role=radio]", "[role=combobox]", "[role=textbox]", "[role=searchbox]",
  "[role=option]", "[role=slider]", "[role=spinbutton]", "[role=treeitem]", "[role=progressbar]",
].join(",");

// --- in-page measurement: visibility, geometry, DOM depth, overflow, control inventory ---
function measure(selector) {
  const ixAttr = "data-census-ix";
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    // checkVisibility also accounts for closed <details>, content-visibility and
    // visibility:hidden ancestors, which keep non-zero boxes but are not rendered.
    if (typeof el.checkVisibility === "function" && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest("[hidden],[inert]")) return false;
    return true;
  };
  const nodes = [...document.querySelectorAll(selector)].filter((el) => !el.closest("[data-census-skip]"));
  const visible = nodes.filter(isVisible);
  visible.forEach((el, i) => el.setAttribute(ixAttr, String(i)));

  let maxDepth = 0;
  let maxDepthPath = "";
  const walk = (el, depth, path) => {
    if (depth > maxDepth) { maxDepth = depth; maxDepthPath = path; }
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      walk(child, depth + 1, path + ">" + tag + (child.id ? "#" + child.id : ""));
    }
  };
  walk(document.documentElement, 1, "html");

  const tagOf = (el) => el.tagName.toLowerCase();
  const roleAttrOf = (el) => el.getAttribute("role") || "";

  return {
    count: visible.length,
    totalCandidates: nodes.length,
    elements: visible.map((el, i) => ({
      ix: i,
      tag: tagOf(el),
      roleAttr: roleAttrOf(el),
      type: el.getAttribute("type") || "",
      disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
      text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      placeholder: el.getAttribute("placeholder") || "",
      outer: el.outerHTML.slice(0, 160),
    })),
    domDepth: maxDepth,
    domDepthPath: maxDepthPath.slice(0, 400),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    docHeight: document.documentElement.scrollHeight,
    title: document.title,
    h1: (document.querySelector("h1")?.innerText || "").replace(/\s+/g, " ").trim(),
    h1Count: document.querySelectorAll("h1").length,
    h2: [...document.querySelectorAll("h2")].map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 10),
    headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((e) => e.tagName.toLowerCase() + ":" + (e.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40)).slice(0, 20),
    dialogs: [...document.querySelectorAll("[role=dialog],[role=alertdialog]")].filter(isVisible).length,
    landmarks: {
      header: document.querySelectorAll("header,[role=banner]").length,
      nav: document.querySelectorAll("nav,[role=navigation]").length,
      main: document.querySelectorAll("main,[role=main]").length,
      aside: document.querySelectorAll("aside,[role=complementary]").length,
      footer: document.querySelectorAll("footer,[role=contentinfo]").length,
      form: document.querySelectorAll("form").length,
      table: document.querySelectorAll("table").length,
    },
    bodyTextLen: (document.body.innerText || "").length,
  };
}

// --- focus order: press Tab up to N times and record document.activeElement ---
function focusProbe() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) {
    return { tag: "body", role: "", name: "", label: "", id: "" };
  }
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role") || "";
  const aria = el.getAttribute("aria-label") || "";
  const labelText = el.labels && el.labels.length ? (el.labels[0].innerText || "").replace(/\s+/g, " ").trim() : "";
  const name = (aria || labelText || el.innerText || el.textContent || el.getAttribute("placeholder") || el.getAttribute("title") || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return { tag, role, label: aria, name, id: el.id || "" };
}

const playwrightVersion = (() => {
  try { return JSON.parse(readFileSync("../node_modules/@playwright/test/package.json", "utf8")).version; } catch { return ""; }
})();

const browser = await chromium.launch({ headless: true });
const bv = browser.version();

const results = [];
const unknownEndpoints = new Set();
const allApi = new Set();
const perPageUnknown = {};

async function newCtx(viewport, opts = {}) {
  const { withToken = true, ...rest } = opts;
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", ...rest });
  if (withToken) {
    await ctx.addInitScript(() => localStorage.setItem("liora_token", "fixture.eyJzdWIiOiJMaW9yYSJ9.fixture"));
  }
  return ctx;
}

async function crawl(ctx, spec, { screenshot = true, suffix = "desktop", focus = true } = {}) {
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  const pageRequests = [];
  const pageUnknown = new Set();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.split("\n")[0].slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => failed.push(r.method() + " " + r.url() + " :: " + (r.failure()?.errorText || "")));

  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname;
    const key = route.request().method() + " " + path + u.search;
    allApi.add(route.request().method() + " " + path);
    pageRequests.push(key);
    let json = fixture(path, { initialized: spec.initialized });
    if (json && json.__sse) {
      await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" }, body: ": connected\n\n" });
      return;
    }
    if (json === undefined) {
      unknownEndpoints.add(path);
      pageUnknown.add(path);
      json = {};
    }
    if (path === "/api/exploration/findings") {
      json = u.searchParams.has("page")
        ? { items: [finding], total: 1, page: 1, page_size: 20 }
        : [finding];
    }
    await route.fulfill({ json });
  });

  const started = Date.now();
  try {
    await page.goto(base + (spec.gotoPath || spec.path), { waitUntil: "domcontentloaded", timeout: 30000 });
    if (spec.clientNav) {
      // The dev server returns its own 404 for unknown paths (historyApiFallback only
      // rewrites routes.json paths), so drive the client router the way an in-app
      // navigation does: pushState + popstate.
      await page.evaluate((to) => {
        history.pushState({}, "", to);
        window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      }, spec.clientNav);
    }
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  } catch (e) {
    errors.push("goto: " + String(e.message).split("\n")[0]);
  }

  const metrics = await page.evaluate(measure, SELECTOR);

  // Accessible names + roles come from Chromium's own accessibility tree.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("Accessibility.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const backendByIdx = new Map();
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n.nodeType === 1 && n.attributes) {
      for (let i = 0; i < n.attributes.length; i += 2) {
        if (n.attributes[i] === "data-census-ix") backendByIdx.set(n.attributes[i + 1], n.backendNodeId);
      }
    }
    if (n.children) stack.push(...n.children);
    if (n.shadowRoots) stack.push(...n.shadowRoots);
    if (n.contentDocument) stack.push(n.contentDocument);
  }
  const ax = await cdp.send("Accessibility.getFullAXTree");
  const axByBackend = new Map();
  for (const node of ax.nodes) {
    if (node.backendDOMNodeId != null) axByBackend.set(node.backendDOMNodeId, node);
  }

  const controls = metrics.elements.map((el) => {
    const backend = backendByIdx.get(String(el.ix));
    const axNode = backend != null ? axByBackend.get(backend) : undefined;
    const axRole = axNode?.role?.value || "";
    const axName = (axNode?.name?.value || "").trim();
    const ignored = axNode ? axNode.ignored === true : true;
    return {
      tag: el.tag,
      role: axRole || el.roleAttr || el.tag,
      roleAttr: el.roleAttr,
      name: axName,
      // Controls Chromium does not expose (aria-hidden / closed details / inert) have
      // no accessible name by definition; they are reported separately, not as unnamed.
      exposed: !ignored,
      unnamed: !ignored && axName === "",
      ignored,
      type: el.type,
      disabled: el.disabled,
      placeholder: el.placeholder,
      text: el.text,
      outer: el.outer,
    };
  });

  // counts: native tags counted by tag; role-only widgets counted by explicit role attr.
  const ROLE_KEYS = ["tab", "menuitem", "menuitemcheckbox", "menuitemradio", "checkbox", "switch", "radio", "combobox", "option", "slider", "treeitem"];
  const counts = { button: 0, a: 0, input: 0, textarea: 0, select: 0 };
  for (const k of ROLE_KEYS) counts[k] = 0;
  for (const c of controls) {
    if (c.tag === "button") counts.button++;
    else if (c.tag === "a") counts.a++;
    else if (c.tag === "input") counts.input++;
    else if (c.tag === "textarea") counts.textarea++;
    else if (c.tag === "select") counts.select++;
    if (c.roleAttr && ROLE_KEYS.includes(c.roleAttr)) counts[c.roleAttr]++;
  }
  counts.dialog = metrics.dialogs;

  const byTag = {};
  for (const c of controls) byTag[c.tag] = (byTag[c.tag] || 0) + 1;
  const byRole = {};
  for (const c of controls) byRole[c.role] = (byRole[c.role] || 0) + 1;
  const unnamed = controls.filter((c) => c.unnamed);
  const axIgnored = controls.filter((c) => !c.exposed);

  // Focus order
  let focusOrder = [];
  let focusDetail = [];
  if (focus) {
    await page.evaluate(() => { document.body.focus(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); window.scrollTo(0, 0); });
    for (let i = 0; i < 20; i++) {
      try { await page.keyboard.press("Tab"); } catch { break; }
      const d = await page.evaluate(focusProbe);
      if (d.tag === "body") {
        // Tab left the document (browser chrome / address bar): the tab cycle ended.
        if (focusOrder.length > 0) { focusOrder.push("body · (焦点离开文档，Tab 循环结束)"); break; }
        continue;
      }
      focusDetail.push(d);
      focusOrder.push(d.tag + (d.role ? "[" + d.role + "]" : "") + " · " + (d.label || d.name || "(无名称)"));
    }
    await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  }

  let shot = "";
  if (screenshot) {
    shot = "screenshots/" + spec.slug + "-" + suffix + ".png";
    await page.screenshot({ path: outDir + "/" + shot, fullPage: false, animations: "disabled" }).catch((e) => errors.push("screenshot: " + e.message.split("\n")[0]));
  }

  const url = page.url().replace(base, "");
  const out = {
    path: spec.path,
    name: spec.name,
    slug: spec.slug,
    url,
    title: metrics.title,
    h1: metrics.h1,
    h1Count: metrics.h1Count,
    h2: metrics.h2,
    headings: metrics.headings,
    counts,
    countsByTag: byTag,
    countsByRole: byRole,
    visibleInteractive: metrics.count,
    unnamedControls: unnamed.length,
    axIgnoredControls: axIgnored.length,
    axIgnoredSamples: axIgnored.slice(0, 5).map((c) => ({ tag: c.tag, role: c.role, aria: c.outer.slice(0, 120) })),
    unnamedByRole: unnamed.reduce((acc, c) => { acc[c.role] = (acc[c.role] || 0) + 1; return acc; }, {}),
    unnamedSamples: unnamed.slice(0, 8).map((c) => ({ tag: c.tag, role: c.role, type: c.type, text: c.text, placeholder: c.placeholder, outer: c.outer })),
    disabledControls: controls.filter((c) => c.disabled).length,
    focusOrder,
    focusOrderCount: focusOrder.length,
    domDepth: metrics.domDepth,
    domDepthPath: metrics.domDepthPath,
    overflowX: metrics.overflowX,
    scrollWidth: metrics.scrollWidth,
    innerWidth: metrics.innerWidth,
    docHeight: metrics.docHeight,
    dialogs: metrics.dialogs,
    landmarks: metrics.landmarks,
    bodyTextLen: metrics.bodyTextLen,
    loadMs: Date.now() - started,
    errors: [...new Set(errors)].slice(0, 10),
    failedRequests: failed.slice(0, 5),
    unknownApi: [...pageUnknown],
    apiRequests: [...new Set(pageRequests)].sort(),
    screenshot: shot,
  };
  perPageUnknown[spec.name] = [...pageUnknown];
  await page.close();
  return { out, controls, focusDetail };
}

const viewport = { width: 1440, height: 1000 };
const only = process.env.CENSUS_ONLY ? new Set(process.env.CENSUS_ONLY.split(",")) : null;
const ctx = await newCtx(viewport);
const details = {};
for (const spec of pages) {
  if (only && !only.has(spec.name)) continue;
  const { out, controls, focusDetail } = await crawl(ctx, spec);
  results.push(out);
  details[spec.name] = { controls, focusDetail };
  console.log(out.name, "interactive=" + out.visibleInteractive, "unnamed=" + out.unnamedControls, "depth=" + out.domDepth, "overflow=" + out.overflowX, "errors=" + out.errors.length, "ms=" + out.loadMs);
}
await ctx.close();

if (!only || only.has("login") || only.has("setup")) {
  const anon = await newCtx(viewport, { withToken: false });
  for (const spec of anonPages) {
    if (only && !only.has(spec.name)) continue;
    const { out, controls, focusDetail } = await crawl(anon, spec);
    results.push(out);
    details[spec.name] = { controls, focusDetail };
    console.log(out.name, "interactive=" + out.visibleInteractive, "unnamed=" + out.unnamedControls, "depth=" + out.domDepth, "overflow=" + out.overflowX, "errors=" + out.errors.length, "ms=" + out.loadMs);
  }
  await anon.close();
}

if (!only || only.has("not-found")) {
  const c404 = await newCtx(viewport);
  const spec = { ...notFoundPage, gotoPath: "/dashboard", clientNav: notFoundPage.path };
  const { out, controls, focusDetail } = await crawl(c404, spec);
  results.push(out);
  details["not-found"] = { controls, focusDetail };
  console.log(out.name, "interactive=" + out.visibleInteractive, "unnamed=" + out.unnamedControls, "depth=" + out.domDepth, "overflow=" + out.overflowX, "errors=" + out.errors.length, "ms=" + out.loadMs);
  await c404.close();
}

// Mobile pass
const mobile = [];
if (!process.env.CENSUS_NO_MOBILE) {
  const mctx = await newCtx({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  for (const name of mobilePages) {
    const spec = pages.find((p) => p.name === name);
    const { out } = await crawl(mctx, { ...spec, name: spec.name + "-mobile", slug: spec.slug }, { suffix: "mobile", focus: false });
    mobile.push(out);
    console.log(out.name, "interactive=" + out.visibleInteractive, "overflow=" + out.overflowX);
  }
  await mctx.close();
}

await browser.close();

// --- discrepancies vs the previous audit crawl ---
const discrepancies = [];
try {
  const old = JSON.parse(readFileSync("../docs/frontend-audit-2026-10/data/runtime-crawl.json", "utf8"));
  const oldByName = new Map(old.routes.map((r) => [r.name, r]));
  for (const r of results) {
    const o = oldByName.get(r.name);
    if (!o) { discrepancies.push({ page: r.name, field: "presence", old: null, new: r.visibleInteractive, note: "旧报告未覆盖该页面" }); continue; }
    if (typeof o.interactive === "number" && o.interactive !== r.visibleInteractive) {
      discrepancies.push({ page: r.name, field: "visibleInteractive", old: o.interactive, new: r.visibleInteractive, delta: r.visibleInteractive - o.interactive });
    }
    if (typeof o.unnamed === "number" && o.unnamed !== r.unnamedControls) {
      discrepancies.push({ page: r.name, field: "unnamedControls", old: o.unnamed, new: r.unnamedControls, delta: r.unnamedControls - o.unnamed });
    }
    if (typeof o.domDepth === "number" && o.domDepth !== r.domDepth) {
      discrepancies.push({ page: r.name, field: "domDepth", old: o.domDepth, new: r.domDepth, delta: r.domDepth - o.domDepth });
    }
    if (o.title !== undefined && o.title !== r.title) discrepancies.push({ page: r.name, field: "title", old: o.title, new: r.title });
    if (o.h1 !== undefined && o.h1 !== r.h1) discrepancies.push({ page: r.name, field: "h1", old: o.h1, new: r.h1 });
    if (o.overflowX !== undefined && o.overflowX !== r.overflowX) discrepancies.push({ page: r.name, field: "overflowX", old: o.overflowX, new: r.overflowX });
  }
} catch (e) {
  discrepancies.push({ page: "*", field: "baseline", note: "无法读取旧 runtime-crawl.json: " + e.message });
}

const out = {
  meta: {
    slice: "runtime",
    viewport: "1440x1000",
    mobile: "390x844",
    mock: true,
    base,
    generatedAt: new Date().toISOString(),
    chromium: bv,
    env: { node: process.version, playwright: playwrightVersion, os: process.platform },
    pageCount: results.length,
    desktopPages: results.filter((r) => !r.name.endsWith("-mobile")).length,
    mobilePages: mobile.length,
    method: {
      dom: "Playwright Chromium, real browser; visible = getBoundingClientRect w/h > 0 && computed visibility/display/opacity ok && no [hidden]/[inert] ancestor",
      interactiveSelector: SELECTOR,
      accessibleName: "Chromium accessibility tree via CDP Accessibility.getFullAXTree + DOM.getDocument(depth:-1); unnamed = AX name empty after trim",
      counts: "button/a/input/textarea/select counted by tag; tab/menuitem/menuitemcheckbox/menuitemradio/checkbox/switch/radio/combobox/option/slider/treeitem counted by explicit role attribute; dialog = visible [role=dialog|alertdialog]",
      domDepth: "max element nesting depth, documentElement = 1",
      overflowX: "document.documentElement.scrollWidth > window.innerWidth + 1",
      focusOrder: "press Tab up to 20 times from a blurred body, record activeElement tag + aria-label/text",
      screenshots: "viewport-sized (not fullPage) PNG, animations disabled",
      fixture: "page.route('**/api/**') fulfills JSON from an inline fixture table; unhandled paths return {} and are listed in meta.unknownEndpoints",
      client404: "dev server 404s unknown paths, so /not-a-page is reached by history.pushState + popstate from /dashboard (client router path)",
    },
    coverage: {
      protectedRoutes: pages.length,
      authPages: anonPages.length,
      client404: 1,
      totalCrawled: results.length,
      mobile: mobilePages,
      note: "17 受保护路由 + /login + /setup + 客户端 404 全部覆盖",
    },
    fixtureEndpoints: [...allApi].sort(),
    unknownEndpoints: [...unknownEndpoints].sort(),
    unknownByPage: perPageUnknown,
    discrepancies,
    discrepancyNotes: [
      "旧报告（docs/frontend-audit-2026-10/data/runtime-crawl.json）的可见性只判 getBoundingClientRect，本轮额外用 Element.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})，因此闭合 <details> 内、content-visibility 隐藏的控件不再计入 visibleInteractive（tasks -4、skills -4、agents -2 属此类）。",
      "旧报告把「无 accessible name」按 aria-label/title/textContent 自算；本轮改用 Chromium 无障碍树（CDP Accessibility.getFullAXTree）。role=combobox 的 nameFrom 为 author，可见文案不计入名称，因此 tasks/findings 的 Select 触发器首次被计为 unnamed（tasks +2、findings +5）。",
      "旧报告对 finding-detail 的 fixture 未覆盖 /api/exploration/findings/f-1，页面停在空态（h1=未分类）；本轮补上该 fixture，页面渲染真实数据（h1=登录接口 SQL 注入、+1 个控件）。",
      "旧报告的 not-found 是服务端 404 页（无 React 渲染）；本轮用 pushState+popstate 走客户端路由，因此 title/h1/控件数不同。",
      "dashboard +2 为页面自身改动（侧栏折叠按钮等），与口径无关。",
    ],
  },
  pages: results,
  mobile,
};

writeFileSync(outDir + "/data/runtime.json", JSON.stringify(out, null, 2));
console.log("WROTE", outDir + "/data/runtime.json", "pages=" + results.length, "mobile=" + mobile.length, "unknownEndpoints=" + unknownEndpoints.size, "discrepancies=" + discrepancies.length);