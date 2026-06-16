import { store } from "../store";
import { refreshSession } from "../domains/auth/session-manager";
import { requestRaw } from "./request";
import {
  POS_STORAGE_KEY,
  clearContext as clearPosContext,
  clearPersistedPosState,
} from "../store/pos";
import {
  clearPersistedPosCartState,
  clearPosCartState,
} from "../store/posCart";
import { ApiError } from "./request";

export type ApiRequestOptions = RequestInit & {
  includePosSession?: boolean;
};

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
  const currentCartContextKey = store.getState().posCart.contextKey;
  store.dispatch(clearPosContext());
  store.dispatch(clearPosCartState());
  clearPersistedPosState();
  clearPersistedPosCartState(currentCartContextKey);

  if (typeof window === "undefined") {
    return;
  }

  const tenantId = store.getState().auth.tenantId ?? "default";
  const target = `/${tenantId}/pos/select-context`;
  if (window.location.pathname !== target) {
    window.location.assign(target);
  }
};

const buildRequestHeaders = (
  options?: RequestInit,
  includePosSession = false
) => {
  const accessToken = store.getState().auth.accessToken;
  const mergedHeaders = new Headers(options?.headers);
  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (accessToken) {
    mergedHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const posSessionId = includePosSession ? getPosSessionId() : null;
  if (posSessionId) {
    mergedHeaders.set("x-pos-session-id", posSessionId);
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

const sendAuthorizedRequest = async (
  url: string,
  options?: ApiRequestOptions,
  customBaseUrl?: string
): Promise<Response> => {
  const { includePosSession = false, ...requestOptions } = options ?? {};
  const mergedHeaders = buildRequestHeaders(requestOptions, includePosSession);

  const response = await requestRaw(
    url,
    {
      ...requestOptions,
      credentials: "include",
      headers: mergedHeaders,
    },
    customBaseUrl
  );

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
    const retryHeaders = buildRequestHeaders(
      {
        ...requestOptions,
        headers: mergedHeaders,
      },
      includePosSession
    );
    retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
    const retryResponse = await requestRaw(
      url,
      {
        ...requestOptions,
        credentials: "include",
        headers: retryHeaders,
      },
      customBaseUrl
    );
    if (retryResponse.status === 401) {
      const retryError = await parseError(retryResponse);
      if (isInvalidPosSessionError(retryError.message)) {
        handleInvalidPosSession();
      }
      throw retryError;
    }
    return retryResponse;
  }

  return response;
};

export const apiClient = async <T>(
  url: string,
  options?: ApiRequestOptions
): Promise<T> => {
  const response = await sendAuthorizedRequest(url, options);

  if (!response.ok) {
    throw await parseError(response);
  }

  return parseJson<T>(response);
};

export const apiBlobClient = async (
  url: string,
  options?: ApiRequestOptions
): Promise<Blob> => {
  const response = await sendAuthorizedRequest(url, options);

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.blob();
};

export const apiClientWithBaseUrl = async <T>(
  baseUrl: string | undefined,
  url: string,
  options?: ApiRequestOptions
): Promise<T> => {
  const response = await sendAuthorizedRequest(url, options, baseUrl);

  if (!response.ok) {
    throw await parseError(response);
  }

  return parseJson<T>(response);
};

export const apiBlobClientWithBaseUrl = async (
  baseUrl: string | undefined,
  url: string,
  options?: ApiRequestOptions
): Promise<Blob> => {
  const response = await sendAuthorizedRequest(url, options, baseUrl);

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.blob();
};
