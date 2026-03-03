import { describe, expect, it } from "vitest";
import { detectTopics } from "../lib/classify";
import { rankTopicPosts } from "../lib/topicForum";
import type { Post } from "../lib/types";

const basePost = (override: Partial<Post>): Post => ({
  id: override.id ?? "p-1",
  userId: override.userId ?? "u-1",
  createdAt: override.createdAt ?? Date.now(),
  url: override.url,
  title: override.title,
  text: override.text,
  sourceDomain: override.sourceDomain,
  extractedHosts: override.extractedHosts ?? [],
  topics: override.topics ?? ["tech"],
  qualityLabel: override.qualityLabel ?? "medium",
  qualityScore: override.qualityScore ?? 55,
  interestScore: override.interestScore ?? 55,
  flags: override.flags ?? [],
  rationale: override.rationale ?? [],
  normalizedText: override.normalizedText ?? "tech ai software startup"
});

describe("topic detection precision", () => {
  it("avoids noisy partial-word matches", () => {
    const topics = detectTopics("air and fair are common words");
    expect(topics).toEqual(["misc"]);
  });

  it("uses domain hint when text is sparse", () => {
    const topics = detectTopics("daily briefing", "techcrunch.com");
    expect(topics).toContain("tech");
  });
});

describe("topic forum ranking", () => {
  it("prioritizes stronger topic signal over weak matches", () => {
    const strong = basePost({
      id: "strong",
      qualityScore: 72,
      interestScore: 68,
      normalizedText: "ai chip software platform ai open source cloud"
    });

    const weak = basePost({
      id: "weak",
      qualityScore: 90,
      interestScore: 85,
      normalizedText: "general update with little context"
    });

    const ranked = rankTopicPosts([weak, strong], "tech");
    expect(ranked[0].id).toBe("strong");
  });
});
