import { store } from "../store";
import { refreshSession } from "../domains/auth/session-manager";
import { requestRaw } from "./request";
import {
  POS_STORAGE_KEY,
  clearContext as clearPosContext,
  clearPersistedPosState,
} from "../store/pos";
import { ApiError } from "./request";

const parseJson = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

const POS_ERROR_PATTERNS = [
  "pos session",
  "pos_session",
  "sesion pos",
  "sesion de pos",
];

const readStoredPosSessionId = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { posSessionId?: string | null };
    return parsed.posSessionId ?? null;
  } catch {
    return null;
  }
};

const getPosSessionId = () =>
  store.getState().pos.posSessionId ?? readStoredPosSessionId();

const isInvalidPosSessionError = (message: string) => {
  const normalized = message.trim().toLowerCase();
  return POS_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const handleInvalidPosSession = () => {
  store.dispatch(clearPosContext());
  clearPersistedPosState();

  if (typeof window === "undefined") {
    return;
  }

  const tenantId = store.getState().auth.tenantId ?? "default";
  const target = `/${tenantId}/pos/select-context`;
  if (window.location.pathname !== target) {
    window.location.assign(target);
  }
};

const buildRequestHeaders = (options?: RequestInit) => {
  const accessToken = store.getState().auth.accessToken;
  const mergedHeaders = new Headers(options?.headers);
  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (accessToken) {
    mergedHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const posSessionId = getPosSessionId();
  if (posSessionId) {
    mergedHeaders.set("x-pos-session-id", posSessionId);
    if (process.env.NEXT_PUBLIC_DEBUG_POS === "true") {
      console.log("POS SESSION:", posSessionId);
    }
  }

  return mergedHeaders;
};

const parseError = async (response: Response) => {
  let payload: any = undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
  }

  const message =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.error === "string" && payload.error) ||
    "Request failed";

  return new ApiError(message, response.status, undefined, payload);
};

export const apiClient = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const mergedHeaders = buildRequestHeaders(options);

  const response = await requestRaw(url, {
    ...options,
    credentials: "include",
    headers: mergedHeaders,
  });

  if (response.status === 401) {
    const requestError = await parseError(response);
    if (isInvalidPosSessionError(requestError.message)) {
      handleInvalidPosSession();
      throw requestError;
    }

    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      throw requestError;
    }
    const retryHeaders = buildRequestHeaders({
      ...options,
      headers: mergedHeaders,
    });
    retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
    const retryResponse = await requestRaw(url, {
      ...options,
      credentials: "include",
      headers: retryHeaders,
    });
    if (retryResponse.status === 401) {
      const retryError = await parseError(retryResponse);
      if (isInvalidPosSessionError(retryError.message)) {
        handleInvalidPosSession();
      }
      throw retryError;
    }
    if (!retryResponse.ok) {
      throw await parseError(retryResponse);
    }
    return parseJson<T>(retryResponse);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return parseJson<T>(response);
};
