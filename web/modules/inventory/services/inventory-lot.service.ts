import { apiClient } from "../../../lib/http";

export const INVENTORY_LOT_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "BLOCKED",
  "CONSUMED",
  "CANCELLED",
] as const;

export type InventoryLotStatus = (typeof INVENTORY_LOT_STATUSES)[number];

export type InventoryLotResponse = {
  id: string;
  tenantId: string;
  branchId: string;
  productId: string;
  supplierId: string | null;
  purchaseId: string | null;
  purchaseItemId: string | null;
  lotCode: string;
  expirationDate: string | null;
  receivedAt: string;
  unitCost: number;
  status: InventoryLotStatus;
  isLegacy: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryLotBalanceResponse = {
  id: string;
  tenantId: string;
  branchId: string;
  productId: string;
  lotId: string;
  locationId: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  lastMovementAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListInventoryLotsParams = {
  branchId?: string;
  productId?: string;
  supplierId?: string;
  status?: InventoryLotStatus;
  isLegacy?: boolean;
  expirationFrom?: string;
  expirationTo?: string;
  search?: string;
};

export type ListInventoryLotBalancesParams = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  locationId?: string;
  onlyAvailable?: boolean;
  onlyActiveLots?: boolean;
  expirationFrom?: string;
  expirationTo?: string;
};

export type InventoryLotDiscrepancyType =
  | "LOT_REQUIRED_MOVEMENT_WITHOUT_LOT_LINK"
  | "LOT_LINK_WITHOUT_MOVEMENT"
  | "LOT_LINK_PRODUCT_MISMATCH"
  | "LOT_LINK_TENANT_MISMATCH"
  | "LOT_BALANCE_WITHOUT_LOT"
  | "LOT_BALANCE_PRODUCT_BRANCH_MISMATCH"
  | "LOT_BALANCE_NEGATIVE_OR_RESERVED_INVALID"
  | "LOT_BALANCE_DIFFERS_FROM_MOVEMENT_LINKS"
  | "EXPIRED_ACTIVE_LOT"
  | "BLOCKED_OR_CANCELLED_LOT_WITH_AVAILABLE_BALANCE"
  | "LOT_REQUIRED_PRODUCT_WITH_NON_LOTTED_STOCK";

export type InventoryLotDiscrepancySeverity =
  | "CRITICAL"
  | "HIGH"
  | "WARNING"
  | "INFO";

export type InventoryLotReconciliationParams = {
  branchId?: string;
  productId?: string;
  lotId?: string;
  from?: string;
  to?: string;
  onlyDiscrepancies?: boolean;
  discrepancyType?: InventoryLotDiscrepancyType;
};

export type InventoryLotReconciliationSummary = {
  totalProductsChecked: number;
  totalLotsChecked: number;
  totalBalancesChecked: number;
  totalMovementsChecked: number;
  totalLinksChecked: number;
  discrepancyCount: number;
  criticalCount: number;
  highCount: number;
  warningCount: number;
  infoCount: number;
};

export type InventoryLotDiscrepancy = {
  discrepancyType: InventoryLotDiscrepancyType;
  severity: InventoryLotDiscrepancySeverity;
  tenantId: string;
  branchId: string | null;
  productId: string | null;
  lotId: string | null;
  stockMovementId: string | null;
  stockMovementLotId: string | null;
  balanceId: string | null;
  expectedQuantity: number | null;
  actualQuantity: number | null;
  quantityDelta: number | null;
  message: string;
  detectedAt: string;
};

type QueryValue = string | number | boolean | null | undefined;

const appendQueryValue = (
  query: URLSearchParams,
  key: string,
  value: QueryValue
) => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  query.set(key, String(value));
};

const buildQuery = (params: Record<string, QueryValue> = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    appendQueryValue(query, key, value);
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
};

export const listInventoryLots = (
  params: ListInventoryLotsParams = {},
  headers?: HeadersInit
) =>
  apiClient<InventoryLotResponse[]>(`/inventory/lots${buildQuery(params)}`, {
    headers,
  });

export const getInventoryLot = (lotId: string, headers?: HeadersInit) =>
  apiClient<InventoryLotResponse>(`/inventory/lots/${lotId}`, { headers });

export const listInventoryLotBalances = (
  params: ListInventoryLotBalancesParams = {},
  headers?: HeadersInit
) =>
  apiClient<InventoryLotBalanceResponse[]>(
    `/inventory/lot-balances${buildQuery(params)}`,
    { headers }
  );

export const getInventoryLotBalance = (
  balanceId: string,
  headers?: HeadersInit
) =>
  apiClient<InventoryLotBalanceResponse>(`/inventory/lot-balances/${balanceId}`, {
    headers,
  });

export const getLotReconciliationSummary = (
  params: InventoryLotReconciliationParams = {},
  headers?: HeadersInit
) =>
  apiClient<InventoryLotReconciliationSummary>(
    `/inventory/lot-reconciliation/summary${buildQuery(params)}`,
    { headers }
  );

export const getLotReconciliationDiscrepancies = (
  params: InventoryLotReconciliationParams = {},
  headers?: HeadersInit
) =>
  apiClient<InventoryLotDiscrepancy[]>(
    `/inventory/lot-reconciliation/discrepancies${buildQuery(params)}`,
    { headers }
  );
