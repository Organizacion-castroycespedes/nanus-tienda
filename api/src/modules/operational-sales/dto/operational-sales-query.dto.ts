export const OPERATIONAL_SALE_SORT_FIELDS = ["createdAt", "total", "status"] as const;
const REPORT_TIME_ZONE = "America/Bogota";
export const REPORT_DATE_LIMIT_MESSAGE = "Solo puedes consultar información de los últimos 3 meses. Modifica las fechas seleccionadas para continuar";
export type OperationalSaleSortField = (typeof OPERATIONAL_SALE_SORT_FIELDS)[number];

export type OperationalSalesQueryDto = {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortDirection?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  branchId?: string;
  userId?: string;
  cashSessionId?: string;
  customerId?: string;
  documentNumber?: string;
  electronicBillingStatus?: string;
};

export type NormalizedOperationalSalesQuery = {
  page: number;
  limit: number;
  sortBy: OperationalSaleSortField;
  sortDirection: "ASC" | "DESC";
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  branchId?: string;
  userId?: string;
  cashSessionId?: string;
  customerId?: string;
  documentNumber?: string;
  electronicBillingStatus?: string;
};

const parseCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`invalid date value: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`invalid date value: ${value}`);
  }
  return date;
};

export const resolveOperationalDates = (dateFrom?: string, dateTo?: string, now = new Date()) => {
  const localNow = new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const parts = Object.fromEntries(localNow.map(({ type, value }) => [type, Number(value)])) as Record<string, number>;
  const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const minimum = new Date(Date.UTC(parts.year, parts.month - 4, Math.min(parts.day, new Date(Date.UTC(parts.year, parts.month - 3, 0)).getUTCDate())));
  const fromText = dateFrom || dateTo || `${parts.year.toString().padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const toText = dateTo || dateFrom || fromText;
  const from = parseCalendarDate(fromText);
  const to = parseCalendarDate(toText);
  if (from < minimum || to < minimum || from > today || to > today) throw new Error(REPORT_DATE_LIMIT_MESSAGE);
  if (from > to) throw new Error("dateTo must be greater than or equal to dateFrom");
  const localMidnightUtc = (date: Date) => new Date(date.getTime() + 5 * 60 * 60 * 1000).toISOString();
  const end = to.getTime() === today.getTime() ? now.toISOString() : localMidnightUtc(new Date(to.getTime() + 86_400_000));
  return { dateFrom: localMidnightUtc(from), dateTo: end };
};

export const normalizeOperationalSalesQuery = (
  query: OperationalSalesQueryDto
): NormalizedOperationalSalesQuery => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 25);
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("page must be a positive integer");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be between 1 and 100");
  }
  const sortBy = (query.sortBy ?? "createdAt") as OperationalSaleSortField;
  if (!OPERATIONAL_SALE_SORT_FIELDS.includes(sortBy)) {
    throw new Error("sortBy is invalid");
  }
  const direction = (query.sortDirection ?? "DESC").toUpperCase();
  if (direction !== "ASC" && direction !== "DESC") {
    throw new Error("sortDirection is invalid");
  }
  const optional = (value?: string) => {
    const normalized = value?.trim();
    return normalized || undefined;
  };
  const dates = resolveOperationalDates(optional(query.dateFrom), optional(query.dateTo));
  return {
    page,
    limit,
    sortBy,
    sortDirection: direction,
    dateFrom: dates.dateFrom,
    dateTo: dates.dateTo,
    status: optional(query.status),
    paymentStatus: optional(query.paymentStatus),
    paymentMethod: optional(query.paymentMethod),
    branchId: optional(query.branchId),
    userId: optional(query.userId),
    cashSessionId: optional(query.cashSessionId),
    customerId: optional(query.customerId),
    documentNumber: optional(query.documentNumber),
    electronicBillingStatus: optional(query.electronicBillingStatus),
  };
};
