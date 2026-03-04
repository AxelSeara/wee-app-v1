import topicsConfig from "../../config/topics_v2.json";
import conflictsConfig from "../../config/topic_conflicts_v2.json";
import siteProfilesConfig from "../../config/site_profiles_v2.json";
import type { ClassifyInput, TopicCandidate, TopicExplanationV2, TopicReasonV2 } from "./types";
import { normalizeSpace, safeDomainFromUrl } from "./utils";

interface TopicEngineResult {
  topic: string;
  selectedTopics: string[];
  candidates: TopicCandidate[];
  explanation: TopicExplanationV2;
}

interface TopicThresholds {
  min_score: number;
  delta: number;
  max_topics: number;
}

interface TopicConfigShape {
  taxonomy: string[];
  thresholds: TopicThresholds;
  weights: {
    structured: Record<string, number>;
    site_structure: Record<string, number>;
    keywords: Record<string, number>;
  };
  url_patterns: Record<string, string[]>;
  meta_mappings: Record<string, string[]>;
  keyword_mappings: Record<string, string[]>;
  domain_hints: Record<string, string[]>;
  gazetteer_local: string[];
}

interface ConflictRule {
  id: string;
  when_all: string[];
  when_any?: string[];
  boost?: Record<string, number>;
  penalize?: Record<string, number>;
  reason?: string;
}

interface ConflictsShape {
  rules: ConflictRule[];
}

interface SiteProfile {
  url_topic_hints?: Record<string, string[]>;
  breadcrumb_hints?: string[];
}

interface SiteProfilesShape {
  profiles: Record<string, SiteProfile>;
}

const TOPIC_CONFIG = topicsConfig as unknown as TopicConfigShape;
const TOPIC_CONFLICTS = conflictsConfig as unknown as ConflictsShape;
const SITE_PROFILES = siteProfilesConfig as unknown as SiteProfilesShape;

const normalize = (value: string): string =>
  normalizeSpace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const includesTerm = (haystack: string, term: string): boolean => {
  if (term.includes(" ")) {
    return haystack.includes(term);
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
};

const addReason = (
  reasons: TopicReasonV2[],
  scores: Map<string, number>,
  topic: string,
  signal: string,
  weight: number,
  evidence: string
): void => {
  if (!weight) return;
  scores.set(topic, (scores.get(topic) ?? 0) + weight);
  reasons.push({ signal, topic, weight, evidence });
};

const collectMetadataText = (input: ClassifyInput): string[] => {
  const metadata = input.metadata;
  if (!metadata) return [];
  const bag: string[] = [];
  const push = (value?: string | string[]) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item?.trim()) bag.push(item.trim());
      });
      return;
    }
    if (value.trim()) bag.push(value.trim());
  };

  push(metadata.articleSection);
  push(metadata.newsKeywords);
  push(metadata.parselySection);
  push(metadata.sailthruTags);
  push(metadata.breadcrumbs);
  push(metadata.relTags);
  push(metadata.jsonLdSections);
  push(metadata.jsonLdKeywords);
  push(metadata.jsonLdAbout);
  push(metadata.jsonLdGenre);
  push(metadata.jsonLdIsPartOf);
  return bag;
};

