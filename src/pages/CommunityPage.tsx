import { Link } from "react-router-dom";
import { TopBar } from "../components/TopBar";
import { Icon } from "../components/Icon";
import { pick, useI18n } from "../lib/i18n";
import type { User } from "../lib/types";

interface CommunityPageProps {
  activeUser: User;
  selectedCommunity: { id: string; name: string; description?: string; rulesText?: string } | null;
  members: Array<{ id: string; alias: string; role: "admin" | "member" }>;
  rulesText: string;
  onLeaveCommunity: () => Promise<void> | void;
  onLogout: () => void;
  onOpenShareModal?: () => void;
  onToast?: (message: string) => void;
}

export const CommunityPage = ({
  activeUser,
  selectedCommunity,
  members,
  rulesText,
  onLeaveCommunity,
  onLogout,
  onOpenShareModal,
  onToast
}: CommunityPageProps) => {
  const { language } = useI18n();

  return (
    <main>
      <TopBar
        user={activeUser}
        communityName={selectedCommunity?.name}
        onLeaveCommunity={async () => {
          await onLeaveCommunity();
          onToast?.(pick(language, "Has salido de la comunidad.", "You left the community."));
        }}
        onOpenShare={onOpenShareModal}
        onLogout={onLogout}
      />

      <section className="page-section">
        <div className="section-head">
          <h2><Icon name="users" /> {pick(language, "Comunidad", "Community")}</h2>
          <Link to="/home" className="btn">
            <Icon name="arrowLeft" /> {pick(language, "Volver al feed", "Back to feed")}
          </Link>
        </div>

        <article className="settings-card">
          <h3>{selectedCommunity?.name ?? pick(language, "Comunidad", "Community")}</h3>
          {selectedCommunity?.description ? <p className="hint">{selectedCommunity.description}</p> : null}
        </article>

        <div className="settings-grid">
          <article className="settings-card">
            <h3><Icon name="users" /> {pick(language, "Miembros", "Members")}</h3>
            {members.length === 0 ? <p className="hint">{pick(language, "Sin miembros aún.", "No members yet.")}</p> : null}
            <ul className="user-list">
              {members.map((member) => (
                <li key={member.id} className="user-option" style={{ justifyContent: "space-between" }}>
                  <span>{member.alias}</span>
                  {member.role === "admin" ? <span className="badge">Admin</span> : <span className="hint">{pick(language, "Miembro", "Member")}</span>}
                </li>
              ))}
            </ul>
          </article>

          <article className="settings-card">
            <h3><Icon name="book" /> {pick(language, "Normas", "Rules")}</h3>
            <p className="hint">
              {rulesText?.trim() || pick(language, "Todavía no hay normas escritas para esta comunidad.", "No rules written for this community yet.")}
            </p>
          </article>
        </div>
      </section>
    </main>
  );
};
