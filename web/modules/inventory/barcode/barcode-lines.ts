import type { ProductResponse } from "../../../domains/products/dtos";

/**
 * Reglas puras de líneas para la captura de pedidos y compras y para la
 * preparación de recepciones (HU-SCAN-001, D5 y D9). No persisten nada.
 */

export type InventoryProductSaleType = "UNIT" | "WEIGHT" | "BOTH";
export type InventoryCaptureMode = "UNIT" | "WEIGHT";

/** Decimales admitidos por order_items / purchase_items (NUMERIC(12,2)). */
export const INVENTORY_QUANTITY_DECIMALS = 2;
export const INVENTORY_MAX_QUANTITY = 9_999_999_999.99;

const WEIGHABLE_UNIT_CODES = new Set(["kg", "kilo", "kilogramo", "gr", "gramo", "lb", "libra"]);
const WEIGHABLE_PRODUCT_TYPES = new Set(["peso", "pesable", "granel", "weighable", "weight"]);

const normalizeUnitValue = (value?: string | null) => (value ?? "").trim().toLowerCase();

type SaleTypeProduct = Pick<
  ProductResponse,
  | "saleType"
  | "isWeighable"
  | "weighable"
  | "soldByWeight"
  | "unitCode"
  | "measurementUnit"
  | "unitName"
  | "unitSymbol"
  | "unitAbbreviation"
  | "productType"
>;

/**
 * Mismo criterio que el POS (web/modules/pos/utils/product-classification.ts),
 * replicado para no depender del módulo POS (D1).
 */
