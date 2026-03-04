import type {
  ClassifyInput,
  ClassifyOutput,
  QualityLabel,
  RuleAdjustment,
  ScoreBreakdown,
  TopicRulesetVersion
} from "./types";
import { clamp, normalizeSpace, safeDomainFromUrl } from "./utils";
import { runTopicEngineV2 } from "./topicEngineV2";

export type AuraRulesetVersion = "v1" | "v2";

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

const CURIOSITY_GAP_PATTERNS = [
  /lo que nadie te cuenta/i,
  /no imaginar[aá]s/i,
  /esto pas[oó] despu[eé]s/i,
  /the reason why/i,
  /this is why/i,
  /what happened next/i,
  /you need to know/i,
  /antes y despu[eé]s/i
];

const V2_ALLOWLIST_HIGH_DEFAULT = [
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "dw.com",
  "elpais.com",
  "theguardian.com",
  "ft.com",
  "nytimes.com"
];

const V2_ALLOWLIST_MID_DEFAULT = [
  "cnn.com",
  "washingtonpost.com",
  "abc.es",
  "elmundo.es",
  "euronews.com",
  "politico.com",
  "eldiario.es",
  "20minutos.es"
];

const V2_BLOCKLIST_DEFAULT = ["example-clickbait.com", "adf.ly", "bit.ly"];

const V2_PRIMARY_SOURCES_DEFAULT = [
  "who.int",
  "cdc.gov",
  "ec.europa.eu",
  "europa.eu",
  "gov",
  "gob.es",
  "boe.es",
  "un.org",
  "oecd.org",
  "imf.org",
  "worldbank.org",
  "nature.com",
  "science.org",
  "arxiv.org"
];

const parseEnvList = (value: string | undefined, fallback: string[]): string[] => {
  const parsed = (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
};

const TIER_A_DOMAINS = parseEnvList(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_AURA_ALLOWLIST_HIGH : undefined,
  V2_ALLOWLIST_HIGH_DEFAULT
);

const TIER_B_DOMAINS = parseEnvList(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_AURA_ALLOWLIST_MID : undefined,
  V2_ALLOWLIST_MID_DEFAULT
);

const V2_BLOCKLIST_DOMAINS = parseEnvList(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_AURA_BLOCKLIST : undefined,
  V2_BLOCKLIST_DEFAULT
);

const PRIMARY_SOURCE_DOMAINS = parseEnvList(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_AURA_PRIMARY_SOURCES : undefined,
  V2_PRIMARY_SOURCES_DEFAULT
);

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
  tech: ["low tech", "technology transfer office"]
};

const TOPIC_PHRASE_SIGNALS: Record<string, string[]> = {
  war: ["ceasefire talks", "peace talks", "missile strike", "drone attack", "military offensive"],
  geopolitics: ["foreign policy", "diplomatic summit", "security council", "international sanctions", "security guarantees"],
  politics: ["election results", "parliament vote", "campaign rally", "coalition government"],
  tech: ["artificial intelligence", "open source model", "software update", "data breach", "chip shortage"],
  economy: ["interest rates", "inflation data", "labor market", "economic outlook"],
  climate: ["extreme weather", "carbon emissions", "energy transition"],
  health: ["public health", "clinical trial", "hospital capacity"],
  science: ["peer reviewed", "research paper", "scientific study"],
  local: ["city council", "ourense province", "municipal budget"],
  sports: ["match day", "transfer market", "league table"],
  culture: ["box office", "film festival", "music festival"],
  education: ["school calendar", "university admissions", "education reform"]
};

const TOPIC_CONTEXT_CLUES: Record<string, Array<[string, string]>> = {
  war: [["attack", "military"], ["invasion", "troops"], ["missile", "border"]],
  geopolitics: [["summit", "leaders"], ["sanctions", "government"], ["nato", "security"], ["leaders", "security"]],
  politics: [["election", "vote"], ["parliament", "bill"], ["party", "campaign"]],
  tech: [["ai", "model"], ["software", "release"], ["chip", "gpu"]],
  economy: [["inflation", "rates"], ["market", "stocks"], ["budget", "deficit"]],
  climate: [["emissions", "co2"], ["heatwave", "climate"], ["drought", "temperatures"]],
  health: [["hospital", "patients"], ["vaccine", "trial"], ["outbreak", "public health"]],
  local: [["ourense", "concello"], ["municipal", "budget"], ["neighborhood", "city council"]],
  sports: [["league", "match"], ["goal", "coach"], ["playoffs", "team"]]
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

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "your", "about", "have", "has", "was", "were", "will", "would",
  "de", "del", "la", "el", "los", "las", "que", "con", "por", "para", "una", "uno", "sobre", "como", "más", "mas"
]);

