import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { remoteModeEnabled, supabase } from "./backend/supabase";
import type { ExportBundle, Post, User, UserPreferences } from "./types";
import { canonicalizeUrl, duplicateUrlKeys } from "./utils";

interface NewsDB extends DBSchema {
  users: {
    key: string;
    value: User;
    indexes: { "by-createdAt": number };
  };
  posts: {
    key: string;
    value: Post;
    indexes: { "by-createdAt": number; "by-userId": string };
  };
  preferences: {
    key: string;
    value: UserPreferences;
  };
}

const DB_NAME = "news-curation-db";
const DB_VERSION = 1;
const ACTIVE_USER_KEY = "news-curation-active-user-id";

const LS_KEYS = {
  users: "news-curation-ls-users",
  posts: "news-curation-ls-posts",
  preferences: "news-curation-ls-preferences"
} as const;

const hasIndexedDB = (): boolean => typeof indexedDB !== "undefined";
const isRemote = (): boolean => remoteModeEnabled && Boolean(supabase);

const REMOTE_KEYS = {
  users: "users",
  posts: "posts",
  preferences: "preferences"
} as const;

const remoteReadCollection = async <T>(key: string): Promise<T[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("app_state")
    .select("payload")
    .eq("id", key)
    .maybeSingle();
  if (error) throw new Error(`Remote read failed (${key}): ${error.message}`);
  return ((data?.payload as T[] | null) ?? []).map((entry) => entry);
};

const sanitizeRemoteUser = (user: User): User => {
  const { passwordHash, ...safe } = user;
  return safe;
};

