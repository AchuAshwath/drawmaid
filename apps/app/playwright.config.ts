import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.playwright.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      // `channel: "chrome"` uses the Google Chrome already installed on the
      // machine instead of Playwright's own ~550MB download. The bundled build
      // buys nothing here: the conversion needs a real browser for getBBox and
      // CSS colour parsing (#40/#50, #34), not a specific Chromium revision.
      // CI still has to install one; set PLAYWRIGHT_CHANNEL= to opt out.
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
