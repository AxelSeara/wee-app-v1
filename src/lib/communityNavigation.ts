export const resolveRootRoute = (input: {
  hasGlobalSession: boolean;
  hasActiveCommunitySession: boolean;
}): "/login" | "/communities" | "/home" => {
  if (!input.hasGlobalSession) return "/login";
  if (!input.hasActiveCommunitySession) return "/communities";
  return "/home";
};

export const shouldAutoEnterDefaultCommunity = (input: {
  skipPicker?: boolean;
  defaultCommunityId?: string;
  availableCommunityIds: string[];
  hasInviteQuery: boolean;
}): boolean => {
  if (input.hasInviteQuery) return false;
  if (!input.skipPicker) return false;
  if (!input.defaultCommunityId) return false;
  return input.availableCommunityIds.includes(input.defaultCommunityId);
};

export const isCommunitySessionAccessError = (message: string): boolean => {
  const value = message.toLowerCase();
  return (
    value.includes("membership required") ||
    value.includes("invalid session") ||
    value.includes("session expired") ||
    value.includes("community not found") ||
    value.includes("role missing")
  );
};

export const parseCommunityJoinInput = (value: string): { code?: string; token?: string } => {
  const clean = value.trim();
  if (!clean) return {};
  if (clean.includes("invite=") || clean.includes("code=")) {
    const queryPart = clean.includes("?") ? clean.split("?")[1] ?? "" : clean;
    const params = new URLSearchParams(queryPart);
    const token = params.get("invite")?.trim();
    if (token) return { token };
    const code = params.get("code")?.trim();
    if (code) return { code: code.toUpperCase() };
  }
  const pathMatch = clean.match(/\/invite\/([A-Za-z0-9_-]{10,})/);
  if (pathMatch?.[1]) return { token: pathMatch[1] };
  if (/^[A-Za-z0-9_-]{12,}$/.test(clean)) return { token: clean };
  return { code: clean.toUpperCase() };
};
