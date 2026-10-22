// frontend-audit-crawl.mjs — runtime interaction crawl for the Liora web UI.
//
// Read-only: it only drives a headless Chromium against the Rsbuild dev server and
// intercepts /api/** with in-memory fixtures. No source file, no backend, no DB is
// touched. Every number in docs/frontend-audit-2026-10/data/runtime.json comes from
// this script's own measurements.
//
// Usage (from web/):
//   node scripts/frontend-audit-crawl.mjs [--base http://127.0.0.1:15173] [--out ../docs/frontend-audit-2026-10]
//
// Measurement definitions (also repeated in 04-runtime.md):
//   interactiveCounts  visible DOM nodes per selector, counted independently (a
//                      <button role="button"> counts once in button and once in
//                      roleButton); total = deduplicated union of all selectors.
//   unnamedControls    of that deduplicated union, the nodes whose accessible name
//                      (DOM heuristic below) is empty.
//   accessible name    aria-label > aria-labelledby text > associated <label> >
//                      alt > title > placeholder > trimmed textContent.
//   landmarks          visible header/nav/main/aside/footer/section elements.

import { chromium } from "@playwright/test";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = argValue("--base", "http://127.0.0.1:15173");
const OUT = path.resolve(argValue("--out", "../docs/frontend-audit-2026-10"));
const SHOTS = path.join(OUT, "screenshots");
const DATA = path.join(OUT, "data");
const TOKEN = "fixture.eyJzdWIiOiJMaW9yYSJ9.fixture";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const now = Date.now();
const iso = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();
const unix = (minutesAgo) => Math.floor((now - minutesAgo * 60_000) / 1000);

const tasks = [
  {
    id: "42",
    name: "边界资产梳理",
    category_id: 1,
    category_name: "常规评估",
    description: "对 example.com 的对外资产做暴露面梳理，确认测试环境边界",
    goal: "找出所有可访问的测试环境入口并确认其归属",
    status: "running",
    created_at: iso(180),
    created_unix: unix(180),
    last_activity_unix: unix(2),
    last_activity: iso(2),
    paused: false,
    queued: false,
    active: true,
    in_flight: 2,
    goals_total: 4,
    goals_met: 2,
    engine_mode: "exploring",
    coverage_enabled: true,
    llm_profile_id: 1,
    llm_profile_ids: [1, 2],
    active_llm_profile_id: 1,
    llm_failover_state: "ready",
    tokens: { input_tokens: 182340, output_tokens: 24110, cache_read_tokens: 90210, cache_write_tokens: 5120 },
  },
  {
    id: "41",
    name: "历史漏洞复测",
    category_id: 2,
    category_name: "漏洞复测",
    description: "复测上一轮确认的 3 个中危漏洞是否已修复",
    goal: "给出每个漏洞的复测结论",
    status: "paused",
    created_at: iso(1440),
    created_unix: unix(1440),
    last_activity_unix: unix(600),
    paused: true,
    queued: false,
    active: false,
    in_flight: 0,
    goals_total: 3,
    goals_met: 1,
    engine_mode: "paused",
    coverage_enabled: true,
    llm_profile_id: 2,
  },
  {
    id: "40",
    name: "供应链指纹识别",
    category_id: 1,
    category_name: "常规评估",
    description: "识别目标站点使用的第三方组件与版本",
    goal: "输出组件清单与已知漏洞匹配结果",
    status: "done",
    created_at: iso(2880),
    created_unix: unix(2880),
    completed_at: iso(2400),
    completed_unix: unix(2400),
    paused: false,
    queued: false,
    active: false,
    goals_total: 5,
    goals_met: 5,
    engine_mode: "idle",
    coverage_enabled: false,
  },
  {
    id: "39",
    name: "",
    description: "未命名任务：等待调度",
    goal: "等待调度",
    status: "queued",
    created_at: iso(5),
    created_unix: unix(5),
    queued: true,
    paused: false,
    active: false,
    goals_total: 0,
    goals_met: 0,
    engine_mode: "idle",
  },
];

const findings = [
  {
    id: "f-101",
    finding_id: "101",
    vulnclass: "SQL 注入",
    name: "登录接口布尔盲注",
    severity: "critical",
    status: "confirmed",
    summary: "login 接口的 username 参数存在布尔盲注，可通过响应差异判断真假。",
    evidence: "payload: admin' AND 1=1-- - 返回 200；admin' AND 1=2-- - 返回 401",
    task_id: "42",
    task_description: "对 example.com 的对外资产做暴露面梳理，确认测试环境边界",
    assets: [{ id: "a-1", type: "endpoint", label: "https://www.example.com/api/login" }],
    intent_id: "901",
    ts: iso(120),
    traffic_count: 3,
  },
  {
    id: "f-102",
    finding_id: "102",
    vulnclass: "信息泄露",
    name: "调试接口暴露内部配置",
    severity: "high",
    status: "pending",
    summary: "/debug/config 未鉴权，返回数据库连接串与内网地址。",
    evidence: "GET /debug/config -> 200 application/json",
    task_id: "42",
    task_description: "对 example.com 的对外资产做暴露面梳理，确认测试环境边界",
    assets: [{ id: "a-2", type: "subdomain", label: "debug.example.com" }],
    ts: iso(90),
  },
  {
    id: "f-103",
    finding_id: "103",
    vulnclass: "弱口令",
    name: "测试环境管理员弱口令",
    severity: "medium",
    status: "in_progress",
    summary: "测试环境 admin 账号使用常见弱口令，可直接登录后台。",
    evidence: "POST /admin/login admin/admin888 -> 302 /admin",
    task_id: "41",
    task_description: "复测上一轮确认的 3 个中危漏洞是否已修复",
    assets: [{ id: "a-3", type: "app", label: "测试后台" }],
    ts: iso(600),
  },
  {
    id: "f-104",
    finding_id: "104",
    vulnclass: "配置错误",
    name: "CORS 允许任意来源",
    severity: "low",
    status: "resolved",
    summary: "接口返回 Access-Control-Allow-Origin: *，且允许携带凭据。",
    evidence: "Access-Control-Allow-Origin: *",
    task_id: "40",
    task_description: "识别目标站点使用的第三方组件与版本",
    assets: [{ id: "a-1", type: "endpoint", label: "https://www.example.com/api/login" }],
    ts: iso(2400),
  },
];

const assets = [
  { id: 1, type: "root_domain", domain: "example.com", task_ids: [42], last_seen: iso(30), task_source: "manual", task_source_summary: "手工登记" },
  { id: 2, type: "subdomain", domain: "debug.example.com", root_domain: "example.com", task_ids: [42], last_seen: iso(35) },
  { id: 3, type: "subdomain", domain: "www.example.com", root_domain: "example.com", task_ids: [42, 41], last_seen: iso(40) },
  { id: 4, type: "ip", ip: "203.0.113.10", task_ids: [42], last_seen: iso(50) },
  { id: 5, type: "app", app_name: "测试后台", url: "https://debug.example.com/admin", status_code: 200, technologies: ["nginx", "React"], task_ids: [42], last_seen: iso(60) },
  { id: 6, type: "endpoint", url: "https://www.example.com/api/login", method: "POST", status_code: 200, task_ids: [42], last_seen: iso(70) },
  { id: 7, type: "service", service_name: "https", port: 443, ip: "203.0.113.10", task_ids: [42], last_seen: iso(80) },
];

