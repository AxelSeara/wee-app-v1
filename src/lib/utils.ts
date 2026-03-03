export const generateId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const normalizeSpace = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

export const getInitials = (alias: string): string =>
  alias
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("") || "U";

export const colorFromString = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
};

export const safeDomainFromUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return undefined;
  }
};

export const canonicalizeUrl = (input?: string): string | undefined => {
  if (!input) return undefined;
  try {
    const url = new URL(input.trim());
    url.hash = "";

    const host = url.hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .replace(/^m\./, "");

    const hostAlias =
      host === "twitter.com" ? "x.com" :
      host === "mobile.twitter.com" ? "x.com" :
      host;

    const trackingParams = new Set([
      "fbclid",
      "gclid",
      "igshid",
      "igsh",
      "mc_cid",
      "mc_eid",
      "ref",
      "ref_src",
      "feature",
      "si",
      "spm",
      "mkt_tok",
      "vero_id",
      "_hsenc",
      "_hsmi",
      "wt.mc_id"
    ]);

    const keptParams: Array<[string, string]> = [];
    url.searchParams.forEach((value, key) => {
      const normalizedKey = key.toLowerCase();
      if (!value) return;
      if (normalizedKey.startsWith("utm_")) return;
      if (trackingParams.has(normalizedKey)) return;
      keptParams.push([normalizedKey, value]);
    });
    keptParams.sort(([a], [b]) => a.localeCompare(b));

    let path = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/");
    path = path.replace(/\/amp\/?$/i, "/");
    path = path.replace(/\/+$/, "") || "/";

    const query = keptParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    return `${hostAlias}${path}${query ? `?${query}` : ""}`;
  } catch {
    return input.trim().toLowerCase().replace(/^https?:\/\//, "");
  }
};

export const duplicateUrlKeys = (input?: string): string[] => {
  const canonical = canonicalizeUrl(input);
  if (!canonical) return [];
  const [withoutQuery] = canonical.split("?");
  return Array.from(new Set([canonical, withoutQuery]));
};
