import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import type { CommunitySelection } from "../lib/communitySession";
import { pick, useI18n } from "../lib/i18n";
import type { AppLanguage, User } from "../lib/types";

interface InvitePageProps {
  onPreviewCommunity: (input: { code?: string; token?: string }) => Promise<CommunitySelection & { inviter?: { alias: string; avatar_url?: string } }>;
  onConfirmCommunity: (input: { code?: string; token?: string }) => Promise<CommunitySelection>;
  onCreateOrLogin: (
    alias: string,
    password: string,
    avatarDataUrl?: string,
    language?: AppLanguage,
    acceptedPrivacy?: boolean
  ) => Promise<{ user: User; isNewUser: boolean }>;
}

export const InvitePage = ({ onPreviewCommunity, onConfirmCommunity, onCreateOrLogin }: InvitePageProps) => {
  const { language } = useI18n();
  const { token = "" } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [community, setCommunity] = useState<(CommunitySelection & { inviter?: { alias: string; avatar_url?: string } }) | null>(null);
  const [joinMode, setJoinMode] = useState(false);
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setLoading(true);
        const data = await onPreviewCommunity({ token });
        if (!active) return;
        setCommunity(data);
        setError(null);
      } catch {
        if (!active) return;
        setError(pick(language, "Esta invitación no es válida o ha caducado.", "This invite is invalid or expired.", "Esta invitación non é válida ou caducou."));
      } finally {
        if (active) setLoading(false);
      }
    };
    if (token) void run();
    else {
      setLoading(false);
      setError(pick(language, "Falta el token de invitación.", "Invite token is missing.", "Falta o token de invitación."));
    }
    return () => {
      active = false;
    };
  }, [language, onPreviewCommunity, token]);

  const submitJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!alias.trim() || !password.trim()) {
      setError(pick(language, "Alias y contraseña son obligatorios.", "Alias and password are required.", "Alias e contrasinal son obrigatorios."));
      return;
    }
    try {
      await onConfirmCommunity({ token });
      await onCreateOrLogin(alias.trim(), password.trim(), undefined, "es", true);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No se pudo completar la unión a la comunidad.", "Could not complete joining this community.", "Non se puido completar a unión á comunidade."));
    }
  };

  return (
    <main className="auth-layout auth-layout-single">
      <section className="auth-card auth-card-main">
        {loading ? (
          <p className="hint">{pick(language, "Cargando invitación...", "Loading invite...", "Cargando invitación...")}</p>
        ) : error ? (
          <>
            <h2>{pick(language, "Invitación no disponible", "Invite unavailable", "Invitación non dispoñible")}</h2>
            <p className="error">{error}</p>
          </>
        ) : community ? (
          <>
            <h2>{pick(language, "Te han invitado a Wee", "You were invited to Wee", "Convidáronte a Wee")}</h2>
            <p>
              {community.inviter?.alias
                ? pick(language, `${community.inviter.alias} te invita a la comunidad`, `${community.inviter.alias} invited you to the community`, `${community.inviter.alias} convídache á comunidade`)
                : pick(language, "Te han invitado a la comunidad", "You were invited to the community", "Convidáronte á comunidade")}
              : <strong> {community.name}</strong>
            </p>
            {community.description ? <p className="hint">{community.description}</p> : null}

            {!joinMode ? (
              <div className="auth-entry-actions">
                <button type="button" className="btn btn-primary" onClick={() => setJoinMode(true)}>
                  <Icon name="spark" /> {pick(language, "Unirme y crear cuenta", "Join and create account", "Unirme e crear conta")}
                </button>
              </div>
            ) : (
              <form className="stack" onSubmit={submitJoin}>
                <label className="form-field">
                  {pick(language, "Alias", "Alias", "Alias")}
                  <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder={pick(language, "Tu alias", "Your alias", "O teu alias")} />
                </label>
                <label className="form-field">
                  {pick(language, "Contraseña", "Password", "Contrasinal")}
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={pick(language, "Mínimo 6 caracteres", "Minimum 6 characters", "Mínimo 6 caracteres")} />
                </label>
                {error ? <p className="error">{error}</p> : null}
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" /> {pick(language, "Entrar en la comunidad", "Enter community", "Entrar na comunidade")}
                </button>
              </form>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
};
