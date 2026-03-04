import type { Post } from "./types";
import { topicSignalStrength } from "./classify";
import { scoreTopicPost } from "./auraEngine";

export const topicForumScore = (post: Post, topic: string, userInfluenceById: Map<string, number> = new Map()): number => {
  const signal = topicSignalStrength(post.normalizedText, topic);
  return scoreTopicPost(post, signal, userInfluenceById);
};

export const rankTopicPosts = (posts: Post[], topic: string, userInfluenceById: Map<string, number> = new Map()): Post[] =>
  [...posts].sort((a, b) => {
    const scoreDiff = topicForumScore(b, topic, userInfluenceById) - topicForumScore(a, topic, userInfluenceById);
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    if (b.interestScore !== a.interestScore) return b.interestScore - a.interestScore;
    return a.id.localeCompare(b.id);
  });

export const topicAverageAura = (posts: Post[]): number => {
  if (posts.length === 0) return 0;
  const sum = posts.reduce((acc, post) => acc + post.interestScore, 0);
  return Math.round(sum / posts.length);
};
