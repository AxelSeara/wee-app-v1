export type QualityLabel = "high" | "medium" | "low" | "clickbait";
export type AppLanguage = "es" | "en" | "gl";
export type AuraRulesetVersion = "v1" | "v2";

export interface RuleAdjustment {
  ruleId: string;
  delta: number;
  evidence: string;
}

export interface ScoreBreakdown {
  version: AuraRulesetVersion;
  baseScore: number;
  adjustments: RuleAdjustment[];
  finalScore: number;
  firedRules: string[];
}

export interface ClassificationDebugBreakdown {
  version: AuraRulesetVersion;
  quality: ScoreBreakdown;
  aura: ScoreBreakdown;
  firedRules: string[];
}

export interface User {
  id: string;
  alias: string;
  authEmail?: string;
  passwordHash?: string;
  role?: "admin" | "member";
  language?: AppLanguage;
  privacyConsentAt?: number;
  privacyPolicyVersion?: string;
  avatarDataUrl?: string;
  avatarColor?: string;
  initials?: string;
  createdAt: number;
}

export interface Post {
  id: string;
  userId: string;
  createdAt: number;
  canonicalUrl?: string;
  url?: string;
  title?: string;
  text?: string;
  previewTitle?: string;
  previewDescription?: string;
  previewImageUrl?: string;
  previewSiteName?: string;
  sourceDomain?: string;
  extractedHosts?: string[];
  shareCount?: number;
  contributorUserIds?: string[];
  contributorCounts?: Record<string, number>;
  openedByUserIds?: string[];
  feedbacks?: Array<{
    userId: string;
    vote: 1 | -1;
    votedAt: number;
  }>;
  comments?: Array<{
    id: string;
    userId: string;
    text: string;
    createdAt: number;
    auraUserIds?: string[];
  }>;
  topics: string[];
  subtopics?: string[];
  qualityLabel: QualityLabel;
  qualityScore: number;
  interestScore: number;
  flags: string[];
  rationale: string[];
  normalizedText: string;
}

export interface UserPreferences {
  userId: string;
  preferredTopics: string[];
  blockedDomains: string[];
  blockedKeywords: string[];
}

export interface UserCommunityStats {
  userId: string;
  aura: number;
  points: number;
  level: number;
  rankTitle: string;
  badges: string[];
  postCount: number;
  highQualityCount: number;
  commentCount: number;
  auraReceived: number;
  auraGiven: number;
  nextLevelPoints: number;
  levelProgress: number;
}

export interface ClassifyInput {
  url?: string;
  title?: string;
  text?: string;
  publishedAt?: string;
  rulesetVersion?: AuraRulesetVersion;
  debug?: boolean;
  persistBreakdown?: boolean;
  metadata?: {
    publisher?: string;
    author?: string;
    schemaTypes?: string[];
    hasImprintOrContact?: boolean;
    outboundUrls?: string[];
    bodyText?: string;
    hasOverlayPopup?: boolean;
    adLikeNodeRatio?: number;
    duplicateSignals?: {
      canonicalExists?: boolean;
      contentHashExists?: boolean;
    };
    publishedAt?: string;
  };
}

export interface ClassifyOutput {
  topics: string[];
  subtopics: string[];
  qualityLabel: QualityLabel;
  qualityScore: number;
  interestScore: number;
  flags: string[];
  rationale: string[];
  sourceDomain?: string;
  extractedHosts: string[];
  normalizedText: string;
  debugBreakdown?: ClassificationDebugBreakdown;
}

export interface SearchFilters {
  query: string;
  qualityLabel: "all" | QualityLabel;
  topic: "all" | string;
  domain: "all" | string;
}

export interface ExportBundle {
  users: User[];
  posts: Post[];
  preferences: UserPreferences[];
}
