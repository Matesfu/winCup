import {
  formatAssignmentMode,
  hasPublicRoomFilters,
  parsePublicRoomFilters,
  toDateBoundary,
} from "@/lib/public-room-filters";

describe("parsePublicRoomFilters()", () => {
  it("returns defaults for empty params", () => {
    expect(parsePublicRoomFilters()).toEqual({
      search: "",
      assignmentMode: "all",
      minStake: null,
      maxStake: null,
      dateFrom: "",
      dateTo: "",
      sort: "newest",
    });
  });

  it("parses valid filters", () => {
    expect(
      parsePublicRoomFilters({
        q: "Friday",
        mode: "player_choice",
        minStake: "5",
        maxStake: "20",
        from: "2026-06-01",
        to: "2026-06-30",
        sort: "stake_high",
      })
    ).toMatchObject({
      search: "Friday",
      assignmentMode: "player_choice",
      minStake: 5,
      maxStake: 20,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      sort: "stake_high",
    });
  });

  it("ignores invalid numbers, dates, modes, and sorts", () => {
    expect(
      parsePublicRoomFilters({
        mode: "manual",
        minStake: "-1",
        maxStake: "many",
        from: "yesterday",
        to: "2026",
        sort: "popular",
      })
    ).toMatchObject({
      assignmentMode: "all",
      minStake: null,
      maxStake: null,
      dateFrom: "",
      dateTo: "",
      sort: "newest",
    });
  });
});

describe("public room filter helpers", () => {
  it("builds UTC day boundaries", () => {
    expect(toDateBoundary("2026-06-02", "start")).toBe("2026-06-02T00:00:00.000Z");
    expect(toDateBoundary("2026-06-02", "end")).toBe("2026-06-02T23:59:59.999Z");
  });

  it("formats assignment mode labels", () => {
    expect(formatAssignmentMode("random")).toBe("Random assignment");
    expect(formatAssignmentMode("player_choice")).toBe("Player choice");
  });

  it("detects active filters", () => {
    expect(hasPublicRoomFilters(parsePublicRoomFilters())).toBe(false);
    expect(hasPublicRoomFilters(parsePublicRoomFilters({ q: "cup" }))).toBe(true);
  });
});
