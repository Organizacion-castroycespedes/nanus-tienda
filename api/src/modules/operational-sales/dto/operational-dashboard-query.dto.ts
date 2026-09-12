export type OperationalDashboardPeriod = "TODAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "CUSTOM";
export type OperationalDashboardQueryDto = { period?: string; dateFrom?: string; dateTo?: string; branchId?: string };
export type NormalizedOperationalDashboardQuery = { dateFrom: string; dateTo: string; branchId?: string; period: OperationalDashboardPeriod };
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export const normalizeOperationalDashboardQuery = (query: OperationalDashboardQueryDto, today = new Date()): NormalizedOperationalDashboardQuery => {
  const period = (query.period?.trim().toUpperCase() || "TODAY") as OperationalDashboardPeriod;
  if (!["TODAY", "LAST_7_DAYS", "LAST_30_DAYS", "CUSTOM"].includes(period)) throw new Error("period is invalid");
  const end = isoDate(today); const start = new Date(today);
  if (period === "LAST_7_DAYS") start.setUTCDate(start.getUTCDate() - 6);
  if (period === "LAST_30_DAYS") start.setUTCDate(start.getUTCDate() - 29);
  const dateFrom = period === "CUSTOM" ? query.dateFrom?.trim() : isoDate(start);
  const dateTo = period === "CUSTOM" ? query.dateTo?.trim() : end;
  if (!dateFrom || !dateTo || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || dateFrom > dateTo) throw new Error("dateFrom and dateTo are invalid");
  const branchId = query.branchId?.trim() || undefined;
  return branchId ? { period, dateFrom, dateTo, branchId } : { period, dateFrom, dateTo };
};