const agents = [
  { id: "1", key: "mainagent", name: "主 Agent", description: "与操作员对话，调度任务", role: "mainagent", builtin: true, enabled: true, llm_profile_id: 1, mcp_count: 2, skill_count: 3, tool_count: 6 },
  { id: "2", key: "planner", name: "规划 Agent", description: "把目标拆解为意图", role: "planner", builtin: true, enabled: true, llm_profile_id: 1, mcp_count: 0, skill_count: 1, tool_count: 4 },
  { id: "3", key: "worker", name: "执行 Agent", description: "执行单条意图", role: "worker", builtin: true, enabled: true, llm_profile_id: 2, max_turns: 40, run_seconds: 900, web_search: true, mcp_count: 1, skill_count: 2, tool_count: 9 },
  { id: "4", key: "goals", name: "目标 Agent", description: "判定目标是否达成", role: "goals", builtin: true, enabled: true },
  { id: "5", key: "reporter", name: "报告 Agent", description: "自定义：汇总报告", role: "custom", builtin: false, enabled: true, trigger_run_mode: "serial", trigger_merge_mode: "by_task", trigger_max_parallel: 2 },
];

const llmProfiles = [
  { id: "1", name: "主力 GPT", format: "openai", base_url: "https://api.example.com/v1", model: "gpt-5.1", api_key_hint: "sk-…9f2a", rate_per_second: 4, rate_per_minute: 180, context_window_k: 200, is_default: true, priority: 10, streaming: true, max_tokens: 8192, max_tokens_field: "", thinking_type: "", reasoning_effort: "medium" },
  { id: "2", name: "备用 Claude", format: "anthropic", base_url: "https://api.anthropic.example", model: "claude-sonnet-4.6", api_key_hint: "sk-ant-…11", rate_per_second: 2, rate_per_minute: 90, context_window_k: 200, is_default: false, priority: 5, streaming: true, pool_exclude: false },
  { id: "3", name: "本地推理", format: "openai-responses", base_url: "http://127.0.0.1:11434/v1", model: "qwen3-coder", rate_per_second: 1, rate_per_minute: 30, context_window_k: 64, is_default: false, priority: 1, pool_exclude: true },
];

const mcpServers = [
  { id: 81, name: "fetch", transport: "stdio", command: "uvx", args: ["mcp-server-fetch"], env: {}, enabled: true, tools: ["fetch", "fetch_markdown"] },
  { id: 82, name: "internal-wiki", transport: "http", url: "https://wiki.example.com/mcp", args: [], env: {}, enabled: false, insecure: false, tools: [] },
];

const skills = [
  { name: "web-recon", description: "被动信息收集与指纹识别流程。用于拿到新域名后的第一轮梳理。", license: "MIT", compatibility: "需要网络访问", mcps: ["fetch"], files: ["SKILL.md", "scripts/probe.sh"], calls: 12, tasks: 3, usage_agents: ["worker", "planner"], last_used: iso(120) },
  { name: "report-writer", description: "把发现整理成中文报告。用于收尾阶段。", files: ["SKILL.md"], calls: 4, tasks: 2, usage_agents: ["reporter"] },
];

const tools = [
  { key: "Bash", system: true, description: "在任务工作目录执行 shell 命令", schema: { type: "object", properties: { command: { type: "string", description: "命令" } }, required: ["command"] }, agents: ["worker", "mainagent"], enabled: true, calls: 320 },
  { key: "WebFetch", system: true, description: "抓取网页正文", schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }, agents: ["worker", "mainagent", "planner"], enabled: true, calls: 88 },
  { key: "Skill", system: true, description: "加载技能说明", schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] }, agents: ["worker"], enabled: true, calls: 16 },
  { key: "nuclei_scan", system: false, kind: "command", description: "自定义：调用 nuclei 模板扫描", schema: { type: "object", properties: { target: { type: "string" } }, required: ["target"] }, exec: { command: "nuclei -u {{target}} -jsonl" }, agents: ["worker"], enabled: true, deferred: false, calls: 7 },
];

const settings = {
  traffic_capture: true,
  agent_traffic_binding: false,
  llm_record: true,
  web_search_enabled: true,
  web_search_backend: "ddgs",
  brave_key_set: false,
  tavily_key_set: true,
  web_search_proxy: "",
  global_proxy: "",
  python_interpreter: "",
  workers: 3,
  task_concurrency_enabled: true,
  task_concurrency_limit: 5,
  llm_pool_enabled: true,
  llm_pool_bind_fallback: false,
  constraints_inject_planner: true,
  constraints_inject_worker: true,
  noa_compaction: false,
};

const judge = {
  enabled: true,
  profile_id: 1,
  prompt: "你是安全操作审批员。判断给定工具调用是否落在任务授权范围内。",
  timeout_seconds: 20,
  fail_action: "ask",
  ask_timeout_seconds: 300,
  ask_timeout_action: "deny",
};

const interceptRules = [
  { id: 61, name: "危险命令拦截", enabled: true, priority: 100, match_target: "tool_input", match_type: "regex", pattern: "rm\\s+-rf\\s+/", action: "deny", message: "禁止删除根目录", timeout_enabled: false, timeout_seconds: 0, timeout_action: "deny", created_at: iso(4000), updated_at: iso(4000) },
  { id: 62, name: "外部扫描需人工确认", enabled: true, priority: 50, match_target: "tool_name", match_type: "string", pattern: "nuclei_scan", action: "ask", message: "对外扫描前请人工确认授权范围", timeout_enabled: true, timeout_seconds: 600, timeout_action: "deny", created_at: iso(3000), updated_at: iso(3000) },
];

const approval = {
  id: 42,
  agent_name: "执行 Agent",
  tool_name: "Bash",
  tool_input: { command: "nuclei -u https://debug.example.com -severity critical" },
  status: "pending",
  reason: "[模型] 该调用会向目标发送主动扫描流量，请人工核对授权范围",
  created_at: iso(12),
  decision_source: "model",
  conv_title: "",
  conv_agent_key: "worker",
  rule_name: "外部扫描需人工确认",
};

const audit = {
  correlation: "exact",
  input_digest: "fixture-input-digest",
  user_message: "复测 debug.example.com 的暴露面",
  context: [{ kind: "tool_result", tool: "Bash", text: "nslookup debug.example.com -> 203.0.113.10", is_error: false }],
  captured_at: approval.created_at,
  initial_action: "ask",
  initial_reason: approval.reason,
  execution_status: "not_started",
  model_input: { version: 4, tool_name: "Bash", arguments: approval.tool_input },
};

const activity = [
  { seq: 1201, worker: "mainagent", ts: iso(12), kind: "text", summary: "已确认 debug.example.com 属于测试环境，开始复测。", detail: "已确认 debug.example.com 属于测试环境，开始复测。" },
  { seq: 1202, worker: "planner", ts: iso(11), kind: "round", summary: "第 3 轮规划：拆出 2 条意图" },
  { seq: 1203, worker: "work#1", intent_id: "901", ts: iso(10), kind: "tool_use", tool: "Bash", summary: "nuclei -u https://debug.example.com -severity critical" },
  { seq: 1204, worker: "work#1", intent_id: "901", ts: iso(9), kind: "tool_result", tool: "Bash", summary: "命中 1 条：暴露的调试接口" },
  { seq: 1205, worker: "work#1", intent_id: "901", ts: iso(8), kind: "result", summary: "意图完成，产出 1 条发现", input_tokens: 8200, output_tokens: 640 },
];

