import type { Post } from "./types";
import { isUnusableTitle } from "./presentation";
import { supabase } from "./backend/supabase";

export interface UrlMetadata {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  publishedAt?: string;
  schemaTypes?: string[];
  publisher?: string;
  author?: string;
  hasImprintOrContact?: boolean;
  outboundUrls?: string[];
  bodyText?: string;
  hasOverlayPopup?: boolean;
  adLikeNodeRatio?: number;
  articleSection?: string;
  newsKeywords?: string[];
  parselySection?: string;
  sailthruTags?: string[];
  breadcrumbs?: string[];
  relTags?: string[];
  jsonLdSections?: string[];
  jsonLdKeywords?: string[];
  jsonLdAbout?: string[];
  jsonLdGenre?: string[];
  jsonLdIsPartOf?: string[];
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
};

const clean = (value?: string, max = 240): string | undefined => {
  const next = value?.replace(/\s+/g, " ").trim();
  if (!next) return undefined;
  return next.slice(0, max);
};

const hostnameFromUrl = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
};

const fetchJson = async <T>(url: string): Promise<T | null> => {
  try {
    const response = await withTimeout(fetch(url), 4500);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

interface OEmbedResponse {
  title?: string;
  description?: string;
  author_name?: string;
  provider_name?: string;
  thumbnail_url?: string;
}

interface MicrolinkResponse {
  status?: "success" | "fail";
  data?: {
    title?: string;
    description?: string;
    publisher?: string;
    image?: { url?: string };
    logo?: { url?: string };
  };
}

interface JsonLinkResponse {
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
}

const isYoutubeUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host.includes("youtube.com") || host.includes("youtu.be");
  } catch {
    return false;
  }
};

const youtubeOEmbed = async (url: string): Promise<UrlMetadata | null> => {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const data = await fetchJson<OEmbedResponse>(endpoint);
  if (!data) return null;
  return {
    title: clean(data.title, 140),
    description: clean(data.description, 320),
    imageUrl: clean(data.thumbnail_url, 500),
    siteName: clean(data.provider_name, 80)
  };
};

const genericOEmbed = async (url: string): Promise<UrlMetadata | null> => {
  const endpoint = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
  const data = await fetchJson<OEmbedResponse>(endpoint);
  if (!data) return null;
  return {
    title: clean(data.title, 140),
    description: clean(data.description, 320),
    imageUrl: clean(data.thumbnail_url, 500),
    siteName: clean(data.provider_name ?? data.author_name, 80)
  };
};

const microlink = async (url: string): Promise<UrlMetadata | null> => {
  const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&audio=false&video=false`;
  const data = await fetchJson<MicrolinkResponse>(endpoint);
  if (!data || data.status !== "success") return null;
  return {
    title: clean(data.data?.title, 140),
    description: clean(data.data?.description, 320),
    imageUrl: clean(data.data?.image?.url, 800),
    siteName: clean(data.data?.publisher, 80)
  };
};

const jsonLink = async (url: string): Promise<UrlMetadata | null> => {
  const endpoint = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
  const data = await fetchJson<JsonLinkResponse>(endpoint);
  if (!data) return null;
  return {
    title: clean(data.title, 140),
    description: clean(data.description, 320),
    imageUrl: clean(data.image, 800),
    siteName: clean(data.site_name, 80)
  };
};

const screenshotFallback = (url: string): string =>
  `https://image.thum.io/get/width/1200/crop/700/noanimate/${url}`;

const edgeUnfurl = async (url: string): Promise<UrlMetadata | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("unfurl", {
        body: { url }
      }),
      5500
    );
    if (error) return null;
    const payload = (data ?? {}) as {
      title?: string;
      description?: string;
      imageUrl?: string;
      siteName?: string;
      publishedAt?: string;
      schemaTypes?: string[];
      publisher?: string;
      author?: string;
      hasImprintOrContact?: boolean;
      outboundUrls?: string[];
      bodyText?: string;
      hasOverlayPopup?: boolean;
      adLikeNodeRatio?: number;
      articleSection?: string;
      newsKeywords?: string[];
      parselySection?: string;
      sailthruTags?: string[];
      breadcrumbs?: string[];
      relTags?: string[];
      jsonLdSections?: string[];
      jsonLdKeywords?: string[];
      jsonLdAbout?: string[];
      jsonLdGenre?: string[];
      jsonLdIsPartOf?: string[];
    };
    const title = clean(payload.title, 140);
    const description = clean(payload.description, 320);
    const imageUrl = clean(payload.imageUrl, 800);
    const siteName = clean(payload.siteName, 80);
    if (!title && !description && !imageUrl && !siteName) return null;
    return {
      title,
      description,
      imageUrl,
      siteName,
      publishedAt: payload.publishedAt,
      schemaTypes: payload.schemaTypes,
      publisher: clean(payload.publisher, 140),
      author: clean(payload.author, 140),
      hasImprintOrContact: payload.hasImprintOrContact,
      outboundUrls: payload.outboundUrls,
      bodyText: clean(payload.bodyText, 5000),
      hasOverlayPopup: payload.hasOverlayPopup,
      adLikeNodeRatio: payload.adLikeNodeRatio,
      articleSection: clean(payload.articleSection, 80),
      newsKeywords: payload.newsKeywords,
      parselySection: clean(payload.parselySection, 80),
      sailthruTags: payload.sailthruTags,
      breadcrumbs: payload.breadcrumbs,
      relTags: payload.relTags,
      jsonLdSections: payload.jsonLdSections,
      jsonLdKeywords: payload.jsonLdKeywords,
      jsonLdAbout: payload.jsonLdAbout,
      jsonLdGenre: payload.jsonLdGenre,
      jsonLdIsPartOf: payload.jsonLdIsPartOf
    };
  } catch {
    return null;
  }
};

export const enrichUrl = async (url: string): Promise<UrlMetadata> => {
  if (!url) return {};

  const fromEdge = await edgeUnfurl(url);
  const edgeTitle = fromEdge?.title && !isUnusableTitle(fromEdge.title) ? fromEdge.title : undefined;

  const fromYoutube = isYoutubeUrl(url) ? await youtubeOEmbed(url) : null;
  if (fromYoutube) return fromYoutube;

  const providerResults = await Promise.allSettled([microlink(url), jsonLink(url), genericOEmbed(url)]);
  for (const settled of providerResults) {
    if (settled.status !== "fulfilled") continue;
    const result = settled.value;
    if (!result || (!result.title && !result.description && !result.imageUrl)) continue;
    const safeTitle = result.title && !isUnusableTitle(result.title) ? result.title : undefined;
    return {
      title: edgeTitle ?? safeTitle,
      description: fromEdge?.description ?? result.description,
      imageUrl: fromEdge?.imageUrl ?? result.imageUrl ?? screenshotFallback(url),
      siteName: fromEdge?.siteName ?? result.siteName ?? hostnameFromUrl(url)
    };
  }

  const fallbackTitle = edgeTitle ?? hostnameFromUrl(url);
  return {
    title: fallbackTitle ?? undefined,
    description: fromEdge?.description,
    siteName: fromEdge?.siteName ?? fallbackTitle,
    imageUrl: fromEdge?.imageUrl ?? screenshotFallback(url)
  };
};

export const applyMetadataToPost = (post: Post, metadata: UrlMetadata): Post => ({
  ...post,
  previewTitle: metadata.title ?? post.previewTitle,
  previewDescription: metadata.description ?? post.previewDescription,
  previewImageUrl: metadata.imageUrl ?? post.previewImageUrl,
  previewSiteName: metadata.siteName ?? post.previewSiteName
});
