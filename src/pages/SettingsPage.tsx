import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { normalizeLanguage, pick, useI18n } from "../lib/i18n";
import { TopBar } from "../components/TopBar";
import { checkSupabaseConnection, hasSupabaseConfig } from "../lib/backend/supabase";
import type { AppLanguage, User, UserPreferences } from "../lib/types";

interface SettingsPageProps {
  activeUser: User;
  preferences: UserPreferences | null;
  knownTopics: string[];
  onUpdateLanguage: (userId: string, language: AppLanguage) => Promise<void>;
  onSave: (prefs: UserPreferences) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onDeleteMyData: () => Promise<void>;
  onOpenShareModal?: () => void;
  onLogout: () => void;
}

const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const uniq = (items: string[]): string[] => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

export const SettingsPage = ({
  activeUser,
  preferences,
  knownTopics,
  onUpdateLanguage,
  onSave,
  onExport,
  onImport,
  onDeleteMyData,
  onOpenShareModal,
  onLogout
}: SettingsPageProps) => {
  const { language } = useI18n();
  const [preferredTopics, setPreferredTopics] = useState<string[]>([]);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(normalizeLanguage(activeUser.language));
  const [noiseMode, setNoiseMode] = useState<"open" | "balanced" | "strict">("balanced");
  const [message, setMessage] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(false);

  useEffect(() => {
    setSelectedLanguage(normalizeLanguage(activeUser.language));
  }, [activeUser.language]);

  useEffect(() => {
    if (!preferences) return;
    setPreferredTopics(preferences.preferredTopics);
    setBlockedDomains(preferences.blockedDomains);
    setBlockedKeywords(preferences.blockedKeywords);
  }, [preferences]);

  const save = async () => {
    await onSave({
      userId: activeUser.id,
      preferredTopics: uniq(preferredTopics),
      blockedDomains: uniq(blockedDomains),
      blockedKeywords: uniq(blockedKeywords)
    });

    setMessage(pick(language, "Preferencias guardadas.", "Preferences saved."));
  };

  const saveLanguage = async () => {
    await onUpdateLanguage(activeUser.id, selectedLanguage);
    setMessage(pick(language, "Idioma actualizado.", "Language updated."));
  };

  const quickDomains = ["x.com", "twitter.com", "tiktok.com", "instagram.com"];
  const quickKeywords = ["rumor", "sin confirmar", "viral", "te va a sorprender"];
  const suggestedTopics = knownTopics.slice(0, 18);

  const togglePreferredTopic = (topic: string) => {
    const current = new Set(preferredTopics);
    if (current.has(topic)) {
      current.delete(topic);
    } else {
      current.add(topic);
    }
    setPreferredTopics(Array.from(current));
  };

  const toggleDomain = (domain: string) => {
    const current = new Set(blockedDomains);
    if (current.has(domain)) {
      current.delete(domain);
    } else {
      current.add(domain);
    }
    setBlockedDomains(Array.from(current));
  };

  const toggleKeyword = (keyword: string) => {
    const current = new Set(blockedKeywords);
    if (current.has(keyword)) {
      current.delete(keyword);
    } else {
      current.add(keyword);
    }
    setBlockedKeywords(Array.from(current));
  };

  const addTopicsFromInput = () => {
    const next = parseCsv(topicInput);
    if (!next.length) return;
    setPreferredTopics((curr) => uniq([...curr, ...next]));
    setTopicInput("");
  };

  const addDomainsFromInput = () => {
    const next = parseCsv(domainInput).map((item) => item.replace(/^https?:\/\//, "").replace(/^www\./, ""));
    if (!next.length) return;
    setBlockedDomains((curr) => uniq([...curr, ...next]));
    setDomainInput("");
  };

  const addKeywordsFromInput = () => {
    const next = parseCsv(keywordInput);
    if (!next.length) return;
    setBlockedKeywords((curr) => uniq([...curr, ...next]));
    setKeywordInput("");
  };

  const applyMode = (mode: "open" | "balanced" | "strict") => {
    setNoiseMode(mode);
    if (mode === "open") {
      setBlockedDomains([]);
      setBlockedKeywords([]);
      return;
    }
    if (mode === "balanced") {
      setBlockedDomains(["tiktok.com"]);
      setBlockedKeywords(["te va a sorprender", "sin confirmar"]);
      return;
    }
    setBlockedDomains(["tiktok.com", "instagram.com", "twitter.com", "x.com"]);
    setBlockedKeywords(["te va a sorprender", "sin confirmar", "rumor", "viral"]);
  };

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />
      <section className="page-section">
        <h2><Icon name="settings" /> {pick(language, "Preferencias", "Preferences")}</h2>
        <p className="section-intro">
          {pick(language, "Hazlo simple: elige qué te interesa y cuánto ruido quieres quitar.", "Keep it simple: choose what interests you and how much noise to remove.")}
        </p>

        <div className="settings-grid">
          <article className="settings-card">
            <h3><Icon name="target" /> {pick(language, "Qué quieres ver primero", "What you want to see first")}</h3>
            <p className="hint">{pick(language, "Marca temas y te los subimos al inicio.", "Pick topics and we'll move them to the top.")}</p>
            {suggestedTopics.length > 0 ? (
              <div className="settings-known-topics">
                {suggestedTopics.map((topic) => {
                  const active = preferredTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      className={active ? "chip chip-action settings-topic-active" : "chip chip-action"}
                      onClick={() => togglePreferredTopic(topic)}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="hint">{pick(language, "Aún no hay temas detectados. Comparte algunas noticias y aparecerán aquí.", "No topics detected yet. Share some posts and they will appear here.")}</p>
            )}

            <div className="settings-inline-add">
              <input
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                placeholder={pick(language, "Añadir temas (ej: salud, ciencia)", "Add topics (ex: health, science)")}
              />
              <button type="button" className="btn" onClick={addTopicsFromInput}>
                {pick(language, "Añadir", "Add")}
              </button>
            </div>
          </article>

          <article className="settings-card">
            <h3><Icon name="user" /> {pick(language, "Idioma de la app", "App language")}</h3>
            <p className="hint">{pick(language, "Elige el idioma de la interfaz para tu perfil.", "Choose the interface language for your profile.")}</p>
            <div className="settings-inline-add">
              <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value as AppLanguage)}>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="gl">Galego</option>
              </select>
              <button type="button" className="btn" onClick={() => void saveLanguage()}>
                {pick(language, "Aplicar", "Apply")}
              </button>
            </div>
          </article>

          <article className="settings-card">
            <h3><Icon name="bolt" /> {pick(language, "Ruido del feed", "Feed noise")}</h3>
            <p className="hint">{pick(language, "Elige un modo rápido. Luego puedes retocar debajo.", "Choose a quick mode. You can fine-tune below.")}</p>
            <div className="settings-modes">
              <button
                type="button"
                className={noiseMode === "open" ? "tab active" : "tab"}
                onClick={() => applyMode("open")}
              >
                {pick(language, "Abierto", "Open")}
              </button>
              <button
                type="button"
                className={noiseMode === "balanced" ? "tab active" : "tab"}
                onClick={() => applyMode("balanced")}
              >
                {pick(language, "Equilibrado", "Balanced")}
              </button>
              <button
                type="button"
                className={noiseMode === "strict" ? "tab active" : "tab"}
                onClick={() => applyMode("strict")}
              >
                {pick(language, "Estricto", "Strict")}
              </button>
            </div>
            <p className="hint">
              {noiseMode === "open"
                ? pick(language, "Ves casi todo.", "You see almost everything.")
                : noiseMode === "balanced"
                  ? pick(language, "Reduce ruido sin pasarse.", "Reduces noise without overdoing it.")
                  : pick(language, "Filtra fuerte: solo lo más limpio.", "Strong filter: only the cleanest content.")}
            </p>
          </article>
        </div>

        <div className="settings-grid">
          <article className="settings-card">
            <h3><Icon name="link" /> {pick(language, "Fuentes que no quieres ver", "Sources you do not want to see")}</h3>
            <div className="settings-known-topics">
              {quickDomains.map((domain) => {
                const active = blockedDomains.includes(domain);
                return (
                  <button
                    key={domain}
                    type="button"
                    className={active ? "chip chip-action settings-topic-active" : "chip chip-action"}
                    onClick={() => toggleDomain(domain)}
                  >
                    {domain}
                  </button>
                );
              })}
            </div>
            <div className="settings-inline-add">
              <input
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder={pick(language, "Añadir dominios (ej: ejemplo.com)", "Add domains (ex: example.com)")}
              />
              <button type="button" className="btn" onClick={addDomainsFromInput}>
                {pick(language, "Añadir", "Add")}
              </button>
            </div>
          </article>

          <article className="settings-card">
            <h3><Icon name="comment" /> {pick(language, "Palabras para filtrar", "Keywords to filter")}</h3>
            <div className="settings-known-topics">
              {quickKeywords.map((keyword) => {
                const active = blockedKeywords.includes(keyword);
                return (
                  <button
                    key={keyword}
                    type="button"
                    className={active ? "chip chip-action settings-topic-active" : "chip chip-action"}
                    onClick={() => toggleKeyword(keyword)}
                  >
                    {keyword}
                  </button>
                );
              })}
            </div>
            <div className="settings-inline-add">
              <input
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                placeholder={pick(language, "Añadir palabras (ej: bulo, rumor)", "Add keywords (ex: rumor, hoax)")}
              />
              <button type="button" className="btn" onClick={addKeywordsFromInput}>
                {pick(language, "Añadir", "Add")}
              </button>
            </div>
          </article>
        </div>

        <article className="settings-card">
          <h3><Icon name="target" /> {pick(language, "Resumen", "Summary")}</h3>
          <p className="hint">
            {pick(language, "Temas priorizados", "Prioritized topics")}: {preferredTopics.length} · {pick(language, "Fuentes ocultas", "Hidden sources")}: {blockedDomains.length} · {pick(language, "Palabras filtradas", "Filtered keywords")}: {blockedKeywords.length}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void save()}>
            <Icon name="check" /> {pick(language, "Guardar preferencias", "Save preferences")}
          </button>
        </article>

        <article className="settings-card">
          <h3><Icon name="link" /> Backend (Supabase)</h3>
          <p className="hint">
            {hasSupabaseConfig
              ? pick(language, "Configuración detectada. Puedes verificar conexión.", "Configuration detected. You can verify connection.")
              : pick(language, "No hay configuración de Supabase en este entorno.", "No Supabase configuration was found in this environment.")}
          </p>
          <button
            type="button"
            className="btn"
            disabled={!hasSupabaseConfig || checkingBackend}
            onClick={async () => {
              setCheckingBackend(true);
              const result = await checkSupabaseConnection();
              setBackendStatus(result.message);
              setCheckingBackend(false);
            }}
          >
            <Icon name="check" /> {pick(language, "Comprobar conexión", "Check connection")}
          </button>
          {backendStatus ? <p className="hint">{backendStatus}</p> : null}
        </article>

        <article className="settings-card">
          <h3><Icon name="book" /> {pick(language, "Respaldo de tus datos", "Data backup")}</h3>
          <p className="hint">{pick(language, "Exporta o importa tu contenido local cuando quieras.", "Export or import your local content anytime.")}</p>
          <div className="settings-known-topics">
            <button type="button" className="btn" onClick={() => void onExport()}>
              <Icon name="download" /> {pick(language, "Exportar copia", "Export backup")}
            </button>

            <label className="btn">
              <Icon name="upload" /> {pick(language, "Importar copia", "Import backup")}
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void onImport(file);
                }}
              />
            </label>
          </div>
        </article>

        <article className="settings-card">
          <h3><Icon name="shield" /> {pick(language, "Privacidad y datos", "Privacy & data", "Privacidade e datos")}</h3>
          <p className="hint">
            {pick(
              language,
              "Wee guarda tus datos solo en este dispositivo (IndexedDB/localStorage). No enviamos datos a servidores externos.",
              "Wee stores your data only on this device (IndexedDB/localStorage). No data is sent to external servers.",
              "Wee garda os teus datos só neste dispositivo (IndexedDB/localStorage). Non enviamos datos a servidores externos."
            )}
          </p>
          <ul className="rules-list">
            <li>{pick(language, "Acceso/portabilidad: exporta tu copia JSON.", "Access/portability: export your JSON copy.", "Acceso/portabilidade: exporta a túa copia JSON.")}</li>
            <li>{pick(language, "Rectificación: edita alias/foto y publicaciones.", "Rectification: edit alias/photo and posts.", "Rectificación: edita alias/foto e publicacións.")}</li>
            <li>{pick(language, "Supresión: elimina tu cuenta y tus datos locales.", "Erasure: delete your account and local data.", "Supresión: elimina a túa conta e os teus datos locais.")}</li>
          </ul>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const okDelete = window.confirm(
                pick(
                  language,
                  "Esto eliminará tu cuenta y tus datos en este dispositivo. ¿Continuar?",
                  "This will delete your account and your data on this device. Continue?",
                  "Isto eliminará a túa conta e os teus datos neste dispositivo. Continuar?"
                )
              );
              if (!okDelete) return;
              await onDeleteMyData();
            }}
          >
            <Icon name="trash" /> {pick(language, "Eliminar mis datos", "Delete my data", "Eliminar os meus datos")}
          </button>
        </article>

        {message ? <p className="hint">{message}</p> : null}
      </section>
    </main>
  );
};
