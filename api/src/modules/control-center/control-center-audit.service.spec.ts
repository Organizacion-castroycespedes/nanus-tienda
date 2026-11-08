import assert from "node:assert/strict";
import test from "node:test";
import {
  ControlCenterAuditService,
  buildControlCenterRequestContext,
} from "./control-center-audit.service";

const baseEvent = {
  actorUserId: "user-1",
  actorTenantId: "tenant-platform",
  action: "ACCOUNT_CREATED",
  entityType: "commercial_account",
  entityId: "acc-1",
};

const buildTx = () => {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  return {
    calls,
    tx: {
      query: async (text: string, params?: unknown[]) => {
        calls.push({ text, params });
        return { rows: [{ id: "audit-1" }] };
      },
    },
  };
};

test("audit: inserts event in the provided transaction with JSON snapshots", async () => {
  const { tx, calls } = buildTx();
  const service = new ControlCenterAuditService(new Set());
  const id = await service.record(tx, { ...baseEvent, before: null, after: { name: "Acme" } });
  assert.equal(id, "audit-1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO control_center\.admin_audit_events/);
  assert.equal(calls[0].params?.[5], null);
  assert.equal(calls[0].params?.[6], JSON.stringify({ name: "Acme" }));
});

test("audit: critical action without reason is rejected before writing", async () => {
  const { tx, calls } = buildTx();
  const service = new ControlCenterAuditService(new Set(["CONTRACT_ACTIVATED"]));
  await assert.rejects(
    () => service.record(tx, { ...baseEvent, action: "CONTRACT_ACTIVATED", reason: "corto" }),
    (error: any) => error.getResponse?.().code === "CONTROL_CENTER_REASON_REQUIRED",
  );
  assert.equal(calls.length, 0);
});

test("audit: critical action with valid reason is stored trimmed", async () => {
  const { tx, calls } = buildTx();
  const service = new ControlCenterAuditService(new Set(["CONTRACT_ACTIVATED"]));
  await service.record(tx, {
    ...baseEvent,
    action: "CONTRACT_ACTIVATED",
    reason: "  Firma del contrato recibida  ",
  });
  assert.equal(calls[0].params?.[7], "Firma del contrato recibida");
});

test("audit: incomplete event is rejected", async () => {
  const { tx } = buildTx();
  const service = new ControlCenterAuditService(new Set());
  await assert.rejects(() => service.record(tx, { ...baseEvent, actorTenantId: "" }), /incompleto/);
  await assert.rejects(() => service.record(tx, { ...baseEvent, action: "  " }), /incompleto/);
});

test("audit: request context extracts actor, request id, ip and user agent", () => {
  const context = buildControlCenterRequestContext({
    user: { id: "user-1", tenantId: "tenant-platform" },
    headers: { "x-request-id": "req-9", "user-agent": "Mozilla/5.0" },
    ip: "10.0.0.5",
  });
  assert.deepEqual(context, {
    actorUserId: "user-1",
    actorTenantId: "tenant-platform",
    requestId: "req-9",
    ip: "10.0.0.5",
    userAgent: "Mozilla/5.0",
  });
});
