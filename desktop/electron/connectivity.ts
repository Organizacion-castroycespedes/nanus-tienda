export type ConnectivityState = "startup" | "offline" | "reconnecting" | "restored";

const RECOVERABLE_NETWORK_ERROR_CODES = new Set([
  -105, // ERR_NAME_NOT_RESOLVED
  -106, // ERR_INTERNET_DISCONNECTED
  -118, // ERR_CONNECTION_TIMED_OUT
  -101, // ERR_CONNECTION_RESET
  -102, // ERR_CONNECTION_REFUSED
  -21,  // ERR_NETWORK_CHANGED
  -7,   // ERR_TIMED_OUT
]);

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const;

export const isRecoverableNetworkError = (errorCode: number) =>
  RECOVERABLE_NETWORK_ERROR_CODES.has(errorCode);

export const getRetryDelayMs = (attempt: number) => {
  const safeAttempt = Number.isFinite(attempt) && attempt >= 0 ? Math.floor(attempt) : 0;
  return RETRY_DELAYS_MS[Math.min(safeAttempt, RETRY_DELAYS_MS.length - 1)];
};

export const nextRetryAttempt = (attempt: number) =>
  Number.isFinite(attempt) && attempt >= 0 ? Math.floor(attempt) + 1 : 1;
