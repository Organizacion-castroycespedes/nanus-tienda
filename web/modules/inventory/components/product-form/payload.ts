import type { UpdateProductPayload } from "../../services/product.service";

const immutableProductFields = [
  "unitId",
  "saleType",
  "measurementUnit",
  "isPerishable",
  "requiresLot",
  "requiresExpiration",
  "isInventoryable",
  "inventoryabilityChangeReason",
] as const;

export const buildProductUpdatePayload = (
  payload: UpdateProductPayload,
): UpdateProductPayload => {
  const editablePayload: UpdateProductPayload = { ...payload };

  for (const field of immutableProductFields) {
    delete editablePayload[field];
  }

  return editablePayload;
};