const applyStructuredSignals = (
  input: ClassifyInput,
  normalizedText: string,
  scores: Map<string, number>,
  reasons: TopicReasonV2[]
): void => {
  const metadata = input.metadata;
  if (!metadata) return;

  const signalMap: Array<{
    key: keyof NonNullable<ClassifyInput["metadata"]>;
    weightKey: string;
    signalName: string;
  }> = [
    { key: "articleSection", weightKey: "meta_article_section", signalName: "meta.article_section" },
    { key: "newsKeywords", weightKey: "meta_news_keywords", signalName: "meta.news_keywords" },
    { key: "parselySection", weightKey: "meta_parsely_section", signalName: "meta.parsely_section" },
    { key: "sailthruTags", weightKey: "meta_sailthru_tags", signalName: "meta.sailthru_tags" },
    { key: "jsonLdSections", weightKey: "jsonld_article_section", signalName: "jsonld.article_section" },
    { key: "jsonLdKeywords", weightKey: "jsonld_keywords", signalName: "jsonld.keywords" },
    { key: "jsonLdAbout", weightKey: "jsonld_about", signalName: "jsonld.about" },
    { key: "jsonLdGenre", weightKey: "jsonld_genre", signalName: "jsonld.genre" },
    { key: "jsonLdIsPartOf", weightKey: "jsonld_ispartof", signalName: "jsonld.ispartof" }
  ];

  signalMap.forEach(({ key, weightKey, signalName }) => {
    const value = metadata[key];
    if (!value) return;
    const text = Array.isArray(value) ? value.join(" ") : String(value);
    const normalizedValue = normalize(text);
    Object.entries(TOPIC_CONFIG.meta_mappings).forEach(([topic, mappingTerms]) => {
      if (mappingTerms.some((term) => includesTerm(normalizedValue, normalize(term)))) {
        addReason(
          reasons,
          scores,
          topic,
          signalName,
          TOPIC_CONFIG.weights.structured[weightKey] ?? 0,
          `${key}:${text.slice(0, 100)}`
        );
      }
    });
  });

  const metadataBag = normalize(collectMetadataText(input).join(" "));
  if (!metadataBag) return;
  if (TOPIC_CONFIG.gazetteer_local.some((place) => includesTerm(metadataBag, normalize(place)))) {
    addReason(
      reasons,
      scores,
      "local",
      "metadata.gazetteer",
      TOPIC_CONFIG.weights.keywords.gazetteer_local ?? 0,
      "local_place_detected"
    );
  }

  if (metadataBag && normalizedText) {
    Object.entries(TOPIC_CONFIG.keyword_mappings).forEach(([topic, terms]) => {
      const hits = terms.filter((term) => includesTerm(metadataBag, normalize(term))).length;
      if (hits > 0) {
        addReason(
          reasons,
          scores,
          topic,
          "metadata.keyword_overlap",
          Math.min(12, hits * 2),
          `hits=${hits}`
        );
      }
    });
  }
};

const applySiteStructureSignals = (
  input: ClassifyInput,
  normalizedText: string,
  scores: Map<string, number>,
  reasons: TopicReasonV2[]
): void => {
  const url = input.url ?? "";
  const urlLower = url.toLowerCase();

  Object.entries(TOPIC_CONFIG.url_patterns).forEach(([topic, patterns]) => {
    patterns.forEach((pattern) => {
      try {
        if (new RegExp(pattern, "i").test(urlLower)) {
          addReason(
            reasons,
            scores,
            topic,
            "url.pattern",
            TOPIC_CONFIG.weights.site_structure.url_pattern ?? 0,
            pattern
          );
        }
      } catch {
        // ignore invalid regex in config
      }
    });
  });

  const breadcrumbs = input.metadata?.breadcrumbs ?? [];
  if (breadcrumbs.length > 0) {
    const breadcrumbText = normalize(breadcrumbs.join(" "));
    Object.entries(TOPIC_CONFIG.meta_mappings).forEach(([topic, terms]) => {
      if (terms.some((term) => includesTerm(breadcrumbText, normalize(term)))) {
        addReason(
          reasons,
          scores,
          topic,
          "site.breadcrumb",
          TOPIC_CONFIG.weights.site_structure.breadcrumb ?? 0,
          breadcrumbs.slice(0, 4).join(" > ")
        );
      }
    });
  }

  const relTags = input.metadata?.relTags ?? [];
  if (relTags.length > 0) {
    const tagText = normalize(relTags.join(" "));
    Object.entries(TOPIC_CONFIG.meta_mappings).forEach(([topic, terms]) => {
      if (terms.some((term) => includesTerm(tagText, normalize(term)))) {
        addReason(
          reasons,
          scores,
          topic,
          "site.rel_tag",
          TOPIC_CONFIG.weights.site_structure.rel_tag ?? 0,
          relTags.slice(0, 6).join(",")
        );
      }
    });
  }

  const domain = safeDomainFromUrl(input.url);
  if (!domain) return;
  const profile = Object.entries(SITE_PROFILES.profiles).find(([key]) => domain === key || domain.endsWith(`.${key}`))?.[1];
  if (!profile) return;

  Object.entries(profile.url_topic_hints ?? {}).forEach(([topic, hints]) => {
    if (hints.some((hint) => urlLower.includes(hint.toLowerCase()))) {
      addReason(
        reasons,
        scores,
        topic,
        "site.profile_url_hint",
        TOPIC_CONFIG.weights.site_structure.site_profile_hint ?? 0,
        `domain=${domain}`
      );
    }
  });

  const profileBread = normalize((profile.breadcrumb_hints ?? []).join(" "));
  if (profileBread && profile.breadcrumb_hints?.some((item) => includesTerm(normalizedText, normalize(item)))) {
    addReason(
      reasons,
      scores,
      "general",
      "site.profile",
      1,
      `domain=${domain}`
    );
  }
};

