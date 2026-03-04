import { AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppFooter } from "./components/AppFooter";
import { AppSkeleton } from "./components/AppSkeleton";
import { PageTransition } from "./components/PageTransition";
import { ShareLinkModal } from "./components/ShareLinkModal";
import { Toast } from "./components/Toast";
import { useAppData } from "./lib/appData";
import { classifyPost } from "./lib/classify";
import { I18nContext, normalizeLanguage, pick } from "./lib/i18n";
import { deriveTitleFromUrl, displayTitle, isUnusableTitle, qualityLabelText } from "./lib/presentation";
import { enrichUrl } from "./lib/enrich";
import { NotificationsContext, type AppNotification } from "./lib/notifications";
import { trackComment, trackOpenSource, trackPageView, trackRate, trackShare } from "./lib/usageAnalytics";
import { listPosts as listPostsFromStore } from "./lib/store";
import type { ExportBundle } from "./lib/types";
import { canonicalizeUrl, duplicateUrlKeys, generateId, normalizeSpace } from "./lib/utils";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RequireAuth } from "./pages/RequireAuth";
import { SettingsPage } from "./pages/SettingsPage";
import { SharePage } from "./pages/SharePage";
import { TopicPage } from "./pages/TopicPage";
import { UserPostsPage } from "./pages/UserPostsPage";

const AppRoutes = () => {
  const location = useLocation();
  const {
    users,
    posts,
    activeUser,
    preferences,
    loading,
    backendError,
    createOrLogin,
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

  const knownTopics = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.topics))).sort(),
    [posts]
  );
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
  ): Promise<{ mode: "created" | "merged" | "penalized"; message: string }> => {
    if (!activeUser) return { mode: "created", message: pick(language, "Inicia sesión para compartir enlaces.", "Sign in to share links.") };

    const canonical = canonicalizeUrl(url);
    const existing = findDuplicatePost(url);

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
    const classified = classifyPost({ url, title: derivedTitle, text: description }, createdAt);
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
      qualityLabel: classified.qualityLabel,
      qualityScore: classified.qualityScore,
      interestScore: classified.interestScore,
      flags: classified.flags,
      rationale: classified.rationale,
      normalizedText: classified.normalizedText
    });

    trackShare({
      mode: "created",
      sourceDomain: classified.sourceDomain,
      primaryTopic: classified.topics[0]
    });

    return {
      mode: "created",
      message: pick(
        language,
        `Publicado en ${finalTopics[0] ?? "misc"} · calidad ${qualityLabelText(classified.qualityLabel, language)}.`,
        `Posted in ${finalTopics[0] ?? "misc"} · quality ${qualityLabelText(classified.qualityLabel, language)}.`,
        `Publicado en ${finalTopics[0] ?? "misc"} · calidade ${qualityLabelText(classified.qualityLabel, "gl")}.`
      )
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
    await savePost({ ...post, openedByUserIds: Array.from(openedBy) });
    trackOpenSource({ sourceDomain: post.sourceDomain, primaryTopic: post.topics?.[0] });
  };

  const onRatePost = async (postId: string, vote: 1 | -1): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser) return { ok: false, message: pick(language, "Inicia sesión para votar.", "Sign in to vote.") };
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
            <p className="warning">
              {backendError === "REMOTE_REQUIRED_MISSING_CONFIG"
                ? pick(
                    language,
                    "Este despliegue exige backend remoto y no tiene configuración de Supabase. Revisa variables VITE_SUPABASE_* en Vercel.",
                    "This deployment requires remote backend but Supabase is not configured. Check VITE_SUPABASE_* variables in Vercel."
                  )
                : backendError}
            </p>
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
              <LoginPage users={users} onCreateOrLogin={createOrLogin} />
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
                  posts={posts}
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
                  posts={posts}
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
                  posts={posts}
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
                  posts={posts}
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
                  posts={posts}
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
