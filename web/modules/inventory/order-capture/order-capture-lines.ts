import type { ProductResponse } from "../../../domains/products/dtos";
import {
  resolveInventoryProductSaleType,
  roundInventoryQuantity,
  type InventoryCaptureLine,
  type InventoryCaptureMode,
} from "../barcode/barcode-lines";
import type { OrderLinePricePreview } from "./order-pricing-preview";

/** Reglas puras del ticket de pedidos de venta (HU-SCAN-001, F2). */

export type OrderCaptureLine = InventoryCaptureLine & {
  /** Precio de lista del catálogo; respaldo si no hay preview del backend. */
  listPrice: number;
};

export type OrderLinePricingState =
  | { status: "loading"; key: string }
  | { status: "ready"; key: string; preview: OrderLinePricePreview }
  | { status: "pending"; key: string }
  | { status: "forbidden"; key: string }
  | { status: "error"; key: string; message: string };

export type OrderCaptureProduct = Pick<
  ProductResponse,
  | "id"
  | "name"
  | "price"
  | "stock"
  | "isInventoryable"
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

const toMoney = (value: number) => Math.round(value * 100) / 100;

export const getOrderProductListPrice = (product: Pick<ProductResponse, "price"> | undefined) => {
  const price = Number(product?.price);
  return Number.isFinite(price) && price > 0 ? price : 0;
};

export const createOrderCaptureLine =
  (product: Pick<ProductResponse, "price"> | undefined) =>
  (base: InventoryCaptureLine): OrderCaptureLine => ({
    ...base,
    listPrice: getOrderProductListPrice(product),
  });

/** Modo de una línea existente al editar un pedido DRAFT. */
export const resolveOrderLineModeForExistingItem = (
  product: OrderCaptureProduct | undefined,
  quantity: number
): InventoryCaptureMode => {
  if (!product) {
    return Number.isInteger(quantity) ? "UNIT" : "WEIGHT";
  }
  const saleType = resolveInventoryProductSaleType(product);
  if (saleType === "WEIGHT") {
    return "WEIGHT";
  }
  if (saleType === "BOTH") {
    return Number.isInteger(quantity) ? "UNIT" : "WEIGHT";
  }
  return "UNIT";
};

export type ExistingOrderItem = { productId: string; orderedQuantity: number; price: number };

/** Agrupa ítems de un pedido existente por producto (el ticket no duplica líneas). */
export const mapOrderItemsToCaptureLines = (
  items: readonly ExistingOrderItem[],
  products: readonly OrderCaptureProduct[]
): OrderCaptureLine[] => {
  const byProduct = new Map<string, OrderCaptureLine>();
  for (const item of items) {
    const quantity = Number(item.orderedQuantity) || 0;
    const existing = byProduct.get(item.productId);
    if (existing) {
      existing.quantity = roundInventoryQuantity(existing.quantity + quantity);
      continue;
    }
    const product = products.find((candidate) => candidate.id === item.productId);
    byProduct.set(item.productId, {
      productId: item.productId,
      quantity: roundInventoryQuantity(quantity),
      mode: resolveOrderLineModeForExistingItem(product, quantity),
      listPrice: getOrderProductListPrice(product) || Number(item.price) || 0,
    });
  }
  return [...byProduct.values()];
};

export const buildOrderLinePricingKey = (input: {
  branchId: string;
  customerId: string;
  productId: string;
  quantity: number;
}) => `${input.branchId}|${input.customerId}|${input.productId}|${input.quantity}`;

export type OrderLineAmounts = {
  unitPrice: number;
  lineTotal: number;
  /** true si el valor viene del backend para la cantidad actual. */
  fromBackend: boolean;
};

export const getOrderLineAmounts = (
  line: OrderCaptureLine,
  pricing: OrderLinePricingState | undefined,
  expectedKey: string
): OrderLineAmounts => {
  if (pricing?.status === "ready" && pricing.key === expectedKey) {
    return {
      unitPrice: pricing.preview.finalUnitPrice,
      lineTotal: toMoney(pricing.preview.lineTotal),
      fromBackend: true,
    };
  }
  return {
    unitPrice: line.listPrice,
    lineTotal: toMoney(line.listPrice * line.quantity),
    fromBackend: false,
  };
};

export type OrderStockWarning = { available: number; requested: number };

/** Aviso no bloqueante cuando la cantidad supera el stock de la sucursal (D7). */
export const getOrderLineStockWarning = (
  line: Pick<OrderCaptureLine, "quantity">,
  product: Pick<ProductResponse, "stock" | "isInventoryable"> | undefined
): OrderStockWarning | null => {
  if (!product || product.isInventoryable === false) {
    return null;
  }
  const stock = Number(product.stock);
  if (product.stock === undefined || product.stock === null || !Number.isFinite(stock)) {
    return null;
  }
  return line.quantity > stock ? { available: Math.max(stock, 0), requested: line.quantity } : null;
};

export type OrderItemPayload = {
  productId: string;
  quantity: number;
  price: number;
  subtotal: number;
};

/** Ítems para POST/PUT /orders. El backend recalcula precio e impuestos. */
export const buildOrderItemsPayload = (
  lines: readonly OrderCaptureLine[],
  amountsByProductId: ReadonlyMap<string, OrderLineAmounts>
): { items: OrderItemPayload[]; total: number } => {
  const items = lines.map((line) => {
    const amounts = amountsByProductId.get(line.productId) ?? {
      unitPrice: line.listPrice,
      lineTotal: toMoney(line.listPrice * line.quantity),
      fromBackend: false,
    };
    return {
      productId: line.productId,
      quantity: line.quantity,
      price: amounts.unitPrice,
      subtotal: amounts.lineTotal,
    };
  });
  return { items, total: toMoney(items.reduce((sum, item) => sum + item.subtotal, 0)) };
};
