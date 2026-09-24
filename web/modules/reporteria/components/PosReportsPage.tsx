"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, Printer, Truck } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { RowActionsMenu } from "../../../components/design-system/RowActionsMenu";
import { Modal } from "../../../components/design-system/Modal";
import { DeliveryRelationCard } from "../../deliveries/components/DeliveryRelationCard";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { usePosReports } from "../hooks/use-pos-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { usePosContext } from "../../../domains/pos/hooks/usePosContext";
import { printReporteriaSaleTicket } from "../direct-print";
import { printElectronicInvoiceTicket } from "../electronic-invoice-direct-print";
import {
  getPosSaleTicket,
  getPosSaleTicketPrintData,
  getPosSalesReportPdf,
  getPosSalesReportExcel,
  getElectronicInvoice,
  getElectronicInvoicePrintData,
} from "../services/reporting.service";
import type { PosSalesListRow } from "../types";
import {
  downloadBlob,
  formatCurrency,
  formatDateTime,
  getApiErrorMessage,
  getTodayRange,
} from "../utils";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { ReportStatusBadge } from "./ReportStatusBadge";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { DateRangePicker } from "../../../components/design-system/DateRangePicker";
import { Select } from "../../../components/design-system/Select";
import { Input } from "../../../components/design-system/Input";
import { ReportFilters, type ReportFilterDefinition } from "../../../components/design-system/ReportFilters";
import { canViewElectronicDocument } from "../utils/electronic-document-action";
import {
  requestElectronicBilling,
  requestElectronicBillingBatch,
} from "../services/electronic-billing.service";

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
  const [customerDocument, setCustomerDocument] = useState("");
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [deliveryRelation, setDeliveryRelation] =
    useState<SaleDeliveryRelation | null>(null);
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);
  const [directPrintFeedback, setDirectPrintFeedback] =
    useState<DirectPrintFeedback | null>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [billingRequestBusy, setBillingRequestBusy] = useState(false);
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleDirectPrint = useCallback(
    async (saleId: string, billingStatus?: PosSalesListRow["billingStatus"]) => {
      setPrintingSaleId(saleId);
      setDirectPrintFeedback(null);

      try {
        const ticket = await getPosSaleTicketPrintData(saleId);
        const terminal = {
          tenantId: posContext.tenantId ?? tenantId,
          branchId: posContext.branchId ?? branchId,
          terminalId: posContext.terminalId ?? undefined,
        };
        const result = billingStatus === "ACCEPTED"
          ? await printElectronicInvoiceTicket(
              await getElectronicInvoicePrintData(saleId),
              ticket,
              terminal,
            )
          : await printReporteriaSaleTicket(ticket, terminal);

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
      customerDocument: customerDocument || undefined,
    });
    setPage(1);
  }, [branchId, customerDocument, dateRange.from, dateRange.to, loadReports, tenantId]);

  const handleBillingRequest = useCallback(async (saleIds: string[]) => {
    setBillingRequestBusy(true);
    try {
      const response = saleIds.length === 1
        ? { results: [await requestElectronicBilling(saleIds[0])] }
        : await requestElectronicBillingBatch(saleIds);
      const requested = response.results.filter((item) => item.requestCreated).length;
      setDirectPrintFeedback({
        saleId: saleIds[0],
        variant: "success",
        message: `${requested} solicitud(es) de facturacion electronica creada(s).`,
      });
      setSelectedSaleIds([]);
      await handleSearch();
    } catch (error) {
      setDirectPrintFeedback({
        saleId: saleIds[0] ?? "billing",
        variant: "error",
        message: getApiErrorMessage(error, "No se pudo solicitar la facturacion electronica."),
      });
    } finally {
      setBillingRequestBusy(false);
    }
  }, [handleSearch]);

  useEffect(() => {
    if (!canViewReports || !tenantId) {
      return;
    }

    void loadReports({
      tenantId,
      branchId: branchId || undefined,
      dateFrom: initialRange.from,
      dateTo: initialRange.to,
      customerDocument: undefined,
    });
    setPage(1);
  }, [branchId, canViewReports, initialRange, loadReports, tenantId]);

  const columns = useMemo<DataTableColumn<PosSalesListRow>[]>(
    () => [
      {
        key: "select",
        header: "Seleccionar",
        render: (row) => (
          <input
            type="checkbox"
            aria-label={`Seleccionar venta ${row.saleId}`}
            checked={selectedSaleIds.includes(row.saleId)}
            onChange={(event) =>
              setSelectedSaleIds((current) =>
                event.target.checked
                  ? [...current, row.saleId]
                  : current.filter((saleId) => saleId !== row.saleId),
              )
            }
          />
        ),
      },
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
        key: "billingStatus",
        header: "Facturación electrónica",
        render: (row) => (
          <div>
            <p className="text-sm font-medium text-slate-700">
              {row.billingStatus === "ACCEPTED"
                ? "Aceptada DIAN"
                : row.billingStatus === "NO_DOCUMENT"
                  ? "Sin factura electrónica"
                  : row.billingStatus === "REJECTED"
                    ? "Rechazada"
                      : row.billingStatus === "PROCESSING"
                        ? "Procesando"
                        : row.billingStatus === "ELIGIBLE_ON_DEMAND"
                          ? "Disponible para facturar"
                      : row.billingStatus === "PENDING" || row.billingStatus === "REQUESTED"
                        ? "Pendiente"
                        : row.billingStatus}
            </p>
            {row.billingStatus === "ACCEPTED" && row.billingDocumentNumber ? (
              <p className="text-xs text-slate-500">{row.billingDocumentNumber}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "actions",
        header: "Acciones",
        cellClassName: "w-14",
        render: (row) => (
          <RowActionsMenu>
            {row.billingStatus !== "ACCEPTED" &&
            row.billingStatus !== "PENDING" &&
            row.billingStatus !== "PROCESSING" &&
            row.billingStatus !== "REJECTED" &&
            row.billingStatus !== "TECHNICAL_ERROR" &&
            row.billingStatus !== "CANCELLED" &&
            row.billingStatus !== "AMBIGUOUS" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleBillingRequest([row.saleId])}
                disabled={billingRequestBusy}
              >
                Facturar electrónicamente
              </Button>
            ) : null}
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
            {canViewElectronicDocument(row.billingStatus) ? <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPdfConfig({
                  title: `Factura electrónica ${row.saleId.slice(0, 8)}`,
                  fileName: `factura-electronica-${row.saleId}.pdf`,
                  getPdf: () => getElectronicInvoice(row.saleId),
                })
              }
            >
              <Eye className="h-4 w-4" />
              Ver factura electrónica
            </Button> : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleDirectPrint(row.saleId, row.billingStatus)}
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
          </RowActionsMenu>
        ),
      },
    ],
    [billingRequestBusy, handleBillingRequest, handleDirectPrint, printingSaleId, selectedSaleIds, tenantId]
  );

  const canExport = Boolean(dataset);
  const reportQuery = useMemo(() => ({
    tenantId: tenantId || undefined,
    branchId: branchId || undefined,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    customerDocument: customerDocument || undefined,
  }), [branchId, customerDocument, dateRange.from, dateRange.to, tenantId]);
  const downloadReportExcel = useCallback(async () => {
    const blob = await getPosSalesReportExcel(reportQuery);
    downloadBlob(blob, `reporte-pos-${dateRange.from}-${dateRange.to}.xlsx`);
  }, [dateRange.from, dateRange.to, reportQuery]);
  const reportFilters = useMemo<ReportFilterDefinition[]>(
    () => [
      {
        key: "date",
        label: "Fecha",
        priority: "primary",
        active: false,
        render: () => <DateRangePicker value={dateRange} onChange={setDateRange} compact />,
        clear: () => setDateRange(initialRange),
      },
      ...(showTenantSelector
        ? [{
            key: "tenant",
            label: "Tenant",
            priority: "secondary" as const,
            active: Boolean(tenantId),
            activeLabel: resolvedTenantLabel,
            render: () => (
              <Select label="Tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} disabled={loadingTenants}>
                <option value="">{loadingTenants ? "Cargando tenants..." : "Selecciona un tenant"}</option>
                {tenantOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            ),
            clear: () => setTenantId(""),
          }]
        : []),
      ...(showBranchSelector
        ? [{
            key: "branch",
            label: "Sucursal",
            priority: "secondary" as const,
            active: Boolean(branchId),
            activeLabel: resolvedBranchLabel,
            render: () => (
              <Select label="Sucursal" value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={loadingBranches || (!tenantId && showTenantSelector)}>
                {branchOptions.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
              </Select>
            ),
            clear: () => setBranchId(""),
          }]
        : []),
      {
        key: "customerDocument",
        label: "Número de identificación",
        priority: "secondary",
        active: Boolean(customerDocument),
        activeLabel: customerDocument,
        render: () => (
          <Input
            label="Número de identificación"
            placeholder="Buscar identificación"
            value={customerDocument}
            onChange={(event) => setCustomerDocument(event.target.value)}
          />
        ),
        clear: () => setCustomerDocument(""),
      },
    ],
    [branchId, branchOptions, customerDocument, dateRange, initialRange, loadingBranches, loadingTenants, resolvedBranchLabel, resolvedTenantLabel, setBranchId, setDateRange, setTenantId, showBranchSelector, showTenantSelector, tenantId, tenantOptions]
  );
  const visibleRows = useMemo(
    () => dataset?.rows.slice((page - 1) * pageSize, page * pageSize) ?? [],
    [dataset?.rows, page]
  );

  if (!canViewReports) {
    return (
      <FinanceAccessNotice description="No cuentas con permisos para consultar la reporteria POS." />
    );
  }

  return (
    <ReportLayout
      title="Ventas y tickets POS"
      description="Filtra ventas por rango y alcance operativo, revisa saldos y abre el ticket PDF."
    >
      <div className="space-y-4">

      <ReportFilters
        filters={reportFilters}
        actions={
          <>
            <Button size="sm" onClick={() => void handleSearch()} isLoading={loading} disabled={!dateRange.from || !dateRange.to}>
              Buscar
            </Button>
            <Button variant="outline" size="sm" disabled={!canExport} onClick={() => setReportPreviewOpen(true)}>
              <Eye className="h-4 w-4" /> Reporte
            </Button>
          </>
        }
      />

      <ReportSummary
        items={[
          { label: "Ventas", value: dataset ? dataset.summary.count : searched ? 0 : "--", ariaLabel: "Ventas encontradas" },
          { label: "Total", value: dataset ? formatCurrency(dataset.summary.total) : searched ? "$ 0" : "--", ariaLabel: "Monto total facturado" },
          { label: "Pagado", value: dataset ? formatCurrency(dataset.summary.paid) : searched ? "$ 0" : "--", ariaLabel: "Pagos aplicados en el rango" },
          { label: "Saldo", value: dataset ? formatCurrency(dataset.summary.balance) : searched ? "$ 0" : "--", ariaLabel: "Saldo pendiente según el backend" },
        ]}
      />

      <DataTable
        actionColumnFirst
        columns={columns}
        rows={visibleRows}
        getRowKey={(row) => row.saleId}
        loading={loading}
        error={error}
        emptyState={
          searched
            ? "No hay ventas POS para los filtros seleccionados."
            : "Usa los filtros y ejecuta la busqueda para cargar el reporte."
        }
      />

      {dataset ? (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={dataset.rows.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      ) : null}

      {selectedSaleIds.length > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm text-blue-900">{selectedSaleIds.length} venta(s) seleccionada(s)</span>
          <Button
            size="sm"
            onClick={() => void handleBillingRequest(selectedSaleIds)}
            disabled={billingRequestBusy}
          >
            Facturar electrónicamente seleccionadas
          </Button>
        </div>
      ) : null}

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

      {reportPreviewOpen ? (
        <PdfPreviewModal
          isOpen
          title="Reporte de ventas POS"
          fileName={`reporte-pos-${dateRange.from}-${dateRange.to}.pdf`}
          getPdf={() => getPosSalesReportPdf(reportQuery)}
          onDownloadExcel={() => void downloadReportExcel()}
          allowPrint
          onClose={() => setReportPreviewOpen(false)}
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
    </ReportLayout>
  );
};

export default PosReportsPage;
