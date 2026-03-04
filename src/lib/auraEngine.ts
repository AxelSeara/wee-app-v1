import auraRuntimeV2 from "../../config/aura_runtime_v2.json";
import type { Post, QualityLabel } from "./types";
import { clamp } from "./utils";

type AuraRuntimeConfig = {
  version: string;
  userLimits: {
    min: number;
    max: number;
    start: number;
  };
  postFeedback: {
    baseWeight: number;
    maxWeight: number;
    weightExponent: number;
    priorWeight: number;
    confidencePivot: number;
    scoreScale: number;
    maxAbsScore: number;
  };
  feedRanking: {
    qualityWeight: number;
    auraWeight: number;
    authorQualityWeight: number;
    evidenceBonus: number;
    noSourcePenalty: number;
    unverifiedPenalty: number;
    clickbaitPenalty: number;
    collaborationStep: number;
    collaborationCap: number;
    recencyAmplitude: number;
    recencyHalfLifeHours: number;
    recencyBias: number;
    feedbackWeight: number;
  };
  topicRanking: {
    signalScale: number;
    signalSaturation: number;
    qualityWeight: number;
    auraWeight: number;
    weakSignalThreshold: number;
    weakSignalPenalty: number;
    collaborationStep: number;
    collaborationCap: number;
    recencyAmplitude: number;
    recencyHalfLifeHours: number;
    recencyBias: number;
    feedbackWeight: number;
  };
  userQuality: {
    defaultScore: number;
    qualityWeight: number;
    auraWeight: number;
    labelBonus: Record<QualityLabel, number>;
    duplicatePenaltyPerExtra: number;
    noSourcePenalty: number;
    unverifiedPenalty: number;
    priorMean: number;
    priorWeight: number;
    poorRatePenaltyMultiplier: number;
    halfLifeDays: number;
  };
  userReputation: {
    avgQualityWeight: number;
    highQualityRateWeight: number;
    poorQualityRatePenalty: number;
    duplicateRatePenalty: number;
    qualityLiftMax: number;
    qualityPivot: number;
    qualitySlope: number;
    volumeLiftMax: number;
    volumeScale: number;
    voteLiftMax: number;
    voteScale: number;
    duplicatePenaltyPerHit: number;
    stalenessFloor: number;
    stalenessHalfLifeDays: number;
  };
  antiGaming: {
    maxCountedVotesPerPostPerDay: number;
    burstWindowMinutes: number;
    burstVoteThreshold: number;
    burstPenaltyPerVote: number;
    minDistinctVotersForFullWeight: number;
    lowDiversityMultiplier: number;
  };
};

export const auraRuntimeConfig: AuraRuntimeConfig = auraRuntimeV2 as AuraRuntimeConfig;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const halfLifeDecay = (ageMs: number, halfLifeMs: number): number => {
  if (halfLifeMs <= 0) return 1;
  return Math.exp((-Math.log(2) * Math.max(0, ageMs)) / halfLifeMs);
};

const bayesianMean = (sampleMean: number, sampleSize: number, priorMean: number, priorWeight: number): number =>
  (sampleMean * sampleSize + priorMean * priorWeight) / Math.max(1, sampleSize + priorWeight);

const computeRecencyBoost = (
  createdAt: number,
  now: number,
  amplitude: number,
  halfLifeHours: number,
  bias: number
): number => {
  const ageMs = Math.max(0, now - createdAt);
  const decay = halfLifeDecay(ageMs, Math.max(1, halfLifeHours) * HOUR_MS);
  return amplitude * decay + bias;
};

const uniqueLatestVotes = (post: Post): Array<{ userId: string; vote: 1 | -1; votedAt: number }> => {
  const deduped = new Map<string, { userId: string; vote: 1 | -1; votedAt: number }>();
  (post.feedbacks ?? []).forEach((entry) => {
    const current = deduped.get(entry.userId);
    if (!current || entry.votedAt > current.votedAt) {
      deduped.set(entry.userId, entry);
    }
  });
  return Array.from(deduped.values());
};

const computeVoteWeight = (influence: number): number => {
  const cfg = auraRuntimeConfig;
  const normalized = clamp(
    (influence - cfg.userLimits.min) / Math.max(1, cfg.userLimits.max - cfg.userLimits.min),
    0,
    1
  );
  const scaled = Math.pow(normalized, cfg.postFeedback.weightExponent);
  return cfg.postFeedback.baseWeight + scaled * (cfg.postFeedback.maxWeight - cfg.postFeedback.baseWeight);
};

