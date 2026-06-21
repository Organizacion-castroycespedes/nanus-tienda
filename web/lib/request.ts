const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const buildUrl = (url: string, customBaseUrl?: string) => {
  const resolvedBaseUrl = customBaseUrl?.replace(/\/$/, "") ?? baseUrl;
  if (!resolvedBaseUrl) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${resolvedBaseUrl}${url}`;
  }
  return `${resolvedBaseUrl}/${url}`;
};

const isFormDataBody = (body?: BodyInit | null) =>
  typeof FormData !== "undefined" && body instanceof FormData;

const mergeHeaders = (headers?: HeadersInit, body?: BodyInit | null) => {
  const mergedHeaders = new Headers(
    isFormDataBody(body) ? undefined : { "Content-Type": "application/json" }
  );
  if (headers) {
    const incoming = new Headers(headers);
    incoming.forEach((value, key) => mergedHeaders.set(key, value));
  }
  return mergedHeaders;
};

export const requestRaw = async (
  url: string,
  options?: RequestInit,
  customBaseUrl?: string
) => {
  const headers = mergeHeaders(options?.headers, options?.body);
  return fetch(buildUrl(url, customBaseUrl), {
    ...options,
    headers,
  });
};

export const requestJson = async <T>(
  url: string,
  options?: RequestInit,
  customBaseUrl?: string
): Promise<T> => {
  const response = await requestRaw(url, options, customBaseUrl);
  if (!response.ok) {
    let payload: any = undefined;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }
    }
    const derivedMessage =
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      "Request failed";
    const derivedCode =
      (typeof payload?.code === "string" && payload.code) ||
      (typeof payload?.message?.code === "string" && payload.message.code) ||
      undefined;
    throw new ApiError(derivedMessage, response.status, derivedCode, payload);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }
  return (await response.json()) as T;
};
