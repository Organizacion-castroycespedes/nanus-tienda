export type TokenPayload = {
  sub?: string;
  tenant_id?: string;
  roles?: string[];
  session_id?: string;
  exp?: number;
};

export const decodeTokenPayload = (token: string): TokenPayload | null => {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
};

export const getTokenExpiry = (token: string): number | null => {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) {
    return null;
  }
  return payload.exp * 1000;
};
