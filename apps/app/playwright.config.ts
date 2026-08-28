import { defineConfig, devices } from "@playwright/test";

const playwrightPort = Number(process.env.PLAYWRIGHT_PORT ?? 5173);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.playwright.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${playwrightPort}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: `bun run dev -- --port ${playwrightPort}`,
    url: `http://localhost:${playwrightPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
