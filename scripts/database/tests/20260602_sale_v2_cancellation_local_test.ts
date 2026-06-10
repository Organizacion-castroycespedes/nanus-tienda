// SOLO LOCAL/DEV - NO PRD.
// Prueba controlada de cancelacion loteada con inventory_create_sale_v2 + SaleService.cancelSale.

import fs from "node:fs";
import path from "node:path";
import { DatabaseService } from "../../../api/src/common/db/database.service";
import { AuditService } from "../../../api/src/common/services/audit.service";
import { FinanceAccessRepository } from "../../../api/src/modules/finance/common/repositories/finance-access.repository";
import { PaymentsRepository } from "../../../api/src/modules/finance/payments/payments.repository";
import { SaleRepository } from "../../../api/src/modules/inventory/repositories/sale.repository";
import { SaleService } from "../../../api/src/modules/inventory/services/sale.service";
import { StockMovementService } from "../../../api/src/modules/inventory/services/stock-movement.service";

const ids = {
  tenant: "90000000-0000-0000-0000-000000000001",
  branch: "90000000-0000-0000-0000-000000000002",
  user: "90000000-0000-0000-0000-000000000004",
  terminal: "90000000-0000-0000-0000-000000000006",
  posSession: "90000000-0000-0000-0000-000000000007",
  customer: "90000000-0000-0000-0000-000000000008",
  productNonLot: "90000000-0000-0000-0000-000000000101",
  productLotOne: "90000000-0000-0000-0000-000000000102",
  productLotMixed: "90000000-0000-0000-0000-000000000104",
  lotOne: "90000000-0000-0000-0000-000000000201",
  lotMixed: "90000000-0000-0000-0000-000000000204",
};

type SaleItem = {
  product_id: string;
  quantity: number;
  price: number;
  order_item_id: string | null;
};

type CountRow = {
  count: string | number;
};

type BalanceRow = {
  quantity_on_hand: string | number;
};

type StatusRow = {
  status: string;
};

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
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

const createSale = async (
  db: DatabaseService,
  reference: string,
  items: SaleItem[]
) => {
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );
  const result = await db.query<{ id: string }>(
    `
      SELECT sale_result.id::text AS id
      FROM public.inventory_create_sale_v2(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::uuid,
        $6::uuid,
        NULL::uuid,
        'CASH',
        $7::jsonb,
        $8::jsonb
      ) AS sale_result
    `,
    [
      ids.tenant,
      ids.branch,
      ids.terminal,
      ids.user,
      ids.posSession,
      ids.customer,
      JSON.stringify(items),
      JSON.stringify([
        {
          payment_method: "CASH",
          amount: total,
          reference,
        },
      ]),
    ]
  );

  const saleId = result.rows[0]?.id;
  assertCondition(saleId, `${reference}: sale id missing`);
  return saleId;
};

const getBalance = async (db: DatabaseService, lotId: string) => {
  const result = await db.query<BalanceRow>(
    `
      SELECT quantity_on_hand
      FROM inventory_lot_balances
      WHERE tenant_id = $1
        AND lot_id = $2
      LIMIT 1
    `,
    [ids.tenant, lotId]
  );

  return toNumber(result.rows[0]?.quantity_on_hand);
};

const getSaleStatus = async (db: DatabaseService, saleId: string) => {
  const result = await db.query<StatusRow>(
    `
      SELECT status
      FROM sales
      WHERE tenant_id = $1
        AND id = $2
      LIMIT 1
    `,
    [ids.tenant, saleId]
  );

  return result.rows[0]?.status;
};

