export type QualityLabel = "high" | "medium" | "low" | "clickbait";
export type AppLanguage = "es" | "en" | "gl";

export interface User {
  id: string;
  alias: string;
  passwordHash?: string;
  role?: "admin" | "member";
  language?: AppLanguage;
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
