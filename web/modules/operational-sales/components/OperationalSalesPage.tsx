"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CreditCard, Download, Eye, FileText, Printer, Receipt, RotateCcw, Search } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { DateRangePicker } from "../../../components/design-system/DateRangePicker";
import { Input } from "../../../components/design-system/Input";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportFilters, type ReportFilterDefinition } from "../../../components/design-system/ReportFilters";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { RowActionsMenu } from "../../../components/design-system/RowActionsMenu";
import { Select } from "../../../components/design-system/Select";
import { usePosContext } from "../../../domains/pos/hooks/usePosContext";
import {
  getElectronicInvoice,
  getElectronicInvoicePrintData,
  getPosSaleTicket,
  getPosSaleTicketPrintData,
} from "../../reporteria/services/reporting.service";
import { printElectronicInvoiceTicket } from "../../reporteria/electronic-invoice-direct-print";
import { printReporteriaSaleTicket } from "../../reporteria/direct-print";
import {
  isEligibleForElectronicBillingRequest,
  requestOperationalSaleElectronicBilling,
} from "../services/operational-sales.service";
import { PreInvoiceWizardModal } from "./wizard/PreInvoiceWizardModal";
import { EditSalePaymentsModal } from "./EditSalePaymentsModal";
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
import { PdfPreviewModal } from "../../reporteria/components/PdfPreviewModal";
import { downloadBlob } from "../../reporteria/utils";
import { getOperationalSalesReportExcel, getOperationalSalesReportPdf } from "../services/operational-sales-report.service";
import { useAppSelector } from "../../../store/hooks";
import { useOperationalSales, getDefaultOperationalSalesFilters } from "../hooks/use-operational-sales";

const statusLabel = (value: string) => labels[value.toUpperCase()] ?? value;
const StatusBadge = ({ value }: { value: string }) => <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabel(value)}</span>;
const formatDate = (value: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const formatMoney = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);
const scopeCopy: Record<string, string> = { USER: "Ventas de mi turno actual", ADMIN: "Ventas de la sucursal", SUPER_USER: "Ventas del tenant", SUPER_ADMIN: "Ventas del contexto global autorizado" };

