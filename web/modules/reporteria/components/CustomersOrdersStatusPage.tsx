"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useCustomersOrdersStatus } from "../hooks/use-customers-orders-status";
import { useReportingScope } from "../hooks/use-reporting-scope";
import type { CustomerOrdersStatusRow } from "../types";
import {
  downloadReportWorkbook,
  formatCurrency,
} from "../utils";
import { FiltersBar } from "./FiltersBar";
import { ReportExportCard } from "./ReportExportCard";
import { ReportMetricCard } from "./ReportMetricCard";

const CustomersOrdersStatusPage = () => {
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerName, setCustomerName] = useState("");
  const {
    canViewReports,
    showTenantSelector,
    showBranchSelector,
    tenantId,
    branchId,
    setTenantId,
    setBranchId,
    tenantOptions,
    branchOptions,
    loadingTenants,
    loadingBranches,
    resolvedTenantLabel,
    resolvedBranchLabel,
  } = useReportingScope();
  const { dataset, loading, searched, error, loadReports } = useCustomersOrdersStatus();

  const handleSearch = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    await loadReports({
      tenantId,
      branchId: branchId || undefined,
      customerDocument: customerDocument || undefined,
      customerName: customerName || undefined,
    });
  }, [branchId, customerDocument, customerName, loadReports, tenantId]);

  useEffect(() => {
    if (!canViewReports || !tenantId) {
      return;
    }

    void loadReports({
      tenantId,
      branchId: branchId || undefined,
      customerDocument: customerDocument || undefined,
      customerName: customerName || undefined,
    });
  }, [branchId, canViewReports, loadReports, tenantId]);

  const columns = useMemo<DataTableColumn<CustomerOrdersStatusRow>[]>(
    () => [
      {
        key: "customer",
        header: "Cliente",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{row.customerName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Cliente #{row.customerId.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        key: "totalOrders",
        header: "Total pedidos",
        render: (row) => row.totalOrders,
      },
      {
        key: "pendingOrders",
        header: "Pendientes",
        render: (row) => row.pendingOrders,
      },
      {
        key: "partialOrders",
        header: "Parciales",
        render: (row) => row.partialOrders,
      },
      {
        key: "completedOrders",
        header: "Completados",
        render: (row) => row.completedOrders,
      },
      {
        key: "totalAmount",
        header: "Monto total",
        render: (row) => formatCurrency(row.totalAmount),
      },
      {
        key: "totalPending",
        header: "Saldo pendiente",
        render: (row) => formatCurrency(row.totalPending),
      },
    ],
    []
  );

  const canExport = Boolean(dataset?.rows.length);

  if (!canViewReports) {
    return (
      <FinanceAccessNotice description="No cuentas con permisos para consultar clientes con pedidos." />
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Reporteria clientes</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Clientes con pedidos por estado</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Agrupa pedidos por cliente para identificar pendientes, parciales, completados y saldo total por cobrar.
        </p>
      </section>

      <section className="grid gap-6 ">
        <div className="min-w-0 w-full">
          <FiltersBar
            dateRange={{ from: "", to: "" }}
            onDateRangeChange={() => undefined}
            showDateRange={false}
            tenantId={tenantId}
            branchId={branchId}
            onTenantChange={setTenantId}
            onBranchChange={setBranchId}
            showTenantSelector={showTenantSelector}
            showBranchSelector={showBranchSelector}
            tenantOptions={tenantOptions}
            branchOptions={branchOptions}
            loadingTenants={loadingTenants}
            loadingBranches={loadingBranches}
            tenantLabel={resolvedTenantLabel}
            branchLabel={resolvedBranchLabel}
            isSearching={loading}
            extraFilters={
              <div className="grid w-full gap-4 sm:grid-cols-2">
                <Input
                  label="Documento"
                  placeholder="Buscar por documento"
                  value={customerDocument}
                  onChange={(event) => setCustomerDocument(event.target.value)}
                />
                <Input
                  label="Nombre"
                  placeholder="Buscar por nombre"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>
            }
            onSearch={() => void handleSearch()}
          />
        </div>

        <div className="min-w-0 w-full">
          <ReportExportCard
            title="Descargar clientes con pedidos para conciliacion"
            description="Genera un Excel agrupado por cliente con pedidos pendientes, parciales, completados y saldo consolidado."
            helper="Sirve para cartera, seguimiento comercial y conciliacion de pedidos por cliente."
            actions={[
              {
                label: "Descargar Excel",
                disabled: !canExport,
                onClick: () => {
                  if (!dataset) {
                    return;
                  }

                  downloadReportWorkbook({
                    fileName: `reporte-clientes-pedidos-${tenantId}.xls`,
                    summaryTitle: "Clientes con pedidos por estado",
                    detailTitle: "Detalle por cliente",
                    filters: [
                      { label: "Tenant", value: resolvedTenantLabel },
                      { label: "Sucursal", value: resolvedBranchLabel },
                      { label: "Documento", value: customerDocument || "-" },
                      { label: "Nombre", value: customerName || "-" },
                    ],
                    summary: [
                      { label: "Clientes", value: dataset.summary.count },
                      { label: "Pedidos", value: dataset.summary.totalOrders },
                      { label: "Pendientes", value: dataset.summary.pendingOrders },
                      { label: "Parciales", value: dataset.summary.partialOrders },
                      { label: "Completados", value: dataset.summary.completedOrders },
                      { label: "Monto total", value: dataset.summary.totalAmount },
                      { label: "Saldo pendiente", value: dataset.summary.totalPending },
                    ],
                    columns: [
                      "Cliente",
                      "Cliente ID",
                      "Total pedidos",
                      "Pendientes",
                      "Parciales",
                      "Completados",
                      "Monto total",
                      "Saldo pendiente",
                    ],
                    rows: dataset.rows.map((row) => [
                      row.customerName,
                      row.customerId,
                      row.totalOrders,
                      row.pendingOrders,
                      row.partialOrders,
                      row.completedOrders,
                      row.totalAmount,
                      row.totalPending,
                    ]),
                  });
                },
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetricCard
          label="Clientes"
          value={dataset ? dataset.summary.count : searched ? 0 : "--"}
          helper="Clientes con pedidos en el rango."
          accent="blue"
        />
        <ReportMetricCard
          label="Pedidos"
          value={dataset ? dataset.summary.totalOrders : searched ? 0 : "--"}
          helper="Total de pedidos agrupados."
          accent="emerald"
        />
        <ReportMetricCard
          label="Monto total"
          value={dataset ? formatCurrency(dataset.summary.totalAmount) : searched ? "$ 0" : "--"}
          helper="Valor total de pedidos."
          accent="amber"
        />
        <ReportMetricCard
          label="Pendiente"
          value={dataset ? formatCurrency(dataset.summary.totalPending) : searched ? "$ 0" : "--"}
          helper="Saldo pendiente consolidado."
          accent="rose"
        />
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:bg-slate-800 dark:border-slate-700">
        <DataTable
          columns={columns}
          rows={dataset?.rows ?? []}
          getRowKey={(row) => row.customerId}
          loading={loading}
          error={error}
          emptyState={
            searched
              ? "No hay clientes con pedidos para los filtros seleccionados."
              : "Usa los filtros y ejecuta la busqueda para cargar el reporte."
          }
        />
      </section>
    </div>
  );
};

export default CustomersOrdersStatusPage;
