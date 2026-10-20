import assert from "node:assert/strict";
import test from "node:test";
import { assertBindingInvariant, authorizeScaleBinding, disableScaleBinding, revokeScaleBinding, type ScaleBinding } from "./scale-binding.domain";

const binding: ScaleBinding = {
  id: "binding-1", tenantId: "t1", branchId: "b1", posTerminalId: "p1",
  operationalTerminalId: "o1", terminalDeviceId: "d1", logicalScaleId: "serial-rochi-a01e-0123456789abcdef",
  status: "PENDING", unitState: "NOT_VERIFIED",
};

test("authorization requires coherent context and explicit KG confirmation", () => {
  const confirmation = { method: "OPERATOR_CONFIRMATION" as const, displayedUnit: "kg" as const, operatorId: "operator-1", confirmedAt: "2026-01-01T00:00:00Z" };
  assert.throws(() => authorizeScaleBinding(binding, null, binding), /KG_OPERATOR_CONFIRMATION_REQUIRED/);
  assert.throws(() => authorizeScaleBinding(binding, confirmation, { ...binding, branchId: "other" }), /SCALE_BINDING_CONTEXT_MISMATCH/);
  const authorized = authorizeScaleBinding(binding, confirmation, binding, new Date("2026-02-01T00:00:00Z"));
  assert.equal(authorized.status, "AUTHORIZED");
  assert.equal(authorized.unitState, "KG_VERIFIED");
  assertBindingInvariant(authorized);
  assert.throws(() => authorizeScaleBinding(binding, { ...confirmation, confirmedAt: "2027-01-01T00:00:00Z" }, binding, new Date("2026-02-01T00:00:00Z")), /KG_OPERATOR_CONFIRMATION_REQUIRED/);
});

test("AUTHORIZED without KG verification violates the invariant", () => {
  assert.throws(() => assertBindingInvariant({ ...binding, status: "AUTHORIZED" }), /AUTHORIZED_BINDING_REQUIRES_KG_VERIFIED/);
  assert.equal(revokeScaleBinding(binding).status, "REVOKED");
  assert.equal(disableScaleBinding(binding).status, "DISABLED");
});
