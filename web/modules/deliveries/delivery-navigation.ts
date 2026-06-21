import { DELIVERY_STATUSES, type DeliveryStatus } from "./types";

export type DeliveryFilters = {
  query: string;
  status: "" | DeliveryStatus;
  orderId: string;
  saleId: string;
  dateFrom: string;
  dateTo: string;
};

export type DeliveryRelationSourceType = "order" | "sale";

export type DeliverySearchParamsInput =
  | Record<string, string | string[] | undefined>
  | {
      get: (key: string) => string | null;
    };

export const defaultDeliveryFilters: DeliveryFilters = {
  query: "",
  status: "",
  orderId: "",
  saleId: "",
  dateFrom: "",
  dateTo: "",
};

const readSearchParam = (
  params: DeliverySearchParamsInput | undefined,
  key: string
) => {
  if (!params) {
    return "";
  }

  if (typeof (params as { get?: unknown }).get === "function") {
    return ((params as { get: (name: string) => string | null }).get(key) ?? "").trim();
  }

  const value = (params as Record<string, string | string[] | undefined>)[key];
  if (Array.isArray(value)) {
    return (value[0] ?? "").trim();
  }

  return (value ?? "").trim();
};

const normalizeStatus = (value: string): "" | DeliveryStatus => {
  const candidate = value.toUpperCase();
  return DELIVERY_STATUSES.includes(candidate as DeliveryStatus)
    ? (candidate as DeliveryStatus)
    : "";
};

export const buildDeliveryFiltersFromSearchParams = (
  params?: DeliverySearchParamsInput
): DeliveryFilters => ({
  ...defaultDeliveryFilters,
  status: normalizeStatus(readSearchParam(params, "status")),
  orderId: readSearchParam(params, "order_id"),
  saleId: readSearchParam(params, "sale_id"),
  dateFrom: readSearchParam(params, "date_from"),
  dateTo: readSearchParam(params, "date_to"),
});

export const serializeDeliveryFilters = (filters: DeliveryFilters) =>
  [
    filters.query,
    filters.status,
    filters.orderId,
    filters.saleId,
    filters.dateFrom,
    filters.dateTo,
  ].join("|");

export const buildDeliveryModuleHref = (
  tenantId: string,
  relation: {
    sourceType: DeliveryRelationSourceType;
    sourceId: string;
  }
) => {
  const tenantSegment = encodeURIComponent(tenantId.trim() || "default");
  const query = new URLSearchParams();
  const sourceId = relation.sourceId.trim();

  if (relation.sourceType === "order") {
    query.set("order_id", sourceId);
  } else {
    query.set("sale_id", sourceId);
  }

  return `/${tenantSegment}/deliveries?${query.toString()}`;
};
