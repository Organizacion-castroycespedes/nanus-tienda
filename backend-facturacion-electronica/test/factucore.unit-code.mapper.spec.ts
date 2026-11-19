import assert from "node:assert/strict";
import test from "node:test";
import { mapUnitCode } from "../src/modules/electronic-billing/providers/factucore/factucore.mapper";

test("FactuCore mapUnitCode: UND y vacio conservan EA", () => {
  assert.equal(mapUnitCode("UND"), "EA");
  assert.equal(mapUnitCode("UNIT"), "EA");
  assert.equal(mapUnitCode(null), "EA");
  assert.equal(mapUnitCode(undefined), "EA");
});

test("FactuCore mapUnitCode: unidades nuevas usan codigo DIAN UN/ECE", () => {
  assert.equal(mapUnitCode("M"), "MTR");
  assert.equal(mapUnitCode("L"), "LTR");
  assert.equal(mapUnitCode("CM"), "CMT");
  assert.equal(mapUnitCode("M2"), "MTK");
});

test("FactuCore mapUnitCode: unidades de peso usan codigo DIAN", () => {
  assert.equal(mapUnitCode("KG"), "KGM");
  assert.equal(mapUnitCode("kg"), "KGM");
  assert.equal(mapUnitCode("G"), "GRM");
  assert.equal(mapUnitCode("LB"), "LBR");
  assert.equal(mapUnitCode("OZ"), "ONZ");
});

test("FactuCore mapUnitCode: un codigo DIAN ya resuelto pasa igual", () => {
  assert.equal(mapUnitCode("NIU"), "NIU");
  assert.equal(mapUnitCode("MTR"), "MTR");
});
