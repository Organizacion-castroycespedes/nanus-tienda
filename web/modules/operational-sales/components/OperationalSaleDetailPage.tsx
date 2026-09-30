"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { ConfirmDialog } from "../../../components/design-system/confirm-dialog";
import { getElectronicInvoice, getElectronicInvoicePrintData, getPosSaleTicket, getPosSaleTicketPrintData } from "../../reporteria/services/reporting.service";
import { printElectronicInvoiceTicket } from "../../reporteria/electronic-invoice-direct-print";
import { printReporteriaSaleTicket } from "../../reporteria/direct-print";
import { usePosContext } from "../../../domains/pos/hooks/usePosContext";
import { PdfPreviewModal } from "../../reporteria/components/PdfPreviewModal";
import { hasPermission } from "../../../lib/permissions";
import { useAppSelector } from "../../../store/hooks";
import { useOperationalSaleDetail } from "../hooks/use-operational-sale-detail";
import {
  isEligibleForElectronicBillingRequest,
  PROVIDER_CREATE_INTENT_RECOVERY_CONFIRMATION,
  shouldShowProviderCreateIntentRecovery,
} from "../services/operational-sales.service";
import { PreInvoiceWizardModal } from "./wizard/PreInvoiceWizardModal";
import { EditSalePaymentsModal } from "./EditSalePaymentsModal";
import { VoidSaleModal } from "./VoidSaleModal";
import type { OperationalSaleDetail } from "../types";

const saleTypeLabels: Record<string, string> = {
  CASH: "Venta contado / caja",
  POS: "Venta POS",
  STANDARD: "Venta estándar",
  CREDIT: "Venta a crédito",
};

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
  COMPLETED: "Completado",
};

const label = (value: string | null | undefined) =>
  value ? labels[value.toUpperCase()] ?? value : "No disponible";

const money = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "No disponible"
    : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);

const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "No disponible";

const safeMessage = (value: string | null | undefined) =>
  value ? value.replace(/\s+/g, " ").trim().slice(0, 300) : null;

const Card = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
      {action}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const DetailValue = ({ name, value }: { name: string; value: React.ReactNode }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{name}</dt>
    <dd className="mt-1 break-words text-sm text-slate-800">{value}</dd>
  </div>
);

