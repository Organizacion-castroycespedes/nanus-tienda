"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { Eye, RefreshCw, Search, X } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { ReportSummary } from "../../../../components/design-system/ReportSummary";
import { Select } from "../../../../components/design-system/Select";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "../../../../components/design-system/SearchableSelect";
import { listBranches } from "../../../../domains/branches/api";
import type { BranchResponse } from "../../../../domains/branches/dtos";
import { listProducts } from "../../../../domains/products/api";
import { useInventoryScope } from "../../../../hooks/useInventoryScope";
import { InventoryLotDetailModal } from "../../../../modules/inventory/components/InventoryLotDetailModal";
import type { InventoryLotDetailRow } from "../../../../modules/inventory/components/InventoryLotDetailModal";
import { CollapsibleFilterPanel } from "../../../../modules/inventory/list-filters/CollapsibleFilterPanel";
import {
  buildLotFilterChips,
  clearLotFilter,
  createDefaultLotFilters,
  defaultBranchForScope,
  readLotFiltersFromSearchParams,
  type LotFilterKey,
  type LotFilters,
} from "../../../../modules/inventory/lots/lot-filters";
import {
  computeLotMetrics,
  daysUntil,
  EXPIRING_WINDOW_DAYS,
  isLotSellable,
} from "../../../../modules/inventory/lots/lot-metrics";
import {
  collectMissingProductIds,
  matchesLotSearch,
  resolveProductIdentity,
  runWithConcurrency,
  type CatalogProduct,
} from "../../../../modules/inventory/lots/product-identity";
import {
  listInventoryLocations,
  type InventoryLocationResponse,
} from "../../../../modules/inventory/services/inventory-location.service";
import {
  getLotReconciliationDiscrepancies,
  getLotReconciliationSummary,
  INVENTORY_LOT_STATUSES,
  listInventoryLotBalances,
  listInventoryLots,
  type InventoryLotBalanceResponse,
  type InventoryLotDiscrepancy,
  type InventoryLotReconciliationSummary,
  type InventoryLotResponse,
  type InventoryLotStatus,
} from "../../../../modules/inventory/services/inventory-lot.service";
import { getProduct } from "../../../../modules/inventory/services/product.service";
import { getSuppliers } from "../../../../modules/inventory/services/supplier.service";

type BranchOption = {
  id: string;
  name: string;
};

type LotRow = {
  key: string;
  lot: InventoryLotResponse;
  balance: InventoryLotBalanceResponse | null;
};

const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

const pageSizeOptions = [10, 25, 50];
const PRODUCT_LOOKUP_CONCURRENCY = 4;
const UNKNOWN_BRANCH = "Sucursal no disponible";
const UNKNOWN_LOCATION = "Ubicación no disponible";
const NO_LOCATION = "Sin ubicación";

const statusLabels: Record<InventoryLotStatus, string> = {
  ACTIVE: "Activo",
  EXPIRED: "Vencido",
  BLOCKED: "Bloqueado",
  CONSUMED: "Consumido",
  CANCELLED: "Cancelado",
};

const statusStyles: Record<InventoryLotStatus, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  EXPIRED: "border-rose-200 bg-rose-50 text-rose-700",
  BLOCKED: "border-amber-200 bg-amber-50 text-amber-700",
  CONSUMED: "border-slate-200 bg-slate-100 text-slate-700",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-700",
};

const severityStyles = {
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  WARNING: "border-yellow-200 bg-yellow-50 text-yellow-700",
  INFO: "border-blue-200 bg-blue-50 text-blue-700",
};

const badgeBase = "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold";

const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
};

