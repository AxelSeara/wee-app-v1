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
      onToast(pick(language, "Pega una URL para compartir.", "Paste a URL to share."));
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
        <h2>{pick(language, "Comparte un enlace", "Share a link")}</h2>
        <p className="section-intro">{pick(language, "Pega un enlace y listo. Wee lo ordena por tema y evita duplicados.", "Paste a link and done. Wee sorts it by topic and avoids duplicates.")}</p>
        <ol className="share-steps">
          <li>{pick(language, "Pega la URL", "Paste the URL", "Pega a URL")}</li>
          <li>{pick(language, "Revisa si ya existe en la comunidad", "Check if it already exists in the community", "Revisa se xa existe na comunidade")}</li>
          <li>{pick(language, "Publícala para abrir o reforzar el hilo", "Post it to open or reinforce the thread", "Publícaa para abrir ou reforzar o fío")}</li>
        </ol>
        <form className="stack" onSubmit={submit}>
          <label>
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
                    `Este enlace ya está en tu historial. Lo sumaremos al mismo hilo para mantenerlo ordenado. Ahora: ${duplicateState.contributors} colaboradores · ${duplicateState.totalShares} envíos.`,
                    `This link is already in your history. We'll merge it into the same thread to keep things tidy. Now: ${duplicateState.contributors} contributors · ${duplicateState.totalShares} shares.`,
                    `Esta ligazón xa está no teu historial. Sumarémola ao mesmo fío para mantelo ordenado. Agora: ${duplicateState.contributors} colaboradores · ${duplicateState.totalShares} envíos.`
                  )
                : pick(language, `Este enlace ya está en Wee: lo compartieron ${duplicateState.contributors} personas (${duplicateState.totalShares} envíos). Lo uniremos al mismo hilo.`, `This link is already in Wee: shared by ${duplicateState.contributors} users (${duplicateState.totalShares} shares). We'll merge it into the same thread.`)}
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
              pick(language, "Publicar en Wee", "Post on Wee")
            )}
          </button>
        </form>
      </section>
    </main>
  );
};
