"use client";

import { AlertTriangle, Eye, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../components/design-system/Button";
import { useAppSelector } from "../../../store/hooks";
import InventoryBiFiltersPanel from "./InventoryBiFiltersPanel";
import {
  getInventoryBiSummary,
  type InventoryBiSummaryResponse,
} from "../services/dashboard.service";
import {
  createInventoryBiFilters,
  type InventoryBiFilters,
} from "../state/inventoryBiFilters";
import {
  formatInventoryCurrency,
  formatInventoryUnits,
} from "../utils/kpi-formatters";

type InventoryBiViewState = "loading" | "error" | "ready";

type InventoryBiDashboardProps = {
  viewState?: InventoryBiViewState;
  onRefresh?: () => void;
  onRetry?: () => void;
};

const panelClassName =
  "rounded-xl border border-[var(--brand-surface-border)] bg-[var(--brand-surface-card)] p-4 shadow-sm";

const sectionTitleClassName =
  "text-base font-bold leading-5 text-[var(--brand-surface-text)]";

const sectionSubtitleClassName =
  "mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]";

const InventoryBiSkeleton = ({
  className,
  label,
}: {
  className: string;
  label?: string;
}) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-lg bg-slate-100 ${className}`}
    data-skeleton={label}
  />
);

const InventoryBiSection = ({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`${panelClassName} ${className}`}>
    <div>
      <h2 className={sectionTitleClassName}>{title}</h2>
      {subtitle ? <p className={sectionSubtitleClassName}>{subtitle}</p> : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const InventoryBiHeader = ({
  onRefresh,
  lastUpdated,
}: {
  onRefresh?: () => void;
  lastUpdated?: string | null;
}) => (
  <header
    className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
  >
    <div className="min-w-0">
      <h1 className="text-xl font-bold leading-[1.15] tracking-[-0.02em] text-[var(--brand-surface-text)] sm:text-2xl lg:text-[26px]">
        Dashboard de Inventario
      </h1>
      <p className="mt-2 text-[13px] font-normal leading-5 text-[var(--brand-surface-muted)] sm:text-sm">
        Visión ejecutiva y operativa del inventario
      </p>
    </div>

    <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center md:shrink-0">
      <p className="text-xs text-[var(--brand-surface-muted)] sm:text-right">
        Última actualización: {lastUpdated ? new Date(lastUpdated).toLocaleString("es-CO") : "pendiente"}
      </p>
      <Button
        variant="outline"
        size="md"
        onClick={onRefresh}
        disabled={!onRefresh}
        aria-label="Actualizar Dashboard de Inventario"
        title={onRefresh ? "Actualizar dashboard" : "Disponible en la siguiente sección"}
      >
        <RefreshCw className="h-[18px] w-[18px]" aria-hidden="true" />
        Actualizar
      </Button>
    </div>
  </header>
);

const KpiShell = ({
  summary,
  loading,
  error,
}: {
  summary: InventoryBiSummaryResponse | null;
  loading: boolean;
  error: string | null;
}) => {
  const cards = summary
    ? [
        ["Costo total del inventario", formatInventoryCurrency(summary.totalInventoryCost)],
        ["Unidades en inventario", formatInventoryUnits(summary.totalInventoryUnits)],
        ["Productos con stock", String(summary.productsWithStock)],
        ["Productos agotados", String(summary.outOfStockProducts)],
        ["Stock negativo", String(summary.negativeStockProducts)],
      ]
    : [];

  return (
  <section
    aria-label="Indicadores ejecutivos"
    className="inventory-bi-kpi-grid grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-3"
  >
    {loading ? Array.from({ length: 5 }, (_, index) => (
      <div key={index} className={`${panelClassName} min-w-[160px] min-h-[110px]`}>
        <InventoryBiSkeleton className="h-3 w-2/5" label={`kpi-label-${index + 1}`} />
        <InventoryBiSkeleton className="mt-4 h-7 w-3/5" label={`kpi-value-${index + 1}`} />
        <InventoryBiSkeleton className="mt-3 h-3 w-4/5" label={`kpi-description-${index + 1}`} />
      </div>
    )) : cards.map(([label, value]) => (
      <div key={label} className={`${panelClassName} min-w-[160px] min-h-[110px]`}>
        <p className="text-xs font-semibold text-[var(--brand-surface-muted)]">{label}</p>
        <p className="mt-4 min-w-0 break-all text-2xl font-bold leading-none text-[var(--brand-surface-text)]">
          {error || value === null ? "No disponible" : value}
        </p>
      </div>
    ))}
  </section>
  );
};

const CapitalDistributionShell = () => (
  <section aria-label="Distribución del capital">
    <div className="mb-3">
      <h2 className={sectionTitleClassName}>Distribución del capital</h2>
      <p className={sectionSubtitleClassName}>
        El capital se distribuirá por sucursal, categoría y producto cuando se conecten los datos BI.
      </p>
    </div>
    <div className="inventory-bi-capital-grid grid gap-4 lg:grid-cols-2">
      <InventoryBiSection title="Costo por sucursal" className="inventory-bi-capital-branch">
        <InventoryBiSkeleton className="h-[176px] w-full" label="capital-branch" />
      </InventoryBiSection>
      <InventoryBiSection title="Costo por categoría" className="inventory-bi-capital-category">
        <InventoryBiSkeleton className="h-[176px] w-full" label="capital-category" />
      </InventoryBiSection>
      <InventoryBiSection title="Top productos" className="inventory-bi-capital-products lg:col-span-2">
        <InventoryBiSkeleton className="h-[176px] w-full" label="capital-products" />
      </InventoryBiSection>
    </div>
  </section>
);

const OperationalHealthShell = () => (
  <section aria-label="Salud operativa">
    <div className="mb-3">
      <h2 className={sectionTitleClassName}>Salud operativa</h2>
      <p className={sectionSubtitleClassName}>
        Alertas, disponibilidad y reconciliación se conectarán en la siguiente sección.
      </p>
    </div>
    <div className="inventory-bi-health-grid grid gap-4 lg:grid-cols-2">
      <div className="inventory-bi-health-cards grid gap-4 min-[480px]:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={`${panelClassName} min-h-[96px]`}>
            <InventoryBiSkeleton className="h-3 w-2/5" label={`health-label-${index + 1}`} />
            <InventoryBiSkeleton className="mt-4 h-6 w-1/2" label={`health-value-${index + 1}`} />
          </div>
        ))}
      </div>
      <InventoryBiSection
        title="Estado del inventario"
        subtitle="Alertas y reconciliación se conectarán en la sección de salud operativa."
        className="inventory-bi-health-status lg:col-span-2"
      >
        <InventoryBiSkeleton className="h-[96px] w-full" label="health-status" />
      </InventoryBiSection>
    </div>
  </section>
);

const InventoryValuationCtaShell = () => (
  <section
    className={`${panelClassName} flex flex-col gap-4 border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft-bg)] sm:flex-row sm:items-center sm:justify-between`}
    aria-labelledby="inventory-valuation-title"
  >
    <div className="min-w-0">
      <h2 id="inventory-valuation-title" className={sectionTitleClassName}>
        Valorización de Inventario
      </h2>
      <p className={sectionSubtitleClassName}>
        Reporte detallado del inventario a valor de costo
      </p>
    </div>
    <Button
      variant="disabled"
      disabled
      aria-label="Ver valorización de inventario, disponible próximamente"
      title="Disponible en una sección posterior"
      className="w-full shrink-0 sm:w-auto"
    >
      <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
      Ver valorización
    </Button>
  </section>
);

const OperationalTableShell = () => (
  <InventoryBiSection title="Inventario" subtitle="Detalle operativo del inventario">
    <div className="overflow-hidden rounded-lg border border-[var(--brand-surface-border)]">
      <div className="grid grid-cols-2 gap-4 border-b border-[var(--brand-surface-border)] bg-slate-50 px-4 py-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <InventoryBiSkeleton key={index} className="h-3" label={`table-header-${index + 1}`} />
        ))}
      </div>
      <div className="space-y-3 px-4 py-4">
        {Array.from({ length: 4 }, (_, index) => (
          <InventoryBiSkeleton key={index} className="h-10 w-full" label={`table-row-${index + 1}`} />
        ))}
      </div>
    </div>
  </InventoryBiSection>
);

const InventoryBiErrorPanel = ({ onRetry }: { onRetry?: () => void }) => (
  <section
    role="alert"
    className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 sm:flex-row sm:items-center sm:justify-between"
  >
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="text-sm font-medium">
        No fue posible cargar el Dashboard de Inventario.
      </p>
    </div>
    {onRetry ? (
      <Button variant="outline" onClick={onRetry} className="w-full sm:w-auto">
        Reintentar
      </Button>
    ) : null}
  </section>
);

export const InventoryBiDashboard = ({
  viewState = "ready",
  onRefresh,
  onRetry,
}: InventoryBiDashboardProps) => {
  const authTenantId = useAppSelector((state) => state.auth.tenantId ?? state.auth.user?.tenantId ?? "");
  const authBranchId = useAppSelector((state) => state.auth.user?.branchId ?? "");
  const [summary, setSummary] = useState<InventoryBiSummaryResponse | null>(null);
  const [summaryFilters, setSummaryFilters] = useState<InventoryBiFilters | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(Boolean(authTenantId));
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const initialFilters = useMemo(
    () => createInventoryBiFilters({
      requestedTenantId: authTenantId,
      requestedBranchId: authBranchId,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
    }),
    [authBranchId, authTenantId]
  );

  const loadSummary = useCallback(async (filters: InventoryBiFilters) => {
    if (!filters.requestedTenantId) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const nextSummary = await getInventoryBiSummary({
        tenantId: filters.requestedTenantId,
        branchId: filters.requestedBranchId || undefined,
        productIds: filters.productIds,
        categoryId: filters.categoryId || undefined,
        stockStatus: filters.stockStatus,
      });
      setSummary(nextSummary);
      setSummaryFilters(filters);
      setLastUpdated(new Date().toISOString());
    } catch {
      setSummaryError("No fue posible cargar los indicadores de inventario.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authTenantId && !summaryFilters) void loadSummary(initialFilters);
  }, [authTenantId, initialFilters, loadSummary, summaryFilters]);

  const handleApply = useCallback((filters: InventoryBiFilters) => {
    void loadSummary(filters);
  }, [loadSummary]);

  const handleRefresh = useCallback(() => {
    const filters = summaryFilters ?? initialFilters;
    void loadSummary(filters);
    onRefresh?.();
  }, [initialFilters, loadSummary, onRefresh, summaryFilters]);

  const handleRetry = useCallback(() => {
    const filters = summaryFilters ?? initialFilters;
    void loadSummary(filters);
    onRetry?.();
  }, [initialFilters, loadSummary, onRetry, summaryFilters]);

  return (
    <main
      className="inventory-bi-main min-h-full w-full space-y-4 bg-[var(--brand-background)] px-3 pb-7 pt-4 text-[var(--brand-surface-text)] sm:px-4 sm:pt-5 md:px-5 lg:px-5"
      aria-busy={viewState === "loading" || summaryLoading}
    >
      <InventoryBiHeader
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
      />
      {viewState === "error" || summaryError ? <InventoryBiErrorPanel onRetry={handleRetry} /> : null}
      <InventoryBiFiltersPanel onApply={handleApply} />
      <KpiShell summary={summary} loading={summaryLoading} error={summaryError} />
      <CapitalDistributionShell />
      <OperationalHealthShell />
      <InventoryValuationCtaShell />
      <OperationalTableShell />
    </main>
  );
};