export const computeWeightedFeedback = (
  post: Post,
  userInfluenceById: Map<string, number>,
  now = Date.now()
): number => {
  const cfg = auraRuntimeConfig;
  const votes = uniqueLatestVotes(post)
    .sort((a, b) => b.votedAt - a.votedAt)
    .filter((vote, index) => {
      if (index >= cfg.antiGaming.maxCountedVotesPerPostPerDay) {
        const age = now - vote.votedAt;
        return age > DAY_MS;
      }
      return true;
    });

  if (votes.length === 0) return 0;

  let weightedVote = 0;
  let totalWeight = 0;
  for (const vote of votes) {
    const influence = userInfluenceById.get(vote.userId) ?? cfg.userLimits.start;
    const weight = computeVoteWeight(influence);
    weightedVote += vote.vote * weight;
    totalWeight += weight;
  }

  if (!totalWeight) return 0;

  const posterior = weightedVote / (totalWeight + cfg.postFeedback.priorWeight);
  const confidence = totalWeight / (totalWeight + cfg.postFeedback.confidencePivot);

  const uniqueVoters = new Set(votes.map((item) => item.userId)).size;
  const diversityMultiplier =
    uniqueVoters >= cfg.antiGaming.minDistinctVotersForFullWeight ? 1 : cfg.antiGaming.lowDiversityMultiplier;

  const recentVotes = votes.filter((vote) => now - vote.votedAt <= cfg.antiGaming.burstWindowMinutes * 60 * 1000).length;
  const burstExcess = Math.max(0, recentVotes - cfg.antiGaming.burstVoteThreshold);
  const burstPenalty = burstExcess * cfg.antiGaming.burstPenaltyPerVote;

  const raw = posterior * cfg.postFeedback.scoreScale * confidence * diversityMultiplier - burstPenalty;
  return clamp(raw, -cfg.postFeedback.maxAbsScore, cfg.postFeedback.maxAbsScore);
};

export const scoreHomeFeedPost = (
  post: Post,
  userQualityValueById: Map<string, number>,
  userInfluenceById: Map<string, number>,
  now = Date.now()
): number => {
  const cfg = auraRuntimeConfig;
  const authorQuality = userQualityValueById.get(post.userId) ?? cfg.userQuality.defaultScore;
  const recency = computeRecencyBoost(
    post.createdAt,
    now,
    cfg.feedRanking.recencyAmplitude,
    cfg.feedRanking.recencyHalfLifeHours,
    cfg.feedRanking.recencyBias
  );

  const evidence = post.flags.includes("no_source")
    ? -cfg.feedRanking.noSourcePenalty
    : post.flags.includes("unverified_claim")
      ? -cfg.feedRanking.unverifiedPenalty
      : cfg.feedRanking.evidenceBonus;
  const clickbait = post.qualityLabel === "clickbait" ? -cfg.feedRanking.clickbaitPenalty : 0;
  const collaboration = Math.min(
    cfg.feedRanking.collaborationCap,
    Math.max(0, (post.contributorUserIds?.length ?? 1) - 1) * cfg.feedRanking.collaborationStep
  );

  return (
    post.qualityScore * cfg.feedRanking.qualityWeight +
    post.interestScore * cfg.feedRanking.auraWeight +
    authorQuality * cfg.feedRanking.authorQualityWeight +
    recency +
    evidence +
    clickbait +
    collaboration +
    computeWeightedFeedback(post, userInfluenceById, now) * cfg.feedRanking.feedbackWeight
  );
};

export const scoreTopicPost = (
  post: Post,
  topicSignal: number,
  userInfluenceById: Map<string, number>,
  now = Date.now()
): number => {
  const cfg = auraRuntimeConfig;
  const signalNormalized = 1 - Math.exp(-Math.max(0, topicSignal) / Math.max(0.01, cfg.topicRanking.signalSaturation));
  const signalScore = signalNormalized * cfg.topicRanking.signalScale;
  const qualityBase = post.qualityScore * cfg.topicRanking.qualityWeight;
  const interestBase = post.interestScore * cfg.topicRanking.auraWeight;
  const recency = computeRecencyBoost(
    post.createdAt,
    now,
    cfg.topicRanking.recencyAmplitude,
    cfg.topicRanking.recencyHalfLifeHours,
    cfg.topicRanking.recencyBias
  );
  const weakSignalPenalty = topicSignal < cfg.topicRanking.weakSignalThreshold ? -cfg.topicRanking.weakSignalPenalty : 0;
  const collaborationBonus = Math.min(
    cfg.topicRanking.collaborationCap,
    Math.max(0, (post.contributorUserIds?.length ?? 1) - 1) * cfg.topicRanking.collaborationStep
  );

  return (
    signalScore +
    qualityBase +
    interestBase +
    recency +
    weakSignalPenalty +
    collaborationBonus +
    computeWeightedFeedback(post, userInfluenceById, now) * cfg.topicRanking.feedbackWeight
  );
};

