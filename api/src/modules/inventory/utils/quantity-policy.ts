/**
 * Regla entero/decimal de cantidades por producto (V118).
 * - Venta por unidad sin marca: solo enteros.
 * - Venta por unidad con `allows_decimal_quantity`: hasta 2 decimales.
 * - Peso (WEIGHT/BOTH): no se valida aqui; lo gobierna la bascula y sus reglas existentes.
 */
export type QuantityPolicy = {
  saleType?: string | null;
  allowsDecimalQuantity?: boolean | null;
};

export const MAX_DECIMAL_QUANTITY_PLACES = 2;

/** Redondea a 3 decimales para comparar cantidades sin ruido de punto flotante. */
export const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

const hasAtMostDecimals = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
};

/**
 * Devuelve el motivo de rechazo o `null` si la cantidad es valida para el producto.
 * La cantidad debe venir ya validada como numero positivo.
 */
export const getQuantityPolicyViolation = (
  quantity: number,
  policy: QuantityPolicy,
  productLabel = "El producto"
): string | null => {
  const saleType = policy.saleType ?? "UNIT";
  if (saleType !== "UNIT") {
    return null;
  }
  if (policy.allowsDecimalQuantity) {
    return hasAtMostDecimals(quantity, MAX_DECIMAL_QUANTITY_PLACES)
      ? null
      : `${productLabel} admite máximo ${MAX_DECIMAL_QUANTITY_PLACES} decimales en la cantidad.`;
  }
  return Number.isInteger(roundQuantity(quantity)) && hasAtMostDecimals(quantity, 0)
    ? null
    : `${productLabel} se maneja por unidades enteras. Para usar decimales, activa "Permite cantidades con decimales" en el producto.`;
};
