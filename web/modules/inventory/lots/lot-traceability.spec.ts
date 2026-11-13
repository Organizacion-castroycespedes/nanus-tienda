import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeLocation,
  describeMovementOrigin,
  describeMovementType,
  signedQuantity,
} from "./lot-traceability";

describe("lot-traceability", () => {
  it("traduce el origen del movimiento", () => {
    assert.equal(describeMovementOrigin({ referenceType: "PURCHASE", referenceTable: "purchases" }), "Compra");
    assert.equal(describeMovementOrigin({ referenceType: "SALE", referenceTable: "sales" }), "Venta POS");
    assert.equal(describeMovementOrigin({ referenceType: "SALE", referenceTable: "orders" }), "Entrega de pedido");
    assert.equal(describeMovementOrigin({ referenceType: "REFUND", referenceTable: "sales" }), "Anulación de venta");
    assert.equal(
      describeMovementOrigin({ referenceType: "ADJUSTMENT", referenceTable: "stock_initial_load" }),
      "Carga de stock"
    );
    assert.equal(describeMovementOrigin({ referenceType: "ADJUSTMENT", referenceTable: "stock_adjustments" }), "Ajuste");
    assert.equal(describeMovementOrigin({ referenceType: null, referenceTable: null }), "Movimiento");
  });

  it("muestra tipo y cantidad con signo", () => {
    assert.equal(describeMovementType("IN"), "Entrada");
    assert.equal(describeMovementType("OUT"), "Salida");
    assert.equal(signedQuantity("IN", 5), 5);
    assert.equal(signedQuantity("OUT", 3), -3);
  });

  it("describe ubicaciones sin exponer identificadores", () => {
    assert.equal(describeLocation("002", "Licores"), "002 - Licores");
    assert.equal(describeLocation("002", "Licores", false), "002 - Licores (inactiva)");
    assert.equal(describeLocation(null, null), "Sin ubicación");
  });
});
