"use client";

import { Button } from "../../../components/design-system/Button";
import type { PurchaseDetailResponse } from "../services/purchase.service";

type PurchaseDetailPanelProps = {
  purchase: PurchaseDetailResponse | null;
  loading?: boolean;
  canReceive?: boolean;
  canLiquidate?: boolean;
  canPay?: boolean;
  canCancel?: boolean;
  canViewTicket?: boolean;
  onClose: () => void;
  onReceive?: () => void;
  onLiquidate?: () => void;
  onPay?: () => void;
  onCancelPurchase?: () => void;
  onViewTicket?: () => void;
  onDownload?: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "-";

const displayStatus = (status?: string | null) =>
  status === "CANCELLED"
    ? "CANCELADA"
    : status === "CERRADA_PARCIAL"
      ? "CERRADA_PARCIAL"
      : status ?? "-";

export const PurchaseDetailPanel = ({
  purchase,
  loading = false,
  canReceive = false,
  canLiquidate = false,
  canPay = false,
  canCancel = false,
  canViewTicket = false,
  onClose,
  onReceive,
  onLiquidate,
  onPay,
  onCancelPurchase,
  onViewTicket,
  onDownload,
}: PurchaseDetailPanelProps) => {
  const isCancelled = purchase?.status === "CANCELLED";
  const isClosedPartial = purchase?.status === "CERRADA_PARCIAL";
  const history = purchase?.statusHistory ?? [];
  const hasReceived = purchase?.items.some((item) => item.receivedQuantity > 0) ?? false;
  const hasPending = purchase?.items.some(
    (item) => item.receivedQuantity < item.orderedQuantity
  ) ?? false;
  const showLiquidate =
    canLiquidate &&
    purchase?.status === "PARTIAL" &&
    hasReceived &&
    hasPending &&
    Boolean(onLiquidate);
  const totalPedido =
    Number(purchase?.totalPedido ?? NaN) ||
    purchase?.items.reduce(
      (sum, item) => sum + Number(item.orderedQuantity) * Number(item.cost),
      0
    ) ||
    Number(purchase?.total ?? 0);
  const totalRecibido =
    Number(purchase?.totalRecibido ?? NaN) ||
    purchase?.items.reduce(
      (sum, item) =>
        sum +
        Number(item.receivedSubtotal ?? Number(item.receivedQuantity) * Number(item.cost)),
      0
    ) ||
    0;
  const totalLiquidado =
    purchase?.totalLiquidado == null ? null : Number(purchase.totalLiquidado);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Detalle de compra</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {purchase ? `Compra ${purchase.id.slice(0, 8)}` : "Compra"}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Consulta estado, items y trazabilidad en modo enfocado.
          </p>
        </div>
        <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
          Volver
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
          Cargando detalle de la compra...
        </div>
      ) : purchase ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-3 xl:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {purchase.supplierName || purchase.supplierId}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {displayStatus(purchase.status)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Pago</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">{purchase.paymentStatus}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatDateTime(purchase.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total pedido</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatCurrency(totalPedido)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total recibido</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">{formatCurrency(totalRecibido)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total liquidado</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {totalLiquidado == null ? "-" : formatCurrency(totalLiquidado)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Saldo</p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {formatCurrency(Number(purchase.balanceDue))}
              </p>
            </div>
          </div>

          {isCancelled ? (
            <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
              <h3 className="font-semibold text-rose-900">Compra cancelada</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-rose-700">
                    Motivo de cancelacion
                  </p>
                  <p className="mt-1 text-rose-950">{purchase.motivoCancelacion || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-rose-700">
                    Fecha de cancelacion
                  </p>
                  <p className="mt-1 text-rose-950">{formatDateTime(purchase.canceladoEn)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-rose-700">
                    Usuario que cancelo
                  </p>
                  <p className="mt-1 text-rose-950">
                    {purchase.canceladoPorNombre || purchase.canceladoPor || "-"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {isClosedPartial ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
              <h3 className="font-semibold text-emerald-900">Compra cerrada parcialmente</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-700">
                    Motivo de liquidacion
                  </p>
                  <p className="mt-1 text-emerald-950">{purchase.motivoLiquidacion || "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-700">
                    Fecha de liquidacion
                  </p>
                  <p className="mt-1 text-emerald-950">{formatDateTime(purchase.liquidadoEn)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-700">
                    Usuario que liquido
                  </p>
                  <p className="mt-1 text-emerald-950">
                    {purchase.liquidadoPorNombre || purchase.liquidadoPor || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-700">
                    Valor no recibido
                  </p>
                  <p className="mt-1 text-emerald-950">
                    {formatCurrency(Number(purchase.totalNoRecibido ?? 0))}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Recibido</th>
                    <th className="px-4 py-3 font-medium">Pendiente</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items.map((item) => {
                    const pending = Math.max(item.orderedQuantity - item.receivedQuantity, 0);

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">
                          {item.productName || item.productId}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.orderedQuantity}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.receivedQuantity}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{pending}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {formatCurrency(Number(item.subtotal))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:bg-slate-800 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-white">Historial de cambio de estado</h3>
            {history.length > 0 ? (
              <div className="mt-3 space-y-3">
                {history.map((event) => (
                  <div
                    key={`${event.action}-${event.createdAt}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="font-medium text-slate-900 dark:text-white">
                      {event.action === "PURCHASE_PARTIAL_CLOSED"
                        ? "Compra cerrada parcialmente"
                        : "Compra cancelada"}
                    </p>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">
                      Estado anterior: {displayStatus(event.estadoAnterior)} | Estado nuevo:{" "}
                      {displayStatus(event.estadoNuevo)}
                    </p>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">Motivo: {event.motivo || "-"}</p>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">
                      Usuario: {event.usuarioNombre || event.usuarioId || "-"}
                    </p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      Fecha/hora: {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-slate-500 dark:text-slate-400">Sin eventos de trazabilidad registrados.</p>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
              Volver
            </Button>
            {canReceive && onReceive ? <Button variant="outline" onClick={onReceive} className="w-full sm:w-auto">Recibir</Button> : null}
            {canPay && onPay ? <Button variant="outline" onClick={onPay} className="w-full sm:w-auto">Pagar</Button> : null}
            {canCancel && onCancelPurchase ? (
              <Button variant="danger" onClick={onCancelPurchase} className="w-full sm:w-auto">
                Cancelar compra
              </Button>
            ) : null}
            {showLiquidate ? <Button onClick={onLiquidate} className="w-full sm:w-auto">Liquidar compra</Button> : null}
            {canViewTicket && onViewTicket ? (
              <Button variant="outline" onClick={onViewTicket} className="w-full sm:w-auto">
                Ver Ticket
              </Button>
            ) : null}
            {canViewTicket && onDownload ? (
              <Button variant="outline" onClick={onDownload} className="w-full sm:w-auto">
                Descargar
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudo cargar el detalle de la compra.
        </div>
      )}
    </section>
  );
};
