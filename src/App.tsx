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
import { deriveTitleFromUrl, isUnusableTitle, qualityLabelText } from "./lib/presentation";
import { enrichUrl } from "./lib/enrich";
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
    updateUserRole,
    updatePostPrimaryTopic,
    renameTopicAcrossPosts,
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
  const language = normalizeLanguage(activeUser?.language);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  const knownTopics = useMemo(
    () => Array.from(new Set(posts.flatMap((post) => post.topics))).sort(),
    [posts]
  );
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
    showToast(pick(language, "Tus datos locales se han eliminado.", "Your local data has been deleted.", "Elimináronse os teus datos locais."));
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

  const onShareUrl = async (url: string): Promise<{ mode: "created" | "merged" | "penalized"; message: string }> => {
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

      await savePost({
        ...existing,
        canonicalUrl: canonical ?? existing.canonicalUrl,
        contributorCounts: counts,
        contributorUserIds,
        shareCount,
        feedbacks: nextFeedbacks,
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
      topics: classified.topics,
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
        `Publicado en ${classified.topics[0] ?? "misc"} · calidad ${qualityLabelText(classified.qualityLabel, language)}.`,
        `Posted in ${classified.topics[0] ?? "misc"} · quality ${qualityLabelText(classified.qualityLabel, language)}.`,
        `Publicado en ${classified.topics[0] ?? "misc"} · calidade ${qualityLabelText(classified.qualityLabel, "gl")}.`
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
    await removeComment(postId, commentId);
    return { ok: true, message: pick(language, "Comentario eliminado.", "Comment deleted.") };
  };

  const onAdminDeletePost = async (postId: string): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
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
    await renameTopicAcrossPosts(fromTopic, toTopic);
    return { ok: true, message: pick(language, "Tema renombrado en el foro.", "Topic renamed in the forum.") };
  };

  const onAdminDeleteUser = async (userId: string): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    if (userId === activeUser.id) {
      return { ok: false, message: pick(language, "No puedes eliminar tu propio usuario admin.", "You cannot delete your own admin user.") };
    }
    const target = users.find((entry) => entry.id === userId);
    if (target?.role === "admin") {
      const adminCount = users.filter((entry) => entry.role === "admin").length;
      if (adminCount <= 1) {
        return { ok: false, message: pick(language, "Debe existir al menos un admin activo.", "At least one active admin must remain.") };
      }
    }
    await removeUser(userId);
    return { ok: true, message: pick(language, "Usuario eliminado.", "User deleted.") };
  };

  const onAdminSetUserRole = async (
    userId: string,
    role: "admin" | "member"
  ): Promise<{ ok: boolean; message: string }> => {
    if (!activeUser || activeUser.role !== "admin") {
      return { ok: false, message: pick(language, "Acción solo para admin.", "Admin-only action.") };
    }
    try {
      await updateUserRole(userId, role);
      return {
        ok: true,
        message: role === "admin"
          ? pick(language, "Usuario nombrado admin.", "User promoted to admin.")
          : pick(language, "Usuario cambiado a miembro.", "User changed to member.")
      };
    } catch {
      return { ok: false, message: pick(language, "Debe existir al menos un admin activo.", "At least one active admin must remain.") };
    }
  };

  const showToast = (message: string): void => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  };

  if (loading) {
    return (
      <I18nContext.Provider value={{ language }}>
        <AppSkeleton />
        <p className="loading-caption">{pick(language, "Cargando tu espacio local...", "Loading your local space...")}</p>
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ language }}>
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
