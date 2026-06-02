import { generateRoomCode, isValidRoomCode } from "@/lib/room-code";

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const AMBIGUOUS = /[01ILO]/;

describe("generateRoomCode()", () => {
  it('produces codes in "WC-XXXX" format', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toMatch(/^WC-[A-Z2-9]{4}$/);
    }
  });

  it("never includes ambiguous characters (0, O, 1, I, L)", () => {
    for (let i = 0; i < 200; i++) {
      const suffix = generateRoomCode().slice(3); // drop "WC-"
      expect(AMBIGUOUS.test(suffix)).toBe(false);
    }
  });

  it("only uses characters from the defined charset", () => {
    for (let i = 0; i < 100; i++) {
      const suffix = generateRoomCode().slice(3);
      for (const char of suffix) {
        expect(CHARSET).toContain(char);
      }
    }
  });

  it("1000 calls produce near-unique codes (birthday-problem tolerance: ≥995 unique)", () => {
    // With 31^4 ≈ 923k possible codes, ~0.5 expected collisions per 1000 draws.
    // Allowing up to 5 collisions avoids flakiness from the birthday problem.
    const codes = Array.from({ length: 1000 }, () => generateRoomCode());
    expect(new Set(codes).size).toBeGreaterThanOrEqual(995);
  });

  it("prefix is always WC-", () => {
    expect(generateRoomCode().startsWith("WC-")).toBe(true);
  });

  it("suffix is always exactly 4 characters", () => {
    expect(generateRoomCode().slice(3)).toHaveLength(4);
  });
});

describe("isValidRoomCode()", () => {
  it("accepts valid codes", () => {
    expect(isValidRoomCode("WC-AB23")).toBe(true);
    expect(isValidRoomCode("WC-ZZZZ")).toBe(true);
  });

  it("rejects codes with wrong prefix", () => {
    expect(isValidRoomCode("XX-AB23")).toBe(false);
  });

  it("rejects codes with ambiguous characters", () => {
    expect(isValidRoomCode("WC-O123")).toBe(false);
    expect(isValidRoomCode("WC-I234")).toBe(false);
  });

  it("rejects codes with wrong length", () => {
    expect(isValidRoomCode("WC-ABC")).toBe(false);
    expect(isValidRoomCode("WC-ABCDE")).toBe(false);
  });
});
