import { describe, expect, it } from "vitest";
import { buildProductUpdatePayload } from "./payload";

describe("buildProductUpdatePayload", () => {
  it("preserves editable fields and removes product type from updates", () => {
    expect(
      buildProductUpdatePayload({
        name: "Servicio actualizado",
        price: 125,
        isInventoryable: true,
        inventoryabilityChangeReason: "Cambio obsoleto",
        unitId: "unit-new",
        operationalStatus: "INACTIVE",
      }),
    ).toEqual({
      name: "Servicio actualizado",
      price: 125,
      operationalStatus: "INACTIVE",
    });
  });

  it("omits the type even when the persisted product is a service", () => {
    expect(
      buildProductUpdatePayload({
        isInventoryable: false,
        inventoryabilityChangeReason: null,
        cost: 40,
      }),
    ).toEqual({ cost: 40 });
  });
});