const rulesetFromEnv = (): AuraRulesetVersion => {
  const value = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_AURA_RULESET_VERSION : undefined) ?? "v1";
  return value === "v2" ? "v2" : "v1";
};

const topicRulesetFromEnv = (): TopicRulesetVersion => {
  const value = (typeof import.meta !== "undefined" ? import.meta.env?.VITE_TOPIC_RULESET_VERSION : undefined) ?? "v1";
  return value === "v2" ? "v2" : "v1";
};

const base64Encode = (value: string): string => {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return value;
};

const serialiseBreakdownFlag = (kind: "quality" | "aura", breakdown: ScoreBreakdown): string => {
  const payload = JSON.stringify(breakdown);
  return `${kind}_breakdown:${base64Encode(payload)}`;
};

const serialiseTopicFlag = (value: unknown): string => `topic_breakdown_v2:${base64Encode(JSON.stringify(value))}`;

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

  if (selected.length > 0) return selected;
  return [ranked[0][0] ?? "misc"];
};

const detectTopicsFromInput = (input: ClassifyInput, sourceDomain?: string): string[] => {
  const title = normalizeTopicText(input.title ?? "");
  const text = normalizeTopicText(input.text ?? "");
  const url = normalizeTopicText(input.url ?? "");

  const scores = new Map<string, number>();
  const phraseHitsByTopic = new Map<string, number>();
  const contextHitsByTopic = new Map<string, number>();
  const allTopics = Array.from(new Set([...Object.keys(TOPIC_KEYWORDS), ...Object.keys(LOCATION_KEYWORDS)]));

  allTopics.forEach((topic) => {
    const titleScore = topicSignalStrength(title, topic) * 2.3;
    const textScore = topicSignalStrength(text, topic);
    const urlScore = topicSignalStrength(url, topic) * 0.55;
    const prepared = normalizeTopicText(`${title} ${text}`);
    const phraseHits = (TOPIC_PHRASE_SIGNALS[topic] ?? []).reduce(
      (acc, phrase) => acc + (keywordMatchCount(prepared, phrase) > 0 ? 1 : 0),
      0
    );
    const contextHits = (TOPIC_CONTEXT_CLUES[topic] ?? []).reduce((acc, [left, right]) => {
      return acc + (keywordMatchCount(prepared, left) > 0 && keywordMatchCount(prepared, right) > 0 ? 1 : 0);
    }, 0);
    const phraseBoost = phraseHits * 1.7;
    const contextBoost = contextHits * 1.1;
    phraseHitsByTopic.set(topic, phraseHits);
    contextHitsByTopic.set(topic, contextHits);
    const total = titleScore + textScore + urlScore + phraseBoost + contextBoost;
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
  const ranked = Array.from(scores.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const weightA = TOPIC_WEIGHTS[a[0]] ?? 0;
    const weightB = TOPIC_WEIGHTS[b[0]] ?? 0;
    if (weightB !== weightA) return weightB - weightA;
    return a[0].localeCompare(b[0]);
  });

  const topScore = ranked[0][1];
  const dynamicThreshold = topScore >= 6 ? 0.45 : 0.5;
  const selected = ranked
    .filter(([, score]) => score >= 2.1 && score >= topScore * dynamicThreshold)
    .map(([topic]) => topic)
    .slice(0, 5);

  const contextualCopicks = ranked
    .filter(([topic, score]) => {
      if (selected.includes(topic)) return false;
      const phraseHits = phraseHitsByTopic.get(topic) ?? 0;
      const contextHits = contextHitsByTopic.get(topic) ?? 0;
      return (phraseHits > 0 || contextHits > 0) && score >= 1.8;
    })
    .map(([topic]) => topic)
    .slice(0, Math.max(0, 5 - selected.length));

  const merged = [...selected, ...contextualCopicks].slice(0, 5);
  return merged.length > 0 ? merged : [ranked[0][0] ?? "misc"];
};

const topicRationale = (normalizedText: string, topics: string[]): string[] => {
  const lines: string[] = [];
  topics.forEach((topic) => {
    const strength = topicSignalStrength(normalizedText, topic);
    if (strength > 0) lines.push(`Tema "${topic}" detectado con señal ${strength.toFixed(1)}.`);
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

  const fromMetadata = inputOutboundHosts(text);
  fromMetadata.forEach((host) => hosts.add(host));

  return Array.from(hosts);
};

const inputOutboundHosts = (text: string): string[] => {
  const hosts = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
    const host = (match[1] ?? "").toLowerCase();
    if (host) hosts.add(host.replace(/^www\./, ""));
  }
  return Array.from(hosts);
};

const domainMatches = (domain: string | undefined, list: string[]): boolean => {
  if (!domain) return false;
  return list.some((item) => domain === item || domain.endsWith(`.${item}`));
};

const addAdjustment = (
  adjustments: RuleAdjustment[],
  ruleId: string,
  delta: number,
  evidence: string,
  firedRules: Set<string>
): number => {
  if (!delta) return 0;
  adjustments.push({ ruleId, delta, evidence });
  firedRules.add(ruleId);
  return delta;
};

const titleBodyMismatch = (title: string, body: string): { mismatch: boolean; evidence: string } => {
  const titleTokens = normalizeTopicText(title)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
  const uniqueTitleTokens = Array.from(new Set(titleTokens)).slice(0, 8);
  if (uniqueTitleTokens.length < 3) return { mismatch: false, evidence: "No hay suficientes tokens semánticos." };

  const normalizedBody = normalizeTopicText(body);
  const missing = uniqueTitleTokens.filter((token) => !new RegExp(`\\b${escapeRegex(token)}\\b`, "i").test(normalizedBody));
  const ratio = missing.length / uniqueTitleTokens.length;
  return {
    mismatch: ratio >= 0.7,
    evidence: `tokens_title=${uniqueTitleTokens.length}; missing=${missing.length}; ratio=${ratio.toFixed(2)}`
  };
};

const toBreakdown = (
  version: AuraRulesetVersion,
  baseScore: number,
  adjustments: RuleAdjustment[],
  min: number,
  max: number
): ScoreBreakdown => {
  const raw = adjustments.reduce((acc, item) => acc + item.delta, baseScore);
  const finalScore = clamp(Math.round(raw), min, max);
  return {
    version,
    baseScore,
    adjustments,
    finalScore,
    firedRules: adjustments.map((item) => item.ruleId)
  };
};

interface QualityEvalResult {
  score: number;
  flags: string[];
  rationale: string[];
  clickbaitStrong: boolean;
  breakdown: ScoreBreakdown;
}

interface InterestEvalResult {
  score: number;
  rationale: string;
  breakdown: ScoreBreakdown;
}

const evaluateQualityV1 = (input: ClassifyInput, normalizedText: string, sourceDomain?: string): QualityEvalResult => {
  const adjustments: RuleAdjustment[] = [];
  const firedRules = new Set<string>();
  const flags: string[] = [];
  const rationale: string[] = [];

  const rawText = `${input.title ?? ""} ${input.text ?? ""}`;
  const hasUrl = Boolean(input.url);

  if (hasUrl) {
    addAdjustment(adjustments, "v1.has_url", QUALITY_WEIGHTS.hasUrl, "Incluye enlace", firedRules);
    rationale.push("Incluye enlace a una fuente.");
    if (input.url?.startsWith("https://")) {
      addAdjustment(adjustments, "v1.https", QUALITY_WEIGHTS.httpsBonus, "Fuente HTTPS", firedRules);
      rationale.push("La fuente usa HTTPS.");
    } else {
      addAdjustment(adjustments, "v1.insecure", -QUALITY_WEIGHTS.insecurePenalty, "Fuente no HTTPS", firedRules);
      flags.push("insecure_source");
      rationale.push("La fuente no usa HTTPS.");
    }
  } else {
    addAdjustment(adjustments, "v1.no_url", -QUALITY_WEIGHTS.missingUrlPenalty, "Falta URL", firedRules);
    flags.push("no_source");
    rationale.push("Falta enlace a la fuente.");
  }

  if (sourceDomain) {
    if (domainMatches(sourceDomain, TIER_A_DOMAINS)) {
      addAdjustment(adjustments, "v1.domain_tier_a", QUALITY_WEIGHTS.tierA, `domain=${sourceDomain}`, firedRules);
      rationale.push("Fuente de alta reputación (nivel A).");
    } else if (domainMatches(sourceDomain, TIER_B_DOMAINS)) {
      addAdjustment(adjustments, "v1.domain_tier_b", QUALITY_WEIGHTS.tierB, `domain=${sourceDomain}`, firedRules);
      rationale.push("Fuente consolidada (nivel B).");
    }

    if (domainMatches(sourceDomain, SOCIAL_DOMAINS)) {
      const hasContext = (input.text ?? "").trim().length >= 90 || /\b(seg[uú]n|according to|report[oó]|confirm[oó])\b/i.test(normalizedText);
      const isTwitterLike = sourceDomain.endsWith("x.com") || sourceDomain.endsWith("twitter.com");
      const penalty = isTwitterLike
        ? (hasContext ? QUALITY_WEIGHTS.socialPenaltyTwitterContext : QUALITY_WEIGHTS.socialPenaltyTwitterNoContext)
        : (hasContext ? QUALITY_WEIGHTS.socialPenaltyContext : QUALITY_WEIGHTS.socialPenaltyNoContext);
      addAdjustment(adjustments, "v1.social_penalty", -penalty, `domain=${sourceDomain}; context=${hasContext}`, firedRules);
      flags.push("social_media");
      rationale.push(hasContext ? "Fuente en red social, pero con contexto adicional." : "Fuente en red social.");
    }
  }

  const titleLength = (input.title ?? "").trim().length;
  const textLength = (input.text ?? "").trim().length;

  if (titleLength >= 20 && titleLength <= 110) {
    addAdjustment(adjustments, "v1.title_informative", QUALITY_WEIGHTS.titleInformative, `title_len=${titleLength}`, firedRules);
    rationale.push("El título tiene longitud informativa.");
  } else if (titleLength > 0 && titleLength < 8) {
    addAdjustment(adjustments, "v1.title_short", -QUALITY_WEIGHTS.titleTooShortPenalty, `title_len=${titleLength}`, firedRules);
    rationale.push("El título es demasiado corto para informar.");
  } else if (titleLength > 160) {
    addAdjustment(adjustments, "v1.title_long", -QUALITY_WEIGHTS.titleTooLongPenalty, `title_len=${titleLength}`, firedRules);
    rationale.push("El título es excesivamente largo.");
  }

  if (textLength >= 80 && textLength <= 1200) {
    addAdjustment(adjustments, "v1.text_context", QUALITY_WEIGHTS.textStrongContext, `text_len=${textLength}`, firedRules);
    rationale.push("El texto aporta contexto suficiente.");
  } else if (textLength > 0 && textLength < 30) {
    addAdjustment(adjustments, "v1.text_too_short", -QUALITY_WEIGHTS.textTooShortPenalty, `text_len=${textLength}`, firedRules);
    rationale.push("El texto es demasiado corto para validar contexto.");
  } else if (textLength > 0 && textLength < 80) {
    addAdjustment(adjustments, "v1.text_low_context", -QUALITY_WEIGHTS.textLowContextPenalty, `text_len=${textLength}`, firedRules);
    rationale.push("El texto aporta poco contexto.");
  }

  if (titleLength === 0 && textLength < 40) {
    addAdjustment(adjustments, "v1.no_title_short_text", -QUALITY_WEIGHTS.missingTitleAndShortPenalty, "Sin título + texto corto", firedRules);
    rationale.push("Publicación muy corta y sin título.");
  }

  if (/\b\d{1,4}\b/.test(normalizedText) || /\b\d{4}-\d{2}-\d{2}\b/.test(normalizedText)) {
    addAdjustment(adjustments, "v1.numeric_evidence", QUALITY_WEIGHTS.hasNumbersOrDates, "Números o fechas", firedRules);
    rationale.push("Incluye números o fechas.");
  }

  if (/"[^"]+"/.test(rawText) && /\b(seg[uú]n|according to|reportó|reported|confirmó|confirmed)\b/i.test(normalizedText)) {
    addAdjustment(adjustments, "v1.quote_attribution", QUALITY_WEIGHTS.quoteWithAttribution, "Cita con atribución", firedRules);
    rationale.push("Incluye cita con atribución.");
  }

  if (/\b(rumou?r|unverified|sin confirmar|supuestamente)\b/i.test(normalizedText)) {
    addAdjustment(adjustments, "v1.unverified_claim", -QUALITY_WEIGHTS.unverifiedClaimPenalty, "Claim no verificado", firedRules);
    flags.push("unverified_claim");
    rationale.push("Incluye afirmaciones no verificadas.");
  }

  if (/(\?\?\?+|!!!+|¡¡¡+)/.test(rawText)) {
    addAdjustment(adjustments, "v1.excessive_punctuation", -QUALITY_WEIGHTS.excessivePunctuationPenalty, "Puntuación excesiva", firedRules);
    rationale.push("La puntuación excesiva reduce fiabilidad.");
  }

  const clickbaitMatches = CLICKBAIT_PATTERNS.filter((pattern) => pattern.test(normalizedText));
  const emojiCount = (normalizedText.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length;
  const capsRatio = getAllCapsRatio(`${input.title ?? ""} ${input.text ?? ""}`);

  let clickbaitStrength = clickbaitMatches.length;
  if (emojiCount >= 4) clickbaitStrength += 1;
  if (capsRatio > 0.45) clickbaitStrength += 1;

  const clickbaitStrong = clickbaitStrength >= 2;
  if (clickbaitStrong) {
    addAdjustment(adjustments, "v1.clickbait_strong", -QUALITY_WEIGHTS.clickbaitStrongPenalty, `signals=${clickbaitStrength}`, firedRules);
    flags.push("sensational");
    rationale.push("Señales fuertes de clickbait o sensacionalismo.");
  } else if (clickbaitStrength === 1) {
    addAdjustment(adjustments, "v1.clickbait_soft", -QUALITY_WEIGHTS.clickbaitMediumPenalty, `signals=${clickbaitStrength}`, firedRules);
    flags.push("sensational_soft");
    rationale.push("Se detecta un tono sensacionalista moderado.");
  }

  const breakdown = toBreakdown("v1", QUALITY_BASE, adjustments, QUALITY_CAPS.min, QUALITY_CAPS.max);

  return {
    score: breakdown.finalScore,
    flags,
    rationale,
    clickbaitStrong,
    breakdown
  };
};

const evaluateQualityV2 = (input: ClassifyInput, normalizedText: string, sourceDomain?: string): QualityEvalResult => {
  const adjustments: RuleAdjustment[] = [];
  const firedRules = new Set<string>();
  const flags: string[] = [];
  const rationale: string[] = [];
  const baseScore = 50;

  const title = (input.title ?? "").trim();
  const text = (input.text ?? "").trim();
  const rawText = `${title} ${text}`;
  const metadata = input.metadata;

  if (input.url) {
    addAdjustment(adjustments, "v2.has_url", 5, "Incluye enlace", firedRules);
    if (input.url.startsWith("https://")) {
      addAdjustment(adjustments, "v2.https", 2, "Fuente HTTPS", firedRules);
    } else {
      addAdjustment(adjustments, "v2.insecure", -4, "Fuente no HTTPS", firedRules);
      flags.push("insecure_source");
    }
  } else {
    addAdjustment(adjustments, "v2.no_source", -14, "Falta URL", firedRules);
    flags.push("no_source");
  }

  if (sourceDomain) {
    if (domainMatches(sourceDomain, V2_BLOCKLIST_DOMAINS)) {
      addAdjustment(adjustments, "v2.domain_blocklist", -28, `domain=${sourceDomain}`, firedRules);
      flags.push("blocked_domain");
      rationale.push("Dominio marcado como fuente de baja confianza.");
    } else if (domainMatches(sourceDomain, TIER_A_DOMAINS)) {
      addAdjustment(adjustments, "v2.domain_allowlist_high", 22, `domain=${sourceDomain}`, firedRules);
      rationale.push("Dominio en allowlist de alta confianza.");
    } else if (domainMatches(sourceDomain, TIER_B_DOMAINS)) {
      addAdjustment(adjustments, "v2.domain_allowlist_mid", 12, `domain=${sourceDomain}`, firedRules);
      rationale.push("Dominio en allowlist de confianza media.");
    } else {
      addAdjustment(adjustments, "v2.domain_unknown_soft_penalty", -6, `domain=${sourceDomain}`, firedRules);
      flags.push("unknown_domain");
      rationale.push("Dominio sin historial de confianza (penalización suave).");
    }

    if (domainMatches(sourceDomain, SOCIAL_DOMAINS)) {
      const hasContext = text.length >= 100;
      const penalty = sourceDomain.endsWith("x.com") || sourceDomain.endsWith("twitter.com")
        ? (hasContext ? -4 : -7)
        : (hasContext ? -7 : -11);
      addAdjustment(adjustments, "v2.social_media_penalty", penalty, `domain=${sourceDomain}; context=${hasContext}`, firedRules);
      flags.push("social_media");
    }
  }

  const hasPublisherOrAuthor = Boolean(metadata?.publisher || metadata?.author);
  const hasImprintOrContact = Boolean(metadata?.hasImprintOrContact);
  if (hasPublisherOrAuthor && hasImprintOrContact) {
    addAdjustment(adjustments, "v2.publisher_author_contact", 8, "publisher/author+imprint/contact", firedRules);
    rationale.push("La noticia aporta datos editoriales verificables.");
  } else if (hasPublisherOrAuthor) {
    addAdjustment(adjustments, "v2.publisher_or_author_partial", 4, "publisher/author", firedRules);
  }

  const schemaTypes = metadata?.schemaTypes ?? [];
  const hasNewsSchema = schemaTypes.some((item) => /newsarticle|article/i.test(item));
  if (hasNewsSchema) {
    addAdjustment(adjustments, "v2.schema_news_article", 9, `schema=${schemaTypes.join("|")}`, firedRules);
    rationale.push("Schema.org NewsArticle detectado.");
  }

  const publishedAt = metadata?.publishedAt || input.publishedAt;
  if (publishedAt) {
    const publishedTs = Date.parse(publishedAt);
    if (Number.isFinite(publishedTs)) {
      if (publishedTs > Date.now() + 1000 * 60 * 60) {
        addAdjustment(adjustments, "v2.future_publication_penalty", -15, `published_at=${publishedAt}`, firedRules);
        flags.push("future_date");
      } else {
        addAdjustment(adjustments, "v2.valid_publication_date", 4, `published_at=${publishedAt}`, firedRules);
      }
    }
  }

  const bodyText = metadata?.bodyText ?? text;
  const wordCount = normalizeTopicText(bodyText).split(/[^a-z0-9]+/).filter(Boolean).length;
  const charCount = bodyText.length;
  const density = wordCount > 0 ? charCount / wordCount : 0;

  if (wordCount < 60) {
    addAdjustment(adjustments, "v2.low_text_density", -12, `word_count=${wordCount}`, firedRules);
    flags.push("thin_content");
    rationale.push("Contenido demasiado breve para validar bien la información.");
  } else if (wordCount >= 120) {
    addAdjustment(adjustments, "v2.good_text_density", 4, `word_count=${wordCount}; density=${density.toFixed(1)}`, firedRules);
  }

  if (title.length >= 20 && title.length <= 120) {
    addAdjustment(adjustments, "v2.informative_title", 4, `title_len=${title.length}`, firedRules);
  } else if (title.length > 0 && title.length < 9) {
    addAdjustment(adjustments, "v2.short_title_penalty", -8, `title_len=${title.length}`, firedRules);
  }

  if (/\b\d{1,4}\b/.test(normalizedText) || /\b\d{4}-\d{2}-\d{2}\b/.test(normalizedText)) {
    addAdjustment(adjustments, "v2.numeric_evidence", 4, "Números o fechas", firedRules);
  }

  if (/"[^"]+"/.test(rawText) && /\b(seg[uú]n|according to|reportó|reported|confirmó|confirmed)\b/i.test(normalizedText)) {
    addAdjustment(adjustments, "v2.quote_attribution", 6, "Cita con atribución", firedRules);
  }

  const outboundHosts = (metadata?.outboundUrls ?? [])
    .map((value) => safeDomainFromUrl(value))
    .filter((value): value is string => Boolean(value));
  const hasPrimarySource = outboundHosts.some((host) => domainMatches(host, PRIMARY_SOURCE_DOMAINS));
  if (hasPrimarySource) {
    addAdjustment(adjustments, "v2.primary_sources_bonus", 8, `hosts=${outboundHosts.join(",")}`, firedRules);
    rationale.push("Incluye enlaces a fuentes primarias verificables.");
  } else if (sourceDomain && !domainMatches(sourceDomain, TIER_A_DOMAINS) && !domainMatches(sourceDomain, TIER_B_DOMAINS)) {
    addAdjustment(adjustments, "v2.no_outbound_low_rep", -10, "Sin enlaces salientes verificables", firedRules);
  }

  const clickbaitMatches = CLICKBAIT_PATTERNS.filter((pattern) => pattern.test(normalizedText)).length;
  const curiosityMatches = CURIOSITY_GAP_PATTERNS.filter((pattern) => pattern.test(normalizedText)).length;
  const emojiCount = (normalizedText.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length;
  const capsRatio = getAllCapsRatio(rawText);
  const mismatch = titleBodyMismatch(title, bodyText);

  let clickbaitStrength = clickbaitMatches;
  if (emojiCount >= 4) clickbaitStrength += 1;
  if (capsRatio > 0.45) clickbaitStrength += 1;
  if (curiosityMatches > 0) clickbaitStrength += 1;

  if (curiosityMatches > 0) {
    addAdjustment(adjustments, "v2.curiosity_gap_penalty", -8, `matches=${curiosityMatches}`, firedRules);
    flags.push("curiosity_gap");
  }

  if (mismatch.mismatch) {
    addAdjustment(adjustments, "v2.title_body_mismatch", -9, mismatch.evidence, firedRules);
    flags.push("title_body_mismatch");
    rationale.push("El título no se sostiene bien con el cuerpo disponible.");
  }

  let clickbaitStrong = false;
  if (clickbaitStrength >= 2) {
    clickbaitStrong = true;
    addAdjustment(adjustments, "v2.clickbait_strong", -42, `signals=${clickbaitStrength}`, firedRules);
    flags.push("sensational");
  } else if (clickbaitStrength === 1) {
    addAdjustment(adjustments, "v2.clickbait_soft", -16, `signals=${clickbaitStrength}`, firedRules);
    flags.push("sensational_soft");
  }

  if (metadata?.hasOverlayPopup) {
    addAdjustment(adjustments, "v2.intrusive_overlay_penalty", -8, "Overlay/popup detectado", firedRules);
    flags.push("intrusive_overlay");
  }

  if ((metadata?.adLikeNodeRatio ?? 0) >= 0.2) {
    addAdjustment(adjustments, "v2.ad_ratio_penalty", -6, `ad_ratio=${(metadata?.adLikeNodeRatio ?? 0).toFixed(2)}`, firedRules);
    flags.push("ad_intrusive");
  }

  if (metadata?.duplicateSignals?.canonicalExists) {
    addAdjustment(adjustments, "v2.duplicate_canonical_penalty", -6, "canonical duplicate", firedRules);
    flags.push("duplicate_canonical");
  }

  if (metadata?.duplicateSignals?.contentHashExists) {
    addAdjustment(adjustments, "v2.duplicate_content_penalty", -14, "content hash duplicate", firedRules);
    flags.push("duplicate_content");
  }

  const breakdown = toBreakdown("v2", baseScore, adjustments, QUALITY_CAPS.min, QUALITY_CAPS.max);

  return {
    score: breakdown.finalScore,
    flags,
    rationale,
    clickbaitStrong,
    breakdown
  };
};

const scoreInterest = (
  topics: string[],
  qualityScore: number,
  clickbait: boolean,
  createdAt: number | undefined,
  textLength: number,
  version: AuraRulesetVersion
): InterestEvalResult => {
  const now = Date.now();
  const ts = createdAt ?? now;
  const ageHours = Math.max(0, (now - ts) / (1000 * 60 * 60));

  const adjustments: RuleAdjustment[] = [];
  const firedRules = new Set<string>();
  const baseScore = AURA_BASE;

  const topicBoost = topics.reduce((acc, topic) => acc + (TOPIC_WEIGHTS[topic] ?? 6), 0) / Math.max(1, topics.length);
  const qualityNormalized = (qualityScore - 50) / 50;
  const contextBoost = 8 * Math.tanh(textLength / 220) - 2;
  const recencyBoost = 12 * Math.exp(-ageHours / 48) - 2.5;

  addAdjustment(adjustments, `${version}.aura_topic`, topicBoost * 0.85, `topic_boost=${topicBoost.toFixed(2)}`, firedRules);
  addAdjustment(adjustments, `${version}.aura_quality`, qualityNormalized * 22, `quality=${qualityScore}`, firedRules);
  addAdjustment(adjustments, `${version}.aura_context`, contextBoost, `text_len=${textLength}`, firedRules);
  addAdjustment(adjustments, `${version}.aura_recency`, recencyBoost, `age_hours=${ageHours.toFixed(1)}`, firedRules);

  let breakdown = toBreakdown(version, baseScore, adjustments, AURA_CAPS.min, AURA_CAPS.max);
  let score = breakdown.finalScore;

  if (clickbait) {
    score = Math.min(score, AURA_CAPS.clickbaitMax);
    addAdjustment(adjustments, `${version}.aura_clickbait_cap`, score - breakdown.finalScore, `cap=${AURA_CAPS.clickbaitMax}`, firedRules);
    breakdown = {
      ...breakdown,
      adjustments,
      finalScore: score,
      firedRules: Array.from(new Set([...breakdown.firedRules, `${version}.aura_clickbait_cap`]))
    };
    return { score, rationale: "Aura limitada por señales de clickbait.", breakdown };
  }

  return { score, rationale: "Aura calculada por tema, calidad, actualidad y contexto.", breakdown };
};

const qualityLabelFromScore = (score: number, clickbaitStrong: boolean): QualityLabel => {
  if (clickbaitStrong) return "clickbait";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
};

export const classifyPost = (input: ClassifyInput, createdAt?: number): ClassifyOutput => {
  const version: AuraRulesetVersion = input.rulesetVersion ?? rulesetFromEnv();
  const topicVersion: TopicRulesetVersion = input.topicRulesetVersion ?? topicRulesetFromEnv();
  const normalizedText = normalizeInputText(input);
  const sourceDomain = safeDomainFromUrl(input.url);
  const extractedHosts = extractHosts(normalizedText, input.url);
  const topicsV1 = detectTopicsFromInput(input, sourceDomain);

  let topics = topicsV1;
  let topicV2: string | undefined;
  let topicCandidatesV2: ClassifyOutput["topicCandidatesV2"];
  let topicExplanationV2: ClassifyOutput["topicExplanationV2"];

  if (topicVersion === "v2") {
    const topicResult = runTopicEngineV2(input);
    topicV2 = topicResult.topic;
    topicCandidatesV2 = topicResult.candidates;
    topicExplanationV2 = topicResult.explanation;
    topics = topicResult.selectedTopics.map((topic) => (topic === "general" ? "misc" : topic));
  }

  const subtopics = detectSubtopics(normalizedText, topics);

  const quality = version === "v2"
    ? evaluateQualityV2(input, normalizedText, sourceDomain)
    : evaluateQualityV1(input, normalizedText, sourceDomain);
  const interest = scoreInterest(topics, quality.score, quality.clickbaitStrong, createdAt, (input.text ?? "").length, version);

  const qualityLabel = qualityLabelFromScore(quality.score, quality.clickbaitStrong);
  const rationale = [...topicRationale(normalizedText, topics), ...quality.rationale, interest.rationale];

  const debugBreakdown = {
    version,
    quality: quality.breakdown,
    aura: interest.breakdown,
    firedRules: Array.from(new Set([...quality.breakdown.firedRules, ...interest.breakdown.firedRules]))
  };

  const outputFlags = [...quality.flags];
  if (input.persistBreakdown !== false) {
    outputFlags.push(`aura_ruleset:${version}`);
    outputFlags.push(`topic_ruleset:${topicVersion}`);
    outputFlags.push(serialiseBreakdownFlag("quality", quality.breakdown));
    outputFlags.push(serialiseBreakdownFlag("aura", interest.breakdown));
    if (topicExplanationV2) {
      outputFlags.push(serialiseTopicFlag(topicExplanationV2));
    }
  }

  return {
    topics,
    subtopics,
    topicV2,
    topicCandidatesV2,
    topicExplanationV2,
    topicVersion,
    qualityLabel,
    qualityScore: quality.score,
    interestScore: interest.score,
    flags: Array.from(new Set(outputFlags)),
    rationale,
    sourceDomain,
    extractedHosts,
    normalizedText,
    debugBreakdown: input.debug ? debugBreakdown : undefined
  };
};
