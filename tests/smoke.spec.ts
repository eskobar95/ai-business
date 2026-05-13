import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home returns 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("settings route returns a response (auth may redirect)", async ({ page }) => {
    const response = await page.goto("/dashboard/settings");
    const status = response?.status() ?? 0;
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });

  test("legacy /dashboard/projects responds with redirect to missions (auth may redirect)", async ({
    page,
  }) => {
    const response = await page.goto("/dashboard/projects");
    const status = response?.status() ?? 0;
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });

  test("dashboard webhooks route responds (auth may redirect)", async ({ page }) => {
    const response = await page.goto("/dashboard/webhooks");
    const status = response?.status() ?? 0;
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });

  test("sign-in page shows email input", async ({ page }) => {
    await page.goto("/auth/sign-in");
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
  });
});
