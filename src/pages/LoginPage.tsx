import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { generateAlias } from "../lib/aliasGenerator";
import { pick, useI18n } from "../lib/i18n";
import type { AppLanguage, User } from "../lib/types";

interface LoginPageProps {
  users: User[];
  onLogin: (userId: string) => void;
  onCreateOrLogin: (
    alias: string,
    avatarDataUrl?: string,
    language?: AppLanguage
  ) => Promise<{ user: User; isNewUser: boolean }>;
}

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export const LoginPage = ({ users, onLogin, onCreateOrLogin }: LoginPageProps) => {
  const { language } = useI18n();
  const [alias, setAlias] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [profileLanguage, setProfileLanguage] = useState<AppLanguage>("es");
  const [error, setError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const navigate = useNavigate();

  const sortedUsers = useMemo(() => [...users].sort((a, b) => b.createdAt - a.createdAt), [users]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      setError(pick(language, "El alias es obligatorio.", "Alias is required.", "O alias é obrigatorio."));
      return;
    }
    try {
      const result = await onCreateOrLogin(cleanAlias, avatarDataUrl, profileLanguage);
      if (result.isNewUser) {
        setShowWelcome(true);
        return;
      }
      navigate("/home");
    } catch {
      setError(pick(language, "No pudimos entrar con ese alias.", "We could not sign in with that alias.", "Non puidemos entrar con ese alias."));
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <h1>Wee</h1>
        <p>{pick(language, "Comparte con tu gente, crea hilos por tema y filtra mejor lo que merece la pena.", "Share with your people, create topic threads and filter better what is worth it.")}</p>

        <form onSubmit={submit} className="stack">
          <label>
            {pick(language, "Tu alias", "Your alias", "O teu alias")}
            <div className="alias-row">
              <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder={pick(language, "Ej: Alex", "Ex: Alex")} />
              <button
                type="button"
                className="btn dice-btn"
                onClick={() => setAlias(generateAlias())}
                title={pick(language, "Generar alias aleatorio", "Generate random alias")}
              >
                <Icon name="dice" size={14} />
              </button>
            </div>
          </label>

          <label>
            {pick(language, "Foto de perfil (opcional)", "Profile photo (optional)")}
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
          </label>

          <label>
            {pick(language, "Idioma del perfil", "Profile language")}
            <select value={profileLanguage} onChange={(event) => setProfileLanguage(event.target.value as AppLanguage)}>
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="gl">Galego</option>
            </select>
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" className="btn btn-primary">
            <Icon name="spark" /> {pick(language, "Entrar", "Continue")}
          </button>
        </form>
      </section>

      <section className="auth-card">
        <h2><Icon name="user" /> {pick(language, "Entrar con usuario existente", "Sign in with an existing profile")}</h2>
        {sortedUsers.length === 0 ? <p>{pick(language, "Aún no hay usuarios creados en este navegador.", "There are no profiles created in this browser yet.")}</p> : null}
        <ul className="user-list">
          {sortedUsers.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="user-option"
                onClick={() => {
                  onLogin(user.id);
                  navigate("/home");
                }}
              >
                <Avatar user={user} size={34} />
                <span>{user.alias}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {showWelcome ? (
        <section className="modal-overlay" role="dialog" aria-modal="true" aria-label={pick(language, "Bienvenida a Wee", "Welcome to Wee")}>
          <article className="modal-card modal-card-compact welcome-modal">
            <h2>{pick(language, "Bienvenida a Wee", "Welcome to Wee")}</h2>
            <p>
              {pick(
                language,
                "Aquí creamos microcomunidades para compartir contenido ordenado y verificado entre todos.",
                "Here we build microcommunities to share organized and community-verified content."
              )}
            </p>
            <p>
              {pick(
                language,
                "Úsalo con tu grupo: publicas pegando un link y listo. Cero fricción.",
                "Use it with your group: just paste a link and publish. Zero friction."
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
