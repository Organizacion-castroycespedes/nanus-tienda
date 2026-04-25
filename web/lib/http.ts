import { store } from "../store";
import { refreshSession } from "../domains/auth/session-manager";
import { requestRaw } from "./request";

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

export const apiClient = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const accessToken = store.getState().auth.accessToken;
  const mergedHeaders = new Headers(options?.headers);
  if (!mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  if (accessToken) {
    mergedHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await requestRaw(url, {
    ...options,
    credentials: "include",
    headers: mergedHeaders,
  });

  if (response.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      throw new Error("Unauthorized");
    }
    const retryHeaders = new Headers(mergedHeaders);
    retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
    const retryResponse = await requestRaw(url, {
      ...options,
      credentials: "include",
      headers: retryHeaders,
    });
    if (!retryResponse.ok) {
      throw new Error("Request failed");
    }
    return parseJson<T>(retryResponse);
  }

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return parseJson<T>(response);
};
