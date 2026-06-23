import { deliveryStatusLabels } from "../delivery-helpers";
import { normalizeDeliveryStatus, type DeliveryStatus } from "../types";

const statusStyles: Record<DeliveryStatus, string> = {
  CREADO: "border-blue-200 bg-blue-50 text-blue-700",
  EN_PREPARACION: "border-violet-200 bg-violet-50 text-violet-700",
  DESPACHADO: "border-amber-200 bg-amber-50 text-amber-800",
  ENTREGADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NO_ENTREGADO: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELADO: "border-slate-300 bg-slate-100 text-slate-600",
};

export const DeliveryStatusBadge = ({ status }: { status: DeliveryStatus | string }) => {
  const operationalStatus = normalizeDeliveryStatus(status) ?? "CREADO";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[operationalStatus]}`}
    >
      {deliveryStatusLabels[operationalStatus] ?? status}
    </span>
  );
};
