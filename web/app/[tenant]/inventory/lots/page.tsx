"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Eye,
  Layers,
  PackageCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { listBranches } from "../../../../domains/branches/api";
import type { BranchResponse } from "../../../../domains/branches/dtos";
import { listProducts } from "../../../../domains/products/api";
import type { ProductResponse } from "../../../../domains/products/dtos";
import { useInventoryScope } from "../../../../hooks/useInventoryScope";
import { InventoryLotDetailModal } from "../../../../modules/inventory/components/InventoryLotDetailModal";
import type { InventoryLotDetailRow } from "../../../../modules/inventory/components/InventoryLotDetailModal";
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

type LotFilters = {
  search: string;
  branchId: string;
  productId: string;
  status: InventoryLotStatus | "";
  expirationFrom: string;
  expirationTo: string;
  locationId: string;
  onlyAvailable: boolean;
};

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

const createDefaultFilters = (branchId?: string | null): LotFilters => ({
  search: "",
  branchId: branchId ?? "",
  productId: "",
  status: "",
  expirationFrom: "",
  expirationTo: "",
  locationId: "",
  onlyAvailable: false,
});

const pageSizeOptions = [10, 25, 50];

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

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
};

const compactId = (value: string | null | undefined) =>
  value ? `${value.slice(0, 8)}...` : "-";

const toDateOnly = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.slice(0, 10);
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const daysUntil = (value: string | null | undefined) => {
  const target = toDateOnly(value);
  if (!target) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
};

