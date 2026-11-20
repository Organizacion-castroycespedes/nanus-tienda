import assert from "node:assert/strict";
import test from "node:test";
import { MENU_KEYS } from "../../domains/menu/constants";
import type { PermissionSummary } from "../../domains/menu/types";
import { daysUntil, formatQuotationDate, formatQuotationMoney } from "./quotation-format";
import { resolveQuotationActions, resolveQuotationPermissions } from "./quotation-permissions";

const permission = (actions: Record<string, boolean>, accessLevel: "READ" | "WRITE" = "WRITE"): PermissionSummary => ({
  key: MENU_KEYS.QUOTATIONS,
  module: "quotations",
  route: "/{tenant}/quotations",
  accessLevel,
  actions,
});

const userActions = { QUOTATIONS_VIEW: true, QUOTATIONS_CREATE: true, QUOTATIONS_UPDATE: true };
const adminActions = {
  ...userActions,
  QUOTATIONS_APPROVE: true,
  QUOTATIONS_CONVERT: true,
  QUOTATIONS_SETTINGS: true,
};

test("USER crea y edita pero no aprueba, convierte ni configura", () => {
  const resolved = resolveQuotationPermissions([permission(userActions)], "USER");
  assert.deepEqual(resolved, {
    view: true,
    create: true,
    update: true,
    approve: false,
    convert: false,
    settings: false,
  });
});

test("ADMIN tiene todas las acciones; SUPER_ADMIN siempre", () => {
  assert.equal(resolveQuotationPermissions([permission(adminActions)], "ADMIN").convert, true);
  assert.equal(resolveQuotationPermissions([], "SUPER_ADMIN").settings, true);
});

test("nivel READ solo permite ver aunque la accion venga marcada", () => {
  const resolved = resolveQuotationPermissions([permission(adminActions, "READ")], "ADMIN");
  assert.equal(resolved.view, true);
  assert.equal(resolved.approve, false);
  assert.equal(resolved.create, false);
});

test("sin permiso del menu no ve nada", () => {
  assert.equal(resolveQuotationPermissions([], "ADMIN").view, false);
});

test("acciones visibles segun estado efectivo", () => {
  const admin = resolveQuotationPermissions([permission(adminActions)], "ADMIN");
  assert.deepEqual(resolveQuotationActions("DRAFT", "DRAFT", admin), {
    edit: true, send: true, approve: true, reject: true, renew: false, duplicate: true, convert: false,
  });
  assert.deepEqual(resolveQuotationActions("APPROVED", "APPROVED", admin), {
    edit: false, send: true, approve: false, reject: true, renew: false, duplicate: true, convert: true,
  });
  assert.deepEqual(resolveQuotationActions("EXPIRED", "APPROVED", admin), {
    edit: false, send: false, approve: false, reject: true, renew: true, duplicate: true, convert: false,
  });
  assert.deepEqual(resolveQuotationActions("CONVERTED", "CONVERTED", admin), {
    edit: false, send: false, approve: false, reject: false, renew: false, duplicate: true, convert: false,
  });
  const user = resolveQuotationPermissions([permission(userActions)], "USER");
  assert.equal(resolveQuotationActions("APPROVED", "APPROVED", user).convert, false);
  assert.equal(resolveQuotationActions("SENT", "SENT", user).approve, false);
});

test("formato de dinero, fechas y dias de vigencia", () => {
  assert.equal(formatQuotationMoney(14101.5).replace(/\s/g, " "), "$ 14.101,50");
  assert.equal(formatQuotationMoney(1190).replace(/\s/g, " "), "$ 1.190");
  assert.equal(formatQuotationDate("2026-12-04"), "4 dic 2026");
  const now = new Date("2026-11-20T03:00:00.000Z"); // 19-nov en Bogota
  assert.equal(daysUntil("2026-12-04", now), 15);
  assert.equal(daysUntil("2026-11-19", now), 0);
  assert.equal(daysUntil("2026-11-18", now), -1);
});
