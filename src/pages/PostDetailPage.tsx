import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CommentsPanel } from "../components/CommentsPanel";
import { Icon } from "../components/Icon";
import { TopBar } from "../components/TopBar";
import { pick, translateRationale, useI18n } from "../lib/i18n";
import {
  displayTitle,
  extractNewsDate,
  formatTopicLabel,
  formatAuraScore,
  formatNewsDate,
  previewImage,
  qualityLabelText,
  sourceLabel,
  topicIntro
} from "../lib/presentation";
import { topicColorVars } from "../lib/topicColors";
import type { Post, User } from "../lib/types";

interface PostDetailPageProps {
  activeUser: User;
  users: User[];
  posts: Post[];
  onOpenShareModal?: () => void;
  onLogout: () => void;
  activeUserId: string | null;
  onOpenExternalSource: (postId: string) => Promise<void>;
  onRatePost: (postId: string, vote: 1 | -1) => Promise<{ ok: boolean; message: string }>;
  onAddComment: (postId: string, text: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
  onVoteCommentAura: (postId: string, commentId: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
  onAdminDeleteComment: (postId: string, commentId: string) => Promise<{ ok: boolean; message: string }>;
  onAdminDeletePost: (postId: string) => Promise<{ ok: boolean; message: string }>;
  onAdminUpdatePostTopic: (postId: string, nextTopic: string) => Promise<{ ok: boolean; message: string }>;
  onAddPostTopic: (postId: string, nextTopic: string) => Promise<{ ok: boolean; message: string }>;
  onToast: (message: string) => void;
}

const relatedScore = (base: Post, candidate: Post): number => {
  if (base.id === candidate.id) return -Infinity;
  const sharedTopics = candidate.topics.filter((topic) => base.topics.includes(topic)).length;
  const ageHours = Math.max(0, (Date.now() - candidate.createdAt) / (1000 * 60 * 60));
  const recency = ageHours < 24 ? 10 : ageHours < 72 ? 6 : 2;
  return sharedTopics * 15 + candidate.qualityScore * 0.4 + candidate.interestScore * 0.3 + recency;
};

export const PostDetailPage = ({
  activeUser,
  users,
  posts,
  onOpenShareModal,
  onLogout,
  activeUserId,
  onOpenExternalSource,
  onRatePost,
  onAddComment,
  onVoteCommentAura,
  onAdminDeleteComment,
  onAdminDeletePost,
  onAdminUpdatePostTopic,
  onAddPostTopic,
  onToast
}: PostDetailPageProps) => {
  const { language } = useI18n();
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const postFromState = useMemo(() => posts.find((post) => post.id === postId) ?? null, [posts, postId]);
  const [current, setCurrent] = useState<Post | null>(postFromState);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [showSourceVoteHint, setShowSourceVoteHint] = useState(false);
  const [auraOpen, setAuraOpen] = useState(false);
  const [thumbUpPulse, setThumbUpPulse] = useState(false);
  const [manualTopic, setManualTopic] = useState("");
  const [topicBusy, setTopicBusy] = useState(false);
  const [adminTopic, setAdminTopic] = useState("");
  const isAdmin = activeUser.role === "admin";

  useEffect(() => {
    setCurrent(postFromState);
    setShowSourceVoteHint(false);
    setAuraOpen(false);
    setThumbUpPulse(false);
    setManualTopic("");
    setAdminTopic(postFromState?.topics?.[0] ?? "");
  }, [postFromState]);

  const related = useMemo(() => {
    if (!current) return [];
    return [...posts]
      .sort((a, b) => relatedScore(current, b) - relatedScore(current, a))
      .slice(0, 6);
  }, [current, posts]);

  const currentUserVote = useMemo(() => {
    if (!current || !activeUserId) return null;
    return current.feedbacks?.find((item) => item.userId === activeUserId)?.vote ?? null;
  }, [current, activeUserId]);

  const canRate = useMemo(() => {
    if (!current || !activeUserId) return false;
    return (current.openedByUserIds ?? []).includes(activeUserId);
  }, [current, activeUserId]);
  const author = current ? usersById.get(current.userId) : undefined;
  const coverImage = current ? previewImage(current) : null;
  const auraDelta = current ? (current.feedbacks ?? []).reduce((acc, item) => acc + item.vote, 0) : 0;
  const auraTrend = auraDelta > 0 ? "up" : auraDelta < 0 ? "down" : "flat";
  const auraArrow = auraTrend === "up" ? "▲" : auraTrend === "down" ? "▼" : "•";
  const auraWhy = current?.rationale.slice(0, 4) ?? [];

  if (!current) {
    return (
      <main>
        <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />
        <section className="page-section narrow">
          <h2>{pick(language, "Noticia no encontrada", "Post not found")}</h2>
          <p className="hint">{pick(language, "Puede que se haya eliminado o que se haya fusionado con un duplicado.", "It may have been deleted or merged with a duplicate.")}</p>
          <Link to="/home" className="btn"><Icon name="arrowLeft" /> {pick(language, "Volver al inicio", "Back to home")}</Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />

      <section className="page-section detail-layout">
        <article className="detail-main">
          <div className="section-head">
            <h2>{displayTitle(current)}</h2>
            <div className="detail-head-actions">
              {current.url ? <span className="badge">{sourceLabel(current)}</span> : null}
              <button type="button" className="btn" onClick={() => navigate(-1)}>
                <Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}
              </button>
              <details className="detail-settings-menu">
                <summary className="btn">
                  <Icon name="settings" /> {pick(language, "Ajustes", "Settings")}
                </summary>
                <div className="detail-settings-panel">
                  <h3>{pick(language, "Ajustar temas", "Adjust topics")}</h3>
                  <div className="detail-actions">
                    <input
                      value={manualTopic}
                      onChange={(event) => setManualTopic(event.target.value)}
                      placeholder={pick(language, "Ejemplo: energia", "Example: energy")}
                    />
                    <button
                      type="button"
                      className="btn"
                      disabled={!manualTopic.trim() || topicBusy}
                      onClick={async () => {
                        setTopicBusy(true);
                        const result = await onAddPostTopic(current.id, manualTopic);
                        onToast(result.message);
                        if (result.ok) {
                          const nextTopic = manualTopic
                            .trim()
                            .toLowerCase()
                            .replace(/\s+/g, "-")
                            .replace(/[^a-z0-9-]/g, "")
                            .slice(0, 36);
                          setCurrent((prev) => {
                            if (!prev || prev.topics.includes(nextTopic)) return prev;
                            return { ...prev, topics: [nextTopic, ...prev.topics].slice(0, 6) };
                          });
                          setManualTopic("");
                        }
                        setTopicBusy(false);
                      }}
                    >
                      <Icon name="tag" /> {pick(language, "Añadir tema", "Add topic")}
                    </button>
                  </div>

                  {isAdmin ? (
                    <div className="detail-settings-admin">
                      <h3>{pick(language, "Moderación admin", "Admin moderation")}</h3>
                      <div className="detail-actions">
                        <input
                          value={adminTopic}
                          onChange={(event) => setAdminTopic(event.target.value)}
                          placeholder={pick(language, "Nuevo tema", "New topic")}
                        />
                        <button
                          type="button"
                          className="btn"
                          onClick={async () => {
                            const result = await onAdminUpdatePostTopic(current.id, adminTopic);
                            onToast(result.message);
                          }}
                        >
                          {pick(language, "Cambiar tema", "Change topic")}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={async () => {
                            const okDelete = window.confirm(pick(language, "¿Eliminar esta noticia?", "Delete this post?"));
                            if (!okDelete) return;
                            const result = await onAdminDeletePost(current.id);
                            onToast(result.message);
                            if (result.ok) navigate("/home");
                          }}
                        >
                          {pick(language, "Eliminar noticia", "Delete post")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isAdmin && current.topicExplanationV2 ? (
                    <div className="detail-settings-admin">
                      <h3>{pick(language, "Topic explain v2", "Topic explain v2")}</h3>
                      <p className="hint">
                        {pick(
                          language,
                          `topic_v2: ${current.topicV2 ?? "general"} · ${current.topicExplanationV2.ambiguous ? "ambiguous" : "resolved"}`,
                          `topic_v2: ${current.topicV2 ?? "general"} · ${current.topicExplanationV2.ambiguous ? "ambiguous" : "resolved"}`
                        )}
                      </p>
                      <p className="hint">
                        {pick(language, "Top candidates", "Top candidates")}:{" "}
                        {(current.topicCandidatesV2 ?? [])
                          .slice(0, 3)
                          .map((candidate) => `${candidate.topic} (${candidate.score})`)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          </div>

          <div className="modal-meta">
            <span className={`quality quality-${current.qualityLabel}`}>{qualityLabelText(current.qualityLabel, language)}</span>
            <span className="interest-wrap">
              <button
                type="button"
                className="badge aura-badge-btn aura-health"
                onClick={() => setAuraOpen((prev) => !prev)}
                onBlur={() => setAuraOpen(false)}
                aria-expanded={auraOpen}
              >
                {formatAuraScore(current.interestScore)} <span className={`aura-trend aura-trend-${auraTrend}`}>{auraArrow}</span>
              </button>
              <span className={auraOpen ? "interest-tooltip open" : "interest-tooltip"}>
                <strong>{pick(language, "Por qué esta nota", "Why this post", "Por que esta nota")}</strong>
                {auraWhy.length > 0 ? (
                  <ul>
                    {auraWhy.map((line) => (
                      <li key={line}>{translateRationale(language, line)}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{pick(language, "Basado en calidad, señales y contexto del hilo.", "Based on quality, signals and thread context.", "Baseado en calidade, sinais e contexto do fío.")}</p>
                )}
              </span>
            </span>
            <span className="badge">{formatNewsDate(extractNewsDate(current))}</span>
            {author ? <Link to={`/profile/${author.id}/posts`} className="badge">{pick(language, "Publicado por", "Posted by")} {author.alias}</Link> : null}
            <span className="detail-meta-topics">
              {current.topics.map((topic) => (
                <Link key={topic} to={`/topic/${topic}`} className="chip chip-topic" style={topicColorVars(topic)}>
                  {formatTopicLabel(topic)}
                </Link>
              ))}
              {(current.subtopics ?? []).map((subtopic) => (
                <span key={subtopic} className="chip chip-subtopic">
                  {subtopic}
                </span>
              ))}
            </span>
          </div>

          {coverImage ? (
            <div className="detail-hero-image">
              <img src={coverImage} alt={displayTitle(current)} loading="lazy" />
            </div>
          ) : null}

          {current.text ? <p className="post-text">{current.text}</p> : <p className="post-text">{pick(language, "No hay resumen disponible.", "No summary available.")}</p>}

          <div className="detail-actions">
            {current.url ? (
              <button
                type="button"
                className="btn btn-primary source-cta"
                disabled={canRate}
                onClick={async () => {
                  if (canRate) return;
                  try {
                    const openedWindow = window.open(current.url, "_blank", "noopener,noreferrer");
                    await onOpenExternalSource(current.id);
                    setCurrent((prev) =>
                      prev
                        ? {
                            ...prev,
                            openedByUserIds: Array.from(new Set([...(prev.openedByUserIds ?? []), activeUserId ?? ""]))
                              .filter(Boolean)
                          }
                        : prev
                    );
                    setShowSourceVoteHint(false);
                    onToast(
                      openedWindow
                        ? pick(language, "Fuente abierta. Ya puedes valorar esta noticia.", "Source opened. You can now rate this post.")
                        : pick(language, "Si no se abrió la pestaña, revisa el bloqueador. Ya puedes valorar esta noticia.", "If the tab did not open, check popup blocker. You can now rate this post.")
                    );
                  } catch {
                    onToast(
                      pick(
                        language,
                        "No pudimos registrar la apertura de fuente. Reintenta en unos segundos.",
                        "Could not register source opening. Try again in a few seconds."
                      )
                    );
                  }
                }}
              >
                <Icon name="news" /> {pick(language, "Fuente", "Source", "Fonte")}
              </button>
            ) : (
              <span className="hint">{pick(language, "Esta noticia no tiene URL externa.", "This post has no external URL.")}</span>
            )}

            <button
              type="button"
              className={currentUserVote === 1 ? `btn btn-primary ${thumbUpPulse ? "thumb-up-pulse" : ""}` : "btn"}
              disabled={ratingBusy || !current.url || !canRate}
              onClick={async () => {
                setRatingBusy(true);
                const result = await onRatePost(current.id, 1);
                onToast(result.message);
                if (result.ok && activeUserId) {
                  setShowSourceVoteHint(false);
                  setCurrent((prev) => {
                    if (!prev) return prev;
                    const feedbacks: NonNullable<Post["feedbacks"]> = prev.feedbacks ?? [];
                    const existing = feedbacks.find((item) => item.userId === activeUserId);
                    const nextFeedbacks: NonNullable<Post["feedbacks"]> = existing
                      ? feedbacks.map((item) =>
                          item.userId === activeUserId ? { ...item, vote: 1 as const, votedAt: Date.now() } : item
                        )
                      : [...feedbacks, { userId: activeUserId, vote: 1 as const, votedAt: Date.now() }];
                    return { ...prev, feedbacks: nextFeedbacks };
                  });
                  setThumbUpPulse(true);
                  window.setTimeout(() => setThumbUpPulse(false), 650);
                }
                setRatingBusy(false);
              }}
            >
              <Icon name="thumbUp" />
            </button>
            <button
              type="button"
              className={currentUserVote === -1 ? "btn btn-primary" : "btn"}
              disabled={ratingBusy || !current.url || !canRate}
              onClick={async () => {
                setRatingBusy(true);
                const result = await onRatePost(current.id, -1);
                onToast(result.message);
                if (result.ok && activeUserId) {
                  setShowSourceVoteHint(false);
                  setCurrent((prev) => {
                    if (!prev) return prev;
                    const feedbacks: NonNullable<Post["feedbacks"]> = prev.feedbacks ?? [];
                    const existing = feedbacks.find((item) => item.userId === activeUserId);
                    const nextFeedbacks: NonNullable<Post["feedbacks"]> = existing
                      ? feedbacks.map((item) =>
                          item.userId === activeUserId ? { ...item, vote: -1 as const, votedAt: Date.now() } : item
                        )
                      : [...feedbacks, { userId: activeUserId, vote: -1 as const, votedAt: Date.now() }];
                    return { ...prev, feedbacks: nextFeedbacks };
                  });
                }
                setRatingBusy(false);
              }}
            >
              <Icon name="thumbDown" />
            </button>
          </div>
          {(!canRate && current.url) || (showSourceVoteHint && !canRate && current.url) ? <p className="warning">{pick(language, "Visita la fuente para poder valorarla primero.", "Visit the source before rating it.")}</p> : null}

          <section className="detail-comments">
            <CommentsPanel
              post={current}
              usersById={usersById}
              activeUserId={activeUserId}
              onAddComment={onAddComment}
              onVoteCommentAura={onVoteCommentAura}
              onDeleteComment={onAdminDeleteComment}
              canModerateComments={isAdmin}
              onPostUpdate={setCurrent}
              onToast={onToast}
            />
          </section>
        </article>

        <aside className="detail-side">
          <article className="detail-side-card detail-side-topic">
            <h3><Icon name="tag" /> {pick(language, "Contexto del tema", "Topic context")}</h3>
            <p className="topic-intro">{topicIntro(current.topics, language)}</p>
            {current.topics[0] ? (
                <Link to={`/topic/${current.topics[0]}`} className="btn">
                <Icon name="timeline" /> {pick(language, "Ir al tema", "Go to topic")}
                </Link>
            ) : null}
          </article>

          <article className="detail-side-card detail-side-timeline">
            <h3><Icon name="timeline" /> {pick(language, "Más en este hilo", "More in this thread")}</h3>
            <div className="detail-related-list">
              {related.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="detail-related-item"
                  onClick={() => navigate(`/post/${item.id}`)}
                >
                  <span className="timeline-date">{formatNewsDate(extractNewsDate(item))}</span>
                  <strong>{displayTitle(item)}</strong>
                  <span className="detail-related-meta">
                    <span className="interest-wrap">
                      <span
                        className={`badge aura-health ${
                          item.interestScore >= 75 ? "aura-health-good" : item.interestScore >= 50 ? "aura-health-warn" : "aura-health-bad"
                        }`}
                      >
                        {pick(language, "Aura", "Aura")} {formatAuraScore(item.interestScore)}
                      </span>
                      <span className="interest-tooltip">
                        <strong>{pick(language, "Por qué este Aura", "Why this Aura", "Por que esta Aura")}</strong>
                        {item.rationale.slice(0, 3).length > 0 ? (
                          <ul>
                            {item.rationale.slice(0, 3).map((line) => (
                              <li key={line}>{translateRationale(language, line)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>{pick(language, "Basado en calidad, señales y contexto del hilo.", "Based on quality, signals and thread context.", "Baseado en calidade, sinais e contexto do fío.")}</p>
                        )}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
};
