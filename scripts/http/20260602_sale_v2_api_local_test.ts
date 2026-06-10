// SOLO LOCAL/DEV - NO PRD.
// Prueba end-to-end por API real para flujo unificado inventory_create_sale_v2.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseService } from "../../api/src/common/db/database.service";
import { FinanceAccessRepository } from "../../api/src/modules/finance/common/repositories/finance-access.repository";
import { InventoryLotReconciliationRepository } from "../../api/src/modules/inventory/repositories/inventory-lot-reconciliation.repository";
import { InventoryLotReconciliationService } from "../../api/src/modules/inventory/services/inventory-lot-reconciliation.service";

const ids = {
  tenant: "91000000-0000-0000-0000-000000000001",
  pilotBranch: "91000000-0000-0000-0000-000000000002",
  disabledBranch: "91000000-0000-0000-0000-000000000003",
  pilotUser: "91000000-0000-0000-0000-000000000005",
  disabledUser: "91000000-0000-0000-0000-000000000006",
  pilotAuthSession: "91000000-0000-0000-0000-000000000007",
  disabledAuthSession: "91000000-0000-0000-0000-000000000008",
  customer: "91000000-0000-0000-0000-000000000013",
  disabledCustomer: "91000000-0000-0000-0000-000000000014",
  paymentMethodCash: "91000000-0000-0000-0000-000000000015",
  pilotCashSession: "91000000-0000-0000-0000-000000000018",
  disabledCashSession: "91000000-0000-0000-0000-000000000019",
  productNonLot: "91000000-0000-0000-0000-000000000101",
  productLotOne: "91000000-0000-0000-0000-000000000102",
  productLotMixed: "91000000-0000-0000-0000-000000000103",
  productDisabledNonLot: "91000000-0000-0000-0000-000000000104",
  lotOne: "91000000-0000-0000-0000-000000000201",
  lotMixed: "91000000-0000-0000-0000-000000000202",
};

type CountRow = {
  count: string | number;
};

type BalanceRow = {
  quantity_on_hand: string | number;
  quantity_available: string | number;
};

type SaleSummary = {
  id: string;
  status?: string;
  total?: number;
};

type ScenarioResult = {
  name: string;
  status: "OK";
  details: string;
};

const results: ScenarioResult[] = [];

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
};

const assertCondition = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const toNumber = (value: string | number | null | undefined) =>
  value == null ? 0 : typeof value === "number" ? value : Number(value);

const base64UrlJson = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const signJwt = (params: {
  userId: string;
  tenantId: string;
  sessionId: string;
}) => {
  const secret = process.env.JWT_SECRET ?? "changeme";
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    sub: params.userId,
    tenant_id: params.tenantId,
    session_id: params.sessionId,
    roles: ["SUPER_ADMIN"],
    iat: now,
    exp: now + 60 * 60,
  });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
};

const apiBaseUrl = () => {
  const value = process.env.API_BASE_URL ?? "http://localhost:4027/api";
  assertCondition(
    value.startsWith("http://localhost:") ||
      value.startsWith("http://127.0.0.1:") ||
      value.startsWith("http://[::1]:"),
    `SOLO LOCAL/DEV: API_BASE_URL no local: ${value}`
  );
  return value.replace(/\/$/, "");
};

