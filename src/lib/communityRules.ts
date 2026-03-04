export const normalizeAlias = (alias: string): string =>
  alias
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const normalizeInviteCode = (code: string): string => code.trim().toUpperCase();

export const canAdminLeaveCommunity = (adminCount: number): boolean => adminCount > 1;
