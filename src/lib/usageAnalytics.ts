import { track } from "@vercel/analytics";

type UsagePayload = Record<string, string | number | boolean | null | undefined>;

const safePath = (value: string): string => value.slice(0, 120);
const safeTopic = (value?: string): string | undefined =>
  value ? value.trim().toLowerCase().slice(0, 32) : undefined;

export const trackPageView = (path: string): void => {
  track("page_view", { path: safePath(path) });
};

export const trackShare = (payload: {
  mode: "created" | "merged" | "penalized";
  sourceDomain?: string;
  primaryTopic?: string;
}): void => {
  track("share_link", {
    mode: payload.mode,
    source_domain: payload.sourceDomain ?? "unknown",
    primary_topic: safeTopic(payload.primaryTopic) ?? "misc"
  });
};

export const trackOpenSource = (payload: { sourceDomain?: string; primaryTopic?: string }): void => {
  track("open_source", {
    source_domain: payload.sourceDomain ?? "unknown",
    primary_topic: safeTopic(payload.primaryTopic) ?? "misc"
  });
};

export const trackRate = (payload: { vote: 1 | -1; sourceDomain?: string; primaryTopic?: string }): void => {
  track("rate_post", {
    vote: payload.vote > 0 ? "up" : "down",
    source_domain: payload.sourceDomain ?? "unknown",
    primary_topic: safeTopic(payload.primaryTopic) ?? "misc"
  });
};

export const trackComment = (payload: { sourceDomain?: string; primaryTopic?: string; length: number }): void => {
  track("comment_post", {
    source_domain: payload.sourceDomain ?? "unknown",
    primary_topic: safeTopic(payload.primaryTopic) ?? "misc",
    length_bucket: payload.length < 60 ? "short" : payload.length < 180 ? "medium" : "long"
  });
};

export const trackCustom = (event: string, payload: UsagePayload): void => {
  track(event.slice(0, 64), payload);
};
