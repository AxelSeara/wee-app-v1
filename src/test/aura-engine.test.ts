import { describe, expect, it } from "vitest";
import { auraRuntimeConfig, computeUserInfluenceScore, computeUserQualityScore, computeWeightedFeedback, scoreHomeFeedPost } from "../lib/auraEngine";
import type { Post } from "../lib/types";

const basePost = (override: Partial<Post> = {}): Post => ({
  id: override.id ?? "post-1",
  userId: override.userId ?? "u1",
  createdAt: override.createdAt ?? Date.now() - 1000,
  canonicalUrl: undefined,
  url: "https://example.com/news",
  title: "Example title",
  text: "Example body with enough context and numbers 2026.",
  previewTitle: undefined,
  previewDescription: undefined,
  previewImageUrl: undefined,
  previewSiteName: undefined,
  sourceDomain: "example.com",
  extractedHosts: [],
  shareCount: 1,
  contributorUserIds: override.contributorUserIds ?? [override.userId ?? "u1"],
  contributorCounts: override.contributorCounts ?? { [override.userId ?? "u1"]: 1 },
  openedByUserIds: [],
  feedbacks: override.feedbacks ?? [],
  comments: override.comments ?? [],
  topics: ["tech"],
  subtopics: [],
  qualityLabel: override.qualityLabel ?? "medium",
  qualityScore: override.qualityScore ?? 62,
  interestScore: override.interestScore ?? 64,
  flags: override.flags ?? [],
  rationale: [],
  normalizedText: "example title example body with enough context and numbers 2026"
});

describe("auraEngine", () => {
  it("keeps weighted feedback bounded", () => {
    const now = Date.now();
    const votes = Array.from({ length: 120 }).map((_, index) => ({
      userId: `u${index}`,
      vote: (index % 2 === 0 ? 1 : -1) as 1 | -1,
      votedAt: now - index * 500
    }));

    const post = basePost({ feedbacks: votes });
    const influence = new Map(votes.map((vote) => [vote.userId, 10000]));
    const score = computeWeightedFeedback(post, influence, now);
    expect(score).toBeGreaterThanOrEqual(-auraRuntimeConfig.postFeedback.maxAbsScore);
    expect(score).toBeLessThanOrEqual(auraRuntimeConfig.postFeedback.maxAbsScore);
  });

  it("penalizes low-diversity burst votes vs diverse votes", () => {
    const now = Date.now();

    const lowDiversityPost = basePost({
      id: "low-diversity",
      feedbacks: [
        { userId: "a", vote: 1, votedAt: now - 2 * 60 * 60 * 1000 },
        { userId: "b", vote: 1, votedAt: now - 2 * 60 * 60 * 1000 - 1000 }
      ]
    });

    const diversePost = basePost({
      id: "diverse",
      feedbacks: [
        { userId: "a", vote: 1, votedAt: now - 2 * 60 * 60 * 1000 },
        { userId: "b", vote: 1, votedAt: now - 2 * 60 * 60 * 1000 - 1000 },
        { userId: "c", vote: 1, votedAt: now - 2 * 60 * 60 * 1000 - 2000 },
        { userId: "d", vote: 1, votedAt: now - 2 * 60 * 60 * 1000 - 3000 }
      ]
    });

    const influence = new Map([
      ["a", 7000],
      ["b", 7000],
      ["c", 7000],
      ["d", 7000]
    ]);

    const lowDiversityScore = computeWeightedFeedback(lowDiversityPost, influence, now);
    const diverseScore = computeWeightedFeedback(diversePost, influence, now);
    expect(diverseScore).toBeGreaterThan(lowDiversityScore);
  });

  it("keeps user quality in 0..100 and discounts stale posts", () => {
    const now = Date.now();
    const oldClickbait = basePost({
      id: "old-click",
      createdAt: now - 120 * 24 * 60 * 60 * 1000,
      qualityLabel: "clickbait",
      qualityScore: 12,
      interestScore: 15
    });
    const recentHigh = basePost({
      id: "recent-high",
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
      qualityLabel: "high",
      qualityScore: 86,
      interestScore: 82
    });

    const score = computeUserQualityScore([oldClickbait, recentHigh], now);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("keeps influence inside 1000..10000", () => {
    const now = Date.now();
    const posts = Array.from({ length: 25 }).map((_, index) =>
      basePost({
        id: `p-${index}`,
        createdAt: now - index * 6 * 60 * 60 * 1000,
        qualityLabel: index % 8 === 0 ? "clickbait" : "high",
        qualityScore: index % 8 === 0 ? 30 : 82,
        interestScore: 70,
        feedbacks: [{ userId: `v-${index}`, vote: 1, votedAt: now - index * 1000 }]
      })
    );

    const influence = computeUserInfluenceScore(posts, 74, now);
    expect(influence).toBeGreaterThanOrEqual(auraRuntimeConfig.userLimits.min);
    expect(influence).toBeLessThanOrEqual(auraRuntimeConfig.userLimits.max);
  });

  it("home feed score rewards evidence and penalizes no_source", () => {
    const now = Date.now();
    const qualityByUser = new Map([["u1", 75]]);
    const influenceByUser = new Map([["r1", 7000]]);

    const reliable = basePost({
      id: "reliable",
      feedbacks: [{ userId: "r1", vote: 1, votedAt: now - 1000 }],
      flags: []
    });

    const noSource = basePost({
      id: "no-source",
      feedbacks: [{ userId: "r1", vote: 1, votedAt: now - 1000 }],
      flags: ["no_source"]
    });

    const reliableScore = scoreHomeFeedPost(reliable, qualityByUser, influenceByUser, now);
    const noSourceScore = scoreHomeFeedPost(noSource, qualityByUser, influenceByUser, now);
    expect(reliableScore).toBeGreaterThan(noSourceScore);
  });
});
