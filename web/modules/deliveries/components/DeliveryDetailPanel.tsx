import { Modal } from "../../../components/design-system/Modal";
import { Button } from "../../../components/design-system/Button";
import { FileText, UserCheck } from "lucide-react";
import {
  deliveryStatusLabels,
  getDeliveryFeeSource,
} from "../delivery-helpers";
import {
  getDeliveryCashScope,
  getDeliveryCashScopeLabel,
} from "../delivery-cash-scope";
import type {
  DeliveryActionKey,
  DeliveryActionPermissionMap,
  DeliveryRecord,
} from "../types";
import { DeliveryActions } from "./DeliveryActions";
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
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </p>
    <p className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">
      {value === null || value === undefined || value === "" ? "-" : value}
    </p>
  </div>
);

export const DeliveryDetailPanel = ({
  delivery,
  loading,
  permissions,
  actionDisabled,
  onClose,
  onAction,
  onAssignDriver,
  onTicket,
  currentCashSessionId,
}: {
  delivery: DeliveryRecord | null;
  loading: boolean;
  permissions?: DeliveryActionPermissionMap;
  actionDisabled?: boolean;
  onClose: () => void;
  onAction?: (action: DeliveryActionKey, delivery: DeliveryRecord) => void;
  onAssignDriver?: (delivery: DeliveryRecord) => void;
  onTicket?: (delivery: DeliveryRecord) => void;
  currentCashSessionId?: string | null;
}) => (
  <Modal
    title={
      delivery
        ? `Domicilio ${delivery.delivery_number || delivery.id.slice(0, 8)}`
        : "Detalle de domicilio"
    }
    description="Consulta operativa. El valor domicilio se controla por caja actual cuando aplica."
    onClose={onClose}
    size="xl"
    className="max-h-[calc(100dvh-1rem)] overflow-hidden sm:max-h-[calc(100dvh-3rem)]"
    footer={
      <Button variant="outline" onClick={onClose}>
        Cerrar
      </Button>
    }
  >
    {loading ? (
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500 sm:max-h-[calc(100dvh-12rem)] dark:text-slate-400">
        Cargando detalle...
      </div>
    ) : delivery ? (
      <div className="max-h-[calc(100dvh-10rem)] min-w-0 space-y-5 overflow-y-auto overflow-x-hidden pr-1 sm:max-h-[calc(100dvh-12rem)]">
        <div className="flex flex-wrap items-center gap-3">
          <DeliveryStatusBadge status={delivery.status} />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Estado: {deliveryStatusLabels[delivery.status] ?? delivery.status}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {getDeliveryCashScopeLabel(
              getDeliveryCashScope(delivery, currentCashSessionId)
            )}
          </span>
        </div>

        {permissions && onAction ? (
          <div className="sticky top-0 z-10 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Acciones
            </p>
            <DeliveryActions
              delivery={delivery}
              permissions={permissions}
              disabled={Boolean(actionDisabled)}
              onAction={onAction}
            />
            {onAssignDriver ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={Boolean(actionDisabled)}
                onClick={() => onAssignDriver(delivery)}
              >
                <UserCheck className="h-4 w-4" />
                {delivery.driver_id ? "Cambiar repartidor" : "Asignar repartidor"}
              </Button>
            ) : null}
            {onTicket ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => onTicket(delivery)}
              >
                <FileText className="h-4 w-4" />
                Ticket domicilio
              </Button>
            ) : null}
          </div>
        ) : null}

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
          <DetailItem
            label="Repartidor"
            value={delivery.driver?.name ?? delivery.driver_id}
          />
          <DetailItem label="Telefono repartidor" value={delivery.driver?.phone} />
          <DetailItem
            label="Documento repartidor"
            value={delivery.driver?.document_number}
          />
          <DetailItem
            label="Repartidor legacy"
            value={delivery.assigned_courier_id}
          />
          <DetailItem label="Metodo pago" value={delivery.payment_method_id} />
          <DetailItem label="Caja sesion" value={delivery.cash_session_id} />
          <DetailItem label="Caja registradora" value={delivery.cash_register_id} />
          <DetailItem label="Terminal" value={delivery.terminal_id} />
          <DetailItem
            label="Impacto caja"
            value={formatCurrency(delivery.cash_impact_amount)}
          />
          <DetailItem label="Valor domicilio" value={formatCurrency(delivery.delivery_fee)} />
          <DetailItem label="Subtotal" value={formatCurrency(delivery.subtotal)} />
          <DetailItem label="Total" value={formatCurrency(delivery.total)} />
          <DetailItem label="Fuente financiera" value={getDeliveryFeeSource(delivery)} />
          <DetailItem label="Creado" value={formatDateTime(delivery.created_at)} />
          <DetailItem label="Actualizado" value={formatDateTime(delivery.updated_at)} />
          <DetailItem label="Despachado" value={formatDateTime(delivery.dispatched_at)} />
          <DetailItem label="Entregado" value={formatDateTime(delivery.delivered_at)} />
          <DetailItem label="No entregado" value={formatDateTime(delivery.failed_at)} />
          <DetailItem label="Cancelado" value={formatDateTime(delivery.cancelled_at)} />
          <DetailItem label="Creado por" value={delivery.created_by_user_id} />
          <DetailItem label="Actualizado por" value={delivery.updated_by_user_id} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Notas
          </p>
          <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-200">
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
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500 sm:max-h-[calc(100dvh-12rem)] dark:text-slate-400">
        No se encontro el domicilio.
      </div>
    )}
  </Modal>
);
