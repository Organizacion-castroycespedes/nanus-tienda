import type { ProductSerialStatus } from "../services/product-serial.service";

export const SERIAL_STATUS_LABELS: Record<ProductSerialStatus, string> = {
  AVAILABLE: "Disponible",
  SOLD: "Vendida",
  RETURNED: "Devuelta (por inspeccionar)",
  BLOCKED: "Bloqueada",
  WRITTEN_OFF: "De baja",
};

export const SERIAL_STATUS_STYLES: Record<ProductSerialStatus, string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SOLD: "border-slate-200 bg-slate-100 text-slate-700",
  RETURNED: "border-amber-200 bg-amber-50 text-amber-800",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
  WRITTEN_OFF: "border-zinc-300 bg-zinc-100 text-zinc-600",
};

const EVENT_LABELS: Record<string, string> = {
  RECEIVED: "Recibida",
  SOLD: "Vendida",
  DELIVERED: "Entregada en pedido",
  RETURNED: "Devuelta por anulación",
  VOIDED_NOT_RETURNED: "Venta anulada sin devolución",
  INSPECTED_AVAILABLE: "Inspeccionada: disponible",
  BLOCKED: "Bloqueada",
  UNBLOCKED: "Desbloqueada",
  WRITTEN_OFF: "Dada de baja",
  LOCATION_CHANGED: "Cambio de ubicación",
};

const REFERENCE_LABELS: Record<string, string> = {
  PURCHASE: "Compra",
  ADJUSTMENT: "Ajuste de inventario",
  SALE: "Venta",
  ORDER: "Pedido",
  SALE_VOID: "Anulación de venta",
  INSPECTION: "Inspección",
  LOCATION: "Ubicación",
};

export const serialStatusLabel = (status: string) =>
  SERIAL_STATUS_LABELS[status as ProductSerialStatus] ?? status;

export const serialEventLabel = (eventType: string) => EVENT_LABELS[eventType] ?? eventType;

export const serialReferenceLabel = (referenceType: string | null) =>
  referenceType ? REFERENCE_LABELS[referenceType] ?? referenceType : "";

export type SerialInspectionResult = "AVAILABLE" | "BLOCKED" | "WRITTEN_OFF";

/** Resultados permitidos según el estado (misma regla que fnc_product_serials_inspect). */
export const allowedInspectionResults = (status: string): SerialInspectionResult[] => {
  if (status === "RETURNED") return ["AVAILABLE", "BLOCKED", "WRITTEN_OFF"];
  if (status === "BLOCKED") return ["AVAILABLE", "WRITTEN_OFF"];
  if (status === "AVAILABLE") return ["BLOCKED"];
  return [];
};

export const INSPECTION_RESULT_LABELS: Record<SerialInspectionResult, string> = {
  AVAILABLE: "Pasar a disponible",
  BLOCKED: "Bloquear",
  WRITTEN_OFF: "Dar de baja (descuenta 1 unidad del inventario)",
};

/** Series que siguen en existencia y se pueden mover de ubicación. */
export const canMoveSerial = (status: string) => ["AVAILABLE", "RETURNED", "BLOCKED"].includes(status);
