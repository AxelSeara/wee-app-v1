import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addPost,
  addUser,
  deletePostById,
  deleteUserById,
  exportAllData,
  getActiveUserId,
  getPreferences,
  getUserById,
  getUsers,
  importAllData,
  listPosts,
  listPostsByTopic,
  listPostsByUser,
  setActiveUserId,
  updateUser,
  updatePost,
  upsertPreferences
} from "./store";
import type { AppLanguage, ExportBundle, Post, SearchFilters, User, UserCommunityStats, UserPreferences } from "./types";
import { hashPassword, isStrongPassword, verifyPassword } from "./auth";
import { clamp, colorFromString, generateId, getInitials, normalizeSpace } from "./utils";

interface CreateOrLoginResult {
  user: User;
  isNewUser: boolean;
}

const PRIVACY_POLICY_VERSION = "2026-03-04";

export const DEFAULT_FILTERS: SearchFilters = {
  query: "",
  qualityLabel: "all",
  topic: "all",
  domain: "all"
};

const matchesQuery = (post: Post, query: string): boolean => {
  if (!query) return true;
  const normalized = normalizeSpace(query);
  return (
    post.normalizedText.includes(normalized) ||
    post.topics.some((topic) => topic.includes(normalized)) ||
    (post.sourceDomain ?? "").includes(normalized)
  );
};

const applyFilters = (
  posts: Post[],
  filters: SearchFilters,
  preferences?: UserPreferences
): Post[] =>
  posts.filter((post) => {
    if (filters.qualityLabel !== "all" && post.qualityLabel !== filters.qualityLabel) return false;
    if (filters.topic !== "all" && !post.topics.includes(filters.topic)) return false;
    if (filters.domain !== "all" && post.sourceDomain !== filters.domain) return false;
    if (!matchesQuery(post, filters.query)) return false;

    if (preferences) {
      if (preferences.blockedDomains.some((domain) => post.sourceDomain?.includes(domain))) return false;
      if (preferences.blockedKeywords.some((keyword) => post.normalizedText.includes(normalizeSpace(keyword)))) return false;
      if (preferences.preferredTopics.length > 0) {
        const hasPreferred = post.topics.some((topic) => preferences.preferredTopics.includes(topic));
        if (!hasPreferred) return false;
      }
    }

    return true;
  });

const levelFromPoints = (points: number): number => {
  if (points <= 0) return 1;
  return Math.max(1, Math.floor(Math.sqrt(points / 110)) + 1);
};

const pointsForLevel = (level: number): number => {
  const safeLevel = Math.max(1, level);
  return (safeLevel - 1) * (safeLevel - 1) * 110;
};

const USER_AURA_RULES = {
  min: 1000,
  max: 10000,
  start: 1000
} as const;

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

const bayesianMean = (
  sampleMean: number,
  sampleSize: number,
  priorMean: number,
  priorWeight: number
): number => (sampleMean * sampleSize + priorMean * priorWeight) / Math.max(1, sampleSize + priorWeight);

