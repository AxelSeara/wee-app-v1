import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { generateAlias } from "../lib/aliasGenerator";
import { isStrongPassword } from "../lib/auth";
import { pick, useI18n } from "../lib/i18n";
import type { AppLanguage, User } from "../lib/types";

interface LoginPageProps {
  users: User[];
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

export const LoginPage = ({ users, onCreateOrLogin }: LoginPageProps) => {
  const { language } = useI18n();
  const [view, setView] = useState<"landing" | "login" | "register">("landing");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [profileLanguage, setProfileLanguage] = useState<AppLanguage>("es");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();

  const sortedUsers = useMemo(() => [...users].sort((a, b) => b.createdAt - a.createdAt), [users]);
  const aliasMatchesExisting = useMemo(() => users.some((user) => user.alias.toLowerCase() === alias.trim().toLowerCase()), [users, alias]);

  const resetCommonState = (): void => {
    setError(null);
    setPassword("");
    setPasswordConfirm("");
    setAvatarDataUrl(undefined);
    setPrivacyAccepted(false);
  };

  const goToLogin = (): void => {
    resetCommonState();
    setView("login");
  };

  const goToRegister = (): void => {
    resetCommonState();
    setView("register");
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      setError(pick(language, "El alias es obligatorio.", "Alias is required.", "O alias é obrigatorio."));
      return;
    }
    if (!password.trim()) {
      setError(pick(language, "La contraseña es obligatoria.", "Password is required.", "O contrasinal é obrigatorio."));
      return;
    }
    const existing = users.find((user) => user.alias.toLowerCase() === cleanAlias.toLowerCase());
    if (!existing) {
      setError(pick(language, "Ese alias no existe todavía. Regístralo primero.", "That alias does not exist yet. Register it first.", "Ese alias aínda non existe. Rexístrao primeiro."));
      return;
    }
    try {
      await onCreateOrLogin(cleanAlias, password);
      navigate("/home");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "INVALID_PASSWORD") {
        setError(pick(language, "Contraseña incorrecta.", "Incorrect password.", "Contrasinal incorrecto."));
        return;
      }
      setError(pick(language, "No pudimos entrar con ese alias.", "We could not sign in with that alias.", "Non puidemos entrar con ese alias."));
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
    if (!password.trim()) {
      setError(pick(language, "La contraseña es obligatoria.", "Password is required.", "O contrasinal é obrigatorio."));
      return;
    }
    if (aliasMatchesExisting) {
      setError(pick(language, "Ese alias ya existe. Elige otro.", "That alias already exists. Pick another one.", "Ese alias xa existe. Escolle outro."));
      return;
    }
    if (password !== passwordConfirm) {
      setError(pick(language, "Las contraseñas no coinciden.", "Passwords do not match.", "Os contrasinais non coinciden."));
      return;
    }
    if (!isStrongPassword(password)) {
      setError(
        pick(
          language,
          "La contraseña debe tener al menos 4 caracteres (modo test).",
          "Password must be at least 4 characters (testing mode).",
          "O contrasinal debe ter polo menos 4 caracteres (modo test)."
        )
      );
      return;
    }
    if (!privacyAccepted) {
      setError(
        pick(
          language,
          "Debes aceptar la política de privacidad local para crear tu cuenta.",
          "You must accept the local privacy policy to create your account.",
          "Debes aceptar a política de privacidade local para crear a túa conta."
        )
      );
      return;
    }
    try {
      const result = await onCreateOrLogin(cleanAlias, password, avatarDataUrl, profileLanguage, true);
      if (!result.isNewUser) {
        setError(pick(language, "Ese alias ya existe. Inicia sesión.", "That alias already exists. Sign in instead.", "Ese alias xa existe. Inicia sesión."));
        return;
      }
      setShowWelcome(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "WEAK_PASSWORD") {
        setError(
          pick(
            language,
            "La contraseña debe tener al menos 4 caracteres (modo test).",
            "Password must be at least 4 characters (testing mode).",
            "O contrasinal debe ter polo menos 4 caracteres (modo test)."
          )
        );
        return;
      }
      if (code === "PRIVACY_CONSENT_REQUIRED") {
        setError(
          pick(
            language,
            "Debes aceptar la política de privacidad local para crear tu cuenta.",
            "You must accept the local privacy policy to create your account.",
            "Debes aceptar a política de privacidade local para crear a túa conta."
          )
        );
        return;
      }
      setError(pick(language, "No pudimos entrar con ese alias.", "We could not sign in with that alias.", "Non puidemos entrar con ese alias."));
    }
  };

