import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { generateAlias } from "../lib/aliasGenerator";
import { isStrongPassword } from "../lib/auth";
import type { CommunitySelection } from "../lib/communitySession";
import { pick, useI18n } from "../lib/i18n";
import type { AppLanguage, User } from "../lib/types";

interface LoginPageProps {
  users: User[];
  selectedCommunity: CommunitySelection | null;
  onCreateCommunity: (input: {
    name: string;
    description?: string;
    rulesText?: string;
    invitePolicy: "admins_only" | "members_allowed";
  }) => Promise<{ id: string; name: string; description?: string }>;
  onPreviewCommunity: (input: { code?: string; token?: string }) => Promise<CommunitySelection>;
  onConfirmCommunity: (input: { code?: string; token?: string }) => Promise<CommunitySelection>;
  onCreateOrLogin: (
    alias: string,
    password: string,
    avatarDataUrl?: string,
    language?: AppLanguage,
    acceptedPrivacy?: boolean
  ) => Promise<{ user: User; isNewUser: boolean }>;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export const LoginPage = ({
  users,
  selectedCommunity,
  onCreateCommunity,
  onPreviewCommunity,
  onConfirmCommunity,
  onCreateOrLogin
}: LoginPageProps) => {
  const { language } = useI18n();
  const navigate = useNavigate();

  const [view, setView] = useState<"landing" | "create_community" | "join_community" | "confirm_community" | "login" | "register">("landing");
  const [error, setError] = useState<string | null>(null);

  const [communityName, setCommunityName] = useState("");
  const [communityDescription, setCommunityDescription] = useState("");
  const [communityRules, setCommunityRules] = useState("");
  const [invitePolicy, setInvitePolicy] = useState<"admins_only" | "members_allowed">("admins_only");
  const [joinCodeOrLink, setJoinCodeOrLink] = useState("");
  const [preview, setPreview] = useState<CommunitySelection | null>(selectedCommunity);

  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [profileLanguage, setProfileLanguage] = useState<AppLanguage>("es");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => b.createdAt - a.createdAt), [users]);
  const aliasMatchesExisting = useMemo(() => users.some((user) => user.alias.toLowerCase() === alias.trim().toLowerCase()), [users, alias]);

  const resetAuth = (): void => {
    setError(null);
    setAlias("");
    setPassword("");
    setPasswordConfirm("");
    setAvatarDataUrl(undefined);
    setPrivacyAccepted(false);
  };

  const parseJoinInput = (raw: string): { code?: string; token?: string } => {
    const value = raw.trim();
    if (!value) return {};
    if (value.includes("invite=")) {
      const hash = value.split("#")[1] ?? value;
      const query = hash.includes("?") ? hash.split("?")[1] : "";
      const token = new URLSearchParams(query).get("invite") ?? undefined;
      return token ? { token } : { code: value.toUpperCase() };
    }
    if (/^[A-Za-z0-9]{12,}$/.test(value)) {
      return { token: value };
    }
    return { code: value.toUpperCase() };
  };

  const submitCreateCommunity = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (communityName.trim().length < 2) {
      setError(pick(language, "Nombre de comunidad obligatorio.", "Community name is required.", "Nome da comunidade obrigatorio."));
      return;
    }
    try {
      const created = await onCreateCommunity({
        name: communityName.trim(),
        description: communityDescription.trim() || undefined,
        rulesText: communityRules.trim() || undefined,
        invitePolicy
      });
      setPreview({ id: created.id, name: created.name, description: created.description });
      setView("register");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No se pudo crear la comunidad.", "Could not create community."));
    }
  };

  const submitPreview = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = parseJoinInput(joinCodeOrLink);
    if (!parsed.code && !parsed.token) {
      setError(pick(language, "Introduce un código o link válido.", "Enter a valid code or link."));
      return;
    }
    try {
      const data = await onPreviewCommunity(parsed);
      setPreview(data);
      setView("confirm_community");
    } catch {
      setError(pick(language, "No encontramos esa comunidad o el enlace ha expirado.", "Community not found or invite expired."));
    }
  };

  const confirmJoin = async () => {
    setError(null);
    const parsed = parseJoinInput(joinCodeOrLink);
    try {
      await onConfirmCommunity(parsed);
      setView("login");
      resetAuth();
    } catch {
      setError(pick(language, "No se pudo confirmar la invitación.", "Could not confirm invite."));
    }
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!alias.trim() || !password.trim()) {
      setError(pick(language, "Alias y contraseña son obligatorios.", "Alias and password are required."));
      return;
    }
    try {
      await onCreateOrLogin(alias.trim(), password);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No pudimos iniciar sesión.", "Could not sign in."));
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      setError(pick(language, "El alias es obligatorio.", "Alias is required."));
      return;
    }
    if (aliasMatchesExisting) {
      setError(pick(language, "Ese alias ya existe en esta comunidad.", "That alias already exists in this community."));
      return;
    }
    if (password !== passwordConfirm) {
      setError(pick(language, "Las contraseñas no coinciden.", "Passwords do not match."));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(pick(language, "La contraseña debe tener al menos 6 caracteres.", "Password must be at least 6 characters."));
      return;
    }
    if (!privacyAccepted) {
      setError(pick(language, "Debes aceptar la política de privacidad.", "You must accept the privacy policy."));
      return;
    }
    try {
      await onCreateOrLogin(cleanAlias, password, avatarDataUrl, profileLanguage, true);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No se pudo crear la cuenta.", "Could not create account."));
    }
  };

  const currentCommunity = selectedCommunity ?? preview;

  return (
    <main className={view === "register" ? "auth-layout" : "auth-layout auth-layout-single"}>
      {view === "landing" ? (
        <section className="auth-card auth-card-entry">
          <h1 className="auth-hero-title">
            <span className="auth-hero-brand">Wee</span>
            <span className="auth-hero-claim">{pick(language, "Microcomunidades con contexto", "Micro-communities with context")}</span>
          </h1>
          <p>{pick(language, "Crea una comunidad o únete con un código para compartir enlaces y debatir con orden.", "Create a community or join with a code to share links and discuss with context.")}</p>
          <div className="auth-entry-actions">
            <button type="button" className="btn btn-primary" onClick={() => setView("create_community")}>
              <Icon name="spark" /> {pick(language, "Crear comunidad", "Create community")}
            </button>
            <button type="button" className="btn" onClick={() => setView("join_community")}>
              <Icon name="users" /> {pick(language, "Unirse a comunidad", "Join community")}
            </button>
          </div>
        </section>
      ) : null}

      {view === "create_community" ? (
        <section className="auth-card auth-card-main">
          <div className="section-head">
            <h2>{pick(language, "Crear comunidad", "Create community")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}</button>
          </div>
          <form className="stack" onSubmit={submitCreateCommunity}>
            <label className="form-field">{pick(language, "Nombre", "Name")}<input value={communityName} onChange={(event) => setCommunityName(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Descripción", "Description")}<input value={communityDescription} onChange={(event) => setCommunityDescription(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Normas", "Rules")}<textarea value={communityRules} onChange={(event) => setCommunityRules(event.target.value)} rows={4} /></label>
            <label className="form-field">{pick(language, "Política de invitación", "Invite policy")}
              <select value={invitePolicy} onChange={(event) => setInvitePolicy(event.target.value as "admins_only" | "members_allowed")}>
                <option value="admins_only">{pick(language, "Solo admins", "Admins only")}</option>
                <option value="members_allowed">{pick(language, "Miembros pueden invitar", "Members can invite")}</option>
              </select>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Continuar", "Continue")}</button>
          </form>
        </section>
      ) : null}

      {view === "join_community" ? (
        <section className="auth-card auth-card-main">
          <div className="section-head">
            <h2>{pick(language, "Unirse a comunidad", "Join community")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}</button>
          </div>
          <form className="stack" onSubmit={submitPreview}>
            <label className="form-field">{pick(language, "Código o link", "Code or link")}<input value={joinCodeOrLink} onChange={(event) => setJoinCodeOrLink(event.target.value)} placeholder="ABCD1234 o #/login?invite=..." /></label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Ver comunidad", "Preview community")}</button>
          </form>
        </section>
      ) : null}

      {view === "confirm_community" && preview ? (
        <section className="auth-card auth-card-main">
          <h2>{pick(language, "Confirmar comunidad", "Confirm community")}</h2>
          <p><strong>{preview.name}</strong></p>
          {preview.description ? <p className="hint">{preview.description}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <div className="auth-entry-actions">
            <button type="button" className="btn btn-primary" onClick={confirmJoin}>{pick(language, "Confirmar", "Confirm")}</button>
            <button type="button" className="btn" onClick={() => setView("join_community")}>{pick(language, "Cambiar", "Change")}</button>
          </div>
        </section>
      ) : null}

      {view === "login" ? (
        <section className="auth-card auth-card-main">
          <div className="section-head">
            <h2>{pick(language, "Login", "Login")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}</button>
          </div>
          <p className="hint">{pick(language, "Comunidad", "Community")}: <strong>{currentCommunity?.name ?? "-"}</strong></p>
          <form onSubmit={submitLogin} className="stack">
            <label className="form-field">{pick(language, "Alias", "Alias")}<input value={alias} onChange={(event) => setAlias(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Contraseña", "Password")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Entrar", "Enter")}</button>
            <button type="button" className="btn" onClick={() => { resetAuth(); setView("register"); }}>{pick(language, "No tengo cuenta", "Create account")}</button>
          </form>
        </section>
      ) : null}

      {view === "register" ? (
        <>
          <section className="auth-card auth-card-main">
            <div className="section-head">
              <h2>{pick(language, "Registro", "Register")}</h2>
              <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}</button>
            </div>
            <p className="hint">{pick(language, "Comunidad", "Community")}: <strong>{currentCommunity?.name ?? "-"}</strong></p>
            <form onSubmit={submitRegister} className="stack">
              <label className="form-field">
                {pick(language, "Alias", "Alias")}
                <div className="alias-row">
                  <input value={alias} onChange={(event) => setAlias(event.target.value)} />
                  <button type="button" className="btn dice-btn" onClick={() => setAlias(generateAlias())}><Icon name="dice" size={14} /></button>
                </div>
              </label>
              <label className="form-field">{pick(language, "Contraseña", "Password")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label className="form-field">{pick(language, "Repite contraseña", "Repeat password")}<input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} /></label>
              <label className="form-field">{pick(language, "Idioma", "Language")}
                <select value={profileLanguage} onChange={(event) => setProfileLanguage(event.target.value as AppLanguage)}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="gl">Galego</option>
                </select>
              </label>
              <label className="form-field">{pick(language, "Foto de perfil", "Profile photo")}<input type="file" accept="image/*" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const encoded = await fileToDataUrl(file);
                setAvatarDataUrl(encoded);
              }} /></label>
              <label className="consent-row">
                <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
                <span>{pick(language, "Acepto la política de privacidad.", "I accept the privacy policy.")}</span>
              </label>
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Crear cuenta", "Create account")}</button>
            </form>
          </section>
          <section className="auth-card auth-card-community">
            <h2><Icon name="users" /> {pick(language, "Miembros de esta comunidad", "Community members")}</h2>
            {sortedUsers.length === 0 ? <p>{pick(language, "Aún no hay miembros registrados.", "No members registered yet.")}</p> : null}
            <ul className="user-list">
              {sortedUsers.map((user) => (
                <li key={user.id}>
                  <button type="button" className="user-option" onClick={() => setAlias(user.alias)}>
                    <Avatar user={user} size={34} />
                    <span>{user.alias}</span>
                    {user.role === "admin" ? <span className="badge">{pick(language, "Admin", "Admin")}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
};
