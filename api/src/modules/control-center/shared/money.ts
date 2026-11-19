import { badRequest } from "./errors";

const MONEY_RE = /^\d{1,16}(\.\d{1,2})?$/;
const QUANTITY_RE = /^\d{1,10}(\.\d{1,2})?$/;
const RATE_RE = /^0(\.\d{1,4})?$/;

const toFixed2 = (value: unknown): string => {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return typeof value === "string" ? value.trim() : "";
};

/** Convierte "123.4" en centavos (12340n). La entrada ya debe estar validada. */
export const toCents = (value: string): bigint => {
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer) * 100n + BigInt((fraction + "00").slice(0, 2));
};

export const fromCents = (cents: bigint): string => {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
};

/** Monto decimal no negativo, máximo 2 decimales. Devuelve forma normalizada "850000.00". */
export const parseMoney = (value: unknown, field: string): string => {
  const raw = toFixed2(value);
  if (!MONEY_RE.test(raw)) {
    throw badRequest("CONTROL_CENTER_INVALID_AMOUNT", `${field} debe ser un monto no negativo con hasta 2 decimales`);
  }
  return fromCents(toCents(raw));
};

export const parseQuantity = (value: unknown, field: string): string => {
  const raw = toFixed2(value);
  if (!QUANTITY_RE.test(raw) || toCents(raw) <= 0n) {
    throw badRequest("CONTROL_CENTER_INVALID_QUANTITY", `${field} debe ser una cantidad positiva con hasta 2 decimales`);
  }
  return fromCents(toCents(raw));
};

/** Tasa como fracción ("0.1900" = 19%) a puntos básicos sobre 10000 (1900n). */
export const rateToBasisPoints = (rate: string | number): bigint => {
  const raw = typeof rate === "number" ? rate.toFixed(4) : String(rate).trim();
  if (!RATE_RE.test(raw)) {
    throw badRequest("CONTROL_CENTER_INVALID_TAX_RATE", "La tasa del impuesto debe ser una fracción entre 0 y 1");
  }
  const [, fraction = ""] = raw.split(".");
  return BigInt((fraction + "0000").slice(0, 4));
};

const roundDiv = (numerator: bigint, denominator: bigint) =>
  (numerator * 2n + denominator) / (denominator * 2n);

/** Redondeo a pesos enteros, mitad hacia arriba. */
export const roundToPesos = (cents: bigint): bigint => roundDiv(cents, 100n) * 100n;

/** Total de línea: cantidad × unitario − descuento, en centavos. */
export const lineTotalCents = (quantity: string, unitAmount: string, discountAmount: string): bigint => {
  const gross = roundDiv(toCents(quantity) * toCents(unitAmount), 100n);
  return gross - toCents(discountAmount);
};

export type TaxBreakdown = { baseCents: bigint; taxCents: bigint; totalCents: bigint };

/**
 * Desglose de impuesto. Con precio que incluye el impuesto:
 * base = total / (1 + rate); sin incluirlo: total = base × (1 + rate).
 */
export const taxBreakdown = (amountCents: bigint, rateBasisPoints: bigint, pricesIncludeTax: boolean): TaxBreakdown => {
  if (pricesIncludeTax) {
    const baseCents = roundToPesos(roundDiv(amountCents * 10000n, 10000n + rateBasisPoints));
    return { baseCents, taxCents: amountCents - baseCents, totalCents: amountCents };
  }
  const taxCents = roundToPesos(roundDiv(amountCents * rateBasisPoints, 10000n));
  return { baseCents: amountCents, taxCents, totalCents: amountCents + taxCents };
};