const apiRequest = async (
  method: "GET" | "POST",
  urlPath: string,
  token: string,
  body?: unknown,
  expectOk = true
) => {
  const response = await fetch(`${apiBaseUrl()}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : null;

  if (expectOk && !response.ok) {
    throw new Error(
      `${method} ${urlPath} failed with ${response.status}: ${JSON.stringify(
        parsed
      )}`
    );
  }
  if (!expectOk && response.ok) {
    throw new Error(`${method} ${urlPath} should fail but returned 2xx`);
  }

  return {
    status: response.status,
    body: parsed,
  };
};

const salePayload = (params: {
  customerId: string;
  cashSessionId: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
}) => ({
  customerId: params.customerId,
  type: "CASH",
  items: params.items,
  payments: [
    {
      paymentMethodId: ids.paymentMethodCash,
      cashSessionId: params.cashSessionId,
      amount: params.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
      referenceNumber: "PHASE-4R2-LOCAL",
      notes: "SOLO LOCAL/DEV",
    },
  ],
});

const createSale = async (
  token: string,
  params: Parameters<typeof salePayload>[0]
) => {
  const response = await apiRequest(
    "POST",
    "/sales",
    token,
    salePayload(params)
  );
  const sale = response.body as SaleSummary;
  assertCondition(sale?.id, "sale id missing from API response");
  return sale.id;
};

const cancelSale = async (token: string, saleId: string) => {
  const response = await apiRequest("POST", `/sales/${saleId}/cancel`, token);
  const sale = response.body as SaleSummary;
  assertCondition(sale?.id === saleId, "cancel response sale id mismatch");
  assertCondition(
    sale.status === "CANCELLED" || sale.status === "REFUNDED",
    `cancel response status unexpected: ${sale.status}`
  );
};

const assertLocalDatabase = async (db: DatabaseService) => {
  const host = process.env.DB_HOST ?? "localhost";
  const nodeEnv = process.env.NODE_ENV ?? "development";
  assertCondition(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    `SOLO LOCAL/DEV: DB_HOST no local: ${host}`
  );
  assertCondition(
    ["development", "dev", "local", "test"].includes(nodeEnv),
    `SOLO LOCAL/DEV: NODE_ENV no permitido: ${nodeEnv}`
  );

  const server = await db.query<{
    version: string;
    db_name: string;
    addr: string;
    v1_exists: boolean;
    v2_exists: boolean;
    invoice_exists: boolean;
  }>(
    `
      SELECT
        version() AS version,
        current_database() AS db_name,
        COALESCE(inet_server_addr()::text, 'local-socket') AS addr,
        to_regprocedure('public.inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NOT NULL AS v1_exists,
        to_regprocedure('public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NOT NULL AS v2_exists,
        EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'inventory_invoice_order') AS invoice_exists
    `
  );

  const row = server.rows[0];
  assertCondition(row?.version.includes("PostgreSQL 16"), "PostgreSQL 16 required");
  assertCondition(
    row.addr === "local-socket" ||
      row.addr.startsWith("127.0.0.1") ||
      row.addr.startsWith("::1"),
    `SOLO LOCAL/DEV: servidor no local detectado: ${row.addr}`
  );
  assertCondition(row.v1_exists, "inventory_create_sale v1 missing");
  assertCondition(row.v2_exists, "inventory_create_sale_v2 missing");
  assertCondition(row.invoice_exists, "inventory_invoice_order missing");
  console.log(`OK local database ${row.db_name}; PostgreSQL 16; addr ${row.addr}`);
};

const getBalance = async (db: DatabaseService, lotId: string) => {
  const result = await db.query<BalanceRow>(
    `
      SELECT quantity_on_hand, quantity_available
      FROM inventory_lot_balances
      WHERE tenant_id = $1
        AND lot_id = $2
      LIMIT 1
    `,
    [ids.tenant, lotId]
  );
  const row = result.rows[0];
  return {
    onHand: toNumber(row?.quantity_on_hand),
    available: toNumber(row?.quantity_available),
  };
};

const countRows = async (db: DatabaseService, sql: string, params: unknown[]) => {
  const result = await db.query<CountRow>(sql, params);
  return toNumber(result.rows[0]?.count);
};

const getSaleCounts = async (db: DatabaseService) => ({
  sales: await countRows(
    db,
    "SELECT COUNT(*) AS count FROM sales WHERE tenant_id = $1",
    [ids.tenant]
  ),
  saleItems: await countRows(
    db,
    "SELECT COUNT(*) AS count FROM sale_items WHERE tenant_id = $1",
    [ids.tenant]
  ),
  stockMovements: await countRows(
    db,
    "SELECT COUNT(*) AS count FROM stock_movements WHERE tenant_id = $1",
    [ids.tenant]
  ),
  stockMovementLots: await countRows(
    db,
    "SELECT COUNT(*) AS count FROM stock_movement_lots WHERE tenant_id = $1",
    [ids.tenant]
  ),
});

const getLinkedQuantity = async (
  db: DatabaseService,
  saleId: string,
  movementType: "IN" | "OUT",
  lotId?: string
) => {
  const params: unknown[] = [ids.tenant, saleId, movementType];
  let lotFilter = "";
  if (lotId) {
    params.push(lotId);
    lotFilter = `AND sml.lot_id = $${params.length}`;
  }

  const result = await db.query<{ quantity: string | number }>(
    `
      SELECT COALESCE(SUM(sml.quantity), 0) AS quantity
      FROM stock_movement_lots AS sml
      INNER JOIN stock_movements AS sm
        ON sm.id = sml.stock_movement_id
       AND sm.tenant_id = sml.tenant_id
      WHERE sml.tenant_id = $1
        AND sm.reference_id = $2
        AND sm.type = $3
        ${lotFilter}
    `,
    params
  );

  return toNumber(result.rows[0]?.quantity);
};

const countLotLinksForSale = async (
  db: DatabaseService,
  saleId: string,
  productId?: string
) => {
  const params: unknown[] = [ids.tenant, saleId];
  let productFilter = "";
  if (productId) {
    params.push(productId);
    productFilter = `AND sml.product_id = $${params.length}`;
  }

  return countRows(
    db,
    `
      SELECT COUNT(*) AS count
      FROM stock_movement_lots AS sml
      INNER JOIN stock_movements AS sm
        ON sm.id = sml.stock_movement_id
       AND sm.tenant_id = sml.tenant_id
      WHERE sml.tenant_id = $1
        AND sm.reference_id = $2
        ${productFilter}
    `,
    params
  );
};

const assertSaleCoreRows = async (db: DatabaseService, saleId: string) => {
  const counts = await db.query<{
    sales: string | number;
    sale_items: string | number;
    stock_movements: string | number;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM sales WHERE tenant_id = $1 AND id = $2) AS sales,
        (SELECT COUNT(*) FROM sale_items WHERE tenant_id = $1 AND sale_id = $2) AS sale_items,
        (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = $1 AND reference_id = $2) AS stock_movements
    `,
    [ids.tenant, saleId]
  );
  const row = counts.rows[0];
  assertCondition(toNumber(row?.sales) === 1, `sale ${saleId} missing`);
  assertCondition(toNumber(row?.sale_items) >= 1, `sale ${saleId} has no items`);
  assertCondition(
    toNumber(row?.stock_movements) >= 1,
    `sale ${saleId} has no stock movements`
  );
};

const assertReconciliationClean = async (db: DatabaseService) => {
  const service = new InventoryLotReconciliationService(
    new InventoryLotReconciliationRepository(db),
    new FinanceAccessRepository(db)
  );
  const actor = {
    roles: ["SUPER_ADMIN"],
    userId: ids.pilotUser,
    tenantId: ids.tenant,
  };
  const summary = await service.getSummary(
    ids.tenant,
    { branchId: ids.pilotBranch },
    actor
  );
  assertCondition(summary.criticalCount === 0, "reconciliation criticalCount != 0");
  assertCondition(summary.highCount === 0, "reconciliation highCount != 0");

  const discrepancies = await service.findDiscrepancies(
    ids.tenant,
    { branchId: ids.pilotBranch },
    actor
  );
  const blocking = discrepancies.filter(
    (item) => item.severity === "CRITICAL" || item.severity === "HIGH"
  );
  assertCondition(blocking.length === 0, "reconciliation has blocking discrepancies");
  return {
    summary,
    discrepancies: discrepancies.length,
  };
};

const main = async () => {
  loadEnvFile(path.resolve("api/.env"));

  const db = new DatabaseService();
  const pool = (db as unknown as { pool?: { end: () => Promise<void> } }).pool;
  const pilotToken = signJwt({
    userId: ids.pilotUser,
    tenantId: ids.tenant,
    sessionId: ids.pilotAuthSession,
  });
  const disabledToken = signJwt({
    userId: ids.disabledUser,
    tenantId: ids.tenant,
    sessionId: ids.disabledAuthSession,
  });

  try {
    await assertLocalDatabase(db);

    const nonLotSale = await createSale(pilotToken, {
      customerId: ids.customer,
      cashSessionId: ids.pilotCashSession,
      items: [{ productId: ids.productNonLot, quantity: 2, price: 100 }],
    });
    await assertSaleCoreRows(db, nonLotSale);
    assertCondition(
      (await countLotLinksForSale(db, nonLotSale)) === 0,
      "A: non-lotted sale created stock_movement_lots"
    );
    results.push({
      name: "A venta no loteada",
      status: "OK",
      details: `sale=${nonLotSale}`,
    });
    console.log("OK A venta no loteada via API");

    const lotOneBefore = await getBalance(db, ids.lotOne);
    const lottedSale = await createSale(pilotToken, {
      customerId: ids.customer,
      cashSessionId: ids.pilotCashSession,
      items: [{ productId: ids.productLotOne, quantity: 4, price: 50 }],
    });
    await assertSaleCoreRows(db, lottedSale);
    assertCondition(
      (await getLinkedQuantity(db, lottedSale, "OUT", ids.lotOne)) === 4,
      "B: lotted sale missing OUT stock_movement_lots"
    );
    const lotOneAfterSale = await getBalance(db, ids.lotOne);
    assertCondition(
      lotOneAfterSale.onHand === lotOneBefore.onHand - 4,
      "B: lotted sale did not decrement lot balance"
    );
    results.push({
      name: "B venta loteada",
      status: "OK",
      details: `sale=${lottedSale}; lotOne ${lotOneBefore.onHand}->${lotOneAfterSale.onHand}`,
    });
    console.log("OK B venta loteada via API");

    const lotMixedBefore = await getBalance(db, ids.lotMixed);
    const mixedSale = await createSale(pilotToken, {
      customerId: ids.customer,
      cashSessionId: ids.pilotCashSession,
      items: [
        { productId: ids.productNonLot, quantity: 1, price: 100 },
        { productId: ids.productLotMixed, quantity: 2, price: 60 },
      ],
    });
    await assertSaleCoreRows(db, mixedSale);
    assertCondition(
      (await getLinkedQuantity(db, mixedSale, "OUT", ids.lotMixed)) === 2,
      "C: mixed sale missing lotted OUT stock_movement_lots"
    );
    assertCondition(
      (await countLotLinksForSale(db, mixedSale, ids.productNonLot)) === 0,
      "C: mixed sale created lot links for non-lotted product"
    );
    const lotMixedAfterSale = await getBalance(db, ids.lotMixed);
    assertCondition(
      lotMixedAfterSale.onHand === lotMixedBefore.onHand - 2,
      "C: mixed sale did not decrement mixed lot balance"
    );
    results.push({
      name: "C venta mixta",
      status: "OK",
      details: `sale=${mixedSale}; lotMixed ${lotMixedBefore.onHand}->${lotMixedAfterSale.onHand}`,
    });
    console.log("OK C venta mixta via API");

    const countsBeforeFailure = await getSaleCounts(db);
    const balanceBeforeFailure = await getBalance(db, ids.lotOne);
    await apiRequest(
      "POST",
      "/sales",
      pilotToken,
      salePayload({
        customerId: ids.customer,
        cashSessionId: ids.pilotCashSession,
        items: [{ productId: ids.productLotOne, quantity: 999, price: 50 }],
      }),
      false
    );
    const countsAfterFailure = await getSaleCounts(db);
    const balanceAfterFailure = await getBalance(db, ids.lotOne);
    assertCondition(
      JSON.stringify(countsAfterFailure) === JSON.stringify(countsBeforeFailure),
      "D: failed sale left partial rows"
    );
    assertCondition(
      balanceAfterFailure.onHand === balanceBeforeFailure.onHand,
      "D: failed sale mutated lot balance"
    );
    results.push({
      name: "D stock insuficiente",
      status: "OK",
      details: "rollback total validado",
    });
    console.log("OK D stock insuficiente falla sin mutar");

    await cancelSale(pilotToken, lottedSale);
    const lotOneAfterCancel = await getBalance(db, ids.lotOne);
    assertCondition(
      lotOneAfterCancel.onHand === lotOneBefore.onHand,
      "E: lotted cancellation did not restore original lot"
    );
    assertCondition(
      (await getLinkedQuantity(db, lottedSale, "IN", ids.lotOne)) === 4,
      "E: lotted cancellation missing IN stock_movement_lots"
    );
    const lotLinksBeforeSecondCancel = await countLotLinksForSale(db, lottedSale);
    await cancelSale(pilotToken, lottedSale);
    assertCondition(
      (await countLotLinksForSale(db, lottedSale)) === lotLinksBeforeSecondCancel,
      "E: second cancellation duplicated lot links"
    );
    results.push({
      name: "E cancelacion loteada",
      status: "OK",
      details: `sale=${lottedSale}; lotOne restored ${lotOneAfterCancel.onHand}`,
    });
    console.log("OK E cancelacion loteada via API");

    await cancelSale(pilotToken, mixedSale);
    const lotMixedAfterCancel = await getBalance(db, ids.lotMixed);
    assertCondition(
      lotMixedAfterCancel.onHand === lotMixedBefore.onHand,
      "F: mixed cancellation did not restore original lot"
    );
    assertCondition(
      (await getLinkedQuantity(db, mixedSale, "IN", ids.lotMixed)) === 2,
      "F: mixed cancellation missing lotted IN stock_movement_lots"
    );
    results.push({
      name: "F cancelacion mixta",
      status: "OK",
      details: `sale=${mixedSale}; lotMixed restored ${lotMixedAfterCancel.onHand}`,
    });
    console.log("OK F cancelacion mixta via API");

    const branchControlSale = await createSale(disabledToken, {
      customerId: ids.disabledCustomer,
      cashSessionId: ids.disabledCashSession,
      items: [{ productId: ids.productDisabledNonLot, quantity: 1, price: 40 }],
    });
    await assertSaleCoreRows(db, branchControlSale);
    assertCondition(
      (await countLotLinksForSale(db, branchControlSale)) === 0,
      "G: non-lotted branch control sale created stock_movement_lots"
    );
    results.push({
      name: "G sucursal control no loteada",
      status: "OK",
      details: `sale=${branchControlSale}; no stock_movement_lots`,
    });
    console.log("OK G sucursal control vende no loteado con flujo unificado");

    const reconciliation = await assertReconciliationClean(db);
    results.push({
      name: "H reconciliacion piloto",
      status: "OK",
      details: `critical=0 high=0 discrepancies=${reconciliation.discrepancies}`,
    });
    console.log("OK H reconciliacion piloto sin CRITICAL/HIGH");

    console.log("RESULTS_JSON_START");
    console.log(JSON.stringify(results, null, 2));
    console.log("RESULTS_JSON_END");
  } finally {
    await pool?.end();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
