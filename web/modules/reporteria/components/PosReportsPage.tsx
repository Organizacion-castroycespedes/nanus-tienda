"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { usePosReports } from "../hooks/use-pos-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { getPosSaleTicket } from "../services/reporting.service";
import type { PosSalesListRow } from "../types";
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

const PosReportsPage = () => {
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
  const { dataset, loading, searched, error, loadReports } = usePosReports();

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

  const columns = useMemo<DataTableColumn<PosSalesListRow>[]>(
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
            <p className="font-medium text-slate-900">{row.customerName || "Consumidor final"}</p>
            <p className="text-xs text-slate-500">Venta #{row.saleId.slice(0, 8)}</p>
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
        render: (row) => <span>{formatCurrency(row.paid)}</span>,
      },
      {
        key: "balance",
        header: "Saldo",
        render: (row) => <span>{formatCurrency(row.balance)}</span>,
      },
      {
        key: "status",
        header: "Estado",
        render: (row) => (
          <div className="space-y-2">
            <ReportStatusBadge value={row.status} />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Pago
              </p>
              <p className="text-sm text-slate-700">{row.paymentStatus}</p>
            </div>
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
                  title: `Ticket de venta ${row.saleId.slice(0, 8)}`,
                  fileName: `ticket-venta-${row.saleId}.pdf`,
                  getPdf: () => getPosSaleTicket(row.saleId),
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
                const blob = await getPosSaleTicket(row.saleId);
                downloadBlob(blob, `ticket-venta-${row.saleId}.pdf`);
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
      <FinanceAccessNotice description="No cuentas con permisos para consultar la reporteria POS." />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Reporteria POS</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Ventas y tickets POS</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Filtra ventas por rango y alcance operativo, revisa saldos y abre el ticket PDF generado por el backend.
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
        title="Descargar reporte POS para conciliacion"
        description="Exporta un archivo Excel con resumen y detalle de ventas, pagos, saldos y estado por transaccion."
        helper="Usa el mismo rango de fechas y alcance visible en pantalla para conciliar ventas contra caja o cartera."
        actions={[
          {
            label: "Descargar Excel",
            disabled: !canExport,
            onClick: () => {
              if (!dataset) {
                return;
              }

              downloadReportWorkbook({
                fileName: `reporte-pos-${tenantId}-${dateRange.from}-${dateRange.to}.xls`,
                summaryTitle: "Reporte POS",
                detailTitle: "Detalle de ventas POS",
                filters: [
                  { label: "Tenant", value: resolvedTenantLabel },
                  { label: "Sucursal", value: resolvedBranchLabel },
                  { label: "Desde", value: dateRange.from },
                  { label: "Hasta", value: dateRange.to },
                ],
                summary: [
                  { label: "Ventas", value: dataset.summary.count },
                  { label: "Total", value: dataset.summary.total },
                  { label: "Pagado", value: dataset.summary.paid },
                  { label: "Saldo", value: dataset.summary.balance },
                ],
                columns: [
                  "Fecha",
                  "Sucursal",
                  "Cliente",
                  "Venta ID",
                  "Total",
                  "Pagado",
                  "Saldo",
                  "Estado",
                  "Estado pago",
                ],
                rows: dataset.rows.map((row) => [
                  formatDateTime(row.date),
                  row.branchName ?? "",
                  row.customerName || "Consumidor final",
                  row.saleId,
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
          label="Ventas"
          value={dataset ? dataset.summary.count : searched ? 0 : "--"}
          helper="Cantidad de ventas encontradas."
          accent="blue"
        />
        <ReportMetricCard
          label="Total"
          value={dataset ? formatCurrency(dataset.summary.total) : searched ? "$ 0" : "--"}
          helper="Monto total facturado."
          accent="emerald"
        />
        <ReportMetricCard
          label="Pagado"
          value={dataset ? formatCurrency(dataset.summary.paid) : searched ? "$ 0" : "--"}
          helper="Pagos aplicados en el rango."
          accent="amber"
        />
        <ReportMetricCard
          label="Saldo"
          value={dataset ? formatCurrency(dataset.summary.balance) : searched ? "$ 0" : "--"}
          helper="Saldo pendiente segun el backend."
          accent="rose"
        />
      </section>

      <DataTable
        columns={columns}
        rows={dataset?.rows ?? []}
        getRowKey={(row) => row.saleId}
        loading={loading}
        error={error}
        emptyState={
          searched
            ? "No hay ventas POS para los filtros seleccionados."
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

export default PosReportsPage;
