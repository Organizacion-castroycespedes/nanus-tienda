import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ProductEntity, type ProductProps } from "./product.entity";

const build = (overrides: Partial<ProductProps> = {}) =>
  ProductEntity.create({
    id: randomUUID(),
    tenantId: randomUUID(),
    unitId: randomUUID(),
    taxId: null,
    name: "Cable THHN #12",
    description: null,
    sku: "CEC01002004",
    price: 2856,
    cost: 1850,
    priceWithTax: 2856,
    priceWithoutTax: 2400,
    isActive: true,
    createdAt: new Date("2026-11-16T00:00:00.000Z"),
    updatedAt: new Date("2026-11-16T00:00:00.000Z"),
    ...overrides,
  });

test("ProductEntity V118: por unidad acepta UND, M, L, CM y M2", () => {
  for (const measurementUnit of ["UND", "M", "L", "CM", "M2"] as const) {
    assert.equal(build({ saleType: "UNIT", measurementUnit }).measurementUnit, measurementUnit);
  }
});

test("ProductEntity V118: peso no acepta unidades de longitud o volumen", () => {
  assert.throws(() => build({ saleType: "WEIGHT", measurementUnit: "M" }), /weight measurementUnit/);
  assert.throws(() => build({ saleType: "UNIT", measurementUnit: "KG" }), /UND, M, L, CM or M2/);
});

test("ProductEntity V118: decimales por defecto apagados y permitidos por unidad", () => {
  assert.equal(build().allowsDecimalQuantity, false);
  assert.equal(build({ measurementUnit: "M", allowsDecimalQuantity: true }).allowsDecimalQuantity, true);
});

test("ProductEntity V118: decimales no aplican a peso ni a serie", () => {
  assert.throws(
    () => build({ saleType: "WEIGHT", measurementUnit: "KG", allowsDecimalQuantity: true }),
    /requires UNIT saleType/
  );
  assert.throws(
    () => build({ requiresSerial: true, allowsDecimalQuantity: true }),
    /cannot be combined with requiresSerial/
  );
});
