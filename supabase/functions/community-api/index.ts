// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type InvitePolicy = "admins_only" | "members_allowed";
type Role = "admin" | "member";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (status: number, body: Record<string, unknown>, extraHeaders?: HeadersInit): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type,authorization,apikey,x-client-info,x-wee-session",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      ...extraHeaders
    }
  });

const normalizeAlias = (alias: string): string =>
  alias
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizeCode = (code: string): string => code.trim().toUpperCase();

const randomCode = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => (b % 36).toString(36))
    .join("")
    .toUpperCase();

const randomToken = (): string => crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

const sha256Hex = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
};

const nowIso = (): string => new Date().toISOString();

const extractSessionToken = (req: Request): string | null => {
  const header = req.headers.get("x-wee-session");
  if (header?.trim()) return header.trim();
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/wee_session=([^;]+)/);
  return m?.[1] ?? null;
};

const requireSession = async (req: Request): Promise<{
  session: { id: string; user_id: string; community_id: string; expires_at: string; revoked_at: string | null };
  user: { id: string; alias: string; status: string };
  role: Role;
  community: { id: string; name: string; rules_text: string | null; invite_policy: InvitePolicy };
} | Response> => {
  const token = extractSessionToken(req);
  if (!token) return json(401, { message: "Missing session" });
  const tokenHash = await sha256Hex(token);
  const { data: session, error } = await db
    .from("sessions")
    .select("id,user_id,community_id,expires_at,revoked_at")
    .eq("session_token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !session) return json(401, { message: "Invalid session" });
  if (Date.parse(session.expires_at) <= Date.now()) return json(401, { message: "Session expired" });

  const [userRes, roleRes, communityRes] = await Promise.all([
    db
      .from("community_users")
      .select("id,alias,status")
      .eq("id", session.user_id)
      .eq("community_id", session.community_id)
      .maybeSingle(),
    db
      .from("community_user_roles")
      .select("role")
      .eq("community_id", session.community_id)
      .eq("user_id", session.user_id)
      .maybeSingle(),
    db
      .from("communities")
      .select("id,name,rules_text,invite_policy")
      .eq("id", session.community_id)
      .maybeSingle()
  ]);

  if (userRes.error || !userRes.data || userRes.data.status !== "active") return json(403, { message: "Membership required" });
  if (roleRes.error || !roleRes.data) return json(403, { message: "Role missing" });
  if (communityRes.error || !communityRes.data) return json(404, { message: "Community not found" });

  return {
    session,
    user: userRes.data,
    role: roleRes.data.role as Role,
    community: communityRes.data as { id: string; name: string; rules_text: string | null; invite_policy: InvitePolicy }
  };
};

const bad = (message: string): Response => json(400, { message });

const ensureAdmin = (role: Role): Response | null => (role === "admin" ? null : json(403, { message: "Admin required" }));

const canManageInvites = (role: Role, policy: InvitePolicy): boolean => role === "admin" || policy === "members_allowed";

const parseBody = async (req: Request): Promise<Record<string, any>> => {
  try {
    return (await req.json()) as Record<string, any>;
  } catch {
    return {};
  }
};

const buildInviteUrl = (token: string): string => `#/login?invite=${token}`;

const toMillis = (value: string | null | undefined): number =>
  value ? Date.parse(value) || Date.now() : Date.now();

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));

const normalizePostPayload = (post: Record<string, any>): Record<string, any> => ({
  ...post,
  topics: Array.isArray(post.topics) && post.topics.length > 0 ? post.topics : ["misc"],
  subtopics: Array.isArray(post.subtopics) ? post.subtopics : [],
  flags: Array.isArray(post.flags) ? post.flags : [],
  rationale: Array.isArray(post.rationale) ? post.rationale : [],
  interestScore: Math.max(1, Math.min(100, Number(post.interestScore ?? 50) || 50)),
  qualityScore: Math.max(0, Math.min(100, Number(post.qualityScore ?? 50) || 50))
});

const rowToCommunityUser = (row: Record<string, any>): Record<string, any> => ({
  id: row.id,
  alias: row.alias,
  avatarDataUrl: row.avatar_url ?? undefined,
  role: row.community_user_roles?.[0]?.role === "admin" ? "admin" : "member",
  language: row.language ?? "es",
  createdAt: toMillis(row.created_at)
});

