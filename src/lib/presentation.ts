import type { AppLanguage, Post, QualityLabel } from "./types";
import { safeDomainFromUrl } from "./utils";

const TOPIC_INTRO_ES: Record<string, string> = {
  war: "Contexto del conflicto y sus efectos inmediatos.",
  geopolitics: "Lectura diplomática y su impacto internacional.",
  tech: "Novedad tecnológica con impacto práctico.",
  local: "Tema cercano con impacto en la comunidad.",
  economy: "Clave económica para entender tendencia y riesgo.",
  science: "Hallazgo o avance respaldado por evidencia.",
  sports: "Resumen del momento deportivo.",
  memes: "Contenido viral de tono ligero.",
  misc: "Actualización general para seguir el hilo."
};

const TOPIC_INTRO_EN: Record<string, string> = {
  war: "Conflict context and immediate effects.",
  geopolitics: "Diplomatic perspective and global impact.",
  tech: "Technology update with practical impact.",
  local: "Local topic with community impact.",
  economy: "Economic signal to understand trend and risk.",
  science: "Finding or progress backed by evidence.",
  sports: "Sports update at a glance.",
  memes: "Viral content with a light tone.",
  misc: "General update to keep following the thread."
};

const TOPIC_INTRO_GL: Record<string, string> = {
  war: "Contexto do conflito e os seus efectos inmediatos.",
  geopolitics: "Lectura diplomática e impacto internacional.",
  tech: "Novidade tecnolóxica con impacto práctico.",
  local: "Tema próximo con impacto na comunidade.",
  economy: "Clave económica para entender tendencia e risco.",
  science: "Achado ou avance apoiado en evidencia.",
  sports: "Resumo do momento deportivo.",
  memes: "Contido viral de ton lixeiro.",
  misc: "Actualización xeral para seguir o fío."
};

const decodeSlug = (value: string): string => {
  const decoded = decodeURIComponent(value)
    .replace(/[-_]+/g, " ")
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return decoded;
};

const toSentenceCase = (value: string): string => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const BAD_TITLE_PATTERNS: RegExp[] = [
  /\bverifying\b/i,
  /\bverify(ing)?\b.*\b(human|device|browser)\b/i,
  /\bjust a moment\b/i,
  /\bchecking your browser\b/i,
  /\bsecurity check\b/i,
  /\battention required\b/i,
  /\baccess denied\b/i,
  /\benable javascript\b/i,
  /\bplease wait\b/i,
  /\bcaptcha\b/i,
  /\bcloudflare\b/i,
  /\bare you human\b/i,
  /\bone more step\b/i,
  /\bbot check\b/i
];

export const isUnusableTitle = (value?: string): boolean => {
  const normalized = value?.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  if (normalized.length < 6) return true;
  return BAD_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const deriveTitleFromUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return undefined;
    const candidate = segments[segments.length - 1];
    const clean = decodeSlug(candidate);
    if (!clean) return undefined;
    if (clean.includes(".")) return undefined;
    if (clean.length < 6) return undefined;
    return toSentenceCase(clean);
  } catch {
    return undefined;
  }
};

const looksLikeUrlTitle = (value: string): boolean =>
  /^https?:\/\//i.test(value) || value.includes("/") || value.includes(".");

export const displayTitle = (post: Post): string => {
  const previewTitle = post.previewTitle?.trim();
  if (previewTitle && !looksLikeUrlTitle(previewTitle) && !isUnusableTitle(previewTitle)) {
    return previewTitle;
  }

  const storedTitle = post.title?.trim();
  if (storedTitle && !looksLikeUrlTitle(storedTitle) && !isUnusableTitle(storedTitle)) {
    return storedTitle;
  }

  const derived = deriveTitleFromUrl(post.url);
  if (derived) return derived;

  if (post.text?.trim()) {
    return post.text.slice(0, 86);
  }

  return "Noticia compartida";
};

const extractYoutubeId = (url?: string): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ?? null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/")[2] ?? null;
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const previewImage = (post: Post): string | null => {
  if (post.previewImageUrl) {
    return post.previewImageUrl;
  }

  const ytId = extractYoutubeId(post.url);
  if (ytId) {
    return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }

  const domain = post.sourceDomain ?? safeDomainFromUrl(post.url);
  if (!domain) return null;

  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
};

export const topicIntro = (topics: string[], language: AppLanguage = "es"): string => {
  const primary = topics[0] ?? "misc";
  if (language === "gl") return TOPIC_INTRO_GL[primary] ?? TOPIC_INTRO_GL.misc;
  if (language === "en") return TOPIC_INTRO_EN[primary] ?? TOPIC_INTRO_EN.misc;
  return TOPIC_INTRO_ES[primary] ?? TOPIC_INTRO_ES.misc;
};

export const sourceLabel = (post: Post): string => {
  if (post.previewSiteName) return post.previewSiteName;
  const domain = post.sourceDomain ?? safeDomainFromUrl(post.url);
  return domain ?? "fuente no disponible";
};

export const qualityLabelText = (label: QualityLabel, language: AppLanguage = "es"): string => {
  if (language === "gl") {
    if (label === "high") return "alta";
    if (label === "medium") return "media";
    if (label === "low") return "baixa";
    return "gancho";
  }
  if (language === "en") {
    if (label === "high") return "high";
    if (label === "medium") return "medium";
    if (label === "low") return "low";
    return "clickbait";
  }
  if (label === "high") return "alta";
  if (label === "medium") return "media";
  if (label === "low") return "baja";
  return "gancho";
};

export const formatAuraScore = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value);
  return Math.max(1, Math.min(100, rounded));
};

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11
};

const validTimestamp = (ts: number): boolean => {
  const year = new Date(ts).getFullYear();
  return year >= 2000 && ts <= Date.now() + 1000 * 60 * 60 * 24;
};

const parseNumericDate = (input: string): number | null => {
  const iso = input.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]) - 1;
    const d = Number(iso[3]);
    const ts = new Date(y, m, d).getTime();
    return validTimestamp(ts) ? ts : null;
  }

  const dmy = input.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]) - 1;
    const y = Number(dmy[3]);
    const ts = new Date(y, m, d).getTime();
    return validTimestamp(ts) ? ts : null;
  }

  return null;
};

const parseSpanishDate = (input: string): number | null => {
  const match = input.toLowerCase().match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(20\d{2})\b/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = SPANISH_MONTHS[match[2]];
  const year = Number(match[3]);
  if (month === undefined) return null;
  const ts = new Date(year, month, day).getTime();
  return validTimestamp(ts) ? ts : null;
};

export const extractNewsDate = (post: Post): number => {
  const sources = [post.title, post.text, post.url].filter(Boolean) as string[];
  for (const source of sources) {
    const numeric = parseNumericDate(source);
    if (numeric) return numeric;
    const spanish = parseSpanishDate(source);
    if (spanish) return spanish;
  }
  return post.createdAt;
};

export const formatNewsDate = (timestamp: number): string =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(timestamp);