const BillingCard = ({ sale }: { sale: OperationalSaleDetail }) => {
  const billing = sale.electronicBilling;
  if (!billing) {
    return (
      <Card title="Facturación electrónica">
        <p className="text-sm text-slate-600">Sin factura electrónica asociada.</p>
      </Card>
    );
  }

  const errorMessage = safeMessage(billing.providerErrorMessage);
  return (
    <Card title="Facturación electrónica">
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailValue name="Estado" value={<span className="font-semibold">{label(billing.status)}</span>} />
        <DetailValue name="Número fiscal" value={billing.documentNumber ?? "No disponible"} />
        <DetailValue name="CUFE" value={billing.cufe ?? "No disponible"} />
        <DetailValue name="Estado proveedor" value={label(billing.providerStatus)} />
        <DetailValue name="Código de respuesta" value={billing.providerErrorCode ?? "No disponible"} />
        <DetailValue name="Última actualización" value={date(billing.updatedAt)} />
      </dl>
      {errorMessage ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <strong>Detalle operativo:</strong> {errorMessage}
        </div>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        Esta vista es informativa. No retransmite documentos ni cambia su estado.
      </p>
    </Card>
  );
};

const ActionCard = ({
  sale,
  onReload,
  onRefreshStatus,
  onRetry,
  onRequestBilling,
  onRecoverProviderCreateIntent,
  onPrintInvoice,
  onPrintTicket,
  refreshLoading,
  printLoading,
  ticketLoading,
  actionMessage,
  onEditPayments,
}: {
  sale: OperationalSaleDetail;
  onReload: () => void;
  onRefreshStatus: () => Promise<void>;
  onRetry: () => Promise<void>;
  onRequestBilling: () => Promise<void>;
  onRecoverProviderCreateIntent: () => Promise<boolean>;
  onPrintInvoice: () => Promise<void>;
  onPrintTicket: () => Promise<void>;
  refreshLoading: boolean;
  printLoading: boolean;
  ticketLoading: boolean;
  actionMessage: string | null;
  onEditPayments?: () => void;
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [ticketPreviewOpen, setTicketPreviewOpen] = useState(false);
  const [recoveryConfirmOpen, setRecoveryConfirmOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [localActionMessage, setLocalActionMessage] = useState<string | null>(null);
  const billing = sale.electronicBilling;
  const accepted = billing?.status === "ACCEPTED";
  const showElectronicBilling = sale.electronicBillingEnabled;
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const canRetry =
    hasPermission("POS", "write") && billing?.retryability?.canRetry === true;
  const canRecoverProviderCreateIntent = shouldShowProviderCreateIntentRecovery(
    sale,
    hasPermission("POS", "write"),
  );
  const canRequestBilling =
    showElectronicBilling &&
    (hasPermission("POS", "write") || role.toUpperCase() === "USER") &&
    isEligibleForElectronicBillingRequest(sale);
  const getPdf = useCallback(
    () => getElectronicInvoice(sale.id),
    [sale.id]
  );
  const confirmProviderCreateIntentRecovery = useCallback(async () => {
    const succeeded = await onRecoverProviderCreateIntent();
    if (succeeded) {
      setRecoveryConfirmOpen(false);
    }
  }, [onRecoverProviderCreateIntent]);

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Acciones operativas</h2>
            <p className="text-xs text-slate-500 mt-0.5">Comprobantes y facturación electrónica DIAN</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReload}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Actualizar datos
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canRequestBilling ? (
            <Button
              type="button"
              onClick={() => {
                setLocalActionMessage(null);
                setWizardOpen(true);
              }}
              disabled={refreshLoading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 text-sm shadow-sm min-h-[44px] rounded-xl"
            >
              <Receipt className="h-5 w-5 shrink-0" />
              Facturar electrónicamente (DIAN)
            </Button>
          ) : null}

          {showElectronicBilling && accepted ? (
            <>
              <Button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-sm shadow-sm min-h-[44px] rounded-xl"
              >
                <FileText className="h-5 w-5 shrink-0" />
                Ver factura electrónica
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void onPrintInvoice()}
                disabled={printLoading}
                className="flex items-center gap-2 border-slate-300 font-semibold px-4 py-2 text-sm min-h-[44px] rounded-xl hover:bg-slate-50"
              >
                <Printer className="h-4 w-4 text-slate-600 shrink-0" />
                {printLoading ? "Imprimiendo FE..." : "Imprimir factura FE"}
              </Button>
            </>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => setTicketPreviewOpen(true)}
            className="flex items-center gap-2 border-slate-300 font-semibold px-4 py-2 text-sm min-h-[44px] rounded-xl hover:bg-slate-50"
          >
            <Eye className="h-4 w-4 text-slate-600 shrink-0" />
            Ver ticket
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => void onPrintTicket()}
            disabled={ticketLoading}
            className="flex items-center gap-2 border-slate-300 font-semibold px-4 py-2 text-sm min-h-[44px] rounded-xl hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-600 shrink-0" />
            {ticketLoading ? "Imprimiendo ticket..." : "Imprimir ticket"}
          </Button>

          {sale.status !== "CANCELLED" && sale.status !== "REFUNDED" && accepted ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setVoidModalOpen(true)}
              className="flex items-center gap-2 border-rose-300 text-rose-700 font-semibold px-4 py-2 text-sm min-h-[44px] rounded-xl hover:bg-rose-50"
            >
              <RotateCcw className="h-4 w-4 text-rose-600 shrink-0" />
              Anular / Nota Crédito
            </Button>
          ) : null}

          {sale.status !== "CANCELLED" &&
          sale.status !== "REFUNDED" &&
          sale.electronicBilling?.status !== "ACCEPTED" &&
          onEditPayments ? (
            <Button
              type="button"
              variant="outline"
              onClick={onEditPayments}
              className="flex items-center gap-2 border-slate-300 font-semibold px-4 py-2 text-sm min-h-[44px] rounded-xl hover:bg-slate-50"
            >
              <CreditCard className="h-4 w-4 text-slate-600 shrink-0" />
              Editar medios de pago
            </Button>
          ) : null}

          {showElectronicBilling && billing && billing.status !== "CANCELLED" && billing.status !== "ACCEPTED" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void onRefreshStatus()}
              disabled={refreshLoading}
              className="flex items-center gap-1.5 border-slate-300 text-xs font-semibold min-h-[44px] rounded-xl"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshLoading ? "animate-spin" : ""}`} />
              {refreshLoading ? "Consultando FE..." : "Actualizar estado FE"}
            </Button>
          ) : null}

          {showElectronicBilling && canRetry ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (window.confirm("¿Reintentar el procesamiento seguro de esta factura electrónica?")) {
                  void onRetry();
                }
              }}
              disabled={refreshLoading}
              className="flex items-center gap-1.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-semibold min-h-[44px] rounded-xl"
            >
              Reintentar procesamiento
            </Button>
          ) : null}

          {showElectronicBilling && canRecoverProviderCreateIntent ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRecoveryConfirmOpen(true)}
              disabled={refreshLoading}
              className="flex items-center gap-1.5 border-purple-300 text-purple-800 bg-purple-50 hover:bg-purple-100 text-xs font-semibold min-h-[44px] rounded-xl"
            >
              Recuperar procesamiento
            </Button>
          ) : null}

          {showElectronicBilling && billing && !accepted && !canRetry && !canRecoverProviderCreateIntent && !canRequestBilling && !["PENDING", "PROCESSING"].includes(billing.status) ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalActionMessage(null);
                setWizardOpen(true);
              }}
              disabled={refreshLoading}
              className="flex items-center gap-1.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-semibold min-h-[44px] rounded-xl"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reintentar facturación
            </Button>
          ) : null}
        </div>

        {(localActionMessage || actionMessage) ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            {localActionMessage || actionMessage}
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={recoveryConfirmOpen}
        onOpenChange={setRecoveryConfirmOpen}
        title="Recuperar procesamiento de factura electrónica"
        description={PROVIDER_CREATE_INTENT_RECOVERY_CONFIRMATION}
        confirmText="Recuperar procesamiento"
        cancelText="Cancelar"
        variant="default"
        onConfirm={confirmProviderCreateIntentRecovery}
        loading={refreshLoading}
      />
      <PdfPreviewModal
        isOpen={previewOpen}
        title={`Factura electrónica ${sale.id.slice(0, 8)}`}
        fileName={`factura-electronica-${sale.id}.pdf`}
        onClose={() => setPreviewOpen(false)}
        getPdf={getPdf}
        variant="ticket"
      />
      <PdfPreviewModal
        isOpen={ticketPreviewOpen}
        title={`Ticket de venta ${sale.id.slice(0, 8)}`}
        fileName={`ticket-venta-${sale.id}.pdf`}
        onClose={() => setTicketPreviewOpen(false)}
        getPdf={() => getPosSaleTicket(sale.id)}
        variant="ticket"
      />
      <PreInvoiceWizardModal
        open={wizardOpen}
        saleId={sale.id}
        onClose={() => setWizardOpen(false)}
        onSuccess={(msg) => {
          if (msg) setLocalActionMessage(msg);
          void onReload();
        }}
      />
      <VoidSaleModal
        sale={sale}
        isOpen={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        onSuccess={(_updated, message) => {
          setLocalActionMessage(message);
          void onReload();
        }}
      />
    </>
  );
};

export const OperationalSaleDetailPage = () => {
  const params = useParams<{ tenant: string; saleId: string }>();
  const tenant = params.tenant;
  const posContext = usePosContext();
  const [printLoading, setPrintLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const {
    data: sale,
    loading,
    error,
    reload,
    refreshBillingStatus,
    retryBilling,
    requestBilling,
    recoverProviderCreateIntent,
    actionLoading,
    actionMessage,
  } = useOperationalSaleDetail(params.saleId);
  const backHref = `/${tenant}/operations/sales`;
  const printInvoice = useCallback(async () => {
    setPrintLoading(true);
    try {
      const [invoice, saleTicket] = await Promise.all([
        getElectronicInvoicePrintData(params.saleId),
        getPosSaleTicketPrintData(params.saleId),
      ]);
      await printElectronicInvoiceTicket(invoice, saleTicket, {
        tenantId: posContext.tenantId,
        branchId: posContext.branchId,
        terminalId: posContext.terminalId,
      });
    } finally {
      setPrintLoading(false);
    }
  }, [params.saleId, posContext.branchId, posContext.terminalId, posContext.tenantId]);
  const printTicket = useCallback(async () => {
    setTicketLoading(true);
    try {
      const ticket = await getPosSaleTicketPrintData(params.saleId);
      await printReporteriaSaleTicket(ticket, {
        tenantId: posContext.tenantId,
        branchId: posContext.branchId,
        terminalId: posContext.terminalId,
      });
    } finally {
      setTicketLoading(false);
    }
  }, [params.saleId, posContext.branchId, posContext.terminalId, posContext.tenantId]);

  if (loading) {
    return <main className="mx-auto max-w-6xl p-6"><p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Cargando detalle de venta...</p></main>;
  }

  if (error || !sale) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 p-6">
        <Link
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-2xs hover:bg-slate-50 min-h-[44px]"
          href={backHref}
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-slate-600" />
          Volver a ventas
        </Link>
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          {error ?? "No se encontró la venta."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-2xs hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600/30 min-h-[44px]"
            href={backHref}
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-slate-600" />
            Volver a ventas
          </Link>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Gestión Operativa · Venta POS</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-950">
              Venta <span className="text-blue-700">#{(sale.id.slice(0, 8)).toLowerCase()}</span>
            </h1>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              {label(sale.status)}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              {label(sale.paymentStatus)}
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Venta</p>
          <p className="text-2xl md:text-3xl font-black text-slate-950">{money(sale.total)}</p>
        </div>
      </div>

      {/* Action Toolbar placed at the TOP for maximum operator UX */}
      <ActionCard
        sale={sale}
        onReload={reload}
        onRefreshStatus={refreshBillingStatus}
        onRetry={retryBilling}
        onRequestBilling={requestBilling}
        onRecoverProviderCreateIntent={recoverProviderCreateIntent}
        onPrintInvoice={printInvoice}
        onPrintTicket={printTicket}
        refreshLoading={actionLoading}
        printLoading={printLoading}
        ticketLoading={ticketLoading}
        actionMessage={actionMessage}
        onEditPayments={() => setPaymentModalOpen(true)}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Resumen">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailValue name="Estado de venta" value={label(sale.status)} />
            <DetailValue name="Tipo" value={saleTypeLabels[sale.saleType?.toUpperCase()] ?? sale.saleType} />
            <DetailValue name="Fecha" value={date(sale.createdAt)} />
            <DetailValue name="Pago" value={label(sale.paymentStatus)} />
            <DetailValue name="Total" value={money(sale.total)} />
            <DetailValue name="Pagado" value={money(sale.totalPaid)} />
            <DetailValue name="Saldo" value={money(sale.balanceDue)} />
          </dl>
        </Card>
        <Card title="Cliente">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailValue name="Nombre" value={sale.customer.name ?? "Sin cliente"} />
            <DetailValue
              name="Documento / NIT"
              value={sale.customer.documentNumber ?? "Sin documento"}
            />
          </dl>
          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-100 transition shadow-2xs min-h-[44px]"
              href={`/${tenant}/customers?editCustomerId=${encodeURIComponent(sale.customer.id)}&fromSaleId=${encodeURIComponent(sale.id)}`}
            >
              <UserCheck className="h-4 w-4 shrink-0 text-blue-600" />
              Revisar o editar datos del cliente
            </Link>
          </div>
        </Card>
        <Card title="Sucursal y operación">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailValue name="Sucursal" value={sale.branch.name ?? "Sin sucursal"} />
            <DetailValue name="Operador" value={sale.operator.email ?? "Sin operador"} />
            <DetailValue name="Turno de caja" value={sale.cashSessionId ? `#${sale.cashSessionId.slice(0, 8)}` : "No disponible"} />
            <DetailValue name="Terminal" value={sale.terminalId ? `#${sale.terminalId.slice(0, 8)}` : "Terminal activa"} />
          </dl>
        </Card>
        <BillingCard sale={sale} />
      </div>

      <Card title="Productos">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-2 py-2">Producto</th>
                <th className="px-2 py-2">Cantidad</th>
                <th className="px-2 py-2">Unitario</th>
                <th className="px-2 py-2">Impuestos</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-3">
                    <p className="font-medium text-slate-900">
                      {item.productName || item.productSku || (item.productId ? `Item ${item.productId.slice(0, 8)}` : "Producto")}
                    </p>
                    {item.productSku && item.productName && item.productSku !== item.productName ? (
                      <p className="text-xs text-slate-500">SKU: {item.productSku}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">{item.quantity}</td>
                  <td className="px-2 py-3">{money(item.unitPrice)}</td>
                  <td className="px-2 py-3">{money(item.taxTotal)}</td>
                  <td className="px-2 py-3 text-right font-semibold">{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Pagos"
        action={
          sale.status !== "CANCELLED" &&
          sale.status !== "REFUNDED" &&
          sale.electronicBilling?.status !== "ACCEPTED" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaymentModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Editar medios de pago
            </Button>
          ) : null
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {sale.payments.length ? (
            sale.payments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">{payment.paymentMethod ?? "Método no disponible"}</p>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {label(payment.status)}
                  </span>
                </div>
                {payment.financialInstitutionNombre ? (
                  <p className="mt-1 text-xs font-semibold text-blue-600">
                    🏦 {payment.financialInstitutionNombre}
                  </p>
                ) : null}
                {payment.referenceNumber ? (
                  <p className="mt-0.5 text-xs text-slate-500">Ref: {payment.referenceNumber}</p>
                ) : null}
                <div className="mt-3 flex items-baseline justify-between border-t border-slate-200/80 pt-2">
                  <span className="text-base font-extrabold text-slate-900">{money(payment.amount)}</span>
                  <span className="text-xs text-slate-400">{date(payment.createdAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No hay pagos asociados.</p>
          )}
        </div>
      </Card>

      <EditSalePaymentsModal
        open={paymentModalOpen}
        saleId={sale.id}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          void reload();
        }}
      />
    </main>
  );
};
