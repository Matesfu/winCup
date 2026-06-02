import { shuffleSecurely, assignCountries, buildFlagSequence } from "@/lib/draw";

// ── shuffleSecurely ────────────────────────────────────────────────────────────

describe("shuffleSecurely()", () => {
  it("returns an array of the same length", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleSecurely(arr)).toHaveLength(arr.length);
  });

  it("contains all the original elements (no drops or duplicates)", () => {
    const arr = ["a", "b", "c", "d", "e"];
    const result = shuffleSecurely(arr);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it("does not mutate the input array", () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    shuffleSecurely(arr);
    expect(arr).toEqual(copy);
  });

  it("handles a 1-element array", () => {
    expect(shuffleSecurely(["x"])).toEqual(["x"]);
  });

  it("handles an empty array", () => {
    expect(shuffleSecurely([])).toEqual([]);
  });

  it("produces different orderings across multiple calls (statistical)", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const results = new Set(
      Array.from({ length: 50 }, () => shuffleSecurely(arr).join(","))
    );
    // With 8! = 40320 permutations and 50 trials, getting > 20 unique orders is very likely
    expect(results.size).toBeGreaterThan(10);
  });
});

// ── assignCountries ────────────────────────────────────────────────────────────

describe("assignCountries()", () => {
  const PLAYERS = [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" },
    { id: "p3", name: "Carol" },
    { id: "p4", name: "Dave" },
  ];
  const CODES = ["ARG", "BRA", "FRA", "ENG"];

  it("returns the same number of assignments as players", () => {
    const result = assignCountries(PLAYERS, CODES);
    expect(result).toHaveLength(PLAYERS.length);
  });

  it("every player ID appears exactly once in the output", () => {
    const result = assignCountries(PLAYERS, CODES);
    const ids = result.map((a) => a.playerId);
    expect(new Set(ids).size).toBe(PLAYERS.length);
    expect(ids.sort()).toEqual(PLAYERS.map((p) => p.id).sort());
  });

  it("every country code appears exactly once (no repeats)", () => {
    const result = assignCountries(PLAYERS, CODES);
    const codes = result.map((a) => a.countryCode);
    expect(new Set(codes).size).toBe(PLAYERS.length);
  });

  it("all assigned codes come from the input set", () => {
    const result = assignCountries(PLAYERS, CODES);
    result.forEach((a) => expect(CODES).toContain(a.countryCode));
  });

  it("allows a larger country pool than the player list", () => {
    const result = assignCountries(PLAYERS.slice(0, 2), CODES);
    expect(result).toHaveLength(2);
    expect(new Set(result.map((a) => a.countryCode)).size).toBe(2);
  });

  it("throws when there are more players than countries", () => {
    expect(() => assignCountries(PLAYERS, ["ARG", "BRA"])).toThrow();
  });

  it("throws with a descriptive message", () => {
    expect(() => assignCountries(PLAYERS, ["ARG"])).toThrow(
      /Player count.*less than or equal to country count/i
    );
  });

  it("playerName is set from the player's name field", () => {
    const result = assignCountries(PLAYERS, CODES);
    const aliceEntry = result.find((a) => a.playerId === "p1");
    expect(aliceEntry?.playerName).toBe("Alice");
  });
});

// ── buildFlagSequence ──────────────────────────────────────────────────────────

describe("buildFlagSequence()", () => {
  const FLAGS = [
    { code: "ARG", flag_emoji: "🇦🇷" },
    { code: "BRA", flag_emoji: "🇧🇷" },
    { code: "FRA", flag_emoji: "🇫🇷" },
    { code: "ENG", flag_emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    { code: "GER", flag_emoji: "🇩🇪" },
  ];

  it("returns exactly `count` elements (default 25)", () => {
    const result = buildFlagSequence(FLAGS, "ARG");
    expect(result).toHaveLength(25);
  });

  it("returns exactly `count` elements when count is specified", () => {
    const result = buildFlagSequence(FLAGS, "FRA", 10);
    expect(result).toHaveLength(10);
  });

  it("target flag is the last element", () => {
    const result = buildFlagSequence(FLAGS, "BRA", 10);
    expect(result[result.length - 1].code).toBe("BRA");
  });

  it("throws when target code is not in the flags list", () => {
    expect(() => buildFlagSequence(FLAGS, "XXX")).toThrow(/not found/i);
  });
});