export const useAppData = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeUserId, setActiveUserIdState] = useState<string | null>(getActiveUserId());
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [fetchedUsers, fetchedPosts] = await Promise.all([getUsers(), listPosts()]);
    setUsers(fetchedUsers);
    setPosts(fetchedPosts);

    if (activeUserId) {
      const prefs = await getPreferences(activeUserId);
      setPreferences(prefs);
    } else {
      setPreferences(null);
    }

    setLoading(false);
  }, [activeUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeUser = useMemo(
    () => users.find((user) => user.id === activeUserId) ?? null,
    [users, activeUserId]
  );

  useEffect(() => {
    if (loading) return;
    if (users.length === 0) return;
    const hasAdmin = users.some((user) => user.role === "admin");
    if (hasAdmin) return;
    const firstUser = [...users].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!firstUser) return;
    void (async () => {
      await updateUser({ ...firstUser, role: "admin" });
      await reload();
    })();
  }, [users, loading, reload]);

  const loginWithUserId = useCallback((userId: string) => {
    setActiveUserId(userId);
    setActiveUserIdState(userId);
  }, []);

  const logout = useCallback(() => {
    setActiveUserId(null);
    setActiveUserIdState(null);
  }, []);

  const createOrLogin = useCallback(
    async (
      alias: string,
      password: string,
      avatarDataUrl?: string,
      language?: AppLanguage,
      acceptedPrivacy = false
    ): Promise<CreateOrLoginResult> => {
      const normalizedAlias = alias.trim().slice(0, 40);
      if (!normalizedAlias) {
        throw new Error("Alias requerido");
      }
      const cleanPassword = password.trim();
      if (!cleanPassword) {
        throw new Error("PASSWORD_REQUIRED");
      }
      const existing = users.find((user) => user.alias.toLowerCase() === normalizedAlias.toLowerCase());
      if (existing) {
        let updatedUser = existing;
        if (existing.passwordHash) {
          const valid = await verifyPassword(cleanPassword, existing.passwordHash);
          if (!valid) throw new Error("INVALID_PASSWORD");
          if (!existing.passwordHash.startsWith("pbkdf2$")) {
            updatedUser = {
              ...existing,
              passwordHash: await hashPassword(cleanPassword)
            };
          }
        } else {
          if (!isStrongPassword(cleanPassword)) throw new Error("WEAK_PASSWORD");
          updatedUser = {
            ...existing,
            passwordHash: await hashPassword(cleanPassword),
            role: existing.role ?? "member"
          };
        }

        const nextLanguage = language ?? updatedUser.language ?? "es";
        if ((updatedUser.language ?? "es") !== nextLanguage || updatedUser !== existing) {
          await updateUser({ ...updatedUser, language: nextLanguage });
          await reload();
          updatedUser = { ...updatedUser, language: nextLanguage };
        }
        loginWithUserId(updatedUser.id);
        return { user: updatedUser, isNewUser: false };
      }

      if (!isStrongPassword(cleanPassword)) throw new Error("WEAK_PASSWORD");
      const isFirstUser = users.length === 0;
      if (!acceptedPrivacy) {
        throw new Error("PRIVACY_CONSENT_REQUIRED");
      }

      const newUser: User = {
        id: generateId(),
        alias: normalizedAlias,
        passwordHash: await hashPassword(cleanPassword),
        role: isFirstUser ? "admin" : "member",
        language: language ?? "es",
        privacyConsentAt: Date.now(),
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
        avatarDataUrl,
        avatarColor: avatarDataUrl ? undefined : colorFromString(normalizedAlias),
        initials: getInitials(normalizedAlias),
        createdAt: Date.now()
      };

      await addUser(newUser);
      await reload();
      loginWithUserId(newUser.id);
      return { user: newUser, isNewUser: true };
    },
    [users, loginWithUserId, reload]
  );

  const createPost = useCallback(
    async (post: Post) => {
      await addPost(post);
      await reload();
    },
    [reload]
  );

  const savePost = useCallback(
    async (post: Post) => {
      await updatePost(post);
      await reload();
    },
    [reload]
  );

  const removePost = useCallback(
    async (postId: string) => {
      await deletePostById(postId);
      await reload();
    },
    [reload]
  );

  const removeComment = useCallback(
    async (postId: string, commentId: string) => {
      const post = posts.find((entry) => entry.id === postId);
      if (!post) return;
      const nextComments = (post.comments ?? []).filter((comment) => comment.id !== commentId);
      await updatePost({ ...post, comments: nextComments });
      await reload();
    },
    [posts, reload]
  );

  const updatePostPrimaryTopic = useCallback(
    async (postId: string, nextTopicRaw: string) => {
      const post = posts.find((entry) => entry.id === postId);
      if (!post) return;
      const nextTopic = normalizeSpace(nextTopicRaw).replace(/\s+/g, "-").slice(0, 42);
      if (!nextTopic) return;
      const restTopics = (post.topics ?? []).filter((topic) => topic !== nextTopic);
      await updatePost({ ...post, topics: [nextTopic, ...restTopics].slice(0, 6) });
      await reload();
    },
    [posts, reload]
  );

  const renameTopicAcrossPosts = useCallback(
    async (fromTopicRaw: string, toTopicRaw: string) => {
      const fromTopic = normalizeSpace(fromTopicRaw);
      const toTopic = normalizeSpace(toTopicRaw).replace(/\s+/g, "-").slice(0, 42);
      if (!fromTopic || !toTopic || fromTopic === toTopic) return;
      const impacted = posts.filter((post) => post.topics.includes(fromTopic));
      for (const post of impacted) {
        const nextTopics = post.topics.map((topic) => (topic === fromTopic ? toTopic : topic));
        const unique = Array.from(new Set(nextTopics));
        await updatePost({ ...post, topics: unique });
      }
      await reload();
    },
    [posts, reload]
  );

  const removeUser = useCallback(
    async (userId: string) => {
      const target = users.find((entry) => entry.id === userId);
      if (!target) return;
      const authoredPosts = posts.filter((post) => post.userId === userId);
      for (const post of authoredPosts) {
        await deletePostById(post.id);
      }
      const postsToClean = posts.filter((post) => post.userId !== userId);
      for (const post of postsToClean) {
        const nextComments = (post.comments ?? []).filter((comment) => comment.userId !== userId);
        const nextFeedbacks = (post.feedbacks ?? []).filter((feedback) => feedback.userId !== userId);
        const nextOpened = (post.openedByUserIds ?? []).filter((id) => id !== userId);
        const nextContributorUserIds = (post.contributorUserIds ?? [post.userId]).filter((id) => id !== userId);
        const nextContributorCounts = { ...(post.contributorCounts ?? {}) };
        delete nextContributorCounts[userId];
        const touched =
          nextComments.length !== (post.comments ?? []).length ||
          nextFeedbacks.length !== (post.feedbacks ?? []).length ||
          nextOpened.length !== (post.openedByUserIds ?? []).length ||
          nextContributorUserIds.length !== (post.contributorUserIds ?? [post.userId]).length ||
          Boolean(post.contributorCounts?.[userId]);
        if (!touched) continue;
        await updatePost({
          ...post,
          comments: nextComments,
          feedbacks: nextFeedbacks,
          openedByUserIds: nextOpened,
          contributorUserIds: nextContributorUserIds,
          contributorCounts: nextContributorCounts,
          shareCount: Object.values(nextContributorCounts).reduce((acc, value) => acc + value, 0)
        });
      }
      await deleteUserById(userId);
      await reload();
    },
    [users, posts, reload]
  );

  const updateUserAvatar = useCallback(
    async (userId: string, avatarDataUrl: string | undefined) => {
      const existing = users.find((user) => user.id === userId);
      if (!existing) return;

      const nextUser: User = {
        ...existing,
        avatarDataUrl,
        avatarColor: avatarDataUrl ? undefined : existing.avatarColor ?? colorFromString(existing.alias),
        initials: existing.initials ?? getInitials(existing.alias)
      };

      await updateUser(nextUser);
      await reload();
    },
    [users, reload]
  );

  const updateUserAlias = useCallback(
    async (userId: string, nextAlias: string) => {
      const existing = users.find((user) => user.id === userId);
      if (!existing) return;

      const clean = nextAlias.trim().slice(0, 40);
      if (!clean) return;

      let finalAlias = clean;
      let i = 2;
      while (
        users.some(
          (user) => user.id !== userId && user.alias.toLowerCase() === finalAlias.toLowerCase()
        )
      ) {
        finalAlias = `${clean}${i}`;
        i += 1;
      }

      const nextUser: User = {
        ...existing,
        alias: finalAlias,
        avatarColor: existing.avatarDataUrl ? undefined : colorFromString(finalAlias),
        initials: getInitials(finalAlias)
      };

      await updateUser(nextUser);
      await reload();
    },
    [users, reload]
  );

  const updateUserLanguage = useCallback(
    async (userId: string, language: AppLanguage) => {
      const existing = users.find((user) => user.id === userId);
      if (!existing) return;
      if ((existing.language ?? "es") === language) return;
      await updateUser({ ...existing, language });
      await reload();
    },
    [users, reload]
  );

  const updateUserRole = useCallback(
    async (userId: string, role: "admin" | "member") => {
      const target = users.find((user) => user.id === userId);
      if (!target) return;
      if ((target.role ?? "member") === role) return;

      if (role === "member") {
        const adminCount = users.filter((user) => user.role === "admin").length;
        if ((target.role ?? "member") === "admin" && adminCount <= 1) {
          throw new Error("LAST_ADMIN");
        }
      }

      await updateUser({ ...target, role });
      await reload();
    },
    [users, reload]
  );

  const updatePreferences = useCallback(
    async (next: UserPreferences) => {
      await upsertPreferences(next);
      setPreferences(next);
    },
    []
  );

  const getPostsByTopic = useCallback(async (topic: string) => listPostsByTopic(topic), []);
  const getPostsByUser = useCallback(async (userId: string) => listPostsByUser(userId), []);
  const getUser = useCallback(async (userId: string) => getUserById(userId), []);

  const filterPosts = useCallback(
    (filters: SearchFilters, applyPreferenceRules = true) =>
      applyFilters(posts, filters, applyPreferenceRules ? preferences ?? undefined : undefined),
    [posts, preferences]
  );

  const exportJson = useCallback(async (): Promise<ExportBundle> => exportAllData(), []);

  const importJson = useCallback(
    async (bundle: ExportBundle): Promise<void> => {
      await importAllData(bundle);
      await reload();
    },
    [reload]
  );

  const userQualityValueById = useMemo(() => {
    const value = new Map<string, number>();
    const postsByUser = new Map<string, Post[]>();
    posts.forEach((post) => {
      postsByUser.set(post.userId, [...(postsByUser.get(post.userId) ?? []), post]);
    });

    users.forEach((user) => {
      const userPosts = postsByUser.get(user.id) ?? [];
      if (userPosts.length === 0) {
        value.set(user.id, 40);
        return;
      }

      const aggregate = userPosts.reduce((acc, post) => {
        const labelBonus =
          post.qualityLabel === "high" ? 10 : post.qualityLabel === "medium" ? 4 : post.qualityLabel === "clickbait" ? -8 : -3;
        const duplicatePenalty =
          post.contributorCounts && post.contributorCounts[user.id] && post.contributorCounts[user.id] > 1
            ? (post.contributorCounts[user.id] - 1) * 6
            : 0;
        const evidencePenalty = post.flags.includes("no_source") ? 10 : post.flags.includes("unverified_claim") ? 6 : 0;
        return acc + post.qualityScore * 0.74 + post.interestScore * 0.16 + labelBonus - duplicatePenalty - evidencePenalty;
      }, 0);

      const rawMean = aggregate / userPosts.length;
      const blended = bayesianMean(rawMean, userPosts.length, 56, 4);
      const poorRate =
        userPosts.filter((post) => post.qualityScore < 50 || post.qualityLabel === "clickbait").length /
        Math.max(1, userPosts.length);
      const consistencyMultiplier = 1 - poorRate * 0.22;
      const score = Math.round(blended * consistencyMultiplier);
      value.set(user.id, clamp(score, 0, 100));
    });

    return value;
  }, [users, posts]);

  const userCommunityStatsById = useMemo(() => {
    const stats = new Map<string, UserCommunityStats>();
    const auraGivenByUser = new Map<string, number>();
    const commentAuraGivenByUser = new Map<string, number>();

    posts.forEach((post) => {
      (post.feedbacks ?? []).forEach((feedback) => {
        if (feedback.vote > 0) {
          auraGivenByUser.set(feedback.userId, (auraGivenByUser.get(feedback.userId) ?? 0) + 1);
        }
      });
      (post.comments ?? []).forEach((comment) => {
        (comment.auraUserIds ?? []).forEach((userId) => {
          commentAuraGivenByUser.set(userId, (commentAuraGivenByUser.get(userId) ?? 0) + 1);
        });
      });
    });

    users.forEach((user) => {
      const authoredPosts = posts.filter((post) => post.userId === user.id);
      const postCount = authoredPosts.length;
      const highQualityCount = authoredPosts.filter(
        (post) => post.qualityScore >= 75 && post.qualityLabel !== "clickbait"
      ).length;
      const authoredComments = posts.flatMap((post) =>
        (post.comments ?? []).filter((comment) => comment.userId === user.id)
      );

      const auraFromPostFeedback = authoredPosts.reduce((acc, post) => {
        return (
          acc +
          (post.feedbacks ?? []).reduce((sum, feedback) => sum + (feedback.vote > 0 ? 1 : -1), 0)
        );
      }, 0);

      const auraFromCommentFeedback = authoredComments.reduce((acc, comment) => {
        return acc + (comment.auraUserIds?.length ?? 0);
      }, 0);

      const auraReceived = auraFromPostFeedback + auraFromCommentFeedback;
      const auraGiven = (auraGivenByUser.get(user.id) ?? 0) + (commentAuraGivenByUser.get(user.id) ?? 0);

      const duplicatePenalty = authoredPosts.reduce((acc, post) => {
        const repeated = post.contributorCounts?.[user.id] ?? 1;
        return acc + Math.max(0, repeated - 1) * 7;
      }, 0);

      const qualityScore = userQualityValueById.get(user.id) ?? 40;
      const commentCount = authoredComments.length;
      const pointsRaw =
        postCount * 5 +
        highQualityCount * 24 +
        commentCount * 3 +
        auraReceived * 6 +
        auraGiven * 2 +
        qualityScore * 1.2 -
        duplicatePenalty;

      const points = Math.max(0, Math.round(pointsRaw));
      const level = levelFromPoints(points);
      const currentLevelPoints = pointsForLevel(level);
      const nextLevelPoints = pointsForLevel(level + 1);
      const levelProgress =
        nextLevelPoints > currentLevelPoints
          ? (points - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)
          : 1;

      const rankTitle =
        level >= 12 ? "Leyenda" :
        level >= 9 ? "Élite" :
        level >= 6 ? "Curador Pro" :
        level >= 4 ? "Colaborador" : "Inicial";

      const badges: string[] = [];
      if (highQualityCount >= 10) badges.push("Fuente fiable");
      if (commentCount >= 20) badges.push("Constructor de comunidad");
      if (auraReceived >= 40) badges.push("Pulso comunitario");
      if (qualityScore >= 80) badges.push("Señal fiable");

      stats.set(user.id, {
        userId: user.id,
        aura: auraReceived,
        points,
        level,
        rankTitle,
        badges,
        postCount,
        highQualityCount,
        commentCount,
        auraReceived,
        auraGiven,
        nextLevelPoints,
        levelProgress: Math.max(0, Math.min(1, levelProgress))
      });
    });

    return stats;
  }, [users, posts, userQualityValueById]);

  const userInfluenceAuraById = useMemo(() => {
    const value = new Map<string, number>();

    users.forEach((user) => {
      const authoredPosts = posts.filter((post) => post.userId === user.id);
      if (authoredPosts.length === 0) {
        value.set(user.id, USER_AURA_RULES.start);
        return;
      }

      const avgQuality = authoredPosts.reduce((acc, post) => acc + post.qualityScore, 0) / authoredPosts.length;
      const highQuality = authoredPosts.filter((post) => post.qualityScore >= 75 && post.qualityLabel !== "clickbait").length;
      const poorQuality = authoredPosts.filter((post) => post.qualityScore < 50 || post.qualityLabel === "clickbait").length;
      const postCount = authoredPosts.length;
      const duplicatePenalty = authoredPosts.reduce((acc, post) => {
        const repeated = post.contributorCounts?.[user.id] ?? 1;
        return acc + Math.max(0, repeated - 1);
      }, 0);

      const voteDelta = authoredPosts.reduce((acc, post) => {
        return acc + (post.feedbacks ?? []).reduce((sum, feedback) => sum + feedback.vote, 0);
      }, 0);

      const highQualityRate = highQuality / Math.max(1, postCount);
      const poorQualityRate = poorQuality / Math.max(1, postCount);
      const duplicateRate = duplicatePenalty / Math.max(1, postCount);
      const voteDeltaPerPost = voteDelta / Math.max(1, postCount);

      const qualitySignal =
        avgQuality * 0.46 +
        highQualityRate * 52 -
        poorQualityRate * 34 -
        duplicateRate * 24;

      const qualityLift = 2500 * sigmoid((qualitySignal - 52) / 10.5);
      const volumeLift = 900 * (1 - Math.exp(-postCount / 14));
      const voteLift = 1100 * Math.tanh(voteDeltaPerPost / 2.4);
      const duplicateHit = duplicatePenalty * 35;

      const raw = USER_AURA_RULES.start + qualityLift + volumeLift + voteLift - duplicateHit;
      value.set(user.id, clamp(Math.round(raw), USER_AURA_RULES.min, USER_AURA_RULES.max));
    });

    return value;
  }, [users, posts]);

  return {
    users,
    posts,
    activeUser,
    activeUserId,
    loading,
    preferences,
    reload,
    loginWithUserId,
    createOrLogin,
    logout,
    createPost,
    savePost,
    removePost,
    removeComment,
    removeUser,
    updatePostPrimaryTopic,
    renameTopicAcrossPosts,
    updateUserAvatar,
    updateUserAlias,
    updateUserLanguage,
    updateUserRole,
    getPostsByTopic,
    getPostsByUser,
    getUser,
    filterPosts,
    updatePreferences,
    exportJson,
    importJson,
    userQualityValueById,
    userCommunityStatsById,
    userInfluenceAuraById
  };
};
