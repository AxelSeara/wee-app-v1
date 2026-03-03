import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { pick, useI18n } from "../lib/i18n";
import { EASE_STANDARD, MOTION_DURATION } from "../lib/motion";
import { Icon } from "./Icon";

export const AppFooter = () => {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <footer className="app-footer">
        <section className="footer-bar">
          <p>{pick(language, "Wee · comparte aquí primero y decide mejor en comunidad", "Wee · share here first and decide better as a community")}</p>
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            <Icon name="book" size={14} /> {pick(language, "Sobre Wee", "About Wee")}
          </button>
        </section>
      </footer>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION_DURATION.fast, ease: EASE_STANDARD }}
            onClick={() => setOpen(false)}
          >
            <motion.section
              className="modal-card modal-card-compact about-modal"
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.99 }}
              transition={{ duration: MOTION_DURATION.base, ease: EASE_STANDARD }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="modal-head">
                <div>
                  <h2>{pick(language, "Sobre Wee", "About Wee")}</h2>
                  <p>{pick(language, "Wee está hecha para microcomunidades: intereses comunes, hilos por tema y filtro real de calidad.", "Wee is built for microcommunities: shared interests, topic threads and real quality filtering.")}</p>
                </div>
                <button type="button" className="btn" onClick={() => setOpen(false)}>
                  {pick(language, "Cerrar", "Close")}
                </button>
              </header>

              <div className="about-grid">
                <article className="about-card">
                  <h3><Icon name="users" /> {pick(language, "Qué es Wee", "What Wee is")}</h3>
                  <p>
                    {pick(language, "Wee es un espacio para grupos pequeños con intereses compartidos. Aquí no se pierden enlaces: quedan agrupados por tema y listos para seguir el hilo.", "Wee is a space for small groups with shared interests. Links are not lost here: they stay grouped by topic and ready to follow in-thread.")}
                  </p>
                </article>

                <article className="about-card">
                  <h3><Icon name="target" /> {pick(language, "Cómo funciona", "How it works")}</h3>
                  <p>
                    {pick(language, "Compartes un enlace, Wee lo clasifica por tema y subtema, evita duplicados y suma comentarios con Aura. Así se construyen hilos claros y se mantiene el contexto dentro de la comunidad.", "You share a link, Wee classifies it by topic and subtopic, avoids duplicates and adds Aura comments. This creates clear threads and keeps context inside the community.")}
                  </p>
                </article>

                <article className="about-card">
                  <h3><Icon name="check" /> {pick(language, "Calidad del contenido", "Content quality")}</h3>
                  <p>
                    {pick(language, "Usamos reglas claras: reputación de la fuente, señales de evidencia, detección de titulares gancho, actualidad y valoración del grupo. Así sube lo útil y se marca lo dudoso.", "We use clear rules: source reputation, evidence signals, clickbait-title detection, recency and group ratings. Useful content rises and doubtful content gets flagged.")}
                  </p>
                </article>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};
