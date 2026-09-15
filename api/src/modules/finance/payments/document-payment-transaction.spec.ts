import assert from "node:assert/strict";
import test from "node:test";
import { PaymentsService } from "./payments.service";

function fixture() {
  let committed = { payments: [] as any[], movements: [] as any[], paid: 0 };
  let tail = Promise.resolve();
  const audits: unknown[] = [];
  const db = { async getClient() {
    let unlock: (() => void) | undefined;
    const client = { state: null as typeof committed | null,
      async query(sql: string) {
        if (sql === "COMMIT") committed = structuredClone(client.state!);
        if (sql === "COMMIT" || sql === "ROLLBACK") { unlock?.(); unlock = undefined; }
        return { rows: [] };
      },
      async lock() {
        if (client.state) return;
        const previous = tail;
        tail = new Promise<void>((resolve) => { unlock = resolve; });
        await previous;
        client.state = structuredClone(committed);
      }, release() {},
    };
    return client;
  } };
  const repository = {
    claimDocumentPaymentOperation: async (_client: any, data: any) => ({
      created: true,
      record: {
        tenant_id: data.tenantId,
        operation_key: data.operationKey,
        request_fingerprint: data.requestFingerprint,
        reference_type: data.referenceType,
        reference_id: data.referenceId,
        status: "PENDING",
        payment_ids: null,
      },
    }),
    completeDocumentPaymentOperation: async () => {},
    listByIds: async () => [],
    lockDocument: async (client: any) => client.lock(),
    lockPaymentCashSession: async () => {},
    findReferenceDocument: async (_tenant: string, _type: string, _id: string, client: any) => ({
      total: "35000000", balance: String(35000000 - client.state.paid), party_id: "source-party", status: "CONFIRMED", branch_id: "branch",
    }),
    fitsDocumentBalance: async (client: any, _tenant: string, _type: string, _id: string, _doc: any, amounts: number[]) =>
      amounts.reduce((sum, amount) => sum + amount, 0) <= 35000000 - client.state.paid,
    sumAllocatedForReference: async (_tenant: string, _type: string, _id: string, client: any) => client.state.paid,
    createPayment: async (client: any, data: any) => {
      const row = { id: String(client.state.payments.length + 1), tenant_id: "tenant", amount: String(data.amount), direction: data.direction };
      client.state.payments.push(row);
      return row;
    },
    createAllocations: async (client: any, paymentId: string, allocations: any[]) => allocations.map((a) => {
      client.state.paid += a.allocatedAmount;
      return { id: paymentId, payment_id: paymentId, allocated_amount: String(a.allocatedAmount) };
    }),
    syncPurchaseFinancialState: async () => {}, syncOrderFinancialState: async () => {},
  };
  const service = new PaymentsService(repository as any,
    { findById: async (id: string) => ({ id, active: id !== "invalid", tipo: "CASH", requires_reference: id === "reference" }) } as any,
    { findById: async () => ({ id: "session", status: "OPEN", branch_id: "branch" }) } as any,
    { create: async (client: any, data: any) => { client.state.movements.push(data); } } as any,
    { findUserById: async () => ({ estado: "ACTIVE" }), findBranchById: async () => ({ estado: "ACTIVE" }) } as any,
    db as any, { logEvent: (event: unknown) => audits.push(event) } as any);
  const actor = { userId: "user", tenantId: "tenant", roles: ["ADMIN"] };
  const request = (amounts: number[], type: "PURCHASE" | "SALES_ORDER" = "PURCHASE") => ({
    branchId: "branch", referenceId: "document", referenceType: type, cashSessionId: "session",
    payments: amounts.map((amount) => ({ paymentMethodId: "cash", amount })),
  });
  return { service, actor, request, state: () => committed, audits };
}

test("atomic full split and purchase OUT", async () => {
  const f = fixture();
  await f.service.createDocument(f.request([10000000, 25000000]), f.actor);
  assert.equal(f.state().paid, 35000000);
  assert.equal(f.state().payments.length, 2);
  assert.ok(f.state().movements.every((m) => m.direction === "OUT"));
});
test("partial split and order IN", async () => {
  const f = fixture();
  await f.service.createDocument(f.request([5000000, 5000000], "SALES_ORDER"), f.actor);
  assert.equal(f.state().paid, 10000000);
  assert.ok(f.state().movements.every((m) => m.direction === "IN"));
});
test("second invalid method rolls back payment, allocation, movement and audit", async () => {
  const f = fixture(); const request = f.request([10000000, 25000000]);
  request.payments[1].paymentMethodId = "invalid";
  await assert.rejects(f.service.createDocument(request, f.actor));
  assert.deepEqual(f.state(), { payments: [], movements: [], paid: 0 });
  assert.equal(f.audits.length, 0);
});
test("concurrent stale requests cannot both commit through transaction adapter", async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.service.createDocument(f.request([25000000]), f.actor),
    f.service.createDocument(f.request([20000000]), f.actor),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(f.state().paid, 25000000);
});
test("required reference, zero, excess precision and overpayment rejected", async () => {
  const f = fixture();
  for (const amount of [0, -1, 1.001, 35000001]) {
    await assert.rejects(f.service.createDocument(f.request([amount]), f.actor));
  }
  const request = f.request([10]); request.payments[0].paymentMethodId = "reference";
  await assert.rejects(f.service.createDocument(request, f.actor), /referencia/);
  assert.equal(f.state().paid, 0);
});
test("legacy single document payment still returns a payment object", async () => {
  const f = fixture(); const request = f.request([10000000]);
  const response = await f.service.create({ ...request, ...request.payments[0], direction: "OUT" }, f.actor);
  assert.ok(response.id);
  assert.equal(f.state().paid, 10000000);
});
