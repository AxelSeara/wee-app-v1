import type { Post } from "./types";
import { topicSignalStrength } from "./classify";

const recencyBoost = (createdAt: number): number => {
  const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));
  return 12 * Math.exp(-ageHours / 28) - 2;
};

export const topicForumScore = (post: Post, topic: string): number => {
  const signal = topicSignalStrength(post.normalizedText, topic);
  const signalNormalized = 1 - Math.exp(-signal / 2.2);
  const signalScore = signalNormalized * 42;
  const qualityBase = post.qualityScore * 0.22;
  const interestBase = post.interestScore * 0.18;
  const recency = recencyBoost(post.createdAt);
  const weakSignalPenalty = signal < 0.8 ? -10 : 0;
  const collaborationBonus = Math.min(7, ((post.contributorUserIds?.length ?? 1) - 1) * 2.4);
  const feedbacks = post.feedbacks ?? [];
  const voteSum = feedbacks.reduce((acc, item) => acc + item.vote, 0);
  const feedbackScore = (voteSum / (feedbacks.length + 3)) * 12;

  return signalScore + qualityBase + interestBase + recency + collaborationBonus + weakSignalPenalty + feedbackScore;
};

export const rankTopicPosts = (posts: Post[], topic: string): Post[] =>
  [...posts].sort((a, b) => topicForumScore(b, topic) - topicForumScore(a, topic));
