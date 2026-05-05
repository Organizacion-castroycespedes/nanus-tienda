"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useOrdersReports } from "../hooks/use-orders-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { getOrderSaleTicket } from "../services/reporting.service";
import type { OrderSalesListRow } from "../types";
import {
  downloadBlob,
  downloadReportWorkbook,
  formatCurrency,
  formatDateTime,
  getTodayRange,
} from "../utils";
import { FiltersBar } from "./FiltersBar";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { ReportExportCard } from "./ReportExportCard";
import { ReportMetricCard } from "./ReportMetricCard";
import { ReportStatusBadge } from "./ReportStatusBadge";

type PdfConfig = {
  title: string;
  fileName: string;
  getPdf: () => Promise<Blob>;
};

const OrdersReportsPage = () => {
  const initialRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState(initialRange);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
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
  const { dataset, loading, searched, error, loadReports } = useOrdersReports();

  const handleSearch = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    await loadReports({
      tenantId,
      branchId: branchId || undefined,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
    });
  }, [branchId, dateRange.from, dateRange.to, loadReports, tenantId]);

  useEffect(() => {
    if (!canViewReports || !tenantId) {
      return;
    }

    void loadReports({
      tenantId,
      branchId: branchId || undefined,
      dateFrom: initialRange.from,
      dateTo: initialRange.to,
    });
  }, [branchId, canViewReports, initialRange, loadReports, tenantId]);

  const columns = useMemo<DataTableColumn<OrderSalesListRow>[]>(
    () => [
      {
        key: "date",
        header: "Fecha",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900">{formatDateTime(row.date)}</p>
            <p className="text-xs text-slate-500">{row.branchName ?? "Sucursal"}</p>
          </div>
        ),
      },
      {
        key: "customer",
        header: "Cliente",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900">{row.customerName || "Cliente sin nombre"}</p>
            <p className="text-xs text-slate-500">Pedido #{row.orderId.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        key: "total",
        header: "Total",
        render: (row) => <span className="font-medium text-slate-900">{formatCurrency(row.total)}</span>,
      },
      {
        key: "paid",
        header: "Pagado",
        render: (row) => formatCurrency(row.paid),
      },
      {
        key: "balance",
        header: "Saldo",
        render: (row) => formatCurrency(row.balance),
      },
      {
        key: "status",
        header: "Estado",
        render: (row) => (
          <div className="space-y-2">
            <ReportStatusBadge value={row.status} />
            <p className="text-sm text-slate-700">{row.paymentStatus}</p>
            <p className="text-xs text-slate-500">
              {row.generatedSaleId ? `Venta ${row.generatedSaleId.slice(0, 8)}` : "Sin venta generada"}
            </p>
          </div>
        ),
      },
      {
        key: "actions",
        header: "Acciones",
        cellClassName: "min-w-[200px]",
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPdfConfig({
                  title: `Ticket de pedido ${row.orderId.slice(0, 8)}`,
                  fileName: `ticket-pedido-${row.orderId}.pdf`,
                  getPdf: () => getOrderSaleTicket(row.orderId),
                })
              }
            >
              <Eye className="h-4 w-4" />
              Ver ticket
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const blob = await getOrderSaleTicket(row.orderId);
                downloadBlob(blob, `ticket-pedido-${row.orderId}.pdf`);
              }}
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const canExport = Boolean(dataset?.rows.length);

  if (!canViewReports) {
    return (
      <FinanceAccessNotice description="No cuentas con permisos para consultar la reporteria de pedidos." />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Reporteria pedidos</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Pedidos y venta generada</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Revisa pedidos por estado, pagos y venta asociada cuando ya fue generada desde operacion.
        </p>
      </section>

      <FiltersBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
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
        onSearch={() => void handleSearch()}
      />

      <ReportExportCard
        title="Descargar reporte de pedidos para conciliacion"
        description="Baja un Excel con pedidos, venta generada, pagos aplicados y estado operativo para conciliacion comercial."
        helper="Pensado para contrastar pedido original, cobranza y venta final generada."
        actions={[
          {
            label: "Descargar Excel",
            disabled: !canExport,
            onClick: () => {
              if (!dataset) {
                return;
              }

              downloadReportWorkbook({
                fileName: `reporte-pedidos-${tenantId}-${dateRange.from}-${dateRange.to}.xls`,
                summaryTitle: "Reporte de pedidos",
                detailTitle: "Detalle de pedidos",
                filters: [
                  { label: "Tenant", value: resolvedTenantLabel },
                  { label: "Sucursal", value: resolvedBranchLabel },
                  { label: "Desde", value: dateRange.from },
                  { label: "Hasta", value: dateRange.to },
                ],
                summary: [
                  { label: "Pedidos", value: dataset.summary.count },
                  { label: "Total", value: dataset.summary.total },
                  { label: "Pagado", value: dataset.summary.paid },
                  { label: "Saldo", value: dataset.summary.balance },
                  { label: "Completados", value: dataset.summary.completed },
                  { label: "Parciales", value: dataset.summary.partial },
                  { label: "Pendientes", value: dataset.summary.pending },
                ],
                columns: [
                  "Fecha",
                  "Sucursal",
                  "Cliente",
                  "Pedido ID",
                  "Venta generada",
                  "Total",
                  "Pagado",
                  "Saldo",
                  "Estado",
                  "Estado pago",
                ],
                rows: dataset.rows.map((row) => [
                  formatDateTime(row.date),
                  row.branchName ?? "",
                  row.customerName,
                  row.orderId,
                  row.generatedSaleId ?? "",
                  row.total,
                  row.paid,
                  row.balance,
                  row.status,
                  row.paymentStatus,
                ]),
              });
            },
          },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetricCard
          label="Pedidos"
          value={dataset ? dataset.summary.count : searched ? 0 : "--"}
          helper="Pedidos encontrados en el rango."
          accent="blue"
        />
        <ReportMetricCard
          label="Completados"
          value={dataset ? dataset.summary.completed : searched ? 0 : "--"}
          helper="Pedidos completados."
          accent="emerald"
        />
        <ReportMetricCard
          label="Parciales"
          value={dataset ? dataset.summary.partial : searched ? 0 : "--"}
          helper="Pedidos con pago o entrega parcial."
          accent="amber"
        />
        <ReportMetricCard
          label="Pendientes"
          value={dataset ? dataset.summary.pending : searched ? 0 : "--"}
          helper="Pedidos pendientes de completar."
          accent="rose"
        />
      </section>

      <DataTable
        columns={columns}
        rows={dataset?.rows ?? []}
        getRowKey={(row) => row.orderId}
        loading={loading}
        error={error}
        emptyState={
          searched
            ? "No hay pedidos para los filtros seleccionados."
            : "Usa los filtros y ejecuta la busqueda para cargar el reporte."
        }
      />

      {pdfConfig ? (
        <PdfPreviewModal
          isOpen={Boolean(pdfConfig)}
          title={pdfConfig.title}
          fileName={pdfConfig.fileName}
          getPdf={pdfConfig.getPdf}
          onClose={() => setPdfConfig(null)}
        />
      ) : null}
    </div>
  );
};

export default OrdersReportsPage;
