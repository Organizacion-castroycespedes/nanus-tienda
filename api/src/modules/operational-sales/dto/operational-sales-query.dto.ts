export const OPERATIONAL_SALE_SORT_FIELDS = ["createdAt", "total", "status"] as const;
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
  return {
    page,
    limit,
    sortBy,
    sortDirection: direction,
    dateFrom: optional(query.dateFrom),
    dateTo: optional(query.dateTo),
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
