import { supabase } from "./backend/supabase";
import type { ExportBundle, Post, User, UserPreferences } from "./types";
import { canonicalizeUrl, duplicateUrlKeys } from "./utils";

const ACTIVE_USER_KEY = "news-curation-active-user-id";
const DEFAULT_PREFERENCES = (userId: string): UserPreferences => ({
  userId,
  preferredTopics: [],
  blockedDomains: [],
  blockedKeywords: []
});

interface ProfileRow {
  id: string;
  alias: string;
  avatar_url: string | null;
  role: "admin" | "member" | null;
  created_at: string;
}

interface PostRow {
  id: string;
  user_id: string;
  created_at: string;
  url: string | null;
  canonical_url: string | null;
  title: string | null;
  text: string | null;
  source_domain: string | null;
  topics: string[] | null;
  subtopics: string[] | null;
  quality_label: "high" | "medium" | "low" | "clickbait";
  quality_score: number;
  interest_score: number;
  flags: string[] | null;
  rationale: string[] | null;
  normalized_text: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

interface VoteRow {
  post_id: string;
  user_id: string;
  vote: 1 | -1;
  voted_at: string;
}

interface PostShareRow {
  post_id: string;
  user_id: string;
  share_count: number;
}

interface PostOpenRow {
  post_id: string;
  user_id: string;
}

interface CommentAuraRow {
  comment_id: string;
  user_id: string;
}

interface PreferenceRow {
  user_id: string;
  preferred_topics: string[] | null;
  blocked_domains: string[] | null;
  blocked_keywords: string[] | null;
  updated_at?: string;
}

interface ProfilePrivateRow {
  user_id: string;
  auth_email: string | null;
  language: "es" | "en" | "gl" | null;
  privacy_consent_at: string | null;
  privacy_policy_version: string | null;
}

const ensureRemote = () => {
  if (!supabase) {
    throw new Error("REMOTE_REQUIRED_MISSING_CONFIG");
  }
  return supabase;
};

const normalizePost = (post: Post): Post => ({
  ...post,
  canonicalUrl: post.canonicalUrl ?? canonicalizeUrl(post.url),
  interestScore: Math.max(1, Math.min(100, Math.round(post.interestScore)))
});

const profileToUser = (row: ProfileRow, profilePrivate?: ProfilePrivateRow): User => ({
  id: row.id,
  alias: row.alias,
  avatarDataUrl: row.avatar_url ?? undefined,
  role: row.role === "admin" ? "admin" : "member",
  authEmail: profilePrivate?.auth_email ?? undefined,
  language: profilePrivate?.language ?? undefined,
  privacyConsentAt: profilePrivate?.privacy_consent_at ? Date.parse(profilePrivate.privacy_consent_at) : undefined,
  privacyPolicyVersion: profilePrivate?.privacy_policy_version ?? undefined,
  createdAt: Date.parse(row.created_at) || Date.now()
});

const toContributorCounts = (row: PostRow, shares: PostShareRow[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  shares
    .filter((share) => share.post_id === row.id)
    .forEach((share) => {
      counts[share.user_id] = Math.max(1, Math.round(share.share_count));
    });
  if (!counts[row.user_id]) counts[row.user_id] = 1;
  return counts;
};

const postRowToPost = (
  row: PostRow,
  comments: CommentRow[],
  votes: VoteRow[],
  shares: PostShareRow[],
  opens: PostOpenRow[],
  commentAuraRows: CommentAuraRow[]
): Post => {
  const contributorCounts = toContributorCounts(row, shares);
  const contributorUserIds = Object.keys(contributorCounts);
  const shareCount = Object.values(contributorCounts).reduce((acc, value) => acc + value, 0);
  const openedByUserIds = Array.from(
    new Set(opens.filter((item) => item.post_id === row.id).map((item) => item.user_id))
  );

  return normalizePost({
    id: row.id,
    userId: row.user_id,
    createdAt: Date.parse(row.created_at) || Date.now(),
    url: row.url ?? undefined,
    canonicalUrl: row.canonical_url ?? undefined,
    title: row.title ?? undefined,
    text: row.text ?? undefined,
    sourceDomain: row.source_domain ?? undefined,
    topics: row.topics && row.topics.length > 0 ? row.topics : ["misc"],
    subtopics: row.subtopics ?? [],
    qualityLabel: row.quality_label,
    qualityScore: row.quality_score,
    interestScore: row.interest_score,
    flags: row.flags ?? [],
    rationale: row.rationale ?? [],
    normalizedText: row.normalized_text ?? "",
    extractedHosts: [],
    contributorCounts,
    contributorUserIds,
    shareCount,
    openedByUserIds,
    comments: comments
      .filter((comment) => comment.post_id === row.id)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
      .map((comment) => ({
        id: comment.id,
        userId: comment.user_id,
        text: comment.text,
        createdAt: Date.parse(comment.created_at) || Date.now(),
        auraUserIds: commentAuraRows
          .filter((entry) => entry.comment_id === comment.id)
          .map((entry) => entry.user_id)
      })),
    feedbacks: votes
      .filter((vote) => vote.post_id === row.id)
      .map((vote) => ({
        userId: vote.user_id,
        vote: vote.vote,
        votedAt: Date.parse(vote.voted_at) || Date.now()
      }))
  });
};

const postToRow = (post: Post): Omit<PostRow, "id" | "created_at"> & { created_at: string } => ({
  user_id: post.userId,
  created_at: new Date(post.createdAt).toISOString(),
  url: post.url ?? null,
  canonical_url: post.canonicalUrl ?? canonicalizeUrl(post.url) ?? null,
  title: post.title ?? null,
  text: post.text ?? null,
  source_domain: post.sourceDomain ?? null,
  topics: post.topics,
  subtopics: post.subtopics ?? [],
  quality_label: post.qualityLabel,
  quality_score: post.qualityScore,
  interest_score: post.interestScore,
  flags: post.flags,
  rationale: post.rationale,
  normalized_text: post.normalizedText
});

const getAuthUserId = async (): Promise<string | null> => {
  const client = ensureRemote();
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
};

const isMissingTable = (error: { code?: string } | null | undefined): boolean => error?.code === "42P01";

const upsertOwnVoteAndComments = async (post: Post): Promise<void> => {
  const client = ensureRemote();
  const authUserId = await getAuthUserId();
  if (!authUserId) return;

  const ownVote = post.feedbacks?.find((entry) => entry.userId === authUserId);
  if (ownVote) {
    const { error } = await client.from("post_votes").upsert(
      {
        post_id: post.id,
        user_id: authUserId,
        vote: ownVote.vote,
        voted_at: new Date(ownVote.votedAt).toISOString()
      },
      { onConflict: "post_id,user_id" }
    );
    if (error) throw new Error(`Remote vote write failed: ${error.message}`);
  }

  const ownComments = (post.comments ?? []).filter((comment) => comment.userId === authUserId);
  const { data: existing, error: readError } = await client
    .from("comments")
    .select("id")
    .eq("post_id", post.id)
    .eq("user_id", authUserId);
  if (readError) throw new Error(`Remote comments read failed: ${readError.message}`);

  const existingIds = new Set((existing ?? []).map((entry) => entry.id as string));
  const nextIds = new Set(ownComments.map((comment) => comment.id));
  const removeIds = Array.from(existingIds).filter((id) => !nextIds.has(id));

  if (removeIds.length > 0) {
    const { error } = await client.from("comments").delete().in("id", removeIds);
    if (error) throw new Error(`Remote comments delete failed: ${error.message}`);
  }

  if (ownComments.length > 0) {
    const rows = ownComments.map((comment) => ({
      id: comment.id,
      post_id: post.id,
      user_id: authUserId,
      text: comment.text,
      created_at: new Date(comment.createdAt).toISOString()
    }));
    const { error } = await client.from("comments").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`Remote comments write failed: ${error.message}`);
  }

  const desiredShareCount = post.contributorCounts?.[authUserId] ?? (post.userId === authUserId ? 1 : 0);
  if (desiredShareCount > 0) {
    const shareResult = await client.from("post_shares").upsert(
      {
        post_id: post.id,
        user_id: authUserId,
        share_count: desiredShareCount,
        last_shared_at: new Date().toISOString()
      },
      { onConflict: "post_id,user_id" }
    );
    if (shareResult.error && !isMissingTable(shareResult.error as { code?: string })) {
      throw new Error(`Remote post_shares write failed: ${shareResult.error.message}`);
    }
  }

  if ((post.openedByUserIds ?? []).includes(authUserId)) {
    const openResult = await client.from("post_opens").upsert(
      {
        post_id: post.id,
        user_id: authUserId,
        opened_at: new Date().toISOString()
      },
      { onConflict: "post_id,user_id" }
    );
    if (openResult.error && !isMissingTable(openResult.error as { code?: string })) {
      throw new Error(`Remote post_opens write failed: ${openResult.error.message}`);
    }
  }

  const allCommentIds = (post.comments ?? []).map((comment) => comment.id);
  if (allCommentIds.length > 0) {
    const desiredAuraCommentIds = new Set(
      (post.comments ?? [])
        .filter((comment) => (comment.auraUserIds ?? []).includes(authUserId))
        .map((comment) => comment.id)
    );

    const existingResult = await client
      .from("comment_aura")
      .select("comment_id")
      .eq("user_id", authUserId)
      .in("comment_id", allCommentIds);

    if (existingResult.error) {
      if (!isMissingTable(existingResult.error as { code?: string })) {
        throw new Error(`Remote comment_aura read failed: ${existingResult.error.message}`);
      }
    } else {
      const existingIds = new Set((existingResult.data ?? []).map((entry) => entry.comment_id as string));
      const removeIds = Array.from(existingIds).filter((id) => !desiredAuraCommentIds.has(id));
      if (removeIds.length > 0) {
        const removeResult = await client
          .from("comment_aura")
          .delete()
          .eq("user_id", authUserId)
          .in("comment_id", removeIds);
        if (removeResult.error && !isMissingTable(removeResult.error as { code?: string })) {
          throw new Error(`Remote comment_aura delete failed: ${removeResult.error.message}`);
        }
      }

      const insertRows = Array.from(desiredAuraCommentIds)
        .filter((id) => !existingIds.has(id))
        .map((commentId) => ({
          comment_id: commentId,
          user_id: authUserId,
          created_at: new Date().toISOString()
        }));

      if (insertRows.length > 0) {
        const insertResult = await client.from("comment_aura").upsert(insertRows, { onConflict: "comment_id,user_id" });
        if (insertResult.error && !isMissingTable(insertResult.error as { code?: string })) {
          throw new Error(`Remote comment_aura write failed: ${insertResult.error.message}`);
        }
      }
    }
  }
};

const mergeFeedbacks = (base: Post["feedbacks"], incoming: Post["feedbacks"]): Post["feedbacks"] => {
  const mergedByUser = new Map<string, NonNullable<Post["feedbacks"]>[number]>();
  [...(base ?? []), ...(incoming ?? [])].forEach((item) => {
    const current = mergedByUser.get(item.userId);
    if (!current || item.votedAt > current.votedAt) mergedByUser.set(item.userId, item);
  });
  return Array.from(mergedByUser.values());
};

const mergeComments = (base: Post["comments"], incoming: Post["comments"]): Post["comments"] => {
  const byId = new Map<string, NonNullable<Post["comments"]>[number]>();
  [...(base ?? []), ...(incoming ?? [])].forEach((item) => {
    const current = byId.get(item.id);
    if (!current || item.createdAt > current.createdAt) byId.set(item.id, item);
  });
  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
};

const contributorCounts = (post: Post): Record<string, number> =>
  post.contributorCounts ?? { [post.userId]: post.shareCount ?? 1 };

const mergeDuplicatePosts = (baseRaw: Post, incomingRaw: Post): Post => {
  const base = normalizePost(baseRaw);
  const incoming = normalizePost(incomingRaw);

  const mergedCounts = { ...contributorCounts(base) };
  Object.entries(contributorCounts(incoming)).forEach(([userId, count]) => {
    mergedCounts[userId] = (mergedCounts[userId] ?? 0) + count;
  });

  const contributorUserIds = Array.from(
    new Set([
      ...(base.contributorUserIds ?? [base.userId]),
      ...(incoming.contributorUserIds ?? [incoming.userId]),
      ...Object.keys(mergedCounts)
    ])
  );

  return {
    ...base,
    createdAt: Math.min(base.createdAt, incoming.createdAt),
    canonicalUrl: base.canonicalUrl ?? incoming.canonicalUrl,
    url: base.url ?? incoming.url,
    title: base.title ?? incoming.title,
    text: base.text ?? incoming.text,
    sourceDomain: base.sourceDomain ?? incoming.sourceDomain,
    extractedHosts: Array.from(new Set([...(base.extractedHosts ?? []), ...(incoming.extractedHosts ?? [])])),
    contributorCounts: mergedCounts,
    contributorUserIds,
    shareCount: Object.values(mergedCounts).reduce((acc, value) => acc + value, 0),
    openedByUserIds: Array.from(new Set([...(base.openedByUserIds ?? []), ...(incoming.openedByUserIds ?? [])])),
    feedbacks: mergeFeedbacks(base.feedbacks, incoming.feedbacks),
    comments: mergeComments(base.comments, incoming.comments),
    topics: Array.from(new Set([...(base.topics ?? []), ...(incoming.topics ?? [])])),
    subtopics: Array.from(new Set([...(base.subtopics ?? []), ...(incoming.subtopics ?? [])])),
    qualityLabel: base.qualityScore >= incoming.qualityScore ? base.qualityLabel : incoming.qualityLabel,
    qualityScore: Math.max(base.qualityScore, incoming.qualityScore),
    interestScore: Math.max(base.interestScore, incoming.interestScore),
    flags: Array.from(new Set([...(base.flags ?? []), ...(incoming.flags ?? [])])),
    rationale: Array.from(new Set([...(base.rationale ?? []), ...(incoming.rationale ?? [])])),
    normalizedText: `${base.normalizedText} ${incoming.normalizedText}`.trim()
  };
};

export const setActiveUserId = (userId: string | null): void => {
  if (!userId) {
    localStorage.removeItem(ACTIVE_USER_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_USER_KEY, userId);
};

export const getActiveUserId = (): string | null => localStorage.getItem(ACTIVE_USER_KEY);

export const addUser = async (user: User): Promise<void> => {
  const client = ensureRemote();
  const { error } = await client.from("profiles").upsert(
    {
      id: user.id,
      alias: user.alias,
      avatar_url: user.avatarDataUrl ?? null,
      role: user.role ?? "member",
      created_at: new Date(user.createdAt).toISOString()
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Remote user write failed: ${error.message}`);

  const { error: privateError } = await client.from("profile_private").upsert(
    {
      user_id: user.id,
      auth_email: user.authEmail ?? null,
      language: user.language ?? null,
      privacy_consent_at: user.privacyConsentAt ? new Date(user.privacyConsentAt).toISOString() : null,
      privacy_policy_version: user.privacyPolicyVersion ?? null
    },
    { onConflict: "user_id" }
  );
  if (privateError && (privateError as { code?: string }).code !== "42P01") {
    throw new Error(`Remote profile_private write failed: ${privateError.message}`);
  }
};

export const getUsers = async (): Promise<User[]> => {
  const client = ensureRemote();
  const [{ data, error }, privateResult] = await Promise.all([
    client
      .from("profiles")
      .select("id,alias,avatar_url,role,created_at")
      .order("created_at", { ascending: false }),
    client
      .from("profile_private")
      .select("user_id,auth_email,language,privacy_consent_at,privacy_policy_version")
  ]);
  if (error) throw new Error(`Remote users read failed: ${error.message}`);
  const privateMap = new Map<string, ProfilePrivateRow>();
  if (!privateResult.error) {
    ((privateResult.data ?? []) as ProfilePrivateRow[]).forEach((row) => privateMap.set(row.user_id, row));
  } else if ((privateResult.error as { code?: string }).code !== "42P01") {
    throw new Error(`Remote profile_private read failed: ${privateResult.error.message}`);
  }
  return ((data ?? []) as ProfileRow[]).map((row) => profileToUser(row, privateMap.get(row.id)));
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  const users = await getUsers();
  return users.find((u) => u.id === id);
};

export const updateUser = async (user: User): Promise<void> => {
  await addUser(user);
};

export const deleteUserById = async (userId: string): Promise<void> => {
  const client = ensureRemote();
  const { error } = await client.from("profiles").delete().eq("id", userId);
  if (error) throw new Error(`Remote user delete failed: ${error.message}`);
};

export const addPost = async (post: Post): Promise<void> => {
  const client = ensureRemote();
  const normalized = normalizePost(post);
  const { error } = await client.from("posts").insert({
    id: normalized.id,
    ...postToRow(normalized)
  });
  if (error) throw new Error(`Remote post create failed: ${error.message}`);

  const sharerVote = normalized.feedbacks?.find((entry) => entry.userId === normalized.userId);
  if (sharerVote) {
    const { error: voteError } = await client.from("post_votes").upsert(
      {
        post_id: normalized.id,
        user_id: normalized.userId,
        vote: sharerVote.vote,
        voted_at: new Date(sharerVote.votedAt).toISOString()
      },
      { onConflict: "post_id,user_id" }
    );
    if (voteError) throw new Error(`Remote vote create failed: ${voteError.message}`);
  }

  const shareResult = await client.from("post_shares").upsert(
    {
      post_id: normalized.id,
      user_id: normalized.userId,
      share_count: 1,
      last_shared_at: new Date(normalized.createdAt).toISOString()
    },
    { onConflict: "post_id,user_id" }
  );
  if (shareResult.error && !isMissingTable(shareResult.error as { code?: string })) {
    throw new Error(`Remote post_shares create failed: ${shareResult.error.message}`);
  }
};

export const updatePost = async (post: Post): Promise<void> => {
  const client = ensureRemote();
  const normalized = normalizePost(post);
  const result = await client
    .from("posts")
    .update(postToRow(normalized))
    .eq("id", normalized.id);
  if (result.error && (result.error as { code?: string }).code !== "42501") {
    throw new Error(`Remote post update failed: ${result.error.message}`);
  }
  await upsertOwnVoteAndComments(normalized);
};

export const listPosts = async (): Promise<Post[]> => {
  const client = ensureRemote();
  const { data: posts, error: postsError } = await client
    .from("posts")
    .select(
      "id,user_id,created_at,url,canonical_url,title,text,source_domain,topics,subtopics,quality_label,quality_score,interest_score,flags,rationale,normalized_text"
    )
    .order("created_at", { ascending: false });
  if (postsError) throw new Error(`Remote posts read failed: ${postsError.message}`);

  const postRows = (posts ?? []) as PostRow[];
  if (postRows.length === 0) return [];
  const postIds = postRows.map((post) => post.id);

  const [
    { data: comments, error: commentsError },
    { data: votes, error: votesError },
    sharesResult,
    opensResult
  ] = await Promise.all([
    client.from("comments").select("id,post_id,user_id,text,created_at").in("post_id", postIds),
    client.from("post_votes").select("post_id,user_id,vote,voted_at").in("post_id", postIds),
    client.from("post_shares").select("post_id,user_id,share_count").in("post_id", postIds),
    client.from("post_opens").select("post_id,user_id").in("post_id", postIds)
  ]);

  if (commentsError) throw new Error(`Remote comments read failed: ${commentsError.message}`);
  if (votesError) throw new Error(`Remote votes read failed: ${votesError.message}`);
  if (sharesResult.error && !isMissingTable(sharesResult.error as { code?: string })) {
    throw new Error(`Remote post_shares read failed: ${sharesResult.error.message}`);
  }
  if (opensResult.error && !isMissingTable(opensResult.error as { code?: string })) {
    throw new Error(`Remote post_opens read failed: ${opensResult.error.message}`);
  }

  const commentRows = (comments ?? []) as CommentRow[];
  const voteRows = (votes ?? []) as VoteRow[];
  const shareRows = ((sharesResult.data ?? []) as PostShareRow[]) ?? [];
  const openRows = ((opensResult.data ?? []) as PostOpenRow[]) ?? [];

  const commentIds = commentRows.map((item) => item.id);
  let commentAuraRows: CommentAuraRow[] = [];
  if (commentIds.length > 0) {
    const commentAuraResult = await client
      .from("comment_aura")
      .select("comment_id,user_id")
      .in("comment_id", commentIds);
    if (commentAuraResult.error) {
      if (!isMissingTable(commentAuraResult.error as { code?: string })) {
        throw new Error(`Remote comment_aura read failed: ${commentAuraResult.error.message}`);
      }
    } else {
      commentAuraRows = (commentAuraResult.data ?? []) as CommentAuraRow[];
    }
  }

  return postRows.map((row) => postRowToPost(row, commentRows, voteRows, shareRows, openRows, commentAuraRows));
};

export const deletePostById = async (postId: string): Promise<void> => {
  const client = ensureRemote();
  const { error } = await client.from("posts").delete().eq("id", postId);
  if (error) throw new Error(`Remote post delete failed: ${error.message}`);
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
  const client = ensureRemote();
  const { data, error } = await client
    .from("user_preferences")
    .select("user_id,preferred_topics,blocked_domains,blocked_keywords")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === "42P01") {
      return DEFAULT_PREFERENCES(userId);
    }
    throw new Error(`Remote preferences read failed: ${error.message}`);
  }

  if (!data) return DEFAULT_PREFERENCES(userId);
  const row = data as PreferenceRow;
  return {
    userId: row.user_id,
    preferredTopics: row.preferred_topics ?? [],
    blockedDomains: row.blocked_domains ?? [],
    blockedKeywords: row.blocked_keywords ?? []
  };
};

export const upsertPreferences = async (prefs: UserPreferences): Promise<void> => {
  const client = ensureRemote();
  const { error } = await client.from("user_preferences").upsert(
    {
      user_id: prefs.userId,
      preferred_topics: prefs.preferredTopics,
      blocked_domains: prefs.blockedDomains,
      blocked_keywords: prefs.blockedKeywords,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (error) {
    if ((error as { code?: string }).code === "42P01") {
      throw new Error("MISSING_USER_PREFERENCES_TABLE");
    }
    throw new Error(`Remote preferences write failed: ${error.message}`);
  }
};

export const exportAllData = async (): Promise<ExportBundle> => {
  const [users, posts] = await Promise.all([getUsers(), listPosts()]);
  const preferences = await Promise.all(users.map((user) => getPreferences(user.id)));
  return { users, posts, preferences };
};

export const importAllData = async (bundle: ExportBundle): Promise<void> => {
  const incomingUsers = bundle.users ?? [];
  const incomingPosts = (bundle.posts ?? []).map((post) => normalizePost(post));
  const incomingPreferences = bundle.preferences ?? [];

  const currentUsers = await getUsers();
  for (const user of incomingUsers) {
    if (!currentUsers.some((current) => current.id === user.id)) {
      await addUser(user);
    }
  }

  const currentPosts = await listPosts();
  const mergedPostsById = new Map<string, Post>(currentPosts.map((post) => [post.id, post]));
  const duplicateIndex = new Map<string, string>();

  mergedPostsById.forEach((post) => {
    duplicateUrlKeys(post.canonicalUrl ?? post.url).forEach((key) => {
      if (!duplicateIndex.has(key)) duplicateIndex.set(key, post.id);
    });
  });

  incomingPosts.forEach((incoming) => {
    const sameId = mergedPostsById.get(incoming.id);
    if (sameId) {
      const merged = mergeDuplicatePosts(sameId, incoming);
      mergedPostsById.set(merged.id, merged);
      duplicateUrlKeys(merged.canonicalUrl ?? merged.url).forEach((key) => duplicateIndex.set(key, merged.id));
      return;
    }

    const duplicateId = duplicateUrlKeys(incoming.canonicalUrl ?? incoming.url)
      .map((key) => duplicateIndex.get(key))
      .find(Boolean);

    if (duplicateId) {
      const base = mergedPostsById.get(duplicateId);
      if (!base) return;
      const merged = mergeDuplicatePosts(base, incoming);
      mergedPostsById.set(merged.id, merged);
      duplicateUrlKeys(merged.canonicalUrl ?? merged.url).forEach((key) => duplicateIndex.set(key, merged.id));
      return;
    }

    mergedPostsById.set(incoming.id, incoming);
    duplicateUrlKeys(incoming.canonicalUrl ?? incoming.url).forEach((key) => duplicateIndex.set(key, incoming.id));
  });

  for (const post of Array.from(mergedPostsById.values())) {
    const exists = currentPosts.some((entry) => entry.id === post.id);
    if (exists) {
      await updatePost(post);
    } else {
      await addPost(post);
    }
  }

  for (const pref of incomingPreferences) {
    await upsertPreferences(pref);
  }
};
