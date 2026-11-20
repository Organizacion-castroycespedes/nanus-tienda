import type { ProductResponse } from "../../domains/products/dtos";
import type { QuotationDraftLine } from "./hooks/use-quotation-line-pricing";

type LineProduct = Pick<
  ProductResponse,
  "id" | "name" | "sku" | "measurementUnit" | "allowsDecimalQuantity" | "saleType" | "price"
>;

let lineSequence = 0;
const nextLineKey = () => {
  lineSequence += 1;
  return `line-${Date.now()}-${lineSequence}`;
};

/** Producto del catalogo -> linea en borrador. */
export const createDraftLine = (product: LineProduct, quantity = 1): QuotationDraftLine => ({
  key: nextLineKey(),
  productId: product.id,
  productName: product.name,
  productCode: product.sku ?? null,
  unitCode: product.measurementUnit ?? null,
  allowsDecimal: Boolean(product.allowsDecimalQuantity) || (product.saleType ?? "UNIT") !== "UNIT",
  quantity,
  listPrice: Number(product.price) > 0 ? Number(product.price) : 0,
});

/**
 * Agrega el producto o suma 1 si ya esta en la cotizacion (tambien para productos con
 * decimales o por peso: en una cotizacion no hay bascula; la cantidad se ajusta a mano).
 */
export const addOrIncrementLine = (lines: readonly QuotationDraftLine[], product: LineProduct) => {
  const index = lines.findIndex((line) => line.productId === product.id);
  if (index < 0) {
    const line = createDraftLine(product);
    return { lines: [...lines, line], line };
  }
  const line = { ...lines[index], quantity: Math.round((lines[index].quantity + 1) * 1000) / 1000 };
  return { lines: lines.map((current, position) => (position === index ? line : current)), line };
};
