/**
 * Filtros de Inventario > Lotes: valores por defecto, chips de filtros
 * aplicados y precarga desde la URL
 * (change modernizar-inventario-lotes-ubicaciones, D1 y D9).
 */

export const LOT_FILTER_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "BLOCKED",
  "CONSUMED",
  "CANCELLED",
] as const;

export type LotFilterStatus = (typeof LOT_FILTER_STATUSES)[number];

export type LotFilters = {
  search: string;
  branchId: string;
  productId: string;
  status: LotFilterStatus | "";
  expirationFrom: string;
  expirationTo: string;
  locationId: string;
  onlyAvailable: boolean;
};

export type LotFilterKey = Exclude<keyof LotFilters, "search">;

export type LotFilterChip = {
  key: LotFilterKey;
  label: string;
  value: string;
};

export type LotFilterLabelResolver = {
  branch: (id: string) => string;
  product: (id: string) => string;
  location: (id: string) => string;
  status: (status: LotFilterStatus) => string;
  date: (value: string) => string;
};

export type LotScope = {
  isSuperRole: boolean;
  currentBranch: string | null | undefined;
};

export const createDefaultLotFilters = (branchId?: string | null): LotFilters => ({
  search: "",
  branchId: branchId ?? "",
  productId: "",
  status: "",
  expirationFrom: "",
  expirationTo: "",
  locationId: "",
  onlyAvailable: false,
});

/** Por defecto la sucursal es la actual para roles operativos y "Todas" para roles super. */
export const defaultBranchForScope = (scope: LotScope) =>
  scope.isSuperRole ? "" : scope.currentBranch ?? "";

/** Chips de los filtros aplicados que difieren del valor por defecto (sin la búsqueda). */
export const buildLotFilterChips = (
  applied: LotFilters,
  defaults: LotFilters,
  labels: LotFilterLabelResolver
): LotFilterChip[] => {
  const chips: LotFilterChip[] = [];
  if (applied.branchId && applied.branchId !== defaults.branchId) {
    chips.push({ key: "branchId", label: "Sucursal", value: labels.branch(applied.branchId) });
  }
  if (applied.productId) {
    chips.push({ key: "productId", label: "Producto", value: labels.product(applied.productId) });
  }
  if (applied.status) {
    chips.push({ key: "status", label: "Estado", value: labels.status(applied.status) });
  }
  if (applied.locationId) {
    chips.push({ key: "locationId", label: "Ubicación", value: labels.location(applied.locationId) });
  }
  if (applied.expirationFrom) {
    chips.push({ key: "expirationFrom", label: "Vence desde", value: labels.date(applied.expirationFrom) });
  }
  if (applied.expirationTo) {
    chips.push({ key: "expirationTo", label: "Vence hasta", value: labels.date(applied.expirationTo) });
  }
  if (applied.onlyAvailable) {
    chips.push({ key: "onlyAvailable", label: "Solo disponibles", value: "Sí" });
  }
  return chips;
};

/** Devuelve los filtros con `key` en su valor por defecto; quitar sucursal también quita ubicación. */
export const clearLotFilter = (
  filters: LotFilters,
  key: LotFilterKey,
  defaults: LotFilters
): LotFilters => {
  const next = { ...filters, [key]: defaults[key] } as LotFilters;
  if (key === "branchId") {
    next.locationId = defaults.locationId;
  }
  return next;
};

type SearchParamsLike = { get: (name: string) => string | null };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readUuid = (params: SearchParamsLike, name: string) => {
  const value = params.get(name)?.trim() ?? "";
  return UUID_PATTERN.test(value) ? value : "";
};

/**
 * Precarga filtros desde la URL. Para roles no super, una sucursal distinta
 * de la actual se ignora (y con ella la ubicación). No dispara la consulta.
 */
export const readLotFiltersFromSearchParams = (
  params: SearchParamsLike,
  scope: LotScope
): { filters: LotFilters; fromUrl: boolean } => {
  const filters = createDefaultLotFilters(defaultBranchForScope(scope));
  const branchId = readUuid(params, "branchId");
  const locationId = readUuid(params, "locationId");
  const productId = readUuid(params, "productId");
  const statusParam = params.get("status")?.trim().toUpperCase() ?? "";
  const status = (LOT_FILTER_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as LotFilterStatus)
    : "";

  const branchAllowed =
    !branchId || scope.isSuperRole || branchId === (scope.currentBranch ?? "");

  if (branchId && branchAllowed) {
    filters.branchId = branchId;
  }
  if (locationId && branchAllowed) {
    filters.locationId = locationId;
  }
  if (productId) {
    filters.productId = productId;
  }
  if (status) {
    filters.status = status;
  }

  const fromUrl = Boolean(
    (branchId && branchAllowed) || (locationId && branchAllowed) || productId || status
  );
  return { filters, fromUrl };
};
