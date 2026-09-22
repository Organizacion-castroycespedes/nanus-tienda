export type InventoryStockStatus =
  | "all"
  | "in_stock"
  | "out_of_stock"
  | "negative";

export type InventoryBiFilters = {
  requestedTenantId: string;
  requestedBranchId: string;
  productIds: string[];
  categoryId: string;
  stockStatus: InventoryStockStatus;
  terminalId: string;
  cashSessionId: string;
  startDate: string;
  endDate: string;
};

type InventoryBiFilterDefaults = Pick<
  InventoryBiFilters,
  "requestedTenantId" | "requestedBranchId" | "startDate" | "endDate"
>;

export const createInventoryBiFilters = (
  defaults: InventoryBiFilterDefaults
): InventoryBiFilters => ({
  ...defaults,
  productIds: [],
  categoryId: "",
  stockStatus: "all",
  terminalId: "",
  cashSessionId: "",
});

export const resetInventoryBiFilters = (
  defaults: InventoryBiFilterDefaults
) => createInventoryBiFilters(defaults);

export const selectInventoryTenant = (
  filters: InventoryBiFilters,
  requestedTenantId: string
): InventoryBiFilters => ({
  ...filters,
  requestedTenantId,
  requestedBranchId: "",
  productIds: [],
  categoryId: "",
  terminalId: "",
  cashSessionId: "",
});

export const selectInventoryBranch = (
  filters: InventoryBiFilters,
  requestedBranchId: string
): InventoryBiFilters => ({
  ...filters,
  requestedBranchId,
  productIds: [],
  terminalId: "",
  cashSessionId: "",
});

export const toggleInventoryProduct = (
  filters: InventoryBiFilters,
  productId: string
): InventoryBiFilters => ({
  ...filters,
  productIds: filters.productIds.includes(productId)
    ? filters.productIds.filter((id) => id !== productId)
    : [...filters.productIds, productId],
});

export const removeInventoryProduct = (
  filters: InventoryBiFilters,
  productId: string
): InventoryBiFilters => ({
  ...filters,
  productIds: filters.productIds.filter((id) => id !== productId),
});