export const resolveInventoryProductSaleType = (
  product: SaleTypeProduct
): InventoryProductSaleType => {
  if (product.saleType) {
    return product.saleType;
  }
  if (product.isWeighable || product.weighable || product.soldByWeight) {
    return "WEIGHT";
  }
  const unitValues = [
    product.unitCode,
    product.measurementUnit,
    product.unitName,
    product.unitSymbol,
    product.unitAbbreviation,
  ].map(normalizeUnitValue);
  if (unitValues.some((value) => WEIGHABLE_UNIT_CODES.has(value))) {
    return "WEIGHT";
  }
  if (WEIGHABLE_PRODUCT_TYPES.has(normalizeUnitValue(product.productType))) {
    return "WEIGHT";
  }
  return "UNIT";
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export const roundInventoryQuantity = (value: number) => fromCents(toCents(value));

export const isValidInventoryQuantity = (value: number) =>
  Number.isFinite(value) &&
  value > 0 &&
  value <= INVENTORY_MAX_QUANTITY &&
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/** Acepta coma o punto decimal; devuelve null si no es una cantidad válida. */
export const parseInventoryQuantity = (input: string | number | null | undefined) => {
  if (input === null || input === undefined) {
    return null;
  }
  const text = typeof input === "number" ? String(input) : input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return isValidInventoryQuantity(value) ? value : null;
};

export type InventoryCaptureLine = {
  productId: string;
  quantity: number;
  mode: InventoryCaptureMode;
};

export type InventoryCaptureAddInput = {
  productId: string;
  mode: InventoryCaptureMode;
  quantity: number;
};

export type InventoryCaptureResult<L extends InventoryCaptureLine> =
  | { ok: true; lines: L[]; line: L; created: boolean }
  | { ok: false; reason: "MODE_MISMATCH"; existingMode: InventoryCaptureMode }
  | { ok: false; reason: "INVALID_QUANTITY" }
  | { ok: false; reason: "LINE_NOT_FOUND" };

/** Agrega o incrementa la línea del producto sin duplicarla. */
export const addInventoryCaptureQuantity = <L extends InventoryCaptureLine>(
  lines: readonly L[],
  input: InventoryCaptureAddInput,
  createLine: (base: InventoryCaptureLine) => L
): InventoryCaptureResult<L> => {
  if (!isValidInventoryQuantity(input.quantity)) {
    return { ok: false, reason: "INVALID_QUANTITY" };
  }

  const index = lines.findIndex((line) => line.productId === input.productId);
  if (index === -1) {
    const line = createLine({
      productId: input.productId,
      mode: input.mode,
      quantity: roundInventoryQuantity(input.quantity),
    });
    return { ok: true, lines: [...lines, line], line, created: true };
  }

  const existing = lines[index];
  if (existing.mode !== input.mode) {
    return { ok: false, reason: "MODE_MISMATCH", existingMode: existing.mode };
  }

  const quantity = fromCents(toCents(existing.quantity) + toCents(input.quantity));
  if (!isValidInventoryQuantity(quantity)) {
    return { ok: false, reason: "INVALID_QUANTITY" };
  }

  const line = { ...existing, quantity };
  const next = [...lines];
  next[index] = line;
  return { ok: true, lines: next, line, created: false };
};

/** Fija la cantidad de una línea existente (> 0). Para eliminar usar removeInventoryCaptureLine. */
export const setInventoryCaptureQuantity = <L extends InventoryCaptureLine>(
  lines: readonly L[],
  productId: string,
  quantity: number
): InventoryCaptureResult<L> => {
  const index = lines.findIndex((line) => line.productId === productId);
  if (index === -1) {
    return { ok: false, reason: "LINE_NOT_FOUND" };
  }
  if (!isValidInventoryQuantity(quantity)) {
    return { ok: false, reason: "INVALID_QUANTITY" };
  }
  const line = { ...lines[index], quantity: roundInventoryQuantity(quantity) };
  const next = [...lines];
  next[index] = line;
  return { ok: true, lines: next, line, created: false };
};

export const removeInventoryCaptureLine = <L extends InventoryCaptureLine>(
  lines: readonly L[],
  productId: string
) => lines.filter((line) => line.productId !== productId);

export type InventoryReceiptItem = {
  id: string;
  productId: string;
  orderedQuantity: number;
  receivedQuantity: number;
};

/** Cantidad preparada por purchaseItemId. */
export type InventoryReceiptPrepared = Readonly<Record<string, number>>;

export const getInventoryReceiptRemaining = (
  item: InventoryReceiptItem,
  prepared: InventoryReceiptPrepared
) =>
  fromCents(
    Math.max(
      toCents(Number(item.orderedQuantity) || 0) -
        toCents(Number(item.receivedQuantity) || 0) -
        toCents(prepared[item.id] ?? 0),
      0
    )
  );

export type InventoryReceiptPrepareResult =
  | { ok: true; purchaseItemId: string; prepared: Record<string, number>; remaining: number }
  | { ok: false; reason: "NOT_IN_DOCUMENT" }
  | { ok: false; reason: "INVALID_QUANTITY" }
  | { ok: false; reason: "EXCEEDS_PENDING"; remaining: number };

/**
 * Suma una cantidad escaneada a la primera línea del producto con pendiente
 * suficiente. Nunca supera el pendiente (cero tolerancia).
 */
export const prepareInventoryReceiptQuantity = (
  items: readonly InventoryReceiptItem[],
  prepared: InventoryReceiptPrepared,
  productId: string,
  quantity: number
): InventoryReceiptPrepareResult => {
  const productItems = items.filter((item) => item.productId === productId);
  if (productItems.length === 0) {
    return { ok: false, reason: "NOT_IN_DOCUMENT" };
  }
  if (!isValidInventoryQuantity(quantity)) {
    return { ok: false, reason: "INVALID_QUANTITY" };
  }

  const target = productItems.find(
    (item) => toCents(getInventoryReceiptRemaining(item, prepared)) >= toCents(quantity)
  );
  if (!target) {
    const remaining = fromCents(
      productItems.reduce(
        (sum, item) => sum + toCents(getInventoryReceiptRemaining(item, prepared)),
        0
      )
    );
    return { ok: false, reason: "EXCEEDS_PENDING", remaining };
  }

  const nextPrepared = {
    ...prepared,
    [target.id]: fromCents(toCents(prepared[target.id] ?? 0) + toCents(quantity)),
  };
  return {
    ok: true,
    purchaseItemId: target.id,
    prepared: nextPrepared,
    remaining: getInventoryReceiptRemaining(target, nextPrepared),
  };
};