const getExpirationBadge = (expirationDate: string | null) => {
  const days = daysUntil(expirationDate);

  if (days === null) {
    return {
      days,
      label: "Sin vencimiento",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  if (days < 0) {
    return {
      days,
      label: "Vencido",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (days <= EXPIRING_WINDOW_DAYS) {
    return {
      days,
      label: "Próximo a vencer",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    days,
    label: "Vigente",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
};

const mapBranch = (branch: BranchResponse): BranchOption => ({
  id: branch.id,
  name: branch.nombre,
});

const InventoryLotsPage = () => {
  const { currentTenant, currentBranch, isSuperRole } = useInventoryScope();
  const searchParams = useSearchParams();

  const scope = useMemo(
    () => ({ isSuperRole, currentBranch }),
    [currentBranch, isSuperRole]
  );
  const defaultFilters = useMemo(
    () => createDefaultLotFilters(defaultBranchForScope(scope)),
    [scope]
  );

  const [lots, setLots] = useState<InventoryLotResponse[]>([]);
  const [balances, setBalances] = useState<InventoryLotBalanceResponse[]>([]);
  const [catalog, setCatalog] = useState<Map<string, CatalogProduct>>(new Map());
  const [productOptions, setProductOptions] = useState<SearchableSelectOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [supplierNames, setSupplierNames] = useState<Map<string, string>>(new Map());
  const [summary, setSummary] = useState<InventoryLotReconciliationSummary | null>(null);
  const [discrepancies, setDiscrepancies] = useState<InventoryLotDiscrepancy[]>([]);
  const [reconciliationFailed, setReconciliationFailed] = useState(false);
  const [selectedRow, setSelectedRow] = useState<InventoryLotDetailRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [draftFilters, setDraftFilters] = useState<LotFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<LotFilters>(defaultFilters);
  const [preloadedFromUrl, setPreloadedFromUrl] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lookupWarnings, setLookupWarnings] = useState<string[]>([]);
  const attemptedProductIds = useRef(new Set<string>());
  const urlApplied = useRef(false);

  // Precarga desde la URL (D9): solo llena filtros; la consulta exige "Buscar" (D2).
  useEffect(() => {
    if (urlApplied.current || (!isSuperRole && !currentBranch)) {
      return;
    }
    urlApplied.current = true;
    const { filters, fromUrl } = readLotFiltersFromSearchParams(searchParams, scope);
    setDraftFilters(filters);
    setAppliedFilters(filters);
    setPreloadedFromUrl(fromUrl);
  }, [currentBranch, isSuperRole, scope, searchParams]);

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((branch) => map.set(branch.id, branch.name));
    return map;
  }, [branches]);

  const locationById = useMemo(() => {
    const map = new Map<string, InventoryLocationResponse>();
    locations.forEach((location) => map.set(location.id, location));
    return map;
  }, [locations]);

  const describeLocation = useCallback(
    (locationId: string | null | undefined) => {
      if (!locationId) {
        return NO_LOCATION;
      }
      const location = locationById.get(locationId);
      if (!location) {
        return UNKNOWN_LOCATION;
      }
      const label = `${location.code} - ${location.name}`;
      return location.isActive ? label : `${label} (inactiva)`;
    },
    [locationById]
  );

  const describeBranch = useCallback(
    (branchId: string) => branchNameById.get(branchId) ?? UNKNOWN_BRANCH,
    [branchNameById]
  );

  const lookupBranchId = useCallback(
    (filters: LotFilters) =>
      isSuperRole ? filters.branchId || undefined : currentBranch ?? undefined,
    [currentBranch, isSuperRole]
  );

  const loadLocationsLookup = useCallback(async (branchId?: string) => {
    const result = await listInventoryLocations({ branchId });
    setLocations(uniqueById(result));
  }, []);

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    const warnings: string[] = [];

    const [branchResult, supplierResult] = await Promise.allSettled([
      listBranches({ tenantId: currentTenant ?? undefined }),
      getSuppliers(),
    ]);

    let branchOptions: BranchOption[] = [];
    if (branchResult.status === "fulfilled") {
      branchOptions = uniqueById(branchResult.value.map(mapBranch));
    } else {
      warnings.push("No se pudieron cargar las sucursales.");
    }
    if (currentBranch && !branchOptions.some((branch) => branch.id === currentBranch)) {
      branchOptions.unshift({ id: currentBranch, name: "Sucursal actual" });
    }
    setBranches(branchOptions);

    if (supplierResult.status === "fulfilled") {
      setSupplierNames(new Map(supplierResult.value.map((supplier) => [supplier.id, supplier.name])));
    }

    // El catálogo se pide con una sucursal válida: el backend la exige y devuelve
    // todos los productos del tenant (la sucursal solo afecta el stock calculado).
    const catalogBranch = currentBranch ?? branchOptions[0]?.id;
    const [productResult, locationResult] = await Promise.allSettled([
      catalogBranch
        ? listProducts({ tenantId: currentTenant ?? undefined, branchId: catalogBranch })
        : Promise.reject(new Error("branch unavailable")),
      loadLocationsLookup(isSuperRole ? undefined : currentBranch ?? undefined),
    ]);

    if (productResult.status === "fulfilled") {
      const products = uniqueById(productResult.value);
      setCatalog((previous) => {
        const next = new Map(previous);
        products.forEach((product) => next.set(product.id, { name: product.name, sku: product.sku }));
        return next;
      });
      setProductOptions(
        products
          .map((product) => ({
            value: product.id,
            label: product.name,
            description: product.sku || null,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, "es"))
      );
    } else {
      warnings.push(
        "No se pudo cargar el catálogo de productos; el filtro Producto queda vacío y los nombres se toman de los lotes."
      );
    }
    if (locationResult.status === "rejected") {
      warnings.push("No se pudieron cargar las ubicaciones; se mostrarán como no disponibles.");
    }

    setLookupWarnings(warnings);
    setLoadingLookups(false);
  }, [currentBranch, currentTenant, isSuperRole, loadLocationsLookup]);

  useEffect(() => {
    if (!isSuperRole && !currentBranch) {
      return;
    }
    void loadLookups();
  }, [currentBranch, isSuperRole, loadLookups]);

  const resolveMissingProducts = useCallback(
    async (nextLots: InventoryLotResponse[], nextBalances: InventoryLotBalanceResponse[]) => {
      const sources = [
        ...nextLots.map((lot) => ({ productId: lot.productId, productName: lot.productName })),
        ...nextBalances.map((balance) => ({
          productId: balance.productId,
          productName: balance.productName,
        })),
      ];
      const missing = collectMissingProductIds(sources, catalog).filter(
        (productId) => !attemptedProductIds.current.has(productId)
      );
      if (missing.length === 0) {
        return;
      }
      missing.forEach((productId) => attemptedProductIds.current.add(productId));
      const results = await runWithConcurrency(missing, PRODUCT_LOOKUP_CONCURRENCY, (productId) =>
        getProduct(productId)
      );
      setCatalog((previous) => {
        const next = new Map(previous);
        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value) {
            next.set(result.value.id, { name: result.value.name, sku: result.value.sku });
          }
        });
        return next;
      });
    },
    [catalog]
  );

  const loadReconciliation = useCallback(
    async (filters: LotFilters) => {
      const branchId = lookupBranchId(filters);
      const reconciliationParams = {
        branchId,
        productId: filters.productId || undefined,
        from: filters.expirationFrom || undefined,
        to: filters.expirationTo || undefined,
      };
      const [summaryResult, discrepancyResult] = await Promise.allSettled([
        getLotReconciliationSummary(reconciliationParams),
        getLotReconciliationDiscrepancies({ ...reconciliationParams, onlyDiscrepancies: true }),
      ]);
      setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
      setDiscrepancies(discrepancyResult.status === "fulfilled" ? discrepancyResult.value : []);
      setReconciliationFailed(
        summaryResult.status === "rejected" || discrepancyResult.status === "rejected"
      );
    },
    [lookupBranchId]
  );

  const loadInventory = useCallback(
    async (filters: LotFilters) => {
      const branchId = lookupBranchId(filters);

      setLoading(true);
      setErrorMessage(null);

      try {
        const [nextLots, nextBalances] = await Promise.all([
          listInventoryLots({
            branchId,
            productId: filters.productId || undefined,
            status: filters.status || undefined,
            expirationFrom: filters.expirationFrom || undefined,
            expirationTo: filters.expirationTo || undefined,
          }),
          listInventoryLotBalances({
            branchId,
            productId: filters.productId || undefined,
            locationId: filters.locationId || undefined,
            onlyAvailable: filters.onlyAvailable || undefined,
            onlyActiveLots: filters.status === "ACTIVE" ? true : undefined,
            expirationFrom: filters.expirationFrom || undefined,
            expirationTo: filters.expirationTo || undefined,
          }),
        ]);
        const uniqueLots = uniqueById(nextLots);
        const uniqueBalances = uniqueById(nextBalances);
        setLots(uniqueLots);
        setBalances(uniqueBalances);
        setHasSearched(true);
        void resolveMissingProducts(uniqueLots, uniqueBalances);
        void loadReconciliation(filters);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "No se pudo cargar el inventario por lote."));
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [loadReconciliation, lookupBranchId, resolveMissingProducts]
  );

  const identityFor = useCallback(
    (row: LotRow) =>
      resolveProductIdentity(
        {
          productId: row.lot.productId,
          productName: row.lot.productName ?? row.balance?.productName,
          productSku: row.lot.productSku ?? row.balance?.productSku,
        },
        catalog
      ),
    [catalog]
  );

  const lotRows = useMemo<LotRow[]>(() => {
    const balancesByLot = new Map<string, InventoryLotBalanceResponse[]>();
    balances.forEach((balance) => {
      const current = balancesByLot.get(balance.lotId) ?? [];
      current.push(balance);
      balancesByLot.set(balance.lotId, current);
    });

    return lots.flatMap<LotRow>((lot) => {
      const lotBalances = balancesByLot.get(lot.id) ?? [];
      if ((appliedFilters.onlyAvailable || appliedFilters.locationId) && lotBalances.length === 0) {
        return [];
      }
      if (lotBalances.length === 0) {
        return [{ key: `lot:${lot.id}`, lot, balance: null }];
      }
      return lotBalances.map((balance) => ({ key: `balance:${balance.id}`, lot, balance }));
    });
  }, [appliedFilters.locationId, appliedFilters.onlyAvailable, balances, lots]);

  const visibleRows = useMemo(
    () =>
      lotRows.filter((row) => {
        const identity = identityFor(row);
        return matchesLotSearch(appliedFilters.search, [
          row.lot.lotCode,
          identity.resolved ? identity.name : "",
          identity.resolved ? identity.sku : "",
          branchNameById.get(row.lot.branchId),
          row.balance?.locationId ? describeLocation(row.balance.locationId) : "",
        ]);
      }),
    [appliedFilters.search, branchNameById, describeLocation, identityFor, lotRows]
  );

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [page, pageSize, visibleRows]);

  const metrics = useMemo(() => computeLotMetrics(visibleRows), [visibleRows]);

  const discrepanciesByLot = useMemo(() => {
    const map = new Map<string, InventoryLotDiscrepancy[]>();
    discrepancies.forEach((discrepancy) => {
      if (!discrepancy.lotId) {
        return;
      }
      const current = map.get(discrepancy.lotId) ?? [];
      current.push(discrepancy);
      map.set(discrepancy.lotId, current);
    });
    return map;
  }, [discrepancies]);

  const severityOrder = { CRITICAL: 4, HIGH: 3, WARNING: 2, INFO: 1 } as const;

  const chips = useMemo(
    () =>
      buildLotFilterChips(appliedFilters, defaultFilters, {
        branch: describeBranch,
        product: (productId) => {
          const product = catalog.get(productId);
          return product ? product.name : "Producto no disponible";
        },
        location: (locationId) => describeLocation(locationId),
        status: (status) => statusLabels[status],
        date: (value) => formatDate(value),
      }),
    [appliedFilters, catalog, defaultFilters, describeBranch, describeLocation]
  );

  const showBranchColumn = isSuperRole && !appliedFilters.branchId;
  const columnCount = showBranchColumn ? 13 : 12;

  const applyFilters = (filters: LotFilters = draftFilters) => {
    setAppliedFilters(filters);
    setPreloadedFromUrl(false);
    setPage(0);
    void loadInventory(filters);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFilters();
    }
  };

  const removeChip = (key: LotFilterKey) => {
    const next = clearLotFilter(appliedFilters, key, defaultFilters);
    setDraftFilters((previous) => clearLotFilter(previous, key, defaultFilters));
    setAppliedFilters(next);
    setPage(0);
    if (hasSearched) {
      void loadInventory(next);
    }
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPreloadedFromUrl(false);
    setPage(0);
    if (hasSearched) {
      void loadInventory(defaultFilters);
    }
  };

  const openDetail = (row: LotRow) => {
    const expiration = getExpirationBadge(row.lot.expirationDate);
    const identity = identityFor(row);
    setSelectedRow({
      lot: row.lot,
      balance: row.balance,
      productName: identity.name,
      productSku: identity.sku,
      branchName: describeBranch(row.lot.branchId),
      locationName: describeLocation(row.balance?.locationId),
      expirationLabel: expiration.label,
      expirationTone: expiration.className,
      expirationDays: expiration.days,
      statusLabel: statusLabels[row.lot.status],
      supplierName: row.lot.supplierId ? supplierNames.get(row.lot.supplierId) ?? null : null,
      discrepancies: discrepanciesByLot.get(row.lot.id) ?? [],
    });
  };

  const renderAlerts = (row: LotRow) => {
    const expiration = getExpirationBadge(row.lot.expirationDate);
    const lotDiscrepancies = discrepanciesByLot.get(row.lot.id) ?? [];
    const highestSeverity = lotDiscrepancies.reduce<InventoryLotDiscrepancy["severity"] | null>(
      (highest, discrepancy) =>
        !highest || severityOrder[discrepancy.severity] > severityOrder[highest]
          ? discrepancy.severity
          : highest,
      null
    );
    const available = Number(row.balance?.quantityAvailable ?? 0);

    return (
      <div className="flex flex-wrap gap-1.5">
        {!row.balance ? (
          <span className={`${badgeBase} border-slate-200 bg-slate-100 text-slate-700`}>
            Sin saldo registrado
          </span>
        ) : available <= 0 ? (
          <span className={`${badgeBase} border-slate-200 bg-slate-100 text-slate-700`}>Sin stock</span>
        ) : isLotSellable(row.lot) ? (
          <span className={`${badgeBase} border-emerald-200 bg-emerald-50 text-emerald-700`}>Vendible</span>
        ) : (
          <span className={`${badgeBase} border-rose-200 bg-rose-50 text-rose-700`}>No vendible</span>
        )}
        {expiration.label !== "Vigente" && expiration.label !== "Sin vencimiento" ? (
          <span className={`${badgeBase} ${expiration.className}`}>{expiration.label}</span>
        ) : null}
        {row.lot.isLegacy ? (
          <span className={`${badgeBase} border-violet-200 bg-violet-50 text-violet-700`}>Legacy</span>
        ) : null}
        {highestSeverity ? (
          <span className={`${badgeBase} ${severityStyles[highestSeverity]}`}>
            {lotDiscrepancies.length} discrep.
          </span>
        ) : null}
      </div>
    );
  };

  const reconciliationScope = [
    appliedFilters.branchId
      ? describeBranch(appliedFilters.branchId)
      : isSuperRole
        ? "Todas las sucursales"
        : "Sucursal actual",
    appliedFilters.productId ? catalog.get(appliedFilters.productId)?.name ?? "Producto" : "Todos los productos",
    appliedFilters.expirationFrom || appliedFilters.expirationTo
      ? `${appliedFilters.expirationFrom ? formatDate(appliedFilters.expirationFrom) : "…"} – ${
          appliedFilters.expirationTo ? formatDate(appliedFilters.expirationTo) : "…"
        }`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Se cargan todas las ubicaciones (activas e inactivas) para resolver nombres;
  // el selector muestra las activas de la sucursal elegida y la aplicada aunque esté inactiva.
  const locationOptions = locations.filter(
    (location) =>
      location.id === draftFilters.locationId ||
      (location.isActive && (!draftFilters.branchId || location.branchId === draftFilters.branchId))
  );

  const kpi = (value: number) => (hasSearched ? formatNumber(value) : "-");
  const nonSellableBreakdown = `Vencido: ${formatNumber(metrics.nonSellableBreakdown.expired)} · Bloqueado: ${formatNumber(
    metrics.nonSellableBreakdown.blocked
  )} · Otros: ${formatNumber(metrics.nonSellableBreakdown.other)}`;
  const thClass = "whitespace-nowrap px-4 py-3 font-medium";
  const numericThClass = `${thClass} text-right`;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventario</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Inventario por lote</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Saldos por lote y ubicación alimentados por compras y ajustes. Vista de solo lectura.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => void loadInventory(appliedFilters)}
            isLoading={loading}
            disabled={!hasSearched}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Actualizar
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              label="Buscar"
              type="search"
              placeholder="Lote, producto, SKU, sucursal o ubicación"
              value={draftFilters.search}
              onKeyDown={handleSearchKeyDown}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, search: event.target.value }))
              }
            />
          </div>
          <Button onClick={() => applyFilters()} isLoading={loading} className="w-full sm:w-auto">
            <Search className="h-4 w-4" aria-hidden="true" />
            Buscar
          </Button>
        </div>
      </section>

      <CollapsibleFilterPanel id="inventory-lots-filters" storageKey="inventory-lots" activeCount={chips.length}>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <div className="min-w-0">
            <Select
              label="Sucursal"
              value={draftFilters.branchId}
              disabled={!isSuperRole || loadingLookups}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  branchId: event.target.value,
                  locationId: "",
                }))
              }
            >
              <option value="">{isSuperRole ? "Todas" : "Sucursal actual"}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <SearchableSelect
              id="inventory-lots-product"
              label="Producto"
              value={draftFilters.productId}
              options={productOptions}
              emptyOptionLabel="Todos"
              searchPlaceholder="Nombre o SKU"
              noResultsMessage="Ningún producto coincide"
              loading={loadingLookups}
              onChange={(productId) =>
                setDraftFilters((previous) => ({ ...previous, productId }))
              }
            />
          </div>
          <div className="min-w-0">
            <Select
              label="Estado"
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  status: event.target.value as InventoryLotStatus | "",
                }))
              }
            >
              <option value="">Todos</option>
              {INVENTORY_LOT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <Select
              label="Ubicación"
              value={draftFilters.locationId}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, locationId: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {describeLocation(location.id)}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <Input
              label="Vence desde"
              type="date"
              value={draftFilters.expirationFrom}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, expirationFrom: event.target.value }))
              }
            />
          </div>
          <div className="min-w-0">
            <Input
              label="Vence hasta"
              type="date"
              value={draftFilters.expirationTo}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, expirationTo: event.target.value }))
              }
            />
          </div>
          <label className="flex min-w-0 w-full items-center gap-3 self-end rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <input
              type="checkbox"
              checked={draftFilters.onlyAvailable}
              onChange={(event) =>
                setDraftFilters((previous) => ({ ...previous, onlyAvailable: event.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Solo disponibles</span>
          </label>
          <div className="min-w-0">
            <Select
              label="Filas por página"
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => applyFilters()} className="w-full sm:w-auto">
            <Search className="h-4 w-4" aria-hidden="true" />
            Aplicar filtros
          </Button>
          <Button variant="ghost" onClick={resetFilters} className="w-full sm:w-auto">
            Limpiar
          </Button>
        </div>
      </CollapsibleFilterPanel>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Filtros aplicados">
          {chips.map((chip) => (
            <li
              key={chip.key}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1 text-xs font-medium text-blue-800"
            >
              <span className="truncate">
                {chip.label}: {chip.value}
              </span>
              <button
                type="button"
                onClick={() => removeChip(chip.key)}
                aria-label={`Quitar filtro ${chip.label}`}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {lookupWarnings.length > 0 ? (
        <section
          role="status"
          className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm"
        >
          <ul className="list-disc space-y-1 pl-5">
            {lookupWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => void loadLookups()} isLoading={loadingLookups}>
            Reintentar
          </Button>
        </section>
      ) : null}

      {errorMessage ? (
        <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {hasSearched && reconciliationFailed ? (
        <section
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm"
        >
          <span>No se pudo cargar la conciliación de lotes. Los saldos mostrados sí están actualizados.</span>
          <Button variant="ghost" size="sm" onClick={() => void loadReconciliation(appliedFilters)}>
            Reintentar
          </Button>
        </section>
      ) : null}

      <ReportSummary
        columns={6}
        ariaLabel="Indicadores del resultado"
        items={[
          { label: "Lotes activos", value: kpi(metrics.activeLots) },
          { label: "Lotes vencidos", value: kpi(metrics.expiredLots) },
          { label: `Próximos a vencer (${EXPIRING_WINDOW_DAYS} días)`, value: kpi(metrics.expiringLots) },
          {
            label: "Disponible vendible",
            value: kpi(metrics.sellableAvailable),
            title: "Lotes activos con vencimiento nulo o no anterior a hoy (misma regla que la venta).",
          },
          {
            label: "Disponible no vendible",
            value: kpi(metrics.nonSellableAvailable),
            title: nonSellableBreakdown,
            detail: hasSearched ? nonSellableBreakdown : undefined,
            detailTitle: nonSellableBreakdown,
          },
          {
            label: "Discrep. críticas / altas",
            value: !hasSearched
              ? "-"
              : summary
                ? `${formatNumber(summary.criticalCount)} / ${formatNumber(summary.highCount)}`
                : reconciliationFailed
                  ? "No disponible"
                  : "-",
            detail: `Conciliación · ${reconciliationScope}`,
            detailTitle: reconciliationScope,
          },
        ]}
      />

      <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <caption className="sr-only">Lotes y saldos del resultado aplicado</caption>
            <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th scope="col" className={`${thClass} sticky left-0 z-10 bg-slate-50 dark:bg-slate-900`}>
                  Detalle
                </th>
                <th scope="col" className={thClass}>Producto</th>
                <th scope="col" className={thClass}>Lote</th>
                <th scope="col" className={thClass}>Ubicación</th>
                <th scope="col" className={thClass}>Vencimiento</th>
                <th scope="col" className={thClass}>Estado</th>
                <th scope="col" className={numericThClass}>Disponible</th>
                <th scope="col" className={numericThClass}>Reservado</th>
                <th scope="col" className={numericThClass}>En mano</th>
                <th scope="col" className={thClass}>Alertas</th>
                {showBranchColumn ? <th scope="col" className={thClass}>Sucursal</th> : null}
                <th scope="col" className={numericThClass}>Costo</th>
                <th scope="col" className={thClass}>Últ. mov.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Cargando inventario por lote...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    {preloadedFromUrl
                      ? "Filtros precargados desde Ubicaciones. Presiona Buscar."
                      : "Presiona Buscar para consultar lotes y saldos."}
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay lotes para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const expiration = getExpirationBadge(row.lot.expirationDate);
                  const identity = identityFor(row);
                  const quantity = (value: number | undefined) =>
                    row.balance ? formatNumber(value ?? 0) : "—";

                  return (
                    <tr key={row.key}>
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-slate-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(row)}
                          aria-label={`Ver detalle del lote ${row.lot.lotCode} de ${identity.name}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Ver
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">
                        <div className="min-w-[180px]">
                          <p className={`font-medium ${identity.resolved ? "" : "italic text-slate-500"}`}>
                            {identity.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">SKU {identity.sku}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {row.lot.lotCode}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {describeLocation(row.balance?.locationId)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="whitespace-nowrap">{formatDate(row.lot.expirationDate)}</span>
                          <span className={`${badgeBase} w-fit ${expiration.className}`}>
                            {expiration.label}
                            {expiration.days !== null && expiration.days >= 0 && expiration.days <= EXPIRING_WINDOW_DAYS
                              ? ` · ${expiration.days} d`
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[row.lot.status]}`}
                        >
                          {statusLabels[row.lot.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {quantity(row.balance?.quantityAvailable)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {quantity(row.balance?.quantityReserved)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {quantity(row.balance?.quantityOnHand)}
                      </td>
                      <td className="px-4 py-3">{renderAlerts(row)}</td>
                      {showBranchColumn ? (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {describeBranch(row.lot.branchId)}
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                        {formatCurrency(row.lot.unitCost)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                        {formatDate(row.balance?.lastMovementAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span>
            {hasSearched ? `${formatNumber(visibleRows.length)} filas · ` : ""}
            Página {Math.min(page + 1, totalPages)} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setPage((previous) => Math.max(previous - 1, 0))}
              disabled={page === 0 || loading}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPage((previous) => Math.min(previous + 1, Math.max(totalPages - 1, 0)))}
              disabled={page >= totalPages - 1 || loading}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      <InventoryLotDetailModal
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
        formatDate={formatDate}
        formatNumber={formatNumber}
        formatCurrency={formatCurrency}
      />
    </div>
  );
};

export default InventoryLotsPage;
