import { badRequest } from "./errors";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (n: number, size = 2) => String(n).padStart(size, "0");

const format = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

export const parseIsoDate = (value: unknown, field: string): string => {
  const match = typeof value === "string" ? DATE_RE.exec(value.trim()) : null;
  if (!match) throw badRequest("CONTROL_CENTER_INVALID_DATE", `${field} debe tener formato AAAA-MM-DD`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw badRequest("CONTROL_CENTER_INVALID_DATE", `${field} no es una fecha válida`);
  }
  return format(year, month, day);
};

const split = (date: string) => date.split("-").map(Number) as [number, number, number];

export const dayOfMonth = (date: string) => split(date)[2];

/** Suma meses; si el mes destino no tiene ese día, usa el último día del mes. */
export const addMonthsClamped = (date: string, months: number): string => {
  const [year, month, day] = split(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return format(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
};

export const addDays = (date: string, days: number): string => {
  const [year, month, day] = split(date);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return format(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
};

/** Fecha de hoy en America/Bogota (UTC-5, sin horario de verano). */
export const todayInBogota = (now: Date = new Date()): string => {
  const shifted = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return format(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
};

/**
 * Suma meses al año y mes de `date` y fija el día ancla; si el mes destino no
 * tiene ese día, usa el último. Evita que el corte se corra después de febrero.
 */
export const anchoredAddMonths = (date: string, months: number, anchorDay: number): string => {
  const [year, month] = split(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return format(targetYear, targetMonth, Math.min(anchorDay, daysInMonth(targetYear, targetMonth)));
};

const toUtc = (date: string) => {
  const [year, month, day] = split(date);
  return Date.UTC(year, month - 1, day);
};

/** Días calendario entre dos fechas, ambos extremos incluidos. */
export const daysInclusive = (from: string, to: string): number =>
  Math.round((toUtc(to) - toUtc(from)) / 86_400_000) + 1;

export const maxDate = (a: string, b: string) => (a > b ? a : b);
export const minDate = (a: string, b: string) => (a < b ? a : b);
