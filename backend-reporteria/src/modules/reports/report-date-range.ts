import { BadRequestException } from "@nestjs/common";

export const REPORT_TIME_ZONE = "America/Bogota";
export const REPORT_DATE_LIMIT_MESSAGE =
  "Solo puedes consultar información de los últimos 3 meses. Modifica las fechas seleccionadas para continuar";

export const formatReportDateTime = (value: string | Date | null | undefined) => {
  if (!value) return "-";
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(instant) + ` [${REPORT_TIME_ZONE}]`;
};

type DateParts = { year: number; month: number; day: number };

export type ReportDateRange = {
  dateFrom: string;
  dateTo: string;
  requestedFrom: string;
  requestedTo: string;
  timeZone: string;
  generatedAt: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getParts = (instant: Date): DateParts => {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(instant).map(({ type, value }) => [type, Number(value)]),
  ) as Record<string, number>;
  return { year: parts.year, month: parts.month, day: parts.day };
};

const formatDate = ({ year, month, day }: DateParts) =>
  `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

const parseDate = (value: string): DateParts => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`invalid date value: ${value}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new BadRequestException(`invalid date value: ${value}`);
  }
  return { year, month, day };
};

const getOffsetMinutes = (instant: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(instant);
  const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
};

const localMidnightToUtc = (parts: DateParts) => {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  const firstGuess = new Date(localAsUtc);
  const offset = getOffsetMinutes(firstGuess);
  return new Date(localAsUtc - offset * 60_000).toISOString();
};

const addDays = (parts: DateParts, days: number): DateParts => {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  value.setUTCDate(value.getUTCDate() + days);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
};

const subtractMonths = (parts: DateParts, months: number): DateParts => {
  const targetMonth = parts.month - months;
  const firstOfTarget = new Date(Date.UTC(parts.year, targetMonth - 1, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  return { year: firstOfTarget.getUTCFullYear(), month: firstOfTarget.getUTCMonth() + 1, day: Math.min(parts.day, lastDay) };
};

export const resolveReportDateRange = (
  input: { dateFrom?: string; dateTo?: string },
  now = new Date(),
): ReportDateRange => {
  if (Number.isNaN(now.getTime())) throw new BadRequestException("invalid report clock");
  const today = getParts(now);
  const minimum = subtractMonths(today, 3);
  const requestedFrom = input.dateFrom?.trim() || input.dateTo?.trim() || formatDate(today);
  const requestedTo = input.dateTo?.trim() || input.dateFrom?.trim() || formatDate(today);
  const from = parseDate(requestedFrom);
  const to = parseDate(requestedTo);
  const minValue = Date.UTC(minimum.year, minimum.month - 1, minimum.day);
  const todayValue = Date.UTC(today.year, today.month - 1, today.day);
  const fromValue = Date.UTC(from.year, from.month - 1, from.day);
  const toValue = Date.UTC(to.year, to.month - 1, to.day);
  if (fromValue < minValue || toValue < minValue || fromValue > todayValue || toValue > todayValue) {
    throw new BadRequestException(REPORT_DATE_LIMIT_MESSAGE);
  }
  if (fromValue > toValue) {
    throw new BadRequestException("dateTo must be greater than or equal to dateFrom");
  }
  const end = toValue === todayValue ? now.toISOString() : localMidnightToUtc(addDays(to, 1));
  return {
    dateFrom: localMidnightToUtc(from),
    dateTo: end,
    requestedFrom,
    requestedTo,
    timeZone: REPORT_TIME_ZONE,
    generatedAt: now.toISOString(),
  };
};
