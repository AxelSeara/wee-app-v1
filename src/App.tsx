import { AnimatePresence } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppFooter } from "./components/AppFooter";
import { AppSkeleton } from "./components/AppSkeleton";
import { PageTransition } from "./components/PageTransition";
import { ShareLinkModal } from "./components/ShareLinkModal";
import { Toast } from "./components/Toast";
import { useAppData } from "./lib/appData";
import { classifyPost } from "./lib/classify";
import { I18nContext, normalizeLanguage, pick } from "./lib/i18n";
import { deriveTitleFromUrl, displayTitle, isUnusableTitle } from "./lib/presentation";
import { enrichUrl } from "./lib/enrich";
import { NotificationsContext, type AppNotification } from "./lib/notifications";
import { trackComment, trackOpenSource, trackPageView, trackRate, trackShare } from "./lib/usageAnalytics";
import { listPosts as listPostsFromStore, reportPostById } from "./lib/store";
import { consumeRateLimit } from "./lib/rateLimit";
import type { AuraRulesetVersion, ExportBundle } from "./lib/types";
import { canonicalizeUrl, duplicateUrlKeys, generateId, normalizeSpace, sha256Hex } from "./lib/utils";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RequireAuth } from "./pages/RequireAuth";
import { SettingsPage } from "./pages/SettingsPage";
import { SharePage } from "./pages/SharePage";
import { TopicPage } from "./pages/TopicPage";
import { UserPostsPage } from "./pages/UserPostsPage";
import { CommunityPage } from "./pages/CommunityPage";