const getLinkedQuantity = async (
  db: DatabaseService,
  saleId: string,
  movementType: "IN" | "OUT",
  lotId?: string
) => {
  const params: unknown[] = [ids.tenant, saleId, movementType];
  const lotFilter = lotId ? "AND sml.lot_id = $4" : "";
  if (lotId) {
    params.push(lotId);
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

const countLotLinks = async (db: DatabaseService, saleId: string) => {
  const result = await db.query<CountRow>(
    `
      SELECT COUNT(*) AS count
      FROM stock_movement_lots AS sml
      INNER JOIN stock_movements AS sm
        ON sm.id = sml.stock_movement_id
       AND sm.tenant_id = sml.tenant_id
      WHERE sml.tenant_id = $1
        AND sm.reference_id = $2
    `,
    [ids.tenant, saleId]
  );

  return toNumber(result.rows[0]?.count);
};

const cancelSale = async (saleService: SaleService, saleId: string) => {
  await saleService.cancelSale(saleId, {
    tenantId: ids.tenant,
    userId: ids.user,
    roles: ["SUPER_ADMIN"],
  });
};

const assertCancelled = async (db: DatabaseService, saleId: string) => {
  const status = await getSaleStatus(db, saleId);
  assertCondition(
    status === "CANCELLED" || status === "REFUNDED",
    `sale ${saleId} was not cancelled`
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

  const server = await db.query<{ addr: string; db_name: string }>(
    `
      SELECT
        COALESCE(inet_server_addr()::text, 'local-socket') AS addr,
        current_database() AS db_name
    `
  );
  const addr = server.rows[0]?.addr ?? "";
  assertCondition(
    addr === "local-socket" ||
      addr.startsWith("127.0.0.1") ||
      addr.startsWith("::1"),
    `SOLO LOCAL/DEV: servidor no local detectado: ${addr}`
  );

  const functions = await db.query<{
    v1_exists: boolean;
    v2_exists: boolean;
    invoice_exists: boolean;
  }>(
    `
      SELECT
        to_regprocedure('public.inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NOT NULL AS v1_exists,
        to_regprocedure('public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NOT NULL AS v2_exists,
        EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'inventory_invoice_order') AS invoice_exists
    `
  );
  assertCondition(functions.rows[0]?.v1_exists, "inventory_create_sale v1 missing");
  assertCondition(functions.rows[0]?.v2_exists, "inventory_create_sale_v2 missing");
  assertCondition(
    functions.rows[0]?.invoice_exists,
    "inventory_invoice_order missing"
  );

  console.log(
    `OK local database ${server.rows[0]?.db_name} at ${addr}; NODE_ENV=${nodeEnv}`
  );
};

const main = async () => {
  loadEnvFile(path.resolve("api/.env"));

  const db = new DatabaseService();
  const auditService = { logEvent: () => undefined } as unknown as AuditService;
  const saleRepository = new SaleRepository(db);
  const stockMovementService = new StockMovementService(db, auditService);
  const financeAccessRepository = new FinanceAccessRepository(db);
  const paymentsRepository = new PaymentsRepository(db);
  const saleService = new SaleService(
    db,
    saleRepository,
    auditService,
    stockMovementService,
    financeAccessRepository,
    paymentsRepository,
    {} as never
  );

  const successfulSales: string[] = [];

  try {
    await assertLocalDatabase(db);

    const nonLotSale = await createSale(db, "PHASE-3-15-A", [
      {
        product_id: ids.productNonLot,
        quantity: 1,
        price: 100,
        order_item_id: null,
      },
    ]);
    await cancelSale(saleService, nonLotSale);
    await assertCancelled(db, nonLotSale);
    assertCondition(
      (await countLotLinks(db, nonLotSale)) === 0,
      "A: non-lotted sale created lot links"
    );
    successfulSales.push(nonLotSale);
    console.log("OK A non-lotted cancellation unchanged");

    const balanceBeforeLot = await getBalance(db, ids.lotOne);
    const lottedSale = await createSale(db, "PHASE-3-15-B", [
      {
        product_id: ids.productLotOne,
        quantity: 4,
        price: 50,
        order_item_id: null,
      },
    ]);
    assertCondition(
      (await getBalance(db, ids.lotOne)) === balanceBeforeLot - 4,
      "B: lotted sale did not decrement balance before cancellation"
    );
    await cancelSale(saleService, lottedSale);
    await assertCancelled(db, lottedSale);
    assertCondition(
      (await getBalance(db, ids.lotOne)) === balanceBeforeLot,
      "B: lotted cancellation did not restore balance"
    );
    assertCondition(
      (await getLinkedQuantity(db, lottedSale, "OUT", ids.lotOne)) === 4,
      "C: OUT stock_movement_lots missing original lot quantity"
    );
    assertCondition(
      (await getLinkedQuantity(db, lottedSale, "IN", ids.lotOne)) === 4,
      "C: IN stock_movement_lots missing reverse lot quantity"
    );
    const linkCountBeforeSecondCancel = await countLotLinks(db, lottedSale);
    await cancelSale(saleService, lottedSale);
    assertCondition(
      (await countLotLinks(db, lottedSale)) === linkCountBeforeSecondCancel,
      "H: second cancellation duplicated stock_movement_lots"
    );
    successfulSales.push(lottedSale);
    console.log("OK B/C/H lotted cancellation restores same lot and is idempotent");

    const mixedBalanceBefore = await getBalance(db, ids.lotMixed);
    const mixedSale = await createSale(db, "PHASE-3-15-D", [
      {
        product_id: ids.productNonLot,
        quantity: 1,
        price: 100,
        order_item_id: null,
      },
      {
        product_id: ids.productLotMixed,
        quantity: 1,
        price: 60,
        order_item_id: null,
      },
    ]);
    await cancelSale(saleService, mixedSale);
    await assertCancelled(db, mixedSale);
    assertCondition(
      (await getBalance(db, ids.lotMixed)) === mixedBalanceBefore,
      "D: mixed sale did not restore lotted balance"
    );
    assertCondition(
      (await getLinkedQuantity(db, mixedSale, "OUT", ids.lotMixed)) === 1 &&
        (await getLinkedQuantity(db, mixedSale, "IN", ids.lotMixed)) === 1,
      "D: mixed sale did not keep lotted OUT/IN links"
    );
    successfulSales.push(mixedSale);
    console.log("OK D mixed sale cancellation");

    const expiredBalanceBefore = await getBalance(db, ids.lotOne);
    const expiredSale = await createSale(db, "PHASE-3-15-E", [
      {
        product_id: ids.productLotOne,
        quantity: 1,
        price: 50,
        order_item_id: null,
      },
    ]);
    await db.query(
      `
        UPDATE inventory_lots
        SET status = 'EXPIRED',
            expiration_date = CURRENT_DATE - INTERVAL '1 day'
        WHERE tenant_id = $1
          AND id = $2
      `,
      [ids.tenant, ids.lotOne]
    );
    await cancelSale(saleService, expiredSale);
    await assertCancelled(db, expiredSale);
    assertCondition(
      (await getBalance(db, ids.lotOne)) === expiredBalanceBefore,
      "E: expired lot reversal did not restore balance"
    );
    await db.query(
      `
        UPDATE inventory_lots
        SET status = 'ACTIVE',
            expiration_date = CURRENT_DATE + INTERVAL '90 days'
        WHERE tenant_id = $1
          AND id = $2
      `,
      [ids.tenant, ids.lotOne]
    );
    successfulSales.push(expiredSale);
    console.log("OK E expired lot allows reversal");

    const blockedBalanceBefore = await getBalance(db, ids.lotOne);
    const blockedSale = await createSale(db, "PHASE-3-15-F", [
      {
        product_id: ids.productLotOne,
        quantity: 1,
        price: 50,
        order_item_id: null,
      },
    ]);
    await db.query(
      `
        UPDATE inventory_lots
        SET status = 'BLOCKED'
        WHERE tenant_id = $1
          AND id = $2
      `,
      [ids.tenant, ids.lotOne]
    );
    await cancelSale(saleService, blockedSale);
    await assertCancelled(db, blockedSale);
    assertCondition(
      (await getBalance(db, ids.lotOne)) === blockedBalanceBefore,
      "F: BLOCKED lot reversal did not restore balance"
    );
    await db.query(
      `
        UPDATE inventory_lots
        SET status = 'ACTIVE'
        WHERE tenant_id = $1
          AND id = $2
      `,
      [ids.tenant, ids.lotOne]
    );
    successfulSales.push(blockedSale);
    console.log("OK F BLOCKED lot allows reversal");

    const cancelledBalanceBefore = await getBalance(db, ids.lotOne);
    const cancelledLotSale = await createSale(db, "PHASE-3-15-G", [
      {
        product_id: ids.productLotOne,
        quantity: 1,
        price: 50,
        order_item_id: null,
      },
    ]);
    const cancelledBalanceAfterSale = await getBalance(db, ids.lotOne);
    await db.query(
      `
        UPDATE inventory_lots
        SET status = 'CANCELLED'
        WHERE tenant_id = $1
          AND id = $2
      `,
      [ids.tenant, ids.lotOne]
    );
    await cancelSale(saleService, cancelledLotSale)
      .then(() => {
        throw new Error("G: CANCELLED lot reversal should fail");
      })
      .catch((error: unknown) => {
        assertCondition(
          error instanceof Error &&
            error.message.includes("CANCELLED lot cannot be reversed"),
          `G: unexpected error: ${String(error)}`
        );
      });
    const cancelledLotSaleStatus = await getSaleStatus(db, cancelledLotSale);
    assertCondition(
      cancelledLotSaleStatus !== "CANCELLED" &&
        cancelledLotSaleStatus !== "REFUNDED",
      "G: failed cancellation changed sale status to cancelled/refunded"
    );
    assertCondition(
      (await getBalance(db, ids.lotOne)) === cancelledBalanceAfterSale,
      "G: failed cancellation mutated balance"
    );
    await db.query(
      `
        UPDATE inventory_lots
        SET status = 'ACTIVE'
        WHERE tenant_id = $1
          AND id = $2
      `,
      [ids.tenant, ids.lotOne]
    );
    assertCondition(
      cancelledBalanceBefore - cancelledBalanceAfterSale === 1,
      "G: fixture sale did not consume expected quantity"
    );
    console.log("OK G CANCELLED lot fails and rolls back");

    const missingLinkSale = await createSale(db, "PHASE-3-15-I", [
      {
        product_id: ids.productLotOne,
        quantity: 1,
        price: 50,
        order_item_id: null,
      },
    ]);
    await db.query(
      `
        DELETE FROM stock_movement_lots
        WHERE tenant_id = $1
          AND stock_movement_id IN (
            SELECT id
            FROM stock_movements
            WHERE tenant_id = $1
              AND reference_id = $2
          )
      `,
      [ids.tenant, missingLinkSale]
    );
    await cancelSale(saleService, missingLinkSale)
      .then(() => {
        throw new Error("I: missing stock_movement_lots should fail");
      })
      .catch((error: unknown) => {
        assertCondition(
          error instanceof Error &&
            error.message.includes("missing stock_movement_lots"),
          `I: unexpected error: ${String(error)}`
        );
      });
    const missingLinkSaleStatus = await getSaleStatus(db, missingLinkSale);
    assertCondition(
      missingLinkSaleStatus !== "CANCELLED" &&
        missingLinkSaleStatus !== "REFUNDED",
      "I: missing link cancellation changed sale status to cancelled/refunded"
    );
    console.log("OK I missing stock_movement_lots fails safely");

    const netResult = await db.query<{ net_quantity: string | number }>(
      `
        SELECT COALESCE(
          SUM(
            CASE
              WHEN sm.type = 'IN' THEN sml.quantity
              ELSE -sml.quantity
            END
          ),
          0
        ) AS net_quantity
        FROM stock_movement_lots AS sml
        INNER JOIN stock_movements AS sm
          ON sm.id = sml.stock_movement_id
         AND sm.tenant_id = sml.tenant_id
        WHERE sml.tenant_id = $1
          AND sm.reference_id = ANY($2::uuid[])
      `,
      [ids.tenant, successfulSales]
    );
    assertCondition(
      toNumber(netResult.rows[0]?.net_quantity) === 0,
      "J: successful cancelled sales have non-zero lot net quantity"
    );
    console.log("OK J successful cancellations reconcile to zero lot net");

    const allocationResult = await db.query<CountRow>(
      `
        SELECT COUNT(*) AS count
        FROM payment_allocations
        WHERE reference_id = ANY($1::uuid[])
      `,
      [successfulSales]
    );
    assertCondition(
      toNumber(allocationResult.rows[0]?.count) === 0,
      "K: unexpected finance payment allocations were created"
    );
    console.log("OK K finance payments/cash allocations unchanged for v2 fixture");

    console.log("OK Fase 3.15 local cancellation test passed");
  } finally {
    const pool = (db as unknown as { pool?: { end: () => Promise<void> } }).pool;
    await pool?.end();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
