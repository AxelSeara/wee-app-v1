import type { ClassifyInput, ClassifyOutput, QualityLabel } from "./types";
import { clamp, normalizeSpace, safeDomainFromUrl } from "./utils";

export const TOPIC_KEYWORDS: Record<string, string[]> = {
  iran: ["iran", "teheran", "tehran", "persia", "ayatollah", "revolucion islamica"],
  war: ["war", "guerra", "conflict", "conflicto", "attack", "invasion", "military", "ceasefire", "artillery", "drone strike", "battlefront"],
  geopolitics: ["geopolitics", "geopolitica", "sanctions", "diplomacy", "nato", "onu", "united nations", "foreign policy", "summit", "embassy"],
  tech: ["technology", "tecnologia", "tech", "ai", "ia", "software", "startup", "open source", "chip", "semiconductor", "cloud", "robot", "cybersecurity", "app", "platform"],
  economy: ["economy", "economia", "inflation", "inflacion", "gdp", "mercado", "stocks", "unemployment", "recession", "interest rates", "fiscal", "budget", "tariff"],
  science: ["science", "ciencia", "research", "study", "estudio", "paper", "laboratory", "peer reviewed", "discovery", "astronomy", "genetics"],
  health: ["health", "salud", "hospital", "vaccine", "vacuna", "epidemic", "virus", "clinical trial", "public health", "medical"],
  climate: ["climate", "clima", "emissions", "co2", "renewables", "energia renovable", "wildfire", "drought", "flood", "temperatures"],
  politics: ["election", "elecciones", "parliament", "congreso", "senate", "president", "prime minister", "campaign", "party", "vote"],
  local: ["ourense", "galicia", "local", "city council", "concello", "municipal", "neighborhood", "barrio", "provincia", "ayuntamiento"],
  sports: ["sports", "deporte", "futbol", "football", "nba", "liga", "champions", "goal", "matchday", "tennis", "formula 1", "motogp"],
  culture: ["culture", "cultura", "cinema", "cine", "music", "musica", "festival", "book", "arte", "museum", "series"],
  education: ["education", "educacion", "universidad", "school", "escuela", "students", "curriculum", "scholarship", "exam"],
  memes: ["meme", "viral", "shitpost", "funny", "joke", "lol", "reaction image", "copypasta"]
};

export const LOCATION_KEYWORDS: Record<string, string[]> = {
  ourense: ["ourense", "orense"],
  spain: ["spain", "españa", "madrid", "barcelona"],
  usa: ["usa", "united states", "washington", "new york"],
  uk: ["uk", "united kingdom", "london", "britain"],
  ukraine: ["ukraine", "ucrania", "kyiv"],
  israel: ["israel", "gaza", "tel aviv", "jerusalem"]
};

const CLICKBAIT_PATTERNS = [
  /no vas a creer/i,
  /incre[ií]ble/i,
  /urgente/i,
  /shock/i,
  /te va a/i,
  /lo que pas[oó]/i,
  /esto cambia todo/i,
  /must see/i,
  /you won't believe/i,
  /breaking/i,
  /!!!+/,
  /\bOMG\b/i
];

const TIER_A_DOMAINS = [
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "dw.com",
  "elpais.com",
  "theguardian.com",
  "ft.com",
  "nytimes.com"
];

const TIER_B_DOMAINS = [
  "cnn.com",
  "washingtonpost.com",
  "abc.es",
  "elmundo.es",
  "euronews.com",
  "politico.com",
  "eldiario.es",
  "20minutos.es"
];

const SOCIAL_DOMAINS = [
  "x.com",
  "twitter.com",
  "tiktok.com",
  "instagram.com",
  "reddit.com",
  "facebook.com",
  "youtube.com"
];

const TOPIC_WEIGHTS: Record<string, number> = {
  war: 18,
  geopolitics: 16,
  tech: 15,
  politics: 15,
  local: 14,
  science: 13,
  health: 13,
  climate: 13,
  economy: 12,
  culture: 10,
  education: 10,
  sports: 10,
  iran: 10,
  memes: 4,
  misc: 8
};

