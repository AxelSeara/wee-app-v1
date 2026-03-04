import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { generateAlias } from "../lib/aliasGenerator";
import type { CommunitySelection } from "../lib/communitySession";
import { pick, useI18n } from "../lib/i18n";
import type { AppLanguage, User } from "../lib/types";
import { getInitials } from "../lib/utils";

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
  const [showPassword, setShowPassword] = useState(false);

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
        setError(pick(language, "Ups, esta invitación no vale o ya caducó.", "Oops, this invite is invalid or expired.", "Ups, esta invitación non vale ou xa caducou."));
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
      setError(pick(language, "Te faltan alias o contraseña.", "Alias and password are required.", "Fáltanche alias ou contrasinal."));
      return;
    }
    try {
      await onConfirmCommunity({ token });
      await onCreateOrLogin(alias.trim(), password.trim(), undefined, language, true);
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : pick(language, "No pudimos terminar la unión a la comunidad.", "We couldn't finish joining this community.", "Non puidemos rematar a unión á comunidade."));
    }
  };

  return (
    <main className="auth-layout auth-layout-single">
      <section className="auth-card auth-card-main">
        {loading ? (
          <p className="hint">{pick(language, "Mirando invitación...", "Checking invite...", "Mirando invitación...")}</p>
        ) : error ? (
          <>
            <h2>{pick(language, "Invitación no disponible", "Invite unavailable", "Invitación non dispoñible")}</h2>
            <p className="error">{error}</p>
          </>
        ) : community ? (
          <>
            <h2>{pick(language, "Te invitaron a Wee", "You're invited to Wee", "Convidáronte a Wee")}</h2>
            <article className="invite-preview-card">
              <div className="invite-preview-head">
                <div className="invite-avatar">
                  {community.inviter?.avatar_url ? (
                    <img src={community.inviter.avatar_url} alt={community.inviter.alias} />
                  ) : (
                    <span>{getInitials(community.inviter?.alias ?? "W")}</span>
                  )}
                </div>
                <div>
                  <p className="invite-kicker">
                    {community.inviter?.alias
                      ? pick(language, `${community.inviter.alias} te quiere en su comunidad`, `${community.inviter.alias} wants you in their community`, `${community.inviter.alias} quere que entres na súa comunidade`)
                      : pick(language, "Tienes una invitación pendiente", "You have an invite waiting", "Tes unha invitación pendente")}
                  </p>
                  <h3>{community.name}</h3>
                </div>
              </div>
              {community.description ? <p className="hint">{community.description}</p> : null}
            </article>

            {!joinMode ? (
              <div className="auth-entry-actions">
                <button type="button" className="btn btn-primary" onClick={() => setJoinMode(true)}>
                  <Icon name="spark" /> {pick(language, "Unirme y crear cuenta", "Join and create account", "Unirme e crear conta")}
                </button>
                <button type="button" className="btn" onClick={() => navigate("/login")}>
                  <Icon name="arrowLeft" /> {pick(language, "Volver", "Back", "Volver")}
                </button>
              </div>
            ) : (
              <form className="stack" onSubmit={submitJoin}>
                <label className="form-field">
                  {pick(language, "Alias", "Alias", "Alias")}
                  <div className="alias-row">
                    <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder={pick(language, "Tu alias en la comunidad", "Your community alias", "O teu alias na comunidade")} />
                    <button type="button" className="btn dice-btn" onClick={() => setAlias(generateAlias())} title={pick(language, "Generar alias aleatorio", "Generate random alias", "Xerar alias aleatorio")}>
                      <Icon name="dice" size={14} />
                    </button>
                  </div>
                </label>
                <label className="form-field">
                  {pick(language, "Contraseña", "Password", "Contrasinal")}
                  <div className="alias-row">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={pick(language, "Mínimo 6 caracteres", "Minimum 6 characters", "Mínimo 6 caracteres")} />
                    <button type="button" className="btn dice-btn" onClick={() => setShowPassword((prev) => !prev)} title={pick(language, "Mostrar u ocultar contraseña", "Show or hide password", "Mostrar ou ocultar contrasinal")}>
                      <Icon name={showPassword ? "eyeOff" : "eye"} size={14} />
                    </button>
                  </div>
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
