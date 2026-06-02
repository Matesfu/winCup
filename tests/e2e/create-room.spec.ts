import { test, expect } from "@playwright/test";

/**
 * Create Room E2E tests.
 *
 * These tests require a signed-in session.
 * Sign-in is done via the UI in a shared fixture (once per describe block).
 *
 * Prerequisites:
 *   - .env.local with valid Supabase credentials
 *   - A test user must exist: username="testhost", email="testhost@wincup.test", password="testpass123"
 *   - Email confirmation DISABLED in Supabase Auth settings
 */

// Shared sign-in helper — signs in via the UI once per describe block
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/auth/sign-in");
  await page.getByRole("textbox", { name: /username or email/i }).fill("testhost@wincup.test");
  await page.getByLabel(/password/i).fill("testpass123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/room\/create/, { timeout: 10000 });
}

test.describe("Create Room page", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("unauthenticated visit redirects to /auth/sign-in", async ({ page }) => {
    await page.goto("/room/create");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("page loads with all form sections after sign-in", async ({ page }) => {
    await signIn(page);
    await expect(page.getByText("1. Your Info")).toBeVisible();
    await expect(page.getByText("2. Win Rule")).toBeVisible();
    await expect(page.getByText("3. Pick Countries")).toBeVisible();
    await expect(page.getByText("4. Stake (Optional)")).toBeVisible();
  });

  test("Create Room button is disabled with fewer than 4 countries", async ({ page }) => {
    await signIn(page);
    // Select only 2 countries
    const cards = page.locator('[data-testid^="country-card-"]');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(page.getByTestId("create-room-submit")).toBeDisabled();
  });

  test("Create Room button enables after selecting 4 countries", async ({ page }) => {
    await signIn(page);
    const cards = page.locator('[data-testid^="country-card-"]');
    await cards.nth(0).click();
    await cards.nth(1).click();
    await cards.nth(2).click();
    await cards.nth(3).click();
    await expect(page.getByTestId("create-room-submit")).not.toBeDisabled();
  });

  test("country card toggles selected state and counter updates", async ({ page }) => {
    await signIn(page);
    const firstCard = page.locator('[data-testid^="country-card-"]').first();
    await expect(page.getByText(/Selected: 0/)).toBeVisible();
    await firstCard.click();
    await expect(page.getByText(/Selected: 1/)).toBeVisible();
    await firstCard.click();
    await expect(page.getByText(/Selected: 0/)).toBeVisible();
  });

  test("win rule toggle switches selection", async ({ page }) => {
    await signIn(page);
    // Default is last_standing
    await expect(page.getByTestId("win-rule-last_standing")).toHaveAttribute("aria-checked", "true");
    // Click strict
    await page.getByTestId("win-rule-strict").click();
    await expect(page.getByTestId("win-rule-strict")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("win-rule-last_standing")).toHaveAttribute("aria-checked", "false");
  });

  test("mobile layout: form is scrollable and no horizontal overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signIn(page);
    // All sections visible
    await expect(page.getByText("1. Your Info")).toBeVisible();
    await expect(page.getByText("3. Pick Countries")).toBeVisible();
    // No horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 5); // 5px tolerance
  });
});
