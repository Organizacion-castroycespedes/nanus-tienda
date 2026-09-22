"use client";

import { ArrowLeft, Boxes, CircleDollarSign, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import InventoryBiFiltersPanel from "./InventoryBiFiltersPanel";
import {
  getInventoryBiSummary,
  type InventoryBiSummaryResponse,
} from "../services/dashboard.service";
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

export const InventoryValuationShell = ({ tenantSegment }: { tenantSegment: string }) => {
  const [appliedFilters, setAppliedFilters] = useState<InventoryValuationFilters | null>(null);
  const [summary, setSummary] = useState<InventoryBiSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const handleApply = useCallback((filters: InventoryBiFilters) => {
    setAppliedFilters(toValuationFilters(filters));
  }, []);

  useEffect(() => {
    if (!appliedFilters) {
      setSummary(null);
      setSummaryError(null);
      return;
    }

    let active = true;
    setSummaryLoading(true);
    setSummaryError(null);

    void getInventoryBiSummary({
      tenantId: appliedFilters.requestedTenantId,
      branchId: appliedFilters.requestedBranchId || undefined,
      productIds: appliedFilters.productIds,
      categoryId: appliedFilters.categoryId || undefined,
      stockStatus: appliedFilters.stockStatus,
    })
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

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Analítica y detalle de valorización">
        <div className={panelClassName}>
          <h2 className="text-base font-bold leading-5">Analítica de valorización</h2>
          <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">Área reservada para análisis del capital a valor de costo.</p>
          <Skeleton className="mt-4 h-48 w-full" />
        </div>
        <div className={panelClassName}>
          <h2 className="text-base font-bold leading-5">Detalle de valorización</h2>
          <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">Área reservada para el detalle operativo valorizado.</p>
          <div className="mt-4 space-y-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
        </div>
      </section>
    </main>
  );
};
