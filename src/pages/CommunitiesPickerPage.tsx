import { type FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { pick, useI18n } from "../lib/i18n";
import type { CommunitySelection } from "../lib/communitySession";
import type { CommunityListItem } from "../lib/communityApi";
import { parseCommunityJoinInput, shouldAutoEnterDefaultCommunity } from "../lib/communityNavigation";

interface CommunitiesPickerPageProps {
  communities: CommunityListItem[];
  defaultCommunityId?: string;
  skipPicker?: boolean;
  onReload: () => Promise<void>;
  onEnterCommunity: (communityId: string) => Promise<void>;
  onCreateCommunity: (input: {
    name: string;
    description?: string;
    rulesText?: string;
    invitePolicy: "admins_only" | "members_allowed";
  }) => Promise<CommunitySelection>;
  onPreviewCommunity: (input: { code?: string; token?: string }) => Promise<CommunitySelection>;
  onJoinCommunity: (input: { code?: string; token?: string }) => Promise<CommunitySelection>;
  onSaveSettings: (input: { defaultCommunityId?: string | null; skipPicker?: boolean }) => Promise<void>;
}

export const CommunitiesPickerPage = ({
  communities,
  defaultCommunityId,
  skipPicker,
  onReload,
  onEnterCommunity,
  onCreateCommunity,
  onPreviewCommunity,
  onJoinCommunity,
  onSaveSettings
}: CommunitiesPickerPageProps) => {
  const { language } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const toFriendlyError = (raw: unknown, fallbackEs: string, fallbackEn: string, fallbackGl: string) => {
    const message = raw instanceof Error ? raw.message : "";
    if (message.includes("COMMUNITY_NAME_EXISTS")) {
      return pick(language, "Ya existe una comunidad con ese nombre.", "A community with that name already exists.", "Xa existe unha comunidade con ese nome.");
    }
    return raw instanceof Error ? raw.message : pick(language, fallbackEs, fallbackEn, fallbackGl);
  };
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [invitePolicy, setInvitePolicy] = useState<"admins_only" | "members_allowed">("admins_only");
  const [joinCode, setJoinCode] = useState("");
  const [joinPreview, setJoinPreview] = useState<CommunitySelection | null>(null);
  const [persistChoice, setPersistChoice] = useState(Boolean(skipPicker));
  const [creatingCommunity, setCreatingCommunity] = useState(false);
  const [previewingJoin, setPreviewingJoin] = useState(false);
  const [confirmingJoin, setConfirmingJoin] = useState(false);

  useEffect(() => {
    setPersistChoice(Boolean(skipPicker));
  }, [skipPicker]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const inviteToken = query.get("invite");
    if (inviteToken) {
      setJoinOpen(true);
      setJoinCode(inviteToken);
    }
  }, [location.search]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const canAutoEnter = shouldAutoEnterDefaultCommunity({
      skipPicker,
      defaultCommunityId,
      availableCommunityIds: communities.map((entry) => entry.community_id),
      hasInviteQuery: Boolean(query.get("invite"))
    });
    if (!canAutoEnter || !defaultCommunityId) return;
    void enter(defaultCommunityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipPicker, defaultCommunityId, communities, location.search]);

  const enter = async (communityId: string) => {
    setError(null);
    setLoadingId(communityId);
    try {
      await onEnterCommunity(communityId);
      if (persistChoice) {
        await onSaveSettings({ defaultCommunityId: communityId, skipPicker: true });
      } else {
        await onSaveSettings({ defaultCommunityId: null, skipPicker: false });
      }
      navigate("/home");
    } catch (err) {
      setError(toFriendlyError(err, "No pudimos abrir la comunidad.", "Could not open community.", "Non puidemos abrir a comunidade."));
    } finally {
      setLoadingId(null);
    }
  };

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!communityName.trim() || creatingCommunity) return;
    setCreatingCommunity(true);
    setError(null);
    try {
      const created = await onCreateCommunity({
        name: communityName.trim(),
        description: communityDescription.trim() || undefined,
        invitePolicy,
        rulesText: undefined
      });
      await onReload();
      await enter(created.id);
    } catch (err) {
      setError(toFriendlyError(err, "No pudimos crear la comunidad.", "Could not create community.", "Non puidemos crear a comunidade."));
    } finally {
      setCreatingCommunity(false);
    }
  };

  const submitPreview = async (event: FormEvent) => {
    event.preventDefault();
    if (previewingJoin) return;
    const parsed = parseCommunityJoinInput(joinCode);
    if (!parsed.code && !parsed.token) return;
    setPreviewingJoin(true);
    setError(null);
    try {
      setJoinPreview(await onPreviewCommunity(parsed));
    } catch (err) {
      setError(toFriendlyError(err, "Código o link no válido.", "Invalid code or link.", "Código ou ligazón non válido."));
    } finally {
      setPreviewingJoin(false);
    }
  };

  const confirmJoin = async () => {
    if (!joinPreview || confirmingJoin) return;
    setConfirmingJoin(true);
    setError(null);
    try {
      await onJoinCommunity(parseCommunityJoinInput(joinCode));
      await onReload();
      await enter(joinPreview.id);
    } catch (err) {
      setError(toFriendlyError(err, "No pudimos unirte.", "Could not join.", "Non puidemos unirte."));
    } finally {
      setConfirmingJoin(false);
    }
  };

  return (
    <main className="page-section narrow">
      <div className="section-head">
        <h2><Icon name="users" /> {pick(language, "Tus comunidades", "Your communities", "As túas comunidades")}</h2>
      </div>
      <p className="section-intro">{pick(language, "Elige dónde quieres entrar.", "Pick where you want to enter.", "Escolle onde queres entrar.")}</p>

      <label className="consent-row">
        <input
          type="checkbox"
          checked={persistChoice}
          onChange={(event) => setPersistChoice(event.target.checked)}
        />
        <span>{pick(language, "Entrar siempre aquí la próxima vez", "Always enter here next time", "Entrar sempre aquí a próxima vez")}</span>
      </label>

      <div className="topic-grid">
        {communities.map((community) => (
          <article key={community.community_id} className="topic-block">
            <h3>{community.name}</h3>
            {community.description ? <p className="hint">{community.description}</p> : null}
            <p className="hint">{pick(language, "Rol", "Role", "Rol")}: {community.role}</p>
            <button type="button" className="btn btn-primary" onClick={() => void enter(community.community_id)} disabled={loadingId === community.community_id}>
              <Icon name="check" /> {loadingId === community.community_id ? pick(language, "Entrando...", "Entering...", "Entrando...") : pick(language, "Entrar", "Enter", "Entrar")}
            </button>
          </article>
        ))}
      </div>

      <div className="auth-entry-actions" style={{ marginTop: "1rem" }}>
        <button type="button" className="btn" onClick={() => setCreateOpen((v) => !v)}>
          <Icon name="plus" /> {pick(language, "Crear comunidad", "Create community", "Crear comunidade")}
        </button>
        <button type="button" className="btn" onClick={() => setJoinOpen((v) => !v)}>
          <Icon name="link" /> {pick(language, "Unirme por código/link", "Join with code/link", "Unirme por código/ligazón")}
        </button>
      </div>

      {createOpen ? (
        <form className="stack" style={{ marginTop: "0.8rem" }} onSubmit={submitCreate}>
          <label className="form-field">{pick(language, "Nombre", "Name", "Nome")}<input value={communityName} onChange={(event) => setCommunityName(event.target.value)} /></label>
          <label className="form-field">{pick(language, "Descripción", "Description", "Descrición")}<input value={communityDescription} onChange={(event) => setCommunityDescription(event.target.value)} /></label>
          <label className="form-field">{pick(language, "Invitaciones", "Invites", "Invitacións")}
            <select value={invitePolicy} onChange={(event) => setInvitePolicy(event.target.value as "admins_only" | "members_allowed")}>
              <option value="admins_only">{pick(language, "Solo admins", "Admins only", "Só admins")}</option>
              <option value="members_allowed">{pick(language, "Todos", "Everyone", "Todos")}</option>
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={creatingCommunity}>
            <Icon name="check" /> {creatingCommunity ? pick(language, "Creando...", "Creating...", "Creando...") : pick(language, "Crear y entrar", "Create and enter", "Crear e entrar")}
          </button>
        </form>
      ) : null}

      {joinOpen ? (
        <form className="stack" style={{ marginTop: "0.8rem" }} onSubmit={submitPreview}>
          <label className="form-field">{pick(language, "Código o link", "Code or link", "Código ou ligazón")}<input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} /></label>
          <button type="submit" className="btn" disabled={previewingJoin}>
            <Icon name="eye" /> {previewingJoin ? pick(language, "Mirando...", "Checking...", "Mirando...") : pick(language, "Previsualizar", "Preview", "Previsualizar")}
          </button>
          {joinPreview ? (
            <article className="invite-preview-card">
              <h3>{joinPreview.name}</h3>
              {joinPreview.description ? <p className="hint">{joinPreview.description}</p> : null}
              <button type="button" className="btn btn-primary" onClick={() => void confirmJoin()} disabled={confirmingJoin}>
                <Icon name="check" /> {confirmingJoin ? pick(language, "Entrando...", "Entering...", "Entrando...") : pick(language, "Confirmar y entrar", "Confirm and enter", "Confirmar e entrar")}
              </button>
            </article>
          ) : null}
        </form>
      ) : null}

      {error ? <p className="error" style={{ marginTop: "0.8rem" }}>{error}</p> : null}
    </main>
  );
};