const applyKeywordSignals = (
  input: ClassifyInput,
  normalizedText: string,
  scores: Map<string, number>,
  reasons: TopicReasonV2[]
): void => {
  const titleNorm = normalize(input.title ?? "");
  const textNorm = normalize(input.text ?? "");

  Object.entries(TOPIC_CONFIG.keyword_mappings).forEach(([topic, terms]) => {
    const titleHits = terms.filter((term) => includesTerm(titleNorm, normalize(term))).length;
    const textHits = terms.filter((term) => includesTerm(textNorm, normalize(term))).length;

    if (titleHits > 0) {
      addReason(
        reasons,
        scores,
        topic,
        "keywords.title",
        titleHits * (TOPIC_CONFIG.weights.keywords.title_keyword ?? 0),
        `hits=${titleHits}`
      );
    }

    if (textHits > 0) {
      addReason(
        reasons,
        scores,
        topic,
        "keywords.body",
        textHits * (TOPIC_CONFIG.weights.keywords.body_keyword ?? 0),
        `hits=${textHits}`
      );
    }
  });

  const domain = safeDomainFromUrl(input.url);
  if (domain) {
    Object.entries(TOPIC_CONFIG.domain_hints).forEach(([topic, domains]) => {
      if (domains.some((hint) => domain === hint || domain.endsWith(hint))) {
        addReason(
          reasons,
          scores,
          topic,
          "keywords.domain_hint",
          TOPIC_CONFIG.weights.keywords.domain_hint ?? 0,
          domain
        );
      }
    });
  }

  if (TOPIC_CONFIG.gazetteer_local.some((place) => includesTerm(normalizedText, normalize(place)))) {
    addReason(
      reasons,
      scores,
      "local",
      "keywords.gazetteer_local",
      TOPIC_CONFIG.weights.keywords.gazetteer_local ?? 0,
      "place_match"
    );
  }
};

const applyConflictSignals = (
  normalizedText: string,
  scores: Map<string, number>,
  reasons: TopicReasonV2[]
): void => {
  TOPIC_CONFLICTS.rules.forEach((rule) => {
    const hasAll = (rule.when_all ?? []).every((term) => includesTerm(normalizedText, normalize(term)));
    if (!hasAll) return;
    const hasAny = !rule.when_any || rule.when_any.some((term) => includesTerm(normalizedText, normalize(term)));
    if (!hasAny) return;

    Object.entries(rule.boost ?? {}).forEach(([topic, weight]) => {
      addReason(reasons, scores, topic, `conflict.${rule.id}.boost`, weight, rule.reason ?? rule.id);
    });

    Object.entries(rule.penalize ?? {}).forEach(([topic, weight]) => {
      addReason(reasons, scores, topic, `conflict.${rule.id}.penalty`, -Math.abs(weight), rule.reason ?? rule.id);
    });
  });
};

const thresholds = TOPIC_CONFIG.thresholds;

export const runTopicEngineV2 = (input: ClassifyInput): TopicEngineResult => {
  const normalizedText = normalize(
    `${input.title ?? ""} ${input.text ?? ""} ${(input.metadata?.bodyText ?? "").slice(0, 3000)} ${input.url ?? ""}`
  );
  const scores = new Map<string, number>();
  const reasons: TopicReasonV2[] = [];

  applyStructuredSignals(input, normalizedText, scores, reasons);
  applySiteStructureSignals(input, normalizedText, scores, reasons);
  applyKeywordSignals(input, normalizedText, scores, reasons);
  applyConflictSignals(normalizedText, scores, reasons);

  const candidates = TOPIC_CONFIG.taxonomy
    .map((topic) => ({ topic, score: Number((scores.get(topic) ?? 0).toFixed(2)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0 || candidates[0].score < thresholds.min_score) {
    const explanation: TopicExplanationV2 = {
      version: "v2",
      selectedTopics: ["general"],
      ambiguous: false,
      thresholds: {
        minScore: thresholds.min_score,
        delta: thresholds.delta
      },
      reasons: reasons.slice(0, 40)
    };
    return {
      topic: "general",
      selectedTopics: ["general"],
      candidates,
      explanation
    };
  }

  const top = candidates[0];
  const second = candidates[1];
  const isAmbiguous = Boolean(second) && top.score - second.score < thresholds.delta;
  const selectedTopics = isAmbiguous
    ? candidates.slice(0, Math.max(2, thresholds.max_topics)).map((item) => item.topic)
    : [top.topic];

  const explanation: TopicExplanationV2 = {
    version: "v2",
    selectedTopics,
    ambiguous: isAmbiguous,
    thresholds: {
      minScore: thresholds.min_score,
      delta: thresholds.delta
    },
    reasons: reasons
      .filter((reason) => selectedTopics.includes(reason.topic))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 40)
  };

  return {
    topic: top.topic,
    selectedTopics,
    candidates,
    explanation
  };
};
