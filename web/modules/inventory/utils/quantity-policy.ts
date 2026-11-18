/**
 * Regla entero/decimal de cantidades por producto (V118), igual que la API
 * (api/src/modules/inventory/utils/quantity-policy.ts).
 * - Venta por unidad sin marca: solo enteros.
 * - Venta por unidad con `allowsDecimalQuantity`: hasta 2 decimales.
 * - Peso (WEIGHT/BOTH): sin cambios (bascula).
 */
export type QuantityPolicy = {
  saleType?: string | null;
  allowsDecimalQuantity?: boolean | null;
};

export const MAX_DECIMAL_QUANTITY_PLACES = 2;

/** Redondea a 3 decimales para mostrar y comparar sin ruido de punto flotante. */
export const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

/** true cuando el producto solo admite cantidades enteras. */
export const isIntegerOnlyQuantity = (policy: QuantityPolicy) =>
  (policy.saleType ?? "UNIT") === "UNIT" && !policy.allowsDecimalQuantity;

const hasAtMostDecimals = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
};

export const getQuantityPolicyViolation = (
  quantity: number,
  policy: QuantityPolicy,
  productLabel = "El producto"
): string | null => {
  if ((policy.saleType ?? "UNIT") !== "UNIT") {
    return null;
  }
  if (policy.allowsDecimalQuantity) {
    return hasAtMostDecimals(quantity, MAX_DECIMAL_QUANTITY_PLACES)
      ? null
      : `${productLabel} admite máximo ${MAX_DECIMAL_QUANTITY_PLACES} decimales.`;
  }
  return hasAtMostDecimals(quantity, 0)
    ? null
    : `${productLabel} se maneja por unidades enteras. Para usar decimales, activa "Permite cantidades con decimales" en el producto.`;
};

/** Paso del campo numerico segun la politica. */
export const getQuantityStep = (policy: QuantityPolicy) =>
  isIntegerOnlyQuantity(policy) ? "1" : "0.01";
