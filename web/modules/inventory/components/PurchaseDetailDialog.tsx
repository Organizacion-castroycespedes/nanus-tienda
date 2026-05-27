"use client";

import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import type { PurchaseDetailResponse } from "../services/purchase.service";

type PurchaseDetailDialogProps = {
  purchase: PurchaseDetailResponse | null;
  loading?: boolean;
  canLiquidate?: boolean;
  onClose: () => void;
  onLiquidate?: () => void;
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

export const PurchaseDetailDialog = ({
  purchase,
  loading = false,
  canLiquidate = false,
  onClose,
  onLiquidate,
}: PurchaseDetailDialogProps) => {
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

  return (
    <Modal
      title={purchase ? `Detalle compra ${purchase.id.slice(0, 8)}` : "Detalle compra"}
      description="Consulta estado, items y trazabilidad de la compra."
      onClose={onClose}
    >
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Cargando detalle de la compra...
        </div>
      ) : purchase ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor</p>
              <p className="mt-1 font-medium text-slate-900">
                {purchase.supplierName || purchase.supplierId}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
              <p className="mt-1 font-medium text-slate-900">
                {displayStatus(purchase.status)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 font-medium text-slate-900">
                {formatCurrency(Number(purchase.total))}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Sucursal</p>
              <p className="mt-1 font-medium text-slate-900">
                {purchase.branchName || purchase.branchId || "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Pago</p>
              <p className="mt-1 font-medium text-slate-900">{purchase.paymentStatus}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Fecha</p>
              <p className="mt-1 font-medium text-slate-900">
                {formatDateTime(purchase.createdAt)}
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

          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Recibido</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-900">
                        {item.productName || item.productId}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.orderedQuantity}</td>
                      <td className="px-4 py-3 text-slate-700">{item.receivedQuantity}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(Number(item.subtotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <h3 className="font-semibold text-slate-900">Historial de cambio de estado</h3>
            {history.length > 0 ? (
              <div className="mt-3 space-y-3">
                {history.map((event) => (
                  <div
                    key={`${event.action}-${event.createdAt}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="font-medium text-slate-900">
                      {event.action === "PURCHASE_PARTIAL_CLOSED"
                        ? "Compra cerrada parcialmente"
                        : "Compra cancelada"}
                    </p>
                    <p className="mt-1 text-slate-700">
                      Estado anterior: {displayStatus(event.estadoAnterior)} | Estado nuevo:{" "}
                      {displayStatus(event.estadoNuevo)}
                    </p>
                    <p className="mt-1 text-slate-700">Motivo: {event.motivo || "-"}</p>
                    <p className="mt-1 text-slate-700">
                      Usuario: {event.usuarioNombre || event.usuarioId || "-"}
                    </p>
                    <p className="mt-1 text-slate-500">Fecha/hora: {formatDateTime(event.createdAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-slate-500">Sin eventos de cancelacion registrados.</p>
            )}
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Volver
            </Button>
            {showLiquidate ? (
              <Button onClick={onLiquidate}>
                Liquidar compra
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudo cargar el detalle de la compra.
        </div>
      )}
    </Modal>
  );
};