const QUALITY_BASE = 52;

const QUALITY_WEIGHTS = {
  hasUrl: 5,
  httpsBonus: 2,
  insecurePenalty: 4,
  missingUrlPenalty: 14,
  tierA: 25,
  tierB: 15,
  socialPenaltyTwitterContext: 4,
  socialPenaltyTwitterNoContext: 8,
  socialPenaltyContext: 8,
  socialPenaltyNoContext: 12,
  titleInformative: 4,
  titleTooShortPenalty: 8,
  titleTooLongPenalty: 4,
  textStrongContext: 6,
  textTooShortPenalty: 12,
  textLowContextPenalty: 6,
  missingTitleAndShortPenalty: 8,
  hasNumbersOrDates: 4,
  quoteWithAttribution: 6,
  unverifiedClaimPenalty: 10,
  excessivePunctuationPenalty: 5,
  clickbaitStrongPenalty: 40,
  clickbaitMediumPenalty: 14
} as const;

const QUALITY_CAPS = {
  min: 0,
  max: 100
} as const;

const AURA_BASE = 30;

const AURA_CAPS = {
  min: 1,
  max: 100,
  clickbaitMax: 55
} as const;

const TOPIC_DOMAIN_HINTS: Record<string, string[]> = {
  tech: ["techcrunch", "theverge", "wired", "github.blog"],
  economy: ["bloomberg", "wsj", "ft.com", "expansion.com"],
  sports: ["espn", "marca.com", "as.com", "goal.com"],
  science: ["nature.com", "science.org", "newscientist.com"],
  geopolitics: ["foreignaffairs", "aljazeera", "politico"],
  politics: ["politico", "parlamento", "senado"],
  climate: ["copernicus", "ipcc", "climate.nasa"],
  health: ["who.int", "cdc.gov", "nejm.org"],
  culture: ["imdb.com", "metacritic", "filmaffinity"],
  local: ["lavozdegalicia", "faro de vigo", "ourense"]
};

const TOPIC_EXCLUSIONS: Record<string, string[]> = {
  memes: ["official report", "informe oficial", "policy paper", "research paper"],
  war: ["star wars", "video game", "gameplay"],
  tech: ["low tech", "technology transfer office"] // weak disambiguation
};

const SUBTOPIC_KEYWORDS: Record<string, string[]> = {
  "tech/ai": ["llm", "machine learning", "generative ai", "chatbot", "model weights", "openai", "anthropic"],
  "tech/chips": ["semiconductor", "chip", "gpu", "tsmc", "fab", "wafer"],
  "tech/cybersecurity": ["malware", "ransomware", "data breach", "zero day", "phishing", "vulnerability"],
  "economy/inflation": ["inflation", "cpi", "ipc", "consumer prices"],
  "economy/markets": ["stock market", "stocks", "nasdaq", "dow jones", "ibex", "wall street"],
  "economy/rates": ["interest rates", "rate hike", "fed", "ecb", "bce"],
  "politics/elections": ["election", "vote", "poll", "ballot", "campaign", "primaries"],
  "politics/policy": ["bill", "lawmakers", "legislation", "regulation", "decree"],
  "war/ceasefire": ["ceasefire", "truce", "peace talks", "negotiation"],
  "war/strikes": ["airstrike", "drone strike", "missile", "artillery", "offensive"],
  "science/space": ["nasa", "spacex", "orbit", "telescope", "launch", "astronomy"],
  "science/biotech": ["genome", "crispr", "biotech", "clinical trial", "drug discovery"],
  "health/public-health": ["public health", "outbreak", "epidemic", "vaccination", "who"],
  "climate/extreme-weather": ["wildfire", "flood", "heatwave", "hurricane", "drought"],
  "climate/energy-transition": ["renewables", "solar", "wind power", "grid", "emissions"],
  "sports/football": ["football", "futbol", "liga", "champions", "goal", "coach"],
  "sports/basketball": ["nba", "playoffs", "basketball", "triple double"],
  "culture/cinema": ["film", "movie", "cinema", "director", "box office"],
  "culture/music": ["album", "concert", "music", "song", "festival"]
};

