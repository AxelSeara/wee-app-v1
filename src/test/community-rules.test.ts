import { describe, expect, it } from "vitest";
import { canAdminLeaveCommunity, normalizeAlias, normalizeInviteCode } from "../lib/communityRules";

describe("community rules", () => {
  it("normalizes alias deterministically", () => {
    expect(normalizeAlias("  Áxel   Gómez ")).toBe("axel gomez");
    expect(normalizeAlias("MARTA")).toBe("marta");
  });

  it("normalizes invite code case-insensitive", () => {
    expect(normalizeInviteCode("ab-cd12")).toBe("AB-CD12");
    expect(normalizeInviteCode("  wee42 ")).toBe("WEE42");
  });

  it("blocks last admin from leaving", () => {
    expect(canAdminLeaveCommunity(1)).toBe(false);
    expect(canAdminLeaveCommunity(2)).toBe(true);
  });
});
