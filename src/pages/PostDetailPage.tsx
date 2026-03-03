import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CommentsPanel } from "../components/CommentsPanel";
import { Icon } from "../components/Icon";
import { TopBar } from "../components/TopBar";
import { pick, translateRationale, useI18n } from "../lib/i18n";
import {
  displayTitle,
  extractNewsDate,
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
  activeUserId: string | null;
  onOpenExternalSource: (postId: string) => Promise<void>;
  onRatePost: (postId: string, vote: 1 | -1) => Promise<{ ok: boolean; message: string }>;
  onAddComment: (postId: string, text: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
  onVoteCommentAura: (postId: string, commentId: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
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
  activeUserId,
  onOpenExternalSource,
  onRatePost,
  onAddComment,
  onVoteCommentAura,
  onToast
}: PostDetailPageProps) => {
  const { language } = useI18n();
  const { postId = "" } = useParams();
  const navigate = useNavigate();
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const postFromState = useMemo(() => posts.find((post) => post.id === postId) ?? null, [posts, postId]);
  const [current, setCurrent] = useState<Post | null>(postFromState);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [justOpenedExternal, setJustOpenedExternal] = useState(false);

  useEffect(() => {
    setCurrent(postFromState);
    setJustOpenedExternal(false);
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

  if (!current) {
    return (
      <main>
        <TopBar user={activeUser} onOpenShare={onOpenShareModal} />
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
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} />

      <section className="page-section detail-layout">
        <article className="detail-main">
          <div className="section-head">
            <h2>{displayTitle(current)}</h2>
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              <Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}
            </button>
          </div>
          <p className="section-intro">{sourceLabel(current)} · {formatNewsDate(extractNewsDate(current))}</p>

          <div className="modal-meta">
            <span className={`quality quality-${current.qualityLabel}`}>{qualityLabelText(current.qualityLabel, language)}</span>
            <span className="badge">
              Aura {formatAuraScore(current.interestScore)}/100
              <span className={`aura-trend aura-trend-${auraTrend}`}>{auraArrow}</span>
            </span>
            {author ? <Link to={`/profile/${author.id}/posts`} className="badge">{pick(language, "Publicado por", "Posted by")} {author.alias}</Link> : null}
            {current.topics.map((topic) => (
              <Link key={topic} to={`/topic/${topic}`} className="chip chip-topic" style={topicColorVars(topic)}>
                {topic}
              </Link>
            ))}
            {(current.subtopics ?? []).map((subtopic) => (
              <span key={subtopic} className="chip chip-subtopic">
                {subtopic}
              </span>
            ))}
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
                onClick={async () => {
                  const openedWindow = window.open(current.url, "_blank", "noopener,noreferrer");
                  if (!openedWindow) {
                    onToast(pick(language, "Tu navegador bloqueó la pestaña. Activa las ventanas emergentes para esta web.", "Your browser blocked the new tab. Enable popups for this site."));
                    return;
                  }
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
                  setJustOpenedExternal(true);
                  onToast(pick(language, "Fuente abierta. Ya puedes valorar esta noticia.", "Source opened. You can now rate this post."));
                }}
              >
                <Icon name="news" /> {pick(language, "Abrir fuente", "Open source")}
              </button>
            ) : (
              <span className="hint">{pick(language, "Esta noticia no tiene URL externa.", "This post has no external URL.")}</span>
            )}

            <button
              type="button"
              className={currentUserVote === 1 ? "btn btn-primary" : "btn"}
              disabled={!canRate || ratingBusy || !current.url}
              onClick={async () => {
                setRatingBusy(true);
                const result = await onRatePost(current.id, 1);
                onToast(result.message);
                if (result.ok && activeUserId) {
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
                }
                setRatingBusy(false);
              }}
            >
              <Icon name="thumbUp" />
            </button>
            <button
              type="button"
              className={currentUserVote === -1 ? "btn btn-primary" : "btn"}
              disabled={!canRate || ratingBusy || !current.url}
              onClick={async () => {
                setRatingBusy(true);
                const result = await onRatePost(current.id, -1);
                onToast(result.message);
                if (result.ok && activeUserId) {
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
          {!canRate && current.url ? <p className="warning">{pick(language, "Abre la fuente para poder votar esta noticia.", "Open the source to vote on this post.")}</p> : null}
          {justOpenedExternal ? <p className="hint">{pick(language, "Gracias por comprobar la fuente.", "Thanks for checking the source.")}</p> : null}

          <details className="score-details">
            <summary>{pick(language, "Cómo se calcula su puntuación", "How this score is calculated")}</summary>
            <ul className="rationale">
              {current.rationale.slice(0, 6).map((line) => (
                <li key={line}>{translateRationale(language, line)}</li>
              ))}
            </ul>
          </details>
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
                  <span className="hint">Aura {formatAuraScore(item.interestScore)}/100</span>
                </button>
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="page-section">
        <CommentsPanel
          post={current}
          usersById={usersById}
          activeUserId={activeUserId}
          onAddComment={onAddComment}
          onVoteCommentAura={onVoteCommentAura}
          onPostUpdate={setCurrent}
          onToast={onToast}
        />
      </section>
    </main>
  );
};
