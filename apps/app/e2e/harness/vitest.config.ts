/**
 * The harness lives under `e2e/`, which the app's vitest project excludes
 * because everything else in there is Playwright. These are plain unit tests
 * over pure functions, so they get their own config rather than moving the
 * harness into a production directory.
 *
 * Run: bunx vitest run --config apps/app/e2e/harness/vitest.config.ts
 */
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: fileURLToPath(
    new URL("../../../../.cache/vite-harness", import.meta.url),
  ),
  test: {
    name: "harness",
    root: fileURLToPath(new URL(".", import.meta.url)),
    include: ["**/*.test.ts"],
    environment: "node",
  },
});
