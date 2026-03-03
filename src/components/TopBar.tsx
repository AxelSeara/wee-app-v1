import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { pick, useI18n } from "../lib/i18n";
import type { User } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface TopBarProps {
  user: User;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onOpenShare?: () => void;
}

export const TopBar = ({ user, searchValue, onSearchChange, onOpenShare }: TopBarProps) => (
  <TopBarInner user={user} searchValue={searchValue} onSearchChange={onSearchChange} onOpenShare={onOpenShare} />
);

const TopBarInner = ({ user, searchValue, onSearchChange, onOpenShare }: TopBarProps) => {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
          <span className="brand-tag">{pick(language, "microcomunidad", "microcommunity")}</span>
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

        <div className="topbar-user-menu" ref={menuRef}>
          <button
            type="button"
            className="user-link user-menu-trigger"
            onClick={() => setOpen((curr) => !curr)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <Avatar user={user} size={32} />
            <span><Icon name="user" size={13} /> {user.alias}</span>
            <span className="user-menu-caret">▾</span>
          </button>

          {open ? (
            <div className="user-menu-dropdown" role="menu" aria-label={pick(language, "Menú de perfil", "Profile menu")}>
              <div className="user-menu-header">
                <Avatar user={user} size={28} />
                <div>
                  <strong>{user.alias}</strong>
                  <span>{pick(language, "Cuenta", "Account", "Conta")}</span>
                </div>
              </div>
              <Link to={`/profile/${user.id}`} role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
                <Icon name="user" size={13} /> {pick(language, "Perfil", "Profile")}
              </Link>
              <Link
                to={`/profile/${user.id}/posts`}
                role="menuitem"
                className="user-menu-item"
                onClick={() => setOpen(false)}
              >
                <Icon name="news" size={13} /> {pick(language, "Mis publicaciones", "My posts")}
              </Link>
              <Link to="/settings" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
                <Icon name="settings" size={13} /> {pick(language, "Ajustes", "Settings")}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
