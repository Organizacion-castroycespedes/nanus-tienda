"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Select } from "../../../components/design-system/Select";
import { useAppSelector } from "../../../store/hooks";
import { useOperationalSales } from "../hooks/use-operational-sales";
import {
  ELECTRONIC_BILLING_STATUSES,
  PAYMENT_STATUSES,
  SALE_STATUSES,
  type OperationalSaleListItem,
} from "../types";

const labels: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  REFUNDED: "Devuelta",
  PENDING: "Pendiente",
  PAID: "Pagada",
  PARTIAL: "Parcial",
  PROCESSING: "Procesando",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
  TECHNICAL_ERROR: "Error técnico",
};

const statusLabel = (value: string) => labels[value.toUpperCase()] ?? value;

const StatusBadge = ({ value }: { value: string }) => (
  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
    {statusLabel(value)}
  </span>
);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value)
  );

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);

const scopeCopy: Record<string, string> = {
  USER: "Ventas de mi turno actual",
  ADMIN: "Ventas de la sucursal",
  SUPER_USER: "Ventas del tenant",
  SUPER_ADMIN: "Ventas del contexto global autorizado",
};

export const OperationalSalesPage = () => {
  const params = useParams<{ tenant: string }>();
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const {
    data,
    filters,
    loading,
    error,
    page,
    setPage,
    resetFilters,
    updateFilter,
    toggleSort,
  } = useOperationalSales();
  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  const hasFilters = Object.values(filters).some(Boolean);
  const emptyState = hasFilters
    ? "No encontramos ventas con los filtros seleccionados."
    : "No hay ventas en el alcance operativo actual.";

  const columns = useMemo<DataTableColumn<OperationalSaleListItem>[]>(
    () => [
      {
        key: "createdAt",
        header: <button type="button" onClick={() => toggleSort("createdAt")}>Fecha / hora</button>,
        render: (sale) => <span className="whitespace-nowrap">{formatDate(sale.createdAt)}</span>,
      },
      {
        key: "sale",
        header: "Venta",
        render: (sale) => (
          <Link className="font-semibold text-blue-700 hover:underline" href={`/${params.tenant}/operations/sales/${sale.id}`}>
            {sale.id.slice(0, 8)}
          </Link>
        ),
      },
      {
        key: "customer",
        header: "Cliente",
        render: (sale) => sale.customer.name ?? "Sin cliente",
      },
      {
        key: "status",
        header: <button type="button" onClick={() => toggleSort("status")}>Estado</button>,
        render: (sale) => <StatusBadge value={sale.status} />,
      },
      {
        key: "payment",
        header: "Pago",
        render: (sale) => statusLabel(sale.paymentStatus),
      },
      {
        key: "branch",
        header: "Sucursal",
        render: (sale) => sale.branch.name ?? "Sin sucursal",
      },
      {
        key: "operator",
        header: "Operador",
        render: (sale) => sale.operator.email ?? "Sin operador",
      },
      {
        key: "electronicBilling",
        header: "Facturación electrónica",
        render: (sale) =>
          sale.electronicBilling ? (
            <div className="space-y-1">
              <StatusBadge value={sale.electronicBilling.status} />
              {sale.electronicBilling.documentNumber ? (
                <p className="text-xs text-slate-500">{sale.electronicBilling.documentNumber}</p>
              ) : null}
            </div>
          ) : (
            <span className="text-slate-500">Sin solicitar</span>
          ),
      },
      {
        key: "total",
        header: <button type="button" onClick={() => toggleSort("total")}>Total</button>,
        className: "text-right",
        cellClassName: "text-right font-semibold",
        render: (sale) => formatMoney(sale.total),
      },
    ],
    [toggleSort]
  );

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Gestión Operativa</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Ventas</h1>
            <p className="mt-1 text-sm text-slate-500">{scopeCopy[role.toUpperCase()] ?? "Ventas del alcance autorizado"}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Solo lectura</span>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6" aria-label="Filtros de ventas">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-2 text-sm text-slate-700"><span className="font-medium">Desde</span><input aria-label="Desde" type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="flex flex-col gap-2 text-sm text-slate-700"><span className="font-medium">Hasta</span><input aria-label="Hasta" type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2" /></label>
          <Select label="Estado de venta" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Todos</option>{SALE_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select>
          <Select label="Estado de pago" value={filters.paymentStatus} onChange={(event) => updateFilter("paymentStatus", event.target.value)}><option value="">Todos</option>{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select>
          <Select label="Facturación electrónica" value={filters.electronicBillingStatus} onChange={(event) => updateFilter("electronicBillingStatus", event.target.value)}><option value="">Todos</option>{ELECTRONIC_BILLING_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select>
          <label className="flex flex-col gap-2 text-sm text-slate-700"><span className="font-medium">Número fiscal</span><input aria-label="Número fiscal" value={filters.documentNumber} onChange={(event) => updateFilter("documentNumber", event.target.value)} placeholder="Buscar número" className="rounded-lg border border-slate-200 px-3 py-2" /></label>
          <label className="flex flex-col gap-2 text-sm text-slate-700"><span className="font-medium">Método de pago</span><input aria-label="Método de pago" value={filters.paymentMethod} onChange={(event) => updateFilter("paymentMethod", event.target.value)} placeholder="Ej. CASH" className="rounded-lg border border-slate-200 px-3 py-2" /></label>
          <div className="flex items-end"><button type="button" onClick={resetFilters} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Limpiar filtros</button></div>
        </div>
      </section>

      <DataTable columns={columns} rows={data.items} getRowKey={(sale) => sale.id} loading={loading} error={error} emptyState={emptyState} loadingState="Cargando ventas operativas..." />

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <span>{data.total} ventas · Página {page} de {totalPages}</span>
        <div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50">Anterior</button><button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50">Siguiente</button></div>
      </footer>
    </main>
  );
};
