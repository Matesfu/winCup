import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct page title", async ({ page }) => {
    await expect(page).toHaveTitle(/WinCup/i);
  });

  test("renders dark background (#0A0E1A)", async ({ page }) => {
    const bg = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    // #0A0E1A = rgb(10, 14, 26)
    expect(bg).toBe("rgb(10, 14, 26)");
  });

  test("WinCup heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /WinCup/i })).toBeVisible();
  });

  test("tagline is visible", async ({ page }) => {
    await expect(page.getByText(/Pick a country/i)).toBeVisible();
  });

  test('"Create Room" button is visible and links to /room/create', async ({ page }) => {
    const btn = page.getByRole("link", { name: /Create Room/i });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", "/room/create");
  });

  test('"Join Room" button is visible and links to /room/join', async ({ page }) => {
    const btn = page.getByRole("link", { name: /Join Room/i });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("href", "/room/join");
  });

  test("How it works section has exactly 3 steps", async ({ page }) => {
    const steps = page.locator('[data-testid="how-step"]');
    await expect(steps).toHaveCount(3);
  });

  test("entertainment-only disclaimer is visible in footer", async ({ page }) => {
    await expect(page.getByText(/entertainment only/i)).toBeVisible();
  });

  test("no-payments disclaimer is present", async ({ page }) => {
    await expect(
      page.getByText(/does not handle.*payments/i)
    ).toBeVisible();
  });

  test("no JavaScript console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    expect(errors).toHaveLength(0);
  });

  test("page is mobile-friendly (viewport 375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(
      page.getByRole("heading", { name: /WinCup/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Create Room/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Join Room/i })
    ).toBeVisible();
  });
});

test.describe("404 page", () => {
  test("shows a not-found page for unknown routes", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
  });
});
