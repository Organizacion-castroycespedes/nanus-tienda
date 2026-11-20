import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  addDays,
  assertCanApprove,
  assertCanConvert,
  assertCanEdit,
  assertCanReject,
  assertCanRenew,
  assertCanSend,
  assertValidityDays,
  resolveEffectiveStatus,
  todayInBogota,
} from "./quotation.policy";

test("todayInBogota usa la fecha de Colombia y no la UTC", () => {
  assert.equal(todayInBogota(new Date("2026-11-20T03:30:00.000Z")), "2026-11-19");
  assert.equal(todayInBogota(new Date("2026-11-20T05:30:00.000Z")), "2026-11-20");
});

test("addDays calcula la vigencia por defecto y cruza meses y anios", () => {
  assert.equal(addDays("2026-11-19", 15), "2026-12-04");
  assert.equal(addDays("2026-12-25", 15), "2027-01-09");
  assert.equal(addDays("2028-02-20", 10), "2028-03-01");
});

test("resolveEffectiveStatus vence al dia siguiente del ultimo dia de vigencia", () => {
  assert.equal(resolveEffectiveStatus("APPROVED", "2026-12-04", "2026-12-04"), "APPROVED");
  assert.equal(resolveEffectiveStatus("APPROVED", "2026-12-04", "2026-12-05"), "EXPIRED");
  assert.equal(resolveEffectiveStatus("DRAFT", "2026-12-04", "2026-12-05"), "EXPIRED");
  assert.equal(resolveEffectiveStatus("SENT", "2026-12-04", "2026-12-05"), "EXPIRED");
  assert.equal(resolveEffectiveStatus("CONVERTED", "2026-12-04", "2026-12-05"), "CONVERTED");
  assert.equal(resolveEffectiveStatus("REJECTED", "2026-12-04", "2026-12-05"), "REJECTED");
});

test("assertValidityDays acepta 1..365 enteros", () => {
  assert.equal(assertValidityDays(15), 15);
  assert.equal(assertValidityDays("30"), 30);
  for (const value of [0, 366, 1.5, "x", null]) {
    assert.throws(() => assertValidityDays(value), BadRequestException);
  }
});

test("solo se edita en DRAFT o SENT vigente", () => {
  const today = "2026-11-20";
  assertCanEdit({ status: "DRAFT", validUntil: "2026-12-04" }, today);
  assertCanEdit({ status: "SENT", validUntil: "2026-12-04" }, today);
  assert.throws(() => assertCanEdit({ status: "APPROVED", validUntil: "2026-12-04" }, today), ConflictException);
  assert.throws(() => assertCanEdit({ status: "DRAFT", validUntil: "2026-11-19" }, today), /vencida/);
});

test("transiciones de envio, aprobacion y rechazo", () => {
  const today = "2026-11-20";
  assertCanSend({ status: "DRAFT", validUntil: "2026-12-04" }, today);
  assert.throws(() => assertCanSend({ status: "SENT", validUntil: "2026-12-04" }, today), ConflictException);
  assertCanApprove({ status: "SENT", validUntil: "2026-12-04" }, today);
  assert.throws(() => assertCanApprove({ status: "SENT", validUntil: "2026-11-01" }, today), /vencida/);
  assert.equal(assertCanReject({ status: "APPROVED", validUntil: "2026-12-04" }, "  precio alto "), "precio alto");
  assert.throws(() => assertCanReject({ status: "DRAFT", validUntil: "2026-12-04" }, " "), BadRequestException);
  assert.throws(() => assertCanReject({ status: "CONVERTED", validUntil: "2026-12-04" }, "x"), ConflictException);
});

test("renovar solo cotizaciones vencidas", () => {
  assertCanRenew({ status: "APPROVED", validUntil: "2026-11-01" }, "2026-11-20");
  assert.throws(() => assertCanRenew({ status: "APPROVED", validUntil: "2026-12-04" }, "2026-11-20"), ConflictException);
  assert.throws(() => assertCanRenew({ status: "CONVERTED", validUntil: "2026-11-01" }, "2026-11-20"), ConflictException);
});

test("convertir exige APPROVED vigente y sin pedido", () => {
  const today = "2026-11-20";
  assertCanConvert({ status: "APPROVED", validUntil: "2026-12-04" }, today);
  assert.throws(() => assertCanConvert({ status: "SENT", validUntil: "2026-12-04" }, today), ConflictException);
  assert.throws(() => assertCanConvert({ status: "APPROVED", validUntil: "2026-11-19" }, today), /vencida/);
  assert.throws(
    () => assertCanConvert({ status: "CONVERTED", validUntil: "2026-12-04", convertedOrderId: "o-1" }, today),
    (error: unknown) =>
      error instanceof ConflictException &&
      (error.getResponse() as { orderId?: string }).orderId === "o-1"
  );
});
