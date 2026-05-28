import { ApiError } from "./request";
import type { NoticeDialogVariant } from "../components/design-system/NoticeDialog";

export type ApiNoticeMessage = {
  title: string;
  message: string;
  variant: NoticeDialogVariant;
};

type ApiMessageInput = {
  status?: number;
  statusCode?: number;
  message?: unknown;
  error?: unknown;
  response?: {
    status?: number;
    data?: unknown;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeMessage = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => normalizeMessage(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join("\n") : null;
  }

  if (isRecord(value)) {
    return (
      normalizeMessage(value.message) ??
      normalizeMessage(value.error) ??
      normalizeMessage(value.detail)
    );
  }

  return null;
};

const getStatus = (input: unknown): number | undefined => {
  if (input instanceof ApiError) {
    return input.status;
  }

  if (!isRecord(input)) {
    return undefined;
  }

  const candidate = input as ApiMessageInput;
  const responseData = isRecord(candidate.response?.data)
    ? (candidate.response.data as ApiMessageInput)
    : undefined;
  const status =
    candidate.status ??
    candidate.statusCode ??
    candidate.response?.status ??
    responseData?.status ??
    responseData?.statusCode;

  return typeof status === "number" ? status : undefined;
};

const getMessage = (input: unknown, fallback: string): string => {
  if (input instanceof ApiError) {
    return normalizeMessage(input.details) ?? input.message ?? fallback;
  }

  if (input instanceof Error) {
    return input.message || fallback;
  }

  if (!isRecord(input)) {
    return fallback;
  }

  const candidate = input as ApiMessageInput;
  return (
    normalizeMessage(candidate.response?.data) ??
    normalizeMessage(candidate.message) ??
    normalizeMessage(candidate.error) ??
    fallback
  );
};

export const getNoticeVariantFromStatus = (status?: number): NoticeDialogVariant => {
  if (!status) {
    return "error";
  }
  if (status >= 200 && status < 300) {
    return "success";
  }
  if (status === 400 || status === 404 || status === 409) {
    return "warning";
  }
  if (status === 401 || status === 403 || status >= 500) {
    return "error";
  }
  return status >= 400 ? "error" : "info";
};

export const getNoticeTitleFromVariant = (variant: NoticeDialogVariant) => {
  if (variant === "success") {
    return "Operacion exitosa";
  }
  if (variant === "warning") {
    return "Validacion de negocio";
  }
  if (variant === "error") {
    return "No se pudo completar la accion";
  }
  return "Informacion";
};

export const buildNoticeFromApiResponse = (
  response: unknown,
  fallbackMessage: string,
  fallbackTitle?: string
): ApiNoticeMessage => {
  const status = getStatus(response) ?? 200;
  const variant = getNoticeVariantFromStatus(status);
  return {
    title: fallbackTitle ?? getNoticeTitleFromVariant(variant),
    message: getMessage(response, fallbackMessage),
    variant,
  };
};

export const buildNoticeFromApiError = (
  error: unknown,
  fallbackMessage: string,
  fallbackTitle?: string
): ApiNoticeMessage => {
  const status = getStatus(error);
  const variant = getNoticeVariantFromStatus(status);
  return {
    title: fallbackTitle ?? getNoticeTitleFromVariant(variant),
    message: getMessage(error, fallbackMessage),
    variant,
  };
};