  return (
    <main className={view === "register" ? "auth-layout" : "auth-layout auth-layout-single"}>
      {view === "landing" ? (
        <section className="auth-card auth-card-entry">
          <h1 className="auth-hero-title">
            <span className="auth-hero-brand">Wee</span>
            <span className="auth-hero-claim">
              {pick(
                language,
                "Comparte con tu gente. Crea hilos por tema.",
                "Share with your people. Create topic threads.",
                "Comparte coa túa xente. Crea fíos por tema."
              )}
            </span>
          </h1>
          <p>
            {pick(
              language,
              "Un espacio simple para tu grupo: pegas un link, se ordena por tema y decidís mejor juntos.",
              "A simple space for your group: paste a link, sort it by topic, and decide better together.",
              "Un espazo simple para o teu grupo: pegas unha ligazón, ordénase por tema e decidides mellor xuntos."
            )}
          </p>
          <div className="auth-entry-actions">
            <button type="button" className="btn btn-primary" onClick={goToRegister}>
              <Icon name="spark" /> {pick(language, "Crear cuenta", "Create account", "Crear conta")}
            </button>
            <button type="button" className="btn" onClick={goToLogin}>
              <Icon name="user" /> {pick(language, "Ya tengo cuenta", "I already have an account", "Xa teño conta")}
            </button>
          </div>
        </section>
      ) : null}

      {view === "login" ? (
        <section className="auth-card auth-card-main">
          <div className="section-head">
            <h2>{pick(language, "Login", "Login", "Login")}</h2>
            <button type="button" className="btn" onClick={() => setView("landing")}>
              <Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}
            </button>
          </div>
          <p className="hint">
            {pick(
              language,
              "Entra con tu alias y sigue el hilo donde lo dejaste.",
              "Sign in with your alias and continue where you left off.",
              "Entra co teu alias e segue o fío onde o deixaches."
            )}
          </p>

          <form onSubmit={submitLogin} className="stack">
            <label>
              {pick(language, "Tu alias", "Your alias", "O teu alias")}
              <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder={pick(language, "Ej: Alex", "Ex: Alex", "Ex: Alex")} />
            </label>
            <label>
              {pick(language, "Contraseña", "Password", "Contrasinal")}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={pick(language, "Tu contraseña", "Your password", "O teu contrasinal")}
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary">
              <Icon name="spark" /> {pick(language, "Entrar", "Continue", "Entrar")}
            </button>
          </form>
        </section>
      ) : null}

