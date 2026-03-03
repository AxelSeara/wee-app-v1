import { AnimatePresence, motion } from "framer-motion";
import { type FormEvent, useEffect, useState } from "react";
import { pick, useI18n } from "../lib/i18n";
import { EASE_STANDARD, MOTION_DURATION } from "../lib/motion";
import { Icon } from "./Icon";

interface ShareLinkModalProps {
  open: boolean;
  onClose: () => void;
  onShareUrl: (url: string) => Promise<{ mode: "created" | "merged" | "penalized"; message: string }>;
  getDuplicatePreview: (url: string) => { exists: boolean; sameUser: boolean; contributors: number; totalShares: number };
  onToast: (message: string) => void;
}

export const ShareLinkModal = ({ open, onClose, onShareUrl, getDuplicatePreview, onToast }: ShareLinkModalProps) => {
  const { language } = useI18n();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setSubmitting(false);
    }
  }, [open]);

  const duplicateState = getDuplicatePreview(url.trim());

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = url.trim();
    if (!clean || submitting) return;
    setSubmitting(true);
    try {
      const result = await onShareUrl(clean);
      onToast(result.message);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION_DURATION.fast, ease: EASE_STANDARD }}
          onClick={onClose}
        >
          <motion.section
            className="modal-card modal-card-compact"
            initial={{ opacity: 0, y: 20, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: MOTION_DURATION.base, ease: EASE_STANDARD }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="modal-head">
              <div>
                <h2>{pick(language, "Comparte un enlace", "Share a link")}</h2>
                <p>{pick(language, "Pásalo por Wee para que quede en su tema, con contexto y sin duplicados.", "Share it via Wee so it stays in its topic, with context and no duplicates.")}</p>
              </div>
              <button type="button" className="btn" onClick={onClose}>
                {pick(language, "Cerrar", "Close")}
              </button>
            </header>

            <form className="stack" onSubmit={submit}>
              <label>
                URL
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://..."
                  required
                />
              </label>

              {duplicateState.exists ? (
                <p className={duplicateState.sameUser ? "warning" : "hint"}>
                  {duplicateState.sameUser
                    ? pick(
                        language,
                        `Este enlace ya está en tu historial. Lo sumaremos al mismo hilo para mantenerlo ordenado. Colaboradores: ${duplicateState.contributors} · envíos: ${duplicateState.totalShares}.`,
                        `This link is already in your history. We'll merge it into the same thread to keep things tidy. Contributors: ${duplicateState.contributors} · shares: ${duplicateState.totalShares}.`,
                        `Esta ligazón xa está no teu historial. Sumarémola ao mesmo fío para mantelo ordenado. Colaboradores: ${duplicateState.contributors} · envíos: ${duplicateState.totalShares}.`
                      )
                    : pick(language, `Este enlace ya existe: lo uniremos al hilo actual (${duplicateState.contributors} colaboradores, ${duplicateState.totalShares} envíos).`, `This link already exists: we'll merge it into the current thread (${duplicateState.contributors} contributors, ${duplicateState.totalShares} shares).`)}
                </p>
              ) : null}

              {!duplicateState.exists && url.trim() ? (
                <p className="hint">{pick(language, "Tip: si se comparte aquí primero, el grupo lo debate en su hilo y no se pierde contexto.", "Tip: if it is shared here first, the group debates it in-thread and context is not lost.")}</p>
              ) : null}

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Icon name="link" /> {submitting ? pick(language, "Publicando...", "Posting...") : pick(language, "Publicar", "Post")}
              </button>
            </form>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
