// SOLO LOCAL/DEV - NO PRD.
// Validacion integral operativa Fase 5 por API real + DB local.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseService } from "../../../api/src/common/db/database.service";

const ids = {
  tenant: "95000000-0000-0000-0000-000000000001",
  branch: "95000000-0000-0000-0000-000000000002",
  unit: "95000000-0000-0000-0000-000000000003",
  persona: "95000000-0000-0000-0000-000000000004",
  user: "95000000-0000-0000-0000-000000000005",
  authSession: "95000000-0000-0000-0000-000000000006",
  terminal: "95000000-0000-0000-0000-000000000007",
  posSession: "95000000-0000-0000-0000-000000000008",
  supplier: "95000000-0000-0000-0000-000000000009",
  customer: "95000000-0000-0000-0000-000000000010",
  paymentMethod: "95000000-0000-0000-0000-000000000011",
  cashRegister: "95000000-0000-0000-0000-000000000012",
  cashSession: "95000000-0000-0000-0000-000000000013",
  location: "95000000-0000-0000-0000-000000000014",
};

type ApiResult<T> = {
  status: number;
  body: T;
};

type ProductResponse = {
  id: string;
  sku: string;
  isPerishable?: boolean;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  operationalStatus?: string;
  rotationClass?: string | null;
  minStock?: number | null;
  maxStock?: number | null;
};

type PurchaseResponse = {
  id: string;
  status: string;
};

type PurchaseDetailResponse = PurchaseResponse & {
  items: Array<{
    id: string;
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    requiresLot?: boolean;
    requiresExpiration?: boolean;
  }>;
};

type SaleResponse = {
  id: string;
  status?: string;
};

type CountRow = {
  count: string | number;
};

type BalanceRow = {
  lot_code: string;
  lot_id: string;
  quantity_on_hand: string | number;
  quantity_available: string | number;
};

type LotLinkRow = {
  lot_code: string | null;
  quantity: string | number;
  type: "IN" | "OUT";
};

type StepResult = {
  step: string;
  status: "OK";
  detail: string;
};

const results: StepResult[] = [];

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

const signJwt = () => {
  const secret = process.env.JWT_SECRET ?? "changeme";
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    sub: ids.user,
    tenant_id: ids.tenant,
    session_id: ids.authSession,
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

const apiRequest = async <T>(
  method: "GET" | "POST" | "PUT",
  urlPath: string,
  token: string,
  body?: unknown,
  expectOk = true
): Promise<ApiResult<T>> => {
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
      `${method} ${urlPath} failed ${response.status}: ${JSON.stringify(parsed)}`
    );
  }
  if (!expectOk && response.ok) {
    throw new Error(`${method} ${urlPath} should fail but returned 2xx`);
  }

  return {
    status: response.status,
    body: parsed as T,
  };
};

