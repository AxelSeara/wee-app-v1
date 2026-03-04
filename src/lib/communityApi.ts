import { getCommunitySession, type CommunityAuthSession, type CommunitySelection, setCommunitySession, setSelectedCommunity } from "./communitySession";
import type { Post, User, UserPreferences } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "";
const base = supabaseUrl ? `${supabaseUrl}/functions/v1/community-api` : "";

interface ApiError {
  message: string;
}

const headers = (): HeadersInit => {
  const session = getCommunitySession();
  return {
    "Content-Type": "application/json",
    ...(supabasePublishableKey
      ? {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${supabasePublishableKey}`
        }
      : {}),
    ...(session ? { "x-wee-session": session.sessionToken } : {})
  };
};

const request = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  if (!base) throw new Error("Missing VITE_SUPABASE_URL for community API");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as T | ApiError;
  if (!response.ok) {
    const message = (data as ApiError)?.message ?? "Community API error";
    throw new Error(message);
  }
  return data as T;
};

export interface CommunityUser extends User {
  role: "admin" | "member";
}

export interface CommunityBootstrapResponse {
  users: CommunityUser[];
  posts: Post[];
  preferences: UserPreferences | null;
}

export interface CommunityPreviewResponse {
  community_id: string;
  name: string;
  description?: string;
}

export interface CommunityAuthResponse {
  session_token: string;
  user: {
    id: string;
    alias: string;
    language?: "es" | "en" | "gl";
  };
  community: {
    id: string;
    name: string;
    description?: string;
    rules_text?: string;
    invite_policy: "admins_only" | "members_allowed";
  };
}

const toSession = (payload: CommunityAuthResponse): CommunityAuthSession => ({
  sessionToken: payload.session_token,
  userId: payload.user.id,
  alias: payload.user.alias,
  community: {
    id: payload.community.id,
    name: payload.community.name,
    description: payload.community.description,
    invitePolicy: payload.community.invite_policy,
    rulesText: payload.community.rules_text
  }
});

export const createCommunity = async (input: {
  name: string;
  description?: string;
  rules_text?: string;
  invite_policy: "admins_only" | "members_allowed";
  code?: string;
  invite_expires_at?: string;
}): Promise<CommunityPreviewResponse> => request<CommunityPreviewResponse>("/community/create", input);

export const previewCommunity = async (input: { code?: string; token?: string }): Promise<CommunityPreviewResponse> =>
  request<CommunityPreviewResponse>("/community/preview", input);

export const confirmJoinCommunity = async (input: { code?: string; token?: string }): Promise<CommunitySelection> => {
  const data = await request<{ community_id: string; name: string; description?: string }>("/community/join/confirm", input);
  const community: CommunitySelection = { id: data.community_id, name: data.name, description: data.description };
  setSelectedCommunity(community);
  return community;
};

export const registerCommunityUser = async (input: {
  community_id: string;
  alias: string;
  password: string;
  avatar_url?: string;
  language?: "es" | "en" | "gl";
}): Promise<CommunityAuthSession> => {
  const data = await request<CommunityAuthResponse>("/auth/register", input);
  const session = toSession(data);
  setCommunitySession(session);
  return session;
};

export const loginCommunityUser = async (input: {
  community_id: string;
  alias: string;
  password: string;
}): Promise<CommunityAuthSession> => {
  const data = await request<CommunityAuthResponse>("/auth/login", input);
  const session = toSession(data);
  setCommunitySession(session);
  return session;
};

export const logoutCommunityUser = async (): Promise<void> => {
  await request<{ ok: true }>("/auth/logout", {});
  setCommunitySession(null);
};

export const loadCommunityMeta = async (): Promise<{ community: CommunitySelection; members: Array<{ id: string; alias: string; role: "admin" | "member" }> }> =>
  request<{ community: CommunitySelection; members: Array<{ id: string; alias: string; role: "admin" | "member" }> }>("/community/meta", {});

export const promoteMember = async (targetUserId: string): Promise<void> => {
  await request<{ ok: true }>("/community/admin/promote", { target_user_id: targetUserId });
};

export const demoteMember = async (targetUserId: string): Promise<void> => {
  await request<{ ok: true }>("/community/admin/demote", { target_user_id: targetUserId });
};

export const removeMember = async (targetUserId: string): Promise<void> => {
  await request<{ ok: true }>("/community/admin/remove", { target_user_id: targetUserId });
};

export const leaveCommunity = async (): Promise<void> => {
  await request<{ ok: true }>("/community/leave", {});
  setCommunitySession(null);
};

export const createInvite = async (input?: { code?: string; expires_at?: string }): Promise<{ code: string; token: string }> =>
  request<{ code: string; token: string }>("/community/invite/create", input ?? {});

export const revokeInvite = async (inviteId: string): Promise<void> => {
  await request<{ ok: true }>("/community/invite/revoke", { invite_id: inviteId });
};

export const setInviteExpiry = async (inviteId: string, expiresAt: string | null): Promise<void> => {
  await request<{ ok: true }>("/community/invite/set_expiry", { invite_id: inviteId, expires_at: expiresAt });
};

export const bootstrapCommunityData = async (): Promise<CommunityBootstrapResponse> =>
  request<CommunityBootstrapResponse>("/data/bootstrap", {});

export const createCommunityPost = async (post: Post): Promise<Post> =>
  request<Post>("/data/post/create", { post });

export const updateCommunityPost = async (post: Post): Promise<Post> =>
  request<Post>("/data/post/update", { post });

export const deleteCommunityPost = async (postId: string): Promise<void> => {
  await request<{ ok: true }>("/data/post/delete", { post_id: postId });
};

export const getCommunityPreferences = async (): Promise<UserPreferences | null> =>
  request<UserPreferences | null>("/data/preferences/get", {});

export const upsertCommunityPreferences = async (prefs: UserPreferences): Promise<UserPreferences> =>
  request<UserPreferences>("/data/preferences/upsert", { preferences: prefs });

export const reportCommunityPost = async (postId: string, reason: string): Promise<void> => {
  await request<{ ok: true }>("/data/report/create", { post_id: postId, reason });
};

export const updateCommunityProfile = async (payload: {
  alias?: string;
  avatarDataUrl?: string;
  language?: "es" | "en" | "gl";
}): Promise<{ user: CommunityUser }> =>
  request<{ user: CommunityUser }>("/data/profile/update", {
    alias: payload.alias,
    avatar_url: payload.avatarDataUrl,
    language: payload.language
  });
