import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CommentsPanel } from "./CommentsPanel";
import { EASE_STANDARD, MOTION_DURATION } from "../lib/motion";
import { displayTitle, extractNewsDate, formatAuraScore, formatNewsDate, sourceLabel, topicIntro } from "../lib/presentation";
import type { Post, User } from "../lib/types";

interface PostDetailModalProps {
  post: Post | null;
  posts: Post[];
  users: User[];
  onClose: () => void;
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

export const PostDetailModal = ({
  post,
  posts,
  users,
  onClose,
  activeUserId,
  onOpenExternalSource,
  onRatePost,
  onAddComment,
  onVoteCommentAura,
  onToast
}: PostDetailModalProps) => {
  const [current, setCurrent] = useState<Post | null>(post);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [justOpenedExternal, setJustOpenedExternal] = useState(false);

  useEffect(() => {
    setCurrent(post);
    setJustOpenedExternal(false);
  }, [post]);

  const related = useMemo(() => {
    if (!current) return [];
    return [...posts]
      .sort((a, b) => relatedScore(current, b) - relatedScore(current, a))
      .slice(0, 5);
  }, [current, posts]);

  const currentUserVote = useMemo(() => {
    if (!current || !activeUserId) return null;
    return current.feedbacks?.find((item) => item.userId === activeUserId)?.vote ?? null;
  }, [current, activeUserId]);

  const canRate = useMemo(() => {
    if (!current || !activeUserId) return false;
    return (current.openedByUserIds ?? []).includes(activeUserId);
  }, [current, activeUserId]);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  return (
    <AnimatePresence>
      {current ? (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION_DURATION.fast, ease: EASE_STANDARD }}
          onClick={onClose}
        >
          <motion.section
            className="modal-card"
            initial={{ opacity: 0, y: 20, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: MOTION_DURATION.base, ease: EASE_STANDARD }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <div>
                <h2>{displayTitle(current)}</h2>
                <p>{sourceLabel(current)} · {formatNewsDate(extractNewsDate(current))}</p>
              </div>
              <button type="button" className="btn" onClick={onClose}>
                Cerrar
              </button>
            </header>

            <div className="modal-meta">
              <span className={`quality quality-${current.qualityLabel}`}>{current.qualityLabel}</span>
              <span className="badge">Aura {formatAuraScore(current.interestScore)}/100</span>
              {(current.contributorUserIds?.length ?? 1) > 1 ? (
                <span className="badge">+{current.contributorUserIds?.length ?? 1} colaboradores</span>
              ) : null}
              {current.topics.map((topic) => (
                <Link key={topic} to={`/topic/${topic}`} className="chip" onClick={onClose}>
                  {topic}
                </Link>
              ))}
              {(current.subtopics ?? []).map((subtopic) => (
                <span key={subtopic} className="chip chip-subtopic">
                  {subtopic}
                </span>
              ))}
            </div>

            <p className="topic-intro">{topicIntro(current.topics)}</p>
            {current.text ? <p className="post-text">{current.text}</p> : <p className="post-text">Sin extracto adicional.</p>}

            <ul className="rationale">
              {current.rationale.slice(0, 4).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <div className="modal-source">
              {current.url ? (
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
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
                    window.open(current.url, "_blank", "noopener,noreferrer");
                    setJustOpenedExternal(true);
                    onToast("Fuente abierta. Te animamos a valorarla al volver.");
                  }}
                >
                  Abrir fuente externa
                </button>
              ) : (
                <span className="hint">No hay URL externa para esta noticia.</span>
              )}
            </div>

            {current.url ? (
              <section className="rating-box">
                <h3>¿Te resultó útil esta noticia?</h3>
                <p className="hint">
                  Tu valoración ayuda al grupo a priorizar mejor. Si aportas fuentes fiables de forma consistente, tu criterio pesa más.
                </p>
                {!canRate ? (
                  <p className="warning">Primero abre la fuente externa para habilitar la valoración.</p>
                ) : (
                  <div className="rating-actions">
                    <button
                      type="button"
                      className={currentUserVote === 1 ? "btn btn-primary" : "btn"}
                      disabled={ratingBusy}
                      onClick={async () => {
                        if (!current) return;
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
                      Positiva
                    </button>
                    <button
                      type="button"
                      className={currentUserVote === -1 ? "btn btn-primary" : "btn"}
                      disabled={ratingBusy}
                      onClick={async () => {
                        if (!current) return;
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
                      Negativa
                    </button>
                  </div>
                )}
                {justOpenedExternal ? <p className="hint">Gracias por revisar la fuente antes de valorar.</p> : null}
              </section>
            ) : null}

            <CommentsPanel
              post={current}
              usersById={usersById}
              activeUserId={activeUserId}
              onAddComment={onAddComment}
              onVoteCommentAura={onVoteCommentAura}
              onPostUpdate={setCurrent}
              onToast={onToast}
            />

            <section className="related-block">
              <h3>Noticias relacionadas</h3>
              <div className="related-list">
                {related.map((item) => (
                  <button key={item.id} type="button" className="related-item" onClick={() => setCurrent(item)}>
                    <strong>{displayTitle(item)}</strong>
                    <span>{item.topics.slice(0, 2).join(" · ")} · Aura {formatAuraScore(item.interestScore)}/100</span>
                  </button>
                ))}
              </div>
            </section>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
