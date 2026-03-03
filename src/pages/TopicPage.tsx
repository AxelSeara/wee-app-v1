import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CommentsPanel } from "../components/CommentsPanel";
import { Icon } from "../components/Icon";
import { PostCard } from "../components/PostCard";
import { pick, useI18n } from "../lib/i18n";
import { extractNewsDate, formatNewsDate } from "../lib/presentation";
import { rankTopicPosts, topicForumScore } from "../lib/topicForum";
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
  onToast
}: TopicPageProps) => {
  const { language } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const topic = params.topic ?? "";
  const [renameTopic, setRenameTopic] = useState(topic);
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

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />
      <section className="page-section">
        <div className="section-head">
          <h2><Icon name="tag" /> {pick(language, "Hilo", "Thread")}: {topic}</h2>
          <Link to="/home" className="link-btn">
            <Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}
          </Link>
        </div>
        {isAdmin ? (
          <div className="detail-actions">
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
          </div>
        ) : null}
        <p className="section-intro">{pick(language, "Timeline del tema, ordenado por relevancia, Aura comunitaria y actualidad.", "Topic timeline, sorted by relevance, community Aura and recency.")}</p>
        {topicPosts.length === 0 ? (
          <article className="empty-state">
            <h3>{pick(language, "Aún no hay publicaciones en este hilo", "No posts in this thread yet")}</h3>
            <p>{pick(language, "Comparte la primera noticia para arrancarlo.", "Share the first post to kick it off.")}</p>
          </article>
        ) : (
          <div className="timeline">
            {topicPosts.map(({ post, eventDate, forumScore }) => (
              <article key={post.id} className="timeline-item">
                <div className="timeline-rail">
                  <span className="timeline-dot" />
                  <span className="timeline-date">{formatNewsDate(eventDate)}</span>
                </div>
                <div className="timeline-card">
                  <p className="timeline-score"><Icon name="timeline" size={14} /> {pick(language, "Relevancia del tema", "Topic relevance")}: {Math.round(forumScore)}</p>
                  <PostCard post={post} onOpenDetail={(entry) => navigate(`/post/${entry.id}`)} />
                  <CommentsPanel
                    post={post}
                    usersById={usersById}
                    activeUserId={activeUserId}
                    onAddComment={onAddComment}
                    onVoteCommentAura={onVoteCommentAura}
                    onDeleteComment={onAdminDeleteComment}
                    canModerateComments={isAdmin}
                    onToast={onToast}
                    compact
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