const buildPostFromRows = (
  row: Record<string, any>,
  comments: Record<string, any>[],
  votes: Record<string, any>[],
  shares: Record<string, any>[],
  opens: Record<string, any>[],
  commentAura: Record<string, any>[]
): Record<string, any> => {
  const postComments = comments
    .filter((entry) => entry.post_id === row.id)
    .sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at))
    .map((entry) => ({
      id: entry.id,
      userId: entry.user_id,
      text: entry.text,
      createdAt: toMillis(entry.created_at),
      auraUserIds: commentAura
        .filter((value) => value.comment_id === entry.id)
        .map((value) => value.user_id)
    }));
  const postVotes = votes
    .filter((entry) => entry.post_id === row.id)
    .map((entry) => ({
      userId: entry.user_id,
      vote: entry.vote,
      votedAt: toMillis(entry.voted_at)
    }));
  const contributorCounts: Record<string, number> = {};
  shares
    .filter((entry) => entry.post_id === row.id)
    .forEach((entry) => {
      contributorCounts[entry.user_id] = Math.max(1, Number(entry.share_count ?? 1) || 1);
    });
  if (!contributorCounts[row.user_id]) contributorCounts[row.user_id] = 1;
  const contributorUserIds = Object.keys(contributorCounts);
  const shareCount = Object.values(contributorCounts).reduce((acc, value) => acc + value, 0);
  const openedByUserIds = unique(opens.filter((entry) => entry.post_id === row.id).map((entry) => entry.user_id));

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: toMillis(row.created_at),
    status: row.status ?? "active",
    removedBy: row.removed_by ?? undefined,
    removedAt: row.removed_at ? toMillis(row.removed_at) : undefined,
    removedReason: row.removed_reason ?? undefined,
    url: row.url ?? undefined,
    canonicalUrl: row.canonical_url ?? undefined,
    title: row.title ?? undefined,
    text: row.text ?? undefined,
    previewTitle: row.preview_title ?? undefined,
    previewDescription: row.preview_description ?? undefined,
    previewImageUrl: row.preview_image_url ?? undefined,
    previewSiteName: row.preview_site_name ?? undefined,
    sourceDomain: row.source_domain ?? undefined,
    topics: row.topics && row.topics.length > 0 ? row.topics : ["misc"],
    subtopics: row.subtopics ?? [],
    topicV2: row.topic_v2 ?? undefined,
    topicCandidatesV2: Array.isArray(row.topic_candidates_v2) ? row.topic_candidates_v2 : undefined,
    topicExplanationV2: row.topic_explanation_v2 ?? undefined,
    topicVersion: row.topic_version ?? undefined,
    qualityLabel: row.quality_label,
    qualityScore: Number(row.quality_score ?? 50),
    interestScore: Math.max(1, Math.min(100, Number(row.interest_score ?? 50))),
    flags: row.flags ?? [],
    rationale: row.rationale ?? [],
    normalizedText: row.normalized_text ?? "",
    extractedHosts: [],
    contributorCounts,
    contributorUserIds,
    shareCount,
    openedByUserIds,
    comments: postComments,
    feedbacks: postVotes
  };
};

const postToRow = (postRaw: Record<string, any>, auth: { user: { id: string }; community: { id: string } }): Record<string, any> => {
  const post = normalizePostPayload(postRaw);
  return {
    id: post.id,
    community_id: auth.community.id,
    user_id: post.userId ?? auth.user.id,
    created_at: new Date(Number(post.createdAt ?? Date.now())).toISOString(),
    status: post.status ?? "active",
    removed_by: post.removedBy ?? null,
    removed_at: post.removedAt ? new Date(Number(post.removedAt)).toISOString() : null,
    removed_reason: post.removedReason ?? null,
    url: post.url ?? null,
    canonical_url: post.canonicalUrl ?? null,
    title: post.title ?? null,
    text: post.text ?? null,
    preview_title: post.previewTitle ?? null,
    preview_description: post.previewDescription ?? null,
    preview_image_url: post.previewImageUrl ?? null,
    preview_site_name: post.previewSiteName ?? null,
    source_domain: post.sourceDomain ?? null,
    topics: post.topics,
    subtopics: post.subtopics,
    topic_v2: post.topicV2 ?? null,
    topic_candidates_v2: post.topicCandidatesV2 ?? null,
    topic_explanation_v2: post.topicExplanationV2 ?? null,
    topic_version: post.topicVersion ?? null,
    quality_label: post.qualityLabel ?? "medium",
    quality_score: post.qualityScore,
    interest_score: post.interestScore,
    flags: post.flags,
    rationale: post.rationale,
    normalized_text: post.normalizedText ?? ""
  };
};

