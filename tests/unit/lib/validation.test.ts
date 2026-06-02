import { Validation } from "@/lib/validation";

// ── username ──────────────────────────────────────────────────────────────────

describe("Validation.username()", () => {
  it("rejects username shorter than 3 chars", () => {
    expect(Validation.username("ab")).not.toBeNull();
  });
  it("rejects username longer than 30 chars", () => {
    expect(Validation.username("a".repeat(31))).not.toBeNull();
  });
  it("rejects username with spaces", () => {
    expect(Validation.username("hello world")).not.toBeNull();
  });
  it("rejects username with special chars", () => {
    expect(Validation.username("user@123")).not.toBeNull();
    expect(Validation.username("user-name")).not.toBeNull();
  });
  it("accepts valid alphanumeric username", () => {
    expect(Validation.username("valid123")).toBeNull();
  });
  it("accepts username with underscores", () => {
    expect(Validation.username("valid_User1")).toBeNull();
  });
  it("accepts exactly 3 chars", () => {
    expect(Validation.username("abc")).toBeNull();
  });
  it("accepts exactly 30 chars", () => {
    expect(Validation.username("a".repeat(30))).toBeNull();
  });
});

// ── email ─────────────────────────────────────────────────────────────────────

describe("Validation.email()", () => {
  it("rejects empty string", () => {
    expect(Validation.email("")).not.toBeNull();
  });
  it("rejects string without @", () => {
    expect(Validation.email("notanemail")).not.toBeNull();
  });
  it("rejects string without domain", () => {
    expect(Validation.email("user@")).not.toBeNull();
  });
  it("accepts valid email", () => {
    expect(Validation.email("user@example.com")).toBeNull();
  });
  it("accepts email with subdomains", () => {
    expect(Validation.email("a@b.co.uk")).toBeNull();
  });
});

// ── password ──────────────────────────────────────────────────────────────────

describe("Validation.password()", () => {
  it("rejects password shorter than 8 chars", () => {
    expect(Validation.password("1234567")).not.toBeNull();
  });
  it("accepts exactly 8 chars", () => {
    expect(Validation.password("12345678")).toBeNull();
  });
  it("accepts long password", () => {
    expect(Validation.password("a".repeat(64))).toBeNull();
  });
});

// ── hostName ──────────────────────────────────────────────────────────────────

describe("Validation.hostName()", () => {
  it("rejects empty string", () => {
    expect(Validation.hostName("")).not.toBeNull();
  });
  it("rejects whitespace-only", () => {
    expect(Validation.hostName("   ")).not.toBeNull();
  });
  it("rejects name longer than 40 chars", () => {
    expect(Validation.hostName("a".repeat(41))).not.toBeNull();
  });
  it("accepts name of exactly 40 chars", () => {
    expect(Validation.hostName("a".repeat(40))).toBeNull();
  });
  it("accepts normal name", () => {
    expect(Validation.hostName("John")).toBeNull();
  });
});

// ── stakeAmount ───────────────────────────────────────────────────────────────

describe("Validation.stakeAmount()", () => {
  it("accepts empty string (optional)", () => {
    expect(Validation.stakeAmount("")).toBeNull();
  });
  it("accepts whitespace-only (optional)", () => {
    expect(Validation.stakeAmount("   ")).toBeNull();
  });
  it("accepts valid positive number", () => {
    expect(Validation.stakeAmount("10")).toBeNull();
    expect(Validation.stakeAmount("9.99")).toBeNull();
  });
  it("rejects negative number", () => {
    expect(Validation.stakeAmount("-5")).not.toBeNull();
  });
  it("rejects non-numeric string", () => {
    expect(Validation.stakeAmount("abc")).not.toBeNull();
  });
});

// ── countrySelection ──────────────────────────────────────────────────────────

describe("Validation.countrySelection()", () => {
  it("rejects fewer than 4 codes", () => {
    expect(Validation.countrySelection(["ARG", "BRA", "FRA"])).not.toBeNull();
  });
  it("accepts exactly 4 codes", () => {
    expect(Validation.countrySelection(["ARG", "BRA", "FRA", "ENG"])).toBeNull();
  });
  it("rejects more than 36 codes", () => {
    expect(Validation.countrySelection(Array(37).fill("ARG"))).not.toBeNull();
  });
  it("error message includes current count", () => {
    const msg = Validation.countrySelection(["ARG"]);
    expect(msg).toContain("1");
  });
});

// ── winRule ───────────────────────────────────────────────────────────────────

describe("Validation.winRule()", () => {
  it("rejects unknown win rule", () => {
    expect(Validation.winRule("winner_takes_all")).not.toBeNull();
  });
  it("accepts strict", () => {
    expect(Validation.winRule("strict")).toBeNull();
  });
  it("accepts last_standing", () => {
    expect(Validation.winRule("last_standing")).toBeNull();
  });
});

// ── roomCode ──────────────────────────────────────────────────────────────────

describe("Validation.roomCode()", () => {
  it("rejects empty string", () => {
    expect(Validation.roomCode("")).not.toBeNull();
  });
  it("rejects whitespace-only", () => {
    expect(Validation.roomCode("   ")).not.toBeNull();
  });
  it("rejects 3-char suffix", () => {
    expect(Validation.roomCode("WC-AB2")).not.toBeNull();
  });
  it("rejects 5-char suffix", () => {
    expect(Validation.roomCode("WC-AB234")).not.toBeNull();
  });
  it("accepts valid 'WC-AB23'", () => {
    expect(Validation.roomCode("WC-AB23")).toBeNull();
  });
  it("accepts without prefix 'AB23'", () => {
    expect(Validation.roomCode("AB23")).toBeNull();
  });
  it("accepts lowercase 'wc-ab23'", () => {
    expect(Validation.roomCode("wc-ab23")).toBeNull();
  });
  it("accepts code with spaces 'WC AB23'", () => {
    expect(Validation.roomCode("WC AB23")).toBeNull();
  });
  it("rejects code with special chars", () => {
    expect(Validation.roomCode("WC-@#$%")).not.toBeNull();
  });
});