const getExpirationBadge = (expirationDate: string | null) => {
  const days = daysUntil(expirationDate);

  if (days === null) {
    return {
      label: "Sin vencimiento",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }

  if (days < 0) {
    return {
      label: "Vencido",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (days <= 30) {
    return {
      label: "Proximo a vencer",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
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

const SummaryCard = ({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: typeof Boxes;
}) => (
  <article className={`rounded-2xl border px-4 py-4 shadow-sm ${tone}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide opacity-75">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </div>
      <Icon className="h-5 w-5 opacity-70" />
    </div>
  </article>
);

const InventoryLotsPage = () => {
  const { currentTenant, currentBranch, isSuperRole } = useInventoryScope();
  const [lots, setLots] = useState<InventoryLotResponse[]>([]);
  const [balances, setBalances] = useState<InventoryLotBalanceResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [summary, setSummary] = useState<InventoryLotReconciliationSummary | null>(null);
  const [discrepancies, setDiscrepancies] = useState<InventoryLotDiscrepancy[]>([]);
  const [selectedRow, setSelectedRow] = useState<InventoryLotDetailRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [draftFilters, setDraftFilters] = useState<LotFilters>(
    createDefaultFilters(currentBranch)
  );
  const [appliedFilters, setAppliedFilters] = useState<LotFilters>(
    createDefaultFilters(currentBranch)
  );
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lookupErrorMessage, setLookupErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperRole || !currentBranch) {
      return;
    }

    setDraftFilters((prev) => ({ ...prev, branchId: prev.branchId || currentBranch }));
    setAppliedFilters((prev) => ({ ...prev, branchId: prev.branchId || currentBranch }));
  }, [currentBranch, isSuperRole]);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((product) => map.set(product.id, product.name));
    return map;
  }, [products]);

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((branch) => map.set(branch.id, branch.name));
    return map;
  }, [branches]);

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((location) => {
      map.set(location.id, `${location.code} - ${location.name}`);
    });
    return map;
  }, [locations]);

  const loadLocationsLookup = useCallback(
    async (branchId?: string) => {
      try {
        const result = await listInventoryLocations({
          branchId,
          isActive: true,
        });
        setLocations(uniqueById(result));
      } catch {
        setLocations([]);
      }
    },
    []
  );

  const loadLookups = useCallback(async () => {
    setLoadingLookups(true);
    setLookupErrorMessage(null);

    try {
      const [nextBranches, nextProducts] = await Promise.all([
        listBranches({ tenantId: currentTenant ?? undefined }),
        listProducts({
          tenantId: currentTenant ?? undefined,
          branchId: !isSuperRole ? currentBranch ?? undefined : undefined,
        }),
      ]);

        const branchOptions = uniqueById(nextBranches.map(mapBranch));
      if (currentBranch && !branchOptions.some((branch) => branch.id === currentBranch)) {
        branchOptions.unshift({
          id: currentBranch,
          name: "Sucursal actual",
        });
      }

      setBranches(branchOptions);
      setProducts(uniqueById(nextProducts));
      await loadLocationsLookup(isSuperRole ? draftFilters.branchId || undefined : currentBranch ?? undefined);
    } catch {
      if (currentBranch) {
        setBranches([
          {
            id: currentBranch,
            name: "Sucursal actual",
          },
        ]);
      }
      setLookupErrorMessage("No se pudieron cargar productos, sucursales o ubicaciones.");
    } finally {
      setLoadingLookups(false);
    }
  }, [
    currentBranch,
    currentTenant,
    draftFilters.branchId,
    isSuperRole,
    loadLocationsLookup,
  ]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadLocationsLookup(
      isSuperRole ? draftFilters.branchId || undefined : currentBranch ?? undefined
    );
  }, [currentBranch, draftFilters.branchId, isSuperRole, loadLocationsLookup]);

  const resolveBranchId = useCallback(
    (filters: LotFilters) =>
      filters.branchId || (!isSuperRole ? currentBranch ?? undefined : undefined),
    [currentBranch, isSuperRole]
  );

  const loadInventory = useCallback(
    async (filters?: LotFilters) => {
      const activeFilters = filters ?? appliedFilters;
      const branchId = resolveBranchId(activeFilters);

      setLoading(true);
      setErrorMessage(null);

      try {
        const lotParams = {
          branchId,
          productId: activeFilters.productId || undefined,
          status: activeFilters.status || undefined,
          expirationFrom: activeFilters.expirationFrom || undefined,
          expirationTo: activeFilters.expirationTo || undefined,
        };
        const balanceParams = {
          branchId,
          productId: activeFilters.productId || undefined,
          locationId: activeFilters.locationId || undefined,
          onlyAvailable: activeFilters.onlyAvailable || undefined,
          onlyActiveLots: activeFilters.status === "ACTIVE" ? true : undefined,
          expirationFrom: activeFilters.expirationFrom || undefined,
          expirationTo: activeFilters.expirationTo || undefined,
        };
        const reconciliationParams = {
          branchId,
          productId: activeFilters.productId || undefined,
          from: activeFilters.expirationFrom || undefined,
          to: activeFilters.expirationTo || undefined,
        };

        const [nextLots, nextBalances] = await Promise.all([
          listInventoryLots(lotParams),
          listInventoryLotBalances(balanceParams),
        ]);
        setLots(uniqueById(nextLots));
        setBalances(uniqueById(nextBalances));

        const [nextSummary, nextDiscrepancies] = await Promise.all([
          getLotReconciliationSummary(reconciliationParams).catch(() => null),
          getLotReconciliationDiscrepancies({
            ...reconciliationParams,
            onlyDiscrepancies: true,
          }).catch(() => [] as InventoryLotDiscrepancy[]),
        ]);
        setSummary(nextSummary);
        setDiscrepancies(nextDiscrepancies);
        setHasSearched(true);
      } catch (error) {
        setErrorMessage(
          getErrorMessage(error, "No se pudo cargar el inventario por lote.")
        );
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, resolveBranchId]
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
      if (appliedFilters.onlyAvailable && lotBalances.length === 0) {
        return [];
      }
      if (appliedFilters.locationId && lotBalances.length === 0) {
        return [];
      }

      if (lotBalances.length === 0) {
        return [
          {
            key: `lot:${lot.id}`,
            lot,
            balance: null,
          },
        ];
      }

      return lotBalances.map((balance) => ({
        key: `balance:${balance.id}`,
        lot,
        balance,
      }));
    });
  }, [appliedFilters.locationId, appliedFilters.onlyAvailable, balances, lots]);

  const visibleRows = useMemo(() => {
    const query = appliedFilters.search.trim().toLowerCase();
    if (!query) {
      return lotRows;
    }

    return lotRows.filter((row) => {
      const productName = productNameById.get(row.lot.productId) ?? "";
      const branchName = branchNameById.get(row.lot.branchId) ?? "";
      const locationName = row.balance?.locationId
        ? locationNameById.get(row.balance.locationId) ?? ""
        : "";

      return (
        row.lot.lotCode.toLowerCase().includes(query) ||
        productName.toLowerCase().includes(query) ||
        row.lot.productId.toLowerCase().includes(query) ||
        branchName.toLowerCase().includes(query) ||
        locationName.toLowerCase().includes(query)
      );
    });
  }, [appliedFilters.search, branchNameById, locationNameById, lotRows, productNameById]);

  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [page, pageSize, visibleRows]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));

  const discrepancyStatsByLot = useMemo(() => {
    const map = new Map<
      string,
      { count: number; highestSeverity: InventoryLotDiscrepancy["severity"] }
    >();
    const severityOrder = {
      CRITICAL: 4,
      HIGH: 3,
      WARNING: 2,
      INFO: 1,
    };

    discrepancies.forEach((discrepancy) => {
      if (!discrepancy.lotId) {
        return;
      }

      const current = map.get(discrepancy.lotId);
      if (!current) {
        map.set(discrepancy.lotId, {
          count: 1,
          highestSeverity: discrepancy.severity,
        });
        return;
      }

      map.set(discrepancy.lotId, {
        count: current.count + 1,
        highestSeverity:
          severityOrder[discrepancy.severity] > severityOrder[current.highestSeverity]
            ? discrepancy.severity
            : current.highestSeverity,
      });
    });

    return map;
  }, [discrepancies]);

  const activeLotsCount = lots.filter((lot) => lot.status === "ACTIVE").length;
  const expiredLotsCount = lots.filter((lot) => {
    const days = daysUntil(lot.expirationDate);
    return lot.status === "EXPIRED" || (days !== null && days < 0);
  }).length;
  const expiringLotsCount = lots.filter((lot) => {
    const days = daysUntil(lot.expirationDate);
    return days !== null && days >= 0 && days <= 30;
  }).length;
  const availableTotal = visibleRows.reduce(
    (sum, row) => sum + Number(row.balance?.quantityAvailable ?? 0),
    0
  );

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadInventory(draftFilters);
  };

  const resetFilters = () => {
    const nextFilters = createDefaultFilters(isSuperRole ? "" : currentBranch);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(0);
  };

  const openDetail = (row: LotRow) => {
    const expiration = getExpirationBadge(row.lot.expirationDate);
    setSelectedRow({
      lot: row.lot,
      balance: row.balance,
      productName: productNameById.get(row.lot.productId) ?? compactId(row.lot.productId),
      branchName: branchNameById.get(row.lot.branchId) ?? compactId(row.lot.branchId),
      locationName: row.balance?.locationId
        ? locationNameById.get(row.balance.locationId) ?? compactId(row.balance.locationId)
        : "Sin ubicacion",
      expirationLabel: expiration.label,
      expirationTone: expiration.className,
      statusLabel: statusLabels[row.lot.status],
    });
  };

  const renderAlerts = (row: LotRow) => {
    const expiration = getExpirationBadge(row.lot.expirationDate);
    const available = Number(row.balance?.quantityAvailable ?? 0);
    const lotDiscrepancies = discrepancyStatsByLot.get(row.lot.id);

    return (
      <div className="flex flex-wrap gap-1.5">
        {available <= 0 ? (
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Sin stock
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Disponible
          </span>
        )}
        {expiration.label !== "Vigente" ? (
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${expiration.className}`}>
            {expiration.label}
          </span>
        ) : null}
        {row.lot.isLegacy ? (
          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            Legacy
          </span>
        ) : null}
        {lotDiscrepancies ? (
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${severityStyles[lotDiscrepancies.highestSeverity]}`}
          >
            {lotDiscrepancies.count} discrep.
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Inventory</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Inventario por lote
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Consulta lotes, saldos, vencimientos y discrepancias sin modificar stock.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => void loadInventory()}
            isLoading={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800 shadow-sm">
        Los saldos por lote se alimentan desde compras y ajustes. Esta vista es
        solo lectura y muestra vencimientos, disponibilidad y reconciliacion sin
        corregir datos automaticamente.
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Lotes activos"
          value={formatNumber(activeLotsCount)}
          icon={Layers}
          tone="border-emerald-200 bg-emerald-50 text-emerald-800"
        />
        <SummaryCard
          label="Lotes vencidos"
          value={formatNumber(expiredLotsCount)}
          icon={AlertTriangle}
          tone="border-rose-200 bg-rose-50 text-rose-800"
        />
        <SummaryCard
          label="Proximos a vencer"
          value={formatNumber(expiringLotsCount)}
          icon={AlertTriangle}
          tone="border-amber-200 bg-amber-50 text-amber-800"
        />
        <SummaryCard
          label="Stock disponible"
          value={formatNumber(availableTotal)}
          icon={PackageCheck}
          tone="border-blue-200 bg-blue-50 text-blue-800"
        />
        <SummaryCard
          label="Discrep. criticas/altas"
          value={
            summary
              ? `${formatNumber(summary.criticalCount)} / ${formatNumber(summary.highCount)}`
              : "-"
          }
          icon={Boxes}
          tone="border-slate-200 bg-slate-50 text-slate-800"
        />
      </section>

      <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <div className="min-w-0 sm:col-span-2 lg:col-span-3 2xl:col-span-2">
            <Input
              label="Buscar"
              placeholder="Lote, producto, sucursal o ubicacion"
              value={draftFilters.search}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </div>
          <div className="min-w-0">
            <Select
              label="Sucursal"
              value={draftFilters.branchId}
              disabled={!isSuperRole || loadingLookups}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
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
            <Select
              label="Producto"
              value={draftFilters.productId}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, productId: event.target.value }))
              }
            >
              <option value="">Todos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0">
            <Select
              label="Estado"
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
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
              label="Ubicacion"
              value={draftFilters.locationId}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, locationId: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
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
                setDraftFilters((prev) => ({
                  ...prev,
                  expirationFrom: event.target.value,
                }))
              }
            />
          </div>
          <div className="min-w-0">
            <Input
              label="Vence hasta"
              type="date"
              value={draftFilters.expirationTo}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  expirationTo: event.target.value,
                }))
              }
            />
          </div>
          <label className="flex min-w-0 w-full items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draftFilters.onlyAvailable}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  onlyAvailable: event.target.checked,
                }))
              }
              className="mb-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span className="whitespace-nowrap">Solo disponibles</span>
          </label>
          <div className="flex min-w-0 w-full flex-wrap items-end gap-2 self-end sm:col-span-2 lg:col-span-1">
            <Button
              variant="outline"
              onClick={applyFilters}
              className="w-full sm:w-auto"
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button
              variant="ghost"
              onClick={resetFilters}
              className="w-full sm:w-auto"
            >
              Limpiar
            </Button>
          </div>
          <div className="min-w-0">
            <Select
              label="Filas"
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
      </section>

      {lookupErrorMessage ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
          {lookupErrorMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Lote</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Ubicacion</th>
                <th className="px-4 py-3 font-medium">Vencimiento</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">En mano</th>
                <th className="px-4 py-3 font-medium">Reservado</th>
                <th className="px-4 py-3 font-medium">Disponible</th>
                <th className="px-4 py-3 font-medium">Costo</th>
                <th className="px-4 py-3 font-medium">Ult. mov.</th>
                <th className="px-4 py-3 font-medium">Alertas</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-6 text-center text-slate-500">
                    Cargando inventario por lote...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={13} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar lotes y saldos.
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-6 text-center text-slate-500">
                    No hay lotes para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const expiration = getExpirationBadge(row.lot.expirationDate);
                  const productName =
                    productNameById.get(row.lot.productId) ?? compactId(row.lot.productId);
                  const branchName =
                    branchNameById.get(row.lot.branchId) ?? compactId(row.lot.branchId);
                  const locationName = row.balance?.locationId
                    ? locationNameById.get(row.balance.locationId) ??
                      compactId(row.balance.locationId)
                    : "Sin ubicacion";

                  return (
                    <tr key={row.key}>
                      <td className="px-4 py-3 text-slate-900">
                        <div className="min-w-[180px]">
                          <p className="font-medium">{productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {compactId(row.lot.productId)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.lot.lotCode}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{branchName}</td>
                      <td className="px-4 py-3 text-slate-700">{locationName}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span>{formatDate(row.lot.expirationDate)}</span>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${expiration.className}`}
                          >
                            {expiration.label}
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
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatNumber(row.balance?.quantityOnHand ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatNumber(row.balance?.quantityReserved ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatNumber(row.balance?.quantityAvailable ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(row.lot.unitCost)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(row.balance?.lastMovementAt)}
                      </td>
                      <td className="px-4 py-3">{renderAlerts(row)}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(row)}>
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Pagina {Math.min(page + 1, totalPages)} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0 || loading}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                setPage((prev) => Math.min(prev + 1, Math.max(totalPages - 1, 0)))
              }
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