      {view === "register" ? (
        <>
          <section className="auth-card auth-card-main">
            <div className="section-head">
              <h2>{pick(language, "Registro", "Register", "Rexistro")}</h2>
              <button type="button" className="btn" onClick={() => setView("landing")}>
                <Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}
              </button>
            </div>
            <p className="hint">
              {pick(
                language,
                "Crea tu perfil en menos de un minuto. Alias, contraseña y listo.",
                "Create your profile in under a minute. Alias, password, done.",
                "Crea o teu perfil en menos dun minuto. Alias, contrasinal e listo."
              )}
            </p>

            <form onSubmit={submitRegister} className="stack">
              <div className="auth-form-grid">
                <div className="stack">
                  <label>
                    {pick(language, "Tu alias", "Your alias", "O teu alias")}
                    <div className="alias-row">
                      <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder={pick(language, "Ej: Alex", "Ex: Alex", "Ex: Alex")} />
                      <button
                        type="button"
                        className="btn dice-btn"
                        onClick={() => setAlias(generateAlias())}
                        title={pick(language, "Generar alias aleatorio", "Generate random alias", "Xerar alias aleatorio")}
                      >
                        <Icon name="dice" size={14} />
                      </button>
                    </div>
                  </label>

                  <label>
                    {pick(language, "Contraseña", "Password", "Contrasinal")}
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={pick(language, "Tu contraseña", "Your password", "O teu contrasinal")}
                    />
                  </label>
                  <label>
                    {pick(language, "Repite contraseña", "Repeat password", "Repite contrasinal")}
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      placeholder={pick(language, "Repite tu contraseña", "Repeat your password", "Repite o teu contrasinal")}
                    />
                  </label>
                  <p className="hint">
                    {pick(
                      language,
                      "Durante pruebas: mínimo 4 caracteres.",
                      "Testing mode: minimum 4 characters.",
                      "Durante probas: mínimo 4 caracteres."
                    )}
                  </p>
                </div>

                <aside className="auth-upload-side">
                  <h3><Icon name="camera" /> {pick(language, "Foto de perfil", "Profile photo", "Imaxe de perfil")}</h3>
                  <p className="hint">{pick(language, "Opcional, pero ayuda a reconocer a cada miembro.", "Optional, but helps identify each member.", "Opcional, pero axuda a recoñecer cada membro.")}</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const encoded = await fileToDataUrl(file);
                      setAvatarDataUrl(encoded);
                    }}
                  />
                </aside>
              </div>

              <label>
                {pick(language, "Idioma del perfil", "Profile language", "Idioma do perfil")}
                <select value={profileLanguage} onChange={(event) => setProfileLanguage(event.target.value as AppLanguage)}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="gl">Galego</option>
                </select>
              </label>
              <label className="consent-row">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(event) => setPrivacyAccepted(event.target.checked)}
                />
                <span>
                  {pick(
                    language,
                    "Acepto la política de privacidad local (datos guardados solo en este dispositivo).",
                    "I accept the local privacy policy (data is stored only on this device).",
                    "Acepto a política de privacidade local (datos gardados só neste dispositivo)."
                  )}
                </span>
              </label>

              {error ? <p className="error">{error}</p> : null}

              <button type="submit" className="btn btn-primary">
                <Icon name="spark" /> {pick(language, "Crear cuenta", "Create account", "Crear conta")}
              </button>
            </form>
          </section>

          <section className="auth-card auth-card-community">
            <h2><Icon name="users" /> {pick(language, "Personas que ya están dentro", "People already inside", "Persoas que xa están dentro")}</h2>
            {sortedUsers.length === 0 ? <p>{pick(language, "Aún no hay usuarios creados en este navegador.", "There are no profiles created in this browser yet.", "Aínda non hai usuarios creados neste navegador.")}</p> : null}
            <ul className="user-list">
              {sortedUsers.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className="user-option"
                    onClick={() => {
                      setAlias(user.alias);
                      setError(null);
                    }}
                  >
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

      {showWelcome ? (
        <section className="modal-overlay" role="dialog" aria-modal="true" aria-label={pick(language, "Bienvenida a Wee", "Welcome to Wee")}>
          <article className="modal-card modal-card-compact welcome-modal">
            <h2>{pick(language, "Bienvenida a Wee", "Welcome to Wee")}</h2>
            <p>
              {pick(
                language,
                "Aquí montáis una microcomunidad con contenido ordenado y contexto compartido.",
                "Here you build a microcommunity with organized content and shared context."
              )}
            </p>
            <p>
              {pick(
                language,
                "Publicar es simple: pegas un enlace, Wee lo clasifica y el grupo decide su valor.",
                "Publishing is simple: paste a link, Wee classifies it, and the group decides its value."
              )}
            </p>
            <div className="welcome-modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate("/home")}>
                <Icon name="spark" /> {pick(language, "Entrar a Wee", "Enter Wee")}
              </button>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
};
