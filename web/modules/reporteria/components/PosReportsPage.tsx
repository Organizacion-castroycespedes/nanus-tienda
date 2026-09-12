"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, Printer, Truck } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Modal } from "../../../components/design-system/Modal";
import { DeliveryRelationCard } from "../../deliveries/components/DeliveryRelationCard";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { usePosReports } from "../hooks/use-pos-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { usePosContext } from "../../../domains/pos/hooks/usePosContext";
import { printReporteriaSaleTicket } from "../direct-print";
import {
  getPosSaleTicket,
  getPosSaleTicketPrintData,
} from "../services/reporting.service";
import type { PosSalesListRow } from "../types";
import {
  downloadBlob,
  downloadReportWorkbook,
  formatCurrency,
  formatDateTime,
  getApiErrorMessage,
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

type SaleDeliveryRelation = {
  id: string;
  tenantId: string;
  label: string;
  customerName?: string | null;
};

type DirectPrintFeedback = {
  saleId: string;
  variant: "success" | "error";
  message: string;
};

const PosReportsPage = () => {
  const initialRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState(initialRange);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const [deliveryRelation, setDeliveryRelation] =
    useState<SaleDeliveryRelation | null>(null);
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);
  const [directPrintFeedback, setDirectPrintFeedback] =
    useState<DirectPrintFeedback | null>(null);
  const posContext = usePosContext();
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

  const handleDirectPrint = useCallback(
    async (saleId: string) => {
      setPrintingSaleId(saleId);
      setDirectPrintFeedback(null);

      try {
        const ticket = await getPosSaleTicketPrintData(saleId);
        const result = await printReporteriaSaleTicket(ticket, {
          tenantId: posContext.tenantId ?? tenantId,
          branchId: posContext.branchId ?? branchId,
          terminalId: posContext.terminalId ?? undefined,
        });

        setDirectPrintFeedback({
          saleId,
          variant: result.success ? "success" : "error",
          message: result.success
            ? "Ticket enviado a la impresora"
            : result.error.message,
        });
      } catch (error) {
        setDirectPrintFeedback({
          saleId,
          variant: "error",
          message: getApiErrorMessage(error, "No se pudo preparar la impresion."),
        });
      } finally {
        setPrintingSaleId(null);
      }
    },
    [branchId, posContext.branchId, posContext.terminalId, posContext.tenantId, tenantId]
  );

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
            <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(row.date)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.branchName ?? "Sucursal"}</p>
          </div>
        ),
      },
      {
        key: "customer",
        header: "Cliente",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{row.customerName || "Consumidor final"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Venta #{row.saleId.slice(0, 8)}</p>
          </div>
        ),
      },
      {
        key: "total",
        header: "Total",
        render: (row) => <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(row.total)}</span>,
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
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Pago
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{row.paymentStatus}</p>
            </div>
          </div>
        ),
      },
      {
        key: "actions",
        header: "Acciones",
        cellClassName: "min-w-[350px]",
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
              variant="outline"
              size="sm"
              onClick={() => void handleDirectPrint(row.saleId)}
              disabled={printingSaleId === row.saleId}
            >
              <Printer className="h-4 w-4" />
              {printingSaleId === row.saleId ? "Imprimiendo..." : "Imprimir"}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDeliveryRelation({
                  id: row.saleId,
                  tenantId: tenantId || "default",
                  label: `Venta ${row.saleId.slice(0, 8)}`,
                  customerName: row.customerName,
                })
              }
            >
              <Truck className="h-4 w-4" />
              Domicilio
            </Button>
          </div>
        ),
      },
    ],
    [handleDirectPrint, printingSaleId, tenantId]
  );

  const canExport = Boolean(dataset?.rows.length);

  if (!canViewReports) {
    return (
      <FinanceAccessNotice description="No cuentas con permisos para consultar la reporteria POS." />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Reporteria POS</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Ventas y tickets POS</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
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

      {directPrintFeedback ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            directPrintFeedback.variant === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {directPrintFeedback.message}
        </div>
      ) : null}

      {pdfConfig ? (
        <PdfPreviewModal
          isOpen={Boolean(pdfConfig)}
          title={pdfConfig.title}
          fileName={pdfConfig.fileName}
          getPdf={pdfConfig.getPdf}
          onClose={() => setPdfConfig(null)}
        />
      ) : null}

      {deliveryRelation ? (
        <Modal
          title="Domicilio"
          description="Relacion visual de la venta con Domicilios. No toca POS, caja, totales, impuestos ni facturacion."
          onClose={() => setDeliveryRelation(null)}
          size="lg"
        >
          <DeliveryRelationCard
            sourceType="sale"
            sourceId={deliveryRelation.id}
            tenantId={deliveryRelation.tenantId}
            sourceLabel={deliveryRelation.label}
            defaultCustomerName={deliveryRelation.customerName}
          />
        </Modal>
      ) : null}
    </div>
  );
};

export default PosReportsPage;