export const normalizeInputText = (input: ClassifyInput): string => {
  const merged = `${input.title ?? ""} ${input.text ?? ""} ${input.url ?? ""}`;
  return normalizeSpace(merged);
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stripAccents = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeTopicText = (value: string): string => stripAccents(normalizeSpace(value));

const keywordMatchCount = (normalizedText: string, keyword: string): number => {
  if (!keyword.trim()) return 0;
  const normalizedKeyword = normalizeTopicText(keyword.trim());

  // Prefix stem, e.g. "tecnolog*" matches tecnologia/tecnologico
  if (normalizedKeyword.endsWith("*")) {
    const stem = normalizedKeyword.slice(0, -1);
    const tokens = normalizedText.split(/[^a-z0-9]+/).filter(Boolean);
    return tokens.filter((token) => token.startsWith(stem) && token.length >= stem.length + 2).length;
  }

  const escaped = escapeRegex(normalizedKeyword);
  const pattern =
    normalizedKeyword.includes(" ") || normalizedKeyword.includes("-")
      ? new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "g")
      : new RegExp(`\\b${escaped}\\b`, "g");
  return [...normalizedText.matchAll(pattern)].length;
};

export const topicSignalStrength = (normalizedText: string, topic: string): number => {
  const preparedText = normalizeTopicText(normalizedText);
  const topicKeywords = TOPIC_KEYWORDS[topic] ?? [];
  const locationKeywords = LOCATION_KEYWORDS[topic] ?? [];
  const all = [...topicKeywords, ...locationKeywords];

  const baseScore = all.reduce((sum, keyword) => {
    const count = keywordMatchCount(preparedText, keyword);
    const weight = keyword.includes(" ") ? 2.4 : 1;
    return sum + count * weight;
  }, 0);

  const excluded = (TOPIC_EXCLUSIONS[topic] ?? []).some((keyword) => keywordMatchCount(preparedText, keyword) > 0);
  if (excluded) return Math.max(0, baseScore - 3);

  return baseScore;
};

export const detectTopics = (normalizedText: string, sourceDomain?: string): string[] => {
  const preparedText = normalizeTopicText(normalizedText);
  const scores = new Map<string, number>();

  Object.keys(TOPIC_KEYWORDS).forEach((topic) => {
    const score = topicSignalStrength(preparedText, topic);
    if (score > 0) scores.set(topic, score);
  });

  Object.keys(LOCATION_KEYWORDS).forEach((topic) => {
    const score = topicSignalStrength(preparedText, topic);
    if (score > 0) scores.set(topic, (scores.get(topic) ?? 0) + score);
  });

  if (sourceDomain) {
    Object.entries(TOPIC_DOMAIN_HINTS).forEach(([topic, hints]) => {
      if (hints.some((hint) => sourceDomain.includes(hint))) {
        scores.set(topic, (scores.get(topic) ?? 0) + 2.4);
      }
    });
  }

  // If location tags are present, give a slight boost to local forum relevance.
  const hasLocationTopic = Object.keys(LOCATION_KEYWORDS).some((topic) => (scores.get(topic) ?? 0) > 0);
  if (hasLocationTopic) {
    scores.set("local", (scores.get("local") ?? 0) + 1);
  }

  if (scores.size === 0) return ["misc"];

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const topScore = ranked[0][1];
  const selected = ranked
    .filter(([, score]) => score >= 2.2 && score >= topScore * 0.52)
    .map(([topic]) => topic)
    .slice(0, 5);

  if (selected.length > 0) {
    return selected;
  }

  return [ranked[0][0] ?? "misc"];
};

