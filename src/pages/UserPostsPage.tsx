import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { PostCard } from "../components/PostCard";
import { TopBar } from "../components/TopBar";
import { pick, useI18n } from "../lib/i18n";
import type { Post, User } from "../lib/types";

interface UserPostsPageProps {
  activeUser: User;
  users: User[];
  posts: Post[];
  onDeletePost: (postId: string) => Promise<void>;
  onToast: (message: string) => void;
  onOpenShareModal?: () => void;
  onLogout: () => void;
}

export const UserPostsPage = ({
  activeUser,
  users,
  posts,
  onDeletePost,
  onToast,
  onOpenShareModal,
  onLogout
}: UserPostsPageProps) => {
  const { language } = useI18n();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const userId = params.userId ?? activeUser.id;
  const profileUser = users.find((user) => user.id === userId) ?? activeUser;
  const isOwnProfile = profileUser.id === activeUser.id;
  const canAdminDelete = activeUser.role === "admin";
  const [tab, setTab] = useState<"shared" | "quality" | "interest">("shared");

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "quality" || raw === "interest" || raw === "shared") {
      setTab(raw);
    }
  }, [searchParams]);

  const userPosts = useMemo(
    () => posts.filter((post) => post.userId === profileUser.id),
    [posts, profileUser.id]
  );

  const visiblePosts = useMemo(() => {
    if (tab === "quality") return userPosts.filter((post) => post.qualityScore >= 75);
    if (tab === "interest") return userPosts.filter((post) => post.interestScore >= 75);
    return userPosts;
  }, [tab, userPosts]);

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />
      <section className="page-section">
        <div className="profile-hero">
          <div className="profile-head">
            <Avatar user={profileUser} size={74} />
            <div>
              <h2>{profileUser.alias}</h2>
              <p>{pick(language, `${userPosts.length} noticias compartidas`, `${userPosts.length} shared posts`)}</p>
            </div>
          </div>
          <div className="profile-actions">
            {isOwnProfile ? (
              <Link to={`/profile/${profileUser.id}`} className="btn">
                <Icon name="settings" /> {pick(language, "Ajustes de perfil", "Profile settings", "Axustes de perfil")}
              </Link>
            ) : null}
            <Link to="/home" className="link-btn">
              <Icon name="arrowLeft" /> {pick(language, "Volver al inicio", "Back to home", "Volver ao inicio")}
            </Link>
          </div>
        </div>

        <div className="tabs">
          <button className={tab === "shared" ? "tab active" : "tab"} onClick={() => setTab("shared")}><Icon name="news" /> {pick(language, "Publicadas", "Posted", "Publicadas")}</button>
          <button className={tab === "quality" ? "tab active" : "tab"} onClick={() => setTab("quality")}><Icon name="check" /> {pick(language, "Mejor calidad", "Best quality", "Mellor calidade")}</button>
          <button className={tab === "interest" ? "tab active" : "tab"} onClick={() => setTab("interest")}><Icon name="heart" /> {pick(language, "Más Aura", "More Aura", "Máis Aura")}</button>
        </div>

        <div className="post-grid">
          {visiblePosts.length > 0 ? (
            visiblePosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                author={profileUser}
                onOpenDetail={(entry) => navigate(`/post/${entry.id}`)}
                canDelete={isOwnProfile || canAdminDelete}
                onDelete={(postId) => {
                  const shouldDelete = window.confirm(pick(language, "¿Eliminar esta noticia de tu perfil?", "Delete this post from your profile?", "Eliminar esta nova do teu perfil?"));
                  if (!shouldDelete) return;
                  void onDeletePost(postId);
                  onToast(pick(language, "Noticia eliminada.", "Post deleted.", "Nova eliminada."));
                }}
              />
            ))
          ) : (
            <article className="empty-state">
              <h3>{pick(language, "No hay noticias en esta vista", "There are no posts in this view", "Non hai novas nesta vista")}</h3>
              <p>{isOwnProfile ? pick(language, "Comparte un enlace para empezar tu historial.", "Share a link to start your history.", "Comparte unha ligazón para comezar o teu historial.") : pick(language, "Este usuario todavía no ha publicado aquí.", "This user has not posted here yet.", "Este usuario aínda non publicou aquí.")}</p>
            </article>
          )}
        </div>
      </section>
    </main>
  );
};
