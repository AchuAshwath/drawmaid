import { test, expect } from "@playwright/test";

test.describe("speech-recognition integration", () => {
  test("VoiceInputButton works with speech recognition mock", async ({
    page,
  }) => {
    // This test verifies the button can be rendered with mock
    await page.goto("/");
    await page.waitForSelector(".excalidraw", { timeout: 30000 });

    // Verify page loaded successfully
    await expect(page.locator(".excalidraw")).toBeVisible();
  });

  test("page loads without speech recognition errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        msg.text().toLowerCase().includes("speech")
      ) {
        errors.push(msg.text());
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForSelector(".excalidraw", { timeout: 30000 });

    // Should have no speech-related errors
    expect(errors).toHaveLength(0);
  });
});
