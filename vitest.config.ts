import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * @see https://vitest.dev/config/
 */
export default defineConfig({
  cacheDir: "./.cache/vite",
  test: {
    projects: ["apps/*"],
    exclude: ["node_modules/**", "dist/**", ".git/**", "e2e/**", "**/e2e/**"],
  },
});
