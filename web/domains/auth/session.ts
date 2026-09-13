const REFRESH_TOKEN_KEY = "smg_refresh_token";

let inMemoryRefreshToken: string | null = null;

const hasBrowserStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage);

const shouldPersistRefreshToken = () =>
  process.env.NEXT_PUBLIC_REFRESH_TOKEN_STORAGE !== "none";

type PersistOptions = {
  persist?: boolean;
};

const migrateLegacySessionStorageToken = (): string | null => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  try {
    const legacy = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!legacy) {
      return null;
    }
    if (shouldPersistRefreshToken()) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, legacy);
    }
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    return legacy;
  } catch {
    return null;
  }
};

export const persistRefreshToken = (refreshToken: string, options?: PersistOptions) => {
  inMemoryRefreshToken = refreshToken;
  const shouldPersist = options?.persist ?? shouldPersistRefreshToken();
  if (!hasBrowserStorage()) {
    return;
  }
  if (!shouldPersist) {
    // Avoid leaving a prior "Recordarme" token on disk when persistence is off.
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    try {
      window.sessionStorage?.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // ignore
    }
    return;
  }
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearRefreshToken = () => {
  inMemoryRefreshToken = null;
  if (!hasBrowserStorage()) {
    return;
  }
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  try {
    window.sessionStorage?.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore
  }
};

export const getStoredRefreshToken = (): string | null => {
  if (inMemoryRefreshToken) {
    return inMemoryRefreshToken;
  }
  if (!hasBrowserStorage()) {
    return null;
  }
  let stored = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!stored) {
    stored = migrateLegacySessionStorageToken();
  }
  inMemoryRefreshToken = stored;
  return stored;
};

/** True when a refresh token is already written to localStorage (Recordarme was ON). */
export const hasPersistedRefreshToken = (): boolean => {
  if (!hasBrowserStorage() || !shouldPersistRefreshToken()) {
    return false;
  }
  return Boolean(window.localStorage.getItem(REFRESH_TOKEN_KEY));
};

export const hasRefreshTokenStorage = () => shouldPersistRefreshToken();
