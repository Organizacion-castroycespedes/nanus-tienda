import { addDays, addMonthsClamped, parseIsoDate, todayInBogota } from "../shared/dates";
import { badRequest } from "../shared/errors";

const MONTH_RE = /^(\d{4})-(\d{2})$/;

export const parseMonth = (value: unknown, field: string): string => {
  const match = typeof value === "string" ? MONTH_RE.exec(value.trim()) : null;
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[1]) < 2000 || Number(match[1]) > 2100) {
    throw badRequest("CONTROL_CENTER_INVALID_MONTH", `${field} debe tener formato AAAA-MM`);
  }
  return `${match[1]}-${match[2]}`;
};

/** Meses de `from` a `to`, ambos incluidos. */
export const monthsBetween = (from: string, to: string): string[] => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months: string[] = [];
  for (let index = fy * 12 + fm - 1; index <= ty * 12 + tm - 1; index += 1) {
    months.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
  }
  return months;
};

export const firstDayOf = (month: string) => `${month}-01`;
export const lastDayOf = (month: string) => addDays(addMonthsClamped(`${month}-01`, 1), -1);

/** Rango de meses del reporte: por defecto los 12 meses hasta el actual; máximo 24. */
export const parseMonthRange = (query: Record<string, unknown>, today = todayInBogota(), max = 24) => {
  const to = query.to ? parseMonth(query.to, "to") : today.slice(0, 7);
  const from = query.from ? parseMonth(query.from, "from") : monthsBetween("2000-01", to).slice(-12)[0];
  if (from > to) throw badRequest("CONTROL_CENTER_INVALID_RANGE", "El mes inicial no puede ser posterior al final");
  const months = monthsBetween(from, to);
  if (months.length > max) throw badRequest("CONTROL_CENTER_INVALID_RANGE", `El rango no puede superar ${max} meses`);
  return { from, to, months, fromDate: firstDayOf(from), toDate: lastDayOf(to) };
};

/** Rango de fechas del estado de cuenta: por defecto los últimos 12 meses hasta hoy; máximo 36 meses. */
export const parseDateRange = (query: Record<string, unknown>, today = todayInBogota()) => {
  const to = query.to ? parseIsoDate(query.to, "to") : today;
  const from = query.from ? parseIsoDate(query.from, "from") : addDays(addMonthsClamped(to, -12), 1);
  if (from > to) throw badRequest("CONTROL_CENTER_INVALID_RANGE", "La fecha inicial no puede ser posterior a la final");
  if (addMonthsClamped(from, 36) < to) throw badRequest("CONTROL_CENTER_INVALID_RANGE", "El rango no puede superar 36 meses");
  return { from, to };
};

export const formatMonthLabel = (month: string) => {
  const names = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${names[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
};
