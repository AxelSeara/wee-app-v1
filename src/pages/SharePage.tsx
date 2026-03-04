import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { pick, useI18n } from "../lib/i18n";
import { TopBar } from "../components/TopBar";
import type { User } from "../lib/types";

interface SharePageProps {
  activeUser: User;
  onShareUrl: (url: string) => Promise<{ mode: "created" | "merged" | "penalized"; message: string }>;
  getDuplicatePreview: (url: string) => { exists: boolean; sameUser: boolean; contributors: number; totalShares: number };
  onToast: (message: string) => void;
  onLogout: () => void;
}

export const SharePage = ({ activeUser, onShareUrl, getDuplicatePreview, onToast, onLogout }: SharePageProps) => {
  const { language } = useI18n();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const duplicateState = getDuplicatePreview(url.trim());

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!url.trim()) {
      onToast(pick(language, "Pega un link para compartir.", "Paste a link to share.", "Pega unha ligazón para compartir."));
      return;
    }
    setSubmitting(true);
    try {
      const result = await onShareUrl(url.trim());
      onToast(result.message);
      navigate("/home");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <TopBar user={activeUser} onLogout={onLogout} />
      <section className="page-section narrow">
        <h2>{pick(language, "Comparte un link", "Share a link", "Comparte unha ligazón")}</h2>
        <p className="section-intro">{pick(language, "Pega el link y ya está. Wee lo ordena por tema y evita duplicados.", "Paste the link and done. Wee sorts it by topic and avoids duplicates.", "Pega a ligazón e listo. Wee ordénao por tema e evita duplicados.")}</p>
        <ol className="share-steps">
          <li>{pick(language, "Pega la URL", "Paste the URL", "Pega a URL")}</li>
          <li>{pick(language, "Mira si ya está en la comunidad", "Check if it's already in the community", "Mira se xa está na comunidade")}</li>
          <li>{pick(language, "Publícalo para abrir o reforzar el hilo", "Post it to open or reinforce the thread", "Publícao para abrir ou reforzar o fío")}</li>
        </ol>
        <form className="stack" onSubmit={submit}>
          <label className="form-field">
            URL
            <input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              disabled={submitting}
            />
          </label>

          {duplicateState.exists ? (
            <p className={duplicateState.sameUser ? "warning" : "hint"}>
              {duplicateState.sameUser
                ? pick(
                    language,
                    `Ese link ya lo compartiste. Va al mismo hilo para no liarla: ${duplicateState.contributors} colaboradores · ${duplicateState.totalShares} envíos.`,
                    `You've already shared this link. We'll keep it in the same thread: ${duplicateState.contributors} contributors · ${duplicateState.totalShares} shares.`,
                    `Esa ligazón xa a compartiches. Vai ao mesmo fío para non liarse: ${duplicateState.contributors} colaboradores · ${duplicateState.totalShares} envíos.`
                  )
                : pick(language, `Ese link ya está en Wee: ${duplicateState.contributors} personas (${duplicateState.totalShares} envíos). Lo sumamos al mismo hilo.`, `This link is already in Wee: ${duplicateState.contributors} people (${duplicateState.totalShares} shares). We'll merge it into the same thread.`, `Esa ligazón xa está en Wee: ${duplicateState.contributors} persoas (${duplicateState.totalShares} envíos). Sumámola ao mesmo fío.`)}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Icon name="link" />{" "}
            {submitting ? (
              <>
                {pick(language, "Procesando noticia", "Processing post", "Procesando nova")}
                <span className="loading-dots" aria-hidden="true" />
              </>
            ) : (
              pick(language, "Publicar en Wee", "Post on Wee", "Publicar en Wee")
            )}
          </button>
        </form>
      </section>
    </main>
  );
};
