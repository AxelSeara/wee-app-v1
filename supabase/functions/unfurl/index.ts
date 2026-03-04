import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CacheRow {
  canonical_url: string;
  final_url: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  status_code: number | null;
  fetched_at: string;
  expires_at: string;
}

interface UnfurlResponse {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  finalUrl?: string;
  cached: boolean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const clean = (value?: string | null, max = 320): string | undefined => {
  if (!value) return undefined;
  const next = value.replace(/\s+/g, " ").trim();
  if (!next) return undefined;
  return next.slice(0, max);
};

const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const absoluteUrl = (candidate: string | undefined, baseUrl: string): string | undefined => {
  if (!candidate) return undefined;
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
};

const canonicalizeUrl = (input: string): string => {
  const url = new URL(input.trim());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");

  const tracking = new Set([
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

  const params: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (!value) return;
    if (normalized.startsWith("utm_")) return;
    if (tracking.has(normalized)) return;
    params.push([normalized, value]);
  });

  params.sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  params.forEach(([key, value]) => url.searchParams.append(key, value));

  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  return url.toString();
};

const pickMeta = (html: string, keys: string[]): string | undefined => {
  for (const key of keys) {
    const propertyPattern = new RegExp(
      `<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const propertyMatch = html.match(propertyPattern);
    if (propertyMatch?.[1]) return decodeEntities(propertyMatch[1]);

    const namePattern = new RegExp(
      `<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const nameMatch = html.match(namePattern);
    if (nameMatch?.[1]) return decodeEntities(nameMatch[1]);
  }
  return undefined;
};

const pickTitle = (html: string): string | undefined => {
  const og = pickMeta(html, ["og:title", "twitter:title"]);
  if (og) return og;
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!match?.[1]) return undefined;
  return decodeEntities(match[1]);
};

const toResponseFromCache = (row: CacheRow): UnfurlResponse => ({
  title: clean(row.title, 140),
  description: clean(row.description, 320),
  imageUrl: clean(row.image_url, 1000),
  siteName: clean(row.site_name, 80),
  finalUrl: clean(row.final_url, 1000),
  cached: true
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeUrl(url);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase service envs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: cached, error: cachedError } = await admin
      .from("link_metadata_cache")
      .select("canonical_url,final_url,title,description,image_url,site_name,status_code,fetched_at,expires_at")
      .eq("canonical_url", canonicalUrl)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle<CacheRow>();

    if (!cachedError && cached) {
      return new Response(JSON.stringify(toResponseFromCache(cached)), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const response = await fetch(canonicalUrl, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "accept-language": "es-ES,es;q=0.9,en;q=0.8"
      }
    });

    const html = await response.text();
    const finalUrl = response.url || canonicalUrl;

    const title = clean(pickTitle(html), 140);
    const description = clean(pickMeta(html, ["og:description", "twitter:description", "description"]), 320);
    const siteName = clean(pickMeta(html, ["og:site_name", "application-name"]), 80);

    const imageCandidate = pickMeta(html, ["og:image", "og:image:secure_url", "twitter:image", "thumbnail"]);
    const imageUrl = clean(absoluteUrl(imageCandidate, finalUrl), 1000);

    const now = new Date();
    const ttlMs = 1000 * 60 * 60 * 12;
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    await admin.from("link_metadata_cache").upsert(
      {
        canonical_url: canonicalUrl,
        final_url: finalUrl,
        title: title ?? null,
        description: description ?? null,
        image_url: imageUrl ?? null,
        site_name: siteName ?? null,
        status_code: response.status,
        fetched_at: now.toISOString(),
        expires_at: expiresAt
      },
      { onConflict: "canonical_url" }
    );

    const payload: UnfurlResponse = {
      title,
      description,
      imageUrl,
      siteName,
      finalUrl,
      cached: false
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
