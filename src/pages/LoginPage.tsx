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
      setError(pick(language, "Ponle nombre a la comunidad.", "Give your community a name.", "Ponlle nome á comunidade."));
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
      setError(err instanceof Error ? err.message : pick(language, "Ups, no pudimos crear la comunidad.", "Oops, we couldn't create the community.", "Ups, non puidemos crear a comunidade."));
    }
  };

  const submitPreview = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = parseJoinInput(joinCodeOrLink);
    if (!parsed.code && !parsed.token) {
      setError(pick(language, "Pega un código o enlace válido.", "Paste a valid code or invite link.", "Pega un código ou ligazón válida."));
      return;
    }
    try {
      const data = await onPreviewCommunity(parsed);
      setPreview(data);
      setView("confirm_community");
    } catch {
      setError(pick(language, "No encontramos esa comunidad o el enlace ya caducó.", "We can't find that community, or the invite expired.", "Non atopamos esa comunidade ou a ligazón xa caducou."));
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
      setError(pick(language, "No pudimos confirmar la invitación.", "We couldn't confirm the invite.", "Non puidemos confirmar a invitación."));
    }
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!alias.trim() || !password.trim()) {
      setError(pick(language, "Te faltan alias o contraseña.", "Alias and password are both required.", "Fáltanche alias ou contrasinal."));
      return;
    }
    try {
      await onCreateOrLogin(alias.trim(), password);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "Ups, no pudimos entrar.", "Oops, we couldn't sign you in.", "Ups, non puidemos entrar."));
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      setError(pick(language, "Necesitas un alias para entrar al grupo.", "You need an alias to join the group.", "Necesitas un alias para entrar no grupo."));
      return;
    }
    if (aliasMatchesExisting) {
      setError(pick(language, "Ese alias ya lo está usando alguien en esta comunidad.", "Someone in this community is already using that alias.", "Ese alias xa o está usando alguén nesta comunidade."));
      return;
    }
    if (password !== passwordConfirm) {
      setError(pick(language, "Las contraseñas no coinciden, revisa eso.", "Passwords don't match. Give it another try.", "Os contrasinais non coinciden, revísao."));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(pick(language, "La contraseña tiene que tener mínimo 6 caracteres.", "Password must be at least 6 characters long.", "O contrasinal ten que ter mínimo 6 caracteres."));
      return;
    }
    if (!privacyAccepted) {
      setError(pick(language, "Para seguir, acepta la política de privacidad.", "Please accept the privacy policy to continue.", "Para seguir, acepta a política de privacidade."));
      return;
    }
    try {
      await onCreateOrLogin(cleanAlias, password, avatarDataUrl, profileLanguage, true);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No pudimos crear la cuenta ahora mismo.", "We couldn't create the account right now.", "Non puidemos crear a conta agora mesmo."));
    }
  };

  const currentCommunity = selectedCommunity ?? preview;

  return (
    <main className={view === "register" ? "auth-layout" : "auth-layout auth-layout-single"}>
      {view === "landing" ? (
        <section className="auth-card auth-card-entry">
          <h1 className="auth-hero-title">
            <span className="auth-hero-brand">Wee</span>
            <span className="auth-hero-claim">{pick(language, "Tu grupo, tus hilos, cero lío", "Your group, your threads, less noise", "O teu grupo, os teus fíos, menos ruído")}</span>
          </h1>
          <p>{pick(language, "Monta una comunidad o entra con código. Compartís links, los ordenáis por tema y todo queda en contexto.", "Create a community or join with a code. Share links, sort them by topic, keep all the context.", "Monta unha comunidade ou entra con código. Compartides ligazóns, ordénanse por tema e todo queda con contexto.")}</p>
          <div className="auth-entry-actions">
            <button type="button" className="btn btn-primary" onClick={() => setView("create_community")}>
              <Icon name="spark" /> {pick(language, "Crear comunidad", "Create community", "Crear comunidade")}
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
            <h2>{pick(language, "Crear comunidad", "Create community", "Crear comunidade")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}</button>
          </div>
          <p className="hint">{pick(language, "Ve a lo simple: nombre claro, descripción corta y normas en pocas líneas.", "Keep it simple: clear name, short description and short rules.", "Vai ao simple: nome claro, descrición curta e normas en poucas liñas.")}</p>
          <form className="stack" onSubmit={submitCreateCommunity}>
            <label className="form-field">{pick(language, "Nombre", "Name", "Nome")}<input value={communityName} onChange={(event) => setCommunityName(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Descripción", "Description", "Descrición")}<input value={communityDescription} onChange={(event) => setCommunityDescription(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Normas", "Rules", "Normas")}<textarea value={communityRules} onChange={(event) => setCommunityRules(event.target.value)} rows={4} /></label>
            <label className="form-field">{pick(language, "Política de invitación", "Invite policy")}
              <select value={invitePolicy} onChange={(event) => setInvitePolicy(event.target.value as "admins_only" | "members_allowed")}>
                <option value="admins_only">{pick(language, "Solo admins invitan", "Only admins can invite", "Só admins convidan")}</option>
                <option value="members_allowed">{pick(language, "Todos pueden invitar", "Everyone can invite", "Todos poden convidar")}</option>
              </select>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Vamos", "Let's go", "Imos")}</button>
          </form>
        </section>
      ) : null}

      {view === "join_community" ? (
        <section className="auth-card auth-card-main">
          <div className="section-head">
          <h2>{pick(language, "Unirse a comunidad", "Join community", "Unirse a comunidade")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}</button>
          </div>
          <p className="hint">{pick(language, "Pega código o enlace y te enseñamos primero dónde vas a entrar.", "Paste the code or invite link and preview the community first.", "Pega código ou ligazón e ensinámosche primeiro onde vas entrar.")}</p>
          <form className="stack" onSubmit={submitPreview}>
            <label className="form-field">{pick(language, "Código o enlace", "Code or link", "Código ou ligazón")}<input value={joinCodeOrLink} onChange={(event) => setJoinCodeOrLink(event.target.value)} placeholder="ABCD1234 o /invite/..." /></label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Ver comunidad", "Preview community", "Ver comunidade")}</button>
          </form>
        </section>
      ) : null}

      {view === "confirm_community" && preview ? (
        <section className="auth-card auth-card-main">
          <h2>{pick(language, "¿Es esta tu comunidad?", "Is this your community?", "É esta a túa comunidade?")}</h2>
          <p><strong>{preview.name}</strong></p>
          {preview.description ? <p className="hint">{preview.description}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <div className="auth-entry-actions">
            <button type="button" className="btn btn-primary" onClick={confirmJoin}>{pick(language, "Sí, entrar", "Yep, join", "Si, entrar")}</button>
            <button type="button" className="btn" onClick={() => setView("join_community")}>{pick(language, "No, cambiar", "Nope, change", "Non, cambiar")}</button>
          </div>
        </section>
      ) : null}

      {view === "login" ? (
        <section className="auth-card auth-card-main">
          <div className="section-head">
            <h2>{pick(language, "Entrar", "Sign in", "Entrar")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}</button>
          </div>
          <p className="hint">{pick(language, "Comunidad", "Community", "Comunidade")}: <strong>{currentCommunity?.name ?? "-"}</strong></p>
          <form onSubmit={submitLogin} className="stack">
            <label className="form-field">{pick(language, "Alias", "Alias", "Alias")}<input value={alias} onChange={(event) => setAlias(event.target.value)} /></label>
            <label className="form-field">{pick(language, "Contraseña", "Password", "Contrasinal")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary"><Icon name="spark" /> {pick(language, "Entrar", "Enter", "Entrar")}</button>
            <button type="button" className="btn" onClick={() => { resetAuth(); setView("register"); }}>{pick(language, "Aún no tengo cuenta", "I need an account", "Aínda non teño conta")}</button>
          </form>
        </section>
      ) : null}

      {view === "register" ? (
        <>
          <section className="auth-card auth-card-main">
            <div className="section-head">
              <h2>{pick(language, "Crear cuenta", "Create account", "Crear conta")}</h2>
              <button type="button" className="btn" onClick={() => setView("landing")}><Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}</button>
            </div>
            <p className="hint">{pick(language, "Comunidad", "Community", "Comunidade")}: <strong>{currentCommunity?.name ?? "-"}</strong></p>
            <form onSubmit={submitRegister} className="stack">
              <label className="form-field">
                {pick(language, "Alias", "Alias", "Alias")}
                <div className="alias-row">
                  <input value={alias} onChange={(event) => setAlias(event.target.value)} />
                  <button type="button" className="btn dice-btn" onClick={() => setAlias(generateAlias())} title={pick(language, "Sácame un alias random", "Give me a random alias", "Dáme un alias aleatorio")}><Icon name="dice" size={14} /></button>
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
            <h2><Icon name="users" /> {pick(language, "Gente de esta comunidad", "People in this community", "Xente desta comunidade")}</h2>
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
