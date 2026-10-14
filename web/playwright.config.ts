import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 45_000,
  use: { headless: true, viewport: { width: 1440, height: 1000 }, trace: "retain-on-failure" },
  projects: [
    { name: "rsbuild", use: { baseURL: "http://127.0.0.1:15173" } },
    { name: "embedded", use: { baseURL: "http://127.0.0.1:18787" } },
  ],
  webServer: [
    { command: "node scripts/e2e-backend.mjs", url: "http://127.0.0.1:18787/api/health", timeout: 120_000 },
    {
      command: "npm run dev -- --port 15173",
      url: "http://127.0.0.1:15173/login",
      env: { LIORA_API: "http://127.0.0.1:18787" },
      timeout: 60_000,
    },
  ],
});
