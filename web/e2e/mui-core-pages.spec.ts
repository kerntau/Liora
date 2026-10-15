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

test("asset, finding and task pages render with MUI navigation and list controls", async ({ page, request }) => {
  await login(page, request);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/function/assets");
  await expect(page.getByRole("tab", { name: /企业/ })).toBeVisible();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  const rootDomainTab = page.getByRole("tab", { name: /根域名/ });
  await rootDomainTab.click();
  await expect(rootDomainTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();

  await page.goto("/function/findings");
  await expect(page.getByRole("tab", { name: "全部发现", exact: true })).toBeVisible();
  const groupedTab = page.getByRole("tab", { name: "按任务分组", exact: true });
  await groupedTab.click();
  await expect(groupedTab).toHaveAttribute("aria-selected", "true");

  await page.goto("/function/tasks");
  await expect(page.getByRole("tab", { name: "当前任务", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "已归档", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toBeVisible();
  expect(errors).toEqual([]);
});
