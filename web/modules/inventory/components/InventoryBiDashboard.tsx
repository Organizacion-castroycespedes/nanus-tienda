"use client";

import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Eye,
  PackageCheck,
  PackageX,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../components/design-system/Button";
import { useAppSelector } from "../../../store/hooks";
import { InventoryImagePreview } from "./InventoryImagePreview";
import InventoryBiFiltersPanel from "./InventoryBiFiltersPanel";
import {
  getInventoryBiCapitalDistribution,
  getInventoryBiOperationalHealth,
  getInventoryBiSummary,
  type InventoryBiCapitalDistributionResponse,
  type InventoryBiOperationalHealthResponse,
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

const toChartNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER
    ? parsed
    : 0;
};

const formatPercent = (value: string | null) => {
  if (value === null) return "No disponible";
  const formatted = formatInventoryUnits(value);
  return formatted === null ? "No disponible" : `${formatted}%`;
};

const getProductInitials = (productName: string) => {
  const words = productName.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join("")
    : words[0]?.slice(0, 2) ?? "P";

  return initials.toUpperCase();
};

const InventoryBiProductThumbnail = ({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) => (
  <InventoryImagePreview
    imageUrl={`/inventory/products/${encodeURIComponent(productId)}/image`}
    altText={`${productName} imagen`}
    className="h-7 w-7 shrink-0 rounded-md border border-[var(--brand-surface-border)] bg-slate-100 bg-cover bg-center"
    fallback={(
      <span
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase text-[var(--brand-surface-muted)]"
      >
        {getProductInitials(productName)}
      </span>
    )}
    lazy
  />
);

const getCapitalChartHeight = (rowCount: number) =>
  Math.min(Math.max(rowCount * 34 + 28, 112), 260);

type CapitalTooltipPayload = {
  payload?: {
    label: string;
    rawCost: string;
  };
};

const CapitalChartTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CapitalTooltipPayload[];
}) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-md border border-[var(--brand-surface-border)] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-[var(--brand-surface-text)]">{row.label}</p>
      <p className="mt-1 text-[var(--brand-surface-muted)]">
        {formatInventoryCurrency(row.rawCost) ?? "No disponible"}
      </p>
    </div>
  );
};

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
  <section className={`${panelClassName} min-w-0 ${className}`}>
    <div>
      <h2 className={sectionTitleClassName}>{title}</h2>
      {subtitle ? <p className={sectionSubtitleClassName}>{subtitle}</p> : null}
    </div>
    <div className="mt-3">{children}</div>
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
    className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
  >
    <div className="min-w-0">
      <h1 className="text-xl font-bold leading-[1.15] tracking-[-0.02em] text-[var(--brand-surface-text)] sm:text-2xl lg:text-[26px]">
        Dashboard de Inventario
      </h1>
      <p className="mt-2 text-[13px] font-normal leading-5 text-[var(--brand-surface-muted)] sm:text-sm">
        Visión ejecutiva y operativa del inventario
      </p>
    </div>

    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center md:shrink-0">
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
        {
          label: "Costo total del inventario",
          value: formatInventoryCurrency(summary.totalInventoryCost),
          icon: CircleDollarSign,
          tone: "bg-blue-50 text-blue-700",
        },
        {
          label: "Unidades en inventario",
          value: formatInventoryUnits(summary.totalInventoryUnits),
          icon: Boxes,
          tone: "bg-emerald-50 text-emerald-700",
        },
        {
          label: "Productos con stock",
          value: String(summary.productsWithStock),
          icon: PackageCheck,
          tone: "bg-cyan-50 text-cyan-700",
        },
        {
          label: "Productos agotados",
          value: String(summary.outOfStockProducts),
          icon: PackageX,
          tone: "bg-amber-50 text-amber-700",
        },
        {
          label: "Stock negativo",
          value: String(summary.negativeStockProducts),
          icon: TriangleAlert,
          tone: "bg-rose-50 text-rose-700",
        },
      ]
    : [];

  return (
  <section aria-labelledby="inventory-bi-summary-title">
    <div className="mb-2">
      <h2 id="inventory-bi-summary-title" className={sectionTitleClassName}>
        Resumen ejecutivo
      </h2>
      <p className={sectionSubtitleClassName}>
        Estado actual del inventario según los filtros aplicados.
      </p>
    </div>
    <div
      aria-label="Indicadores ejecutivos"
      className="inventory-bi-kpi-grid grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-3"
    >
      {loading ? Array.from({ length: 5 }, (_, index) => (
        <div key={index} className={`${panelClassName} min-w-0 min-h-[104px]`}>
          <InventoryBiSkeleton className="h-3 w-2/5" label={`kpi-label-${index + 1}`} />
          <InventoryBiSkeleton className="mt-4 h-7 w-3/5" label={`kpi-value-${index + 1}`} />
          <InventoryBiSkeleton className="mt-3 h-3 w-4/5" label={`kpi-description-${index + 1}`} />
        </div>
      )) : cards.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className={`${panelClassName} min-w-0 min-h-[104px]`}>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-xs font-semibold leading-4 text-[var(--brand-surface-muted)]">{label}</p>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 min-w-0 whitespace-nowrap text-[clamp(1.1rem,1.8vw,1.75rem)] font-bold leading-none tabular-nums text-[var(--brand-surface-text)]">
            {error || value === null ? "No disponible" : value}
          </p>
        </div>
      ))}
    </div>
  </section>
  );
};

