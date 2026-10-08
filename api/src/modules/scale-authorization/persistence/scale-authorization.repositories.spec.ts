import assert from "node:assert/strict";
import test from "node:test";
import { verifierFor } from "../domain/agent-credential.domain";
import { AgentCredentialPersistence, ScaleBindingPersistence, WeightCapturePersistence } from "./scale-authorization.repositories";

const fakeDb = {} as never;

test("credential persistence stores only a verifier and applies tenant/device scoping", async () => {
  let captured: { sql: string; values: unknown[] } | undefined;
  const client = { query: async (sql: string, values: unknown[]) => {
    captured = { sql, values };
    return { rows: [{ id: "cred", verifier_version: "sha256-v1", status: "ACTIVE" }], rowCount: 1 };
  } } as never;
  const secret = "ephemeral-agent-secret-not-persisted";
  await new AgentCredentialPersistence(fakeDb).issue(client, {
    tenantId: "tenant", terminalDeviceId: "device", credentialId: "public-id",
    secret, expiresAt: new Date("2030-01-01T00:00:00Z"), actorId: "operator",
  });
  assert.ok(captured);
  assert.match(captured.sql, /verifier_sha256/);
  assert.equal(captured.values[3], verifierFor(secret));
  assert.equal(captured.values.includes(secret), false);
  assert.match(captured.sql, /d\.tenant_id = \$1 AND d\.id = \$2/);
});

test("credential issue fails closed when the scoped device is absent or revoked", async () => {
  const client = { query: async () => ({ rows: [], rowCount: 0 }) } as never;
  const inserted = await new AgentCredentialPersistence(fakeDb).issue(client, {
    tenantId: "tenant", terminalDeviceId: "device", credentialId: "public-id",
    secret: "ephemeral-secret", expiresAt: new Date("2030-01-01T00:00:00Z"), actorId: "operator",
  });
  assert.equal(inserted, null);
});

test("credential rotation retires the old verifier before issuing its replacement", async () => {
  const statements: string[] = [];
  const client = { query: async (sql: string, values: unknown[]) => {
    statements.push(sql);
    if (sql.includes("UPDATE terminal_device_credentials") && sql.includes("ROTATED")) {
      return { rows: [{ id: "old" }], rowCount: 1 };
    }
    if (sql.includes("UPDATE terminal_device_credentials") && sql.includes("EXPIRED")) {
      return { rows: [], rowCount: 0 };
    }
    assert.equal(values.includes("replacement-secret"), false);
    return { rows: [{ id: "new", verifier_version: "sha256-v1", status: "ACTIVE" }], rowCount: 1 };
  } } as never;
  const result = await new AgentCredentialPersistence(fakeDb).rotate(client, {
    tenantId: "tenant", terminalDeviceId: "device", credentialId: "old-public-id",
    nextCredentialId: "new-public-id", nextSecret: "replacement-secret",
    expiresAt: new Date("2030-01-01T00:00:00Z"), actorId: "operator",
  });
  assert.equal(result?.status, "ACTIVE");
  assert.match(statements[0], /status = 'ROTATED', rotated_at = now\(\), rotated_by = \$4/);
  assert.match(statements[2], /verifier_sha256/);
});

test("credential revocation is tenant-scoped and records actor/time", async () => {
  let statement = "";
  const client = { query: async (sql: string) => {
    statement = sql;
    return { rows: [{ id: "credential", status: "REVOKED" }], rowCount: 1 };
  } } as never;
  await new AgentCredentialPersistence(fakeDb).revoke(client, "tenant-a", "credential", "operator");
  assert.match(statement, /SET status = 'REVOKED', revoked_at = now\(\), revoked_by = \$3/);
  assert.match(statement, /tenant_id = \$1 AND credential_id = \$2/);
});

