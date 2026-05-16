import { expect, test } from "@playwright/test";

import { signInWithCredentials } from "./e2e-sign-in";

const hasAuth =
  !!process.env.E2E_EMAIL?.trim() && !!process.env.E2E_PASSWORD?.trim();

test.describe("communication graph", () => {
  test.describe.configure({ timeout: 8 * 60_000 });

  test.skip(
    !hasAuth,
    "Set E2E_EMAIL and E2E_PASSWORD to run authenticated communication E2E.",
  );

  test("create edge, listed, delete + API policy check", async ({ page }) => {
    test.setTimeout(8 * 60_000);
    await signInWithCredentials(
      page,
      process.env.E2E_EMAIL!,
      process.env.E2E_PASSWORD!,
    );
    await page.waitForFunction(
      () => !window.location.pathname.includes("/auth/sign-in"),
      undefined,
      { timeout: 90_000 },
    );

    await page.goto("/onboarding?quick=1");
    await expect(page.getByTestId("onboarding-path-existing")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("onboarding-path-existing").click();
    await expect(page.getByTestId("onboarding-business-name")).toBeVisible();

    const bizName = `E2E Comm ${Date.now()}`;
    await page.getByTestId("onboarding-business-name").fill(bizName);
    await page.getByTestId("onboarding-submit").click();
    await page.waitForURL(/\/dashboard\/grill-me\/[0-9a-f-]+/i, {
      timeout: 120_000,
      waitUntil: "domcontentloaded",
    });

    const grillUrl = page.url();
    const businessIdMatch = grillUrl.match(/\/dashboard\/grill-me\/([^/?]+)/i);
    expect(businessIdMatch?.[1]).toBeTruthy();
    const businessId = businessIdMatch![1];

    await page.goto(`/dashboard/communication?businessId=${businessId}`);
    // Edge form + list live in "List" view; default is Graph (canvas v2).
    await page.getByTestId("communication-view-list").click();
    await expect(page.getByTestId("communication-edge-form")).toBeVisible({
      timeout: 60_000,
    });

    const suffix = Date.now();
    const fromRole = `e2e_from_${suffix}`;
    const toRole = `e2e_to_${suffix}`;

    await page.getByTestId("communication-edge-from").fill(fromRole);
    await page.getByTestId("communication-edge-to").fill(toRole);
    await page.getByTestId("communication-edge-intents").fill("notify_completion");
    await page.getByTestId("communication-edge-artifacts").fill("ticket_ref");
    await page.getByTestId("communication-edge-submit").click();

    await expect(page.getByTestId("communication-edge-list")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(fromRole, { exact: true })).toBeVisible({
      timeout: 60_000,
    });

    const checkRes = await page.request.post("/api/communication/check", {
      data: {
        org_id: businessId,
        from_role: "nonexistent_role_a",
        to_role: "nonexistent_role_b",
        intent: "notify_completion",
        artifacts: [],
      },
    });
    expect(checkRes.status()).toBe(403);
    const checkJson = (await checkRes.json()) as { error_code?: string };
    expect(checkJson.error_code).toBe("CONSULT_EDGE_DISALLOWED");

    const row = page.getByTestId("communication-edge-list").locator("tr", {
      hasText: fromRole,
    });
    // Hide fixed Conductor chat launcher so it cannot block the delete button hit-target.
    await page.evaluate(() => {
      const selectors = [
        '[aria-label="Chat with Conductor"]',
        '[title="Chat with Conductor"]',
      ];
      for (const sel of selectors) {
        document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
          el.style.setProperty("display", "none", "important");
        });
      }
    });
    await row.getByTestId(/^communication-edge-delete-/).click();
    await expect(page.getByText(fromRole, { exact: true })).toHaveCount(0, {
      timeout: 60_000,
    });
  });
});
