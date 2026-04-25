const REFRESH_TOKEN_KEY = "smg_refresh_token";

let inMemoryRefreshToken: string | null = null;

const hasSessionStorage = () =>
  typeof window !== "undefined" && Boolean(window.sessionStorage);

const shouldPersistRefreshToken = () =>
  process.env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE === "session";

type PersistOptions = {
  persist?: boolean;
};

export const persistRefreshToken = (refreshToken: string, options?: PersistOptions) => {
  inMemoryRefreshToken = refreshToken;
  const shouldPersist = options?.persist ?? shouldPersistRefreshToken();
  if (!hasSessionStorage() || !shouldPersist) {
    return;
  }
  window.sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearRefreshToken = () => {
  inMemoryRefreshToken = null;
  if (!hasSessionStorage()) {
    return;
  }
  window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const getStoredRefreshToken = (): string | null => {
  if (inMemoryRefreshToken) {
    return inMemoryRefreshToken;
  }
  if (!hasSessionStorage()) {
    return null;
  }
  const stored = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  inMemoryRefreshToken = stored;
  return stored;
};

export const hasRefreshTokenStorage = () => shouldPersistRefreshToken();
