import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { config } from "dotenv";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PaymentsService } from "./payments.service";
import { PaymentsRepository } from "./payments.repository";
import { CreateDocumentPaymentDto } from "./dto/create-document-payment.dto";

const tenant = randomUUID();
const source = randomUUID();
const branch = randomUUID();
const session = randomUUID();
const user = randomUUID();
const party = randomUUID();
const cash = randomUUID();
const transfer = randomUUID();
const actor = { tenantId: tenant, userId: user, roles: ["ADMIN"] };
const payload = (amounts: number[], type: "PURCHASE" | "SALES_ORDER" = "PURCHASE") => ({
  branchId: branch, referenceType: type, referenceId: source, cashSessionId: session,
  payments: amounts.map((amount, index) => ({ paymentMethodId: index ? transfer : cash, amount })),
});

test("document DTO rejects replacement party/direction/balance and accepts decimals", async () => {
  const valid = plainToInstance(CreateDocumentPaymentDto, payload([0.29, 0.01]));
  assert.equal((await validate(valid, { whitelist: true, forbidNonWhitelisted: true })).length, 0);
  for (const forbidden of ["customerId", "supplierId", "partyId", "paidByPersonId", "direction", "pendingBalance"]) {
    const dto = plainToInstance(CreateDocumentPaymentDto, { ...payload([10]), [forbidden]: party });
    assert.ok((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length > 0);
  }
  for (const amounts of [[], [0], [-1], [0.001]]) {
    assert.ok((await validate(plainToInstance(CreateDocumentPaymentDto, payload(amounts)))).length > 0);
  }
});

// Opt-in real PostgreSQL test. Uses an isolated random schema, never application tables.
test("document payment transactions on PostgreSQL", { skip: process.env.PAYMENT_TEST_POSTGRES !== "1" }, async (t) => {
  config({ path: process.env.PAYMENT_TEST_ENV ?? ".env", quiet: true });
  const host = process.env.DB_HOST ?? "localhost";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host), "Tests only allow local PostgreSQL");
  const schema = `payment_test_${randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({ host, port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_DATABASE, user: process.env.DB_USERNAME ?? "postgres",
    password: process.env.DB_PASSWORD, connectionTimeoutMillis: 3000 });
  const admin = await pool.connect();
  const audits: unknown[] = [];
  let failMovement = false;
  let invalidTransfer = false;
  const db = {
    async getClient() {
      const client = await pool.connect();
      await client.query(`SET search_path TO "${schema}"`);
      return client;
    },
  };
  const repository = new PaymentsRepository(db as any);
  // Access/catalog are controlled; transaction, locks, balance SQL, allocations and
  // purchase state reconciliation use PostgreSQL and production repository methods.
  repository.findReferenceDocument = async (_tenant, type, _id, client) => {
    assert.ok(client);
    const result = await client.query(`SELECT id, tenant_id, '${branch}'::uuid AS branch_id,
      status, total::text, balance_due::text AS balance, '${party}'::uuid AS party_id
      FROM ${type === "SALES_ORDER" ? "orders" : "purchases"} WHERE id = $1`, [source]);
    return result.rows[0];
  };
  repository.createPayment = async (client, data) => {
    const id = randomUUID();
    const result = await client.query(`INSERT INTO payments (id, tenant_id, reference_type, reference_id,
      direction, status, amount) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, data.tenantId, data.referenceType, data.referenceId, data.direction, data.status, data.amount]);
    return { ...result.rows[0], branch_id: data.branchId, payment_method_id: data.paymentMethodId,
      cash_session_id: data.cashSessionId, reference_number: data.referenceNumber, notes: data.notes };
  };
  repository.syncOrderFinancialState = async (client, id) => {
    await client.query(`UPDATE orders SET total_paid = x.paid, balance_due = total - x.paid,
      payment_status = CASE WHEN x.paid = total THEN 'PAID' ELSE 'PARTIAL' END
      FROM (SELECT COALESCE(SUM(allocated_amount),0) AS paid FROM payment_allocations WHERE reference_id=$1) x
      WHERE id=$1`, [id]);
  };
  const service = new PaymentsService(repository, {
    findById: async (id: string) => ({ id, active: !(invalidTransfer && id === transfer),
      tipo: id === cash ? "CASH" : "TRANSFER", requires_reference: false }),
  } as any, {
    findById: async () => ({ id: session, tenant_id: tenant, branch_id: branch, status: "OPEN", opened_by_user_id: user }),
  } as any, {
    create: async (client: any, movement: any) => {
      if (failMovement && movement.amount === 25000000) throw new Error("controlled movement failure");
      await client.query("INSERT INTO cash_movements VALUES ($1,$2,$3)", [movement.paymentId, movement.direction, movement.amount]);
    },
  } as any, {
    findUserById: async () => ({ estado: "ACTIVE" }),
    findBranchById: async () => ({ estado: "ACTIVE" }),
  } as any, db as any, { logEvent: (event: unknown) => audits.push(event) } as any);

  const reset = async () => {
    invalidTransfer = false; failMovement = false; audits.length = 0;
    await admin.query("TRUNCATE payments, payment_allocations, cash_movements, purchases, orders, cash_sessions");
    for (const table of ["purchases", "orders"]) await admin.query(`INSERT INTO ${table}
      VALUES ($1,$2,'CONFIRMED',35000000,0,35000000,35000000,'PENDING')`, [source, tenant]);
    await admin.query("INSERT INTO cash_sessions VALUES ($1,$2)", [session, tenant]);
  };
  const state = async (table = "purchases") => (await admin.query(`SELECT total_paid::text, balance_due::text, payment_status FROM ${table}`)).rows[0];
  const count = async (table: string) => Number((await admin.query(`SELECT COUNT(*) FROM ${table}`)).rows[0].count);
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(`CREATE TABLE purchases (id uuid PRIMARY KEY, tenant_id uuid, status text,
      total numeric(14,2), total_paid numeric(14,2), balance_due numeric(14,2), balance numeric(14,2), payment_status text);
      CREATE TABLE orders (LIKE purchases INCLUDING ALL);
      CREATE TABLE payments (id uuid PRIMARY KEY, tenant_id uuid, reference_type text, reference_id uuid, direction text, status text, amount numeric(14,2));
      CREATE TABLE payment_allocations (id uuid DEFAULT gen_random_uuid(), payment_id uuid, reference_type text, reference_id uuid, allocated_amount numeric(14,2), created_at timestamptz DEFAULT now());
      CREATE TABLE cash_movements (payment_id uuid, direction text, amount numeric(14,2));
      CREATE TABLE cash_sessions (id uuid PRIMARY KEY, tenant_id uuid);`);

    await t.test("single legacy payment remains compatible", async () => {
      await reset();
      const request = payload([10000000]);
      const result = await service.create({ ...request, ...request.payments[0], direction: "OUT" }, actor);
      assert.ok(result.id);
      assert.equal((await state()).balance_due, "25000000.00");
    });
    for (const [name, amounts, expected] of [
      ["full split", [10000000, 25000000], "0.00"],
      ["partial split", [5000000, 5000000], "25000000.00"],
      ["decimal split", [0.29, 0.01], "34999999.70"],
    ] as const) await t.test(`${name} commits all lines and OUT movements`, async () => {
      await reset();
      assert.equal((await service.createDocument(payload([...amounts]), actor)).length, 2);
      assert.equal(await count("payments"), 2);
      assert.equal(await count("cash_movements"), 2);
      assert.equal((await state()).balance_due, expected);
      assert.equal((await state()).payment_status, expected === "0.00" ? "PAID" : "PARTIAL");
      assert.deepEqual((await admin.query("SELECT DISTINCT direction FROM cash_movements")).rows, [{ direction: "OUT" }]);
      assert.equal(audits.length, 2);
    });
    for (const failure of ["method", "movement"]) await t.test(`second ${failure} failure rolls back EVERY write`, async () => {
      await reset(); invalidTransfer = failure === "method"; failMovement = failure === "movement";
      await assert.rejects(service.createDocument(payload([10000000, 25000000]), actor));
      assert.equal(await count("payments"), 0);
      assert.equal(await count("payment_allocations"), 0);
      assert.equal(await count("cash_movements"), 0);
      assert.deepEqual(await state(), { total_paid: "0.00", balance_due: "35000000.00", payment_status: "PENDING" });
      assert.equal(audits.length, 0);
    });
    await t.test("order partial collection uses IN", async () => {
      await reset();
      await service.createDocument(payload([5000000, 5000000], "SALES_ORDER"), actor);
      assert.equal((await state("orders")).balance_due, "25000000.00");
      assert.deepEqual((await admin.query("SELECT DISTINCT direction FROM cash_movements")).rows, [{ direction: "IN" }]);
    });
    await t.test("stale/overpayment rejected after prior payment", async () => {
      await reset();
      await service.createDocument(payload([25000000]), actor);
      await assert.rejects(service.createDocument(payload([20000000]), actor), /saldo actual/);
      assert.equal((await state()).total_paid, "25000000.00");
    });
    await t.test("concurrent 25M and 20M serialize on real PostgreSQL row lock", async () => {
      await reset();
      const results = await Promise.allSettled([
        service.createDocument(payload([25000000]), actor),
        service.createDocument(payload([20000000]), actor),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await count("payments"), 1);
      assert.ok(Number((await state()).total_paid) <= 35000000);
    });
    await t.test("legacy and batch share row locking", async () => {
      await reset();
      const request = payload([20000000]);
      const results = await Promise.allSettled([
        service.createDocument(payload([25000000]), actor),
        service.create({ ...request, ...request.payments[0], direction: "OUT" }, actor),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(await count("payments"), 1);
    });
    await t.test("full duplicate rejected; partial identical replay is NOT idempotent", async () => {
      await reset();
      await service.createDocument(payload([35000000]), actor);
      await assert.rejects(service.createDocument(payload([35000000]), actor));
      await reset();
      await service.createDocument(payload([5000000]), actor);
      await service.createDocument(payload([5000000]), actor);
      assert.equal((await state()).total_paid, "10000000.00", "Known durable idempotency limitation");
    });
  } finally {
    // Generated identifier only; exclusively the schema created by this test.
    assert.match(schema, /^payment_test_[a-f0-9]{32}$/);
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    admin.release();
    await pool.end();
  }
});