const remoteWriteCollection = async <T>(key: string, records: T[]): Promise<void> => {
  if (!supabase) return;
  const { error } = await supabase.from("app_state").upsert(
    {
      id: key,
      payload: records,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Remote write failed (${key}): ${error.message}`);
};

let dbPromise: Promise<IDBPDatabase<NewsDB>> | null = null;

const getDb = async (): Promise<IDBPDatabase<NewsDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<NewsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("users")) {
          const store = db.createObjectStore("users", { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("posts")) {
          const store = db.createObjectStore("posts", { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
          store.createIndex("by-userId", "userId");
        }
        if (!db.objectStoreNames.contains("preferences")) {
          db.createObjectStore("preferences", { keyPath: "userId" });
        }
      }
    });
  }
  return dbPromise;
};

const lsRead = <T>(key: string): T[] => {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
};

const lsWrite = <T>(key: string, records: T[]): void => {
  localStorage.setItem(key, JSON.stringify(records));
};

const normalizePostForDedup = (post: Post): Post => ({
  ...post,
  canonicalUrl: post.canonicalUrl ?? canonicalizeUrl(post.url),
  interestScore: Math.max(1, Math.min(100, Math.round(post.interestScore)))
});

const contributorCounts = (post: Post): Record<string, number> =>
  post.contributorCounts ?? { [post.userId]: post.shareCount ?? 1 };

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

const mergeDuplicatePosts = (baseRaw: Post, incomingRaw: Post): Post => {
  const base = normalizePostForDedup(baseRaw);
  const incoming = normalizePostForDedup(incomingRaw);

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

  const mergedRationale = Array.from(new Set([...(base.rationale ?? []), ...(incoming.rationale ?? [])]));
  const mergedTopics = Array.from(new Set([...(base.topics ?? []), ...(incoming.topics ?? [])]));
  const mergedSubtopics = Array.from(new Set([...(base.subtopics ?? []), ...(incoming.subtopics ?? [])]));

  return {
    ...base,
    createdAt: Math.min(base.createdAt, incoming.createdAt),
    canonicalUrl: base.canonicalUrl ?? incoming.canonicalUrl,
    url: base.url ?? incoming.url,
    title: base.title ?? incoming.title,
    text: base.text ?? incoming.text,
    previewTitle: base.previewTitle ?? incoming.previewTitle,
    previewDescription: base.previewDescription ?? incoming.previewDescription,
    previewImageUrl: base.previewImageUrl ?? incoming.previewImageUrl,
    previewSiteName: base.previewSiteName ?? incoming.previewSiteName,
    sourceDomain: base.sourceDomain ?? incoming.sourceDomain,
    extractedHosts: Array.from(new Set([...(base.extractedHosts ?? []), ...(incoming.extractedHosts ?? [])])),
    contributorCounts: mergedCounts,
    contributorUserIds,
    shareCount: Object.values(mergedCounts).reduce((acc, value) => acc + value, 0),
    openedByUserIds: Array.from(new Set([...(base.openedByUserIds ?? []), ...(incoming.openedByUserIds ?? [])])),
    feedbacks: mergeFeedbacks(base.feedbacks, incoming.feedbacks),
    comments: mergeComments(base.comments, incoming.comments),
    topics: mergedTopics.length > 0 ? mergedTopics : ["misc"],
    subtopics: mergedSubtopics,
    qualityLabel: base.qualityScore >= incoming.qualityScore ? base.qualityLabel : incoming.qualityLabel,
    qualityScore: Math.max(base.qualityScore, incoming.qualityScore),
    interestScore: Math.max(base.interestScore, incoming.interestScore),
    flags: Array.from(new Set([...(base.flags ?? []), ...(incoming.flags ?? [])])),
    rationale: mergedRationale,
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
  if (isRemote()) {
    const users = await remoteReadCollection<User>(REMOTE_KEYS.users);
    if (!users.some((u) => u.id === user.id)) {
      users.push(sanitizeRemoteUser(user));
      await remoteWriteCollection<User>(REMOTE_KEYS.users, users);
    }
    return;
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    await db.put("users", user);
    return;
  }
  const users = lsRead<User>(LS_KEYS.users);
  if (!users.some((u) => u.id === user.id)) {
    users.push(user);
  }
  lsWrite(LS_KEYS.users, users);
};

export const getUsers = async (): Promise<User[]> => {
  if (isRemote()) {
    const users = await remoteReadCollection<User>(REMOTE_KEYS.users);
    return users.sort((a, b) => b.createdAt - a.createdAt);
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    const users = await db.getAll("users");
    return users.sort((a, b) => b.createdAt - a.createdAt);
  }
  return lsRead<User>(LS_KEYS.users).sort((a, b) => b.createdAt - a.createdAt);
};

export const getUserById = async (id: string): Promise<User | undefined> => {
  if (isRemote()) {
    const users = await remoteReadCollection<User>(REMOTE_KEYS.users);
    return users.find((u) => u.id === id);
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    return db.get("users", id);
  }
  return lsRead<User>(LS_KEYS.users).find((u) => u.id === id);
};

export const updateUser = async (user: User): Promise<void> => {
  if (isRemote()) {
    const users = await remoteReadCollection<User>(REMOTE_KEYS.users);
    const index = users.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users[index] = sanitizeRemoteUser(user);
      await remoteWriteCollection<User>(REMOTE_KEYS.users, users);
    }
    return;
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    await db.put("users", user);
    return;
  }
  const users = lsRead<User>(LS_KEYS.users);
  const index = users.findIndex((entry) => entry.id === user.id);
  if (index >= 0) {
    users[index] = user;
    lsWrite(LS_KEYS.users, users);
  }
};

export const deleteUserById = async (userId: string): Promise<void> => {
  if (isRemote()) {
    const users = (await remoteReadCollection<User>(REMOTE_KEYS.users)).filter((entry) => entry.id !== userId);
    const preferences = (await remoteReadCollection<UserPreferences>(REMOTE_KEYS.preferences)).filter(
      (entry) => entry.userId !== userId
    );
    await remoteWriteCollection<User>(REMOTE_KEYS.users, users);
    await remoteWriteCollection<UserPreferences>(REMOTE_KEYS.preferences, preferences);
    return;
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    await db.delete("users", userId);
    await db.delete("preferences", userId);
    return;
  }
  const users = lsRead<User>(LS_KEYS.users).filter((entry) => entry.id !== userId);
  const preferences = lsRead<UserPreferences>(LS_KEYS.preferences).filter((entry) => entry.userId !== userId);
  lsWrite(LS_KEYS.users, users);
  lsWrite(LS_KEYS.preferences, preferences);
};

export const addPost = async (post: Post): Promise<void> => {
  const normalized = normalizePostForDedup(post);
  if (isRemote()) {
    const posts = await remoteReadCollection<Post>(REMOTE_KEYS.posts);
    if (!posts.some((p) => p.id === normalized.id)) {
      posts.push(normalized);
      await remoteWriteCollection<Post>(REMOTE_KEYS.posts, posts);
    }
    return;
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    await db.put("posts", normalized);
    return;
  }
  const posts = lsRead<Post>(LS_KEYS.posts);
  if (!posts.some((p) => p.id === normalized.id)) {
    posts.push(normalized);
  }
  lsWrite(LS_KEYS.posts, posts);
};

export const updatePost = async (post: Post): Promise<void> => {
  const normalized = normalizePostForDedup(post);
  if (isRemote()) {
    const posts = await remoteReadCollection<Post>(REMOTE_KEYS.posts);
    const index = posts.findIndex((entry) => entry.id === normalized.id);
    if (index >= 0) {
      posts[index] = normalized;
      await remoteWriteCollection<Post>(REMOTE_KEYS.posts, posts);
    }
    return;
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    await db.put("posts", normalized);
    return;
  }
  const posts = lsRead<Post>(LS_KEYS.posts);
  const index = posts.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) {
    posts[index] = normalized;
    lsWrite(LS_KEYS.posts, posts);
  }
};

export const listPosts = async (): Promise<Post[]> => {
  if (isRemote()) {
    const posts = await remoteReadCollection<Post>(REMOTE_KEYS.posts);
    return posts.map((post) => normalizePostForDedup(post)).sort((a, b) => b.createdAt - a.createdAt);
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    const posts = await db.getAll("posts");
    return posts.map((post) => normalizePostForDedup(post)).sort((a, b) => b.createdAt - a.createdAt);
  }
  return lsRead<Post>(LS_KEYS.posts).map((post) => normalizePostForDedup(post)).sort((a, b) => b.createdAt - a.createdAt);
};

export const deletePostById = async (postId: string): Promise<void> => {
  if (isRemote()) {
    const posts = (await remoteReadCollection<Post>(REMOTE_KEYS.posts)).filter((post) => post.id !== postId);
    await remoteWriteCollection<Post>(REMOTE_KEYS.posts, posts);
    return;
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    await db.delete("posts", postId);
    return;
  }
  const posts = lsRead<Post>(LS_KEYS.posts).filter((post) => post.id !== postId);
  lsWrite(LS_KEYS.posts, posts);
};

export const listPostsByTopic = async (topic: string): Promise<Post[]> => {
  const posts = await listPosts();
  return posts.filter((post) => post.topics.includes(topic));
};

export const listPostsByUser = async (userId: string): Promise<Post[]> => {
  if (isRemote()) {
    const posts = await remoteReadCollection<Post>(REMOTE_KEYS.posts);
    return posts
      .filter((p) => p.userId === userId)
      .map((post) => normalizePostForDedup(post))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    const byUser = await db.getAllFromIndex("posts", "by-userId", userId);
    return byUser.map((post) => normalizePostForDedup(post)).sort((a, b) => b.createdAt - a.createdAt);
  }
  return lsRead<Post>(LS_KEYS.posts)
    .filter((p) => p.userId === userId)
    .map((post) => normalizePostForDedup(post))
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const getPreferences = async (userId: string): Promise<UserPreferences> => {
  if (isRemote()) {
    const all = await remoteReadCollection<UserPreferences>(REMOTE_KEYS.preferences);
    return (
      all.find((entry) => entry.userId === userId) ?? {
        userId,
        preferredTopics: [],
        blockedDomains: [],
        blockedKeywords: []
      }
    );
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    const found = await db.get("preferences", userId);
    return (
      found ?? {
        userId,
        preferredTopics: [],
        blockedDomains: [],
        blockedKeywords: []
      }
    );
  }
  const all = lsRead<UserPreferences>(LS_KEYS.preferences);
  return (
    all.find((entry) => entry.userId === userId) ?? {
      userId,
      preferredTopics: [],
      blockedDomains: [],
      blockedKeywords: []
    }
  );
};

export const upsertPreferences = async (prefs: UserPreferences): Promise<void> => {
  if (isRemote()) {
    const all = await remoteReadCollection<UserPreferences>(REMOTE_KEYS.preferences);
    const index = all.findIndex((entry) => entry.userId === prefs.userId);
    if (index >= 0) all[index] = prefs;
    else all.push(prefs);
    await remoteWriteCollection<UserPreferences>(REMOTE_KEYS.preferences, all);
    return;
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    await db.put("preferences", prefs);
    return;
  }
  const all = lsRead<UserPreferences>(LS_KEYS.preferences);
  const index = all.findIndex((entry) => entry.userId === prefs.userId);
  if (index >= 0) all[index] = prefs;
  else all.push(prefs);
  lsWrite(LS_KEYS.preferences, all);
};

export const exportAllData = async (): Promise<ExportBundle> => {
  const [users, posts] = await Promise.all([getUsers(), listPosts()]);
  let preferences: UserPreferences[];
  if (isRemote()) {
    preferences = await remoteReadCollection<UserPreferences>(REMOTE_KEYS.preferences);
    return { users, posts, preferences };
  }
  if (hasIndexedDB()) {
    const db = await getDb();
    preferences = await db.getAll("preferences");
  } else {
    preferences = lsRead<UserPreferences>(LS_KEYS.preferences);
  }
  return { users, posts, preferences };
};

export const importAllData = async (bundle: ExportBundle): Promise<void> => {
  const users = bundle.users ?? [];
  const posts = (bundle.posts ?? []).map((post) => normalizePostForDedup(post));
  const preferences = bundle.preferences ?? [];

  if (isRemote()) {
    const currentUsers = await remoteReadCollection<User>(REMOTE_KEYS.users);
    const currentPosts = (await remoteReadCollection<Post>(REMOTE_KEYS.posts)).map((post) => normalizePostForDedup(post));
    const currentPreferences = await remoteReadCollection<UserPreferences>(REMOTE_KEYS.preferences);

    const mergedUsers = [...currentUsers];
    users.forEach((u) => {
      if (!mergedUsers.some((current) => current.id === u.id)) mergedUsers.push(u);
    });

    const mergedPostsById = new Map<string, Post>(currentPosts.map((post) => [post.id, post]));
    const duplicateIndex = new Map<string, string>();
    mergedPostsById.forEach((post) => {
      duplicateUrlKeys(post.canonicalUrl ?? post.url).forEach((key) => {
        if (!duplicateIndex.has(key)) duplicateIndex.set(key, post.id);
      });
    });
    posts.forEach((incoming) => {
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
    const mergedPosts = Array.from(mergedPostsById.values());

    const mergedPreferences = [...currentPreferences];
    preferences.forEach((pref) => {
      if (!mergedPreferences.some((current) => current.userId === pref.userId)) {
        mergedPreferences.push(pref);
      }
    });

    await remoteWriteCollection<User>(REMOTE_KEYS.users, mergedUsers);
    await remoteWriteCollection<Post>(REMOTE_KEYS.posts, mergedPosts);
    await remoteWriteCollection<UserPreferences>(REMOTE_KEYS.preferences, mergedPreferences);
    return;
  }

  if (hasIndexedDB()) {
    const db = await getDb();
    const tx = db.transaction(["users", "posts", "preferences"], "readwrite");

    for (const user of users) {
      const existing = await tx.objectStore("users").get(user.id);
      if (!existing) {
        await tx.objectStore("users").put(user);
      }
    }

    const postsStore = tx.objectStore("posts");
    const currentPosts = await postsStore.getAll();
    const postById = new Map(currentPosts.map((post) => [post.id, normalizePostForDedup(post)]));
    const duplicateIndex = new Map<string, string>();
    postById.forEach((post) => {
      duplicateUrlKeys(post.canonicalUrl ?? post.url).forEach((key) => {
        if (!duplicateIndex.has(key)) duplicateIndex.set(key, post.id);
      });
    });

    for (const incoming of posts) {
      const sameId = postById.get(incoming.id);
      if (sameId) {
        const merged = mergeDuplicatePosts(sameId, incoming);
        postById.set(merged.id, merged);
        await postsStore.put(merged);
        continue;
      }

      const duplicateId = duplicateUrlKeys(incoming.canonicalUrl ?? incoming.url)
        .map((key) => duplicateIndex.get(key))
        .find(Boolean);

      if (duplicateId) {
        const base = postById.get(duplicateId);
        if (base) {
          const merged = mergeDuplicatePosts(base, incoming);
          postById.set(merged.id, merged);
          await postsStore.put(merged);
          duplicateUrlKeys(merged.canonicalUrl ?? merged.url).forEach((key) => duplicateIndex.set(key, merged.id));
        }
      } else {
        postById.set(incoming.id, incoming);
        await postsStore.put(incoming);
        duplicateUrlKeys(incoming.canonicalUrl ?? incoming.url).forEach((key) => duplicateIndex.set(key, incoming.id));
      }
    }

    for (const pref of preferences) {
      const existing = await tx.objectStore("preferences").get(pref.userId);
      if (!existing) {
        await tx.objectStore("preferences").put(pref);
      }
    }

    await tx.done;
    return;
  }

  const currentUsers = lsRead<User>(LS_KEYS.users);
  const currentPosts = lsRead<Post>(LS_KEYS.posts).map((post) => normalizePostForDedup(post));
  const currentPreferences = lsRead<UserPreferences>(LS_KEYS.preferences);

  const mergedUsers = [...currentUsers];
  users.forEach((u) => {
    if (!mergedUsers.some((current) => current.id === u.id)) mergedUsers.push(u);
  });

  const mergedPostsById = new Map<string, Post>(currentPosts.map((post) => [post.id, post]));
  const duplicateIndex = new Map<string, string>();
  mergedPostsById.forEach((post) => {
    duplicateUrlKeys(post.canonicalUrl ?? post.url).forEach((key) => {
      if (!duplicateIndex.has(key)) duplicateIndex.set(key, post.id);
    });
  });
  posts.forEach((incoming) => {
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
  const mergedPosts = Array.from(mergedPostsById.values());

  const mergedPreferences = [...currentPreferences];
  preferences.forEach((pref) => {
    if (!mergedPreferences.some((current) => current.userId === pref.userId)) {
      mergedPreferences.push(pref);
    }
  });

  lsWrite(LS_KEYS.users, mergedUsers);
  lsWrite(LS_KEYS.posts, mergedPosts);
  lsWrite(LS_KEYS.preferences, mergedPreferences);
};
