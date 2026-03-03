import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { pick, useI18n } from "../lib/i18n";
import { Avatar } from "./Avatar";
import type { Post, User } from "../lib/types";

interface CommentActionResult {
  ok: boolean;
  message: string;
  post?: Post;
}

interface CommentsPanelProps {
  post: Post;
  usersById: Map<string, User>;
  activeUserId: string | null;
  onAddComment: (postId: string, text: string) => Promise<CommentActionResult>;
  onVoteCommentAura: (postId: string, commentId: string) => Promise<CommentActionResult>;
  onPostUpdate?: (post: Post) => void;
  onToast: (message: string) => void;
  compact?: boolean;
}

const relativeTime = (timestamp: number, language: "es" | "en" | "gl"): string => {
  const diffMs = Date.now() - timestamp;
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) {
    if (language === "en") return `${mins}m ago`;
    if (language === "gl") return `hai ${mins}m`;
    return `hace ${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    if (language === "en") return `${hours}h ago`;
    if (language === "gl") return `hai ${hours}h`;
    return `hace ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  if (language === "en") return `${days}d ago`;
  if (language === "gl") return `hai ${days}d`;
  return `hace ${days}d`;
};

export const CommentsPanel = ({
  post,
  usersById,
  activeUserId,
  onAddComment,
  onVoteCommentAura,
  onPostUpdate,
  onToast,
  compact = false
}: CommentsPanelProps) => {
  const { language } = useI18n();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const comments = post.comments ?? [];

  const sortedComments = useMemo(
    () =>
      [...comments].sort((a, b) => {
        const auraA = a.auraUserIds?.length ?? 0;
        const auraB = b.auraUserIds?.length ?? 0;
        if (auraB !== auraA) return auraB - auraA;
        return b.createdAt - a.createdAt;
      }),
    [comments]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    const result = await onAddComment(post.id, text);
    onToast(result.message);
    if (result.ok) {
      setDraft("");
      if (result.post && onPostUpdate) onPostUpdate(result.post);
    }
    setBusy(false);
  };

  return (
    <section className={compact ? "comments-panel comments-panel-compact" : "comments-panel"}>
      <div className="comments-head">
        <h4>{pick(language, "Comentarios", "Comments")}</h4>
        <span className="badge">{comments.length}</span>
      </div>

      <form className="comments-form" onSubmit={submit}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={pick(language, "Añade contexto, corrige un dato o comparte una fuente...", "Add context, correct a detail or share a source...")}
          maxLength={320}
          disabled={!activeUserId || busy}
        />
        <button type="submit" className="btn" disabled={!activeUserId || busy}>
          {pick(language, "Publicar", "Post")}
        </button>
      </form>

      <div className="comments-list">
        {sortedComments.length === 0 ? (
          <p className="hint">{pick(language, "Aún no hay comentarios.", "No comments yet.")}</p>
        ) : (
          sortedComments.slice(0, compact ? 3 : 12).map((comment) => {
            const author = usersById.get(comment.userId);
            const auraCount = comment.auraUserIds?.length ?? 0;
            const auraActive = !!activeUserId && (comment.auraUserIds ?? []).includes(activeUserId);
            return (
              <article key={comment.id} className="comment-item">
                <header>
                  {author ? <Avatar user={author} size={22} /> : null}
                  {author ? <Link to={`/profile/${author.id}/posts`} className="comment-author-link">{author.alias}</Link> : <strong>{pick(language, "usuario", "user")}</strong>}
                  <span className="hint">{relativeTime(comment.createdAt, language)}</span>
                </header>
                <p>{comment.text}</p>
                <button
                  type="button"
                  className={auraActive ? "btn btn-primary aura-btn" : "btn aura-btn"}
                  disabled={!activeUserId}
                  onClick={async () => {
                    const result = await onVoteCommentAura(post.id, comment.id);
                    onToast(result.message);
                    if (result.ok && result.post && onPostUpdate) onPostUpdate(result.post);
                  }}
                >
                  Aura {auraCount}
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
