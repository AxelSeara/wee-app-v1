import { useMemo } from "react";
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
  activeUserId: string | null;
  onAddComment: (postId: string, text: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
  onVoteCommentAura: (postId: string, commentId: string) => Promise<{ ok: boolean; message: string; post?: Post }>;
  onToast: (message: string) => void;
}

export const TopicPage = ({
  activeUser,
  users,
  posts,
  onOpenShareModal,
  activeUserId,
  onAddComment,
  onVoteCommentAura,
  onToast
}: TopicPageProps) => {
  const { language } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const topic = params.topic ?? "";
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const topicPosts = rankTopicPosts(posts.filter((post) => post.topics.includes(topic)), topic).map((post) => ({
    post,
    eventDate: extractNewsDate(post),
    forumScore: topicForumScore(post, topic)
  }));

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} />
      <section className="page-section">
        <div className="section-head">
          <h2><Icon name="tag" /> {pick(language, "Hilo", "Thread")}: {topic}</h2>
          <Link to="/home" className="link-btn">
            <Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}
          </Link>
        </div>
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
