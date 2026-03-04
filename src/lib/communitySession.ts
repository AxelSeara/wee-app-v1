export interface CommunitySelection {
  id: string;
  name: string;
  description?: string;
  invitePolicy?: "admins_only" | "members_allowed";
  rulesText?: string;
}

export interface CommunityAuthSession {
  sessionToken: string;
  userId: string;
  alias: string;
  community: CommunitySelection;
}

const KEYS = {
  selected: "wee:community:selected",
  session: "wee:community:session"
} as const;

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getSelectedCommunity = (): CommunitySelection | null => readJson<CommunitySelection>(KEYS.selected);
export const setSelectedCommunity = (community: CommunitySelection | null): void => {
  if (!community) {
    localStorage.removeItem(KEYS.selected);
    return;
  }
  localStorage.setItem(KEYS.selected, JSON.stringify(community));
};

export const getCommunitySession = (): CommunityAuthSession | null => readJson<CommunityAuthSession>(KEYS.session);
export const setCommunitySession = (session: CommunityAuthSession | null): void => {
  if (!session) {
    localStorage.removeItem(KEYS.session);
    return;
  }
  localStorage.setItem(KEYS.session, JSON.stringify(session));
  setSelectedCommunity(session.community);
};

export const clearCommunitySession = (): void => {
  localStorage.removeItem(KEYS.session);
};
