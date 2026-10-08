import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { ForbiddenException } from "@nestjs/common";
import { issueOpaqueAgentCredential } from "./domain/agent-credential.domain";
import { ScaleAuthorizationRuntimeService } from "./scale-authorization.runtime.service";

const makeService = (state: { credentialId: string; verifier: string; expiresAt: Date; revokedAt: Date | null; deviceActive: boolean }) => {
  const client = {
    query: async (sql: string) => {
      if (sql.includes("FROM terminal_device_credentials c JOIN terminal_devices")) {
        return { rows: state.deviceActive && state.expiresAt > new Date() ? [{
          id: "credential-row", tenant_id: "tenant-1", terminal_device_id: "device-1",
          verifier_sha256: state.verifier, expires_at: state.expiresAt, revoked_at: state.revokedAt,
        }] : [], rowCount: state.deviceActive && state.expiresAt > new Date() ? 1 : 0 };
      }
      throw new Error("UNEXPECTED_QUERY");
    },
    release: () => undefined,
  };
  const database = { getClient: async () => client } as never;
  return new ScaleAuthorizationRuntimeService(database, {} as never, {} as never);
};

test("Agent authentication verifies the opaque credential and returns only its scoped identity internally", async () => {
  const issued = issueOpaqueAgentCredential();
  const credentialId = randomUUID();
  const service = makeService({ credentialId, verifier: issued.verifierSha256,
    expiresAt: new Date(Date.now() + 60_000), revokedAt: null, deviceActive: true });
  const authenticated = await service.authenticateAgent(`Agent ${credentialId}.${issued.secret}`);
  assert.deepEqual(authenticated, { tenantId: "tenant-1", terminalDeviceId: "device-1",
    credentialId, credentialSecret: issued.secret });
  await assert.rejects(service.authenticateAgent(`Agent ${credentialId}.${"x".repeat(43)}`), ForbiddenException);
});

test("Agent authentication fails closed for expired, revoked or revoked-device credentials", async () => {
  const issued = issueOpaqueAgentCredential();
  const credentialId = randomUUID();
  const request = `Agent ${credentialId}.${issued.secret}`;
  for (const overrides of [
    { expiresAt: new Date(Date.now() - 1_000) },
    { revokedAt: new Date() },
    { deviceActive: false },
  ]) {
    const service = makeService({ credentialId, verifier: issued.verifierSha256,
      expiresAt: new Date(Date.now() + 60_000), revokedAt: null, deviceActive: true, ...overrides });
    await assert.rejects(service.authenticateAgent(request), ForbiddenException);
  }
});

test("operator KG confirmation returns backend-persisted evidence for the Agent mirror", async () => {
  const statements: string[] = [];
  const client = {
    query: async (sql: string) => {
      statements.push(sql.trim().split(/\s+/).slice(0, 2).join(" "));
      if (sql.includes("FROM terminal_scale_bindings b")) return { rows: [{
        tenantId: "tenant-1", branchId: "branch-1", posTerminalId: "pos-1",
        operationalTerminalId: "terminal-1", terminalDeviceId: "device-1", logicalScaleId: "rochi-1",
      }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  const database = { getClient: async () => client } as never;
  const bindings = { authorize: async (_client: unknown, input: {
    expectedContext: { branchId: string; posTerminalId: string; operationalTerminalId: string; terminalDeviceId: string; logicalScaleId: string };
    confirmation: { method: string; displayedUnit: string; operatorId: string; confirmedAt: string };
  }) => {
    assert.deepEqual(input.expectedContext, { tenantId: "tenant-1", branchId: "branch-1", posTerminalId: "pos-1",
      operationalTerminalId: "terminal-1", terminalDeviceId: "device-1", logicalScaleId: "rochi-1" });
    assert.deepEqual(input.confirmation, { method: "OPERATOR_CONFIRMATION", displayedUnit: "kg",
      operatorId: "operator-1", confirmedAt: input.confirmation.confirmedAt });
    return { id: "binding-1", status: "AUTHORIZED", unit_state: "KG_VERIFIED" };
  } } as never;
  const service = new ScaleAuthorizationRuntimeService(database, {} as never, bindings);
  const result = await service.confirmKg("tenant-1", "operator-1", "binding-1");
  assert.equal(result.status, "AUTHORIZED");
  assert.equal(result.unit_state, "KG_VERIFIED");
  assert.equal(result.unitVerification.method, "OPERATOR_CONFIRMATION");
  assert.equal(result.unitVerification.unit, "kg");
  assert.equal(result.unitVerification.operatorId, "operator-1");
  assert.equal(Number.isFinite(Date.parse(result.unitVerification.verifiedAt)), true);
  assert.deepEqual(statements, ["BEGIN", "SELECT b.tenant_id", "COMMIT"]);
});
