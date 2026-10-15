import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

import type { Agent, AgentDetail, Tool } from "../src/lib/types";

async function login(page: Page, request: APIRequestContext) {
  const password = "liora-e2e-password";
  const { initialized } = await (await request.get("/api/auth/status")).json();
  const auth = await request.post(initialized ? "/api/auth/login" : "/api/auth/init", {
    data: initialized ? { username: "Liora", password } : { password },
  });
  expect(auth.ok()).toBe(true);
  const { token } = await auth.json();
  await page.addInitScript((value) => localStorage.setItem("liora_token", value), token);
  return { Authorization: `Bearer ${token}` };
}

function fixtureTools(): Tool[] {
  return [
    {
      key: "fixture_read",
      system: true,
      enabled: true,
      description: "Read fixture data",
      agents: [],
      schema: {
        type: "object",
        properties: { target: { type: "string", description: "Target description", default: "old" } },
        required: ["target"],
      },
    },
    { key: "traffic_search", system: true, enabled: true, description: "Traffic fixture", agents: [], schema: {} },
  ];
}

test("agent editor preserves typed config, prompt preview and versions, resource authorization and mobile drawer", async ({
  page,
  request,
}, testInfo) => {
  const headers = await login(page, request);
  const tools = fixtureTools();
  let visibility = { mcp: [] as number[], skill: [] as string[] };
  let config: Partial<Agent> = {};
  let rejectVisibility = false;
  const configs: unknown[] = [];
  await page.route("**/api/agents/worker", async (route) => {
    const actual = await route.fetch();
    const detail: AgentDetail = await actual.json();
    await route.fulfill({
      json: {
        ...detail,
        agent: { ...detail.agent, ...config },
        visibility,
        llm_profiles: [{ id: 17, name: "Fixture profile", model: "fixture-model", is_default: false }],
      },
    });
  });
  await page.route("**/api/agents/worker/config", async (route) => {
    config = { ...config, ...route.request().postDataJSON() };
    configs.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/agents/worker/visibility", async (route) => {
    if (rejectVisibility) {
      await route.fulfill({ status: 500, json: { error: "Fixture authorization rejected" } });
      return;
    }
    visibility = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/mcp", (route) =>
    route.fulfill({
      json: { servers: [{ id: 71, name: "Fixture MCP", transport: "http", args: [], env: {}, enabled: true }] },
    }),
  );
  await page.route("**/api/skills", (route) =>
    route.fulfill({
      json: {
        skills: [
          {
            name: "fixture-skill",
            description: "Fixture skill description",
            files: [],
            calls: 0,
            tasks: 0,
            usage_agents: [],
          },
        ],
      },
    }),
  );
  await page.route("**/api/tools", (route) => route.fulfill({ json: { tools } }));
  await page.route("**/api/tools/fixture_read", async (route) => {
    Object.assign(tools[0], route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto("/system/agents/detail?key=worker");
  await page.getByRole("spinbutton", { name: "max-turns", exact: true }).fill("12");
  await page.getByRole("spinbutton", { name: "run-seconds", exact: true }).fill("45");
  await page.getByRole("combobox", { name: "默认模型（LLM 配置）" }).click();
  await page.getByRole("option", { name: "Fixture profile（fixture-model）" }).click();
  const shell = page.getByRole("switch", { name: "interactive-shell", exact: true });
  await shell.setChecked(true);
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect.poll(() => configs.length).toBe(1);
  expect(configs[0]).toMatchObject({ llm_profile_id: 17, max_turns: 12, run_seconds: 45, interactive_shell: true });

  const prompt = page.getByRole("textbox", { name: "提示词正文", exact: true });
  await prompt.fill("MUI prompt first");
  await page.getByRole("button", { name: "预览渲染", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "渲染预览", exact: true });
  await expect(preview.getByText("MUI prompt first", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "关闭", exact: true }).click();
  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/agents/worker/prompt") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  const firstVersion = (await (await saved).json()).version;
  await expect(page.getByRole("button", { name: `查看版本 v${firstVersion}`, exact: true })).toBeVisible();
  await prompt.fill("MUI prompt second");
  const savedAgain = page.waitForResponse(
    (response) => response.url().endsWith("/agents/worker/prompt") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "保存为新版本", exact: true }).click();
  const latestVersion = (await (await savedAgain).json()).version;
  await expect(page.getByRole("button", { name: `对比版本 v${firstVersion}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `对比版本 v${firstVersion}`, exact: true }).click();
  const diff = page.getByRole("dialog", { name: `版本对比：v${firstVersion} → v${latestVersion}（当前）` });
  await expect(diff).toContainText("MUI prompt first");
  await expect(diff).toContainText("MUI prompt second");
  await diff.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: `查看版本 v${firstVersion}`, exact: true }).click();
  const version = page.getByRole("dialog", { name: `v${firstVersion}`, exact: true });
  await version.getByRole("button", { name: "加载到编辑器", exact: true }).click();
  await expect(prompt).toHaveValue("MUI prompt first");
  const actual = await (await request.get("/api/agents/worker", { headers })).json();
  expect(actual.prompt).toBe("MUI prompt second");
  await page.getByRole("tab", { name: "MCP", exact: true }).click();
  const mcp = page.getByRole("checkbox", { name: /Fixture MCP/ });
  await mcp.check();
  await expect.poll(() => visibility.mcp).toEqual([71]);
  await page.getByRole("tab", { name: "Skill", exact: true }).click();
  rejectVisibility = true;
  const skill = page.getByRole("checkbox", { name: /fixture-skill/ });
  await skill.check();
  await expect(skill).not.toBeChecked();
  await expect(page.getByText(/Fixture authorization rejected/)).toBeVisible();
  rejectVisibility = false;
  await skill.check();
  await expect.poll(() => visibility.skill).toEqual(["fixture-skill"]);
  await page.getByRole("tab", { name: "Tools", exact: true }).click();
  await page.getByRole("checkbox", { name: /fixture_read/ }).check();
  await expect.poll(() => tools[0].agents).toEqual(["worker"]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/system/agents");
  await page
    .getByRole("button", { name: /worker/, exact: false })
    .first()
    .click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect.poll(async () => Math.round((await drawer.boundingBox())?.width ?? 0)).toBe(390);
  await expect.poll(async () => Math.round((await drawer.boundingBox())?.x ?? -1)).toBe(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("agent-editor-mobile.png") });
  await page.getByRole("button", { name: "关闭 Agent 编辑器" }).click();
  await expect(drawer).toBeHidden();
});

test("tool editor preserves immutable schema, binding, custom tool validation and typed execution fields", async ({
  page,
  request,
}, testInfo) => {
  await login(page, request);
  const tools = fixtureTools();
  const writes: { key: string; data: Partial<Tool> }[] = [];
  const runs: unknown[] = [];
  await page.route("**/api/tools", (route) => route.fulfill({ json: { tools } }));
  await page.route("**/api/tools/fixture_read", async (route) => {
    const data = route.request().postDataJSON();
    writes.push({ key: "fixture_read", data });
    Object.assign(tools[0], data);
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/tools/custom", async (route) => {
    const data = route.request().postDataJSON();
    writes.push({ key: data.key, data });
    tools.push({ ...data, system: false });
    await route.fulfill({ json: { key: data.key } });
  });
  await page.route("**/api/tools/custom/test", async (route) => {
    runs.push(route.request().postDataJSON());
    await route.fulfill({ json: { output: "Fixture test output", is_error: false } });
  });
  await page.goto("/system/tools");
  await page.getByRole("button", { name: /fixture_read/ }).click();
  const builtin = page.getByRole("dialog", { name: "fixture_read", exact: true });
  await builtin.getByRole("textbox", { name: "工具描述", exact: true }).fill("Updated fixture description");
  await builtin.getByRole("textbox", { name: "参数描述", exact: true }).fill("Updated parameter");
  await builtin.getByRole("textbox", { name: "参数默认值", exact: true }).fill("new-default");
  await builtin.getByRole("checkbox", { name: /worker/ }).check();
  await builtin.getByRole("button", { name: "保存", exact: true }).click();
  await expect(builtin).toBeHidden();
  expect(writes[0]).toMatchObject({
    key: "fixture_read",
    data: {
      description: "Updated fixture description",
      agents: ["worker"],
      schema: {
        type: "object",
        properties: { target: { type: "string", description: "Updated parameter", default: "new-default" } },
        required: ["target"],
      },
    },
  });
  await page.getByRole("tab", { name: "自定义工具", exact: true }).click();
  await page.getByRole("button", { name: "新建自定义工具", exact: true }).click();
  const custom = page.getByRole("dialog", { name: "新建自定义工具", exact: true });
  await custom.getByRole("textbox", { name: "工具 Key", exact: true }).fill("Invalid-Key");
  await custom.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByText("key 需小写字母开头，仅含小写字母/数字/下划线", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  await custom.getByRole("textbox", { name: "工具 Key", exact: true }).fill("fixture_command");
  await custom.getByRole("textbox", { name: "工具描述", exact: true }).fill("Fixture command description");
  await custom.getByRole("combobox", { name: "工具类型", exact: true }).click();
  await page.getByRole("option", { name: "command（shell 命令模板）", exact: true }).click();
  await custom.getByRole("textbox", { name: "命令模板", exact: true }).fill("echo {target}");
  await custom.getByRole("spinbutton").fill("2500");
  await custom.getByRole("switch", { name: "延迟加载", exact: true }).check();
  await custom.getByRole("textbox", { name: "测试参数 JSON", exact: true }).fill('{"target":"fixture"}');
  await custom.getByRole("button", { name: "测试运行", exact: true }).click();
  await expect(custom.getByText("Fixture test output", { exact: true })).toBeVisible();
  expect(runs).toEqual([
    { kind: "command", exec: { command: "echo {target}", timeout_ms: 2500 }, params: { target: "fixture" } },
  ]);
  await custom.getByRole("checkbox", { name: /worker/ }).check();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => Math.round((await custom.boundingBox())?.width ?? 0)).toBe(390);
  await expect.poll(async () => Math.round((await custom.boundingBox())?.x ?? -1)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("custom-tool-mobile.png") });
  await custom.getByRole("button", { name: "创建", exact: true }).click();
  await expect(custom).toBeHidden();
  expect(writes[1]).toMatchObject({
    key: "fixture_command",
    data: {
      kind: "command",
      enabled: true,
      deferred: true,
      agents: ["worker"],
      exec: { command: "echo {target}", timeout_ms: 2500 },
    },
  });
});