const cleanupFixture = async (db: DatabaseService) => {
  const deleteIfTableExists = async (tableName: string) => {
    const result = await db.query<{ exists: string | null }>(
      `SELECT to_regclass($1)::text AS exists`,
      [tableName]
    );
    if (!result.rows[0]?.exists) {
      return;
    }
    await db.query(`DELETE FROM ${tableName} WHERE tenant_id = $1`, [ids.tenant]);
  };

  await db.query(`DELETE FROM cash_movements WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(
    `
      DELETE FROM payment_allocations AS pa
      USING payments AS p
      WHERE pa.payment_id = p.id
        AND p.tenant_id = $1
    `,
    [ids.tenant]
  );
  await db.query(
    `
      DELETE FROM payment_allocations AS pa
      USING sales AS s
      WHERE pa.reference_id = s.id
        AND s.tenant_id = $1
    `,
    [ids.tenant]
  );
  await db.query(`DELETE FROM payments WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM sale_item_taxes WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM sale_payment_methods WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM sale_items WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM stock_movement_lots WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM stock_movements WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM sales WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM inventory_lot_balances WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM inventory_lots WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM product_barcodes WHERE tenant_id = $1`, [ids.tenant]);
  await deleteIfTableExists("purchase_status_history");
  await db.query(
    `DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE tenant_id = $1)`,
    [ids.tenant]
  );
  await db.query(`DELETE FROM purchases WHERE tenant_id = $1`, [ids.tenant]);
  await deleteIfTableExists("product_price_history");
  await db.query(`DELETE FROM products WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM inventory_locations WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM cash_sessions WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM cash_registers WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM payment_methods WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM pos_user_sessions WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM auth_sessions WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM terminals WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM customers WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM suppliers WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM user_roles WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM persona_tenant_branches WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM users WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM personas WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM tenant_branches WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM units WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM auditoria_eventos WHERE tenant_id = $1`, [ids.tenant]);
  await db.query(`DELETE FROM tenants WHERE id = $1`, [ids.tenant]);
};

const assertLocalDatabase = async (db: DatabaseService) => {
  const host = process.env.DB_HOST ?? "localhost";
  assertCondition(
    ["localhost", "127.0.0.1", "::1"].includes(host),
    `SOLO LOCAL/DEV: DB_HOST no local: ${host}`
  );

  const result = await db.query<{
    version: string;
    db_name: string;
    addr: string;
    v1_exists: boolean;
    v2_exists: boolean;
    invoice_exists: boolean;
    products_exists: boolean;
    purchases_exists: boolean;
    purchase_items_exists: boolean;
    stock_movements_exists: boolean;
    inventory_lots_exists: boolean;
    inventory_lot_balances_exists: boolean;
    stock_movement_lots_exists: boolean;
    sales_exists: boolean;
    sale_items_exists: boolean;
  }>(
    `
      SELECT
        version() AS version,
        current_database() AS db_name,
        COALESCE(inet_server_addr()::text, 'local-socket') AS addr,
        to_regprocedure('public.inventory_create_sale(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NOT NULL AS v1_exists,
        to_regprocedure('public.inventory_create_sale_v2(uuid,uuid,uuid,uuid,uuid,uuid,uuid,character varying,jsonb,jsonb)') IS NOT NULL AS v2_exists,
        EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'inventory_invoice_order') AS invoice_exists,
        to_regclass('public.products') IS NOT NULL AS products_exists,
        to_regclass('public.purchases') IS NOT NULL AS purchases_exists,
        to_regclass('public.purchase_items') IS NOT NULL AS purchase_items_exists,
        to_regclass('public.stock_movements') IS NOT NULL AS stock_movements_exists,
        to_regclass('public.inventory_lots') IS NOT NULL AS inventory_lots_exists,
        to_regclass('public.inventory_lot_balances') IS NOT NULL AS inventory_lot_balances_exists,
        to_regclass('public.stock_movement_lots') IS NOT NULL AS stock_movement_lots_exists,
        to_regclass('public.sales') IS NOT NULL AS sales_exists,
        to_regclass('public.sale_items') IS NOT NULL AS sale_items_exists
    `
  );

  const row = result.rows[0];
  assertCondition(row.version.includes("PostgreSQL 16"), "PostgreSQL 16 required");
  assertCondition(
    row.addr === "local-socket" ||
      row.addr.startsWith("127.0.0.1") ||
      row.addr.startsWith("::1"),
    `SOLO LOCAL/DEV: servidor no local detectado: ${row.addr}`
  );
  for (const key of [
    "v1_exists",
    "v2_exists",
    "invoice_exists",
    "products_exists",
    "purchases_exists",
    "purchase_items_exists",
    "stock_movements_exists",
    "inventory_lots_exists",
    "inventory_lot_balances_exists",
    "stock_movement_lots_exists",
    "sales_exists",
    "sale_items_exists",
  ] as const) {
    assertCondition(row[key], `${key} false`);
  }

  results.push({
    step: "Precondiciones",
    status: "OK",
    detail: `${row.db_name}; ${row.version.split(",")[0]}; ${row.addr}`,
  });
};

const setupFixture = async (db: DatabaseService) => {
  await cleanupFixture(db);
  await db.query(
    `
      DO $$
      DECLARE
        v_super_admin_role_id UUID;
      BEGIN
        SELECT id INTO v_super_admin_role_id
        FROM roles
        WHERE nombre = 'SUPER_ADMIN'
        LIMIT 1;

        IF v_super_admin_role_id IS NULL THEN
          RAISE EXCEPTION 'Rol SUPER_ADMIN no existe';
        END IF;

        INSERT INTO tenants (id, slug, nombre, config, activo)
        VALUES (
          '95000000-0000-0000-0000-000000000001',
          'phase-5-operational-local',
          'Tenant prueba Fase 5 integral',
          '{}'::jsonb,
          TRUE
        );

        INSERT INTO tenant_branches (id, tenant_id, codigo, nombre, es_principal, estado)
        VALUES (
          '95000000-0000-0000-0000-000000000002',
          '95000000-0000-0000-0000-000000000001',
          'P5-OPS',
          'Sucursal Fase 5 integral',
          TRUE,
          'ACTIVE'
        );

        INSERT INTO units (id, tenant_id, name, abbreviation, is_active)
        VALUES (
          '95000000-0000-0000-0000-000000000003',
          '95000000-0000-0000-0000-000000000001',
          'Unidad Fase 5',
          'P5',
          TRUE
        );

        INSERT INTO personas (
          id,
          tenant_id,
          nombres,
          apellidos,
          documento_tipo,
          documento_numero,
          cargo_nombre,
          email_personal
        )
        VALUES (
          '95000000-0000-0000-0000-000000000004',
          '95000000-0000-0000-0000-000000000001',
          'Phase',
          'Five Integral',
          'CC',
          'P5INTEGRAL',
          'QA integral local',
          'phase-5-operational@example.test'
        );

        INSERT INTO persona_tenant_branches (
          persona_id,
          tenant_branch_id,
          tenant_id,
          es_principal
        )
        VALUES (
          '95000000-0000-0000-0000-000000000004',
          '95000000-0000-0000-0000-000000000002',
          '95000000-0000-0000-0000-000000000001',
          TRUE
        );

        INSERT INTO users (id, tenant_id, persona_id, email, password_hash, estado)
        VALUES (
          '95000000-0000-0000-0000-000000000005',
          '95000000-0000-0000-0000-000000000001',
          '95000000-0000-0000-0000-000000000004',
          'phase-5-operational@example.test',
          '$2b$10$n1.t/z8W7.EcntEnI8O4nuLQAbnr53Mt4g2vG9vEfgUCAvGddlEJS',
          'ACTIVE'
        );

        INSERT INTO user_roles (user_id, role_id, tenant_id)
        VALUES (
          '95000000-0000-0000-0000-000000000005',
          v_super_admin_role_id,
          '95000000-0000-0000-0000-000000000001'
        );

        INSERT INTO auth_sessions (
          id,
          user_id,
          tenant_id,
          refresh_token,
          user_agent,
          ip_address,
          is_active
        )
        VALUES (
          '95000000-0000-0000-0000-000000000006',
          '95000000-0000-0000-0000-000000000005',
          '95000000-0000-0000-0000-000000000001',
          'phase-5-operational-refresh-token',
          'phase-5-operational-local',
          '127.0.0.1',
          TRUE
        );

        INSERT INTO terminals (id, tenant_id, branch_id, name, code, is_active)
        VALUES (
          '95000000-0000-0000-0000-000000000007',
          '95000000-0000-0000-0000-000000000001',
          '95000000-0000-0000-0000-000000000002',
          'Terminal Fase 5 integral',
          'TERM-P5-OPS',
          TRUE
        );

        INSERT INTO pos_user_sessions (
          id,
          auth_session_id,
          user_id,
          tenant_id,
          branch_id,
          terminal_id,
          is_active
        )
        VALUES (
          '95000000-0000-0000-0000-000000000008',
          '95000000-0000-0000-0000-000000000006',
          '95000000-0000-0000-0000-000000000005',
          '95000000-0000-0000-0000-000000000001',
          '95000000-0000-0000-0000-000000000002',
          '95000000-0000-0000-0000-000000000007',
          TRUE
        );

        INSERT INTO suppliers (id, tenant_id, name, document_number, phone, email, is_active)
        VALUES (
          '95000000-0000-0000-0000-000000000009',
          '95000000-0000-0000-0000-000000000001',
          'Proveedor Fase 5 integral',
          'P5SUP',
          '3000000000',
          'proveedor-p5@example.test',
          TRUE
        );

        INSERT INTO customers (id, tenant_id, name, document_number, is_active)
        VALUES (
          '95000000-0000-0000-0000-000000000010',
          '95000000-0000-0000-0000-000000000001',
          'Cliente Fase 5 integral',
          'P5CUSTOMER',
          TRUE
        );

        INSERT INTO payment_methods (
          id,
          tenant_id,
          codigo,
          nombre,
          tipo,
          allows_change,
          active
        )
        VALUES (
          '95000000-0000-0000-0000-000000000011',
          '95000000-0000-0000-0000-000000000001',
          'CASH-P5',
          'Efectivo Fase 5',
          'CASH',
          TRUE,
          TRUE
        );

        INSERT INTO cash_registers (
          id,
          tenant_id,
          branch_id,
          terminal_id,
          codigo,
          nombre,
          activo
        )
        VALUES (
          '95000000-0000-0000-0000-000000000012',
          '95000000-0000-0000-0000-000000000001',
          '95000000-0000-0000-0000-000000000002',
          '95000000-0000-0000-0000-000000000007',
          'CAJA-P5',
          'Caja Fase 5 integral',
          TRUE
        );

        INSERT INTO cash_sessions (
          id,
          tenant_id,
          branch_id,
          cash_register_id,
          opened_by_user_id,
          opening_amount,
          status
        )
        VALUES (
          '95000000-0000-0000-0000-000000000013',
          '95000000-0000-0000-0000-000000000001',
          '95000000-0000-0000-0000-000000000002',
          '95000000-0000-0000-0000-000000000012',
          '95000000-0000-0000-0000-000000000005',
          0,
          'OPEN'
        );

        INSERT INTO inventory_locations (
          id,
          tenant_id,
          branch_id,
          code,
          name,
          type,
          description,
          is_active
        )
        VALUES (
          '95000000-0000-0000-0000-000000000014',
          '95000000-0000-0000-0000-000000000001',
          '95000000-0000-0000-0000-000000000002',
          'P5-A1',
          'Ubicacion Fase 5 integral',
          'WAREHOUSE',
          'SOLO LOCAL/DEV',
          TRUE
        );
      END $$;
    `
  );

  results.push({
    step: "A fixture base",
    status: "OK",
    detail: `tenant=${ids.tenant}; branch=${ids.branch}; user=${ids.user}`,
  });
};

const createProduct = async (token: string, payload: Record<string, unknown>) => {
  const response = await apiRequest<ProductResponse>("POST", "/products", token, payload);
  assertCondition(response.body.id, "product id missing");
  return response.body;
};

const updateProduct = async (
  token: string,
  productId: string,
  payload: Record<string, unknown>
) => {
  const response = await apiRequest<ProductResponse>(
    "PUT",
    `/products/${productId}`,
    token,
    payload
  );
  return response.body;
};

const createPurchase = async (
  token: string,
  productId: string,
  quantity: number,
  cost: number
) => {
  const response = await apiRequest<PurchaseResponse>("POST", "/purchases", token, {
    supplierId: ids.supplier,
    branchId: ids.branch,
    type: "CASH",
    total: quantity * cost,
    items: [
      {
        productId,
        quantity,
        cost,
        subtotal: quantity * cost,
      },
    ],
  });
  assertCondition(response.body.id, "purchase id missing");
  return response.body.id;
};

const getPurchaseDetail = async (token: string, purchaseId: string) => {
  const response = await apiRequest<PurchaseDetailResponse>(
    "GET",
    `/purchases/${purchaseId}`,
    token
  );
  assertCondition(response.body.items.length === 1, "purchase item missing");
  return response.body;
};

const receivePurchase = async (
  token: string,
  purchaseId: string,
  item: Record<string, unknown>,
  expectOk = true
) =>
  apiRequest<PurchaseResponse>(
    "POST",
    `/purchases/${purchaseId}/receive`,
    token,
    { items: [item] },
    expectOk
  );

const createAdjustment = async (
  token: string,
  payload: Record<string, unknown>,
  expectOk = true
) =>
  apiRequest<Record<string, unknown>>(
    "POST",
    "/stock-adjustments",
    token,
    payload,
    expectOk
  );

const salePayload = (items: Array<{ productId: string; quantity: number; price: number }>) => ({
  customerId: ids.customer,
  type: "CASH",
  items,
  payments: [
    {
      paymentMethodId: ids.paymentMethod,
      cashSessionId: ids.cashSession,
      amount: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      referenceNumber: "PHASE-5-LOCAL",
      notes: "SOLO LOCAL/DEV",
    },
  ],
});

const createSale = async (
  token: string,
  items: Array<{ productId: string; quantity: number; price: number }>,
  expectOk = true
) =>
  apiRequest<SaleResponse>("POST", "/sales", token, salePayload(items), expectOk);

const cancelSale = async (token: string, saleId: string) =>
  apiRequest<SaleResponse>("POST", `/sales/${saleId}/cancel`, token);

const getBalances = async (db: DatabaseService, productId: string) => {
  const result = await db.query<BalanceRow>(
    `
      SELECT
        lot.lot_code,
        lot.id::text AS lot_id,
        balance.quantity_on_hand,
        balance.quantity_available
      FROM inventory_lot_balances AS balance
      INNER JOIN inventory_lots AS lot
        ON lot.id = balance.lot_id
       AND lot.tenant_id = balance.tenant_id
      WHERE balance.tenant_id = $1
        AND balance.branch_id = $2
        AND balance.product_id = $3
      ORDER BY lot.expiration_date ASC NULLS LAST, lot.lot_code ASC
    `,
    [ids.tenant, ids.branch, productId]
  );

  return new Map(
    result.rows.map((row) => [
      row.lot_code,
      {
        lotId: row.lot_id,
        onHand: toNumber(row.quantity_on_hand),
        available: toNumber(row.quantity_available),
      },
    ])
  );
};

const getSaleCounts = async (db: DatabaseService) => {
  const result = await db.query<{
    sales: string | number;
    sale_items: string | number;
    stock_movements: string | number;
    stock_movement_lots: string | number;
  }>(
    `
      SELECT
        (SELECT COUNT(*) FROM sales WHERE tenant_id = $1) AS sales,
        (SELECT COUNT(*) FROM sale_items WHERE tenant_id = $1) AS sale_items,
        (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = $1) AS stock_movements,
        (SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = $1) AS stock_movement_lots
    `,
    [ids.tenant]
  );
  const row = result.rows[0];
  return {
    sales: toNumber(row.sales),
    saleItems: toNumber(row.sale_items),
    stockMovements: toNumber(row.stock_movements),
    stockMovementLots: toNumber(row.stock_movement_lots),
  };
};

const getLotLinksForSale = async (db: DatabaseService, saleId: string) => {
  const result = await db.query<LotLinkRow>(
    `
      SELECT lot.lot_code, sml.quantity, sm.type
      FROM stock_movement_lots AS sml
      INNER JOIN stock_movements AS sm
        ON sm.id = sml.stock_movement_id
       AND sm.tenant_id = sml.tenant_id
      LEFT JOIN inventory_lots AS lot
        ON lot.id = sml.lot_id
       AND lot.tenant_id = sml.tenant_id
      WHERE sml.tenant_id = $1
        AND sm.reference_id = $2
      ORDER BY sm.type DESC, lot.expiration_date ASC NULLS LAST, lot.lot_code ASC
    `,
    [ids.tenant, saleId]
  );
  return result.rows.map((row) => ({
    lotCode: row.lot_code,
    quantity: toNumber(row.quantity),
    type: row.type,
  }));
};

const countLinksForProductSale = async (
  db: DatabaseService,
  saleId: string,
  productId: string
) => {
  const result = await db.query<CountRow>(
    `
      SELECT COUNT(*) AS count
      FROM stock_movement_lots AS sml
      INNER JOIN stock_movements AS sm
        ON sm.id = sml.stock_movement_id
       AND sm.tenant_id = sml.tenant_id
      WHERE sml.tenant_id = $1
        AND sm.reference_id = $2
        AND sml.product_id = $3
    `,
    [ids.tenant, saleId, productId]
  );
  return toNumber(result.rows[0].count);
};

const assertNoLotLinksForProduct = async (db: DatabaseService, productId: string) => {
  const result = await db.query<CountRow>(
    `
      SELECT COUNT(*) AS count
      FROM stock_movement_lots
      WHERE tenant_id = $1
        AND product_id = $2
    `,
    [ids.tenant, productId]
  );
  assertCondition(toNumber(result.rows[0].count) === 0, "non-lotted product has lot links");
};

const assertApiReadEndpoints = async (
  token: string,
  lottedProductId: string,
  lottedPurchaseId: string
) => {
  await apiRequest<ProductResponse>("GET", `/products/${lottedProductId}`, token);
  await apiRequest<ProductResponse[]>("GET", `/inventory/products?branchId=${ids.branch}`, token);
  await apiRequest<PurchaseDetailResponse>("GET", `/purchases/${lottedPurchaseId}`, token);
  await apiRequest<unknown[]>(
    "GET",
    `/inventory/lots?branchId=${ids.branch}&productId=${lottedProductId}`,
    token
  );
  await apiRequest<unknown[]>(
    "GET",
    `/inventory/lot-balances?branchId=${ids.branch}&productId=${lottedProductId}`,
    token
  );
};

const assertReconciliationClean = async (token: string) => {
  const summary = await apiRequest<{
    criticalCount: number;
    highCount: number;
    discrepancyCount: number;
  }>(
    "GET",
    `/inventory/lot-reconciliation/summary?branchId=${ids.branch}`,
    token
  );
  assertCondition(summary.body.criticalCount === 0, "reconciliation criticalCount != 0");
  assertCondition(summary.body.highCount === 0, "reconciliation highCount != 0");

  const discrepancies = await apiRequest<unknown[]>(
    "GET",
    `/inventory/lot-reconciliation/discrepancies?branchId=${ids.branch}`,
    token
  );
  assertCondition(
    Array.isArray(discrepancies.body) && discrepancies.body.length === 0,
    "reconciliation discrepancies not empty"
  );

  return summary.body;
};

const assertFixtureClean = async (db: DatabaseService) => {
  const result = await db.query<CountRow>(
    `
      SELECT
        (
          (SELECT COUNT(*) FROM tenants WHERE id = $1)
          + (SELECT COUNT(*) FROM tenant_branches WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM users WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM products WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM purchases WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM sales WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM stock_movements WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM inventory_lots WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM inventory_lot_balances WHERE tenant_id = $1)
          + (SELECT COUNT(*) FROM stock_movement_lots WHERE tenant_id = $1)
        ) AS count
    `,
    [ids.tenant]
  );
  assertCondition(toNumber(result.rows[0].count) === 0, "fixture cleanup left rows");
};

const main = async () => {
  loadEnvFile(path.resolve("api/.env"));

  const db = new DatabaseService();
  const pool = (db as unknown as { pool?: { end: () => Promise<void> } }).pool;
  const token = signJwt();

  let lottedProductId = "";
  let noLotProductId = "";
  let lottedPurchaseId = "";
  let noLotPurchaseId = "";
  let lottedSaleId = "";
  let mixedSaleId = "";

  try {
    await assertLocalDatabase(db);
    await setupFixture(db);

    const lottedProduct = await createProduct(token, {
      unitId: ids.unit,
      name: "P5 producto loteado integral",
      sku: "P5-LOT-INTEGRAL",
      price: 120,
      cost: 70,
      isActive: true,
      isPerishable: true,
      requiresLot: true,
      requiresExpiration: true,
      operationalStatus: "ACTIVE",
      rotationClass: "HIGH",
      minStock: 5,
      maxStock: 30,
    });
    lottedProductId = lottedProduct.id;

    const noLotProduct = await createProduct(token, {
      unitId: ids.unit,
      name: "P5 producto no lote integral",
      sku: "P5-NOLOT-INTEGRAL",
      price: 80,
      cost: 40,
      isActive: true,
      isPerishable: false,
      requiresLot: false,
      requiresExpiration: false,
      operationalStatus: "ACTIVE",
      rotationClass: "MEDIUM",
      minStock: 2,
      maxStock: 20,
    });
    noLotProductId = noLotProduct.id;

    const editedProduct = await updateProduct(token, lottedProductId, {
      rotationClass: "LOW",
      minStock: 3,
      maxStock: 25,
      requiresLot: true,
      requiresExpiration: true,
      isPerishable: true,
    });
    assertCondition(editedProduct.rotationClass === "LOW", "product edit did not persist");
    const productFromGet = await apiRequest<ProductResponse>(
      "GET",
      `/products/${lottedProductId}`,
      token
    );
    assertCondition(productFromGet.body.requiresLot === true, "GET /products lost requiresLot");
    assertCondition(
      productFromGet.body.requiresExpiration === true,
      "GET /products lost requiresExpiration"
    );
    results.push({
      step: "B producto enriquecido",
      status: "OK",
      detail: `lotted=${lottedProductId}; noLot=${noLotProductId}`,
    });

    lottedPurchaseId = await createPurchase(token, lottedProductId, 10, 70);
    const lottedPurchase = await getPurchaseDetail(token, lottedPurchaseId);
    await receivePurchase(
      token,
      lottedPurchaseId,
      {
        productId: lottedProductId,
        purchaseItemId: lottedPurchase.items[0].id,
        receivedQuantity: 1,
        expirationDate: "2026-12-31",
      },
      false
    );
    await receivePurchase(
      token,
      lottedPurchaseId,
      {
        productId: lottedProductId,
        purchaseItemId: lottedPurchase.items[0].id,
        receivedQuantity: 1,
        lotCode: "P5-LOT-LATE",
      },
      false
    );
    await receivePurchase(token, lottedPurchaseId, {
      productId: lottedProductId,
      purchaseItemId: lottedPurchase.items[0].id,
      receivedQuantity: 6,
      lotCode: "P5-LOT-LATE",
      expirationDate: "2026-12-31",
      locationId: ids.location,
      unitCost: 72,
    });
    const lottedPurchaseAfter = await getPurchaseDetail(token, lottedPurchaseId);
    assertCondition(lottedPurchaseAfter.status === "PARTIAL", "lotted purchase not partial");
    assertCondition(
      lottedPurchaseAfter.items[0].receivedQuantity === 6,
      "lotted purchase received quantity mismatch"
    );
    let balances = await getBalances(db, lottedProductId);
    assertCondition(balances.get("P5-LOT-LATE")?.onHand === 6, "purchase lot balance missing");
    results.push({
      step: "C compra y recepcion loteada",
      status: "OK",
      detail: `purchase=${lottedPurchaseId}; lot=P5-LOT-LATE; received=6`,
    });

    noLotPurchaseId = await createPurchase(token, noLotProductId, 5, 40);
    const noLotPurchase = await getPurchaseDetail(token, noLotPurchaseId);
    await receivePurchase(token, noLotPurchaseId, {
      productId: noLotProductId,
      purchaseItemId: noLotPurchase.items[0].id,
      receivedQuantity: 3,
    });
    const noLotPurchaseAfter = await getPurchaseDetail(token, noLotPurchaseId);
    assertCondition(noLotPurchaseAfter.status === "PARTIAL", "non-lotted purchase not partial");
    await assertNoLotLinksForProduct(db, noLotProductId);
    results.push({
      step: "D compra y recepcion no loteada",
      status: "OK",
      detail: `purchase=${noLotPurchaseId}; received=3; lotLinks=0`,
    });

    await createAdjustment(token, {
      productId: lottedProductId,
      branchId: ids.branch,
      type: "IN",
      quantity: 4,
      reason: "Fase 5 ajuste IN loteado",
      lotCode: "P5-LOT-EARLY",
      expirationDate: "2026-08-31",
      locationId: ids.location,
      unitCost: 75,
    });
    await createAdjustment(token, {
      productId: lottedProductId,
      branchId: ids.branch,
      type: "OUT",
      quantity: 1,
      reason: "Fase 5 ajuste OUT loteado",
      lotCode: "P5-LOT-EARLY",
      locationId: ids.location,
    });
    balances = await getBalances(db, lottedProductId);
    assertCondition(balances.get("P5-LOT-EARLY")?.onHand === 3, "adjustment lot balance wrong");
    results.push({
      step: "E ajuste manual loteado",
      status: "OK",
      detail: "P5-LOT-EARLY IN 4, OUT 1, balance=3",
    });

    await createAdjustment(token, {
      productId: noLotProductId,
      branchId: ids.branch,
      type: "IN",
      quantity: 2,
      reason: "Fase 5 ajuste IN no loteado",
    });
    await createAdjustment(token, {
      productId: noLotProductId,
      branchId: ids.branch,
      type: "OUT",
      quantity: 1,
      reason: "Fase 5 ajuste OUT no loteado",
    });
    await assertNoLotLinksForProduct(db, noLotProductId);
    results.push({
      step: "F ajuste manual no loteado",
      status: "OK",
      detail: "IN 2, OUT 1, lotLinks=0",
    });

    await assertApiReadEndpoints(token, lottedProductId, lottedPurchaseId);

    const balancesBeforeSale = await getBalances(db, lottedProductId);
    const saleResponse = await createSale(token, [
      { productId: lottedProductId, quantity: 5, price: 120 },
    ]);
    lottedSaleId = saleResponse.body.id;
    const lottedSaleLinks = await getLotLinksForSale(db, lottedSaleId);
    assertCondition(
      lottedSaleLinks.some(
        (link) =>
          link.type === "OUT" &&
          link.lotCode === "P5-LOT-EARLY" &&
          link.quantity === 3
      ),
      "FEFO did not consume early lot first"
    );
    assertCondition(
      lottedSaleLinks.some(
        (link) =>
          link.type === "OUT" &&
          link.lotCode === "P5-LOT-LATE" &&
          link.quantity === 2
      ),
      "FEFO did not consume late lot remainder"
    );
    balances = await getBalances(db, lottedProductId);
    assertCondition(balances.get("P5-LOT-EARLY")?.onHand === 0, "early lot not depleted");
    assertCondition(balances.get("P5-LOT-LATE")?.onHand === 4, "late lot not decremented");
    results.push({
      step: "G venta FEFO loteada",
      status: "OK",
      detail: `sale=${lottedSaleId}; early 3 + late 2`,
    });

    const mixedSaleResponse = await createSale(token, [
      { productId: lottedProductId, quantity: 2, price: 120 },
      { productId: noLotProductId, quantity: 1, price: 80 },
    ]);
    mixedSaleId = mixedSaleResponse.body.id;
    assertCondition(
      (await countLinksForProductSale(db, mixedSaleId, noLotProductId)) === 0,
      "mixed sale created lot link for non-lotted product"
    );
    const mixedLinks = await getLotLinksForSale(db, mixedSaleId);
    assertCondition(
      mixedLinks.some(
        (link) =>
          link.type === "OUT" &&
          link.lotCode === "P5-LOT-LATE" &&
          link.quantity === 2
      ),
      "mixed sale missing lotted OUT link"
    );
    results.push({
      step: "G venta mixta",
      status: "OK",
      detail: `sale=${mixedSaleId}; only lotted item has stock_movement_lots`,
    });

    const countsBeforeFailure = await getSaleCounts(db);
    const balancesBeforeFailure = await getBalances(db, lottedProductId);
    await createSale(
      token,
      [{ productId: lottedProductId, quantity: 999, price: 120 }],
      false
    );
    const countsAfterFailure = await getSaleCounts(db);
    const balancesAfterFailure = await getBalances(db, lottedProductId);
    assertCondition(
      JSON.stringify(countsAfterFailure) === JSON.stringify(countsBeforeFailure),
      "failed sale left partial rows"
    );
    assertCondition(
      balancesAfterFailure.get("P5-LOT-LATE")?.onHand ===
        balancesBeforeFailure.get("P5-LOT-LATE")?.onHand,
      "failed sale changed late lot"
    );
    results.push({
      step: "H stock insuficiente",
      status: "OK",
      detail: "rollback total; counts and balances unchanged",
    });

    await cancelSale(token, lottedSaleId);
    let linksAfterCancel = await getLotLinksForSale(db, lottedSaleId);
    assertCondition(
      linksAfterCancel.some(
        (link) =>
          link.type === "IN" &&
          link.lotCode === "P5-LOT-EARLY" &&
          link.quantity === 3
      ),
      "lotted cancel missing early IN link"
    );
    assertCondition(
      linksAfterCancel.some(
        (link) =>
          link.type === "IN" &&
          link.lotCode === "P5-LOT-LATE" &&
          link.quantity === 2
      ),
      "lotted cancel missing late IN link"
    );
    const linkCountBeforeSecondCancel = linksAfterCancel.length;
    await cancelSale(token, lottedSaleId);
    linksAfterCancel = await getLotLinksForSale(db, lottedSaleId);
    assertCondition(
      linksAfterCancel.length === linkCountBeforeSecondCancel,
      "second lotted cancel duplicated links"
    );
    results.push({
      step: "I cancelacion loteada",
      status: "OK",
      detail: `sale=${lottedSaleId}; same lots restored; no duplicate`,
    });

    await cancelSale(token, mixedSaleId);
    const mixedLinksAfterCancel = await getLotLinksForSale(db, mixedSaleId);
    assertCondition(
      mixedLinksAfterCancel.some(
        (link) =>
          link.type === "IN" &&
          link.lotCode === "P5-LOT-LATE" &&
          link.quantity === 2
      ),
      "mixed cancel missing lotted IN link"
    );
    assertCondition(
      (await countLinksForProductSale(db, mixedSaleId, noLotProductId)) === 0,
      "mixed cancel created lot link for non-lotted product"
    );
    balances = await getBalances(db, lottedProductId);
    assertCondition(
      balances.get("P5-LOT-EARLY")?.onHand ===
        balancesBeforeSale.get("P5-LOT-EARLY")?.onHand,
      "early lot not restored after cancellations"
    );
    assertCondition(
      balances.get("P5-LOT-LATE")?.onHand ===
        balancesBeforeSale.get("P5-LOT-LATE")?.onHand,
      "late lot not restored after cancellations"
    );
    results.push({
      step: "I cancelacion mixta",
      status: "OK",
      detail: `sale=${mixedSaleId}; loteado revierte, no loteado stock normal`,
    });

    const reconciliation = await assertReconciliationClean(token);
    results.push({
      step: "J reconciliacion",
      status: "OK",
      detail: `critical=${reconciliation.criticalCount}; high=${reconciliation.highCount}; discrepancies=${reconciliation.discrepancyCount}`,
    });

    console.log("RESULTS_JSON_START");
    console.log(
      JSON.stringify(
        {
          ids: {
            tenant: ids.tenant,
            branch: ids.branch,
            lottedProductId,
            noLotProductId,
            lottedPurchaseId,
            noLotPurchaseId,
            lottedSaleId,
            mixedSaleId,
          },
          results,
        },
        null,
        2
      )
    );
    console.log("RESULTS_JSON_END");

    await cleanupFixture(db);
    await assertFixtureClean(db);
    console.log("CLEANUP_OK fixture_rows_remaining=0");
  } finally {
    await pool?.end();
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
