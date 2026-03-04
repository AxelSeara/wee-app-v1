import { useEffect, useState } from "react";
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
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(selectedCommunity?.name ?? "");
    setDescriptionInput(selectedCommunity?.description ?? "");
  }, [selectedCommunity?.name, selectedCommunity?.description]);

  useEffect(() => {
    setRulesInput(rulesText ?? "");
  }, [rulesText]);

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      const message = pick(language, `${label} copiado.`, `${label} copied.`, `${label} copiado.`);
      onToast?.(message);
      setCopyNotice(message);
      window.setTimeout(() => setCopyNotice(null), 1800);
    } catch {
      const message = pick(language, "No se pudo copiar, prueba de nuevo.", "Couldn't copy it, try again.", "Non se puido copiar, proba outra vez.");
      onToast?.(message);
      setCopyNotice(message);
      window.setTimeout(() => setCopyNotice(null), 1800);
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
      onToast?.(pick(language, "Comunidad actualizada.", "Community updated.", "Comunidade actualizada."));
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : pick(language, "No se guardó, inténtalo otra vez.", "Couldn't save, please try again.", "Non se gardou, inténtao outra vez."));
    } finally {
      setSaving(false);
    }
  };

  const generateInvite = async () => {
    try {
      const created = await onCreateInvite();
      setInvite({ code: created.code, token: created.token, link: created.link });
      onToast?.(pick(language, "Invitación lista para compartir.", "Invite ready to share.", "Invitación lista para compartir."));
    } catch (error) {
      onToast?.(
        error instanceof Error
          ? error.message
          : pick(language, "No pudimos crear la invitación ahora.", "We couldn't create the invite right now.", "Non puidemos crear a invitación agora.")
      );
    }
  };

  return (
    <main>
      <TopBar
        user={activeUser}
        communityName={selectedCommunity?.name}
        onLeaveCommunity={async () => {
          await onLeaveCommunity();
          onToast?.(pick(language, "Has salido de la comunidad.", "You left the community.", "Saíches da comunidade."));
        }}
        onOpenShare={onOpenShareModal}
        onLogout={onLogout}
      />

      <section className="page-section">
        <div className="section-head">
          <h2><Icon name="users" /> {pick(language, "Comunidad", "Community", "Comunidade")}</h2>
          <Link to="/home" className="btn">
            <Icon name="arrowLeft" /> {pick(language, "Volver al feed", "Back to feed", "Volver ao feed")}
          </Link>
        </div>

        <article className="settings-card">
          <h3>{pick(language, "Ajustes de comunidad", "Community settings", "Axustes da comunidade")}</h3>
          <p className="hint">
            {pick(
              language,
              "Aquí podéis dejar nombre, descripción y normas claras para todo el grupo.",
              "Set name, description and rules so everyone stays on the same page.",
              "Aquí podedes deixar nome, descrición e normas claras para todo o grupo."
            )}
          </p>
          <div className="stack">
            <label className="form-field">
              {pick(language, "Nombre", "Name", "Nome")}
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            <label className="form-field">
              {pick(language, "Descripción", "Description", "Descrición")}
              <input
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            <label className="form-field">
              {pick(language, "Normas", "Rules", "Normas")}
              <textarea
                rows={4}
                value={rulesInput}
                onChange={(event) => setRulesInput(event.target.value)}
                disabled={!isAdmin}
              />
            </label>
            {isAdmin ? (
              <button type="button" className="btn btn-primary" onClick={saveCommunity} disabled={saving}>
                <Icon name="check" /> {pick(language, "Guardar cambios", "Save changes", "Gardar cambios")}
              </button>
            ) : (
              <p className="hint">{pick(language, "Solo admins pueden editar esto.", "Only admins can edit this.", "Só admins poden editar isto.")}</p>
            )}
          </div>
        </article>

        <div className="settings-grid">
          <article className="settings-card">
            <h3><Icon name="users" /> {pick(language, "Miembros", "Members", "Membros")}</h3>
            <p className="hint">{pick(language, "Quién está dentro y quién lleva tareas de admin.", "Who is in and who has admin permissions.", "Quen está dentro e quen ten permisos admin.")}</p>
            {members.length === 0 ? <p className="hint">{pick(language, "Todavía no hay miembros.", "No members yet.", "Aínda non hai membros.")}</p> : null}
            <ul className="user-list">
              {members.map((member) => (
                <li key={member.id} className="user-option" style={{ justifyContent: "space-between" }}>
                  <span>{member.alias}</span>
                  {member.role === "admin" ? <span className="badge">Admin</span> : <span className="hint">{pick(language, "Miembro", "Member", "Membro")}</span>}
                </li>
              ))}
            </ul>
          </article>

          <article className="settings-card">
            <h3><Icon name="link" /> {pick(language, "Invitar gente", "Invite people", "Convidar xente")}</h3>
            <p className="hint">{pick(language, "De momento, comparte solo el código de comunidad.", "For now, share only the community code.", "Polo momento, comparte só o código da comunidade.")}</p>
            <div className="stack">
              <button type="button" className="btn btn-primary" onClick={generateInvite}>
                <Icon name="plus" /> {pick(language, "Crear invitación", "Create invite", "Crear invitación")}
              </button>
              {invite ? (
                <>
                  <div className="hint">{pick(language, "Código de comunidad", "Community code", "Código da comunidade")}: <strong>{invite.code}</strong></div>
                  <div className="auth-entry-actions">
                    <button type="button" className="btn" onClick={() => copy(invite.code, pick(language, "Código", "Code", "Código"))}>
                      <Icon name="link" /> {pick(language, "Copiar código", "Copy code", "Copiar código")}
                    </button>
                  </div>
                  {copyNotice ? (
                    <p className="copy-inline-toast" role="status" aria-live="polite">
                      <Icon name="check" size={13} /> {copyNotice}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="hint">{pick(language, "Crea un código y pásalo a quien quieras invitar.", "Create a code and send it to people you want to invite.", "Crea un código e pásao a quen queiras convidar.")}</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
};
