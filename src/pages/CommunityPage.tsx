import { useMemo, useState } from "react";
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
  onUpdateCommunity: (input: { name?: string; description?: string; rulesText?: string }) => Promise<unknown>;
  onCreateInvite: () => Promise<{ id: string; code: string; token: string; link: string }>;
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
  onUpdateCommunity,
  onCreateInvite,
  onLeaveCommunity,
  onLogout,
  onOpenShareModal,
  onToast
}: CommunityPageProps) => {
  const { language } = useI18n();
  const isAdmin = activeUser.role === "admin";

  const [nameInput, setNameInput] = useState(selectedCommunity?.name ?? "");
  const [descriptionInput, setDescriptionInput] = useState(selectedCommunity?.description ?? "");
  const [rulesInput, setRulesInput] = useState(rulesText ?? "");
  const [invite, setInvite] = useState<{ code: string; token: string; link: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const inviteUrl = useMemo(() => {
    if (!invite?.token) return "";
    return `${window.location.origin}${window.location.pathname}#/login?invite=${invite.token}`;
  }, [invite]);

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      onToast?.(pick(language, `${label} copiado.`, `${label} copied.`));
    } catch {
      onToast?.(pick(language, "No se pudo copiar.", "Could not copy."));
    }
  };

  const saveCommunity = async () => {
    setSaving(true);
    try {
      await onUpdateCommunity({
        name: nameInput.trim(),
        description: descriptionInput.trim(),
        rulesText: rulesInput.trim()
      });
      onToast?.(pick(language, "Comunidad actualizada.", "Community updated."));
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : pick(language, "No se pudo guardar.", "Could not save."));
    } finally {
      setSaving(false);
    }
  };

  const generateInvite = async () => {
    try {
      const created = await onCreateInvite();
      setInvite({ code: created.code, token: created.token, link: created.link });
      onToast?.(pick(language, "Invitación creada.", "Invite created."));
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : pick(language, "No se pudo crear invite.", "Could not create invite."));
    }
  };

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
          <h2><Icon name="users" /> {pick(language, "Comunidad y miembros", "Community & members")}</h2>
          <Link to="/home" className="btn">
            <Icon name="arrowLeft" /> {pick(language, "Volver al feed", "Back to feed")}
          </Link>
        </div>

        <article className="settings-card">
          <h3>{pick(language, "Datos de la comunidad", "Community details")}</h3>
          <div className="stack">
            <label className="form-field">
              {pick(language, "Nombre", "Name")}
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            <label className="form-field">
              {pick(language, "Descripción", "Description")}
              <input
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            <label className="form-field">
              {pick(language, "Normas", "Rules")}
              <textarea
                rows={4}
                value={rulesInput}
                onChange={(event) => setRulesInput(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            {isAdmin ? (
              <button type="button" className="btn btn-primary" onClick={saveCommunity} disabled={saving}>
                <Icon name="check" /> {pick(language, "Guardar cambios", "Save changes")}
              </button>
            ) : (
              <p className="hint">{pick(language, "Solo admins pueden editar esta sección.", "Only admins can edit this section.")}</p>
            )}
          </div>
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
            <h3><Icon name="link" /> {pick(language, "Invitar nuevos miembros", "Invite new members")}</h3>
            <div className="stack">
              <button type="button" className="btn btn-primary" onClick={generateInvite}>
                <Icon name="plus" /> {pick(language, "Generar invitación", "Generate invite")}
              </button>
              {invite ? (
                <>
                  <div className="hint">{pick(language, "Código de comunidad", "Community code")}: <strong>{invite.code}</strong></div>
                  <div className="hint" style={{ wordBreak: "break-all" }}>{inviteUrl}</div>
                  <div className="auth-entry-actions">
                    <button type="button" className="btn" onClick={() => copy(invite.code, pick(language, "Código", "Code"))}>
                      <Icon name="link" /> {pick(language, "Copiar código", "Copy code")}
                    </button>
                    <button type="button" className="btn" onClick={() => copy(inviteUrl, pick(language, "Enlace", "Link"))}>
                      <Icon name="link" /> {pick(language, "Copiar enlace", "Copy link")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="hint">{pick(language, "Crea un código o enlace para que se unan.", "Create a code or link so others can join.")}</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
};
