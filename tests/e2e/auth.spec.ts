import { test, expect } from "@playwright/test";

/**
 * Auth E2E tests — sign-up and sign-in flows.
 *
 * Prerequisites:
 *   - .env.local with valid Supabase credentials
 *   - Email confirmation DISABLED in Supabase Auth settings (for CI)
 *   - Run: npm run test:e2e
 */

test.describe("Sign-up page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/sign-up");
  });

  test("renders username, email, and password fields", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: /username/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    // password uses a label but is type=password — locate by label text
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("has a submit button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("shows link to sign-in page", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("client-side validation: short username shows error", async ({ page }) => {
    await page.getByRole("textbox", { name: /username/i }).fill("ab");
    await page.getByRole("textbox", { name: /email/i }).fill("test@example.com");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    // Server-side validation returns error — look for the error message
    await expect(page.getByText(/at least 3 characters/i)).toBeVisible({ timeout: 5000 });
  });

  test("client-side validation: invalid email shows error", async ({ page }) => {
    await page.getByRole("textbox", { name: /username/i }).fill("validuser");
    await page.getByRole("textbox", { name: /email/i }).fill("notanemail");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible({ timeout: 5000 });
  });

  test("client-side validation: short password shows error", async ({ page }) => {
    await page.getByRole("textbox", { name: /username/i }).fill("validuser");
    await page.getByRole("textbox", { name: /email/i }).fill("test@example.com");
    await page.getByLabel(/password/i).fill("short");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Sign-in page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/sign-in");
  });

  test("renders identifier and password fields", async ({ page }) => {
    await expect(page.getByRole("textbox", { name: /username or email/i })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("has a Sign In button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows link to sign-up page", async ({ page }) => {
    await expect(page.getByRole("link", { name: /create one/i })).toBeVisible();
  });

  test("wrong credentials shows generic error (no enumeration hint)", async ({ page }) => {
    await page.getByRole("textbox", { name: /username or email/i }).fill("nonexistent@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid username\/email or password/i)).toBeVisible({ timeout: 5000 });
  });

  test("password show/hide toggle works", async ({ page }) => {
    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});

test.describe("Auth redirect behaviour", () => {
  test("unauthenticated visit to /room/create redirects to sign-in", async ({ page }) => {
    // Clear any existing session first
    await page.context().clearCookies();
    await page.goto("/room/create");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await expect(page.url()).toContain("redirectTo=/room/create");
  });
});
