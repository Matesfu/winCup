import {
  getPrivateRoomJoinCookieName,
  normalizeRoomCode,
} from "@/lib/private-room-access";

describe("normalizeRoomCode()", () => {
  it("normalizes bare suffixes", () => {
    expect(normalizeRoomCode("ab23")).toBe("WC-AB23");
  });

  it("normalizes WC codes without a dash", () => {
    expect(normalizeRoomCode("wcab23")).toBe("WC-AB23");
  });

  it("preserves already dashed WC codes", () => {
    expect(normalizeRoomCode("WC-AB23")).toBe("WC-AB23");
  });
});

describe("getPrivateRoomJoinCookieName()", () => {
  it("includes the room id", () => {
    expect(getPrivateRoomJoinCookieName("room-1")).toBe("wincup_join_room-1");
  });
});
