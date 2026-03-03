import type { CSSProperties } from "react";

interface TopicColor {
  h: number;
  s: number;
  l: number;
}

const TOPIC_COLOR_SYSTEM: Record<string, TopicColor> = {
  war: { h: 224, s: 63, l: 50 },
  geopolitics: { h: 252, s: 56, l: 52 },
  politics: { h: 266, s: 58, l: 54 },
  iran: { h: 236, s: 60, l: 50 },
  tech: { h: 198, s: 72, l: 47 },
  economy: { h: 36, s: 68, l: 50 },
  science: { h: 206, s: 62, l: 48 },
  health: { h: 242, s: 50, l: 50 },
  climate: { h: 214, s: 57, l: 48 },
  local: { h: 228, s: 54, l: 49 },
  sports: { h: 30, s: 74, l: 50 },
  culture: { h: 286, s: 56, l: 52 },
  education: { h: 216, s: 64, l: 50 },
  memes: { h: 276, s: 66, l: 55 },
  spain: { h: 38, s: 68, l: 50 },
  usa: { h: 230, s: 58, l: 51 },
  uk: { h: 240, s: 54, l: 52 },
  ukraine: { h: 210, s: 72, l: 52 },
  israel: { h: 220, s: 62, l: 51 },
  misc: { h: 210, s: 48, l: 48 }
};

const fallbackTopicColor = (topic: string): TopicColor => {
  let hash = 0;
  for (let i = 0; i < topic.length; i += 1) {
    hash = topic.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Keep fallback in cool range to avoid red/green semantics in topic surfaces.
  const h = 198 + (Math.abs(hash) % 96); // cyan -> violet
  return { h, s: 54, l: 48 };
};

export const topicColor = (topic: string): TopicColor =>
  TOPIC_COLOR_SYSTEM[topic] ?? fallbackTopicColor(topic);

export const topicColorVars = (topic: string): CSSProperties => {
  const tone = topicColor(topic);
  return {
    "--topic-h": `${tone.h}`,
    "--topic-s": `${tone.s}%`,
    "--topic-l": `${tone.l}%`
  } as CSSProperties;
};