export const computeUserQualityScore = (authoredPosts: Post[], now = Date.now()): number => {
  const cfg = auraRuntimeConfig;
  if (authoredPosts.length === 0) return cfg.userQuality.defaultScore;

  const weighted = authoredPosts.map((post) => {
    const ageMs = Math.max(0, now - post.createdAt);
    const decay = halfLifeDecay(ageMs, cfg.userQuality.halfLifeDays * DAY_MS);
    const duplicatePenalty =
      post.contributorCounts && post.contributorCounts[post.userId] && post.contributorCounts[post.userId] > 1
        ? (post.contributorCounts[post.userId] - 1) * cfg.userQuality.duplicatePenaltyPerExtra
        : 0;
    const evidencePenalty = post.flags.includes("no_source")
      ? cfg.userQuality.noSourcePenalty
      : post.flags.includes("unverified_claim")
        ? cfg.userQuality.unverifiedPenalty
        : 0;

    const base =
      post.qualityScore * cfg.userQuality.qualityWeight +
      post.interestScore * cfg.userQuality.auraWeight +
      cfg.userQuality.labelBonus[post.qualityLabel] -
      duplicatePenalty -
      evidencePenalty;

    return { post, decay, base };
  });

  const totalWeight = weighted.reduce((acc, item) => acc + item.decay, 0);
  if (totalWeight <= 0) return cfg.userQuality.defaultScore;

  const weightedMean = weighted.reduce((acc, item) => acc + item.base * item.decay, 0) / totalWeight;
  const effectiveSamples = weighted.reduce((acc, item) => acc + item.decay, 0);
  const blended = bayesianMean(weightedMean, effectiveSamples, cfg.userQuality.priorMean, cfg.userQuality.priorWeight);

  const poorWeight = weighted.reduce((acc, item) => {
    const poor = item.post.qualityScore < 50 || item.post.qualityLabel === "clickbait";
    return acc + (poor ? item.decay : 0);
  }, 0);
  const poorRate = poorWeight / Math.max(1e-6, totalWeight);
  const consistencyMultiplier = 1 - poorRate * cfg.userQuality.poorRatePenaltyMultiplier;

  return clamp(Math.round(blended * consistencyMultiplier), 0, 100);
};

export const computeUserInfluenceScore = (
  authoredPosts: Post[],
  userQualityScore: number,
  now = Date.now()
): number => {
  const cfg = auraRuntimeConfig;
  if (authoredPosts.length === 0) return cfg.userLimits.start;

  const weighted = authoredPosts.map((post) => {
    const ageMs = Math.max(0, now - post.createdAt);
    const decay = halfLifeDecay(ageMs, cfg.userQuality.halfLifeDays * DAY_MS);
    const duplicatePenalty = Math.max(0, (post.contributorCounts?.[post.userId] ?? 1) - 1);
    const voteDelta = (post.feedbacks ?? []).reduce((acc, feedback) => acc + feedback.vote, 0);
    const isHighQuality = post.qualityScore >= 75 && post.qualityLabel !== "clickbait";
    const isPoorQuality = post.qualityScore < 50 || post.qualityLabel === "clickbait";
    return {
      post,
      decay,
      duplicatePenalty,
      voteDelta,
      high: isHighQuality ? 1 : 0,
      poor: isPoorQuality ? 1 : 0
    };
  });

  const totalWeight = weighted.reduce((acc, item) => acc + item.decay, 0);
  if (totalWeight <= 0) return cfg.userLimits.start;

  const avgQuality = weighted.reduce((acc, item) => acc + item.post.qualityScore * item.decay, 0) / totalWeight;
  const highQualityRate = weighted.reduce((acc, item) => acc + item.high * item.decay, 0) / totalWeight;
  const poorQualityRate = weighted.reduce((acc, item) => acc + item.poor * item.decay, 0) / totalWeight;
  const duplicateRate = weighted.reduce((acc, item) => acc + item.duplicatePenalty * item.decay, 0) / totalWeight;
  const voteDeltaPerPost = weighted.reduce((acc, item) => acc + item.voteDelta * item.decay, 0) / totalWeight;
  const duplicatePenalty = weighted.reduce((acc, item) => acc + item.duplicatePenalty, 0);

  const qualitySignal =
    avgQuality * cfg.userReputation.avgQualityWeight +
    highQualityRate * cfg.userReputation.highQualityRateWeight -
    poorQualityRate * cfg.userReputation.poorQualityRatePenalty -
    duplicateRate * cfg.userReputation.duplicateRatePenalty +
    userQualityScore * 0.25;

  const qualityLift =
    cfg.userReputation.qualityLiftMax *
    sigmoid((qualitySignal - cfg.userReputation.qualityPivot) / Math.max(0.1, cfg.userReputation.qualitySlope));
  const volumeLift = cfg.userReputation.volumeLiftMax * (1 - Math.exp(-totalWeight / Math.max(1, cfg.userReputation.volumeScale)));
  const voteLift = cfg.userReputation.voteLiftMax * Math.tanh(voteDeltaPerPost / Math.max(0.1, cfg.userReputation.voteScale));
  const duplicateHit = duplicatePenalty * cfg.userReputation.duplicatePenaltyPerHit;

  const newestPostTs = Math.max(...authoredPosts.map((post) => post.createdAt));
  const stalenessDecay = halfLifeDecay(
    Math.max(0, now - newestPostTs),
    Math.max(1, cfg.userReputation.stalenessHalfLifeDays) * DAY_MS
  );
  const stalenessMultiplier = cfg.userReputation.stalenessFloor + (1 - cfg.userReputation.stalenessFloor) * stalenessDecay;

  const raw = cfg.userLimits.start + qualityLift + volumeLift + voteLift - duplicateHit;
  const normalized = cfg.userLimits.start + (raw - cfg.userLimits.start) * stalenessMultiplier;

  return clamp(Math.round(normalized), cfg.userLimits.min, cfg.userLimits.max);
};
