import { badRequest } from "./errors";
import { CONTROL_CENTER_MIN_REASON_LENGTH } from "../control-center.constants";

export type Body = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const asBody = (value: unknown): Body => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("CONTROL_CENTER_INVALID_BODY", "El cuerpo de la solicitud debe ser un objeto");
  }
  return value as Body;
};

export const optionalString = (body: Body, field: string, max = 300): string | null => {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw badRequest("CONTROL_CENTER_INVALID_FIELD", `${field} debe ser texto`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw badRequest("CONTROL_CENTER_INVALID_FIELD", `${field} supera ${max} caracteres`);
  return trimmed;
};

export const requireString = (body: Body, field: string, max = 300): string => {
  const value = optionalString(body, field, max);
  if (!value) throw badRequest("CONTROL_CENTER_REQUIRED_FIELD", `${field} es obligatorio`);
  return value;
};

export const requireEnum = <T extends string>(body: Body, field: string, allowed: readonly T[]): T => {
  const value = requireString(body, field, 40).toUpperCase();
  if (!(allowed as readonly string[]).includes(value)) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", `${field} debe ser uno de: ${allowed.join(", ")}`);
  }
  return value as T;
};

export const optionalEnum = <T extends string>(body: Body, field: string, allowed: readonly T[]): T | null =>
  body[field] === undefined || body[field] === null || body[field] === "" ? null : requireEnum(body, field, allowed);

export const optionalBoolean = (body: Body, field: string): boolean | null => {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw badRequest("CONTROL_CENTER_INVALID_FIELD", `${field} debe ser verdadero o falso`);
  return value;
};

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

export const assertUuid = (value: unknown, field: string): string => {
  if (!isUuid(value)) throw badRequest("CONTROL_CENTER_INVALID_ID", `${field} no es un identificador válido`);
  return value.toLowerCase();
};

export const requireUuid = (body: Body, field: string): string => assertUuid(body[field], field);

export const optionalInteger = (body: Body, field: string, min: number, max: number): number | null => {
  const value = body[field];
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", `${field} debe ser un entero entre ${min} y ${max}`);
  }
  return number;
};

export const requireInteger = (body: Body, field: string, min: number, max: number): number => {
  const value = optionalInteger(body, field, min, max);
  if (value === null) throw badRequest("CONTROL_CENTER_REQUIRED_FIELD", `${field} es obligatorio`);
  return value;
};

export const optionalReason = (body: Body): string | null => optionalString(body, "reason", 1000);

export const requireReason = (body: Body): string => {
  const reason = optionalReason(body);
  if (!reason || reason.length < CONTROL_CENTER_MIN_REASON_LENGTH) {
    throw badRequest(
      "CONTROL_CENTER_REASON_REQUIRED",
      `La acción requiere un motivo de al menos ${CONTROL_CENTER_MIN_REASON_LENGTH} caracteres`,
    );
  }
  return reason;
};

export const parseLimit = (value: unknown, fallback = 20, max = 50) => {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", `limit debe ser un entero entre 1 y ${max}`);
  }
  return number;
};

export const parseOffset = (value: unknown) => {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100000) {
    throw badRequest("CONTROL_CENTER_INVALID_FIELD", "offset inválido");
  }
  return number;
};

export const parseSearch = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 100) : null;
};

/** Escapa comodines de LIKE para búsquedas literales. */
export const likePattern = (search: string) => `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