const syncOwnInteractions = async (auth: { user: { id: string }; community: { id: string } }, post: Record<string, any>) => {
  const postId = String(post.id ?? "").trim();
  if (!postId) return;
  const userId = auth.user.id;
  const feedbacks = Array.isArray(post.feedbacks) ? post.feedbacks : [];
  const ownVote = feedbacks.find((entry: Record<string, any>) => entry.userId === userId);
  if (ownVote) {
    await db.from("post_votes").upsert(
      {
        community_id: auth.community.id,
        post_id: postId,
        user_id: userId,
        vote: ownVote.vote === -1 ? -1 : 1,
        voted_at: new Date(Number(ownVote.votedAt ?? Date.now())).toISOString()
      },
      { onConflict: "community_id,post_id,user_id" }
    );
  }

  const allComments = Array.isArray(post.comments) ? post.comments : [];
  const ownComments = allComments.filter((entry: Record<string, any>) => entry.userId === userId);

  const existingComments = await db
    .from("comments")
    .select("id")
    .eq("community_id", auth.community.id)
    .eq("post_id", postId)
    .eq("user_id", userId);
  const existingIds = new Set((existingComments.data ?? []).map((entry: Record<string, any>) => entry.id as string));
  const keepIds = new Set(ownComments.map((entry: Record<string, any>) => String(entry.id)));
  const removeIds = Array.from(existingIds).filter((id) => !keepIds.has(id));
  if (removeIds.length > 0) {
    await db.from("comments").delete().eq("community_id", auth.community.id).eq("post_id", postId).in("id", removeIds);
  }
  if (ownComments.length > 0) {
    await db.from("comments").upsert(
      ownComments.map((entry: Record<string, any>) => ({
        id: entry.id,
        community_id: auth.community.id,
        post_id: postId,
        user_id: userId,
        text: String(entry.text ?? "").slice(0, 400),
        created_at: new Date(Number(entry.createdAt ?? Date.now())).toISOString()
      })),
      { onConflict: "id" }
    );
  }

  const contributorCounts = (post.contributorCounts ?? {}) as Record<string, number>;
  const shareCount = Math.max(1, Number(contributorCounts[userId] ?? (post.userId === userId ? 1 : 0)) || 0);
  if (shareCount > 0) {
    await db.from("post_shares").upsert(
      {
        community_id: auth.community.id,
        post_id: postId,
        user_id: userId,
        share_count: shareCount,
        last_shared_at: nowIso()
      },
      { onConflict: "community_id,post_id,user_id" }
    );
  }

  const openedBy = new Set(Array.isArray(post.openedByUserIds) ? post.openedByUserIds : []);
  if (openedBy.has(userId)) {
    await db.from("post_opens").upsert(
      {
        community_id: auth.community.id,
        post_id: postId,
        user_id: userId,
        opened_at: nowIso()
      },
      { onConflict: "community_id,post_id,user_id" }
    );
  }

  const ownAuraComments = new Set(
    allComments
      .filter((entry: Record<string, any>) => Array.isArray(entry.auraUserIds) && entry.auraUserIds.includes(userId))
      .map((entry: Record<string, any>) => String(entry.id))
  );
  const allCommentIds = allComments.map((entry: Record<string, any>) => String(entry.id));
  if (allCommentIds.length === 0) return;
  const existingAura = await db
    .from("comment_aura")
    .select("comment_id")
    .eq("community_id", auth.community.id)
    .eq("user_id", userId)
    .in("comment_id", allCommentIds);
  const existingAuraIds = new Set((existingAura.data ?? []).map((entry: Record<string, any>) => String(entry.comment_id)));
  const removeAuraIds = Array.from(existingAuraIds).filter((id) => !ownAuraComments.has(id));
  if (removeAuraIds.length > 0) {
    await db
      .from("comment_aura")
      .delete()
      .eq("community_id", auth.community.id)
      .eq("user_id", userId)
      .in("comment_id", removeAuraIds);
  }
  const insertAura = Array.from(ownAuraComments)
    .filter((id) => !existingAuraIds.has(id))
    .map((commentId) => ({
      community_id: auth.community.id,
      comment_id: commentId,
      user_id: userId,
      created_at: nowIso()
    }));
  if (insertAura.length > 0) {
    await db.from("comment_aura").upsert(insertAura, { onConflict: "community_id,comment_id,user_id" });
  }
};

