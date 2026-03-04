import { type FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { pick, useI18n } from "../lib/i18n";

interface AuthPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, email?: string) => Promise<void>;
  onChangeLanguage: (language: "es" | "en" | "gl") => void;
}

export const AuthPage = ({ onLogin, onRegister, onChangeLanguage }: AuthPageProps) => {
  const { language } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"landing" | "login" | "register">("landing");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("invite")) {
      setMode("login");
    }
  }, [location.search]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError(pick(language, "Faltan usuario o contraseña.", "Username or password missing.", "Falta usuario ou contrasinal."));
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await onRegister(username.trim(), password.trim(), email.trim() || undefined);
      } else {
        await onLogin(username.trim(), password.trim());
      }
      navigate(`/communities${location.search}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No pudimos entrar.", "Could not sign in.", "Non puidemos entrar."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-layout auth-layout-single">
      <div className="auth-language-switch" role="group" aria-label={pick(language, "Idioma", "Language", "Idioma")}>
        {(["gl", "es", "en"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`auth-language-btn${language === option ? " active" : ""}`}
            onClick={() => onChangeLanguage(option)}
            aria-pressed={language === option}
          >
            {option.toUpperCase()}
          </button>
        ))}
      </div>

      {mode === "landing" ? (
        <section className="auth-card auth-card-entry">
          <h1 className="auth-hero-title">
            <span className="auth-hero-brand">Wee</span>
            <span className="auth-hero-claim">{pick(language, "Tu gente, tus temas, todo en orden", "Your people, your topics, no chaos", "A túa xente, os teus temas, todo en orde")}</span>
          </h1>
          <p>{pick(language, "Entra con tu cuenta global y luego eliges comunidad.", "Sign in once with your global account, then choose your community.", "Entra coa túa conta global e logo escolles comunidade.")}</p>
          <div className="auth-entry-actions">
            <button type="button" className="btn btn-primary" onClick={() => setMode("login")}>
              <Icon name="user" /> {pick(language, "Entrar", "Log in", "Entrar")}
            </button>
            <button type="button" className="btn" onClick={() => setMode("register")}>
              <Icon name="spark" /> {pick(language, "Crear cuenta", "Create account", "Crear conta")}
            </button>
          </div>
        </section>
      ) : (
        <section className="auth-card auth-card-main">
          <div className="section-head">
            <h2>{mode === "login" ? pick(language, "Entrar", "Log in", "Entrar") : pick(language, "Crear cuenta", "Create account", "Crear conta")}</h2>
            <button type="button" className="btn" onClick={() => setMode("landing")}>
              <Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}
            </button>
          </div>
          <form className="stack" onSubmit={submit}>
            <label className="form-field">
              {pick(language, "Usuario global", "Global username", "Usuario global")}
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            {mode === "register" ? (
              <label className="form-field">
                Email ({pick(language, "opcional", "optional", "opcional")})
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
            ) : null}
            <label className="form-field">
              {pick(language, "Contraseña", "Password", "Contrasinal")}
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Icon name="check" /> {loading ? pick(language, "Entrando...", "Signing in...", "Entrando...") : mode === "login" ? pick(language, "Entrar", "Log in", "Entrar") : pick(language, "Crear cuenta", "Create account", "Crear conta")}
            </button>
          </form>
        </section>
      )}
    </main>
  );
};
