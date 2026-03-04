import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { EmojiMenu } from "../components/EmojiMenu";
import { Icon } from "../components/Icon";
import { PostCard } from "../components/PostCard";
import { pick, useI18n } from "../lib/i18n";
import { displayTitle, extractNewsDate, formatNewsDate } from "../lib/presentation";
import { rankTopicPosts, topicAverageAura, topicForumScore } from "../lib/topicForum";
import { TopBar } from "../components/TopBar";
import type { Post, User } from "../lib/types";

interface TopicPageProps {
  activeUser: User;
  users: User[];
  posts: Post[];
  onOpenShareModal?: () => void;
  onLogout: () => void;
  activeUserId: string | null;
  onAddComment: (postId: string, text: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
  onVoteCommentAura: (postId: string, commentId: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
  onAdminDeleteComment: (postId: string, commentId: string) => Promise<{ ok: boolean; message: string }>;
  onAdminRenameTopic: (fromTopic: string, toTopic: string) => Promise<{ ok: boolean; message: string }>;
  onShareUrl: (
    url: string,
    options?: { forceTopic?: string }
  ) => Promise<{ mode: "created" | "merged" | "penalized"; message: string }>;
  onToast: (message: string) => void;
}

export const TopicPage = ({
  activeUser,
  users,
  posts,
  onOpenShareModal,
  onLogout,
  activeUserId,
  onAddComment,
  onVoteCommentAura,
  onAdminDeleteComment,
  onAdminRenameTopic,
  onShareUrl,
  onToast
}: TopicPageProps) => {
  const { language } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const topic = params.topic ?? "";
  const [renameTopic, setRenameTopic] = useState(topic);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [topicSettingsOpen, setTopicSettingsOpen] = useState(false);
  const isAdmin = activeUser.role === "admin";
  useEffect(() => {
    setRenameTopic(topic);
  }, [topic]);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const topicPosts = rankTopicPosts(posts.filter((post) => post.topics.includes(topic)), topic).map((post) => ({
    post,
    eventDate: extractNewsDate(post),
    forumScore: topicForumScore(post, topic)
  }));

  useEffect(() => {
    if (topicPosts.length === 0) {
      setSelectedPostId(null);
      return;
    }
    setSelectedPostId((prev) => {
      if (prev && topicPosts.some((entry) => entry.post.id === prev)) return prev;
      return topicPosts[0].post.id;
    });
  }, [topicPosts]);

  const selectedPost = topicPosts.find((entry) => entry.post.id === selectedPostId)?.post ?? topicPosts[0]?.post ?? null;

  const topicChat = useMemo(() => {
    return topicPosts
      .flatMap(({ post }) =>
        (post.comments ?? []).map((comment) => ({
          postId: post.id,
          postTitle: displayTitle(post),
          comment
        }))
      )
      .sort((a, b) => b.comment.createdAt - a.comment.createdAt);
  }, [topicPosts]);
  const totalComments = topicChat.length;
  const averageAura = topicAverageAura(topicPosts.map((entry) => entry.post));
  const averageAuraClass =
    averageAura >= 75 ? "aura-health-good" : averageAura >= 50 ? "aura-health-warn" : "aura-health-bad";
  const postOrderById = useMemo(
    () => new Map(topicPosts.map(({ post }, index) => [post.id, index + 1])),
    [topicPosts]
  );

  const relativeTime = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    if (mins < 60) return language === "en" ? `${mins}m ago` : language === "gl" ? `hai ${mins}m` : `hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return language === "en" ? `${hours}h ago` : language === "gl" ? `hai ${hours}h` : `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return language === "en" ? `${days}d ago` : language === "gl" ? `hai ${days}d` : `hace ${days}d`;
  };

  const submitTopicComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPost || !activeUserId || chatBusy) return;
    const text = chatDraft.trim();
    if (!text) return;
    setChatBusy(true);
    const result = await onAddComment(selectedPost.id, text);
    onToast(result.message);
    if (result.ok) setChatDraft("");
    setChatBusy(false);
  };

  const submitShareInTopic = async (event: FormEvent) => {
    event.preventDefault();
    const clean = shareUrl.trim();
    if (!clean || sharing) return;
    setSharing(true);
    const result = await onShareUrl(clean, { forceTopic: topic });
    onToast(result.message);
    setShareUrl("");
    setSharing(false);
  };

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />
      <section className="page-section">
        <div className="section-head">
          <h2><Icon name="tag" /> {pick(language, "Hilo", "Thread")}: {topic}</h2>
          <div className="topic-head-meta">
            <div className="topic-head-kpis">
              <span className="badge">{topicPosts.length} {pick(language, "noticias", "posts", "novas")}</span>
              <span className="badge">{totalComments} {pick(language, "comentarios", "comments", "comentarios")}</span>
              <span className={`badge aura-health ${averageAuraClass}`}>
                <Icon name="spark" size={12} /> {pick(language, "Aura media", "Avg Aura", "Aura media")} {averageAura}
              </span>
            </div>
            <div className="topic-head-actions-row">
              <button type="button" className="btn" onClick={() => setTopicSettingsOpen((prev) => !prev)}>
                <Icon name="settings" /> {pick(language, "Ajustes", "Settings", "Axustes")}
              </button>
              <Link to="/home" className="link-btn">
                <Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}
              </Link>
            </div>
          </div>
        </div>
        <p className="section-intro topic-section-intro">
          {pick(language, "Timeline del tema con su chat contextual para colaborar sin perder el hilo.", "Topic timeline with contextual chat to collaborate without losing the thread.", "Timeline do tema co seu chat contextual para colaborar sen perder o fío.")}
        </p>
        <form className="detail-actions topic-share-row" onSubmit={submitShareInTopic}>
          <input
            type="url"
            value={shareUrl}
            onChange={(event) => setShareUrl(event.target.value)}
            placeholder={pick(language, "Añadir noticia a este tema (pega URL)", "Add post to this topic (paste URL)")}
            required
            disabled={sharing}
          />
          <button type="submit" className="btn btn-primary" disabled={sharing}>
            <Icon name="plus" />{" "}
            {sharing ? (
              <>
                {pick(language, "Procesando noticia", "Processing post", "Procesando nova")}
                <span className="loading-dots" aria-hidden="true" />
              </>
            ) : (
              pick(language, "Añadir a este tema", "Add to this topic")
            )}
          </button>
        </form>
        {topicSettingsOpen ? (
          <div className="detail-actions">
            {isAdmin ? (
              <>
                <input
                  value={renameTopic}
                  onChange={(event) => setRenameTopic(event.target.value)}
                  placeholder={pick(language, "Renombrar tema", "Rename topic")}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    const result = await onAdminRenameTopic(topic, renameTopic);
                    onToast(result.message);
                    if (result.ok) {
                      navigate(`/topic/${renameTopic.trim().toLowerCase().replace(/\s+/g, "-")}`);
                    }
                  }}
                >
                  {pick(language, "Renombrar tema", "Rename topic")}
                </button>
              </>
            ) : (
              <p className="hint">{pick(language, "Solo admin puede renombrar temas.", "Only admin can rename topics.")}</p>
            )}
          </div>
        ) : null}
        {topicPosts.length === 0 ? (
          <article className="empty-state">
            <h3>{pick(language, "Aún no hay publicaciones en este hilo", "No posts in this thread yet")}</h3>
            <p>{pick(language, "Comparte la primera noticia para arrancarlo.", "Share the first post to kick it off.")}</p>
          </article>
        ) : (
          <div className="topic-forum-layout">
            <section className="topic-timeline-column">
              <div className="timeline">
                {topicPosts.map(({ post, eventDate, forumScore }) => (
                  <article
                    key={post.id}
                    className={selectedPostId === post.id ? "timeline-item timeline-item-active" : "timeline-item"}
                    onMouseEnter={() => setSelectedPostId(post.id)}
                    onClick={() => setSelectedPostId(post.id)}
                  >
                    <div className="timeline-rail">
                      <span className="timeline-dot" />
                      <span className="timeline-date">{formatNewsDate(eventDate)}</span>
                    </div>
                    <div className="timeline-card timeline-comment-cue" title={pick(language, "Pasa por aquí para comentar este punto del hilo", "Hover here to comment this point in the thread", "Pasa por aquí para comentar este punto do fío")}>
                      <p className="timeline-score">
                        <span className="timeline-score-pill"><Icon name="timeline" size={14} /> {pick(language, "Relevancia", "Relevance", "Relevancia")} {Math.round(forumScore)}</span>
                        <span className="timeline-score-pill"><Icon name="spark" size={13} /> {pick(language, "Aura media", "Avg Aura", "Aura media")} {averageAura}</span>
                      </p>
                      <PostCard
                        post={post}
                        author={usersById.get(post.userId)}
                        compact
                        onOpenDetail={(entry) => navigate(`/post/${entry.id}`)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="topic-chat-column">
              <div className="topic-chat-head">
                <h3><Icon name="comment" size={14} /> {pick(language, "Chat del tema", "Topic chat", "Chat do tema")}</h3>
                <span className="badge">{topicChat.length}</span>
              </div>
              <p className="hint topic-chat-focus">
                {selectedPost
                  ? (
                    <>
                      {pick(language, "Comentando en", "Commenting on", "Comentando en")}:
                      {" "}
                      <strong className="topic-chat-focus-title">{displayTitle(selectedPost)}</strong>
                    </>
                  )
                  : pick(language, "Selecciona una noticia para comentar.", "Select a post to comment.", "Selecciona unha nova para comentar.")}
              </p>
              <form className="topic-chat-form" onSubmit={submitTopicComment}>
                <div className="topic-chat-input-wrap">
                  <input
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder={pick(language, "Añade contexto al hilo...", "Add context to the thread...", "Engade contexto ao fío...")}
                    disabled={!selectedPost || !activeUserId || chatBusy}
                  />
                  <EmojiMenu
                    disabled={!selectedPost || !activeUserId || chatBusy}
                    onSelect={(emoji) => setChatDraft((prev) => `${prev}${prev ? " " : ""}${emoji}`)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-icon-compact"
                  disabled={!selectedPost || !activeUserId || chatBusy}
                  aria-label={pick(language, "Enviar comentario", "Send comment", "Enviar comentario")}
                  title={pick(language, "Enviar comentario", "Send comment", "Enviar comentario")}
                >
                  <Icon name="send" size={14} />
                </button>
              </form>

              <div className="topic-chat-list">
                {topicChat.length === 0 ? (
                  <p className="hint">{pick(language, "Sin comentarios todavía en este tema.", "No comments in this topic yet.", "Sen comentarios aínda neste tema.")}</p>
                ) : (
                  topicChat.map(({ postId, postTitle, comment }) => {
                    const author = usersById.get(comment.userId);
                    const auraCount = comment.auraUserIds?.length ?? 0;
                    const auraActive = !!activeUserId && (comment.auraUserIds ?? []).includes(activeUserId);
                    const contextIndex = postOrderById.get(postId) ?? 0;
                    return (
                      <article
                        key={comment.id}
                        className={postId === selectedPostId ? "topic-chat-item topic-chat-item-active" : "topic-chat-item"}
                      >
                        <header>
                          {author ? <Avatar user={author} size={20} /> : null}
                          <strong>{author?.alias ?? pick(language, "usuario", "user")}</strong>
                          <span className="hint">{relativeTime(comment.createdAt)}</span>
                        </header>
                        <p>{comment.text}</p>
                        <div className="topic-chat-meta">
                          <button
                            type="button"
                            className={auraActive ? "btn btn-primary aura-btn" : "btn aura-btn"}
                            disabled={!activeUserId}
                            onClick={async () => {
                              const result = await onVoteCommentAura(postId, comment.id);
                              onToast(result.message);
                            }}
                          >
                            Aura {auraCount}
                          </button>
                          {isAdmin ? (
                            <button
                              type="button"
                              className="btn aura-btn"
                              onClick={async () => {
                                const result = await onAdminDeleteComment(postId, comment.id);
                                onToast(result.message);
                              }}
                            >
                              {pick(language, "Eliminar", "Delete", "Eliminar")}
                            </button>
                          ) : null}
                          <button type="button" className="link-btn" onClick={() => navigate(`/post/${postId}`)}>
                            {pick(language, "Ver noticia", "Open post", "Ver nova")}
                          </button>
                          <span
                            className="topic-chat-context"
                            title={pick(
                              language,
                              `Comentario ligado a: ${postTitle}`,
                              `Comment linked to: ${postTitle}`,
                              `Comentario ligado a: ${postTitle}`
                            )}
                          >
                            <Icon name="timeline" size={12} /> #{contextIndex}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
};