export const OperationalSalesPage = () => {
  const params = useParams<{ tenant: string }>();
  const router = useRouter();
  const posContext = usePosContext();
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const initialFilters = useMemo(() => getDefaultOperationalSalesFilters(role), [role]);
  const { data, filters, appliedFilters, loading, error, page, pageSize, setPage, setPageSize, search, resetFilters, updateFilter, toggleSort, reload } = useOperationalSales(initialFilters);

  const [actionSaleId, setActionSaleId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [wizardSaleId, setWizardSaleId] = useState<string | null>(null);
  const [paymentEditSaleId, setPaymentEditSaleId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const appliedReportFilters = useMemo(() => appliedFilters ? { dateFrom: appliedFilters.dateFrom, dateTo: appliedFilters.dateTo, status: appliedFilters.status, paymentStatus: appliedFilters.paymentStatus, paymentMethod: appliedFilters.paymentMethod, customerId: appliedFilters.customerId, documentNumber: appliedFilters.documentNumber, electronicBillingStatus: appliedFilters.electronicBillingStatus } : null, [appliedFilters]);
  const getReportPdf = useCallback(() => appliedReportFilters ? getOperationalSalesReportPdf(appliedReportFilters, data.sortBy, data.sortDirection) : Promise.reject(new Error("Primero ejecuta una búsqueda.")), [appliedReportFilters, data.sortBy, data.sortDirection]);
  const hasFilters = Object.values(filters).some(Boolean);
  const emptyState = !appliedFilters ? "Usa Buscar para consultar ventas operativas." : hasFilters ? "No encontramos ventas con los filtros seleccionados." : "No hay ventas en el alcance operativo actual.";

  const getTerminalContext = useCallback(
    (branchId: string) => ({
      tenantId: posContext.tenantId ?? undefined,
      branchId: posContext.branchId ?? branchId,
      terminalId: posContext.terminalId ?? undefined,
    }),
    [posContext.branchId, posContext.terminalId, posContext.tenantId],
  );

  const handleBillingRequest = useCallback(async (saleId: string) => {
    setActionSaleId(saleId);
    setActionMessage(null);
    try {
      const response = await requestOperationalSaleElectronicBilling(saleId);
      setActionMessage(response.message ?? "Se creó la solicitud de facturación electrónica.");
      await reload();
    } catch (requestError) {
      setActionMessage(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo solicitar la factura electrónica.",
      );
    } finally {
      setActionSaleId(null);
    }
  }, [reload]);

  const handlePrint = useCallback(async (sale: OperationalSaleListItem) => {
    setActionSaleId(sale.id);
    setActionMessage(null);
    try {
      const ticket = await getPosSaleTicketPrintData(sale.id);
      const terminal = getTerminalContext(sale.branch.id);
      const result = sale.electronicBilling?.status === "ACCEPTED"
        ? await printElectronicInvoiceTicket(
            await getElectronicInvoicePrintData(sale.id),
            ticket,
            terminal,
          )
        : await printReporteriaSaleTicket(ticket, terminal);
      if (!result.success) {
        throw result.error;
      }
      setActionMessage("Documento enviado a la impresora.");
    } catch (printError) {
      setActionMessage(
        printError instanceof Error
          ? printError.message
          : "No se pudo imprimir el documento.",
      );
    } finally {
      setActionSaleId(null);
    }
  }, [getTerminalContext]);

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
            {(sale.id.slice(0, 8)+'').toLowerCase()}
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
        key: "electronicBilling",
        header: "Facturación",
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
        cellClassName: "text-right font-semibold whitespace-nowrap",
        render: (sale) => formatMoney(sale.total),
      },
      {
        key: "actions",
        header: "Acciones",
        className: "w-14 text-center",
        cellClassName: "w-14",
        render: (sale) => {
          const hasAcceptedBilling =
            sale.electronicBillingEnabled &&
            sale.electronicBilling?.status === "ACCEPTED";
          const canRequestBilling =
            sale.electronicBillingEnabled &&
            !sale.electronicBilling &&
            isEligibleForElectronicBillingRequest(sale);

          return (
            <RowActionsMenu
              label={`Acciones de venta ${sale.id.slice(0, 8)}`}
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
                        onSelect: () => setWizardSaleId(sale.id),
                        disabled: actionSaleId === sale.id,
                      },
                    ]
                  : []),
                ...(sale.status !== "CANCELLED" &&
                sale.status !== "REFUNDED" &&
                sale.electronicBilling?.status !== "ACCEPTED"
                  ? [
                      {
                        label: "Editar medios de pago",
                        icon: <CreditCard className="h-4 w-4 text-slate-500" />,
                        onSelect: () => setPaymentEditSaleId(sale.id),
                        disabled: actionSaleId === sale.id,
                      },
                    ]
                  : []),
                {
                  label: "Ver detalle / ticket",
                  icon: <Eye className="h-4 w-4 text-slate-500" />,
                  onSelect: () =>
                    router.push(`/${params.tenant}/operations/sales/${sale.id}`),
                },
                {
                  label:
                    actionSaleId === sale.id
                      ? "Imprimiendo..."
                      : hasAcceptedBilling
                        ? "Imprimir factura"
                        : "Imprimir ticket",
                  icon: <Printer className="h-4 w-4 text-slate-500" />,
                  onSelect: () => void handlePrint(sale),
                  disabled: actionSaleId === sale.id,
                },
                {
                  label: hasAcceptedBilling
                    ? "Descargar factura PDF"
                    : "Descargar ticket PDF",
                  icon: <Download className="h-4 w-4 text-slate-500" />,
                  onSelect: () => {
                    if (hasAcceptedBilling) {
                      void getElectronicInvoice(sale.id).then((blob) =>
                        downloadBlob(
                          blob,
                          `factura-electronica-${sale.electronicBilling?.documentNumber || sale.id}.pdf`
                        )
                      );
                    } else {
                      void getPosSaleTicket(sale.id).then((blob) =>
                        downloadBlob(blob, `ticket-venta-${sale.id}.pdf`)
                      );
                    }
                  },
                },
              ]}
            />
          );
        },
      },
    ],
    [actionSaleId, handlePrint, params.tenant, router, toggleSort]
  );

  const reportFilters = useMemo<ReportFilterDefinition[]>(() => [
    { key: "date", label: "Fecha", priority: "primary", active: Boolean(filters.dateFrom || filters.dateTo), render: () => <DateRangePicker compact value={{ from: filters.dateFrom, to: filters.dateTo }} onChange={(value) => { updateFilter("dateFrom", value.from); updateFilter("dateTo", value.to); }} />, clear: () => { updateFilter("dateFrom", ""); updateFilter("dateTo", ""); } },
    { key: "status", label: "Estado de venta", priority: "secondary", active: Boolean(filters.status), activeLabel: statusLabel(filters.status), render: () => <Select label="Estado de venta" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Todos</option>{SALE_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select>, clear: () => updateFilter("status", "") },
    { key: "paymentStatus", label: "Estado de pago", priority: "secondary", active: Boolean(filters.paymentStatus), activeLabel: statusLabel(filters.paymentStatus), render: () => <Select label="Estado de pago" value={filters.paymentStatus} onChange={(event) => updateFilter("paymentStatus", event.target.value)}><option value="">Todos</option>{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select>, clear: () => updateFilter("paymentStatus", "") },
    { key: "electronicBillingStatus", label: "Facturación electrónica", priority: "secondary", active: Boolean(filters.electronicBillingStatus), activeLabel: statusLabel(filters.electronicBillingStatus), render: () => <Select label="Facturación electrónica" value={filters.electronicBillingStatus} onChange={(event) => updateFilter("electronicBillingStatus", event.target.value)}><option value="">Todos</option>{ELECTRONIC_BILLING_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select>, clear: () => updateFilter("electronicBillingStatus", "") },
    { key: "documentNumber", label: "Número fiscal", priority: "secondary", active: Boolean(filters.documentNumber), activeLabel: filters.documentNumber, render: () => <Input label="Número fiscal" value={filters.documentNumber} onChange={(event) => updateFilter("documentNumber", event.target.value)} placeholder="Buscar número" />, clear: () => updateFilter("documentNumber", "") },
    { key: "paymentMethod", label: "Método de pago", priority: "secondary", active: Boolean(filters.paymentMethod), activeLabel: filters.paymentMethod, render: () => <Input label="Método de pago" value={filters.paymentMethod} onChange={(event) => updateFilter("paymentMethod", event.target.value)} placeholder="Ej. CASH" />, clear: () => updateFilter("paymentMethod", "") },
  ], [filters, updateFilter]);

  return <ReportLayout title="Ventas" description={scopeCopy[role.toUpperCase()] ?? "Ventas del alcance autorizado"}>
    <div className="space-y-3">
      <ReportFilters
        filters={reportFilters}
        actions={(
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              onClick={search}
              isLoading={loading}
              className="min-w-[96px]"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Buscar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReportOpen(true)}
              disabled={!appliedFilters || loading}
              title={!appliedFilters ? "Primero ejecuta una búsqueda" : "Generar reporte de la última búsqueda"}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reporte
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Limpiar filtros
            </Button>
          </div>
        )}
      />
      {actionMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800"
        >
          {actionMessage}
        </div>
      ) : null}
      <DataTable columns={columns} actionColumnFirst disableHeaderUppercase rows={data.items} getRowKey={(sale) => sale.id} loading={loading} error={error} emptyState={emptyState} loadingState="Cargando ventas operativas..." />
      {appliedFilters ? <Pagination page={page} pageSize={pageSize} totalItems={data.total} onPageChange={setPage} onPageSizeChange={setPageSize} loading={loading} /> : null}
      <PdfPreviewModal isOpen={reportOpen} title="Reporte de ventas operativas" fileName="reporte-ventas-operativas.pdf" description="Vista previa de ventas operativas" onClose={() => setReportOpen(false)} getPdf={getReportPdf} onDownloadExcel={() => { if (appliedReportFilters) void getOperationalSalesReportExcel(appliedReportFilters, data.sortBy, data.sortDirection).then((blob) => downloadBlob(blob, "reporte-ventas-operativas.xlsx")); }} />
      <PreInvoiceWizardModal
        open={Boolean(wizardSaleId)}
        saleId={wizardSaleId}
        onClose={() => setWizardSaleId(null)}
        onSuccess={(msg) => {
          setActionMessage(msg);
          void reload();
        }}
      />
      <EditSalePaymentsModal
        open={Boolean(paymentEditSaleId)}
        saleId={paymentEditSaleId}
        onClose={() => setPaymentEditSaleId(null)}
        onSuccess={(msg) => {
          setActionMessage(msg);
          void reload();
        }}
      />
    </div>
  </ReportLayout>;
};