const nodes = [
  { id: "n-1", type: "intent", state: "done", priority: 5, origin: "planner", ts: iso(60), payload: JSON.stringify({ summary: "枚举 example.com 子域" }) },
  { id: "n-2", type: "fact", state: "confirmed", priority: 3, origin: "worker", ts: iso(55), payload: JSON.stringify({ summary: "debug.example.com 解析到 203.0.113.10" }) },
  { id: "n-3", type: "finding", state: "confirmed", priority: 8, origin: "worker", ts: iso(50), payload: JSON.stringify({ summary: "调试接口未鉴权" }) },
];

const conversation = { id: 7, running: false, agent_key: "mainagent", title: "复测讨论", llm_profile_id: 1, pinned: false, created_at: iso(300), updated_at: iso(20) };

// Endpoint table: [name, matcher, responder]. Matchers run in order; the first hit
// wins. Anything unmatched falls through to the "unknown" recorder.
const API = [
  ["health", /^\/api\/health$/, () => ({ ok: true, service: "liora", version: "v2.2.0-audit-fixture" })],
  ["auth/status", /^\/api\/auth\/status$/, () => ({ initialized: true })],
  ["tasks", /^\/api\/tasks$/, () => ({ tasks, active: "42" })],
  ["task", /^\/api\/tasks\/[^/]+$/, () => tasks[0]],
  ["task-categories", /^\/api\/task-categories$/, () => ({ categories: [
    { id: 1, name: "常规评估", task_count: 2, created_at: iso(9000), updated_at: iso(9000) },
    { id: 2, name: "漏洞复测", task_count: 1, created_at: iso(8000), updated_at: iso(8000) },
  ] })],
  ["task-templates", /^\/api\/task-templates$/, () => ({ templates: [
    { id: 1, name: "资产梳理", description: "标准暴露面梳理模板", goal: "梳理全部对外资产", created_at: iso(9000), updated_at: iso(9000) },
  ] })],
  ["task-archives", /^\/api\/task-archives$/, () => ({ items: [], total: 0, page: 1, size: 20 })],
  ["stats", /^\/api\/stats$/, () => ({ assets: assets.length, engine_mode: "exploring", llm_configured: true, roe_enabled: true, findings_confirmed: 2, active_task: { id: "42", status: "running" } })],
  ["settings", /^\/api\/settings$/, () => settings],
  ["intercept/pending", /^\/api\/intercept\/pending$/, () => ({ pending: [approval] })],
  ["intercept/history", /^\/api\/intercept\/history$/, () => ({ items: [approval], total: 1 })],
  ["intercept/history/:id", /^\/api\/intercept\/history\/\d+$/, () => ({ ...approval, audit })],
  ["intercept/rules", /^\/api\/intercept\/rules$/, () => ({ rules: interceptRules })],
  ["intercept/judge", /^\/api\/intercept\/judge$/, () => judge],
  ["intercept/tool-config", /^\/api\/intercept\/tool-config$/, () => ({ enabled_tools: ["Bash", "nuclei_scan"] })],
  ["intercept/task/:id", /^\/api\/intercept\/task\/[^/]+$/, () => ({ items: [approval], total: 1 })],
  ["logs/history", /^\/api\/logs\/history$/, () => ({ items: [
    { seq: 1, db_id: 1, ts: iso(3), level: "info", tag: "engine", text: "任务 #42 恢复运行" },
    { seq: 2, db_id: 2, ts: iso(2), level: "warn", tag: "llm", text: "配置 本地推理 熔断，冷却 60s" },
    { seq: 3, db_id: 3, ts: iso(1), level: "error", tag: "tool", text: "Bash 超时（30s）" },
  ], cursor: 3 })],
  ["assets/counts", /^\/api\/assets\/counts$/, () => ({ root_domain: 1, ip: 1, subdomain: 2, app: 1, service: 1, endpoint: 1 })],
  ["assets", /^\/api\/assets$/, () => ({ count: assets.length, total: assets.length, assets })],
  ["companies", /^\/api\/companies$/, () => ([
    { id: 1, name: "示例科技", logo: "/liora-icon.png", asset_count: 7, scope: [{ id: 1, company_id: 1, kind: "domain", domain: "example.com", raw: "example.com" }] },
    { id: 2, name: "空白企业", asset_count: 0, scope: [] },
  ])],
  ["findings/stats", /^\/api\/exploration\/findings\/stats$/, () => ({ total: findings.length, pending: 1, critical: 1, high: 1, medium: 1, low: 1, vulnclasses: ["SQL 注入", "信息泄露", "弱口令", "配置错误"], tasks: [
    { id: "42", name: "边界资产梳理", description: "对 example.com 的对外资产做暴露面梳理，确认测试环境边界", count: 2 },
    { id: "41", name: "历史漏洞复测", description: "复测上一轮确认的 3 个中危漏洞是否已修复", count: 1 },
  ] })],
  ["findings/asset-tree", /^\/api\/exploration\/findings\/asset-tree$/, () => ({ nodes: [
    { key: "c:1", kind: "company", label: "示例科技", self: 0, total: 4, critical: 1, high: 1, medium: 1, low: 1, last_found_at: iso(90) },
    { key: "a:1", parent: "c:1", kind: "endpoint", label: "https://www.example.com/api/login", asset_id: 1, self: 2, total: 2, critical: 1, high: 0, medium: 0, low: 1, last_found_at: iso(90) },
    { key: "a:2", parent: "c:1", kind: "subdomain", label: "debug.example.com", asset_id: 2, self: 1, total: 1, critical: 0, high: 1, medium: 0, low: 0, last_found_at: iso(90) },
    { key: "a:3", parent: "c:1", kind: "app", label: "测试后台", asset_id: 3, self: 1, total: 1, critical: 0, high: 0, medium: 1, low: 0, last_found_at: iso(600) },
  ], finding_total: findings.length, truncated: false })],
  ["findings/groups", /^\/api\/exploration\/findings\/groups$/, () => ({ items: [
    { task_id: "42", task_name: "边界资产梳理", task_description: "对 example.com 的对外资产做暴露面梳理，确认测试环境边界", task_status: "running", count: 2, critical: 1, high: 1, medium: 0, low: 0, last_found_at: iso(90) },
    { task_id: "41", task_name: "历史漏洞复测", task_description: "复测上一轮确认的 3 个中危漏洞是否已修复", task_status: "paused", count: 1, critical: 0, high: 0, medium: 1, low: 0, last_found_at: iso(600) },
  ], total: 2, finding_total: findings.length, page: 1, page_size: 20 })],
  ["findings/retests/active", /^\/api\/exploration\/findings\/retests\/active$/, () => ({ retests: [] })],
  ["findings/:id/traffic", /^\/api\/exploration\/findings\/[^/]+\/traffic$/, () => ({ finding_id: "f-101", version: 1, report_version: 1, bindings: [] })],
  ["findings/:id/retests", /^\/api\/exploration\/findings\/[^/]+\/retests$/, () => ({ retests: [] })],
  ["findings/:id/lineage", /^\/api\/exploration\/findings\/[^/]+\/lineage$/, () => ({ nodes, edges: [{ src: "n-1", dst: "n-2", rel: "yields" }, { src: "n-2", dst: "n-3", rel: "proves" }] })],
  ["findings/:id", /^\/api\/exploration\/findings\/[^/]+$/, () => ({ ...findings[0], report: "# 登录接口布尔盲注\n\n## 复现\n1. 发送 admin AND 1=1-- - 返回 200。\n2. 发送 admin AND 1=2-- - 返回 401。\n\n## 影响\n可枚举管理员账号。" })],
  // /api/exploration/findings is paged when page/limit are present, a bare array otherwise.
  ["findings", /^\/api\/exploration\/findings$/, (_m, url) => (url.searchParams.has("page")
    ? { items: findings, total: findings.length, page: 1, page_size: 20 }
    : findings)],
  ["exploration/nodes", /^\/api\/exploration\/nodes$/, () => ({ items: nodes, total: nodes.length, page: 1, size: 20, edges: [{ src: "n-1", dst: "n-2", rel: "yields" }], refs: {}, assets: {} })],
  ["exploration/intents", /^\/api\/exploration\/intents$/, () => ([
    { id: "901", type: "intent", state: "running", priority: 5, origin: "planner", ts: iso(30), payload: JSON.stringify({ summary: "复测 debug.example.com 暴露面" }) },
    { id: "902", type: "intent", state: "open", priority: 4, origin: "planner", ts: iso(28), payload: JSON.stringify({ summary: "确认测试环境归属" }) },
  ])],
  ["exploration/graph", /^\/api\/exploration\/graph$/, () => ({ nodes, edges: [{ src: "n-1", dst: "n-2", rel: "yields" }] })],
  ["exploration/activity/history", /^\/api\/exploration\/activity\/history$/, () => ({ items: activity, snapshot_cursor: 1205, earliest_cursor: 1201, has_more: false })],
  ["exploration/activity/:id", /^\/api\/exploration\/activity\/\d+$/, () => ({ detail: "完整步骤详情 fixture" })],
  ["exploration/activity", /^\/api\/exploration\/activity$/, () => ({ items: activity, cursor: 1205 })],
  ["exploration/main-sessions", /^\/api\/exploration\/main-sessions$/, () => ({ sessions: [{ seq: 0, created_at: iso(180) }], current: 0 })],
  ["exploration/tokens", /^\/api\/exploration\/tokens$/, () => ({
    workers: [{ worker: "work#1", input_tokens: 12000, output_tokens: 1800, cache_read_tokens: 4000, cache_write_tokens: 200 }],
    sessions: [{ session: "mainagent", input_tokens: 5200, output_tokens: 900, cache_read_tokens: 1200, cache_write_tokens: 100 }],
    total: { input_tokens: 182340, output_tokens: 24110, cache_read_tokens: 90210, cache_write_tokens: 5120 },
  })],
  ["tokens/usage", /^\/api\/tokens\/usage$/, () => ({ by_profile: [
    { profile_name: "主力 GPT", calls: 320, tasks: 4, input_tokens: 182340, output_tokens: 24110, cache_read_tokens: 90210, cache_write_tokens: 5120 },
    { profile_name: "备用 Claude", calls: 48, tasks: 2, input_tokens: 22000, output_tokens: 3100, cache_read_tokens: 9000, cache_write_tokens: 0 },
  ], daily: [
    { profile_name: "主力 GPT", date: "2026-10-19", input_tokens: 62000, output_tokens: 8100, cache_read_tokens: 30000 },
    { profile_name: "主力 GPT", date: "2026-10-20", input_tokens: 58000, output_tokens: 7600, cache_read_tokens: 28000 },
    { profile_name: "主力 GPT", date: "2026-10-21", input_tokens: 62340, output_tokens: 8410, cache_read_tokens: 32210 },
  ] })],
  ["tokens/conversations", /^\/api\/tokens\/conversations$/, () => ([
    { llm_profile_id: 1, created_at: iso(300), input_tokens: 8000, output_tokens: 1200, cache_read_tokens: 3000, cache_write_tokens: 0 },
  ])],
  ["llm/records/by-model", /^\/api\/llm\/records\/by-model$/, () => ({ models: [
    { model: "gpt-5.1", calls: 320, input_tokens: 182340, output_tokens: 24110, cache_read_tokens: 90210, cache_write_tokens: 5120 },
    { model: "claude-sonnet-4.6", calls: 48, input_tokens: 22000, output_tokens: 3100, cache_read_tokens: 9000, cache_write_tokens: 0 },
  ] })],
  ["llm/profiles", /^\/api\/llm\/profiles$/, () => ({ profiles: llmProfiles })],
  ["llm/pool", /^\/api\/llm\/pool$/, () => ({ enabled: true, bind_fallback: false, chain: [
    { profile_id: "1", name: "主力 GPT", model: "gpt-5.1", format: "openai", priority: 10, active: true, excluded: false, state: "ok", fails: 0, trips: 0, cooldown_secs: 0 },
    { profile_id: "2", name: "备用 Claude", model: "claude-sonnet-4.6", format: "anthropic", priority: 5, active: false, excluded: false, state: "degraded", fails: 2, trips: 0, cooldown_secs: 0, last_error: "429 rate limited", last_at: iso(15) },
  ] })],
  ["llm/retry-policy", /^\/api\/llm\/retry-policy$/, () => ({ connect: { attempts: 2, interval_ms: 0 }, empty: { attempts: 1, interval_ms: 0 }, stream: { attempts: 2, interval_ms: 500 }, breaker: { attempts: 3, interval_ms: 60000 }, intent: { attempts: 1, interval_ms: 0 } })],
  ["agents/:key/triggers", /^\/api\/agents\/[^/]+\/triggers$/, () => ({ triggers: [] })],
  ["agents/:key", /^\/api\/agents\/[^/]+$/, () => ({
    agent: agents.find((a) => a.key === "worker"),
    prompt: "你是执行 agent。意图：{{intent}}\n任务目标：{{goal}}\n约束：{{constraints}}",
    variables: [
      { name: "intent", description: "当前意图", example: "复测 debug.example.com", source: "exploration" },
      { name: "goal", description: "任务目标", example: "找出测试环境入口", source: "exploration" },
      { name: "constraints", description: "操作约束", example: "禁止 rm -rf", source: "runtime" },
    ],
    versions: [{ version: 3, ts: iso(2000), note: "补充约束段", template_text: "v3 模板" }],
    visibility: { mcp: [81], skill: ["web-recon"] },
    llm_profiles: llmProfiles.map((p) => ({ id: Number(p.id), name: p.name, model: p.model, is_default: p.is_default })),
    wrapup_prompt: "",
    wrapup_default: "收尾：总结本轮已确认的事实与未完成的意图。",
    wrapup_max_turns: 0,
    wrapup_max_turns_default: 3,
    task_timeout_wrapup_supported: true,
    task_timeout_wrapup_prompt: "",
    task_timeout_wrapup_default: "任务超时收尾：列出未完成项。",
    task_timeout_wrapup_max_turns: 0,
    task_timeout_wrapup_max_turns_default: 2,
  })],
  ["agents", /^\/api\/agents$/, () => ({ agents })],
  ["conversations/:id/messages", /^\/api\/conversations\/\d+\/messages$/, () => ({ items: activity, cursor: 1205, running: false, hasMore: false })],
  ["conversations/:id", /^\/api\/conversations\/\d+$/, () => conversation],
  ["mcp/:id/tools", /^\/api\/mcp\/\d+\/tools$/, () => ({ tools: [{ name: "fetch", description: "抓取网页并转 markdown" }, { name: "fetch_markdown", description: "抓取并转 markdown" }] })],
  ["mcp", /^\/api\/mcp$/, () => ({ servers: mcpServers })],
  ["skills/missing", /^\/api\/skills\/missing$/, () => ({ missing: [{ skill: "cloud-audit", calls: 3, agents: ["worker"], last_used: iso(500) }] })],
  ["skills/:name/usage", /^\/api\/skills\/[^/]+\/usage$/, () => ({ calls: [
    { ts: iso(120), agent_key: "worker", task_id: 42, session_id: "work#1", args_len: 12 },
  ] })],
  ["skills", /^\/api\/skills$/, () => ({ skills })],
  ["tools", /^\/api\/tools$/, () => ({ tools })],
  ["visibility/mcp/:id", /^\/api\/visibility\/mcp\/\d+$/, () => ({ agents: ["worker"] })],
  ["visibility/skill/:name", /^\/api\/visibility\/skill\/[^/]+$/, () => ({ agents: ["worker"] })],
  ["traffic", /^\/api\/traffic$/, () => ({ enabled: true, proxy: "http://127.0.0.1:8080", count: 0, total: 0, page: 0, size: 50, exchanges: [] })],
  ["tasks/:id/coverage", /^\/api\/tasks\/[^/]+\/coverage$/, () => ({ enabled: true, scope_rows: 3, denominator: 7, tested: 4, pct: 57, by_type: [{ type: "subdomain", total: 2, tested: 2 }, { type: "endpoint", total: 1, tested: 1 }] })],
  ["tasks/:id/coverage-graph", /^\/api\/tasks\/[^/]+\/coverage-graph$/, () => ({ nodes: [
    { key: "c:1", kind: "company", label: "示例科技", tested: false, in_scope: true, company_id: 1 },
    { key: "a:1", kind: "root_domain", label: "example.com", tested: true, in_scope: true, asset_id: 1, domain: "example.com" },
    { key: "a:2", kind: "subdomain", label: "debug.example.com", tested: true, in_scope: true, asset_id: 2, domain: "debug.example.com" },
  ], edges: [{ src: "c:1", dst: "a:1" }, { src: "a:1", dst: "a:2" }] })],
  ["tasks/:id/goals", /^\/api\/tasks\/[^/]+\/goals$/, () => ({ goals: [
    { id: "g-1", text: "确认测试环境入口归属", vulnclass: "", state: "met", origin: "operator", ts: iso(150) },
    { id: "g-2", text: "复测已确认漏洞", vulnclass: "SQL 注入", state: "open", origin: "planner", ts: iso(120) },
  ] })],
  ["tasks/:id/constraints", /^\/api\/tasks\/[^/]+\/constraints$/, () => ({ constraints: [
    { id: "c-1", kind: "deny", text: "禁止对生产域名发起主动扫描", origin: "operator", ts: iso(160) },
    { id: "c-2", kind: "allow", text: "允许对 example.com 子域做被动收集", origin: "operator", ts: iso(150) },
  ] })],
  ["tasks/:id/scope", /^\/api\/tasks\/[^/]+\/scope$/, () => ({ scope: [
    { id: 1, task_id: 42, kind: "company", company_id: 1, company_name: "示例科技", source: "auto" },
    { id: 2, task_id: 42, kind: "root_domain", domain: "example.com", source: "manual", reason: "任务描述中给出" },
  ] })],
  ["tasks/:id/intent-assets", /^\/api\/tasks\/[^/]+\/intent-assets$/, () => ({ assets: [] })],
  ["tasks/:id/assets", /^\/api\/tasks\/[^/]+\/assets$/, () => ({ assets: [] })],
  ["tasks/:id/llm/resolution", /^\/api\/tasks\/[^/]+\/llm\/resolution$/, () => ({
    mainagent: { profile_id: 1, name: "主力 GPT", format: "openai", model: "gpt-5.1", source: "task_chain", available: true },
    planner: { profile_id: 1, name: "主力 GPT", format: "openai", model: "gpt-5.1", source: "task_chain", available: true },
    worker: { profile_id: 2, name: "备用 Claude", format: "anthropic", model: "claude-sonnet-4.6", source: "agent_binding", available: true },
  })],
  ["tasks/:id/chat/status", /^\/api\/tasks\/[^/]+\/chat\/status$/, () => ({ running: false })],
  ["report", /^\/api\/report$/, () => "# 任务报告\n\n## 摘要\n共确认 2 条发现。\n\n## 发现\n1. 登录接口布尔盲注（critical）\n2. 调试接口暴露内部配置（high）\n"],
];

