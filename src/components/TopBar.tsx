import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { pick, useI18n } from "../lib/i18n";
import { getSelectedCommunity } from "../lib/communitySession";
import type { User } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { NotificationsMenu } from "./NotificationsMenu";

interface TopBarProps {
  user: User;
  communityName?: string;
  onLeaveCommunity?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onOpenShare?: () => void;
  onLogout?: () => void;
}

export const TopBar = ({ user, communityName, onLeaveCommunity, searchValue, onSearchChange, onOpenShare, onLogout }: TopBarProps) => (
  <TopBarInner
    user={user}
    communityName={communityName}
    onLeaveCommunity={onLeaveCommunity}
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    onOpenShare={onOpenShare}
    onLogout={onLogout}
  />
);

const TopBarInner = ({ user, communityName, onLeaveCommunity, searchValue, onSearchChange, onOpenShare, onLogout }: TopBarProps) => {
  const { language } = useI18n();
  const fallbackCommunity = getSelectedCommunity();
  const communityLabel = communityName ?? fallbackCommunity?.name;
  const [communityOpen, setCommunityOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const communityMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (communityMenuRef.current && !communityMenuRef.current.contains(event.target as Node)) setCommunityOpen(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setProfileOpen(false);
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCommunityOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <header className="topbar">
      <Link to="/home" className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="spiral" size={13} />
        </span>
        <span className="brand-copy">
          <span className="brand-text">Wee</span>
          <span className="brand-tag">{communityLabel ? `${communityLabel}` : pick(language, "microcomunidad", "microcommunity")}</span>
        </span>
      </Link>

      {onSearchChange ? (
        <label className="topbar-search" aria-label={pick(language, "Buscar por tema o palabra", "Search by topic or keyword")}>
          <Icon name="search" size={14} />
          <input
            value={searchValue ?? ""}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={pick(language, "Buscar tema, palabra o fuente...", "Search topic, keyword or source...")}
          />
        </label>
      ) : null}

      <div className="topbar-right">
        {onOpenShare ? (
          <button type="button" className="btn btn-primary" onClick={onOpenShare}>
            <Icon name="plus" size={14} /> {pick(language, "Compartir enlace", "Share link")}
          </button>
        ) : (
          <Link to="/share" className="btn btn-primary">
            <Icon name="plus" size={14} /> {pick(language, "Compartir enlace", "Share link")}
          </Link>
        )}

        <NotificationsMenu />

        <div className="topbar-user-menu" ref={communityMenuRef}>
          <button
            type="button"
            className="user-link user-menu-trigger"
            onClick={() => {
              setCommunityOpen((curr) => !curr);
              setProfileOpen(false);
            }}
            aria-expanded={communityOpen}
            aria-haspopup="menu"
          >
            <Icon name="users" size={13} />
            <span>{pick(language, "Comunidad", "Community")}</span>
            <span className="user-menu-caret">▾</span>
          </button>

          {communityOpen ? (
            <div className="user-menu-dropdown" role="menu" aria-label={pick(language, "Menú de comunidad", "Community menu")}>
              <Link to="/community" role="menuitem" className="user-menu-item" onClick={() => setCommunityOpen(false)}>
                <Icon name="book" size={13} /> {pick(language, "Ver normas y miembros", "View rules & members")}
              </Link>
              <Link to="/login" role="menuitem" className="user-menu-item" onClick={() => setCommunityOpen(false)}>
                <Icon name="users" size={13} /> {pick(language, "Cambiar comunidad", "Switch community")}
              </Link>
              {onLeaveCommunity ? (
                <button
                  type="button"
                  role="menuitem"
                  className="user-menu-item user-menu-item-danger"
                  onClick={() => {
                    setCommunityOpen(false);
                    onLeaveCommunity();
                  }}
                >
                  <Icon name="logout" size={13} /> {pick(language, "Salir de comunidad", "Leave community")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="topbar-user-menu" ref={profileMenuRef}>
          <button
            type="button"
            className="user-link user-menu-trigger"
            onClick={() => {
              setProfileOpen((curr) => !curr);
              setCommunityOpen(false);
            }}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <Avatar user={user} size={32} />
            <span><Icon name="user" size={13} /> {user.alias}</span>
            <span className="user-menu-caret">▾</span>
          </button>

          {profileOpen ? (
            <div className="user-menu-dropdown" role="menu" aria-label={pick(language, "Menú de perfil", "Profile menu")}>
              <div className="user-menu-header">
                <Avatar user={user} size={28} />
                <div>
                  <strong>{user.alias}</strong>
                  <span>{pick(language, "Cuenta", "Account", "Conta")}</span>
                </div>
              </div>
              <Link to={`/profile/${user.id}`} role="menuitem" className="user-menu-item" onClick={() => setProfileOpen(false)}>
                <Icon name="user" size={13} /> {pick(language, "Perfil", "Profile")}
              </Link>
              <Link
                to={`/profile/${user.id}/posts`}
                role="menuitem"
                className="user-menu-item"
                onClick={() => setProfileOpen(false)}
              >
                <Icon name="news" size={13} /> {pick(language, "Mis publicaciones", "My posts")}
              </Link>
              <Link to="/settings" role="menuitem" className="user-menu-item" onClick={() => setProfileOpen(false)}>
                <Icon name="settings" size={13} /> {pick(language, "Ajustes", "Settings")}
              </Link>
              {onLogout ? (
                <button
                  type="button"
                  role="menuitem"
                  className="user-menu-item user-menu-item-danger"
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                >
                  <Icon name="logout" size={13} /> {pick(language, "Cerrar sesión", "Log out", "Pechar sesión")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
