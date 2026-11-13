/**
 * Etiquetas legibles de la trazabilidad de lote
 * (change modernizar-inventario-lotes-ubicaciones, D14).
 */

export type TraceabilityReference = {
  referenceType: string | null;
  referenceTable: string | null;
};

export const describeMovementOrigin = ({ referenceType, referenceTable }: TraceabilityReference) => {
  switch (referenceType) {
    case "PURCHASE":
      return "Compra";
    case "SALE":
      return referenceTable === "orders" ? "Entrega de pedido" : "Venta POS";
    case "SALES_ORDER":
      return "Pedido";
    case "REFUND":
      return "Anulación de venta";
    case "ADJUSTMENT":
      return referenceTable === "stock_initial_load" ? "Carga de stock" : "Ajuste";
    default:
      return "Movimiento";
  }
};

export const describeMovementType = (type: "IN" | "OUT") => (type === "IN" ? "Entrada" : "Salida");

/** Cantidad con signo para mostrar en la tabla de movimientos. */
export const signedQuantity = (type: "IN" | "OUT", quantity: number) =>
  type === "IN" ? quantity : -quantity;

export const describeLocation = (
  code: string | null | undefined,
  name: string | null | undefined,
  isActive: boolean | null = true
) => {
  if (!code && !name) {
    return "Sin ubicación";
  }
  const label = [code, name].filter(Boolean).join(" - ");
  return isActive === false ? `${label} (inactiva)` : label;
};