const handlers = {
  "/community/create": async (req: Request) => {
    const body = await parseBody(req);
    const name = String(body.name ?? "").trim();
    if (name.length < 2) return bad("Community name is required");

    const description = String(body.description ?? "").trim() || null;
    const rulesText = String(body.rules_text ?? "").trim() || null;
    const invitePolicy: InvitePolicy = body.invite_policy === "members_allowed" ? "members_allowed" : "admins_only";
    const code = normalizeCode(String(body.code ?? randomCode()));
    const expiresAt = body.invite_expires_at ? new Date(String(body.invite_expires_at)).toISOString() : null;

    const { data: community, error: cErr } = await db
      .from("communities")
      .insert({ name, description, rules_text: rulesText, invite_policy: invitePolicy })
      .select("id,name,description")
      .single();
    if (cErr || !community) return json(500, { message: cErr?.message ?? "Create community failed" });

    const token = randomToken();
    const { error: iErr } = await db.from("community_invites").insert({
      community_id: community.id,
      code,
      token,
      created_by: null,
      created_at: nowIso(),
      expires_at: expiresAt
    });
    if (iErr) return json(500, { message: iErr.message });

    return json(200, {
      community_id: community.id,
      name: community.name,
      description: community.description,
      invite: { code, token, link: buildInviteUrl(token) }
    });
  },

  "/community/preview": async (req: Request) => {
    const body = await parseBody(req);
    const code = body.code ? normalizeCode(String(body.code)) : null;
    const token = body.token ? String(body.token).trim() : null;
    if (!code && !token) return bad("code or token required");

    const query = db
      .from("community_invites")
      .select("community_id,expires_at,revoked_at,communities(name,description)")
      .is("revoked_at", null)
      .limit(1);

    const { data, error } = code ? await query.eq("code", code).maybeSingle() : await query.eq("token", token).maybeSingle();
    if (error || !data) return json(404, { message: "Invite not found" });
    if (data.expires_at && Date.parse(data.expires_at) < Date.now()) return json(410, { message: "Invite expired" });

    const community = data.communities as { name: string; description: string | null };
    return json(200, {
      community_id: data.community_id,
      name: community.name,
      description: community.description ?? undefined
    });
  },

  "/community/join/confirm": async (req: Request) => {
    const body = await parseBody(req);
    const code = body.code ? normalizeCode(String(body.code)) : null;
    const token = body.token ? String(body.token).trim() : null;
    if (!code && !token) return bad("code or token required");

    const query = db
      .from("community_invites")
      .select("community_id,expires_at,revoked_at,communities(name,description)")
      .is("revoked_at", null)
      .limit(1);

    const { data, error } = code ? await query.eq("code", code).maybeSingle() : await query.eq("token", token).maybeSingle();
    if (error || !data) return json(404, { message: "Invite not found" });
    if (data.expires_at && Date.parse(data.expires_at) < Date.now()) return json(410, { message: "Invite expired" });

    const community = data.communities as { name: string; description: string | null };
    return json(200, {
      community_id: data.community_id,
      name: community.name,
      description: community.description ?? undefined,
      confirmed: true
    });
  },

  "/auth/register": async (req: Request) => {
    const body = await parseBody(req);
    const communityId = String(body.community_id ?? "").trim();
    const alias = String(body.alias ?? "").trim();
    const password = String(body.password ?? "");
    const language = ["es", "en", "gl"].includes(String(body.language)) ? String(body.language) : "es";
    const avatarUrl = String(body.avatar ?? body.avatar_url ?? "").trim() || null;

    if (!communityId) return bad("community_id required");
    if (alias.length < 2) return bad("alias too short");
    if (password.length < 4) return bad("password too short");

    const normalizedAlias = normalizeAlias(alias);
    const passwordHash = await sha256Hex(password);

    const existing = await db
      .from("community_users")
      .select("id,alias,status")
      .eq("community_id", communityId)
      .eq("normalized_alias", normalizedAlias)
      .maybeSingle();
    if (existing.error) return json(400, { message: existing.error.message });

    let user: { id: string; alias: string; community_id: string } | null = null;
    if (existing.data) {
      if (existing.data.status === "active") {
        return json(409, { message: "ALIAS_EXISTS" });
      }
      const revived = await db
        .from("community_users")
        .update({
          alias,
          password_hash: passwordHash,
          avatar_url: avatarUrl,
          language,
          status: "active"
        })
        .eq("id", existing.data.id)
        .eq("community_id", communityId)
        .select("id,alias,community_id")
        .single();
      if (revived.error || !revived.data) return json(400, { message: revived.error?.message ?? "Register failed" });
      user = revived.data as { id: string; alias: string; community_id: string };
    } else {
      const inserted = await db
        .from("community_users")
        .insert({
          community_id: communityId,
          alias,
          normalized_alias: normalizedAlias,
          password_hash: passwordHash,
          avatar_url: avatarUrl,
          language,
          status: "active"
        })
        .select("id,alias,community_id")
        .single();
      if (inserted.error || !inserted.data) return json(400, { message: inserted.error?.message ?? "Register failed" });
      user = inserted.data as { id: string; alias: string; community_id: string };
    }

    const { count: adminCount, error: adminCountError } = await db
      .from("community_user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("community_id", communityId)
      .eq("role", "admin");
    if (adminCountError) return json(500, { message: adminCountError.message });

    const role: Role = (adminCount ?? 0) === 0 ? "admin" : "member";
    const { error: rErr } = await db.from("community_user_roles").upsert({ community_id: communityId, user_id: user.id, role }, { onConflict: "community_id,user_id" });
    if (rErr) return json(500, { message: rErr.message });

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    const { error: sErr } = await db.from("sessions").insert({
      community_id: communityId,
      user_id: user.id,
      session_token_hash: tokenHash,
      created_at: nowIso(),
      expires_at: expiresAt
    });
    if (sErr) return json(500, { message: sErr.message });

    const { data: community } = await db
      .from("communities")
      .select("id,name,description,rules_text,invite_policy")
      .eq("id", communityId)
      .single();

    return json(200, {
      session_token: token,
      user: { id: user.id, alias: user.alias, language },
      community
    }, {
      "Set-Cookie": `wee_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    });
  },

  "/auth/login": async (req: Request) => {
    const body = await parseBody(req);
    const communityId = String(body.community_id ?? "").trim();
    const alias = String(body.alias ?? "").trim();
    const password = String(body.password ?? "");
    if (!communityId || !alias || !password) return bad("community_id, alias, password required");

    const normalizedAlias = normalizeAlias(alias);
    const passwordHash = await sha256Hex(password);
    const { data: user, error } = await db
      .from("community_users")
      .select("id,alias,language,password_hash,status")
      .eq("community_id", communityId)
      .eq("normalized_alias", normalizedAlias)
      .maybeSingle();

    if (error || !user) return json(401, { message: "Invalid credentials" });
    if (user.status !== "active") return json(403, { message: "User inactive" });
    if (user.password_hash !== passwordHash) return json(401, { message: "Invalid credentials" });

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    await db.from("sessions").insert({
      community_id: communityId,
      user_id: user.id,
      session_token_hash: tokenHash,
      created_at: nowIso(),
      expires_at: expiresAt
    });

    const { data: community } = await db
      .from("communities")
      .select("id,name,description,rules_text,invite_policy")
      .eq("id", communityId)
      .single();

    return json(200, {
      session_token: token,
      user: { id: user.id, alias: user.alias, language: user.language },
      community
    }, {
      "Set-Cookie": `wee_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    });
  },

  "/auth/logout": async (req: Request) => {
    const token = extractSessionToken(req);
    if (token) {
      const tokenHash = await sha256Hex(token);
      await db.from("sessions").update({ revoked_at: nowIso() }).eq("session_token_hash", tokenHash).is("revoked_at", null);
    }
    return json(200, { ok: true }, { "Set-Cookie": "wee_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax" });
  },

  "/community/meta": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const { data: members } = await db
      .from("community_users")
      .select("id,alias,community_user_roles(role)")
      .eq("community_id", auth.community.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    return json(200, {
      community: {
        id: auth.community.id,
        name: auth.community.name,
        rulesText: auth.community.rules_text ?? ""
      },
      members: (members ?? []).map((m: any) => ({ id: m.id, alias: m.alias, role: m.community_user_roles?.[0]?.role ?? "member" }))
    });
  },

  "/community/leave": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;

    if (auth.role === "admin") {
      const { count } = await db
        .from("community_user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("community_id", auth.community.id)
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return json(400, { message: "Last admin cannot leave. Promote another admin first." });
      }
    }

    await db.from("sessions").update({ revoked_at: nowIso() }).eq("user_id", auth.user.id).eq("community_id", auth.community.id).is("revoked_at", null);
    await db.from("community_users").update({ status: "left" }).eq("id", auth.user.id).eq("community_id", auth.community.id);
    return json(200, { ok: true });
  },

  "/community/admin/promote": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const denied = ensureAdmin(auth.role);
    if (denied) return denied;

    const body = await parseBody(req);
    const target = String(body.target_user_id ?? "").trim();
    if (!target) return bad("target_user_id required");

    await db.from("community_user_roles").upsert({ community_id: auth.community.id, user_id: target, role: "admin" }, { onConflict: "community_id,user_id" });
    return json(200, { ok: true });
  },

  "/community/admin/demote": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const denied = ensureAdmin(auth.role);
    if (denied) return denied;

    const body = await parseBody(req);
    const target = String(body.target_user_id ?? "").trim();
    if (!target) return bad("target_user_id required");

    if (target === auth.user.id) {
      const { count } = await db
        .from("community_user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("community_id", auth.community.id)
        .eq("role", "admin");
      if ((count ?? 0) <= 1) return json(400, { message: "Cannot demote last admin" });
    }

    await db.from("community_user_roles").upsert({ community_id: auth.community.id, user_id: target, role: "member" }, { onConflict: "community_id,user_id" });
    return json(200, { ok: true });
  },

  "/community/admin/remove": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const denied = ensureAdmin(auth.role);
    if (denied) return denied;

    const body = await parseBody(req);
    const target = String(body.target_user_id ?? "").trim();
    if (!target) return bad("target_user_id required");

    const { data: targetRole } = await db
      .from("community_user_roles")
      .select("role")
      .eq("community_id", auth.community.id)
      .eq("user_id", target)
      .maybeSingle();

    if (targetRole?.role === "admin") {
      const { count } = await db
        .from("community_user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("community_id", auth.community.id)
        .eq("role", "admin");
      if ((count ?? 0) <= 1) return json(400, { message: "Cannot remove last admin" });
    }

    await db.from("community_users").update({ status: "kicked" }).eq("id", target).eq("community_id", auth.community.id);
    await db.from("sessions").update({ revoked_at: nowIso() }).eq("user_id", target).eq("community_id", auth.community.id).is("revoked_at", null);
    return json(200, { ok: true });
  },

  "/community/invite/create": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    if (!canManageInvites(auth.role, auth.community.invite_policy)) {
      return json(403, { message: "Invite policy forbids this action" });
    }

    const body = await parseBody(req);
    const code = normalizeCode(String(body.code ?? randomCode()));
    const token = randomToken();
    const expiresAt = body.expires_at ? new Date(String(body.expires_at)).toISOString() : null;

    const { data, error } = await db
      .from("community_invites")
      .insert({
        community_id: auth.community.id,
        code,
        token,
        created_by: auth.user.id,
        created_at: nowIso(),
        expires_at: expiresAt
      })
      .select("id,code,token")
      .single();
    if (error || !data) return json(400, { message: error?.message ?? "Invite create failed" });
    return json(200, { id: data.id, code: data.code, token: data.token, link: buildInviteUrl(data.token) });
  },

  "/community/invite/revoke": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    if (!canManageInvites(auth.role, auth.community.invite_policy)) {
      return json(403, { message: "Invite policy forbids this action" });
    }
    const body = await parseBody(req);
    const inviteId = String(body.invite_id ?? "").trim();
    if (!inviteId) return bad("invite_id required");

    await db
      .from("community_invites")
      .update({ revoked_at: nowIso() })
      .eq("id", inviteId)
      .eq("community_id", auth.community.id)
      .is("revoked_at", null);
    return json(200, { ok: true });
  },

  "/community/invite/set_expiry": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    if (!canManageInvites(auth.role, auth.community.invite_policy)) {
      return json(403, { message: "Invite policy forbids this action" });
    }
    const body = await parseBody(req);
    const inviteId = String(body.invite_id ?? "").trim();
    if (!inviteId) return bad("invite_id required");
    const expiresAt = body.expires_at ? new Date(String(body.expires_at)).toISOString() : null;

    await db
      .from("community_invites")
      .update({ expires_at: expiresAt })
      .eq("id", inviteId)
      .eq("community_id", auth.community.id)
      .is("revoked_at", null);
    return json(200, { ok: true });
  },

  "/data/bootstrap": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;

    const [usersRes, postsRes, prefsRes] = await Promise.all([
      db
        .from("community_users")
        .select("id,alias,avatar_url,language,created_at,community_user_roles(role)")
        .eq("community_id", auth.community.id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      db
        .from("posts")
        .select("id,user_id,created_at,status,removed_by,removed_at,removed_reason,url,canonical_url,title,text,preview_title,preview_description,preview_image_url,preview_site_name,source_domain,topics,subtopics,topic_v2,topic_candidates_v2,topic_explanation_v2,topic_version,quality_label,quality_score,interest_score,flags,rationale,normalized_text")
        .eq("community_id", auth.community.id)
        .order("created_at", { ascending: false }),
      db
        .from("user_preferences")
        .select("user_id,preferred_topics,blocked_domains,blocked_keywords")
        .eq("community_id", auth.community.id)
        .eq("user_id", auth.user.id)
        .maybeSingle()
    ]);

    if (usersRes.error) return json(500, { message: usersRes.error.message });
    if (postsRes.error) return json(500, { message: postsRes.error.message });

    const postIds = (postsRes.data ?? []).map((post: Record<string, any>) => post.id);
    let comments: Record<string, any>[] = [];
    let votes: Record<string, any>[] = [];
    let shares: Record<string, any>[] = [];
    let opens: Record<string, any>[] = [];
    let commentAura: Record<string, any>[] = [];
    if (postIds.length > 0) {
      const [commentsRes, votesRes, sharesRes, opensRes] = await Promise.all([
        db
          .from("comments")
          .select("id,post_id,user_id,text,created_at")
          .eq("community_id", auth.community.id)
          .in("post_id", postIds),
        db
          .from("post_votes")
          .select("post_id,user_id,vote,voted_at")
          .eq("community_id", auth.community.id)
          .in("post_id", postIds),
        db
          .from("post_shares")
          .select("post_id,user_id,share_count")
          .eq("community_id", auth.community.id)
          .in("post_id", postIds),
        db
          .from("post_opens")
          .select("post_id,user_id")
          .eq("community_id", auth.community.id)
          .in("post_id", postIds)
      ]);
      if (commentsRes.error) return json(500, { message: commentsRes.error.message });
      if (votesRes.error) return json(500, { message: votesRes.error.message });
      if (sharesRes.error) return json(500, { message: sharesRes.error.message });
      if (opensRes.error) return json(500, { message: opensRes.error.message });

      comments = commentsRes.data ?? [];
      votes = votesRes.data ?? [];
      shares = sharesRes.data ?? [];
      opens = opensRes.data ?? [];

      const commentIds = comments.map((entry) => entry.id);
      if (commentIds.length > 0) {
        const commentAuraRes = await db
          .from("comment_aura")
          .select("comment_id,user_id")
          .eq("community_id", auth.community.id)
          .in("comment_id", commentIds);
        if (commentAuraRes.error) return json(500, { message: commentAuraRes.error.message });
        commentAura = commentAuraRes.data ?? [];
      }
    }

    return json(200, {
      users: (usersRes.data ?? []).map((row) => rowToCommunityUser(row as Record<string, any>)),
      posts: (postsRes.data ?? []).map((row) =>
        buildPostFromRows(
          row as Record<string, any>,
          comments,
          votes,
          shares,
          opens,
          commentAura
        )
      ),
      preferences: prefsRes.data
        ? {
            userId: auth.user.id,
            preferredTopics: prefsRes.data.preferred_topics ?? [],
            blockedDomains: prefsRes.data.blocked_domains ?? [],
            blockedKeywords: prefsRes.data.blocked_keywords ?? []
          }
        : null
    });
  },

  "/data/post/create": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const body = await parseBody(req);
    const post = normalizePostPayload((body.post ?? {}) as Record<string, any>);
    if (!post.id) return bad("post.id required");

    const row = postToRow({ ...post, userId: auth.user.id }, auth);
    const { error } = await db.from("posts").insert(row);
    if (error) return json(400, { message: error.message });

    await syncOwnInteractions(auth, { ...post, userId: auth.user.id });
    return json(200, { ...post, userId: auth.user.id });
  },

  "/data/post/update": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const body = await parseBody(req);
    const post = normalizePostPayload((body.post ?? {}) as Record<string, any>);
    const postId = String(post.id ?? "").trim();
    if (!postId) return bad("post.id required");

    const current = await db
      .from("posts")
      .select("id,user_id,community_id")
      .eq("id", postId)
      .eq("community_id", auth.community.id)
      .maybeSingle();
    if (current.error || !current.data) return json(404, { message: "Post not found" });
    if (current.data.user_id !== auth.user.id && auth.role !== "admin") {
      return json(403, { message: "Not allowed to edit this post" });
    }

    const row = postToRow({ ...post, userId: current.data.user_id }, auth);
    const { error } = await db.from("posts").update(row).eq("id", postId).eq("community_id", auth.community.id);
    if (error) return json(400, { message: error.message });

    await syncOwnInteractions(auth, { ...post, userId: current.data.user_id });
    return json(200, { ...post, userId: current.data.user_id });
  },

  "/data/post/delete": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const body = await parseBody(req);
    const postId = String(body.post_id ?? "").trim();
    if (!postId) return bad("post_id required");
    const current = await db
      .from("posts")
      .select("id,user_id")
      .eq("id", postId)
      .eq("community_id", auth.community.id)
      .maybeSingle();
    if (current.error || !current.data) return json(404, { message: "Post not found" });
    if (current.data.user_id !== auth.user.id && auth.role !== "admin") {
      return json(403, { message: "Not allowed to delete this post" });
    }
    const { error } = await db.from("posts").delete().eq("id", postId).eq("community_id", auth.community.id);
    if (error) return json(400, { message: error.message });
    return json(200, { ok: true });
  },

  "/data/preferences/get": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const { data, error } = await db
      .from("user_preferences")
      .select("preferred_topics,blocked_domains,blocked_keywords")
      .eq("community_id", auth.community.id)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) return json(500, { message: error.message });
    if (!data) return json(200, null);
    return json(200, {
      userId: auth.user.id,
      preferredTopics: data.preferred_topics ?? [],
      blockedDomains: data.blocked_domains ?? [],
      blockedKeywords: data.blocked_keywords ?? []
    });
  },

  "/data/preferences/upsert": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const body = await parseBody(req);
    const prefs = (body.preferences ?? {}) as Record<string, any>;
    const payload = {
      community_id: auth.community.id,
      user_id: auth.user.id,
      preferred_topics: Array.isArray(prefs.preferredTopics) ? prefs.preferredTopics.slice(0, 30) : [],
      blocked_domains: Array.isArray(prefs.blockedDomains) ? prefs.blockedDomains.slice(0, 50) : [],
      blocked_keywords: Array.isArray(prefs.blockedKeywords) ? prefs.blockedKeywords.slice(0, 80) : [],
      updated_at: nowIso()
    };
    const { error } = await db.from("user_preferences").upsert(payload, { onConflict: "community_id,user_id" });
    if (error) return json(400, { message: error.message });
    return json(200, {
      userId: auth.user.id,
      preferredTopics: payload.preferred_topics,
      blockedDomains: payload.blocked_domains,
      blockedKeywords: payload.blocked_keywords
    });
  },

  "/data/report/create": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const body = await parseBody(req);
    const postId = String(body.post_id ?? "").trim();
    const reason = String(body.reason ?? "").trim().slice(0, 280);
    if (!postId || !reason) return bad("post_id and reason required");
    const { error } = await db.from("post_reports").insert({
      community_id: auth.community.id,
      post_id: postId,
      reporter_id: auth.user.id,
      reason,
      created_at: nowIso()
    });
    if (error) return json(400, { message: error.message });
    return json(200, { ok: true });
  },

  "/data/profile/update": async (req: Request) => {
    const auth = await requireSession(req);
    if (auth instanceof Response) return auth;
    const body = await parseBody(req);
    const alias = body.alias ? String(body.alias).trim().slice(0, 40) : null;
    const avatarUrl = body.avatar_url === undefined ? undefined : String(body.avatar_url ?? "").trim() || null;
    const language = body.language && ["es", "en", "gl"].includes(String(body.language)) ? String(body.language) : undefined;

    if (alias) {
      const normalized = normalizeAlias(alias);
      const exists = await db
        .from("community_users")
        .select("id")
        .eq("community_id", auth.community.id)
        .eq("normalized_alias", normalized)
        .neq("id", auth.user.id)
        .limit(1);
      if ((exists.data ?? []).length > 0) return json(409, { message: "Alias already exists" });
    }

    const updatePayload: Record<string, unknown> = {};
    if (alias !== null) {
      updatePayload.alias = alias;
      updatePayload.normalized_alias = normalizeAlias(alias);
    }
    if (avatarUrl !== undefined) updatePayload.avatar_url = avatarUrl;
    if (language) updatePayload.language = language;
    if (Object.keys(updatePayload).length > 0) {
      const { error } = await db
        .from("community_users")
        .update(updatePayload)
        .eq("community_id", auth.community.id)
        .eq("id", auth.user.id);
      if (error) return json(400, { message: error.message });
    }

    const { data: updated, error: readError } = await db
      .from("community_users")
      .select("id,alias,avatar_url,language,created_at,community_user_roles(role)")
      .eq("community_id", auth.community.id)
      .eq("id", auth.user.id)
      .single();
    if (readError) return json(500, { message: readError.message });
    return json(200, { user: rowToCommunityUser(updated as Record<string, any>) });
  }
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { message: "Method not allowed" });

  const url = new URL(req.url);
  const path = url.pathname
    .replace(/^\/functions\/v1\/community-api/, "")
    .replace(/^\/community-api/, "")
    .replace(/^\/community-api\/?/, "/");
  const handler = (handlers as Record<string, (request: Request) => Promise<Response>>)[path];
  if (!handler) return json(404, { message: "Not found" });

  try {
    return await handler(req);
  } catch (error) {
    return json(500, { message: error instanceof Error ? error.message : "Unhandled error" });
  }
});
