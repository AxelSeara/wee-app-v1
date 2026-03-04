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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("invite")) setMode("login");
    const remembered = localStorage.getItem("wee:last-username");
    if (remembered) setUsername(remembered);
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
      localStorage.setItem("wee:last-username", username.trim());
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

      <section className="auth-card auth-card-main auth-card-access">
        <h1 className="auth-hero-title">
          <span className="auth-hero-brand">Wee</span>
          <span className="auth-hero-claim">{pick(language, "Entra y sigue tus comunidades", "Sign in and jump to your communities", "Entra e segue as túas comunidades")}</span>
        </h1>
        <p className="hint">{pick(language, "Una cuenta global. Dentro eliges dónde entrar.", "One global account. Then pick where to enter.", "Unha conta global. Dentro escolles onde entrar.")}</p>

        <div className="auth-mode-tabs" role="tablist" aria-label={pick(language, "Modo de acceso", "Access mode", "Modo de acceso")}>
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "auth-mode-tab active" : "auth-mode-tab"} onClick={() => setMode("login")}>
            {pick(language, "Entrar", "Log in", "Entrar")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "auth-mode-tab active" : "auth-mode-tab"} onClick={() => setMode("register")}>
            {pick(language, "Crear cuenta", "Create account", "Crear conta")}
          </button>
        </div>

        <form className="stack" onSubmit={submit}>
          <label className="form-field">
            {pick(language, "Usuario global", "Global username", "Usuario global")}
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder={pick(language, "Ej: paco_wee", "Ex: paco_wee", "Ex: paco_wee")}
            />
          </label>
          {mode === "register" ? (
            <label className="form-field">
              Email ({pick(language, "opcional", "optional", "opcional")})
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
          ) : null}
          <label className="form-field">
            {pick(language, "Contraseña", "Password", "Contrasinal")}
            <div className="alias-row">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder={pick(language, "Mínimo 6 caracteres", "Minimum 6 characters", "Mínimo 6 caracteres")}
              />
              <button type="button" className="btn dice-btn" onClick={() => setShowPassword((prev) => !prev)} title={pick(language, "Mostrar u ocultar contraseña", "Show or hide password", "Mostrar ou ocultar contrasinal")}>
                <Icon name={showPassword ? "eyeOff" : "eye"} size={14} />
              </button>
            </div>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            <Icon name="check" /> {loading
              ? pick(language, "Entrando...", "Signing in...", "Entrando...")
              : mode === "login"
                ? pick(language, "Entrar", "Log in", "Entrar")
                : pick(language, "Crear y entrar", "Create and enter", "Crear e entrar")}
          </button>
        </form>

        <p className="auth-switch-inline">
          {mode === "login"
            ? pick(language, "¿Aún no tienes cuenta?", "No account yet?", "Aínda non tes conta?")
            : pick(language, "¿Ya tienes cuenta?", "Already have an account?", "Xa tes conta?")}{" "}
          <button type="button" className="auth-link-btn" onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}>
            {mode === "login"
              ? pick(language, "Crear cuenta", "Create account", "Crear conta")
              : pick(language, "Entrar", "Log in", "Entrar")}
          </button>
        </p>
      </section>
    </main>
  );
};
