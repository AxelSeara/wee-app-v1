import { describe, expect, it } from "vitest";
import { isCommunitySessionAccessError, parseCommunityJoinInput, resolveRootRoute, shouldAutoEnterDefaultCommunity } from "../lib/communityNavigation";

describe("community navigation", () => {
  it("skip picker when default community is available", () => {
    expect(
      shouldAutoEnterDefaultCommunity({
        skipPicker: true,
        defaultCommunityId: "c1",
        availableCommunityIds: ["c1", "c2"],
        hasInviteQuery: false
      })
    ).toBe(true);
  });

  it("does not skip picker when invite query exists", () => {
    expect(
      shouldAutoEnterDefaultCommunity({
        skipPicker: true,
        defaultCommunityId: "c1",
        availableCommunityIds: ["c1", "c2"],
        hasInviteQuery: true
      })
    ).toBe(false);
  });

  it("fallbacks to community picker after membership/session errors", () => {
    expect(isCommunitySessionAccessError("Membership required")).toBe(true);
    expect(isCommunitySessionAccessError("Invalid session")).toBe(true);
    expect(isCommunitySessionAccessError("Other backend error")).toBe(false);
  });

  it("resolves root route by session state", () => {
    expect(resolveRootRoute({ hasGlobalSession: false, hasActiveCommunitySession: false })).toBe("/login");
    expect(resolveRootRoute({ hasGlobalSession: true, hasActiveCommunitySession: false })).toBe("/communities");
    expect(resolveRootRoute({ hasGlobalSession: true, hasActiveCommunitySession: true })).toBe("/home");
  });

  it("parses join flow code/link inputs", () => {
    expect(parseCommunityJoinInput("abc123")).toEqual({ code: "ABC123" });
    expect(parseCommunityJoinInput("123456789012")).toEqual({ token: "123456789012" });
    expect(parseCommunityJoinInput("https://wee.app/#/invite/tok_tok_123456")).toEqual({ token: "tok_tok_123456" });
  });
});
