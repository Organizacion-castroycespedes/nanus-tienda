"use client";

import { ArrowLeft, Boxes, CircleDollarSign, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import InventoryBiFiltersPanel from "./InventoryBiFiltersPanel";
import { InventoryImagePreview } from "./InventoryImagePreview";
import {
  getInventoryBiSummary,
  getInventoryBiCapitalDistribution,
  type InventoryBiCapitalDistributionResponse,
  type InventoryBiSummaryResponse,
} from "../services/dashboard.service";
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
import type {
  InventoryBiFilters,
  InventoryValuationFilters,
} from "../state/inventoryBiFilters";
import {
  formatInventoryCurrency,
  formatInventoryUnits,
} from "../utils/kpi-formatters";

const panelClassName =
  "min-w-0 rounded-xl border border-[var(--brand-surface-border)] bg-[var(--brand-surface-card)] p-4 shadow-sm";

const Skeleton = ({ className }: { className: string }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
);

const toChartNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= Number.MAX_SAFE_INTEGER ? parsed : 0;
};

const formatPercent = (value: string | null) => {
  if (value === null) return "No disponible";
  const formatted = formatInventoryUnits(value);
  return formatted === null ? "No disponible" : `${formatted}%`;
};

const getAnalyticsChartHeight = (rowCount: number) =>
  Math.min(Math.max(rowCount * 34 + 28, 132), 260);

const getProductInitials = (productName: string) => {
  const words = productName.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join("")
    : words[0]?.slice(0, 2) ?? "P";

  return initials.toUpperCase();
};

const ValuationProductThumbnail = ({
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

type ValuationCostTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: { label?: string; rawCost?: string } }>;
};

