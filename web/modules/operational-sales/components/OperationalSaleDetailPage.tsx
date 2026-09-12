"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { getElectronicInvoice, getElectronicInvoicePrintData, getPosSaleTicketPrintData } from "../../reporteria/services/reporting.service";
import { printElectronicInvoiceTicket } from "../../reporteria/electronic-invoice-direct-print";
import { usePosContext } from "../../../domains/pos/hooks/usePosContext";
import { PdfPreviewModal } from "../../reporteria/components/PdfPreviewModal";
import { useOperationalSaleDetail } from "../hooks/use-operational-sale-detail";
import type { OperationalSaleDetail } from "../types";

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

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
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
  onPrintInvoice,
  refreshLoading,
  printLoading,
  actionMessage,
}: {
  sale: OperationalSaleDetail;
  onReload: () => void;
  onRefreshStatus: () => Promise<void>;
  onRetry: () => Promise<void>;
  onPrintInvoice: () => Promise<void>;
  refreshLoading: boolean;
  printLoading: boolean;
  actionMessage: string | null;
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const billing = sale.electronicBilling;
  const accepted = billing?.status === "ACCEPTED";
  const canRetry = billing?.retryability?.canRetry === true;
  const getPdf = useCallback(
    () => getElectronicInvoice(sale.id),
    [sale.id]
  );

  return (
    <>
      <Card title="Acciones operativas">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={onReload}>
            Actualizar datos
          </Button>
          {billing && billing.status !== "CANCELLED" ? (
            <Button variant="outline" onClick={() => void onRefreshStatus()} disabled={refreshLoading}>
              {refreshLoading ? "Consultando FE..." : "Actualizar estado FE"}
            </Button>
          ) : null}
          {accepted ? (
            <Button variant="outline" onClick={() => setPreviewOpen(true)}>
              Ver / reimprimir factura electrónica
            </Button>
          ) : null}
          {accepted ? (
            <Button variant="outline" onClick={() => void onPrintInvoice()} disabled={printLoading}>
              {printLoading ? "Imprimiendo FE..." : "Imprimir factura electrónica"}
            </Button>
          ) : null}
          {canRetry ? (
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm("¿Reintentar el procesamiento seguro de esta factura electrónica?")) {
                  void onRetry();
                }
              }}
              disabled={refreshLoading}
            >
              {refreshLoading ? "Reintentando FE..." : "Reintentar procesamiento"}
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          La actualización solo recarga datos persistidos. No consulta ni retransmite al proveedor.
        </p>
        {actionMessage ? <p className="mt-3 text-sm text-slate-700">{actionMessage}</p> : null}
      </Card>
      <PdfPreviewModal
        isOpen={previewOpen}
        title={`Factura electrónica ${sale.id.slice(0, 8)}`}
        fileName={`factura-electronica-${sale.id}.pdf`}
        onClose={() => setPreviewOpen(false)}
        getPdf={getPdf}
      />
    </>
  );
};

export const OperationalSaleDetailPage = () => {
  const params = useParams<{ tenant: string; saleId: string }>();
  const tenant = params.tenant;
  const posContext = usePosContext();
  const [printLoading, setPrintLoading] = useState(false);
  const {
    data: sale,
    loading,
    error,
    reload,
    refreshBillingStatus,
    retryBilling,
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

  if (loading) {
    return <main className="mx-auto max-w-6xl p-6"><p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Cargando detalle de venta...</p></main>;
  }

  if (error || !sale) {
    return <main className="mx-auto max-w-6xl space-y-4 p-6"><Link className="text-sm font-semibold text-blue-700 hover:underline" href={backHref}>← Volver a ventas</Link><p className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{error ?? "No se encontró la venta."}</p></main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm font-semibold text-blue-700 hover:underline" href={backHref}>← Volver a ventas</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Gestión Operativa · Ventas</p>
          <h1 className="mt-2 break-all text-2xl font-bold text-slate-950">Detalle {sale.id}</h1>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">OperaciÃ³n segura</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Resumen">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailValue name="Estado de venta" value={label(sale.status)} />
            <DetailValue name="Tipo" value={sale.saleType} />
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
            <DetailValue name="Identificador" value={sale.customer.id} />
          </dl>
          <Link className="mt-5 inline-flex text-sm font-semibold text-blue-700 hover:underline" href={`/${tenant}/customers?editCustomerId=${encodeURIComponent(sale.customer.id)}`}>Revisar o completar datos del cliente →</Link>
        </Card>
        <Card title="Sucursal y operación">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailValue name="Sucursal" value={sale.branch.name ?? "Sin sucursal"} />
            <DetailValue name="Operador" value={sale.operator.email ?? "Sin operador"} />
            <DetailValue name="Turno" value={sale.cashSessionId ?? "No disponible"} />
            <DetailValue name="Terminal" value={sale.terminalId ?? "No disponible"} />
          </dl>
        </Card>
        <BillingCard sale={sale} />
      </div>

      <ActionCard
        sale={sale}
        onReload={reload}
        onRefreshStatus={refreshBillingStatus}
        onRetry={retryBilling}
        onPrintInvoice={printInvoice}
        refreshLoading={actionLoading}
        printLoading={printLoading}
        actionMessage={actionMessage}
      />

      <Card title="Productos">
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="px-2 py-2">Producto</th><th className="px-2 py-2">Cantidad</th><th className="px-2 py-2">Unitario</th><th className="px-2 py-2">Impuestos</th><th className="px-2 py-2 text-right">Total</th></tr></thead><tbody>{sale.items.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="px-2 py-3">{item.productId}</td><td className="px-2 py-3">{item.quantity}</td><td className="px-2 py-3">{money(item.unitPrice)}</td><td className="px-2 py-3">{money(item.taxTotal)}</td><td className="px-2 py-3 text-right font-semibold">{money(item.total)}</td></tr>)}</tbody></table></div>
      </Card>

      <Card title="Pagos">
        <div className="grid gap-3 md:grid-cols-2">{sale.payments.length ? sale.payments.map((payment) => <div key={payment.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">{payment.paymentMethod ?? "Método no disponible"}</p><p className="mt-1 text-sm text-slate-600">{money(payment.amount)} · {label(payment.status)}</p><p className="mt-1 text-xs text-slate-500">{date(payment.createdAt)}</p></div>) : <p className="text-sm text-slate-600">No hay pagos asociados.</p>}</div>
      </Card>
    </main>
  );
};
