import { test, expect } from "@playwright/test";

/**
 * Join Room E2E tests.
 * Prerequisites:
 *   - .env.local with valid Supabase credentials
 *   - A test room in 'lobby' status with code "WC-TEST" (or similar)
 *   - A test user: email="testhost@wincup.test", password="testpass123"
 *   - Email confirmation DISABLED in Supabase Auth settings
 */

test.describe("Join Room — code entry page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/room/join");
  });

  test("page loads with code input and WC- prefix", async ({ page }) => {
    await expect(page.getByText("WC-")).toBeVisible();
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("Continue button is disabled with empty code", async ({ page }) => {
    await expect(page.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  test("invalid code format shows error", async ({ page }) => {
    const input = page.getByRole("textbox");
    await input.fill("hel");
    // Manually sync hidden input by triggering form
    await page.getByRole("button", { name: /continue/i }).click({ force: true });
    await expect(page.getByText(/4 characters/i)).toBeVisible({ timeout: 5000 });
  });

  test("non-existent room code returns error", async ({ page }) => {
    await page.getByRole("textbox").fill("ZZZZ");
    await page.getByRole("button", { name: /continue/i }).click({ force: true });
    await expect(page.getByText(/room not found/i)).toBeVisible({ timeout: 8000 });
  });

  test("has link to create a room", async ({ page }) => {
    await expect(page.getByRole("link", { name: /create a room/i })).toBeVisible();
  });
});

test.describe("Join Room — room-specific join page", () => {
  test("unauthenticated visit redirects to sign-in with redirectTo", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/room/some-room-id/join");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await expect(page.url()).toContain("redirectTo");
  });
});
