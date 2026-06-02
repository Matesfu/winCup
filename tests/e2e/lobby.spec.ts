import { test, expect } from "@playwright/test";

/**
 * Lobby E2E tests.
 * Prerequisites:
 *   - .env.local with valid Supabase credentials
 *   - A test host account: email="testhost@wincup.test", password="testpass123"
 *   - Email confirmation DISABLED
 *   - Realtime publication applied (migration 20240103000000_realtime.sql)
 */

async function signIn(page: import("@playwright/test").Page, email = "testhost@wincup.test") {
  await page.goto("/auth/sign-in");
  await page.getByRole("textbox", { name: /username or email/i }).fill(email);
  await page.getByLabel(/password/i).fill("testpass123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}

test.describe("Lobby page", () => {
  test("unauthenticated visit redirects to sign-in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/room/some-room-id/lobby");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("lobby loads with room code, countries, and players after creating a room", async ({ page }) => {
    await signIn(page);
    // Create a room first
    await page.goto("/room/create");
    // Fill name (pre-filled from username)
    await page.locator('[data-testid^="country-card-"]').nth(0).click();
    await page.locator('[data-testid^="country-card-"]').nth(1).click();
    await page.locator('[data-testid^="country-card-"]').nth(2).click();
    await page.locator('[data-testid^="country-card-"]').nth(3).click();
    await page.getByTestId("create-room-submit").click();
    // Redirected to lobby
    await page.waitForURL(/\/room\/[^/]+\/lobby/, { timeout: 10_000 });

    // Verify lobby elements
    await expect(page.getByTestId("room-code-text")).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByTestId("player-card").first()).toBeVisible();
  });

  test("host sees 'Start Draw' button in lobby", async ({ page }) => {
    await signIn(page);
    await page.goto("/room/create");
    // Select a valid country pool
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-testid^="country-card-"]').nth(i).click();
    }
    await page.getByTestId("create-room-submit").click();
    await page.waitForURL(/\/room\/[^/]+\/lobby/, { timeout: 10_000 });
    await expect(page.getByTestId("start-draw-button")).toBeVisible();
  });

  test("Start Draw button is disabled when fewer than 2 players joined", async ({ page }) => {
    await signIn(page);
    await page.goto("/room/create");
    // Select 6 countries, but only the host has joined
    for (let i = 0; i < 6; i++) {
      await page.locator('[data-testid^="country-card-"]').nth(i).click();
    }
    await page.getByTestId("create-room-submit").click();
    await page.waitForURL(/\/room\/[^/]+\/lobby/, { timeout: 10_000 });
    // Host is the only player, so the minimum player rule is not met
    await expect(page.getByTestId("start-draw-button")).toBeDisabled();
  });

  test("copy code button shows Copied! feedback", async ({ page }) => {
    await signIn(page);
    await page.goto("/room/create");
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-testid^="country-card-"]').nth(i).click();
    }
    await page.getByTestId("create-room-submit").click();
    await page.waitForURL(/\/room\/[^/]+\/lobby/, { timeout: 10_000 });
    await page.getByRole("button", { name: /copy room code/i }).click();
    await expect(page.getByText(/copied!/i)).toBeVisible({ timeout: 3000 });
  });

  test("mobile layout: lobby is usable at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await signIn(page);
    await page.goto("/room/create");
    for (let i = 0; i < 4; i++) {
      await page.locator('[data-testid^="country-card-"]').nth(i).click();
    }
    await page.getByTestId("create-room-submit").click();
    await page.waitForURL(/\/room\/[^/]+\/lobby/, { timeout: 10_000 });
    await expect(page.getByTestId("room-code-text")).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
  });
});