test("binding authorization persists explicit operator KG evidence under exact context", async () => {
  const context = { tenantId: "t", branchId: "b", posTerminalId: "p", operationalTerminalId: "o", terminalDeviceId: "d", logicalScaleId: "serial-rochi-a01e-0123456789abcdef" };
  let calls = 0;
  let updateSql = "";
  const client = { query: async (sql: string) => {
    calls += 1;
    if (calls === 1) return { rows: [{ id: "binding", ...{
      tenant_id: "t", branch_id: "b", pos_terminal_id: "p", operational_terminal_id: "o",
      terminal_device_id: "d", logical_scale_id: context.logicalScaleId,
      status: "PENDING", unit_state: "NOT_VERIFIED", unit_verification_method: null,
      unit_verification_unit: null, unit_verified_by_user_id: null, verified_at: null,
    } }], rowCount: 1 };
    updateSql = sql;
    return { rows: [{ id: "binding", status: "AUTHORIZED", unit_state: "KG_VERIFIED" }], rowCount: 1 };
  } } as never;
  const result = await new ScaleBindingPersistence(fakeDb).authorize(client, {
    tenantId: "t", bindingId: "binding", expectedContext: context,
    confirmation: { method: "OPERATOR_CONFIRMATION", displayedUnit: "kg", operatorId: "operator", confirmedAt: "2026-01-01T00:00:00Z" },
  });
  assert.equal(result.status, "AUTHORIZED");
  assert.match(updateSql, /unit_verification_method = 'OPERATOR_CONFIRMATION'/);
  assert.match(updateSql, /logical_scale_id = \$9/);
  assert.match(updateSql, /status = 'PENDING' AND unit_state = 'NOT_VERIFIED'/);
});

test("capture consumption is one conditional UPDATE returning persisted weight", async () => {
  let captured: { sql: string; values: unknown[] } | undefined;
  let calls = 0;
  const client = { query: async (sql: string, values: unknown[]) => {
    calls += 1;
    if (calls === 1) return { rows: [{ id: "binding" }], rowCount: 1 };
    if (calls === 2) return { rows: [{
      capture_id: "capture", tenant_id: "t", branch_id: "b", pos_terminal_id: "p",
      operational_terminal_id: "o", pos_session_id: "s", product_id: "product",
      terminal_device_id: "device", logical_scale_id: "scale", terminal_scale_binding_id: "binding",
      nonce_verifier_sha256: verifierFor("raw-one-time-nonce"), status: "READY",
      expires_at: new Date(Date.now() + 60_000), weight_kg: "0.245", measurement_source: "REAL",
      measurement_unit: "kg", unit_verified: true, observed_at: new Date(),
    }], rowCount: 1 };
    captured = { sql, values };
    return { rows: [{ capture_id: "capture", weight_kg: "0.245", status: "CONSUMED", expires_at: new Date() }], rowCount: 1 };
  } } as never;
  const expected = {
    tenantId: "t", branchId: "b", posTerminalId: "p", operationalTerminalId: "o",
    posSessionId: "s", productId: "product", logicalScaleId: "scale", bindingId: "binding", terminalDeviceId: "device",
  };
  const consumed = await new WeightCapturePersistence(fakeDb).consume(client, {
    captureId: "capture", nonce: "raw-one-time-nonce", expected, saleId: "sale", consumerUserId: "operator",
  });
  assert.equal(consumed.weightKg, 0.245);
  assert.ok(captured);
  assert.match(captured.sql, /^\s*UPDATE terminal_scale_weight_captures/);
  assert.match(captured.sql, /status = 'READY' AND c\.expires_at >/);
  assert.match(captured.sql, /nonce_verifier_sha256 = \$2/);
  assert.match(captured.sql, /measurement_source = 'REAL'.*measurement_unit = 'kg'/s);
  assert.match(captured.sql, /RETURNING c\.capture_id, c\.weight_kg/);
  assert.equal(calls, 3);
  assert.equal(captured.values.includes("raw-one-time-nonce"), false);
  assert.equal(captured.values[1], verifierFor("raw-one-time-nonce"));
});

test("MOCK or unverified observations never reach persistence", async () => {
  let calls = 0;
  const client = { query: async () => { calls += 1; return { rows: [], rowCount: 0 }; } } as never;
  const captures = new WeightCapturePersistence(fakeDb);
  await assert.rejects(() => captures.markReady(client, {
    captureId: "capture", observation: { source: "MOCK", value: 1, unit: "kg", unitVerified: true, observedAt: new Date().toISOString() },
  }), /CAPTURE_OBSERVATION_NOT_COMMERCIAL/);
  await assert.rejects(() => captures.markReady(client, {
    captureId: "capture", observation: { source: "REAL", value: 1, unit: "kg", unitVerified: false, observedAt: new Date().toISOString() },
  }), /CAPTURE_OBSERVATION_NOT_COMMERCIAL/);
  assert.equal(calls, 0);
});
