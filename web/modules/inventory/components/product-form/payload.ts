import { isUnitMeasurementUnit } from "../../../../domains/products/dtos";
import type { UpdateProductPayload } from "../../services/product.service";

const immutableProductFields = [
  "unitId",
  "saleType",
  "isPerishable",
  "requiresLot",
  "requiresExpiration",
  "requiresSerial",
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
  // V118: en venta por unidad la unidad (UND, M, L, CM, M2) se puede cambiar despues de crear;
  // las unidades de peso siguen siendo estructurales.
  if (!isUnitMeasurementUnit(editablePayload.measurementUnit)) {
    delete editablePayload.measurementUnit;
  }

  return editablePayload;
};