const detectTopicsFromInput = (input: ClassifyInput, sourceDomain?: string): string[] => {
  const title = normalizeTopicText(input.title ?? "");
  const text = normalizeTopicText(input.text ?? "");
  const url = normalizeTopicText(input.url ?? "");

  const scores = new Map<string, number>();
  const allTopics = Array.from(new Set([...Object.keys(TOPIC_KEYWORDS), ...Object.keys(LOCATION_KEYWORDS)]));

  allTopics.forEach((topic) => {
    const titleScore = topicSignalStrength(title, topic) * 2.3;
    const textScore = topicSignalStrength(text, topic) * 1;
    const urlScore = topicSignalStrength(url, topic) * 0.55;
    const total = titleScore + textScore + urlScore;
    if (total > 0) scores.set(topic, total);
  });

  if (sourceDomain) {
    Object.entries(TOPIC_DOMAIN_HINTS).forEach(([topic, hints]) => {
      if (hints.some((hint) => sourceDomain.includes(hint))) {
        scores.set(topic, (scores.get(topic) ?? 0) + 2.4);
      }
    });
  }

  const hasLocationTopic = Object.keys(LOCATION_KEYWORDS).some((topic) => (scores.get(topic) ?? 0) > 0);
  if (hasLocationTopic) {
    scores.set("local", (scores.get("local") ?? 0) + 1.2);
  }

  if (scores.size === 0) return ["misc"];
  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const topScore = ranked[0][1];
  const selected = ranked
    .filter(([, score]) => score >= 2.2 && score >= topScore * 0.5)
    .map(([topic]) => topic)
    .slice(0, 5);

  return selected.length > 0 ? selected : [ranked[0][0] ?? "misc"];
};

const topicRationale = (normalizedText: string, topics: string[]): string[] => {
  const lines: string[] = [];
  topics.forEach((topic) => {
    const strength = topicSignalStrength(normalizedText, topic);
    if (strength > 0) {
      lines.push(`Tema "${topic}" detectado con señal ${strength.toFixed(1)}.`);
    }
  });
  return lines;
};

