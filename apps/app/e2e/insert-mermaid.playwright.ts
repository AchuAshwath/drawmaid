import { test, expect } from "@playwright/test";

test.describe("insert-mermaid integration", () => {
  test("page loads with Excalidraw", async ({ page }) => {
    await page.goto("/");

    // Wait for Excalidraw container to load
    await page.waitForSelector(".excalidraw", { timeout: 30000 });

    // Verify Excalidraw is visible (use container which is always present)
    const excalidraw = page.locator(".excalidraw");
    await expect(excalidraw).toBeVisible();
  });

  test("page loads without critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Excalidraw to load
    await page.waitForSelector(".excalidraw", { timeout: 30000 });

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("manifest"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test("Excalidraw renders correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".excalidraw", { timeout: 30000 });

    // Verify Excalidraw is in the DOM
    const hasExcalidraw = await page.evaluate(() => {
      return (
        typeof window !== "undefined" && !!document.querySelector(".excalidraw")
      );
    });

    expect(hasExcalidraw).toBe(true);
  });
});