const AppRoutes = () => {
  const location = useLocation();
  const {
    users,
    posts,
    activeUser,
    selectedCommunity,
    communityRulesText,
    communityMembers,
    preferences,
    loading,
    backendError,
    createOrLogin,
    createCommunityFlow,
    previewCommunityInvite,
    confirmCommunityInvite,
    leaveCurrentCommunity,
    loadCommunityOverview,
    loginWithUserId,
    logout,
    createPost,
    savePost,
    removePost,
    removeComment,
    removeUser,
    updateUserAvatar,
    updateUserAlias,
    updateUserLanguage,
    updatePostPrimaryTopic,
    filterPosts,
    updatePreferences,
    exportJson,
    importJson,
    userQualityValueById,
    userCommunityStatsById,
    userInfluenceAuraById
  } = useAppData();

  const [toast, setToast] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [notificationsReadAt, setNotificationsReadAt] = useState(0);
  const language = normalizeLanguage(activeUser?.language);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!activeUser) return;
    void loadCommunityOverview().catch(() => undefined);
  }, [activeUser, loadCommunityOverview]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.pathname]);

  const knownTopics = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.topics))).sort(),
    [posts]
  );
  const memberRemovedMode = import.meta.env.VITE_MEMBER_REMOVED_POSTS_MODE === "collapsed" ? "collapsed" : "hidden";
  const postsForViewer = useMemo(() => {
    if (!activeUser) return posts;
    if (activeUser.role === "admin") return posts;
    return posts
      .filter((post) => (memberRemovedMode === "hidden" ? post.status !== "removed" : true))
      .map((post) => {
        if (memberRemovedMode === "collapsed" && post.status === "removed") {
          return {
            ...post,
            status: "collapsed" as const,
            title: pick(language, "Contenido moderado", "Moderated content"),
            text: pick(language, "Este post fue moderado por administración.", "This post was moderated by admins."),
            previewTitle: undefined,
            previewDescription: undefined,
            previewImageUrl: undefined,
            url: undefined
          };
        }
        return post;
      });
  }, [posts, activeUser, memberRemovedMode, language]);
  const notificationsStorageKey = activeUser ? `wee:notifications:last-read:${activeUser.id}` : "";
  useEffect(() => {
    if (!activeUser) {
      setNotificationsReadAt(0);
      return;
    }
    try {
      const stored = Number(localStorage.getItem(notificationsStorageKey) ?? "0");
      setNotificationsReadAt(Number.isFinite(stored) ? stored : 0);
    } catch {
      setNotificationsReadAt(0);
    }
  }, [activeUser, notificationsStorageKey]);

  const notifications = useMemo((): AppNotification[] => {
    if (!activeUser) return [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const rows: AppNotification[] = [];

    posts.forEach((post) => {
      if (post.userId !== activeUser.id) return;
      const postTitle = displayTitle(post);

      (post.feedbacks ?? []).forEach((feedback) => {
        if (feedback.userId === activeUser.id) return;
        const actor = usersById.get(feedback.userId);
        rows.push({
          id: `${post.id}:vote:${feedback.userId}:${feedback.votedAt}`,
          type: "post_aura",
          postId: post.id,
          postTitle,
          actorId: feedback.userId,
          actorAlias: actor?.alias ?? pick(language, "Usuario", "User", "Usuario"),
          createdAt: feedback.votedAt ?? post.createdAt,
          vote: feedback.vote
        });
      });

      (post.comments ?? []).forEach((comment) => {
        if (comment.userId === activeUser.id) return;
        const actor = usersById.get(comment.userId);
        rows.push({
          id: `${post.id}:comment:${comment.id}`,
          type: "post_comment",
          postId: post.id,
          postTitle,
          actorId: comment.userId,
          actorAlias: actor?.alias ?? pick(language, "Usuario", "User", "Usuario"),
          createdAt: comment.createdAt
        });
      });
    });

    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 60);
  }, [activeUser, posts, users, language]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => notification.createdAt > notificationsReadAt).length,
    [notifications, notificationsReadAt]
  );

  const markAllNotificationsAsRead = (): void => {
    if (!activeUser) return;
    const markAt = Date.now();
    setNotificationsReadAt(markAt);
    try {
      localStorage.setItem(notificationsStorageKey, String(markAt));
    } catch {
      // ignore storage restrictions
    }
  };
  const duplicateLookup = useMemo(() => {
    const map = new Map<string, (typeof posts)[number]>();
    posts.forEach((post) => {
      duplicateUrlKeys(post.canonicalUrl ?? post.url).forEach((key) => {
        if (!map.has(key)) map.set(key, post);
      });
    });
    return map;
  }, [posts]);

  const sourceOpenSessionKey = (userId: string, postId: string): string =>
    `wee:source-opened:${userId}:${postId}`;
  const markSourceOpenedSession = (userId: string, postId: string): void => {
    try {
      window.sessionStorage.setItem(sourceOpenSessionKey(userId, postId), "1");
    } catch {
      // ignore storage restrictions
    }
  };
  const hasSourceOpenedSession = (userId: string, postId: string): boolean => {
    try {
      return window.sessionStorage.getItem(sourceOpenSessionKey(userId, postId)) === "1";
    } catch {
      return false;
    }
  };

  const onExport = async (): Promise<void> => {
    const data = await exportJson();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `news-curation-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setToast(pick(language, "Copia de seguridad exportada en JSON.", "Backup exported as JSON."));
    window.setTimeout(() => setToast(null), 1800);
  };

  const onImport = async (file: File): Promise<void> => {
    const text = await file.text();
    const bundle = JSON.parse(text) as ExportBundle;
    await importJson(bundle);
    setToast(pick(language, "Importación completada. Ya tienes los datos cargados.", "Import completed. Your data is now loaded."));
    window.setTimeout(() => setToast(null), 1800);
  };

  const onDeleteMyData = async (): Promise<void> => {
    if (!activeUser) return;
    const userId = activeUser.id;
    await removeUser(userId);
    logout();
    showToast(pick(language, "Tus datos se han eliminado.", "Your data has been deleted.", "Elimináronse os teus datos."));
  };

  const findDuplicatePost = (url: string) => {
    const incomingKeys = duplicateUrlKeys(url);
    if (!incomingKeys.length) return undefined;
    for (const key of incomingKeys) {
      const found = duplicateLookup.get(key);
      if (found) return found;
    }
    return undefined;
  };

  const getContentHashFromFlags = (flags: string[] | undefined): string | undefined => {
    const entry = (flags ?? []).find((flag) => flag.startsWith("content_hash:"));
    return entry?.slice("content_hash:".length);
  };

  const findDuplicateByContentHash = (contentHash: string) =>
    posts.find((post) => getContentHashFromFlags(post.flags) === contentHash);

  const rulesetVersion: AuraRulesetVersion =
    import.meta.env.VITE_AURA_RULESET_VERSION === "v2" ? "v2" : "v1";
  const topicRulesetVersion = import.meta.env.VITE_TOPIC_RULESET_VERSION === "v2" ? "v2" : "v1";

  const getDuplicatePreview = (
    url: string
  ): { exists: boolean; sameUser: boolean; contributors: number; totalShares: number } => {
    if (!activeUser) return { exists: false, sameUser: false, contributors: 0, totalShares: 0 };
    const existing = findDuplicatePost(url);
    if (!existing) return { exists: false, sameUser: false, contributors: 0, totalShares: 0 };
    const counts = existing.contributorCounts ?? { [existing.userId]: existing.shareCount ?? 1 };
    return {
      exists: true,
      sameUser: (counts[activeUser.id] ?? 0) > 0,
      contributors: Object.keys(counts).length,
      totalShares: Object.values(counts).reduce((acc, value) => acc + value, 0)
    };
  };

  const onShareUrl = async (
    url: string,
    options?: { forceTopic?: string }
  ): Promise<{ mode: "created" | "merged" | "penalized"; message: string; debugBreakdown?: unknown; topicDebug?: unknown }> => {
    if (!activeUser) return { mode: "created", message: pick(language, "Inicia sesión para compartir enlaces.", "Sign in to share links.") };
    const postLimit = await consumeRateLimit("create_post", activeUser.id);
    if (!postLimit.allowed) {
      return {
        mode: "created",
        message: pick(
          language,
          `Has alcanzado el límite de publicación. Reintenta en ${postLimit.retryAfterSec}s.`,
          `Posting rate limit reached. Try again in ${postLimit.retryAfterSec}s.`
        )
      };
    }

    const canonical = canonicalizeUrl(url);
    const existing = findDuplicatePost(url);
    const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";

    if (existing) {
      const counts = { ...(existing.contributorCounts ?? { [existing.userId]: existing.shareCount ?? 1 }) };
      counts[activeUser.id] = (counts[activeUser.id] ?? 0) + 1;
      const contributorUserIds = Array.from(new Set([...(existing.contributorUserIds ?? [existing.userId]), activeUser.id]));
      const shareCount = Object.values(counts).reduce((acc, value) => acc + value, 0);
      const sameUserDuplicate = counts[activeUser.id] > 1;
      const feedbacks = existing.feedbacks ?? [];
      const hasFeedbackFromSharer = feedbacks.some((entry) => entry.userId === activeUser.id);
      const nextFeedbacks = hasFeedbackFromSharer
        ? feedbacks
        : [...feedbacks, { userId: activeUser.id, vote: 1 as const, votedAt: Date.now() }];

      const forcedTopic = options?.forceTopic?.trim().toLowerCase().replace(/\s+/g, "-");
      const nextTopics =
        forcedTopic && !existing.topics.includes(forcedTopic)
          ? [forcedTopic, ...existing.topics].slice(0, 6)
          : existing.topics;
      await savePost({
        ...existing,
        canonicalUrl: canonical ?? existing.canonicalUrl,
        contributorCounts: counts,
        contributorUserIds,
        shareCount,
        feedbacks: nextFeedbacks,
        topics: nextTopics,
        rationale: sameUserDuplicate
          ? existing.rationale.includes("Enlace repetido por el mismo usuario; se aplica penalización interna")
            ? existing.rationale
            : [...existing.rationale, "Enlace repetido por el mismo usuario; se aplica penalización interna"]
          : existing.rationale
      });

      trackShare({
        mode: sameUserDuplicate ? "penalized" : "merged",
        sourceDomain: existing.sourceDomain,
        primaryTopic: existing.topics?.[0]
      });

      return {
        mode: sameUserDuplicate ? "penalized" : "merged",
        message: sameUserDuplicate
          ? pick(language, "Ya habías compartido este enlace. Lo mantenemos en el mismo hilo para no duplicar y mantener el contexto.", "You already shared this link. We keep it in the same thread to avoid duplicates and keep context.")
          : pick(language, `Este enlace ya existía: lo sumamos al mismo hilo (${contributorUserIds.length} colaboradores).`, `This link already existed: merged into the same thread (${contributorUserIds.length} contributors).`)
      };
    }

    const createdAt = Date.now();
    const metadata = await enrichUrl(url);
    const safeMetadataTitle = metadata.title && !isUnusableTitle(metadata.title) ? metadata.title : undefined;
    const derivedTitle = safeMetadataTitle ?? deriveTitleFromUrl(url) ?? pick(language, "Noticia compartida", "Shared post");
    const description = metadata.description;
    const contentHash = await sha256Hex(normalizeSpace(`${derivedTitle ?? ""} ${description ?? ""}`));
    const duplicateByContent = findDuplicateByContentHash(contentHash);
    if (duplicateByContent) {
      const counts = { ...(duplicateByContent.contributorCounts ?? { [duplicateByContent.userId]: duplicateByContent.shareCount ?? 1 }) };
      counts[activeUser.id] = (counts[activeUser.id] ?? 0) + 1;
      const contributorUserIds = Array.from(new Set([...(duplicateByContent.contributorUserIds ?? [duplicateByContent.userId]), activeUser.id]));
      const shareCount = Object.values(counts).reduce((acc, value) => acc + value, 0);
      const sameUserDuplicate = counts[activeUser.id] > 1;

      await savePost({
        ...duplicateByContent,
        canonicalUrl: canonical ?? duplicateByContent.canonicalUrl,
        contributorCounts: counts,
        contributorUserIds,
        shareCount,
        rationale: sameUserDuplicate
          ? duplicateByContent.rationale.includes("Duplicado por hash de contenido; se aplica penalización interna")
            ? duplicateByContent.rationale
            : [...duplicateByContent.rationale, "Duplicado por hash de contenido; se aplica penalización interna"]
          : duplicateByContent.rationale
      });

      trackShare({
        mode: sameUserDuplicate ? "penalized" : "merged",
        sourceDomain: duplicateByContent.sourceDomain,
        primaryTopic: duplicateByContent.topics?.[0]
      });

      return {
        mode: sameUserDuplicate ? "penalized" : "merged",
        message: pick(
          language,
          `Este contenido ya existía en otro enlace. Lo unimos al mismo hilo (${contributorUserIds.length} colaboradores).`,
          `This content already existed under another link. Merged into the same thread (${contributorUserIds.length} contributors).`
        )
      };
    }

    const classified = classifyPost(
      {
        url,
        title: derivedTitle,
        text: description,
        rulesetVersion,
        topicRulesetVersion,
        debug: debugMode,
        metadata: {
          publisher: metadata.publisher,
          author: metadata.author,
          schemaTypes: metadata.schemaTypes,
          hasImprintOrContact: metadata.hasImprintOrContact,
          outboundUrls: metadata.outboundUrls,
          bodyText: metadata.bodyText,
          hasOverlayPopup: metadata.hasOverlayPopup,
          adLikeNodeRatio: metadata.adLikeNodeRatio,
          publishedAt: metadata.publishedAt,
          articleSection: metadata.articleSection,
          newsKeywords: metadata.newsKeywords,
          parselySection: metadata.parselySection,
          sailthruTags: metadata.sailthruTags,
          breadcrumbs: metadata.breadcrumbs,
          relTags: metadata.relTags,
          jsonLdSections: metadata.jsonLdSections,
          jsonLdKeywords: metadata.jsonLdKeywords,
          jsonLdAbout: metadata.jsonLdAbout,
          jsonLdGenre: metadata.jsonLdGenre,
          jsonLdIsPartOf: metadata.jsonLdIsPartOf,
          duplicateSignals: {
            canonicalExists: Boolean(existing),
            contentHashExists: Boolean(duplicateByContent)
          }
        }
      },
      createdAt
    );
    const forcedTopic = options?.forceTopic?.trim().toLowerCase().replace(/\s+/g, "-");
    const finalTopics =
      forcedTopic && !classified.topics.includes(forcedTopic)
        ? [forcedTopic, ...classified.topics].slice(0, 6)
        : classified.topics;

    await createPost({
      id: generateId(),
      userId: activeUser.id,
      createdAt,
      canonicalUrl: canonical,
      url,
      title: derivedTitle,
      text: description,
      previewTitle: safeMetadataTitle,
      previewDescription: metadata.description,
      previewImageUrl: metadata.imageUrl,
      previewSiteName: metadata.siteName,
      sourceDomain: classified.sourceDomain,
      extractedHosts: classified.extractedHosts,
      shareCount: 1,
      contributorUserIds: [activeUser.id],
      contributorCounts: { [activeUser.id]: 1 },
      feedbacks: [{ userId: activeUser.id, vote: 1 as const, votedAt: createdAt }],
      topics: finalTopics,
      subtopics: classified.subtopics,
      topicV2: classified.topicV2,
      topicCandidatesV2: classified.topicCandidatesV2,
      topicExplanationV2: classified.topicExplanationV2,
      topicVersion: classified.topicVersion,
      qualityLabel: classified.qualityLabel,
      qualityScore: classified.qualityScore,
      interestScore: classified.interestScore,
      flags: Array.from(new Set([...classified.flags, `content_hash:${contentHash}`])),
      rationale: classified.rationale,
      normalizedText: classified.normalizedText
    });

    if (debugMode && classified.debugBreakdown) {
      const payload = {
        url,
        domain: classified.sourceDomain ?? "unknown",
        aura: classified.interestScore,
        fired_rules: classified.debugBreakdown.firedRules
      };
      console.info("aura_index_debug", payload);
      (window as Window & { __WEE_LAST_AURA_DEBUG__?: unknown }).__WEE_LAST_AURA_DEBUG__ = classified.debugBreakdown;
    }
    if (classified.topicExplanationV2) {
      const topicPayload = {
        url,
        domain: classified.sourceDomain ?? "unknown",
        topic_v2: classified.topicV2 ?? "general",
        candidates_top3: (classified.topicCandidatesV2 ?? []).slice(0, 3),
        fired_signals: classified.topicExplanationV2.reasons.slice(0, 8).map((reason) => reason.signal)
      };
      console.info("topic_classification_v2", topicPayload);
      if (debugMode) {
        (window as Window & { __WEE_LAST_TOPIC_DEBUG__?: unknown }).__WEE_LAST_TOPIC_DEBUG__ = classified.topicExplanationV2;
      }
    }

    trackShare({
      mode: "created",
      sourceDomain: classified.sourceDomain,
      primaryTopic: classified.topics[0]
    });

    return {
      mode: "created",
      message: pick(
        language,
        `Publicado en ${finalTopics[0] ?? "misc"} · Aura ${classified.interestScore}.`,
        `Posted in ${finalTopics[0] ?? "misc"} · Aura ${classified.interestScore}.`,
        `Publicado en ${finalTopics[0] ?? "misc"} · Aura ${classified.interestScore}.`
      ),
      debugBreakdown: debugMode ? classified.debugBreakdown : undefined,
      topicDebug: debugMode
        ? {
            topic_v2: classified.topicV2,
            topic_candidates_v2: classified.topicCandidatesV2,
            topic_explanation_v2: classified.topicExplanationV2
          }
        : undefined
    };
  };

  const onQuickShare = async (url: string): Promise<void> => {
    const result = await onShareUrl(url);
    showToast(result.message);
  };

  const onOpenExternalSource = async (postId: string): Promise<void> => {
    if (!activeUser) return;
    markSourceOpenedSession(activeUser.id, postId);
    const post = posts.find((entry) => entry.id === postId) ?? (await listPostsFromStore()).find((entry) => entry.id === postId);
    if (!post) return;
    const openedBy = new Set(post.openedByUserIds ?? []);
    openedBy.add(activeUser.id);
    try {
      await savePost({ ...post, openedByUserIds: Array.from(openedBy) });
    } catch {
      // Keep UX unblocked: session mark is enough for local gating in this tab.
    }
    trackOpenSource({ sourceDomain: post.sourceDomain, primaryTopic: post.topics?.[0] });
  };

  const onRatePost = async (postId: string, vote: 1 | -1): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser) return { ok: false, message: pick(language, "Inicia sesión para votar.", "Sign in to vote.") };
    const voteLimit = await consumeRateLimit("vote_post", activeUser.id);
    if (!voteLimit.allowed) {
      return {
        ok: false,
        message: pick(
          language,
          `Límite de votos alcanzado. Reintenta en ${voteLimit.retryAfterSec}s.`,
          `Vote rate limit reached. Try again in ${voteLimit.retryAfterSec}s.`
        )
      };
    }
    let post = posts.find((entry) => entry.id === postId);
    if (!post) return { ok: false, message: pick(language, "No encontramos esta noticia.", "We could not find this post.") };

    let opened = (post.openedByUserIds ?? []).includes(activeUser.id) || hasSourceOpenedSession(activeUser.id, postId);
    if (!opened) {
      // Avoid race condition: source can be opened but React state may still be stale.
      const latest = (await listPostsFromStore()).find((entry) => entry.id === postId);
      if (latest) {
        post = latest;
        opened = (latest.openedByUserIds ?? []).includes(activeUser.id) || hasSourceOpenedSession(activeUser.id, postId);
      }
    }

    if (!opened) {
      return { ok: false, message: pick(language, "Antes de votar, abre la fuente.", "Open the source before voting.") };
    }

    const feedbacks = post.feedbacks ?? [];
    const existing = feedbacks.find((item) => item.userId === activeUser.id);
    const nextFeedbacks = existing
      ? feedbacks.map((item) => (item.userId === activeUser.id ? { ...item, vote, votedAt: Date.now() } : item))
      : [...feedbacks, { userId: activeUser.id, vote, votedAt: Date.now() }];

    await savePost({ ...post, feedbacks: nextFeedbacks });
    trackRate({ vote, sourceDomain: post.sourceDomain, primaryTopic: post.topics?.[0] });
    return { ok: true, message: vote > 0 ? pick(language, "Voto guardado. Aura al alza.", "Vote saved. Aura is rising.") : pick(language, "Voto guardado. Aura a la baja.", "Vote saved. Aura is dropping.") };
  };

  const onAddComment = async (
    postId: string,
    text: string
  ): Promise<{ ok: boolean; message: string; post?: (typeof posts)[number] }> => {
    if (!activeUser) return { ok: false, message: pick(language, "Inicia sesión para comentar.", "Sign in to comment.") };
    const commentLimit = await consumeRateLimit("create_comment", activeUser.id);
    if (!commentLimit.allowed) {
      return {
        ok: false,
        message: pick(
          language,
          `Límite de comentarios alcanzado. Reintenta en ${commentLimit.retryAfterSec}s.`,
          `Comment rate limit reached. Try again in ${commentLimit.retryAfterSec}s.`
        )
      };
    }
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return { ok: false, message: pick(language, "No encontramos esta noticia.", "We could not find this post.") };
    const clean = text.trim().slice(0, 320);
    if (!clean) return { ok: false, message: pick(language, "Escribe algo antes de enviar.", "Write something before sending.") };

    const nextPost = {
      ...post,
      comments: [
        ...(post.comments ?? []),
        {
          id: generateId(),
          userId: activeUser.id,
          text: clean,
          createdAt: Date.now(),
          auraUserIds: []
        }
      ]
    };
    await savePost(nextPost);
    trackComment({ sourceDomain: post.sourceDomain, primaryTopic: post.topics?.[0], length: clean.length });
    return { ok: true, message: pick(language, "Comentario enviado. Hilo actualizado.", "Comment posted. Thread updated."), post: nextPost };
  };

  const onVoteCommentAura = async (
    postId: string,
    commentId: string
  ): Promise<{ ok: boolean; message: string; post?: (typeof posts)[number] }> => {
    if (!activeUser) return { ok: false, message: pick(language, "Inicia sesión para valorar comentarios.", "Sign in to rate comments.") };
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return { ok: false, message: pick(language, "No encontramos esta noticia.", "We could not find this post.") };

    const comments = post.comments ?? [];
    const target = comments.find((item) => item.id === commentId);
    if (!target) return { ok: false, message: pick(language, "No encontramos ese comentario.", "We could not find that comment.") };

    const voted = new Set(target.auraUserIds ?? []);
    const hasVoted = voted.has(activeUser.id);
    if (hasVoted) {
      voted.delete(activeUser.id);
    } else {
      voted.add(activeUser.id);
    }

    const nextComments = comments.map((item) =>
      item.id === commentId ? { ...item, auraUserIds: Array.from(voted) } : item
    );

    const nextPost = { ...post, comments: nextComments };
    await savePost(nextPost);
    return {
      ok: true,
      message: hasVoted
        ? pick(language, "Has retirado tu aura.", "Aura removed.")
        : pick(language, "Aura enviada. Este comentario gana visibilidad.", "Aura sent. This comment gets more visibility."),
      post: nextPost
    };
  };

  const onAdminDeleteComment = async (
    postId: string,
    commentId: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    const post = posts.find((entry) => entry.id === postId);
    const target = post?.comments?.find((comment) => comment.id === commentId);
    if (!target) {
      return { ok: false, message: pick(language, "No encontramos ese comentario.", "We could not find that comment.") };
    }
    if (target.userId !== activeUser.id) {
      return {
        ok: false,
        message: pick(
          language,
          "Con el SQL v2 actual, solo puedes eliminar tus propios comentarios.",
          "With current SQL v2, you can only delete your own comments."
        )
      };
    }
    await removeComment(postId, commentId);
    return { ok: true, message: pick(language, "Comentario eliminado.", "Comment deleted.") };
  };

  const onAdminDeletePost = async (postId: string): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return { ok: false, message: pick(language, "No encontramos esta noticia.", "We could not find this post.") };
    if (post.userId !== activeUser.id) {
      return {
        ok: false,
        message: pick(
          language,
          "Con el SQL v2 actual, solo puedes eliminar noticias propias.",
          "With current SQL v2, you can only delete your own posts."
        )
      };
    }
    await removePost(postId);
    return { ok: true, message: pick(language, "Noticia eliminada.", "Post deleted.") };
  };

  const onReportPost = async (postId: string, reason: string): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser) return { ok: false, message: pick(language, "Inicia sesión para reportar.", "Sign in to report.") };
    const cleanReason = reason.trim().slice(0, 280);
    if (!cleanReason) {
      return { ok: false, message: pick(language, "Indica un motivo breve.", "Please provide a short reason.") };
    }
    try {
      await reportPostById(postId, activeUser.id, cleanReason);
      return { ok: true, message: pick(language, "Reporte enviado. Gracias por cuidar la comunidad.", "Report sent. Thanks for helping the community.") };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("duplicate")) {
        return { ok: false, message: pick(language, "Ya habías reportado esta publicación.", "You already reported this post.") };
      }
      return { ok: false, message: pick(language, "No pudimos enviar el reporte ahora.", "Could not send report right now.") };
    }
  };

  const onAdminModeratePost = async (
    postId: string,
    status: "active" | "collapsed" | "removed",
    reason: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return { ok: false, message: pick(language, "No encontramos esta noticia.", "We could not find this post.") };
    const trimmedReason = reason.trim().slice(0, 220);
    const moderated = {
      ...post,
      status,
      removedBy: status === "active" ? undefined : activeUser.id,
      removedAt: status === "active" ? undefined : Date.now(),
      removedReason: status === "active" ? undefined : trimmedReason || undefined
    };
    await savePost(moderated);
    return {
      ok: true,
      message:
        status === "active"
          ? pick(language, "Publicación reactivada.", "Post reactivated.")
          : status === "collapsed"
            ? pick(language, "Publicación colapsada.", "Post collapsed.")
            : pick(language, "Publicación retirada.", "Post removed.")
    };
  };

  const onAdminUpdatePostTopic = async (
    postId: string,
    nextTopic: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    if (!nextTopic.trim()) {
      return { ok: false, message: pick(language, "Tema no válido.", "Invalid topic.") };
    }
    const post = posts.find((entry) => entry.id === postId);
    if (!post) return { ok: false, message: pick(language, "No encontramos esta noticia.", "We could not find this post.") };
    if (post.userId !== activeUser.id) {
      return {
        ok: false,
        message: pick(
          language,
          "Con el SQL v2 actual, solo puedes editar temas de noticias propias.",
          "With current SQL v2, you can only edit topics on your own posts."
        )
      };
    }
    await updatePostPrimaryTopic(postId, nextTopic);
    return { ok: true, message: pick(language, "Tema de noticia actualizado.", "Post topic updated.") };
  };

  const onAddPostTopic = async (
    postId: string,
    nextTopicRaw: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser) {
      return { ok: false, message: pick(language, "Inicia sesión para editar temas.", "Sign in to edit topics.") };
    }
    const post = posts.find((entry) => entry.id === postId);
    if (!post) {
      return { ok: false, message: pick(language, "No encontramos esta noticia.", "We could not find this post.") };
    }
    const nextTopic = normalizeSpace(nextTopicRaw).replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 36);
    if (!nextTopic) {
      return { ok: false, message: pick(language, "Tema no válido.", "Invalid topic.") };
    }
    if (post.topics.includes(nextTopic)) {
      return { ok: false, message: pick(language, "Ese tema ya está añadido.", "That topic is already added.") };
    }
    if (post.userId !== activeUser.id) {
      return {
        ok: false,
        message: pick(
          language,
          "Con el SQL v2 actual, solo puedes añadir temas en noticias propias.",
          "With current SQL v2, you can only add topics on your own posts."
        )
      };
    }
    const nextTopics = [nextTopic, ...post.topics].slice(0, 6);
    await savePost({
      ...post,
      topics: nextTopics,
      rationale: post.rationale.includes(`Tema añadido por usuarios: ${nextTopic}`)
        ? post.rationale
        : [...post.rationale, `Tema añadido por usuarios: ${nextTopic}`]
    });
    return { ok: true, message: pick(language, "Tema añadido a la noticia.", "Topic added to post.") };
  };

  const onAdminRenameTopic = async (
    fromTopic: string,
    toTopic: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    if (!fromTopic.trim() || !toTopic.trim() || fromTopic.trim() === toTopic.trim()) {
      return { ok: false, message: pick(language, "Tema no válido.", "Invalid topic.") };
    }
    return {
      ok: false,
      message: pick(
        language,
        "Renombrar temas globalmente requiere permisos backend adicionales (admin SQL v3).",
        "Global topic rename requires additional backend permissions (admin SQL v3)."
      )
    };
  };

  const onAdminDeleteUser = async (userId: string): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    if (userId === activeUser.id) {
      return { ok: false, message: pick(language, "No puedes eliminar tu propio usuario admin.", "You cannot delete your own admin user.") };
    }
    return {
      ok: false,
      message: pick(
        language,
        "Eliminar otros usuarios requiere permisos backend adicionales (admin SQL v3).",
        "Deleting other users requires additional backend permissions (admin SQL v3)."
      )
    };
  };

  const onAdminSetUserRole = async (
    userId: string,
    role: "admin" | "member"
  ): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    return {
      ok: false,
      message: pick(
        language,
        "Cambiar roles requiere permisos backend adicionales (admin SQL v3).",
        "Changing roles requires additional backend permissions (admin SQL v3)."
      )
    };
  };

  const showToast = (message: string): void => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  };

  if (loading) {
    return (
      <I18nContext.Provider value={{ language }}>
        <NotificationsContext.Provider
          value={{
            notifications: [],
            unreadCount: 0,
            lastReadAt: 0,
            markAllAsRead: () => {}
          }}
        >
          <AppSkeleton />
          <p className="loading-caption">{pick(language, "Cargando tu comunidad...", "Loading your community...")}</p>
        </NotificationsContext.Provider>
      </I18nContext.Provider>
    );
  }

  if (backendError) {
    const backendErrorMessage =
      backendError === "BACKEND_CONFIG_MISSING"
        ? pick(
            language,
            "Este despliegue exige backend remoto y no tiene configuración de Supabase. Revisa variables VITE_SUPABASE_* en Vercel.",
            "This deployment requires remote backend but Supabase is not configured. Check VITE_SUPABASE_* variables in Vercel."
          )
        : backendError === "BACKEND_AUTH_FAILED"
          ? pick(
              language,
              "No tenemos permisos para acceder al backend. Revisa claves públicas y sesión de Supabase.",
              "Backend access is not authorized. Check Supabase public keys and session."
            )
          : backendError === "BACKEND_UNREACHABLE"
            ? pick(
                language,
                "No pudimos conectar con el backend. Revisa red, proyecto Supabase y Edge Functions.",
                "Could not connect to backend. Check network, Supabase project and Edge Functions."
              )
            : pick(
                language,
                "El backend respondió con un error no esperado. Revisa logs de Supabase para más detalle.",
                "Backend returned an unexpected error. Check Supabase logs for details."
              );
    return (
      <I18nContext.Provider value={{ language }}>
        <NotificationsContext.Provider
          value={{
            notifications: [],
            unreadCount: 0,
            lastReadAt: 0,
            markAllAsRead: () => {}
          }}
        >
          <main className="page-section narrow">
            <h2>{pick(language, "Error de conexión de backend", "Backend connection error")}</h2>
            <p className="warning">{backendErrorMessage}</p>
          </main>
        </NotificationsContext.Provider>
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ language }}>
      <NotificationsContext.Provider
        value={{
          notifications,
          unreadCount: unreadNotifications,
          lastReadAt: notificationsReadAt,
          markAllAsRead: markAllNotificationsAsRead
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <PageTransition>
              <LoginPage
                users={users}
                selectedCommunity={selectedCommunity}
                onCreateCommunity={createCommunityFlow}
                onPreviewCommunity={previewCommunityInvite}
                onConfirmCommunity={confirmCommunityInvite}
                onCreateOrLogin={createOrLogin}
              />
            </PageTransition>
          }
        />

        <Route
          path="/home"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <HomePage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  users={users}
                  posts={postsForViewer}
                  preferences={preferences}
                  filterPosts={filterPosts}
                  userQualityValueById={userQualityValueById}
                  userInfluenceAuraById={userInfluenceAuraById}
                  userCommunityStatsById={userCommunityStatsById}
                  onOpenShareModal={() => setShareModalOpen(true)}
                  onLogout={logout}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route
          path="/topic/:topic"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <TopicPage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  users={users}
                  posts={postsForViewer}
                  userInfluenceAuraById={userInfluenceAuraById}
                  onOpenShareModal={() => setShareModalOpen(true)}
                  onLogout={logout}
                  activeUserId={activeUser?.id ?? null}
                  onAddComment={onAddComment}
                  onVoteCommentAura={onVoteCommentAura}
                  onAdminDeleteComment={onAdminDeleteComment}
                  onAdminRenameTopic={onAdminRenameTopic}
                  onShareUrl={onShareUrl}
                  onToast={showToast}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route
          path="/post/:postId"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <PostDetailPage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  users={users}
                  posts={postsForViewer}
                  onOpenShareModal={() => setShareModalOpen(true)}
                  onLogout={logout}
                  activeUserId={activeUser?.id ?? null}
                  onOpenExternalSource={onOpenExternalSource}
                  onRatePost={onRatePost}
                  onAddComment={onAddComment}
                  onVoteCommentAura={onVoteCommentAura}
                  onAdminDeleteComment={onAdminDeleteComment}
                  onAdminDeletePost={onAdminDeletePost}
                  onAdminUpdatePostTopic={onAdminUpdatePostTopic}
                  onAddPostTopic={onAddPostTopic}
                  onReportPost={onReportPost}
                  onAdminModeratePost={onAdminModeratePost}
                  onToast={showToast}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route
          path="/share"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <SharePage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  onShareUrl={onShareUrl}
                  getDuplicatePreview={getDuplicatePreview}
                  onToast={showToast}
                  onLogout={logout}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route
          path="/profile/:userId"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <ProfilePage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  users={users}
                  posts={postsForViewer}
                  userCommunityStatsById={userCommunityStatsById}
                  onLogout={logout}
                  onUpdateAvatar={updateUserAvatar}
                  onUpdateAlias={updateUserAlias}
                  onDeleteUser={onAdminDeleteUser}
                  onSetUserRole={onAdminSetUserRole}
                  onToast={showToast}
                  onOpenShareModal={() => setShareModalOpen(true)}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route
          path="/profile/:userId/posts"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <UserPostsPage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  users={users}
                  posts={postsForViewer}
                  onDeletePost={removePost}
                  onToast={showToast}
                  onOpenShareModal={() => setShareModalOpen(true)}
                  onLogout={logout}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <SettingsPage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  preferences={preferences}
                  knownTopics={knownTopics}
                  onUpdateLanguage={updateUserLanguage}
                  onSave={updatePreferences}
                  onExport={onExport}
                  onImport={onImport}
                  onDeleteMyData={onDeleteMyData}
                  onOpenShareModal={() => setShareModalOpen(true)}
                  onLogout={logout}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route
          path="/community"
          element={
            <RequireAuth activeUser={activeUser}>
              <PageTransition>
                <CommunityPage
                  activeUser={activeUser as NonNullable<typeof activeUser>}
                  selectedCommunity={selectedCommunity}
                  members={communityMembers}
                  rulesText={communityRulesText}
                  onLeaveCommunity={leaveCurrentCommunity}
                  onLogout={logout}
                  onOpenShareModal={() => setShareModalOpen(true)}
                  onToast={showToast}
                />
              </PageTransition>
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to={activeUser ? "/home" : "/login"} replace />} />
        <Route path="*" element={<Navigate to={activeUser ? "/home" : "/login"} replace />} />
        </Routes>
        </AnimatePresence>
        <Toast message={toast} />
        <ShareLinkModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          onShareUrl={onShareUrl}
          getDuplicatePreview={getDuplicatePreview}
          onToast={showToast}
        />
        <AppFooter />
      </NotificationsContext.Provider>
    </I18nContext.Provider>
  );
};

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
