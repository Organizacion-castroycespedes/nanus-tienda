"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Download, Printer, Truck, Receipt } from "lucide-react";
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
  formatReportStatus,
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
import { resolveTenantSettings } from "../../../domains/parameters/api";
import { canViewElectronicDocument } from "../utils/electronic-document-action";
import { PreInvoiceWizardModal } from "../../operational-sales/components/wizard/PreInvoiceWizardModal";

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
  const [wizardSaleId, setWizardSaleId] = useState<string | null>(null);
  const posContext = usePosContext();
  const [resolvedElectronicBillingEnabled, setResolvedElectronicBillingEnabled] =
    useState<boolean | null>(null);
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
  const showElectronicBilling =
    resolvedElectronicBillingEnabled ?? dataset?.electronicBillingEnabled === true;
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

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) {
      setResolvedElectronicBillingEnabled(null);
      return () => {
        cancelled = true;
      };
    }

    void Promise.all([
      resolveTenantSettings({
        tenantId,
        branchId: posContext.branchId ?? branchId ?? undefined,
        terminalId: posContext.terminalId ?? undefined,
        code: "SEND_INVOICE",
      }),
      resolveTenantSettings({
        tenantId,
        branchId: posContext.branchId ?? branchId ?? undefined,
        terminalId: posContext.terminalId ?? undefined,
        code: "GENERATE_INVOICE",
      }),
    ])
      .then(([sendInvoice, generateInvoice]) => {
        if (!cancelled) {
          setResolvedElectronicBillingEnabled(
            sendInvoice.value !== "DISABLED" && generateInvoice.value !== "DISABLED",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedElectronicBillingEnabled(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, posContext.branchId, posContext.terminalId, tenantId]);

  const columns = useMemo<DataTableColumn<PosSalesListRow>[]>(
    () => [
      {
        key: "actions",
        actionFirst: true,
        header: "Acciones",
        className: "w-14 text-center",
        cellClassName: "w-14",
        render: (row) => {
          const hasAcceptedBilling =
            showElectronicBilling && row.billingStatus === "ACCEPTED";
          const canRequestBilling =
            showElectronicBilling &&
            row.billingStatus !== "ACCEPTED" &&
            row.billingStatus !== "PENDING" &&
            row.billingStatus !== "PROCESSING" &&
            row.billingStatus !== "REJECTED" &&
            row.billingStatus !== "TECHNICAL_ERROR" &&
            row.billingStatus !== "CANCELLED" &&
            row.billingStatus !== "AMBIGUOUS" &&
            row.status === "CONFIRMED";

          return (
            <RowActionsMenu
              label={`Acciones de venta ${row.saleId.slice(0, 8)}`}
              items={[
                ...(canRequestBilling
                  ? [
                      {
                        label: (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            Facturar electrónicamente
                          </span>
                        ),
                        icon: <Receipt className="h-4 w-4 text-emerald-600" />,
                        onSelect: () => setWizardSaleId(row.saleId),
                      },
                    ]
                  : []),
                {
                  label: "Ver ticket",
                  icon: <Eye className="h-4 w-4 text-slate-500" />,
                  onSelect: () =>
                    setPdfConfig({
                      title: `Ticket de venta ${row.saleId.slice(0, 8)}`,
                      fileName: `ticket-venta-${row.saleId}.pdf`,
                      getPdf: () => getPosSaleTicket(row.saleId),
                    }),
                },
                ...(hasAcceptedBilling
                  ? [
                      {
                        label: "Ver factura electrónica",
                        icon: <Eye className="h-4 w-4 text-slate-500" />,
                        onSelect: () =>
                          setPdfConfig({
                            title: `Factura electrónica ${row.saleId.slice(0, 8)}`,
                            fileName: `factura-electronica-${row.saleId}.pdf`,
                            getPdf: () => getElectronicInvoice(row.saleId),
                          }),
                      },
                    ]
                  : []),
                {
                  label:
                    printingSaleId === row.saleId
                      ? "Imprimiendo..."
                      : hasAcceptedBilling
                        ? "Imprimir factura"
                        : "Imprimir ticket",
                  icon: <Printer className="h-4 w-4 text-slate-500" />,
                  onSelect: () => void handleDirectPrint(row.saleId, row.billingStatus),
                  disabled: printingSaleId === row.saleId,
                },
                {
                  label: hasAcceptedBilling
                    ? "Descargar factura PDF"
                    : "Descargar ticket PDF",
                  icon: <Download className="h-4 w-4 text-slate-500" />,
                  onSelect: async () => {
                    if (hasAcceptedBilling) {
                      const blob = await getElectronicInvoice(row.saleId);
                      downloadBlob(
                        blob,
                        `factura-electronica-${row.billingDocumentNumber || row.saleId}.pdf`
                      );
                    } else {
                      const blob = await getPosSaleTicket(row.saleId);
                      downloadBlob(blob, `ticket-venta-${row.saleId}.pdf`);
                    }
                  },
                },
                {
                  label: "Domicilio",
                  icon: <Truck className="h-4 w-4 text-slate-500" />,
                  onSelect: () =>
                    setDeliveryRelation({
                      id: row.saleId,
                      tenantId: tenantId || "default",
                      label: `Venta ${row.saleId.slice(0, 8)}`,
                      customerName: row.customerName,
                    }),
                },
              ]}
            />
          );
        },
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
              <p className="text-sm text-slate-700 dark:text-slate-200">{formatReportStatus(row.paymentStatus)}</p>
            </div>
          </div>
        ),
      },
      ...(showElectronicBilling
        ? [{
            key: "billingStatus",
            header: "Facturación",
            render: (row: PosSalesListRow) => (
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
          }]
        : []),
    ],
    [handleDirectPrint, printingSaleId, showElectronicBilling, tenantId]
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

      <PreInvoiceWizardModal
        open={Boolean(wizardSaleId)}
        saleId={wizardSaleId}
        onClose={() => setWizardSaleId(null)}
        onSuccess={async (msg) => {
          setWizardSaleId(null);
          setDirectPrintFeedback({
            saleId: wizardSaleId ?? "billing",
            variant: "success",
            message: msg || "Factura electrónica generada exitosamente.",
          });
          await handleSearch();
        }}
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
