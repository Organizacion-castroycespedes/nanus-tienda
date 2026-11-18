import { describe, expect, it } from "vitest";
import { buildInsufficientStockMessage } from "./OrderDeliverForm";

describe("buildInsufficientStockMessage", () => {
  it("lista los productos sin saldo que informa la API", () => {
    const message = buildInsufficientStockMessage(
      "insufficient stock for delivery: Cable blanco (disponible 2, a entregar 3); Cable negro (disponible 0, a entregar 1)"
    );
    expect(message).toContain("Estos productos no tienen saldo suficiente");
    expect(message).toContain("• Cable blanco (disponible 2, a entregar 3)");
    expect(message).toContain("• Cable negro (disponible 0, a entregar 1)");
  });

  it("usa singular con un solo producto", () => {
    expect(
      buildInsufficientStockMessage("insufficient stock for delivery: Cable blanco (disponible 2, a entregar 3)")
    ).toContain("Este producto no tiene saldo suficiente");
  });

  it("conserva el mensaje generico si la API no trae detalle", () => {
    expect(buildInsufficientStockMessage("insufficient stock for delivery")).toContain(
      "No hay stock suficiente en inventario"
    );
  });
});