const detectSubtopics = (normalizedText: string, topics: string[]): string[] => {
  const prepared = normalizeTopicText(normalizedText);
  const allowedRoots = new Set(topics);
  const scored = Object.entries(SUBTOPIC_KEYWORDS)
    .map(([subtopic, keywords]) => {
      const root = subtopic.split("/")[0];
      if (!allowedRoots.has(root)) return { subtopic, score: 0 };
      const score = keywords.reduce((acc, keyword) => {
        const hits = keywordMatchCount(prepared, keyword);
        const weight = keyword.includes(" ") ? 2 : 1;
        return acc + hits * weight;
      }, 0);
      return { subtopic, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  const top = scored[0].score;
  return scored.filter((entry) => entry.score >= Math.max(1, top * 0.5)).slice(0, 4).map((entry) => entry.subtopic);
};

const getAllCapsRatio = (text: string): number => {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (!letters.length) return 0;
  const uppercase = letters.split("").filter((char) => char === char.toUpperCase()).length;
  return uppercase / letters.length;
};

const extractHosts = (text: string, url?: string): string[] => {
  const hosts = new Set<string>();
  const fromUrl = safeDomainFromUrl(url);
  if (fromUrl) hosts.add(fromUrl);

  const hostRegex = /\b(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})\b/gi;
  for (const match of text.matchAll(hostRegex)) {
    const host = (match[1] ?? "").toLowerCase();
    if (host && !host.includes("..")) hosts.add(host);
  }

  return Array.from(hosts);
};

const scoreQuality = (input: ClassifyInput, normalizedText: string, sourceDomain?: string): {
  score: number;
  flags: string[];
  rationale: string[];
  clickbaitStrong: boolean;
} => {
  let score = QUALITY_BASE;
  const flags: string[] = [];
  const rationale: string[] = [];
  const rawText = `${input.title ?? ""} ${input.text ?? ""}`;

  const hasUrl = Boolean(input.url);
  if (hasUrl) {
    score += QUALITY_WEIGHTS.hasUrl;
    rationale.push("Incluye enlace a una fuente.");
    if (input.url?.startsWith("https://")) {
      score += QUALITY_WEIGHTS.httpsBonus;
      rationale.push("La fuente usa HTTPS.");
    } else {
      score -= QUALITY_WEIGHTS.insecurePenalty;
      flags.push("insecure_source");
      rationale.push("La fuente no usa HTTPS.");
    }
  } else {
    score -= QUALITY_WEIGHTS.missingUrlPenalty;
    flags.push("no_source");
    rationale.push("Falta enlace a la fuente.");
  }

  if (sourceDomain) {
    if (TIER_A_DOMAINS.some((domain) => sourceDomain.endsWith(domain))) {
      score += QUALITY_WEIGHTS.tierA;
      rationale.push("Fuente de alta reputación (nivel A).");
    } else if (TIER_B_DOMAINS.some((domain) => sourceDomain.endsWith(domain))) {
      score += QUALITY_WEIGHTS.tierB;
      rationale.push("Fuente consolidada (nivel B).");
    }

    if (SOCIAL_DOMAINS.some((domain) => sourceDomain.endsWith(domain))) {
      const hasContext = (input.text ?? "").trim().length >= 90 || /\b(seg[uú]n|according to|report[oó]|confirm[oó])\b/i.test(normalizedText);
      const isTwitterLike = sourceDomain.endsWith("x.com") || sourceDomain.endsWith("twitter.com");
      const socialPenalty = isTwitterLike
        ? (hasContext ? QUALITY_WEIGHTS.socialPenaltyTwitterContext : QUALITY_WEIGHTS.socialPenaltyTwitterNoContext)
        : (hasContext ? QUALITY_WEIGHTS.socialPenaltyContext : QUALITY_WEIGHTS.socialPenaltyNoContext);
      score -= socialPenalty;
      flags.push("social_media");
      rationale.push(hasContext ? "Fuente en red social, pero con contexto adicional." : "Fuente en red social.");
    }
  }

  const titleLength = (input.title ?? "").trim().length;
  const textLength = (input.text ?? "").trim().length;
  if (titleLength >= 20 && titleLength <= 110) {
    score += QUALITY_WEIGHTS.titleInformative;
    rationale.push("El título tiene longitud informativa.");
  } else if (titleLength > 0 && titleLength < 8) {
    score -= QUALITY_WEIGHTS.titleTooShortPenalty;
    rationale.push("El título es demasiado corto para informar.");
  } else if (titleLength > 160) {
    score -= QUALITY_WEIGHTS.titleTooLongPenalty;
    rationale.push("El título es excesivamente largo.");
  }

  if (textLength >= 80 && textLength <= 1200) {
    score += QUALITY_WEIGHTS.textStrongContext;
    rationale.push("El texto aporta contexto suficiente.");
  } else if (textLength > 0 && textLength < 30) {
    score -= QUALITY_WEIGHTS.textTooShortPenalty;
    rationale.push("El texto es demasiado corto para validar contexto.");
  } else if (textLength > 0 && textLength < 80) {
    score -= QUALITY_WEIGHTS.textLowContextPenalty;
    rationale.push("El texto aporta poco contexto.");
  }

  if (titleLength === 0 && textLength < 40) {
    score -= QUALITY_WEIGHTS.missingTitleAndShortPenalty;
    rationale.push("Publicación muy corta y sin título.");
  }

  if (/\b\d{1,4}\b/.test(normalizedText) || /\b\d{4}-\d{2}-\d{2}\b/.test(normalizedText)) {
    score += QUALITY_WEIGHTS.hasNumbersOrDates;
    rationale.push("Incluye números o fechas.");
  }

  if (/"[^"]+"/.test(rawText) && /\b(seg[uú]n|according to|reportó|reported|confirmó|confirmed)\b/i.test(normalizedText)) {
    score += QUALITY_WEIGHTS.quoteWithAttribution;
    rationale.push("Incluye cita con atribución.");
  }

  if (/\b(rumou?r|unverified|sin confirmar|supuestamente)\b/i.test(normalizedText)) {
    score -= QUALITY_WEIGHTS.unverifiedClaimPenalty;
    flags.push("unverified_claim");
    rationale.push("Incluye afirmaciones no verificadas.");
  }

  if (/(\?\?\?+|!!!+|¡¡¡+)/.test(rawText)) {
    score -= QUALITY_WEIGHTS.excessivePunctuationPenalty;
    rationale.push("La puntuación excesiva reduce fiabilidad.");
  }

  const clickbaitMatches = CLICKBAIT_PATTERNS.filter((pattern) => pattern.test(normalizedText));
  const emojiCount = (normalizedText.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length;
  const capsRatio = getAllCapsRatio(`${input.title ?? ""} ${input.text ?? ""}`);

  let clickbaitStrength = clickbaitMatches.length;
  if (emojiCount >= 4) clickbaitStrength += 1;
  if (capsRatio > 0.45) clickbaitStrength += 1;

  const clickbaitStrong = clickbaitStrength >= 2;
  const clickbaitMedium = clickbaitStrength === 1;
  if (clickbaitStrong) {
    score -= QUALITY_WEIGHTS.clickbaitStrongPenalty;
    flags.push("sensational");
    rationale.push("Señales fuertes de clickbait o sensacionalismo.");
  } else if (clickbaitMedium) {
    score -= QUALITY_WEIGHTS.clickbaitMediumPenalty;
    flags.push("sensational_soft");
    rationale.push("Se detecta un tono sensacionalista moderado.");
  }

  return {
    score: clamp(score, QUALITY_CAPS.min, QUALITY_CAPS.max),
    flags,
    rationale,
    clickbaitStrong
  };
};

const scoreInterest = (topics: string[], qualityScore: number, clickbait: boolean, createdAt?: number, textLength = 0): {
  score: number;
  rationale: string;
} => {
  const now = Date.now();
  const ts = createdAt ?? now;
  const ageHours = Math.max(0, (now - ts) / (1000 * 60 * 60));

  let score = AURA_BASE;
  const topicBoost = topics.reduce((acc, topic) => acc + (TOPIC_WEIGHTS[topic] ?? 6), 0) / Math.max(1, topics.length);
  const qualityNormalized = (qualityScore - 50) / 50;
  const contextBoost = 8 * Math.tanh(textLength / 220) - 2;
  const recencyBoost = 12 * Math.exp(-ageHours / 48) - 2.5;

  score += topicBoost * 0.85;
  score += qualityNormalized * 22;
  score += contextBoost;
  score += recencyBoost;

  score = clamp(score, AURA_CAPS.min, AURA_CAPS.max);

  if (clickbait) {
    score = Math.min(score, AURA_CAPS.clickbaitMax);
    return { score: Math.round(score), rationale: "Aura limitada por señales de clickbait." };
  }

  return { score: Math.round(score), rationale: "Aura calculada por tema, calidad, actualidad y contexto." };
};

const qualityLabelFromScore = (score: number, clickbaitStrong: boolean): QualityLabel => {
  if (clickbaitStrong) return "clickbait";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
};

export const classifyPost = (input: ClassifyInput, createdAt?: number): ClassifyOutput => {
  const normalizedText = normalizeInputText(input);
  const sourceDomain = safeDomainFromUrl(input.url);
  const extractedHosts = extractHosts(normalizedText, input.url);
  const topics = detectTopicsFromInput(input, sourceDomain);
  const subtopics = detectSubtopics(normalizedText, topics);

  const quality = scoreQuality(input, normalizedText, sourceDomain);
  const interest = scoreInterest(topics, quality.score, quality.clickbaitStrong, createdAt, (input.text ?? "").length);

  const qualityLabel = qualityLabelFromScore(quality.score, quality.clickbaitStrong);
  const rationale = [...topicRationale(normalizedText, topics), ...quality.rationale, interest.rationale];

  return {
    topics,
    subtopics,
    qualityLabel,
    qualityScore: quality.score,
    interestScore: interest.score,
    flags: quality.flags,
    rationale,
    sourceDomain,
    extractedHosts,
    normalizedText
  };
};
