import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";
import { pick, useI18n } from "../lib/i18n";
import { EASE_STANDARD, MOTION_DURATION, VIEWPORT_ONCE } from "../lib/motion";
import { displayTitle, extractNewsDate, formatNewsDate, topicIntro } from "../lib/presentation";
import { topicColorVars } from "../lib/topicColors";
import { rankTopicPosts } from "../lib/topicForum";
import type { Post } from "../lib/types";

interface TopicBlockProps {
  topic: string;
  posts: Post[];
}

export const TopicBlock = ({ topic, posts }: TopicBlockProps) => {
  const { language } = useI18n();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const ranked = useMemo(() => rankTopicPosts(posts, topic), [posts, topic]);
  const latest = ranked[0];
  const updates = ranked.slice(0, expanded ? 4 : 1);
  const now = Date.now();
  const hotCount = ranked.filter((post) => now - post.createdAt < 1000 * 60 * 60 * 24).length;
  const veryRecentCount = ranked.filter((post) => now - post.createdAt < 1000 * 60 * 60 * 6).length;
  const chiliCount = Math.min(3, veryRecentCount);
  const style = topicColorVars(topic);
  const intro = topicIntro([topic], language);

  return (
    <motion.article
      className="topic-block"
      style={style}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: MOTION_DURATION.base, ease: EASE_STANDARD }}
      whileHover={{ y: -3 }}
      onClick={() => navigate(`/topic/${topic}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/topic/${topic}`);
        }
      }}
    >
      <div className="topic-head">
        <h4 className="topic-title">{topic}</h4>
        <span className="topic-hot-tag"><Icon name="chili" size={13} /> {pick(language, "En movimiento", "Active now")}: {hotCount}</span>
      </div>
      <p className="topic-summary">{intro}</p>
      <p className="topic-meta">{pick(language, "Publicaciones en este tema", "Posts in this topic")}: {posts.length}</p>

      {latest ? (
        <p className="topic-last-update">{pick(language, "Última actualización", "Last update")}: {formatNewsDate(extractNewsDate(latest))}</p>
      ) : null}

      <div className="topic-updates">
        {updates.map((post) => (
          <button
            key={post.id}
            className="topic-update-item"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/post/${post.id}`);
            }}
          >
            <span className="topic-update-date">{formatNewsDate(extractNewsDate(post))}</span>
            <span className="topic-update-title">{displayTitle(post)}</span>
          </button>
        ))}
      </div>

      <div className="topic-actions">
        {chiliCount > 0 ? (
          <span className="topic-recency-badge">
            <span>{pick(language, "Muy reciente", "Very recent")}</span>
            <span className="topic-recency-chilis" aria-label={pick(language, "Nivel de recencia", "Recency level")}>
              {Array.from({ length: chiliCount }).map((_, index) => (
                <Icon key={`${topic}-${index}`} name="chili" size={13} />
              ))}
            </span>
          </span>
        ) : null}
        {ranked.length > 1 ? (
          <button
            type="button"
            className="link-btn"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((curr) => !curr);
            }}
          >
            {expanded ? pick(language, "Mostrar menos", "Show less") : pick(language, "Ver últimas del hilo", "See latest in thread")}
          </button>
        ) : null}
      </div>
    </motion.article>
  );
};
