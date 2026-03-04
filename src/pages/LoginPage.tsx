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
    const invitePath = value.match(/\/invite\/([A-Za-z0-9_-]{12,})/);
    if (invitePath?.[1]) return { token: invitePath[1] };
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
      setError(err instanceof Error ? err.message : pick(language, "No se pudo crear la comunidad.", "Could not create community.", "Non se puido crear a comunidade."));
    }
  };

  const submitPreview = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = parseJoinInput(joinCodeOrLink);
    if (!parsed.code && !parsed.token) {
      setError(pick(language, "Introduce un código o enlace válido.", "Enter a valid code or link.", "Introduce un código ou ligazón válida."));
      return;
    }
    try {
      const data = await onPreviewCommunity(parsed);
      setPreview(data);
      setView("confirm_community");
    } catch {
      setError(pick(language, "No encontramos esa comunidad o el enlace ha expirado.", "Community not found or invite expired.", "Non atopamos esa comunidade ou a ligazón caducou."));
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
      setError(pick(language, "No se pudo confirmar la invitación.", "Could not confirm invite.", "Non se puido confirmar a invitación."));
    }
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!alias.trim() || !password.trim()) {
      setError(pick(language, "Alias y contraseña son obligatorios.", "Alias and password are required.", "Alias e contrasinal son obrigatorios."));
      return;
    }
    try {
      await onCreateOrLogin(alias.trim(), password);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No pudimos iniciar sesión.", "Could not sign in.", "Non puidemos iniciar sesión."));
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      setError(pick(language, "El alias es obligatorio.", "Alias is required.", "O alias é obrigatorio."));
      return;
    }
    if (aliasMatchesExisting) {
      setError(pick(language, "Ese alias ya existe en esta comunidad.", "That alias already exists in this community.", "Ese alias xa existe nesta comunidade."));
      return;
    }
    if (password !== passwordConfirm) {
      setError(pick(language, "Las contraseñas no coinciden.", "Passwords do not match.", "Os contrasinais non coinciden."));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(pick(language, "La contraseña debe tener al menos 6 caracteres.", "Password must be at least 6 characters.", "O contrasinal debe ter polo menos 6 caracteres."));
      return;
    }
    if (!privacyAccepted) {
      setError(pick(language, "Debes aceptar la política de privacidad.", "You must accept the privacy policy.", "Debes aceptar a política de privacidade."));
      return;
    }
    try {
      await onCreateOrLogin(cleanAlias, password, avatarDataUrl, profileLanguage, true);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No se pudo crear la cuenta.", "Could not create account.", "Non se puido crear a conta."));
    }
  };

  const currentCommunity = selectedCommunity ?? preview;

  return (
    <main className={view === "register" ? "auth-layout" : "auth-layout auth-layout-single"}>
      {view === "landing" ? (
        <section className="auth-card auth-card-entry">
          <h1 className="auth-hero-title">
            <span className="auth-hero-brand">Wee</span>
            <span className="auth-hero-claim">{pick(language, "Microcomunidades con contexto", "Micro-communities with context", "Microcomunidades con contexto")}</span>
          </h1>
          <p>{pick(language, "Crea una comunidad o únete con un código para compartir enlaces y debatir con contexto.", "Create a community or join with a code to share links and discuss with context.", "Crea unha comunidade ou únete cun código para compartir ligazóns e debater con contexto.")}</p>
          <div className="auth-entry-actions">
            <button type="button" className="btn btn-primary" onClick={() => setView("create_community")}>
              <Icon name="spark" /> {pick(language, "Crear comunidad", "Create community")}
            </button>
            <button type="button" className="btn" onClick={() => setView("join_community")}>
              <Icon name="users" /> {pick(language, "Unirse a comunidad", "Join community", "Unirse a comunidade")}
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
          <p className="hint">{pick(language, "Empieza simple: nombre claro, descripción corta y normas básicas.", "Start simple: clear name, short description, basic rules.", "Comeza simple: nome claro, descrición curta e normas básicas.")}</p>
          <form className="stack" onSubmit={submitCreateCommunity}>
            <label className="form-field">{pick(language, "Nombre", "Name", "Nome")}<input value={communityName} onChange={(event) => setCommunityName(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Descripción", "Description", "Descrición")}<input value={communityDescription} onChange={(event) => setCommunityDescription(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Normas", "Rules", "Normas")}<textarea value={communityRules} onChange={(event) => setCommunityRules(event.target.value)} rows={4} /></label>
            <label className="form-field">{pick(language, "Política de invitación", "Invite policy")}
              <select value={invitePolicy} onChange={(event) => setInvitePolicy(event.target.value as "admins_only" | "members_allowed")}>
                <option value="admins_only">{pick(language, "Solo admins", "Admins only", "Só admins")}</option>
                <option value="members_allowed">{pick(language, "Miembros pueden invitar", "Members can invite", "Os membros poden convidar")}</option>
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
          <p className="hint">{pick(language, "Pega el código o enlace de invitación para ver antes a qué comunidad entras.", "Paste the invite code or link to preview the community first.", "Pega o código ou ligazón de invitación para ver antes a que comunidade entras.")}</p>
          <form className="stack" onSubmit={submitPreview}>
            <label className="form-field">{pick(language, "Código o enlace", "Code or link", "Código ou ligazón")}<input value={joinCodeOrLink} onChange={(event) => setJoinCodeOrLink(event.target.value)} placeholder="ABCD1234 o #/login?invite=..." /></label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Ver comunidad", "Preview community", "Ver comunidade")}</button>
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
            <button type="button" className="btn btn-primary" onClick={confirmJoin}>{pick(language, "Confirmar", "Confirm", "Confirmar")}</button>
            <button type="button" className="btn" onClick={() => setView("join_community")}>{pick(language, "Cambiar", "Change", "Cambiar")}</button>
          </div>
        </section>
      ) : null}

      {view === "login" ? (
        <section className="auth-card auth-card-main">
          <div className="section-head">
            <h2>{pick(language, "Entrar", "Sign in", "Entrar")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}</button>
          </div>
          <p className="hint">{pick(language, "Comunidad", "Community", "Comunidade")}: <strong>{currentCommunity?.name ?? "-"}</strong></p>
          <form onSubmit={submitLogin} className="stack">
            <label className="form-field">{pick(language, "Alias", "Alias", "Alias")}<input value={alias} onChange={(event) => setAlias(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Contraseña", "Password", "Contrasinal")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Entrar", "Enter", "Entrar")}</button>
            <button type="button" className="btn" onClick={() => { resetAuth(); setView("register"); }}>{pick(language, "No tengo cuenta", "Create account", "Non teño conta")}</button>
          </form>
        </section>
      ) : null}

      {view === "register" ? (
        <>
          <section className="auth-card auth-card-main">
            <div className="section-head">
              <h2>{pick(language, "Registro", "Register", "Rexistro")}</h2>
              <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back")}</button>
            </div>
            <p className="hint">{pick(language, "Comunidad", "Community", "Comunidade")}: <strong>{currentCommunity?.name ?? "-"}</strong></p>
            <form onSubmit={submitRegister} className="stack">
              <label className="form-field">
                {pick(language, "Alias", "Alias", "Alias")}
                <div className="alias-row">
                  <input value={alias} onChange={(event) => setAlias(event.target.value)} />
                  <button type="button" className="btn dice-btn" onClick={() => setAlias(generateAlias())}><Icon name="dice" size={14} /></button>
                </div>
              </label>
              <label className="form-field">{pick(language, "Contraseña", "Password", "Contrasinal")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label className="form-field">{pick(language, "Repite contraseña", "Repeat password", "Repite contrasinal")}<input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} /></label>
              <label className="form-field">{pick(language, "Idioma", "Language", "Idioma")}
                <select value={profileLanguage} onChange={(event) => setProfileLanguage(event.target.value as AppLanguage)}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="gl">Galego</option>
                </select>
              </label>
              <label className="form-field">{pick(language, "Foto de perfil", "Profile photo", "Imaxe de perfil")}<input type="file" accept="image/*" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const encoded = await fileToDataUrl(file);
                setAvatarDataUrl(encoded);
              }} /></label>
              <label className="consent-row">
                <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
                <span>{pick(language, "Acepto la política de privacidad.", "I accept the privacy policy.", "Acepto a política de privacidade.")}</span>
              </label>
              {error ? <p className="error">{error}</p> : null}
              <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Crear cuenta", "Create account", "Crear conta")}</button>
            </form>
          </section>
          <section className="auth-card auth-card-community">
            <h2><Icon name="users" /> {pick(language, "Miembros de esta comunidad", "Community members", "Membros desta comunidade")}</h2>
            {sortedUsers.length === 0 ? <p>{pick(language, "Aún no hay miembros registrados.", "No members registered yet.", "Aínda non hai membros rexistrados.")}</p> : null}
            <ul className="user-list">
              {sortedUsers.map((user) => (
                <li key={user.id}>
                  <button type="button" className="user-option" onClick={() => setAlias(user.alias)}>
                    <Avatar user={user} size={34} />
                    <span>{user.alias}</span>
                    {user.role === "admin" ? <span className="badge">{pick(language, "Admin", "Admin", "Admin")}</span> : null}
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
