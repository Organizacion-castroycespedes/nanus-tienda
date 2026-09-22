"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import InventoryBiFiltersPanel from "./InventoryBiFiltersPanel";
import type { InventoryValuationFilters } from "../state/inventoryBiFilters";

const panelClassName =
  "min-w-0 rounded-xl border border-[var(--brand-surface-border)] bg-[var(--brand-surface-card)] p-4 shadow-sm";

const Skeleton = ({ className }: { className: string }) => (
  <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
);
export const InventoryValuationShell = ({ tenantSegment }: { tenantSegment: string }) => (
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

    <InventoryValuationFiltersSection />

    <section aria-labelledby="valuation-summary-heading">
      <div className="mb-3">
        <h2 id="valuation-summary-heading" className="text-base font-bold leading-5">Resumen de valorización</h2>
        <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">Área reservada para indicadores reales del inventario filtrado.</p>
      </div>
      <div className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className={`${panelClassName} min-h-[104px]`}><Skeleton className="h-3 w-2/5" /><Skeleton className="mt-5 h-7 w-3/5" /></div>)}
      </div>
    </section>

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

const InventoryValuationFiltersSection = () => {
  const [, setAppliedFilters] = useState<InventoryValuationFilters | null>(null);

  return (
    <InventoryBiFiltersPanel
      title="Filtros de valorización"
      description="Define el alcance y los filtros para el inventario valorizado."
      appliedMessage="Filtros aplicados para valorización."
      includeOperationalFilters={false}
      onApply={(filters) => {
        setAppliedFilters({
          requestedTenantId: filters.requestedTenantId,
          requestedBranchId: filters.requestedBranchId,
          productIds: filters.productIds,
          categoryId: filters.categoryId,
          stockStatus: filters.stockStatus,
        });
      }}
    />
  );
};
