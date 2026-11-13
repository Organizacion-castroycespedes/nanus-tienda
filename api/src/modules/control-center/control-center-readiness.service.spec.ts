import assert from "node:assert/strict";
import test from "node:test";
import { buildReadiness } from "./control-center-readiness.service";

const healthy = {
  db_user: "manus_cc_local",
  schema_present: true,
  audit_table_present: true,
  can_insert_audit: true,
  can_update_audit: false,
  can_delete_audit: false,
  platform_tenant_present: true,
  platform_tax_configured: true,
};

test("readiness: READY when schema, immutable audit, platform tenant and isolation are correct", () => {
  const result = buildReadiness("platform", healthy, false, new Date("2026-11-07T00:00:00Z"));
  assert.equal(result.status, "READY");
  assert.deepEqual(result.issues, []);
  assert.equal(result.database.auditImmutable, true);
});

test("readiness: DEGRADED when the operational API role can reach the schema", () => {
  const result = buildReadiness("platform", healthy, true);
  assert.equal(result.status, "DEGRADED");
  assert.ok(result.issues.includes("OPERATIONAL_ROLE_HAS_SCHEMA_ACCESS"));
});

test("readiness: DEGRADED when the audit table accepts updates", () => {
  const result = buildReadiness("platform", { ...healthy, can_update_audit: true }, false);
  assert.ok(result.issues.includes("AUDIT_NOT_IMMUTABLE"));
});

test("readiness: reports missing schema without privilege checks", () => {
  const result = buildReadiness(
    "platform",
    {
      ...healthy,
      schema_present: false,
      audit_table_present: false,
      can_insert_audit: null,
      can_update_audit: null,
      can_delete_audit: null,
    },
    false,
  );
  assert.deepEqual(result.issues, ["SCHEMA_MISSING", "AUDIT_TABLE_MISSING"]);
});
