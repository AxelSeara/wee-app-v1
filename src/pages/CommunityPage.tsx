import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    setNameInput(selectedCommunity?.name ?? "");
    setDescriptionInput(selectedCommunity?.description ?? "");
  }, [selectedCommunity?.name, selectedCommunity?.description]);

  useEffect(() => {
    setRulesInput(rulesText ?? "");
  }, [rulesText]);

  const inviteUrl = useMemo(() => {
    if (!invite?.token) return "";
    return `${window.location.origin}${window.location.pathname}#/invite/${invite.token}`;
  }, [invite]);

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      onToast?.(pick(language, `${label} copiado.`, `${label} copied.`, `${label} copiado.`));
    } catch {
      onToast?.(pick(language, "No se pudo copiar.", "Could not copy.", "Non se puido copiar."));
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
      onToast?.(error instanceof Error ? error.message : pick(language, "No se pudo guardar.", "Could not save.", "Non se puido gardar."));
    } finally {
      setSaving(false);
    }
  };

  const generateInvite = async () => {
    try {
      const created = await onCreateInvite();
      setInvite({ code: created.code, token: created.token, link: created.link });
      onToast?.(pick(language, "Invitación creada.", "Invite created.", "Invitación creada."));
    } catch (error) {
      onToast?.(
        error instanceof Error
          ? error.message
          : pick(language, "No se pudo crear la invitación.", "Could not create invite.", "Non se puido crear a invitación.")
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
          <h3>{pick(language, "Datos de la comunidad", "Community details", "Datos da comunidade")}</h3>
          <p className="hint">
            {pick(
              language,
              "Aquí ajustas el nombre, descripción y normas para que todos tengáis el mismo contexto.",
              "Adjust name, description, and rules so everyone shares the same context.",
              "Aquí axustas nome, descrición e normas para compartir o mesmo contexto."
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
              <p className="hint">{pick(language, "Solo los admins pueden editar esta sección.", "Only admins can edit this section.", "Só os admins poden editar esta sección.")}</p>
            )}
          </div>
        </article>

        <div className="settings-grid">
          <article className="settings-card">
            <h3><Icon name="users" /> {pick(language, "Miembros", "Members", "Membros")}</h3>
            <p className="hint">{pick(language, "Quién está dentro y quién puede moderar.", "Who is in and who can moderate.", "Quen está dentro e quen pode moderar.")}</p>
            {members.length === 0 ? <p className="hint">{pick(language, "Sin miembros aún.", "No members yet.", "Aínda non hai membros.")}</p> : null}
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
            <h3><Icon name="link" /> {pick(language, "Invitar nuevos miembros", "Invite new members", "Convidar novos membros")}</h3>
            <p className="hint">{pick(language, "Comparte código o enlace para que se unan en un paso.", "Share code or link so people can join in one step.", "Comparte código ou ligazón para unirse nun paso.")}</p>
            <div className="stack">
              <button type="button" className="btn btn-primary" onClick={generateInvite}>
                <Icon name="plus" /> {pick(language, "Generar invitación", "Generate invite", "Xerar invitación")}
              </button>
              {invite ? (
                <>
                  <div className="hint">{pick(language, "Código de comunidad", "Community code", "Código da comunidade")}: <strong>{invite.code}</strong></div>
                  <div className="hint" style={{ wordBreak: "break-all" }}>{inviteUrl}</div>
                  <div className="auth-entry-actions">
                    <button type="button" className="btn" onClick={() => copy(invite.code, pick(language, "Código", "Code", "Código"))}>
                      <Icon name="link" /> {pick(language, "Copiar código", "Copy code", "Copiar código")}
                    </button>
                    <button type="button" className="btn" onClick={() => copy(inviteUrl, pick(language, "Enlace", "Link", "Ligazón"))}>
                      <Icon name="link" /> {pick(language, "Copiar enlace", "Copy link", "Copiar ligazón")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="hint">{pick(language, "Genera un código o enlace para compartirlo por donde quieras.", "Create a code or link to share anywhere.", "Xera un código ou ligazón para compartilo onde queiras.")}</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
};
