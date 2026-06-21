import { deliveryStatusLabels } from "../delivery-helpers";
import type { DeliveryStatus } from "../types";

const statusStyles: Record<DeliveryStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  CREATED: "border-blue-200 bg-blue-50 text-blue-700",
  ASSIGNED: "border-violet-200 bg-violet-50 text-violet-700",
  DISPATCHED: "border-amber-200 bg-amber-50 text-amber-800",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NOT_DELIVERED: "border-rose-200 bg-rose-50 text-rose-700",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-600",
};

export const DeliveryStatusBadge = ({ status }: { status: DeliveryStatus }) => (
  <span
    className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}
  >
    {deliveryStatusLabels[status] ?? status}
  </span>
);
