import type { ProductResponse } from "../../../domains/products/dtos";
import type { InventoryCaptureLine } from "../barcode/barcode-lines";

/** Reglas puras de la captura de compras tipo factura de proveedor (HU-SCAN-001, F3). */

export type PurchaseCaptureLine = InventoryCaptureLine & {
  cost: number;
  /** true cuando el usuario cambió el costo; los escaneos nunca lo sobrescriben. */
  costEdited: boolean;
};

const toMoney = (value: number) => Math.round(value * 100) / 100;

export const getPurchaseProductDefaultCost = (product: Pick<ProductResponse, "cost"> | undefined) => {
  const cost = Number(product?.cost);
  return Number.isFinite(cost) && cost > 0 ? toMoney(cost) : 0;
};

export const createPurchaseCaptureLine =
  (product: Pick<ProductResponse, "cost"> | undefined) =>
  (base: InventoryCaptureLine): PurchaseCaptureLine => ({
    ...base,
    cost: getPurchaseProductDefaultCost(product),
    costEdited: false,
  });

/** Costo unitario: número >= 0 con máximo 2 decimales; acepta coma o punto. */
export const parsePurchaseCost = (input: string | number | null | undefined) => {
  if (input === null || input === undefined) {
    return null;
  }
  const text = typeof input === "number" ? String(input) : input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export const setPurchaseLineCost = (
  lines: readonly PurchaseCaptureLine[],
  productId: string,
  cost: number
): PurchaseCaptureLine[] | null => {
  if (!Number.isFinite(cost) || cost < 0) {
    return null;
  }
  let found = false;
  const next = lines.map((line) => {
    if (line.productId !== productId) {
      return line;
    }
    found = true;
    return { ...line, cost: toMoney(cost), costEdited: true };
  });
  return found ? next : null;
};

export const getPurchaseLineSubtotal = (line: Pick<PurchaseCaptureLine, "cost" | "quantity">) =>
  toMoney(line.cost * line.quantity);

export type PurchaseItemPayload = {
  productId: string;
  quantity: number;
  cost: number;
  subtotal: number;
};

/** Ítems y total para POST /purchases (sin cambios de contrato). */
export const buildPurchaseItemsPayload = (
  lines: readonly PurchaseCaptureLine[]
): { items: PurchaseItemPayload[]; total: number } => {
  const items = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    cost: line.cost,
    subtotal: getPurchaseLineSubtotal(line),
  }));
  return { items, total: toMoney(items.reduce((sum, item) => sum + item.subtotal, 0)) };
};

/** Productos sin costo definido: se permiten (costo 0) pero se señalan para revisión. */
export const countPurchaseLinesWithoutCost = (lines: readonly PurchaseCaptureLine[]) =>
  lines.filter((line) => line.cost === 0).length;