const CapitalDistributionShell = ({
  distribution,
  loading,
  error,
}: {
  distribution: InventoryBiCapitalDistributionResponse | null;
  loading: boolean;
  error: string | null;
}) => (
  <section aria-label="Distribución del capital">
    <div className="mb-3">
      <h2 className={sectionTitleClassName}>Distribución del capital</h2>
      <p className={sectionSubtitleClassName}>
        Costo actual distribuido por sucursal, categoría y producto.
      </p>
    </div>
    <div className="inventory-bi-capital-grid grid gap-4 lg:grid-cols-2">
      <InventoryBiSection title="Costo por sucursal" className="inventory-bi-capital-branch p-3.5">
        {loading ? (
          <InventoryBiSkeleton className="h-[176px] w-full" label="capital-branch" />
        ) : error ? (
          <p role="alert" className="text-sm text-rose-700">No fue posible cargar la distribución por sucursal.</p>
        ) : distribution?.branchDistribution.length ? (
          <div
            aria-label="Costo de inventario por sucursal"
            className="w-full"
            style={{ height: getCapitalChartHeight(distribution.branchDistribution.length) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distribution.branchDistribution.map((row) => ({
                  ...row,
                  chartCost: toChartNumber(row.totalCost),
                  label: row.branchName,
                  rawCost: row.totalCost,
                  labelCost: formatInventoryCurrency(row.totalCost) ?? "No disponible",
                }))}
                layout="vertical"
                margin={{ top: 4, right: 104, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dbe4ef" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="branchName" width={92} tick={{ fontSize: 11 }} />
                <Tooltip content={<CapitalChartTooltip />} />
                  <Bar dataKey="chartCost" name="Costo" fill="var(--inventory-bi-primary)" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="labelCost" position="right" fill="var(--brand-surface-text)" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[var(--brand-surface-muted)]">Sin datos para el filtro aplicado.</p>
        )}
      </InventoryBiSection>
      <InventoryBiSection title="Costo por categoría" className="inventory-bi-capital-category p-3.5">
        {loading ? (
          <InventoryBiSkeleton className="h-[176px] w-full" label="capital-category" />
        ) : error ? (
          <p role="alert" className="text-sm text-rose-700">No fue posible cargar la distribución por categoría.</p>
        ) : distribution?.categoryDistribution.length ? (
          <div
            aria-label="Costo de inventario por categoría"
            className="w-full"
            style={{ height: getCapitalChartHeight(distribution.categoryDistribution.length) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distribution.categoryDistribution.map((row) => ({
                  ...row,
                  chartCost: toChartNumber(row.totalCost),
                  label: row.categoryName,
                  rawCost: row.totalCost,
                  labelCost: formatInventoryCurrency(row.totalCost) ?? "No disponible",
                }))}
                layout="vertical"
                margin={{ top: 4, right: 104, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dbe4ef" />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="categoryName" width={92} tick={{ fontSize: 11 }} />
                <Tooltip content={<CapitalChartTooltip />} />
                  <Bar dataKey="chartCost" name="Costo" fill="var(--inventory-bi-primary)" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="labelCost" position="right" fill="var(--brand-surface-text)" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-[var(--brand-surface-muted)]">Sin datos para el filtro aplicado.</p>
        )}
      </InventoryBiSection>
      <InventoryBiSection title="Top productos" className="inventory-bi-capital-products p-3.5 lg:col-span-2">
        {loading ? (
          <InventoryBiSkeleton className="h-[176px] w-full" label="capital-products" />
        ) : error ? (
          <p role="alert" className="text-sm text-rose-700">No fue posible cargar el ranking de productos.</p>
        ) : distribution?.topProducts.length ? (
          <div className="w-full min-w-0">
            <table className="inventory-bi-top-products-table w-full table-fixed text-left text-sm">
              <caption className="sr-only">Top productos por costo de inventario</caption>
              <thead className="border-b border-[var(--brand-surface-border)] text-xs text-[var(--brand-surface-muted)]">
                <tr>
                  <th className="w-8 px-1 py-2 font-semibold">#</th>
                  <th className="px-1 py-2 font-semibold">Producto</th>
                  <th className="inventory-bi-top-products-sku w-[76px] px-1 py-2 font-semibold">SKU</th>
                  <th className="w-[136px] whitespace-nowrap px-1 py-2 text-right font-semibold">Costo</th>
                  <th className="w-[96px] whitespace-nowrap px-1 py-2 text-right font-semibold">Participación</th>
                </tr>
              </thead>
              <tbody>
                {distribution.topProducts.map((row) => (
                  <tr key={row.productId} className="border-b border-[var(--brand-surface-border)] last:border-0">
                    <td className="px-1 py-2 text-[var(--brand-surface-muted)]">{row.rank}</td>
                    <td
                      className="min-w-0 px-1 py-2 font-medium"
                      title={row.productName}
                      aria-label={row.productName}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <InventoryBiProductThumbnail
                          productId={row.productId}
                          productName={row.productName}
                        />
                        <span className="min-w-0 truncate">{row.productName}</span>
                      </div>
                    </td>
                    <td className="inventory-bi-top-products-sku truncate px-1 py-2 text-[var(--brand-surface-muted)]">{row.sku ?? "—"}</td>
                    <td className="w-[136px] whitespace-nowrap px-1 py-2 text-right font-semibold">
                      {formatInventoryCurrency(row.totalCost) ?? "No disponible"}
                    </td>
                    <td className="w-[96px] whitespace-nowrap px-1 py-2 text-right text-[var(--brand-surface-muted)]">
                      {formatPercent(row.participationPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--brand-surface-muted)]">Sin datos para el filtro aplicado.</p>
        )}
      </InventoryBiSection>
    </div>
  </section>
);

const OperationalHealthShellLegacy = () => (
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

const OperationalHealthCard = ({
  label,
  value,
  description,
  tone,
  active,
}: {
  label: string;
  value: string;
  description: string;
  tone: string;
  active: boolean;
}) => (
  <div className={`${panelClassName} min-w-0 min-h-[96px]`}>
    <div className="flex items-start justify-between gap-3">
      <p className="min-w-0 text-xs font-semibold leading-4 text-[var(--brand-surface-muted)]">{label}</p>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${active ? tone : "bg-slate-300"}`} aria-hidden="true" />
    </div>
    <p className="mt-3 whitespace-nowrap text-xl font-bold leading-none tabular-nums text-[var(--brand-surface-text)]">{value}</p>
    <p className="mt-2 text-xs leading-4 text-[var(--brand-surface-muted)]">{description}</p>
  </div>
);

const StockStatePanel = ({
  summary,
  loading,
  error,
}: {
  summary: InventoryBiSummaryResponse | null;
  loading: boolean;
  error: string | null;
}) => {
  const states = summary
    ? [
        { label: "Con stock", count: summary.productsWithStock, tone: "bg-emerald-500" },
        { label: "Agotados", count: summary.outOfStockProducts, tone: "bg-amber-500" },
        { label: "Stock negativo", count: summary.negativeStockProducts, tone: "bg-rose-500" },
      ]
    : [];
  const total = states.reduce((sum, state) => sum + state.count, 0);

  return (
    <InventoryBiSection
      title="Estado actual del stock"
      subtitle="Distribución descriptiva de productos según los filtros aplicados."
      className="inventory-bi-health-status lg:col-span-2"
    >
      {loading ? (
        <InventoryBiSkeleton className="h-[96px] w-full" label="health-status" />
      ) : error ? (
        <p role="alert" className="text-sm text-rose-700">No fue posible cargar el estado del stock.</p>
      ) : total === 0 ? (
        <p className="text-sm text-[var(--brand-surface-muted)]">No hay productos para el filtro aplicado.</p>
      ) : (
        <div aria-label="Distribución actual del stock" className="space-y-3">
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            {states.map((state) => (
              <div key={state.label} className={state.tone} style={{ width: `${(state.count / total) * 100}%` }} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {states.map((state) => (
              <div key={state.label} className="min-w-0">
                <p className="text-xs text-[var(--brand-surface-muted)]">{state.label}</p>
                <p className="mt-1 text-base font-bold tabular-nums text-[var(--brand-surface-text)]">
                  {state.count}
                  <span className="ml-1 text-xs font-normal text-[var(--brand-surface-muted)]">
                    {total ? `${((state.count / total) * 100).toFixed(1)}%` : "No disponible"}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </InventoryBiSection>
  );
};

const OperationalHealthShell = ({
  health,
  summary,
  loading,
  error,
  summaryLoading,
  summaryError,
}: {
  health: InventoryBiOperationalHealthResponse | null;
  summary: InventoryBiSummaryResponse | null;
  loading: boolean;
  error: string | null;
  summaryLoading: boolean;
  summaryError: string | null;
}) => (
  <section aria-label="Salud operativa">
    <div className="mb-3">
      <h2 className={sectionTitleClassName}>Salud operativa</h2>
      <p className={sectionSubtitleClassName}>
        Señales descriptivas de stock negativo, lotes vencidos y conciliación.
      </p>
    </div>
    <div className="inventory-bi-health-grid grid gap-4 lg:grid-cols-2">
      <div className="inventory-bi-health-cards grid gap-4 min-[480px]:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
        {loading ? Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={`${panelClassName} min-h-[96px]`}>
            <InventoryBiSkeleton className="h-3 w-2/5" label={`health-label-${index + 1}`} />
            <InventoryBiSkeleton className="mt-4 h-6 w-1/2" label={`health-value-${index + 1}`} />
          </div>
        )) : error ? (
          <div role="alert" className={`${panelClassName} min-h-[96px] text-sm text-rose-700`}>
            No fue posible cargar las señales operativas.
          </div>
        ) : health ? (
          <>
            <OperationalHealthCard label="Unidades en stock negativo" value={formatInventoryUnits(health.negativeUnits) ?? "No disponible"} description="Suma de unidades con existencias por debajo de cero." tone="bg-rose-500" active={health.negativeUnits !== "0"} />
            <OperationalHealthCard label="Discrepancias de conciliación" value={String(health.reconciliation.discrepancyCount)} description={`${health.reconciliation.criticalCount} críticas · ${health.reconciliation.highCount} altas`} tone="bg-amber-500" active={health.reconciliation.discrepancyCount > 0} />
            <OperationalHealthCard label="Lotes vencidos" value={String(health.expiredLotCount)} description="Lotes actualmente registrados como vencidos." tone="bg-orange-500" active={health.expiredLotCount > 0} />
          </>
        ) : null}
      </div>
      <StockStatePanel summary={summary} loading={summaryLoading} error={summaryError} />
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
  const [capitalDistribution, setCapitalDistribution] =
    useState<InventoryBiCapitalDistributionResponse | null>(null);
  const [operationalHealth, setOperationalHealth] =
    useState<InventoryBiOperationalHealthResponse | null>(null);
  const [summaryFilters, setSummaryFilters] = useState<InventoryBiFilters | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(Boolean(authTenantId));
  const [capitalLoading, setCapitalLoading] = useState(Boolean(authTenantId));
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [operationalHealthLoading, setOperationalHealthLoading] = useState(Boolean(authTenantId));
  const [operationalHealthError, setOperationalHealthError] = useState<string | null>(null);
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
    setCapitalLoading(true);
    setOperationalHealthLoading(true);
    setSummaryError(null);
    setCapitalError(null);
    setOperationalHealthError(null);
    try {
      const params = {
        tenantId: filters.requestedTenantId,
        branchId: filters.requestedBranchId || undefined,
        productIds: filters.productIds,
        categoryId: filters.categoryId || undefined,
        stockStatus: filters.stockStatus,
      } as const;
      const [summaryResult, capitalResult, operationalResult] = await Promise.allSettled([
        getInventoryBiSummary(params),
        getInventoryBiCapitalDistribution(params),
        getInventoryBiOperationalHealth(params),
      ]);
      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
        setSummaryError(null);
      } else {
        setSummaryError("No fue posible cargar los indicadores de inventario.");
      }
      if (capitalResult.status === "fulfilled") {
        setCapitalDistribution(capitalResult.value);
        setCapitalError(null);
      } else {
        setCapitalError("No fue posible cargar la distribución del capital.");
      }
      if (operationalResult.status === "fulfilled") {
        setOperationalHealth(operationalResult.value);
        setOperationalHealthError(null);
      } else {
        setOperationalHealthError("No fue posible cargar las señales operativas.");
      }
      if (summaryResult.status === "fulfilled" && capitalResult.status === "fulfilled") {
        setSummaryFilters(filters);
        setLastUpdated(new Date().toISOString());
      }
    } catch {
      setOperationalHealthError("No fue posible cargar las señales operativas.");
      setSummaryError("No fue posible cargar los indicadores de inventario.");
      setCapitalError("No fue posible cargar la distribución del capital.");
    } finally {
      setSummaryLoading(false);
      setCapitalLoading(false);
      setOperationalHealthLoading(false);
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
      className="inventory-bi-main min-h-full w-full space-y-5 bg-[var(--brand-background)] px-3 pb-7 pt-4 text-[var(--brand-surface-text)] sm:px-4 sm:pt-5 md:px-5 lg:px-5"
      aria-busy={viewState === "loading" || summaryLoading}
    >
      <InventoryBiHeader
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
      />
      {viewState === "error" || summaryError ? <InventoryBiErrorPanel onRetry={handleRetry} /> : null}
      <InventoryBiFiltersPanel onApply={handleApply} />
      <KpiShell summary={summary} loading={summaryLoading} error={summaryError} />
      <CapitalDistributionShell
        distribution={capitalDistribution}
        loading={capitalLoading}
        error={capitalError}
      />
      <OperationalHealthShell
        health={operationalHealth}
        summary={summary}
        loading={operationalHealthLoading}
        error={operationalHealthError}
        summaryLoading={summaryLoading}
        summaryError={summaryError}
      />
      <InventoryValuationCtaShell />
      <OperationalTableShell />
    </main>
  );
};
