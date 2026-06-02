/**
 * Unit tests for src/lib/env.ts
 *
 * getServerEnv() reads from process.env, so we set/restore env vars per test.
 * The "server-only" import is stubbed via moduleNameMapper in jest.config.ts.
 */

describe("getServerEnv()", () => {
  const REQUIRED = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "FOOTBALL_DATA_API_KEY",
    "CRON_SECRET",
  ];

  const originalEnv = { ...process.env };

  function seedAllVars() {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    process.env.FOOTBALL_DATA_API_KEY = "test-football-key";
    process.env.CRON_SECRET = "test-cron-secret-min-32-chars-here";
  }

  afterEach(() => {
    // Restore original env after each test
    for (const key of REQUIRED) {
      if (key in originalEnv) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
    // Clear module registry so env.ts re-runs on next import
    jest.resetModules();
  });

  it("returns all three values when all vars are set", async () => {
    seedAllVars();
    const { getServerEnv } = await import("@/lib/env");
    const env = getServerEnv();
    expect(env.supabaseServiceRoleKey).toBe("test-service-role-key");
    expect(env.footballDataApiKey).toBe("test-football-key");
    expect(env.cronSecret).toBe("test-cron-secret-min-32-chars-here");
  });

  it("throws with a descriptive message when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    seedAllVars();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getServerEnv } = await import("@/lib/env");
    expect(() => getServerEnv()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("throws with a descriptive message when FOOTBALL_DATA_API_KEY is missing", async () => {
    seedAllVars();
    delete process.env.FOOTBALL_DATA_API_KEY;
    const { getServerEnv } = await import("@/lib/env");
    expect(() => getServerEnv()).toThrow("FOOTBALL_DATA_API_KEY");
  });

  it("throws with a descriptive message when CRON_SECRET is missing", async () => {
    seedAllVars();
    delete process.env.CRON_SECRET;
    const { getServerEnv } = await import("@/lib/env");
    expect(() => getServerEnv()).toThrow("CRON_SECRET");
  });

  it("throws when all required vars are absent", async () => {
    for (const key of REQUIRED) delete process.env[key];
    const { getServerEnv } = await import("@/lib/env");
    expect(() => getServerEnv()).toThrow(/Missing required environment variable/);
  });

  it("publicEnv exposes supabaseUrl and supabaseAnonKey (can be empty strings in test)", async () => {
    const { publicEnv } = await import("@/lib/env");
    expect(publicEnv).toHaveProperty("supabaseUrl");
    expect(publicEnv).toHaveProperty("supabaseAnonKey");
    expect(typeof publicEnv.supabaseUrl).toBe("string");
    expect(typeof publicEnv.supabaseAnonKey).toBe("string");
  });
});
