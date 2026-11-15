import assert from "node:assert/strict";
import test from "node:test";
import type { PosCartItem } from "../../../store/posCart";
import {
  buildSaleLineSerialIds,
  collectSerialsInOtherAccounts,
  findScannedSerial,
  findSerialCartIssue,
  formatPosSerialLabel,
  togglePosSerial,
} from "./pos-serials";

const baseItem: PosCartItem = {
  productId: "p1",
  name: "Inverter",
  sku: "INV",
  quantity: 2,
  price: 100,
  stock: 5,
  taxId: null,
  priceWithoutTax: 100,
};

const s1 = { id: "id-1", serialNumber: "3H61260000017", locationCode: "002" };
const s2 = { id: "id-2", serialNumber: "3H61260000018", locationCode: null };

test("findSerialCartIssue solo marca productos con serie y conteo distinto", () => {
  assert.equal(findSerialCartIssue([baseItem]), null);
  const incomplete = { ...baseItem, requiresSerial: true, serials: [s1] };
  assert.equal(findSerialCartIssue([baseItem, incomplete])?.productId, "p1");
  assert.equal(findSerialCartIssue([{ ...incomplete, serials: [s1, s2] }]), null);
});

test("buildSaleLineSerialIds deja el payload igual para productos sin serie", () => {
  assert.equal(buildSaleLineSerialIds(baseItem), undefined);
  assert.deepEqual(buildSaleLineSerialIds({ ...baseItem, requiresSerial: true, serials: [s1, s2] }), ["id-1", "id-2"]);
});

test("togglePosSerial respeta el máximo y permite quitar", () => {
  assert.deepEqual(togglePosSerial([], s1, 1), [s1]);
  assert.deepEqual(togglePosSerial([s1], s2, 1), [s1]);
  assert.deepEqual(togglePosSerial([s1, s2], s1, 2), [s2]);
});

test("findScannedSerial y etiqueta con ubicación", () => {
  assert.equal(findScannedSerial([s1, s2], " 3h61260000018 ")?.id, "id-2");
  assert.equal(findScannedSerial([s1], "OTRA"), null);
  assert.equal(formatPosSerialLabel(s1), "3H61260000017 · 002");
  assert.equal(formatPosSerialLabel(s2), "3H61260000018");
});

test("collectSerialsInOtherAccounts lista las series del producto en las demás cuentas", () => {
  const accounts = [
    { id: "c1", name: "Cuenta 1", items: [{ ...baseItem, requiresSerial: true, serials: [s1] }] },
    { id: "c2", name: "Cuenta 2", items: [{ ...baseItem, requiresSerial: true, serials: [s2] }] },
    { id: "c3", name: "Cuenta 3", items: [{ ...baseItem, productId: "otro", requiresSerial: true, serials: [s2] }] },
  ];
  assert.deepEqual(collectSerialsInOtherAccounts(accounts, "c2", "p1"), [{ id: "id-1", accountName: "Cuenta 1" }]);
  assert.deepEqual(collectSerialsInOtherAccounts(accounts, "c1", "p1"), [{ id: "id-2", accountName: "Cuenta 2" }]);
});