const ValuationCostTooltip = ({ active, payload }: ValuationCostTooltipProps) => {
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

const toValuationFilters = (filters: InventoryBiFilters): InventoryValuationFilters => ({
  requestedTenantId: filters.requestedTenantId,
  requestedBranchId: filters.requestedBranchId,
  productIds: filters.productIds,
  categoryId: filters.categoryId,
  stockStatus: filters.stockStatus,
});

type ValuationSummaryProps = {
  appliedFilters: InventoryValuationFilters | null;
  summary: InventoryBiSummaryResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

const ValuationSummary = ({
  appliedFilters,
  summary,
  loading,
  error,
  onRetry,
}: ValuationSummaryProps) => {
  if (!appliedFilters) {
    return (
      <section className={panelClassName} aria-labelledby="valuation-summary-heading">
        <h2 id="valuation-summary-heading" className="text-base font-bold leading-5">
          Resumen de valorización
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">
          Aplica filtros para consultar la valorización actual del inventario.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={panelClassName} aria-labelledby="valuation-summary-heading" role="alert">
        <h2 id="valuation-summary-heading" className="text-base font-bold leading-5">
          Resumen de valorización
        </h2>
        <p className="mt-1 text-sm text-rose-700">No fue posible cargar el resumen de valorización.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
      </section>
    );
  }

  const cards = [
    {
      label: "Costo total valorizado",
      value: summary ? formatInventoryCurrency(summary.totalInventoryCost) : null,
      description: "Suma del costo actual del inventario filtrado.",
      icon: CircleDollarSign,
      accent: "text-[var(--brand-primary)] bg-[var(--brand-primary-soft-bg)]",
    },
    {
      label: "Unidades valorizadas",
      value: summary ? formatInventoryUnits(summary.totalInventoryUnits) : null,
      description: "Suma de existencias actuales del inventario filtrado.",
      icon: Boxes,
      accent: "text-emerald-700 bg-emerald-50",
    },
  ];

  return (
    <section aria-labelledby="valuation-summary-heading" aria-busy={loading}>
      <div className="mb-3">
        <h2 id="valuation-summary-heading" className="text-base font-bold leading-5">
          Resumen de valorización
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">
          Valores actuales según los filtros aplicados.
        </p>
      </div>
      <div className="grid gap-3 min-[480px]:grid-cols-2">
        {cards.map(({ label, value, description, icon: Icon, accent }) => (
          <div key={label} className={`${panelClassName} min-h-[112px]`}>
            {loading ? (
              <>
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="mt-5 h-7 w-3/5" />
                <Skeleton className="mt-3 h-3 w-4/5" />
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--brand-surface-muted)]">{label}</p>
                    <p className="mt-2 min-w-0 whitespace-nowrap text-[clamp(1.05rem,2.2cqw,1.7rem)] font-bold leading-none tabular-nums text-[var(--brand-surface-text)]">
                      {value ?? "No disponible"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--brand-surface-muted)]">{description}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

type ValuationAnalyticsProps = {
  appliedFilters: InventoryValuationFilters | null;
  summary: InventoryBiSummaryResponse | null;
  distribution: InventoryBiCapitalDistributionResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

const ValuationAnalytics = ({
  appliedFilters,
  summary,
  distribution,
  loading,
  error,
  onRetry,
}: ValuationAnalyticsProps) => {
  if (!appliedFilters) {
    return (
      <section className={panelClassName} aria-labelledby="valuation-analytics-heading">
        <h2 id="valuation-analytics-heading" className="text-base font-bold leading-5">
          Analítica de valorización
        </h2>
        <p className="mt-1 text-[13px] text-[var(--brand-surface-muted)]">
          Aplica filtros para consultar la distribución del inventario valorizado.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={panelClassName} aria-labelledby="valuation-analytics-heading" role="alert">
        <h2 id="valuation-analytics-heading" className="text-base font-bold leading-5">
          Analítica de valorización
        </h2>
        <p className="mt-1 text-sm text-rose-700">No fue posible cargar la analítica de valorización.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
      </section>
    );
  }

  if (loading) {
    return (
      <section aria-labelledby="valuation-analytics-heading" aria-busy="true">
        <div className="mb-3">
          <h2 id="valuation-analytics-heading" className="text-base font-bold leading-5">Analítica de valorización</h2>
          <p className="mt-1 text-[13px] text-[var(--brand-surface-muted)]">Distribución actual según los filtros aplicados.</p>
        </div>
        <div className="valuation-analytics-grid grid gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className={`${panelClassName} min-h-[190px]`}>
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-5 h-36 w-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const branchData = (distribution?.branchDistribution ?? []).map((row) => ({
    label: row.branchName,
    rawCost: row.totalCost,
    chartCost: toChartNumber(row.totalCost),
  }));
  const categoryData = (distribution?.categoryDistribution ?? []).map((row) => ({
    label: row.categoryName,
    rawCost: row.totalCost,
    chartCost: toChartNumber(row.totalCost),
  }));
  const states = summary
    ? [
        { label: "Con stock", count: summary.productsWithStock, tone: "bg-emerald-500" },
        { label: "Agotados", count: summary.outOfStockProducts, tone: "bg-amber-500" },
        { label: "Stock negativo", count: summary.negativeStockProducts, tone: "bg-rose-500" },
      ]
    : [];
  const statusTotal = states.reduce((total, state) => total + state.count, 0);

  return (
    <section aria-labelledby="valuation-analytics-heading">
      <div className="mb-3">
        <h2 id="valuation-analytics-heading" className="text-base font-bold leading-5">Analítica de valorización</h2>
        <p className="mt-1 text-[13px] text-[var(--brand-surface-muted)]">Distribución actual según los filtros aplicados.</p>
      </div>
      <div className="valuation-analytics-grid grid items-start gap-4">
        <div className={panelClassName}>
          <h3 className="text-sm font-bold">Costo por sucursal</h3>
          {branchData.length ? (
            <div className="mt-3 w-full" style={{ height: getAnalyticsChartHeight(branchData.length) }} aria-label="Costo por sucursal">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchData} layout="vertical" margin={{ top: 4, right: 104, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dbe4ef" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ValuationCostTooltip />} />
                  <Bar dataKey="chartCost" name="Costo" fill="var(--inventory-bi-primary)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="rawCost" position="right" formatter={(value: string | number) => formatInventoryCurrency(String(value)) ?? "No disponible"} fill="var(--brand-surface-text)" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="mt-3 text-sm text-[var(--brand-surface-muted)]">Sin datos para el filtro aplicado.</p>}
        </div>

        <div className={panelClassName}>
          <h3 className="text-sm font-bold">Costo por categoría</h3>
          {categoryData.length ? (
            <div className="mt-3 w-full" style={{ height: getAnalyticsChartHeight(categoryData.length) }} aria-label="Costo por categoría">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 104, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#dbe4ef" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ValuationCostTooltip />} />
                  <Bar dataKey="chartCost" name="Costo" fill="var(--inventory-bi-primary)" radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="rawCost" position="right" formatter={(value: string | number) => formatInventoryCurrency(String(value)) ?? "No disponible"} fill="var(--brand-surface-text)" fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="mt-3 text-sm text-[var(--brand-surface-muted)]">Sin datos para el filtro aplicado.</p>}
        </div>

        <div className={`${panelClassName} valuation-analytics-top-products`}>
          <h3 className="text-sm font-bold">Top productos por costo</h3>
          {distribution?.topProducts.length ? (
            <ol className="mt-3 space-y-1.5" aria-label="Top productos por costo de inventario">
              {distribution.topProducts.map((product) => (
                <li key={product.productId} className="grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-2 border-b border-[var(--brand-surface-border)] pb-1.5 last:border-0">
                  <span className="text-xs font-semibold text-[var(--brand-surface-muted)]">{product.rank}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <ValuationProductThumbnail
                      productId={product.productId}
                      productName={product.productName}
                    />
                    <span className="min-w-0 truncate" title={product.productName} aria-label={product.productName}>{product.productName}</span>
                  </div>
                  <span className="min-w-0 text-right text-[11px] font-semibold leading-4 tabular-nums sm:whitespace-nowrap">
                    <span className="block sm:inline">{formatInventoryCurrency(product.totalCost) ?? "No disponible"}</span>
                    <span className="ml-0 block font-normal text-[var(--brand-surface-muted)] sm:ml-2 sm:inline">{formatPercent(product.participationPercent)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-[var(--brand-surface-muted)]">Sin datos para el filtro aplicado.</p>}
        </div>

        <div className={`${panelClassName} valuation-analytics-status`}>
          <h3 className="text-sm font-bold">Distribución por estado</h3>
          {statusTotal === 0 ? (
            <p className="mt-3 text-sm text-[var(--brand-surface-muted)]">Sin productos para el filtro aplicado.</p>
          ) : (
            <div className="mt-3 space-y-3" aria-label="Distribución de productos por estado">
              {states.map((state) => {
                const percentage = (state.count / statusTotal) * 100;
                return (
                  <div key={state.label}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span>{state.label}</span>
                      <span className="tabular-nums text-[var(--brand-surface-muted)]">{state.count} · {percentage.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden="true">
                      <div className={`h-2 rounded-full ${state.tone}`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export const InventoryValuationShell = ({ tenantSegment }: { tenantSegment: string }) => {
  const [appliedFilters, setAppliedFilters] = useState<InventoryValuationFilters | null>(null);
  const [summary, setSummary] = useState<InventoryBiSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<InventoryBiCapitalDistributionResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const handleApply = useCallback((filters: InventoryBiFilters) => {
    setAppliedFilters(toValuationFilters(filters));
  }, []);

  useEffect(() => {
    if (!appliedFilters) {
      setSummary(null);
      setSummaryError(null);
      setDistribution(null);
      setAnalyticsError(null);
      return;
    }

    let active = true;
    setSummaryLoading(true);
    setSummaryError(null);
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    const request = {
      tenantId: appliedFilters.requestedTenantId,
      branchId: appliedFilters.requestedBranchId || undefined,
      productIds: appliedFilters.productIds,
      categoryId: appliedFilters.categoryId || undefined,
      stockStatus: appliedFilters.stockStatus,
    };

    void getInventoryBiSummary(request)
      .then((result) => {
        if (!active) return;
        setSummary(result);
      })
      .catch(() => {
        if (!active) return;
        setSummary(null);
        setSummaryError("No fue posible cargar el resumen de valorización.");
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });

    void getInventoryBiCapitalDistribution(request)
      .then((result) => {
        if (active) setDistribution(result);
      })
      .catch(() => {
        if (!active) return;
        setDistribution(null);
        setAnalyticsError("No fue posible cargar la analítica de valorización.");
      })
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, retryToken]);

  return (
    <main
      className="inventory-bi-main min-h-full w-full space-y-5 bg-[var(--brand-background)] px-3 pb-7 pt-4 text-[var(--brand-surface-text)] sm:px-4 sm:pt-5 md:px-5 lg:px-5"
      aria-labelledby="inventory-valuation-heading"
    >
      <header className="flex flex-col gap-4">
        <Link
          href={`/${tenantSegment}/inventory`}
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a Inventario
        </Link>
        <div>
          <h1 id="inventory-valuation-heading" className="text-xl font-bold leading-[1.15] tracking-[-0.02em] text-[var(--brand-surface-text)] sm:text-2xl lg:text-[26px]">
            Valorización de Inventario
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-[var(--brand-surface-muted)] sm:text-sm">
            Reporte ejecutivo del inventario a valor de costo
          </p>
        </div>
      </header>

      <InventoryBiFiltersPanel
        title="Filtros de valorización"
        description="Define el alcance y los filtros para el inventario valorizado."
        appliedMessage="Filtros aplicados para valorización."
        includeOperationalFilters={false}
        onApply={handleApply}
      />

      <ValuationSummary
        appliedFilters={appliedFilters}
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        onRetry={() => setRetryToken((token) => token + 1)}
      />

      <ValuationAnalytics
        appliedFilters={appliedFilters}
        summary={summary}
        distribution={distribution}
        loading={analyticsLoading}
        error={analyticsError}
        onRetry={() => setRetryToken((token) => token + 1)}
      />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Detalle de valorización">
        <div className={`${panelClassName} lg:col-span-2`}>
          <h2 className="text-base font-bold leading-5">Detalle de valorización</h2>
          <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">Área reservada para el detalle operativo valorizado.</p>
          <div className="mt-4 space-y-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
        </div>
      </section>
    </main>
  );
};