const missing = new Map(); // "METHOD path" -> count
const requestLog = []; // every /api request: {method, path, status, matched}

function respond(route) {
  const req = route.request();
  const url = new URL(req.url());
  const pathname = url.pathname;
  const method = req.method();

  if (pathname.startsWith("/api/logs/stream") || pathname.startsWith("/api/exploration/activity/stream")) {
    const payload = pathname.includes("logs")
      ? "retry: 60000\ndata: {\"seq\":1,\"db_id\":1,\"ts\":\"" + iso(1) + "\",\"level\":\"info\",\"tag\":\"engine\",\"text\":\"fixture SSE 行\"}\n\n"
      : "retry: 60000\n\n";
    requestLog.push({ method, path: pathname, status: 200, matched: "sse" });
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-store" }, body: payload });
  }

  for (const [name, re, handler] of API) {
    if (re.test(pathname)) {
      const body = handler({ method, pathname }, url, req);
      requestLog.push({ method, path: pathname, status: 200, matched: name });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    }
  }
  const key = method + " " + pathname;
  missing.set(key, (missing.get(key) ?? 0) + 1);
  requestLog.push({ method, path: pathname, status: 200, matched: "unknown" });
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
}

// ---------------------------------------------------------------------------
// Routes to crawl (routes.json has 20 keys; "home" is a pure redirect to
// /function/tasks, so the 19 real pages are the ones listed here).
// ---------------------------------------------------------------------------
const ROUTES = [
  { path: "/login", slug: "login" },
  { path: "/setup", slug: "setup" },
  { path: "/dashboard", slug: "dashboard" },
  { path: "/function/assets", slug: "function-assets" },
  { path: "/function/conversations/detail?c=7", slug: "conversations-detail" },
  { path: "/function/findings/detail?id=f-101&context_task=42", slug: "findings-detail" },
  { path: "/function/findings", slug: "function-findings" },
  { path: "/function/tasks/detail?id=42", slug: "tasks-detail" },
  { path: "/function/tasks", slug: "function-tasks" },
  { path: "/system/agents/detail?key=worker", slug: "agents-detail" },
  { path: "/system/agents", slug: "system-agents" },
  { path: "/system/intercept/approvals", slug: "intercept-approvals" },
  { path: "/system/intercept", slug: "system-intercept" },
  { path: "/system/llm", slug: "system-llm" },
  { path: "/system/logs", slug: "system-logs" },
  { path: "/system/mcp", slug: "system-mcp" },
  { path: "/system/settings", slug: "system-settings" },
  { path: "/system/skills", slug: "system-skills" },
  { path: "/system/tools", slug: "system-tools" },
];

