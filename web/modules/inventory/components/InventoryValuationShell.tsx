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
  getInventoryBiValuationPage,
  type InventoryBiCapitalDistributionResponse,
  type InventoryBiSummaryResponse,
  type InventoryBiValuationPageResponse,
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

const valuationStatusLabel = (status: InventoryBiValuationPageResponse["items"][number]["stockStatus"]) => {
  if (status === "WITH_STOCK") return "Con stock";
  if (status === "OUT_OF_STOCK") return "Agotado";
  return "Stock negativo";
};

const valuationStatusClassName = (status: InventoryBiValuationPageResponse["items"][number]["stockStatus"]) => {
  if (status === "WITH_STOCK") return "bg-emerald-50 text-emerald-700";
  if (status === "OUT_OF_STOCK") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
};

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

type ValuationDetailProps = {
  page: InventoryBiValuationPageResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPageChange: (nextPage: number) => void;
};

const ValuationDetail = ({
  page,
  loading,
  error,
  onRetry,
  onPageChange,
}: ValuationDetailProps) => {
  const currentPage = page?.page ?? 1;
  const totalPages = page?.totalPages ?? 0;
  const start = page && page.total > 0 ? (currentPage - 1) * page.pageSize + 1 : 0;
  const end = page ? Math.min(currentPage * page.pageSize, page.total) : 0;

  return (
    <section aria-labelledby="valuation-detail-heading">
      <div className="mb-3">
        <h2 id="valuation-detail-heading" className="text-base font-bold leading-5">
          Detalle de valorización
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">
          Inventario valorizado por producto y sucursal.
        </p>
      </div>
      {loading ? (
        <div className={`${panelClassName} space-y-3`} aria-label="Cargando detalle de valorización" aria-busy="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className={`${panelClassName} flex flex-col gap-3 text-sm text-rose-700`} role="alert">
          <span>No fue posible cargar el detalle de valorización.</span>
          <Button variant="outline" size="sm" onClick={onRetry} className="w-full sm:w-fit">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </div>
      ) : !page || page.total === 0 ? (
        <div className={`${panelClassName} py-8 text-center text-sm text-[var(--brand-surface-muted)]`}>
          No hay productos para los filtros aplicados.
        </div>
      ) : (
        <div className={panelClassName}>
          <div className="valuation-detail-table hidden overflow-hidden rounded-lg border border-[var(--brand-surface-border)]">
            <table className="w-full table-fixed text-left text-xs">
              <caption className="sr-only">Detalle paginado de valorización de inventario</caption>
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[9%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[7%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead className="bg-slate-50 font-semibold text-[var(--brand-surface-muted)]">
                <tr>
                  {['Producto', 'SKU', 'Categoría', 'Sucursal', 'Stock', 'Costo unitario', 'Costo total', 'Part.', 'Estado'].map((label) => (
                    <th key={label} scope="col" className="px-2 py-3">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brand-surface-border)]">
                {page.items.map((item) => (
                  <tr key={`${item.productId}-${item.branchId}`}>
                    <td className="max-w-0 px-2 py-3 font-medium" title={item.productName}>
                      <div className="flex min-w-0 items-center gap-2">
                        <ValuationProductThumbnail productId={item.productId} productName={item.productName} />
                        <span className="min-w-0 truncate">{item.productName}</span>
                      </div>
                    </td>
                    <td className="truncate px-2 py-3 text-[var(--brand-surface-muted)]">{item.sku ?? "—"}</td>
                    <td className="truncate px-2 py-3 text-[var(--brand-surface-muted)]">{item.categoryName ?? "Sin categoría"}</td>
                    <td className="truncate px-2 py-3 text-[var(--brand-surface-muted)]">{item.branchName}</td>
                    <td className="whitespace-nowrap px-2 py-3 tabular-nums">{formatInventoryUnits(item.realStock) ?? "No disponible"}</td>
                    <td className="whitespace-nowrap px-2 py-3 tabular-nums">{formatInventoryCurrency(item.realUnitCost) ?? "No disponible"}</td>
                    <td className="whitespace-nowrap px-2 py-3 font-semibold tabular-nums">{formatInventoryCurrency(item.inventoryCost) ?? "No disponible"}</td>
                    <td className="whitespace-nowrap px-2 py-3 tabular-nums text-[var(--brand-surface-muted)]">{formatPercent(item.participationPercent)}</td>
                    <td className="px-2 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 font-semibold ${valuationStatusClassName(item.stockStatus)}`}>{valuationStatusLabel(item.stockStatus)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="valuation-detail-cards space-y-3" aria-label="Detalle paginado de valorización">
            {page.items.map((item) => (
              <article key={`${item.productId}-${item.branchId}`} className="rounded-lg border border-[var(--brand-surface-border)] p-3">
                <div className="flex items-start gap-3">
                  <ValuationProductThumbnail productId={item.productId} productName={item.productName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 truncate font-semibold" title={item.productName}>{item.productName}</h3>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${valuationStatusClassName(item.stockStatus)}`}>{valuationStatusLabel(item.stockStatus)}</span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div><dt className="text-[var(--brand-surface-muted)]">SKU</dt><dd className="truncate">{item.sku ?? "—"}</dd></div>
                      <div><dt className="text-[var(--brand-surface-muted)]">Sucursal</dt><dd className="truncate">{item.branchName}</dd></div>
                      <div><dt className="text-[var(--brand-surface-muted)]">Categoría</dt><dd className="truncate">{item.categoryName ?? "Sin categoría"}</dd></div>
                      <div><dt className="text-[var(--brand-surface-muted)]">Stock actual</dt><dd className="tabular-nums">{formatInventoryUnits(item.realStock) ?? "No disponible"}</dd></div>
                      <div><dt className="text-[var(--brand-surface-muted)]">Costo unitario</dt><dd className="whitespace-nowrap tabular-nums">{formatInventoryCurrency(item.realUnitCost) ?? "No disponible"}</dd></div>
                      <div><dt className="text-[var(--brand-surface-muted)]">Costo total</dt><dd className="whitespace-nowrap font-semibold tabular-nums">{formatInventoryCurrency(item.inventoryCost) ?? "No disponible"}</dd></div>
                      <div><dt className="text-[var(--brand-surface-muted)]">Participación</dt><dd className="tabular-nums">{formatPercent(item.participationPercent)}</dd></div>
                    </dl>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--brand-surface-border)] pt-3 text-xs text-[var(--brand-surface-muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>{start}-{end} de {page.total}</span>
            <div className="flex items-center gap-2">
              <span>Página {currentPage} de {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} aria-label="Página anterior">Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Página siguiente">Siguiente</Button>
            </div>
          </div>
        </div>
      )}
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
  const [valuationPage, setValuationPage] = useState<InventoryBiValuationPageResponse | null>(null);
  const [valuationPageLoading, setValuationPageLoading] = useState(false);
  const [valuationPageError, setValuationPageError] = useState<string | null>(null);
  const [valuationPageNumber, setValuationPageNumber] = useState(1);
  const [retryToken, setRetryToken] = useState(0);

  const handleApply = useCallback((filters: InventoryBiFilters) => {
    setValuationPageNumber(1);
    setAppliedFilters(toValuationFilters(filters));
  }, []);

  useEffect(() => {
    if (!appliedFilters) {
      setSummary(null);
      setSummaryError(null);
      setDistribution(null);
      setAnalyticsError(null);
      setValuationPage(null);
      setValuationPageError(null);
      return;
    }

    let active = true;
    setSummaryLoading(true);
    setSummaryError(null);
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    setValuationPageLoading(true);
    setValuationPageError(null);

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

    void getInventoryBiValuationPage({
      ...request,
      page: valuationPageNumber,
      pageSize: 10,
    })
      .then((result) => {
        if (active) setValuationPage(result);
      })
      .catch(() => {
        if (!active) return;
        setValuationPage(null);
        setValuationPageError("No fue posible cargar el detalle de valorización.");
      })
      .finally(() => {
        if (active) setValuationPageLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedFilters, retryToken, valuationPageNumber]);

  const handleValuationPageChange = useCallback((page: number) => {
    if (page >= 1 && page <= (valuationPage?.totalPages ?? Number.MAX_SAFE_INTEGER)) {
      setValuationPageNumber(page);
    }
  }, [valuationPage?.totalPages]);

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

      <ValuationDetail
        page={valuationPage}
        loading={valuationPageLoading}
        error={valuationPageError}
        onRetry={() => setRetryToken((token) => token + 1)}
        onPageChange={handleValuationPageChange}
      />
    </main>
  );
};
