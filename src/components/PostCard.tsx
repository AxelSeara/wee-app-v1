import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { pick, useI18n } from "../lib/i18n";
import { EASE_STANDARD, MOTION_DURATION, VIEWPORT_ONCE } from "../lib/motion";
import { displayTitle, formatAuraScore, previewImage, topicIntro } from "../lib/presentation";
import { topicColorVars } from "../lib/topicColors";
import type { Post } from "../lib/types";
import { Icon } from "./Icon";

interface PostCardProps {
  post: Post;
  canDelete?: boolean;
  onDelete?: (postId: string) => void;
  onOpenDetail?: (post: Post) => void;
}

export const PostCard = ({ post, canDelete = false, onDelete, onOpenDetail }: PostCardProps) => {
  const { language } = useI18n();
  const navigate = useNavigate();
  const title = displayTitle(post);
  const coverImage = previewImage(post);
  const intro = topicIntro(post.topics, language);
  const auraHealthClass =
    post.interestScore >= 75 ? "aura-health-good" : post.interestScore >= 50 ? "aura-health-warn" : "aura-health-bad";
  const snippet = (post.text ?? "").trim();
  const deleteTooltip = pick(language, "Clica aquí para eliminar", "Click here to delete", "Clica aquí para eliminar");

  const openDetail = () => onOpenDetail?.(post);

  return (
    <motion.article
      className={`post-card ${onOpenDetail ? "post-card-clickable" : ""}`}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: MOTION_DURATION.base, ease: EASE_STANDARD }}
      whileHover={onOpenDetail ? { y: -4, borderColor: "#5b8dcc" } : { y: -3 }}
      onClick={onOpenDetail ? openDetail : undefined}
      role={onOpenDetail ? "button" : undefined}
      tabIndex={onOpenDetail ? 0 : -1}
      onKeyDown={
        onOpenDetail
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDetail();
              }
            }
          : undefined
      }
    >
      {coverImage ? (
        <div className="post-media">
          <img src={coverImage} alt={title} loading="lazy" />
          <div className="post-media-topics">
            {post.topics.slice(0, 3).map((topic) => (
              <button
                type="button"
                className="chip chip-action chip-topic"
                key={topic}
                style={topicColorVars(topic)}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/topic/${topic}`);
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!coverImage ? (
        <div className="chips chips-inline">
          {post.topics.slice(0, 3).map((topic) => (
            <button
              type="button"
              className="chip chip-action chip-topic"
              key={topic}
              style={topicColorVars(topic)}
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/topic/${topic}`);
              }}
            >
              {topic}
            </button>
          ))}
        </div>
      ) : null}

      <div className="post-header-row post-header-grid">
        <h3>{title}</h3>
        <div className="post-header-actions">
          <span className={`badge aura-health ${auraHealthClass}`}>
            {pick(language, "Aura", "Aura")} {formatAuraScore(post.interestScore)}/100
          </span>
        </div>
      </div>

      {canDelete && onDelete ? (
        <button
          type="button"
          className="delete-chip delete-chip-corner"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(post.id);
          }}
          title={deleteTooltip}
          aria-label={deleteTooltip}
          data-tooltip={deleteTooltip}
        >
          <Icon name="trash" size={13} />
        </button>
      ) : null}

      <p className="topic-intro">{intro}</p>
      {snippet ? <p className="post-text post-snippet">{snippet}</p> : null}

    </motion.article>
  );
};