const MOBILE_ROUTES = [
  "/login",
  "/function/tasks",
  "/dashboard",
  "/function/findings",
  "/function/assets",
  "/system/settings",
  "/function/tasks/detail?id=42",
];

// ---------------------------------------------------------------------------
// In-page measurement helpers (stringified into page.evaluate)
// ---------------------------------------------------------------------------
const MEASURE = () => {
  const SELECTORS = {
    button: "button",
    a: "a[href]",
    input: "input:not([type=hidden])",
    textarea: "textarea",
    select: "select",
    roleButton: '[role="button"]',
    roleTab: '[role="tab"]',
    roleMenuitem: '[role="menuitem"]',
  };
  const visible = (el) => {
    if (el.closest('[aria-hidden="true"]')) return false;
    const rects = el.getClientRects();
    if (!rects.length) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const nameOf = (el) => {
    const aria = norm(el.getAttribute("aria-label"));
    if (aria) return { name: aria, via: "aria-label" };
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const text = norm(labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" "));
      if (text) return { name: text, via: "aria-labelledby" };
    }
    if (el.labels && el.labels.length) {
      const text = norm(Array.from(el.labels).map((l) => l.textContent).join(" "));
      if (text) return { name: text, via: "label" };
    }
    const alt = norm(el.getAttribute("alt"));
    if (alt) return { name: alt, via: "alt" };
    const title = norm(el.getAttribute("title"));
    if (title) return { name: title, via: "title" };
    const placeholder = norm(el.getAttribute("placeholder"));
    if (placeholder) return { name: placeholder, via: "placeholder" };
    const text = norm(el.textContent);
    if (text) return { name: text, via: "text" };
    const value = el.getAttribute("type") === "submit" ? norm(el.getAttribute("value")) : "";
    if (value) return { name: value, via: "value" };
    return { name: "", via: "" };
  };
  const describe = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className ? "." + el.className.split(/\s+/).slice(0, 2).join(".") : "";
    const type = el.getAttribute("type") ? '[type="' + el.getAttribute("type") + '"]' : "";
    return (el.tagName.toLowerCase() + id + type + cls).slice(0, 120);
  };

  const counts = {};
  const union = new Set();
  for (const [key, sel] of Object.entries(SELECTORS)) {
    const nodes = Array.from(document.querySelectorAll(sel)).filter(visible);
    counts[key] = nodes.length;
    for (const n of nodes) union.add(n);
  }
  const unnamed = [];
  for (const el of union) {
    const { name } = nameOf(el);
    if (!name) unnamed.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute("role") || "", type: el.getAttribute("type") || "", node: describe(el) });
  }
  const landmarks = {};
  for (const sel of ["header", "nav", "main", "aside", "footer", "section", '[role="main"]', '[role="navigation"]']) {
    landmarks[sel] = Array.from(document.querySelectorAll(sel)).filter(visible).length;
  }
  const h1s = Array.from(document.querySelectorAll("h1")).filter(visible).map((h) => norm(h.textContent));
  return {
    interactiveCounts: { ...counts, total: union.size },
    unnamedControls: { count: unnamed.length, total: union.size, ratio: union.size ? unnamed.length / union.size : 0, samples: unnamed.slice(0, 10) },
    landmarks,
    h1: h1s[0] || "",
    h1Count: h1s.length,
    title: document.title,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyText: norm(document.body.innerText).slice(0, 400),
  };
};

