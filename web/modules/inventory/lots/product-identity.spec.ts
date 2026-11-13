import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectMissingProductIds,
  matchesLotSearch,
  resolveProductIdentity,
  runWithConcurrency,
  UNRESOLVED_PRODUCT_NAME,
} from "./product-identity";

const catalog = new Map([["p2", { name: "Leche 1L", sku: "LCH-1" }]]);

describe("product-identity", () => {
  it("usa nombre y SKU de la respuesta de la API", () => {
    const identity = resolveProductIdentity(
      { productId: "p1", productName: "Aguardiente Amarillo 1000ml", productSku: "AGUADIENTE003" },
      catalog
    );
    assert.deepEqual(identity, { name: "Aguardiente Amarillo 1000ml", sku: "AGUADIENTE003", resolved: true });
  });

  it("usa el catálogo cuando la respuesta no trae nombre", () => {
    const identity = resolveProductIdentity({ productId: "p2", productName: null }, catalog);
    assert.equal(identity.name, "Leche 1L");
    assert.equal(identity.sku, "LCH-1");
  });

  it("nunca devuelve el UUID cuando no se puede resolver", () => {
    const identity = resolveProductIdentity({ productId: "00000000-aaaa" }, catalog);
    assert.equal(identity.name, UNRESOLVED_PRODUCT_NAME);
    assert.equal(identity.sku, "—");
    assert.equal(identity.resolved, false);
  });

  it("lista solo los productos faltantes, sin duplicados", () => {
    const missing = collectMissingProductIds(
      [
        { productId: "p1", productName: "Con nombre" },
        { productId: "p2" },
        { productId: "p3" },
        { productId: "p3" },
      ],
      catalog
    );
    assert.deepEqual(missing, ["p3"]);
  });

  it("busca por SKU sin distinguir mayúsculas", () => {
    assert.equal(matchesLotSearch("abc-001", ["L-10", "Leche", "ABC-001"]), true);
    assert.equal(matchesLotSearch("xyz", ["L-10", "Leche", "ABC-001"]), false);
    assert.equal(matchesLotSearch("  ", ["L-10"]), true);
  });

  it("respeta el límite de concurrencia y conserva errores por elemento", async () => {
    let running = 0;
    let peak = 0;
    const results = await runWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      if (value === 4) {
        throw new Error("fallo");
      }
      return value * 10;
    });
    assert.equal(peak, 2);
    assert.equal(results[0].status, "fulfilled");
    assert.equal(results[3].status, "rejected");
  });
});
