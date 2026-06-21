import { Modal } from "../../../components/design-system/Modal";
import { Button } from "../../../components/design-system/Button";
import {
  deliveryStatusLabels,
  getDeliveryFeeSource,
} from "../delivery-helpers";
import type { DeliveryRecord } from "../types";
import { DeliveryStatusBadge } from "./DeliveryStatusBadge";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const DetailItem = ({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) => (
  <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-1 break-words text-sm font-medium text-slate-900">
      {value === null || value === undefined || value === "" ? "-" : value}
    </p>
  </div>
);

export const DeliveryDetailPanel = ({
  delivery,
  loading,
  onClose,
}: {
  delivery: DeliveryRecord | null;
  loading: boolean;
  onClose: () => void;
}) => (
  <Modal
    title={
      delivery
        ? `Domicilio ${delivery.delivery_number || delivery.id.slice(0, 8)}`
        : "Detalle de domicilio"
    }
    description="Consulta operativa. No registra caja ni movimientos financieros."
    onClose={onClose}
    size="xl"
    footer={
      <Button variant="outline" onClick={onClose}>
        Cerrar
      </Button>
    }
  >
    {loading ? (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
        Cargando detalle...
      </div>
    ) : delivery ? (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <DeliveryStatusBadge status={delivery.status} />
          <span className="text-sm text-slate-500">
            Estado tecnico: {deliveryStatusLabels[delivery.status] ?? delivery.status}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="ID" value={delivery.id} />
          <DetailItem label="Numero" value={delivery.delivery_number} />
          <DetailItem label="Sucursal" value={delivery.branch_id} />
          <DetailItem label="Contacto" value={delivery.customer_name} />
          <DetailItem label="Telefono" value={delivery.customer_phone} />
          <DetailItem label="Cliente" value={delivery.customer_id} />
          <DetailItem label="Direccion" value={delivery.delivery_address} />
          <DetailItem label="Referencia" value={delivery.delivery_reference} />
          <DetailItem label="Pedido" value={delivery.order_id} />
          <DetailItem label="Venta" value={delivery.sale_id} />
          <DetailItem label="Repartidor" value={delivery.assigned_courier_id} />
          <DetailItem label="Metodo pago" value={delivery.payment_method_id} />
          <DetailItem label="Valor domicilio" value={formatCurrency(delivery.delivery_fee)} />
          <DetailItem label="Subtotal" value={formatCurrency(delivery.subtotal)} />
          <DetailItem label="Total" value={formatCurrency(delivery.total)} />
          <DetailItem label="Fuente financiera" value={getDeliveryFeeSource(delivery)} />
          <DetailItem label="Creado" value={formatDateTime(delivery.created_at)} />
          <DetailItem label="Actualizado" value={formatDateTime(delivery.updated_at)} />
          <DetailItem label="Entregado" value={formatDateTime(delivery.delivered_at)} />
          <DetailItem label="Cancelado" value={formatDateTime(delivery.cancelled_at)} />
          <DetailItem label="Creado por" value={delivery.created_by_user_id} />
          <DetailItem label="Actualizado por" value={delivery.updated_by_user_id} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Notas
          </p>
          <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-700">
            {delivery.notes || "Sin notas."}
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Historial y motivos formales dependen de que backend devuelva
          `delivery_status_history`. En esta fase se muestran timestamps y notas
          disponibles.
        </div>
      </div>
    ) : (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
        No se encontro el domicilio.
      </div>
    )}
  </Modal>
);