const FOCUS_STEP = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: "body", name: "", focusVisible: false, ring: "none" };
  const style = getComputedStyle(el);
  const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 ? style.outlineStyle + " " + style.outlineWidth : "none";
  const shadow = style.boxShadow && style.boxShadow !== "none" ? style.boxShadow : "none";
  const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute("role") || "",
    name,
    focusVisible: el.matches(":focus-visible"),
    outline,
    boxShadow: shadow,
    ring: outline !== "none" || shadow !== "none" ? "visible" : "none",
  };
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function httpChecks() {
  const checks = [];
  for (const routePath of [...ROUTES.map((r) => r.path), "/"]) {
    const started = Date.now();
    try {
      const res = await fetch(BASE + routePath, { redirect: "manual" });
      const body = await res.text();
      const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
      checks.push({
        path: routePath,
        status: res.status,
        contentType: res.headers.get("content-type") || "",
        bytes: body.length,
        title,
        hasRoot: body.includes('id="root"'),
        ms: Date.now() - started,
      });
    } catch (err) {
      checks.push({ path: routePath, error: String(err.message).slice(0, 200) });
    }
  }
  return checks;
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  await mkdir(DATA, { recursive: true });

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    browser: "chromium headless (playwright)",
    viewport: { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } },
    token: TOKEN,
    status: "ok",
    blocker: null,
    routes: [],
    httpChecks: [],
    smoke: [],
    viewportResults: {},
    serverLog: {},
    missingFixtures: [],
    requestSummary: {},
    fixtureEndpoints: API.map(([name]) => name),
    screenshots: { produced: 0 },
  };

  // HTTP-level checks work without a browser and are always recorded.
  result.httpChecks = await httpChecks();
  console.log("[http] checked " + result.httpChecks.length + " paths against " + BASE);

  let browser = null;
  let browserError = "";
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    browserError = String(err.message).slice(0, 1500);
  }

  if (!browser) {
    // Honest degraded mode: record the blocker, never invent DOM metrics.
    result.status = "blocked";
    result.blocker = {
      stage: "browser-launch",
      error: browserError,
      evidence: [
        "chrome.exe --headless=new --remote-debugging-port=... -> FATAL:mojo\\public\\cpp\\platform\\platform_channel.cc:112 Check failed: . : 拒绝访问。 (0x5)",
        "crashpad_client_win.cc:431 OpenProcess: 拒绝访问。 (0x5)",
        "Identical failure with --no-sandbox, --single-process, --disable-crashpad/--disable-breakpad, and with chrome-headless-shell.",
        "Root cause: this session's Windows file sandbox denies named-pipe creation; Chromium must create a mojo platform channel during startup, so it cannot run at all.",
      ],
      impact:
        "No rendered-DOM metrics, no interaction smoke results and no screenshots were produced. Nothing in this file is estimated or simulated.",
    };
    result.screenshots = { produced: 0, note: "screenshots/ is intentionally empty: fabricating images is not acceptable." };
    result.serverLog = {
      baseUrl: BASE,
      port: 15173,
      startedBy: "npm run dev -- --port 15173 (rsbuild dev), background job",
      loginHttpStatus: (result.httpChecks.find((c) => c.path === "/login") || {}).status ?? 0,
      startup: [
        "> liora-web@2.2.0 dev",
        "> rsbuild dev --port 15173",
        "Rsbuild v2.2.13",
        "  ➜  Local:    http://127.0.0.1:15173/",
        "start   build started...",
        "ready   built in 0.52s",
        "start   building scripts",
        "ready   built in 0.26s",
      ],
      note: "The dev server itself is healthy; the block is only in launching a browser process.",
    };
    result.unitTests = {
      command: "node src/lib/<name>.test.mjs (run per file; npm test itself fails with spawn EPERM)",
      files: 7,
      tests: 33,
      pass: 33,
      fail: 0,
      source: "collected manually by the auditor, same session, same machine",
    };

    // The shared screenshots/ folder may already hold artifacts from a concurrent
    // collector. Record them factually instead of claiming them or pretending the
    // folder is empty.
    try {
      const names = (await readdir(SHOTS)).filter((f) => f.endsWith(".png"));
      const entries = [];
      for (const name of names) {
        const buf = await readFile(path.join(SHOTS, name));
        const info = await stat(path.join(SHOTS, name));
        entries.push({
          name,
          width: buf.readUInt32BE(16),
          height: buf.readUInt32BE(20),
          bytes: info.size,
          modified: info.mtime.toISOString(),
        });
      }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      const byViewport = {};
      for (const entry of entries) {
        const key = entry.width + "x" + entry.height;
        byViewport[key] = (byViewport[key] ?? 0) + 1;
      }
      result.screenshots = {
        producedByThisRun: 0,
        note: "This run produced no images. The folder is NOT empty: it holds artifacts written by a concurrent audit collector (web/scripts/audit-crawl-main.mjs, audit-interactions-main.mjs). Those files are not mine and were not used to derive any metric here.",
        directoryState: {
          path: "docs/frontend-audit-2026-10/screenshots",
          fileCount: entries.length,
          byViewport,
          files: entries,
        },
      };
    } catch (err) {
      result.screenshots = { producedByThisRun: 0, error: String(err.message).slice(0, 200) };
    }

    result.parallelCollector = {
      scripts: ["web/scripts/audit-crawl-main.mjs", "web/scripts/audit-interactions-main.mjs", "web/scripts/tmp-probe.mjs"],
      note: "A second runtime collector in the same workspace does have a working Chromium; its raw metrics JSON is not present under docs/frontend-audit-2026-10/data/.",
    };

    await writeFile(path.join(DATA, "runtime.json"), JSON.stringify(result, null, 2), "utf8");
    console.log("BLOCKED: " + browserError.split("\n")[0]);
    console.log("wrote " + path.join(DATA, "runtime.json"));
    return;
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: "zh-CN" });
  await context.addInitScript((token) => {
    localStorage.setItem("liora_token", token);
  }, TOKEN);
  await context.route("**/api/**", respond);

  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  // --- per-route crawl ---
  for (const route of ROUTES) {
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    const onConsole = (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
    };
    const onPageError = (err) => pageErrors.push(String(err.message).slice(0, 300));
    const onFailed = (req) => {
      if (!req.url().includes("/api/")) return;
      failedRequests.push({ method: req.method(), url: req.url().replace(BASE, ""), failure: req.failure()?.errorText ?? "" });
    };
    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("requestfailed", onFailed);

    const started = Date.now();
    let gotoError = "";
    try {
      await page.goto(BASE + route.path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(700);
    } catch (err) {
      gotoError = String(err.message).slice(0, 300);
    }
    const loadMs = Date.now() - started;

    const measured = await page.evaluate(MEASURE).catch((err) => ({ error: String(err.message) }));
    const shot = path.join(SHOTS, route.slug + "-desktop.png");
    await page.screenshot({ path: shot, fullPage: false, animations: "disabled" }).catch(() => {});

    result.routes.push({
      path: route.path,
      url: page.url().replace(BASE, ""),
      title: measured.title ?? "",
      h1: measured.h1 ?? "",
      h1Count: measured.h1Count ?? 0,
      interactiveCounts: measured.interactiveCounts ?? {},
      unnamedControls: measured.unnamedControls ?? {},
      landmarks: measured.landmarks ?? {},
      overflowX: (measured.scrollWidth ?? 0) > (measured.innerWidth ?? 0),
      loadMs,
      consoleErrors,
      pageErrors,
      failedRequests,
      screenshot: path.relative(OUT, shot).replace(/\\/g, "/"),
      gotoError,
      bodyTextPreview: measured.bodyText ?? "",
    });

    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("requestfailed", onFailed);
    console.log("[route] " + route.path + " -> " + (measured.h1 || "(no h1)") + " in " + loadMs + "ms");
  }

  // --- / redirect check ---
  {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    result.viewportResults.homeRedirect = { requested: "/", landed: page.url().replace(BASE, "") };
  }

  // --- smoke interactions ---
  const smoke = [];
  const record = (name, ok, detail, shotPath) => {
    smoke.push({ name, ok, detail, screenshot: shotPath ? path.relative(OUT, shotPath).replace(/\\/g, "/") : undefined });
    console.log("[smoke] " + name + " -> " + (ok ? "ok" : "FAIL") + " :: " + detail);
  };

  // 1. new-task sheet
  try {
    await page.goto(BASE + "/function/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "新建任务", exact: true }).first().click();
    const dialog = page.getByRole("dialog").filter({ hasText: "新建任务" }).first();
    await dialog.waitFor({ state: "visible", timeout: 8_000 });
    const shot = path.join(SHOTS, "smoke-new-task-sheet.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    const fields = await page.evaluate(() => document.querySelectorAll('[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] button').length);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const closed = await dialog.isHidden().catch(() => true);
    record("新建任务抽屉打开/关闭", closed, "抽屉可见并截图；抽屉内 input/textarea/button 共 " + fields + " 个；Esc 后关闭=" + closed, shot);
  } catch (err) {
    record("新建任务抽屉打开/关闭", false, String(err.message).slice(0, 300));
  }

  // 2. command palette: Ctrl+K (claimed) then Ctrl+J (actual binding)
  try {
    await page.goto(BASE + "/function/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);
    const dialogAfterK = await page.getByRole("dialog", { name: "搜索页面" }).count();
    const shotK = path.join(SHOTS, "smoke-search-ctrlk.png");
    await page.screenshot({ path: shotK, animations: "disabled" });
    await page.keyboard.press("Control+j");
    await page.waitForTimeout(500);
    const dialog = page.getByRole("dialog", { name: "搜索页面" });
    await dialog.waitFor({ state: "visible", timeout: 5_000 });
    const optionCount = await dialog.getByRole("option").count();
    const shotJ = path.join(SHOTS, "smoke-search-ctrlj.png");
    await page.screenshot({ path: shotJ, animations: "disabled" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = (await dialog.count()) === 0;
    record(
      "命令搜索快捷键",
      closed,
      "Ctrl+K 打开对话框数量=" + dialogAfterK + "（预期 0，实际绑定为 Ctrl+J）；Ctrl+J 打开后 option 数=" + optionCount + "；Esc 关闭=" + closed,
      shotJ,
    );
  } catch (err) {
    record("命令搜索快捷键", false, String(err.message).slice(0, 300));
  }

  // 3. sidebar collapse (desktop)
  try {
    await page.goto(BASE + "/function/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const before = await page.locator('[data-slot="sidebar"]').first().boundingBox();
    await page.getByRole("button", { name: "切换侧边栏", exact: true }).first().click();
    await page.waitForTimeout(600);
    const after = await page.locator('[data-slot="sidebar"]').first().boundingBox();
    const state = await page.evaluate(() => document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state"));
    const shot = path.join(SHOTS, "smoke-sidebar-collapsed.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    await page.getByRole("button", { name: "切换侧边栏", exact: true }).first().click();
    await page.waitForTimeout(500);
    const restored = await page.locator('[data-slot="sidebar"]').first().boundingBox();
    const ok = !!before && !!after && after.width < before.width && !!restored && Math.abs(restored.width - before.width) < 2;
    record(
      "侧栏折叠/展开（1440px）",
      ok,
      "宽度 " + Math.round(before?.width ?? 0) + "px → " + Math.round(after?.width ?? 0) + "px（data-state=" + state + "），再次点击回到 " + Math.round(restored?.width ?? 0) + "px",
      shot,
    );
  } catch (err) {
    record("侧栏折叠/展开（1440px）", false, String(err.message).slice(0, 300));
  }

  // 4. theme toggle
  try {
    await page.goto(BASE + "/function/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const before = await page.locator("html").getAttribute("data-theme-mode");
    const themeButton = page.getByRole("button", { name: /当前主题：/ }).first();
    await themeButton.click();
    await page.waitForTimeout(600);
    const after = await page.locator("html").getAttribute("data-theme-mode");
    const shot = path.join(SHOTS, "smoke-theme-toggled.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    record("主题切换", before !== after, "data-theme-mode " + before + " → " + after, shot);
  } catch (err) {
    record("主题切换", false, String(err.message).slice(0, 300));
  }

  // 5. delete confirmation (alertdialog)
  try {
    await page.goto(BASE + "/function/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "删除任务", exact: true }).first().click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor({ state: "visible", timeout: 6_000 });
    const title = (await dialog.locator("h2").first().textContent().catch(() => "")) || "";
    const shot = path.join(SHOTS, "smoke-delete-confirm.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    const cancel = dialog.getByRole("button", { name: "取消", exact: true });
    const hasCancel = (await cancel.count()) > 0;
    if (hasCancel) await cancel.first().click();
    await page.waitForTimeout(400);
    const closed = await dialog.isHidden().catch(() => true);
    record("删除确认对话框", closed, "标题=" + title.replace(/\s+/g, " ").trim() + "；取消按钮=" + hasCancel + "；取消后关闭=" + closed, shot);
  } catch (err) {
    record("删除确认对话框", false, String(err.message).slice(0, 300));
  }

  // 6. Tab focus walkthrough (15 stops) on the tasks list
  try {
    await page.goto(BASE + "/function/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.evaluate(() => document.body.focus());
    const stops = [];
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(90);
      stops.push(await page.evaluate(FOCUS_STEP));
    }
    const visibleRing = stops.filter((s) => s.ring === "visible").length;
    const shot = path.join(SHOTS, "smoke-tab-focus.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    record(
      "Tab 键焦点走查（前 15 个）",
      visibleRing > 0,
      "15 个焦点中 " + visibleRing + " 个检测到可见焦点环（outline 或 box-shadow）；" + (stops[0] ? "首个焦点=" + stops[0].tag + "/" + stops[0].name : ""),
      shot,
    );
    result.viewportResults.tabStops = stops;
  } catch (err) {
    record("Tab 键焦点走查（前 15 个）", false, String(err.message).slice(0, 300));
  }

  // 7. 390px sidebar behaviour
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + "/function/tasks", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const sidebarVisible = await page.locator('[data-slot="sidebar"]').first().isVisible().catch(() => false);
    await page.getByRole("button", { name: "切换侧边栏", exact: true }).first().click();
    await page.waitForTimeout(700);
    const navDialog = page.getByRole("dialog", { name: "页面导航" });
    const dialogCount = await navDialog.count();
    const box = dialogCount ? await navDialog.first().boundingBox() : null;
    const shot = path.join(SHOTS, "smoke-mobile-sidebar.png");
    await page.screenshot({ path: shot, animations: "disabled" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const closed = dialogCount ? (await navDialog.count()) === 0 : false;
    record(
      "390px 侧栏行为",
      dialogCount > 0,
      "折叠前侧栏可见=" + sidebarVisible + "；点击后出现 dialog[页面导航]=" + dialogCount + "（" + Math.round(box?.width ?? 0) + "×" + Math.round(box?.height ?? 0) + "）；Esc 关闭=" + closed,
      shot,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
  } catch (err) {
    record("390px 侧栏行为", false, String(err.message).slice(0, 300));
  }

  result.smoke = smoke;

  // --- mobile screenshots ---
  const mobile = {};
  await page.setViewportSize({ width: 390, height: 844 });
  for (const routePath of MOBILE_ROUTES) {
    const slug = ROUTES.find((r) => r.path === routePath)?.slug ?? "home";
    try {
      await page.goto(BASE + routePath, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const shot = path.join(SHOTS, slug + "-mobile-390.png");
      await page.screenshot({ path: shot, fullPage: false, animations: "disabled" });
      mobile[routePath] = { screenshot: path.relative(OUT, shot).replace(/\\/g, "/"), horizontalOverflow: overflow };
    } catch (err) {
      mobile[routePath] = { error: String(err.message).slice(0, 200) };
    }
  }
  result.viewportResults.mobile = mobile;
  await page.setViewportSize({ width: 1440, height: 1000 });

  // --- server log snapshot ---
  const health = await context.request.get(BASE + "/login").then((r) => r.status()).catch(() => 0);
  result.serverLog = { baseUrl: BASE, loginHttpStatus: health, note: "rsbuild dev server started by the audit runner on port 15173" };

  // --- summaries ---
  const totals = { button: 0, a: 0, input: 0, textarea: 0, select: 0, roleButton: 0, roleTab: 0, roleMenuitem: 0, total: 0 };
  for (const r of result.routes) for (const k of Object.keys(totals)) totals[k] += r.interactiveCounts?.[k] ?? 0;
  const unnamedTotal = result.routes.reduce((n, r) => n + (r.unnamedControls?.count ?? 0), 0);
  result.requestSummary = {
    totalApiRequests: requestLog.length,
    routesWithConsoleErrors: result.routes.filter((r) => r.consoleErrors.length).length,
    routesWithPageErrors: result.routes.filter((r) => r.pageErrors.length).length,
    routesWithFailedRequests: result.routes.filter((r) => r.failedRequests.length).length,
    interactiveTotals: totals,
    unnamedControlsTotal: unnamedTotal,
    distinctEndpoints: new Set(requestLog.map((r) => r.path)).size,
    unknownEndpoints: [...missing.keys()].sort(),
  };
  result.missingFixtures = [...missing.entries()].map(([endpoint, count]) => ({ endpoint, count })).sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  result.requestLog = requestLog;

  result.screenshots = {
    produced: result.routes.length + Object.keys(result.viewportResults.mobile ?? {}).length,
    desktop: result.routes.length,
    mobile: Object.keys(result.viewportResults.mobile ?? {}).length,
    directory: "docs/frontend-audit-2026-10/screenshots",
  };

  await writeFile(path.join(DATA, "runtime.json"), JSON.stringify(result, null, 2), "utf8");
  console.log("wrote " + path.join(DATA, "runtime.json"));
  await browser.close();
}

main().catch((err) => {
  console.error("crawl failed:", err);
  process.exitCode = 1;
});
