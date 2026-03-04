import { describe, expect, it } from "vitest";
import { consumeLocalRateLimit, type RateLimitAction } from "../lib/rateLimit";

const makeMemoryStorage = () => {
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    }
  };
};

const consumeUntilBlocked = (action: RateLimitAction, userId: string, now: number) => {
  const storage = makeMemoryStorage();
  let decision = consumeLocalRateLimit(action, userId, now, storage);
  while (decision.allowed) {
    decision = consumeLocalRateLimit(action, userId, now + 10, storage);
  }
  return decision;
};

describe("rate limits", () => {
  it("blocks create_post when limit is exceeded", () => {
    const decision = consumeUntilBlocked("create_post", "u-post", 1000);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSec).toBeGreaterThan(0);
  });

  it("blocks create_comment when limit is exceeded", () => {
    const decision = consumeUntilBlocked("create_comment", "u-comment", 2000);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSec).toBeGreaterThan(0);
  });

  it("blocks vote_post when limit is exceeded", () => {
    const decision = consumeUntilBlocked("vote_post", "u-vote", 3000);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSec).toBeGreaterThan(0);
  });
});
