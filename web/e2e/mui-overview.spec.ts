import { expect, test } from "@playwright/test";

test("task overview preserves goal, constraint and scope editing against the backend", async ({
  page,
  request,
}, testInfo) => {
  const password = "liora-e2e-password";
  const status = await (await request.get("/api/auth/status")).json();
  const response = await request.post(status.initialized ? "/api/auth/login" : "/api/auth/init", {
    data: status.initialized ? { username: "Liora", password } : { password },
  });
  expect(response.ok()).toBe(true);
  const { token } = await response.json();
  await page.addInitScript((value) => localStorage.setItem("liora_token", value), token);
  const created = await request.post("/api/tasks", {
    headers: { Authorization: `Bearer ${token}` },
    data: { description: "MUI 总览回归", goal: "只验证界面，不执行外部操作", seed_first_intent: false },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Supply usage solely for the read-only table. Mutations use the real,
  // isolated e2e backend, which has no model provider configured.
  await page.route("**/api/llm/records/by-model?*", (route) =>
    route.fulfill({
      json: {
        models: [
          {
            model: "fixture-model",
            calls: 2,
            input_tokens: 1000,
            output_tokens: 200,
            cache_read_tokens: 250,
            cache_write_tokens: 0,
          },
        ],
      },
    }),
  );
  await page.goto(`/function/tasks/detail?id=${id}`);
  await page.getByRole("tab", { name: "总览", exact: true }).click();
  const goals = page.getByRole("region", { name: "目标管理", exact: true });
  await expect(goals).toBeVisible();
  await goals.getByRole("textbox", { name: "新增目标", exact: true }).fill("验证 MUI 目标编辑");
  await goals.getByRole("textbox", { name: "新增目标", exact: true }).press("Enter");
  const goal = goals.getByText("验证 MUI 目标编辑", { exact: true });
  await expect(goal).toBeVisible();
  await goal.locator("..").getByRole("button", { name: "编辑目标", exact: true }).click();
  await goals.getByRole("textbox", { name: "编辑目标", exact: true }).fill("临时修改");
  await goals.getByRole("textbox", { name: "编辑目标", exact: true }).press("Escape");
  await expect(goal).toBeVisible();
  await goal.locator("..").getByRole("button", { name: "编辑目标", exact: true }).click();
  await goals.getByRole("textbox", { name: "编辑目标", exact: true }).fill("MUI 目标已更新");
  await goals.getByRole("button", { name: "保存目标", exact: true }).click();
  const updatedGoal = goals.getByText("MUI 目标已更新", { exact: true });
  await expect(updatedGoal).toBeVisible();
  await updatedGoal.locator("..").getByRole("button", { name: "删除目标", exact: true }).click();
  await expect(updatedGoal).toHaveCount(0);

  const constraints = page.getByRole("region", { name: "操作约束", exact: true });
  await constraints.getByRole("textbox", { name: "新增操作约束" }).fill("禁止请求外部网络");
  await constraints.getByRole("button", { name: "添加", exact: true }).click();
  const constraint = constraints.getByText("禁止请求外部网络", { exact: true });
  await expect(constraint).toBeVisible();
  await constraint.locator("..").getByRole("button", { name: "编辑操作约束" }).click();
  await constraints.getByRole("textbox", { name: "编辑操作约束" }).fill("禁止修改测试数据之外的内容");
  await constraints.getByRole("button", { name: "保存操作约束" }).click();
  const updatedConstraint = constraints.getByText("禁止修改测试数据之外的内容", { exact: true });
  await expect(updatedConstraint).toBeVisible();
  await updatedConstraint.locator("..").getByRole("button", { name: "删除操作约束" }).click();
  await expect(updatedConstraint).toHaveCount(0);

  const scope = page.getByRole("region", { name: "测试范围", exact: true });
  await scope.getByRole("combobox", { name: "范围类型" }).selectOption({ label: "网段" });
  await scope.getByRole("textbox", { name: "范围值" }).fill("192.0.2.0/24");
  await scope.getByRole("button", { name: "添加", exact: true }).click();
  const entry = scope.getByText("192.0.2.0/24", { exact: true });
  await expect(entry).toBeVisible();
  await entry.locator("..").getByRole("button", { name: "删除测试范围" }).click();
  await expect(entry).toHaveCount(0);
  const tokens = page.getByRole("table", { name: "按模型 Token 用量" });
  await expect(tokens.getByRole("cell", { name: "fixture-model" })).toBeVisible();
  await expect(tokens.getByRole("cell", { name: "25%", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "查看或切换任务 LLM 配置" }).click();
  const modelDialog = page.getByRole("dialog", { name: "任务 LLM 配置链" });
  await expect(modelDialog).toBeVisible();
  await modelDialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.getByRole("button", { name: "恢复", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "归档任务", exact: true }).click();
  const archiveDialog = page.getByRole("alertdialog", { name: new RegExp(`归档任务 #${id}`) });
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(archiveDialog).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("overview-desktop.png"), fullPage: true, animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("overview-mobile.png"), fullPage: true, animations: "disabled" });
  expect(errors).toEqual([]);
});
