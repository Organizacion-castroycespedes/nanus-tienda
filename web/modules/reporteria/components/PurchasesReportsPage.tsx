"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Select } from "../../../components/design-system/Select";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { usePurchasesReports } from "../hooks/use-purchases-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { getPurchaseTicket } from "../services/reporting.service";
import type { PurchasesListRow } from "../types";
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

const PurchasesReportsPage = () => {
  const initialRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState(initialRange);
  const [status, setStatus] = useState("");
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
  const { dataset, loading, searched, error, loadReports } = usePurchasesReports();

  const handleSearch = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    await loadReports({
      tenantId,
      branchId: branchId || undefined,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      status: status || undefined,
    });
  }, [branchId, dateRange.from, dateRange.to, loadReports, status, tenantId]);

  useEffect(() => {
    if (!canViewReports || !tenantId) {
      return;
    }

    void loadReports({
      tenantId,
      branchId: branchId || undefined,
      dateFrom: initialRange.from,
      dateTo: initialRange.to,
      status: status || undefined,
    });
  }, [branchId, canViewReports, initialRange, loadReports, status, tenantId]);

  const columns = useMemo<DataTableColumn<PurchasesListRow>[]>(
    () => [
      {
        key: "date",
        header: "Fecha",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(row.date)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.branchName ?? "Sucursal"}</p>
          </div>
        ),
      },
      {
        key: "supplier",
        header: "Proveedor",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{row.supplierName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Compra #{row.purchaseId.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        key: "total",
        header: "Total",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{formatCurrency(row.total)}</p>
            {row.status === "CERRADA_PARCIAL" ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pedido: {formatCurrency(row.totalPedido ?? row.total)}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        key: "difference",
        header: "No recibido",
        render: (row) => formatCurrency(row.diferenciaNoRecibida ?? 0),
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
            <p className="text-sm text-slate-700 dark:text-slate-200">{row.paymentStatus}</p>
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
                  title: `Ticket de compra ${row.purchaseId.slice(0, 8)}`,
                  fileName: `ticket-compra-${row.purchaseId}.pdf`,
                  getPdf: () => getPurchaseTicket(row.purchaseId),
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
                const blob = await getPurchaseTicket(row.purchaseId);
                downloadBlob(blob, `ticket-compra-${row.purchaseId}.pdf`);
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
      <FinanceAccessNotice description="No cuentas con permisos para consultar la reporteria de compras." />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Reporteria compras</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Compras y tickets de proveedor</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Consulta compras por rango y alcance operativo, valida pagos reales y abre el ticket PDF.
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
        extraFilters={
          <Select
            label="Estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="PENDING">PENDING</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="CERRADA_PARCIAL">CERRADA_PARCIAL</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
        }
        onSearch={() => void handleSearch()}
      />

      <ReportExportCard
        title="Descargar reporte de compras para conciliacion"
        description="Exporta compras con proveedor, pagos reales, saldo pendiente y estado de pago en un archivo Excel estructurado."
        helper="Util para conciliar cuentas por pagar, pagos a proveedor y recepcion de mercancia."
        actions={[
          {
            label: "Descargar Excel",
            disabled: !canExport,
            onClick: () => {
              if (!dataset) {
                return;
              }

              downloadReportWorkbook({
                fileName: `reporte-compras-${tenantId}-${dateRange.from}-${dateRange.to}.xls`,
                summaryTitle: "Reporte de compras",
                detailTitle: "Detalle de compras",
                filters: [
                  { label: "Tenant", value: resolvedTenantLabel },
                  { label: "Sucursal", value: resolvedBranchLabel },
                  { label: "Desde", value: dateRange.from },
                  { label: "Hasta", value: dateRange.to },
                  { label: "Estado", value: status || "Todos" },
                ],
                summary: [
                  { label: "Compras", value: dataset.summary.count },
                  { label: "Total", value: dataset.summary.total },
                  { label: "Diferencia no recibida", value: dataset.summary.totalNoRecibido ?? 0 },
                  { label: "Pagado", value: dataset.summary.paid },
                  { label: "Saldo", value: dataset.summary.balance },
                ],
                columns: [
                  "Fecha",
                  "Sucursal",
                  "Proveedor",
                  "Compra ID",
                  "Total",
                  "Total pedido",
                  "Total liquidado",
                  "Diferencia no recibida",
                  "Pagado",
                  "Saldo",
                  "Estado",
                  "Estado pago",
                ],
                rows: dataset.rows.map((row) => [
                  formatDateTime(row.date),
                  row.branchName ?? "",
                  row.supplierName,
                  row.purchaseId,
                  row.total,
                  row.totalPedido ?? row.total,
                  row.totalLiquidado ?? row.total,
                  row.diferenciaNoRecibida ?? 0,
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
          label="Compras"
          value={dataset ? dataset.summary.count : searched ? 0 : "--"}
          helper="Compras registradas en el rango."
          accent="blue"
        />
        <ReportMetricCard
          label="Total"
          value={dataset ? formatCurrency(dataset.summary.total) : searched ? "$ 0" : "--"}
          helper="Monto total comprado."
          accent="emerald"
        />
        <ReportMetricCard
          label="No recibido"
          value={dataset ? formatCurrency(dataset.summary.totalNoRecibido ?? 0) : searched ? "$ 0" : "--"}
          helper="Diferencia trazada en compras cerradas parcial."
          accent="blue"
        />
        <ReportMetricCard
          label="Pagado"
          value={dataset ? formatCurrency(dataset.summary.paid) : searched ? "$ 0" : "--"}
          helper="Pagos aplicados por compras."
          accent="amber"
        />
        <ReportMetricCard
          label="Saldo"
          value={dataset ? formatCurrency(dataset.summary.balance) : searched ? "$ 0" : "--"}
          helper="Saldo pendiente reportado por backend."
          accent="rose"
        />
      </section>

      <DataTable
        columns={columns}
        rows={dataset?.rows ?? []}
        getRowKey={(row) => row.purchaseId}
        loading={loading}
        error={error}
        emptyState={
          searched
            ? "No hay compras para los filtros seleccionados."
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

export default PurchasesReportsPage;
