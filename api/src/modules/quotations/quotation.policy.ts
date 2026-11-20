import { BadRequestException, ConflictException } from "@nestjs/common";

export const QUOTATION_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED", "CONVERTED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export type QuotationEffectiveStatus = QuotationStatus | "EXPIRED";
export const QUOTATION_EFFECTIVE_STATUSES: readonly QuotationEffectiveStatus[] = [
  ...QUOTATION_STATUSES,
  "EXPIRED",
];

export const QUOTATION_ACTIONS = {
  VIEW: "QUOTATIONS_VIEW",
  CREATE: "QUOTATIONS_CREATE",
  UPDATE: "QUOTATIONS_UPDATE",
  APPROVE: "QUOTATIONS_APPROVE",
  CONVERT: "QUOTATIONS_CONVERT",
  SETTINGS: "QUOTATIONS_SETTINGS",
} as const;

export const QUOTATION_TIME_ZONE = "America/Bogota";
export const DEFAULT_QUOTATION_VALIDITY_DAYS = 15;
export const MIN_QUOTATION_VALIDITY_DAYS = 1;
export const MAX_QUOTATION_VALIDITY_DAYS = 365;

const OPEN_STATUSES: readonly QuotationStatus[] = ["DRAFT", "SENT", "APPROVED"];
const EDITABLE_STATUSES: readonly QuotationStatus[] = ["DRAFT", "SENT"];

/** Fecha actual (YYYY-MM-DD) en America/Bogota. */
export const todayInBogota = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: QUOTATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const toDateOnly = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const normalized = value.slice(0, 10);
  if (!DATE_RE.test(normalized)) {
    throw new BadRequestException("Fecha invalida");
  }
  return normalized;
};

/** Suma dias calendario a una fecha YYYY-MM-DD. */
export const addDays = (date: string, days: number) => {
  const [year, month, day] = toDateOnly(date).split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
};

export const assertValidityDays = (days: unknown): number => {
  const value = Number(days);
  if (
    !Number.isInteger(value) ||
    value < MIN_QUOTATION_VALIDITY_DAYS ||
    value > MAX_QUOTATION_VALIDITY_DAYS
  ) {
    throw new BadRequestException(
      `La vigencia debe ser un numero entero entre ${MIN_QUOTATION_VALIDITY_DAYS} y ${MAX_QUOTATION_VALIDITY_DAYS} dias.`
    );
  }
  return value;
};

/** EXPIRED no se persiste: una cotizacion abierta vence al terminar su ultimo dia de vigencia. */
export const resolveEffectiveStatus = (
  status: QuotationStatus,
  validUntil: string | Date,
  today: string = todayInBogota()
): QuotationEffectiveStatus =>
  OPEN_STATUSES.includes(status) && toDateOnly(validUntil) < today ? "EXPIRED" : status;

type QuotationState = {
  status: QuotationStatus;
  validUntil: string | Date;
  convertedOrderId?: string | null;
};

const expiredMessage = "La cotizacion esta vencida. Renuevala para actualizar precios y vigencia.";

export const assertCanEdit = (quotation: QuotationState, today?: string) => {
  if (!EDITABLE_STATUSES.includes(quotation.status)) {
    throw new ConflictException("Solo se pueden editar cotizaciones en borrador o enviadas.");
  }
  if (resolveEffectiveStatus(quotation.status, quotation.validUntil, today) === "EXPIRED") {
    throw new ConflictException(expiredMessage);
  }
};

export const assertCanSend = (quotation: QuotationState, today?: string) => {
  if (quotation.status !== "DRAFT") {
    throw new ConflictException("Solo se pueden enviar cotizaciones en borrador.");
  }
  if (resolveEffectiveStatus(quotation.status, quotation.validUntil, today) === "EXPIRED") {
    throw new ConflictException(expiredMessage);
  }
};

export const assertCanApprove = (quotation: QuotationState, today?: string) => {
  if (!EDITABLE_STATUSES.includes(quotation.status)) {
    throw new ConflictException("Solo se pueden aprobar cotizaciones en borrador o enviadas.");
  }
  if (resolveEffectiveStatus(quotation.status, quotation.validUntil, today) === "EXPIRED") {
    throw new ConflictException(expiredMessage);
  }
};

export const assertCanReject = (quotation: QuotationState, reason: unknown) => {
  if (!OPEN_STATUSES.includes(quotation.status)) {
    throw new ConflictException("Solo se pueden rechazar cotizaciones abiertas.");
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    throw new BadRequestException("El motivo del rechazo es obligatorio.");
  }
  return reason.trim();
};

export const assertCanRenew = (quotation: QuotationState, today?: string) => {
  if (resolveEffectiveStatus(quotation.status, quotation.validUntil, today) !== "EXPIRED") {
    throw new ConflictException("Solo se pueden renovar cotizaciones vencidas.");
  }
};

export const assertCanConvert = (quotation: QuotationState, today?: string) => {
  if (quotation.convertedOrderId) {
    throw new ConflictException({
      message: "La cotizacion ya fue convertida en pedido.",
      orderId: quotation.convertedOrderId,
    });
  }
  if (quotation.status !== "APPROVED") {
    throw new ConflictException("Solo se pueden convertir cotizaciones aprobadas.");
  }
  if (resolveEffectiveStatus(quotation.status, quotation.validUntil, today) === "EXPIRED") {
    throw new ConflictException(expiredMessage);
  }
};
