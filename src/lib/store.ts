import {
  bootstrapCommunityData,
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPreferences,
  reportCommunityPost,
  updateCommunityPost,
  updateCommunityProfile,
  upsertCommunityPreferences
} from "./communityApi";
import { getCommunitySession } from "./communitySession";
import type { ExportBundle, Post, User, UserPreferences } from "./types";

const ACTIVE_USER_KEY = "news-curation-active-user-id";
const DEFAULT_PREFERENCES = (userId: string): UserPreferences => ({
  userId,
  preferredTopics: [],
  blockedDomains: [],
  blockedKeywords: []
});

let cache: { users: User[]; posts: Post[]; preferences: UserPreferences | null } = {
  users: [],
  posts: [],
  preferences: null
};

export const clearStoreCache = (): void => {
  cache = {
    users: [],
    posts: [],
    preferences: null
  };
};

const ensureSession = () => {
  const session = getCommunitySession();
  if (!session) throw new Error("COMMUNITY_SESSION_REQUIRED");
  return session;
};

const refresh = async (): Promise<void> => {
  ensureSession();
  const data = await bootstrapCommunityData();
  cache = {
    users: data.users,
    posts: data.posts,
    preferences: data.preferences
  };
};

const maybeRefresh = async (): Promise<void> => {
  if (cache.users.length > 0 || cache.posts.length > 0) return;
  await refresh();
};

export const setActiveUserId = (userId: string | null): void => {
  if (!userId) {
    localStorage.removeItem(ACTIVE_USER_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_USER_KEY, userId);
};

export const getActiveUserId = (): string | null => localStorage.getItem(ACTIVE_USER_KEY);

export const addUser = async (_user: User): Promise<void> => {
  throw new Error("Use /auth/register in community flow");
};

export const getUsers = async (): Promise<User[]> => {
  await maybeRefresh();
  return [...cache.users];
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  await maybeRefresh();
  return cache.users.find((u) => u.id === id);
};

export const updateUser = async (user: User): Promise<void> => {
  const session = ensureSession();
  if (user.id !== session.userId) {
    throw new Error("Only current user profile can be updated in this flow");
  }
  await updateCommunityProfile({
    alias: user.alias,
    avatarDataUrl: user.avatarDataUrl,
    language: user.language
  });
  await refresh();
};

export const deleteUserById = async (_userId: string): Promise<void> => {
  throw new Error("User delete is not enabled in community auth v1");
};

export const addPost = async (post: Post): Promise<void> => {
  await createCommunityPost(post);
  await refresh();
};

export const updatePost = async (post: Post): Promise<void> => {
  await updateCommunityPost(post);
  await refresh();
};

export const listPosts = async (): Promise<Post[]> => {
  await maybeRefresh();
  return [...cache.posts].sort((a, b) => b.createdAt - a.createdAt);
};

export const reportPostById = async (postId: string, _reporterId: string, reason: string): Promise<void> => {
  await reportCommunityPost(postId, reason);
};

export const deletePostById = async (postId: string): Promise<void> => {
  await deleteCommunityPost(postId);
  await refresh();
};

export const listPostsByTopic = async (topic: string): Promise<Post[]> => {
  const posts = await listPosts();
  return posts.filter((post) => post.topics.includes(topic));
};

export const listPostsByUser = async (userId: string): Promise<Post[]> => {
  const posts = await listPosts();
  return posts.filter((post) => post.userId === userId);
};

export const getPreferences = async (userId: string): Promise<UserPreferences> => {
  const session = ensureSession();
  if (userId !== session.userId) return DEFAULT_PREFERENCES(userId);
  const data = await getCommunityPreferences();
  if (!data) return DEFAULT_PREFERENCES(userId);
  cache.preferences = data;
  return data;
};

export const upsertPreferences = async (prefs: UserPreferences): Promise<void> => {
  const data = await upsertCommunityPreferences(prefs);
  cache.preferences = data;
};

export const exportAllData = async (): Promise<ExportBundle> => {
  await maybeRefresh();
  return {
    users: cache.users,
    posts: cache.posts,
    preferences: cache.preferences ? [cache.preferences] : []
  };
};

export const importAllData = async (_bundle: ExportBundle): Promise<void> => {
  throw new Error("JSON import is disabled in community backend mode");
};
