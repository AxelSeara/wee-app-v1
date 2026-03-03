import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { pick, translateBadge, translateRankTitle, useI18n } from "../lib/i18n";
import { generateAlias } from "../lib/aliasGenerator";
import { TopBar } from "../components/TopBar";
import type { Post, User, UserCommunityStats } from "../lib/types";

interface ProfilePageProps {
  activeUser: User;
  users: User[];
  posts: Post[];
  userCommunityStatsById: Map<string, UserCommunityStats>;
  onLogout: () => void;
  onUpdateAvatar: (userId: string, avatarDataUrl: string | undefined) => Promise<void>;
  onUpdateAlias: (userId: string, alias: string) => Promise<void>;
  onToast: (message: string) => void;
  onOpenShareModal?: () => void;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

export const ProfilePage = ({
  activeUser,
  users,
  posts,
  userCommunityStatsById,
  onLogout,
  onUpdateAvatar,
  onUpdateAlias,
  onToast,
  onOpenShareModal
}: ProfilePageProps) => {
  const { language } = useI18n();
  const params = useParams();
  const userId = params.userId ?? activeUser.id;
  const profileUser = users.find((user) => user.id === userId) ?? activeUser;
  const isOwnProfile = profileUser.id === activeUser.id;
  const [aliasInput, setAliasInput] = useState(profileUser.alias);

  useEffect(() => {
    setAliasInput(profileUser.alias);
  }, [profileUser.alias]);

  const userPosts = useMemo(
    () => posts.filter((post) => post.userId === profileUser.id),
    [posts, profileUser.id]
  );
  const communityStats = userCommunityStatsById.get(profileUser.id);

  const generatedAlias = (): void => {
    setAliasInput(generateAlias());
  };

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} />
      <section className="page-section">
        <div className="profile-hero">
          <div className="profile-head">
            <Avatar user={profileUser} size={74} />
            <div>
              <h2>{profileUser.alias}</h2>
              <p>{pick(language, `${userPosts.length} noticias compartidas`, `${userPosts.length} shared posts`)}</p>
            </div>
          </div>
          {isOwnProfile && communityStats ? (
            <div className="profile-rank-card">
              <h3>{translateRankTitle(language, communityStats.rankTitle)} · {pick(language, "nivel", "level")} {communityStats.level}</h3>
              <p>
                aura {communityStats.aura} · {pick(language, "nivel", "level")} {communityStats.level} ·
                {` `}{communityStats.highQualityCount} {pick(language, "aportes útiles", "useful contributions")}
              </p>
              <div className="profile-level-bar">
                <span style={{ width: `${Math.round(communityStats.levelProgress * 100)}%` }} />
              </div>
              {communityStats.badges.length > 0 ? (
                <div className="chips">
                  {communityStats.badges.map((badge) => (
                    <span key={badge} className="chip chip-subtopic">{translateBadge(language, badge)}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {isOwnProfile ? (
            <div className="profile-upload">
              <label className="btn">
                <Icon name="camera" /> {pick(language, "Cambiar foto", "Change photo")}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void fileToDataUrl(file).then((dataUrl) => {
                      void onUpdateAvatar(activeUser.id, dataUrl);
                      onToast(pick(language, "Foto de perfil actualizada.", "Profile photo updated."));
                    });
                  }}
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void onUpdateAvatar(activeUser.id, undefined);
                  onToast(pick(language, "Foto eliminada. Ahora se muestra tu avatar con iniciales.", "Photo removed. Your initials avatar is now shown."));
                }}
              >
                <Icon name="trash" /> {pick(language, "Quitar foto", "Remove photo")}
              </button>
            </div>
          ) : null}

          {isOwnProfile ? (
            <form
              className="alias-form"
              onSubmit={(event) => {
                event.preventDefault();
                const next = aliasInput.trim();
                if (!next) {
                  onToast(pick(language, "El alias es obligatorio.", "Alias is required.", "O alias é obrigatorio."));
                  return;
                }
                void onUpdateAlias(activeUser.id, next);
                onToast(pick(language, "Alias actualizado.", "Alias updated."));
              }}
            >
              <label>
                {pick(language, "Alias", "Alias", "Alias")}
                <div className="alias-row">
                  <input
                    value={aliasInput}
                    onChange={(event) => setAliasInput(event.target.value)}
                    placeholder={pick(language, "Tu alias visible", "Your visible alias")}
                  />
                  <button type="button" className="btn dice-btn" onClick={generatedAlias} title="Generar alias aleatorio">
                    <Icon name="dice" size={14} />
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {pick(language, "Guardar", "Save")}
                  </button>
                </div>
              </label>
            </form>
          ) : null}

        </div>

        <div className="profile-actions">
          <Link to={`/profile/${profileUser.id}/posts`} className="btn">
            <Icon name="news" /> {pick(language, "Ver publicaciones", "View posts", "Ver publicacións")}
          </Link>
          {isOwnProfile ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                onLogout();
              }}
            >
              <Icon name="logout" /> {pick(language, "Cerrar sesión", "Log out")}
            </button>
          ) : null}
          <Link to="/home" className="link-btn">
            <Icon name="arrowLeft" /> {pick(language, "Volver al inicio", "Back to home")}
          </Link>
        </div>
      </section>
    </main>
  );
};
