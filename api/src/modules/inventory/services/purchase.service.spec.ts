import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PurchaseService } from "./purchase.service";

const ids = {
  tenant: "00000000-0000-0000-0000-000000000001",
  otherTenant: "00000000-0000-0000-0000-000000000099",
  purchase: "10000000-0000-0000-0000-000000000001",
  supplier: "20000000-0000-0000-0000-000000000001",
  branch: "30000000-0000-0000-0000-000000000001",
  otherBranch: "30000000-0000-0000-0000-000000000099",
  terminal: "30000000-0000-0000-0000-000000000002",
  user: "40000000-0000-0000-0000-000000000001",
  cashSession: "40000000-0000-0000-0000-000000000002",
  purchaseItem: "50000000-0000-0000-0000-000000000001",
  purchaseItem2: "50000000-0000-0000-0000-000000000002",
  product: "60000000-0000-0000-0000-000000000001",
  product2: "60000000-0000-0000-0000-000000000002",
  lot: "70000000-0000-0000-0000-000000000001",
  location: "80000000-0000-0000-0000-000000000001",
};

type FakePurchaseItem = {
  id: string;
  productId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  cost?: number;
  subtotal?: number;
};

type Scenario = {
  status?: "DRAFT" | "PENDING" | "PARTIAL" | "RECEIVED" | "CERRADA_PARCIAL" | "CANCELLED";
  paymentStatus?: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  totalPaid?: number;
  receivedQuantity?: number;
  hasMovement?: boolean;
  tenantMatches?: boolean;
  itemReceivedQuantity?: number;
  itemCost?: number;
  productRequiresLot?: boolean;
  productRequiresExpiration?: boolean;
  existingLotStatus?: "ACTIVE" | "BLOCKED" | "CANCELLED";
  existingLotExpirationDate?: string | null;
  locationBelongsToBranch?: boolean;
  invalidAuditContextUuid?: boolean;
  terminalBranchId?: string | null;
  auditTerminalName?: string | null;
  purchaseItems?: FakePurchaseItem[];
  currentCashSessionId?: string;
};

const buildPurchaseRow = (scenario: Scenario = {}) => ({
  id: ids.purchase,
  tenant_id: scenario.tenantMatches === false ? ids.otherTenant : ids.tenant,
  supplier_id: ids.supplier,
  type: "CREDIT",
  status: scenario.status ?? "PENDING",
  total: 100,
  balance: 100 - (scenario.totalPaid ?? 0),
  payment_status: scenario.paymentStatus ?? "PENDING",
  total_paid: scenario.totalPaid ?? 0,
  balance_due: 100 - (scenario.totalPaid ?? 0),
  created_at: new Date("2026-05-27T00:00:00.000Z"),
});

const actor = {
  roles: ["SUPER_ADMIN"],
  userId: ids.user,
  tenantId: ids.tenant,
};

class FakeClient {
  readonly queries: string[] = [];
  readonly params: unknown[][] = [];
  insertedPurchase: unknown[] | null = null;
  insertedItems: unknown[][] = [];
  purchaseItems: FakePurchaseItem[];
  released = false;

  constructor(readonly scenario: Scenario = {}) {
    this.purchaseItems = (
      scenario.purchaseItems ?? [
        {
          id: ids.purchaseItem,
          productId: ids.product,
          orderedQuantity: 10,
          receivedQuantity: scenario.itemReceivedQuantity ?? 7,
          cost: scenario.itemCost ?? 10000,
          subtotal: 100000,
        },
      ]
    ).map((item) => ({ ...item }));
  }

  private buildPurchaseItemRows() {
    return this.purchaseItems.map((item) => ({
      id: item.id,
      purchase_id: ids.purchase,
      product_id: item.productId,
      ordered_quantity: item.orderedQuantity,
      received_quantity: item.receivedQuantity,
      cost: item.cost ?? this.scenario.itemCost ?? 10000,
      subtotal: item.subtotal ?? (item.cost ?? this.scenario.itemCost ?? 10000) * item.orderedQuantity,
    }));
  }

  async query(text: string, params: unknown[] = []) {
    const trimmed = text.trim();
    this.queries.push(trimmed);
    this.params.push(params);

    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(trimmed)) {
      return { rows: [] };
    }
    if (trimmed.includes("FROM purchases") && trimmed.includes("FOR UPDATE")) {
      if (this.scenario.tenantMatches === false) {
        return { rows: [] };
      }
      return { rows: [buildPurchaseRow(this.scenario)] };
    }
    if (trimmed.includes("FROM auditoria_eventos") && trimmed.includes("PURCHASE_CREATED")) {
      if (
        this.scenario.invalidAuditContextUuid &&
        (trimmed.includes("NULLIF(ae.datos_despues->>'branchId', '')::uuid") ||
          trimmed.includes("NULLIF(ae.datos_despues->>'terminalId', '')::uuid"))
      ) {
        const error = new Error("invalid input syntax for type uuid: \"local-terminal\"");
        (error as Error & { code?: string }).code = "22P02";
        throw error;
      }

      return {
        rows: [
          {
            branch_id: this.scenario.invalidAuditContextUuid ? null : ids.branch,
            branch_name: this.scenario.invalidAuditContextUuid ? null : "Principal",
            terminal_id: null,
            terminal_name: null,
          },
        ],
      };
    }
    if (trimmed.includes("SELECT received_quantity") && trimmed.includes("FROM purchase_items")) {
      return { rows: [{ received_quantity: this.scenario.receivedQuantity ?? 0 }] };
    }
    if (trimmed.includes("FROM terminals")) {
      const terminalBranchId = this.scenario.terminalBranchId ?? ids.branch;
      if (
        terminalBranchId &&
        params[0] === ids.terminal &&
        params[1] === ids.tenant &&
        params[2] === terminalBranchId
      ) {
        return { rows: [{ id: ids.terminal, name: "Terminal QA" }] };
      }
      return { rows: [] };
    }
    if (trimmed.includes("FROM tenant_branches")) {
      return { rows: [{ id: params[0] }] };
    }
    if (trimmed.includes("requires_lot") && trimmed.includes("FROM products")) {
      const requestedProductIds = Array.isArray(params[1])
        ? (params[1] as string[])
        : this.purchaseItems.map((item) => item.productId);
      return {
        rows: requestedProductIds.map((productId) => ({
          id: productId,
          requires_lot: this.scenario.productRequiresLot ?? false,
          requires_expiration: this.scenario.productRequiresExpiration ?? false,
        })),
      };
    }
    if (trimmed.includes("FROM products")) {
      return { rows: [{ id: params[0] ?? ids.product }] };
    }
    if (trimmed.startsWith("INSERT INTO purchases")) {
      this.insertedPurchase = params;
      return {
        rows: [
          {
            id: params[0],
            tenant_id: params[1],
            supplier_id: params[2],
            cash_session_id: params[3],
            type: params[4],
            status: params[5],
            total: params[6],
            balance: params[7],
            payment_status: params[8],
            total_paid: params[9],
            balance_due: params[10],
            created_at: params[11],
          },
        ],
      };
    }
    if (trimmed.startsWith("DELETE FROM purchase_items")) {
      return { rows: [] };
    }
    if (trimmed.startsWith("INSERT INTO purchase_items")) {
      this.insertedItems.push(params);
      return { rows: [] };
    }
    if (trimmed.includes("FROM purchase_items")) {
      return { rows: this.buildPurchaseItemRows() };
    }
    if (trimmed.includes("FROM stock_movements")) {
      return { rows: this.scenario.hasMovement ? [{ id: "movement-1" }] : [] };
    }
    if (trimmed.includes("FROM payment_allocations")) {
      return { rows: [{ total_paid: this.scenario.totalPaid ?? 0 }] };
    }
    if (trimmed.startsWith("UPDATE purchases")) {
      if (trimmed.includes("motivo_liquidacion")) {
        const totalLiquidado = Number(params[3]);
        const totalPaid = Number(params[11] ?? 0);
        return {
          rows: [
            {
              ...buildPurchaseRow({
                ...this.scenario,
                status: "CERRADA_PARCIAL",
                paymentStatus:
                  totalPaid <= 0 ? "PENDING" : totalPaid < totalLiquidado ? "PARTIAL" : "PAID",
              }),
              total: totalLiquidado,
              balance: params[4],
              balance_due: params[4],
              total_paid: totalPaid,
              total_pedido: 100000,
              total_recibido: totalLiquidado,
              total_liquidado: totalLiquidado,
              total_no_recibido: params[6],
              motivo_liquidacion: params[7],
              liquidado_por: params[8],
              liquidado_en: params[9],
            },
          ],
        };
      }
      return {
        rows: [
          {
            ...buildPurchaseRow({
              ...this.scenario,
              status:
                typeof params[2] === "string" &&
                ["PARTIAL", "RECEIVED"].includes(params[2])
                  ? (params[2] as "PARTIAL" | "RECEIVED")
                  : "CANCELLED",
            }),
            motivo_cancelacion:
              typeof params[2] === "string" &&
              ["PARTIAL", "RECEIVED"].includes(params[2])
                ? null
                : params[2],
            cancelado_por:
              typeof params[2] === "string" &&
              ["PARTIAL", "RECEIVED"].includes(params[2])
                ? null
                : params[3],
            cancelado_en:
              typeof params[2] === "string" &&
              ["PARTIAL", "RECEIVED"].includes(params[2])
                ? null
                : params[4],
          },
        ],
      };
    }
    if (trimmed.startsWith("UPDATE purchase_items")) {
      const itemId = String(params[0]);
      const receivedDelta = Number(params[1] ?? 0);
      this.purchaseItems = this.purchaseItems.map((item) =>
        item.id === itemId
          ? { ...item, receivedQuantity: item.receivedQuantity + receivedDelta }
          : item
      );
      return { rows: [] };
    }
    if (trimmed.startsWith("INSERT INTO auditoria_eventos")) {
      return { rows: [] };
    }

    throw new Error(`Unexpected query: ${trimmed}`);
  }

  release() {
    this.released = true;
  }
}

class FakeDatabaseService {
  readonly client: FakeClient;
  readonly queries: string[] = [];
  readonly params: unknown[][] = [];

  constructor(scenario: Scenario = {}) {
    this.client = new FakeClient(scenario);
  }

  async getClient() {
    return this.client;
  }

  async query(text: string, params: unknown[] = []) {
    this.queries.push(text);
    this.params.push(params);
    if (text.includes("FROM cash_sessions")) {
      return {
        rows: this.client.scenario.currentCashSessionId
          ? [{ id: this.client.scenario.currentCashSessionId }]
          : [],
      };
    }
    if (this.client.scenario?.auditTerminalName !== undefined) {
      return {
        rows: [
          {
            ...buildPurchaseRow(this.client.scenario),
            tenant_name: "Tenant QA",
            supplier_name: "Proveedor QA",
            branch_id: ids.branch,
            branch_name: "Principal",
            terminal_id: ids.terminal,
            terminal_name: this.client.scenario.auditTerminalName,
          },
        ],
      };
    }
    return { rows: [] };
  }
}

class FakeStockMovementService {
  readonly movements: unknown[] = [];
  readonly audits: unknown[] = [];

  async createMovement(data: any) {
    const movement = {
      ...data,
      stockBefore: 0,
      stockAfter: Number(data.quantity),
    };
    this.movements.push(movement);
    return movement;
  }

  logMovementAuditEvent(movement: unknown) {
    this.audits.push(movement);
  }
}

class FakeInventoryLotService {
  readonly calls: unknown[] = [];
  createdCount = 0;
  reusedCount = 0;

  constructor(private readonly scenario: Scenario = {}) {}

  async findOrCreateForPurchase(input: any) {
    this.calls.push(input);

    const expirationDate = input.expirationDate ?? null;
    if (input.requiresExpiration && !expirationDate && !this.scenario.existingLotExpirationDate) {
      throw new BadRequestException("expirationDate is required for this product");
    }
    if (expirationDate && expirationDate < "2000-01-01") {
      throw new BadRequestException("expirationDate cannot be before 2000-01-01");
    }
    if (expirationDate && expirationDate < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException("ACTIVE lot cannot be expired");
    }
    if (
      this.scenario.existingLotStatus === "BLOCKED" ||
      this.scenario.existingLotStatus === "CANCELLED"
    ) {
      throw new BadRequestException("inventory lot cannot receive stock");
    }
    if (
      this.scenario.existingLotExpirationDate &&
      expirationDate &&
      this.scenario.existingLotExpirationDate !== expirationDate
    ) {
      throw new BadRequestException("expirationDate does not match existing lot");
    }

    if (this.scenario.existingLotStatus) {
      this.reusedCount += 1;
    } else {
      this.createdCount += 1;
    }
    return {
      id: ids.lot,
      tenantId: input.tenantId,
      branchId: input.branchId,
      productId: input.productId,
      lotCode: input.lotCode,
      expirationDate:
        this.scenario.existingLotExpirationDate ?? input.expirationDate ?? null,
      status: this.scenario.existingLotStatus ?? "ACTIVE",
    };
  }
}

class FakeInventoryLotBalanceService {
  readonly increments: unknown[] = [];

  constructor(private readonly scenario: Scenario = {}) {}

  async incrementOnHand(_tenantId: string, input: any) {
    if (this.scenario.locationBelongsToBranch === false) {
      throw new BadRequestException("locationId is invalid");
    }
    this.increments.push(input);
    return { id: "balance-1", ...input };
  }
}

class FakeStockMovementLotService {
  readonly links: unknown[] = [];

  async createLink(input: any) {
    this.links.push(input);
    return { id: "movement-lot-1", ...input };
  }
}

const buildService = (scenario: Scenario = {}) => {
  const db = new FakeDatabaseService(scenario);
  const stockMovementService = new FakeStockMovementService();
  const inventoryLotService = new FakeInventoryLotService(scenario);
  const inventoryLotBalanceService = new FakeInventoryLotBalanceService(scenario);
  const stockMovementLotService = new FakeStockMovementLotService();
  const auditEvents: unknown[] = [];
  const service = new PurchaseService(
    db as never,
    stockMovementService as never,
    inventoryLotService as never,
    inventoryLotBalanceService as never,
    stockMovementLotService as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {
      isModuleEnabled: () => true,
      logEvent: (event: unknown) => {
        auditEvents.push(event);
      },
    } as never
  );
  return {
    service,
    db,
    auditEvents,
    stockMovementService,
    inventoryLotService,
    inventoryLotBalanceService,
    stockMovementLotService,
  };
};

const createPurchasePayload = () => ({
  tenantId: ids.tenant,
  supplierId: ids.supplier,
  branchId: ids.branch,
  terminalId: ids.terminal,
  type: "CREDIT" as const,
  total: 100,
  items: [
    {
      productId: ids.product,
      quantity: 2,
      cost: 50,
      subtotal: 100,
    },
  ],
  actor,
});

test("PurchaseService.createPurchase: guarda terminal valida en audit payload y respuesta", async () => {
  const { service, db, auditEvents } = buildService();

  const result = await service.createPurchase(createPurchasePayload());

  assert.equal(result.branchId, ids.branch);
  assert.equal(result.terminalId, ids.terminal);
  assert.equal(result.terminalName, "Terminal QA");
  assert.equal(db.client.insertedPurchase?.[1], ids.tenant);
  assert.equal(db.client.insertedItems.length, 1);
  assert.equal((auditEvents[0] as any).after.terminalId, ids.terminal);
  assert.equal((auditEvents[0] as any).after.branchId, ids.branch);
});

test("PurchaseService.createPurchase: usa terminal desde contexto operativo cuando no viene en payload", async () => {
  const { service, db, auditEvents } = buildService();

  const result = await service.createPurchase({
    ...createPurchasePayload(),
    terminalId: undefined,
    context: {
      tenantId: ids.tenant,
      branchId: ids.branch,
      terminalId: ids.terminal,
      userId: ids.user,
      cashSessionId: ids.cashSession,
    },
  });

  assert.equal(result.terminalId, ids.terminal);
  assert.equal(result.cashSessionId, ids.cashSession);
  assert.equal(db.client.insertedPurchase?.[3], ids.cashSession);
  assert.equal((auditEvents[0] as any).after.terminalId, ids.terminal);
  assert.equal((auditEvents[0] as any).after.cashSessionId, ids.cashSession);
});

test("PurchaseService.createPurchase: rechaza compra sin terminal resoluble", async () => {
  const { service, db } = buildService();

  await assert.rejects(
    () =>
      service.createPurchase({
        ...createPurchasePayload(),
        terminalId: undefined,
      }),
    /No hay terminal activa para registrar la compra/
  );

  assert.equal(db.client.insertedPurchase, null);
  assert.equal(db.client.queries.length, 0);
});

test("PurchaseService.createPurchase: rechaza terminal de otra sucursal", async () => {
  const { service, db } = buildService({ terminalBranchId: ids.otherBranch });

  await assert.rejects(
    () => service.createPurchase(createPurchasePayload()),
    BadRequestException
  );

  assert.equal(db.client.insertedPurchase, null);
  assert.equal(db.client.queries.includes("ROLLBACK"), true);
});

test("PurchaseService.getPurchases: devuelve terminalName cuando audit trae terminal valida", async () => {
  const { service } = buildService({ auditTerminalName: "Terminal QA" });

  const result = await service.getPurchases({ tenantId: ids.tenant, cashScope: "all" }, actor);

  assert.equal(result[0].terminalId, ids.terminal);
  assert.equal(result[0].terminalName, "Terminal QA");
});

test("PurchaseService.getPurchases: current scope filtra por caja actual", async () => {
  const { service, db } = buildService({
    currentCashSessionId: ids.cashSession,
  });

  await service.getPurchases({ tenantId: ids.tenant, cashScope: "current" }, actor);

  const listQuery = db.queries.find((query) => query.includes("FROM purchases p"));
  assert.ok(listQuery);
  assert.match(listQuery, /p\.cash_session_id = \$2::uuid/);
  assert.deepEqual(db.params[db.params.length - 1], [ids.tenant, ids.cashSession]);
});

test("PurchaseService.cancelPurchase: cancela compra en estado permitido y registra historial", async () => {
  const { service, db } = buildService({ status: "PENDING" });

  const result = await service.cancelPurchase(ids.purchase, ids.tenant, {
    motivoCancelacion: "Proveedor no entrega",
    actor,
    context: { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.estado, "CANCELLED");
  assert.equal(result.data.motivoCancelacion, "Proveedor no entrega");
  assert.ok(db.client.queries.some((query) => query.startsWith("UPDATE purchases")));
  assert.ok(db.client.queries.some((query) => query.startsWith("INSERT INTO auditoria_eventos")));
  assert.ok(db.client.queries.includes("COMMIT"));
});

test("PurchaseService.cancelPurchase: rechaza compra recibida", async () => {
  const { service } = buildService({ status: "RECEIVED" });

  await assert.rejects(
    () =>
      service.cancelPurchase(ids.purchase, ids.tenant, {
        motivoCancelacion: "Proveedor no entrega",
        actor,
      }),
    BadRequestException
  );
});

test("PurchaseService.cancelPurchase: rechaza compra no cancelable equivalente a cerrada", async () => {
  const { service } = buildService({ status: "PARTIAL" });

  await assert.rejects(
    () =>
      service.cancelPurchase(ids.purchase, ids.tenant, {
        motivoCancelacion: "Proveedor no entrega",
        actor,
      }),
    BadRequestException
  );
});

test("PurchaseService.cancelPurchase: rechaza compra pagada totalmente", async () => {
  const { service } = buildService({
    status: "PENDING",
    paymentStatus: "PAID",
    totalPaid: 100,
  });

  await assert.rejects(
    () =>
      service.cancelPurchase(ids.purchase, ids.tenant, {
        motivoCancelacion: "Proveedor no entrega",
        actor,
      }),
    ConflictException
  );
});

test("PurchaseService.cancelPurchase: rechaza compra ya cancelada", async () => {
  const { service } = buildService({ status: "CANCELLED" });

  await assert.rejects(
    () =>
      service.cancelPurchase(ids.purchase, ids.tenant, {
        motivoCancelacion: "Proveedor no entrega",
        actor,
      }),
    ConflictException
  );
});

test("PurchaseService.cancelPurchase: rechaza motivo vacio", async () => {
  const { service, db } = buildService({ status: "PENDING" });

  await assert.rejects(
    () =>
      service.cancelPurchase(ids.purchase, ids.tenant, {
        motivoCancelacion: "   ",
        actor,
      }),
    BadRequestException
  );
  assert.equal(db.client.queries.length, 0);
});

test("PurchaseService.cancelPurchase: respeta tenant_id", async () => {
  const { service } = buildService({ tenantMatches: false });

  await assert.rejects(
    () =>
      service.cancelPurchase(ids.purchase, ids.tenant, {
        motivoCancelacion: "Proveedor no entrega",
        actor,
      }),
    NotFoundException
  );
});

test("PurchaseService.cancelPurchase: bloquea si hay movimiento de inventario", async () => {
  const { service } = buildService({ status: "PENDING", hasMovement: true });

  await assert.rejects(
    () =>
      service.cancelPurchase(ids.purchase, ids.tenant, {
        motivoCancelacion: "Proveedor no entrega",
        actor,
      }),
    ConflictException
  );
});

test("PurchaseService.settlePartialPurchase: liquida compra parcial pendiente de pago", async () => {
  const { service, db } = buildService({
    status: "PARTIAL",
    itemReceivedQuantity: 7,
    itemCost: 10000,
  });

  const result = await service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
    motivoLiquidacion: "Proveedor no enviara saldo",
    actor,
    context: { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.estado, "CERRADA_PARCIAL");
  assert.equal(result.data.totalLiquidado, 70000);
  assert.equal(result.data.diferenciaNoRecibida, 30000);
  assert.equal(result.data.totalPagado, 0);
  assert.equal(result.data.saldoPendiente, 70000);
  assert.equal(result.data.paymentStatus, "PENDING");
  assert.ok(db.client.params.some((params) => params.includes("PURCHASE_PARTIAL_CLOSED")));
  assert.equal(
    db.client.queries.some((query) => query.startsWith("INSERT INTO stock_movements")),
    false
  );
});

test("PurchaseService.settlePartialPurchase: tolera audit context con terminalId no UUID", async () => {
  const { service, db } = buildService({
    status: "PARTIAL",
    itemReceivedQuantity: 1,
    itemCost: 9000,
    invalidAuditContextUuid: true,
  });

  const result = await service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
    motivoLiquidacion: "Proveedor no enviara saldo",
    actor,
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.data.estado, "CERRADA_PARCIAL");
  assert.equal(result.data.totalLiquidado, 9000);
  assert.equal(
    db.client.queries.some((query) =>
      query.includes("NULLIF(ae.datos_despues->>'terminalId', '')::uuid")
    ),
    false
  );
});

test("PurchaseService.settlePartialPurchase: permite pago parcial menor al total liquidado", async () => {
  const { service } = buildService({
    status: "PARTIAL",
    paymentStatus: "PARTIAL",
    totalPaid: 40000,
    itemReceivedQuantity: 7,
    itemCost: 10000,
  });

  const result = await service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
    motivoLiquidacion: "Proveedor no enviara saldo",
    actor,
  });

  assert.equal(result.data.estado, "CERRADA_PARCIAL");
  assert.equal(result.data.balanceDue, 30000);
  assert.equal(result.data.paymentStatus, "PARTIAL");
});

test("PurchaseService.settlePartialPurchase: calcula total liquidado desde items en base de datos", async () => {
  const { service } = buildService({
    status: "PARTIAL",
    itemReceivedQuantity: 3,
    itemCost: 1234.56,
  });

  const result = await service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
    motivoLiquidacion: "Proveedor no enviara saldo",
    actor,
  });

  assert.equal(result.data.totalLiquidado, 3703.68);
  assert.equal(result.data.diferenciaNoRecibida, 8641.92);
  assert.equal(result.data.saldoPendiente, 3703.68);
});

test("PurchaseService.settlePartialPurchase: marca pago completo si pago iguala total liquidado", async () => {
  const { service } = buildService({
    status: "PARTIAL",
    paymentStatus: "PAID",
    totalPaid: 70000,
    itemReceivedQuantity: 7,
    itemCost: 10000,
  });

  const result = await service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
    motivoLiquidacion: "Proveedor no enviara saldo",
    actor,
  });

  assert.equal(result.data.estado, "CERRADA_PARCIAL");
  assert.equal(result.data.totalLiquidado, 70000);
  assert.equal(result.data.totalPagado, 70000);
  assert.equal(result.data.saldoPendiente, 0);
  assert.equal(result.data.balanceDue, 0);
  assert.equal(result.data.paymentStatus, "PAID");
});

test("PurchaseService.settlePartialPurchase: bloquea pago mayor al total liquidado", async () => {
  const { service } = buildService({
    status: "PARTIAL",
    paymentStatus: "PARTIAL",
    totalPaid: 90000,
    itemReceivedQuantity: 7,
    itemCost: 10000,
  });

  await assert.rejects(
    () =>
      service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
        motivoLiquidacion: "Proveedor no enviara saldo",
        actor,
      }),
    /pagos registrados superan el valor recibido/
  );
});

test("PurchaseService.settlePartialPurchase: rechaza compra recibida completa", async () => {
  const { service } = buildService({ status: "RECEIVED" });

  await assert.rejects(
    () =>
      service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
        motivoLiquidacion: "Proveedor no enviara saldo",
        actor,
      }),
    BadRequestException
  );
});

test("PurchaseService.settlePartialPurchase: rechaza compra cancelada", async () => {
  const { service } = buildService({ status: "CANCELLED" });

  await assert.rejects(
    () =>
      service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
        motivoLiquidacion: "Proveedor no enviara saldo",
        actor,
      }),
    BadRequestException
  );
});

test("PurchaseService.settlePartialPurchase: rechaza compra ya cerrada parcialmente", async () => {
  const { service } = buildService({ status: "CERRADA_PARCIAL" });

  await assert.rejects(
    () =>
      service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
        motivoLiquidacion: "Proveedor no enviara saldo",
        actor,
      }),
    ConflictException
  );
});

test("PurchaseService.settlePartialPurchase: rechaza compra sin cantidades recibidas", async () => {
  const { service } = buildService({
    status: "PARTIAL",
    itemReceivedQuantity: 0,
  });

  await assert.rejects(
    () =>
      service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
        motivoLiquidacion: "Proveedor no enviara saldo",
        actor,
      }),
    BadRequestException
  );
});

test("PurchaseService.settlePartialPurchase: rechaza motivo vacio", async () => {
  const { service } = buildService({ status: "PARTIAL" });

  await assert.rejects(
    () =>
      service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
        motivoLiquidacion: "   ",
        actor,
      }),
    BadRequestException
  );
});

test("PurchaseService.settlePartialPurchase: respeta tenant_id", async () => {
  const { service } = buildService({
    status: "PARTIAL",
    tenantMatches: false,
  });

  await assert.rejects(
    () =>
      service.settlePartialPurchase(ids.purchase, ids.tenant, ids.user, {
        motivoLiquidacion: "Proveedor no enviara saldo",
        actor,
      }),
    NotFoundException
  );
});

test("PurchaseService.receivePurchase: producto no loteado recibe compra como antes", async () => {
  const { service, stockMovementService, inventoryLotService } = buildService({
    status: "PENDING",
  });

  const result = await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [{ productId: ids.product, quantity: 2 }],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(result.status, "PARTIAL");
  assert.equal(stockMovementService.movements.length, 1);
  assert.equal(inventoryLotService.calls.length, 0);
});

test("PurchaseService.receivePurchase: producto no loteado rechaza datos de lote", async () => {
  const { service } = buildService({ status: "PENDING" });

  await assert.rejects(
    () =>
      service.receivePurchase(
        ids.purchase,
        ids.tenant,
        [{ productId: ids.product, quantity: 2, lotCode: "L-1" }],
        { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
        actor
      ),
    /lot data is not allowed/
  );
});

test("PurchaseService.receivePurchase: producto loteado exige lotCode", async () => {
  const { service } = buildService({
    status: "PENDING",
    productRequiresLot: true,
  });

  await assert.rejects(
    () =>
      service.receivePurchase(
        ids.purchase,
        ids.tenant,
        [{ productId: ids.product, quantity: 2 }],
        { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
        actor
      ),
    /lotCode is required/
  );
});

test("PurchaseService.receivePurchase: producto con vencimiento exige expirationDate", async () => {
  const { service } = buildService({
    status: "PENDING",
    productRequiresLot: true,
    productRequiresExpiration: true,
  });

  await assert.rejects(
    () =>
      service.receivePurchase(
        ids.purchase,
        ids.tenant,
        [{ productId: ids.product, quantity: 2, lotCode: "L-1" }],
        { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
        actor
      ),
    /expirationDate is required/
  );
});

test("PurchaseService.receivePurchase: producto loteado crea inventory_lot nuevo", async () => {
  const { service, inventoryLotService } = buildService({
    status: "PENDING",
    productRequiresLot: true,
  });

  await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [{ productId: ids.product, quantity: 2, lotCode: " l-2026-001 " }],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(inventoryLotService.createdCount, 1);
  assert.equal((inventoryLotService.calls[0] as any).lotCode, "L-2026-001");
});

test("PurchaseService.receivePurchase: producto loteado reutiliza inventory_lot existente valido", async () => {
  const { service, inventoryLotService } = buildService({
    status: "PENDING",
    productRequiresLot: true,
    existingLotStatus: "ACTIVE",
  });

  await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [{ productId: ids.product, quantity: 2, lotCode: "L-2026-001" }],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(inventoryLotService.reusedCount, 1);
  assert.equal(inventoryLotService.createdCount, 0);
});

test("PurchaseService.receivePurchase: producto loteado rechaza lote bloqueado o cancelado", async () => {
  for (const existingLotStatus of ["BLOCKED", "CANCELLED"] as const) {
    const { service } = buildService({
      status: "PENDING",
      productRequiresLot: true,
      existingLotStatus,
    });

    await assert.rejects(
      () =>
        service.receivePurchase(
          ids.purchase,
          ids.tenant,
          [{ productId: ids.product, quantity: 2, lotCode: "L-2026-001" }],
          { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
          actor
        ),
      /inventory lot cannot receive stock/
    );
  }
});

test("PurchaseService.receivePurchase: producto con vencimiento rechaza expirationDate vencida", async () => {
  const { service } = buildService({
    status: "PENDING",
    productRequiresLot: true,
    productRequiresExpiration: true,
  });

  await assert.rejects(
    () =>
      service.receivePurchase(
        ids.purchase,
        ids.tenant,
        [
          {
            productId: ids.product,
            quantity: 2,
            lotCode: "L-2026-001",
            expirationDate: "2000-01-02",
          },
        ],
        { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
        actor
      ),
    /ACTIVE lot cannot be expired/
  );
});

test("PurchaseService.receivePurchase: producto con vencimiento rechaza expirationDate distinta para lote existente", async () => {
  const { service } = buildService({
    status: "PENDING",
    productRequiresLot: true,
    productRequiresExpiration: true,
    existingLotStatus: "ACTIVE",
    existingLotExpirationDate: "2026-12-31",
  });

  await assert.rejects(
    () =>
      service.receivePurchase(
        ids.purchase,
        ids.tenant,
        [
          {
            productId: ids.product,
            quantity: 2,
            lotCode: "L-2026-001",
            expirationDate: "2027-01-31",
          },
        ],
        { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
        actor
      ),
    /expirationDate does not match existing lot/
  );
});

test("PurchaseService.receivePurchase: recepcion loteada incrementa balances", async () => {
  const { service, inventoryLotBalanceService } = buildService({
    status: "PENDING",
    productRequiresLot: true,
  });

  await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [
      {
        productId: ids.product,
        quantity: 2,
        lotCode: "L-2026-001",
        locationId: ids.location,
      },
    ],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(inventoryLotBalanceService.increments.length, 1);
  assert.equal((inventoryLotBalanceService.increments[0] as any).quantity, 2);
  assert.equal(
    (inventoryLotBalanceService.increments[0] as any).locationId,
    ids.location
  );
});

test("PurchaseService.receivePurchase: recepcion loteada crea stock_movement_lots con movementId correcto", async () => {
  const { service, stockMovementService, stockMovementLotService } = buildService({
    status: "PENDING",
    productRequiresLot: true,
  });

  await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [{ productId: ids.product, quantity: 2, lotCode: "L-2026-001" }],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(stockMovementLotService.links.length, 1);
  assert.equal(
    (stockMovementLotService.links[0] as any).stockMovementId,
    (stockMovementService.movements[0] as any).id
  );
  assert.equal((stockMovementLotService.links[0] as any).quantity, 2);
});

test("PurchaseService.receivePurchase: compra parcial crea lote y balance solo por cantidad recibida", async () => {
  const { service, inventoryLotBalanceService } = buildService({
    status: "PENDING",
    itemReceivedQuantity: 0,
    productRequiresLot: true,
  });

  await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [
      {
        purchaseItemId: ids.purchaseItem,
        receivedQuantity: 4,
        quantity: 4,
        lotCode: "L-PARCIAL",
      } as any,
    ],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(inventoryLotBalanceService.increments.length, 1);
  assert.equal((inventoryLotBalanceService.increments[0] as any).quantity, 4);
});

test("PurchaseService.receivePurchase: permite recibir una linea y dejar otra pendiente", async () => {
  const { service, stockMovementService } = buildService({
    status: "PENDING",
    purchaseItems: [
      {
        id: ids.purchaseItem,
        productId: ids.product,
        orderedQuantity: 15,
        receivedQuantity: 0,
        cost: 1000,
        subtotal: 15000,
      },
      {
        id: ids.purchaseItem2,
        productId: ids.product2,
        orderedQuantity: 20,
        receivedQuantity: 0,
        cost: 2000,
        subtotal: 40000,
      },
    ],
  });

  const result = await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [
      {
        purchaseItemId: ids.purchaseItem,
        productId: ids.product,
        quantity: 15,
      },
    ],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(result.status, "PARTIAL");
  assert.equal(stockMovementService.movements.length, 1);
  assert.equal(result.items[0].receivedQuantity, 15);
  assert.equal(result.items[1].receivedQuantity, 0);
});

test("PurchaseService.receivePurchase: no reprocesa linea ya recibida y completa pendientes", async () => {
  const { service, stockMovementService } = buildService({
    status: "PARTIAL",
    purchaseItems: [
      {
        id: ids.purchaseItem,
        productId: ids.product,
        orderedQuantity: 15,
        receivedQuantity: 15,
        cost: 1000,
        subtotal: 15000,
      },
      {
        id: ids.purchaseItem2,
        productId: ids.product2,
        orderedQuantity: 15,
        receivedQuantity: 0,
        cost: 2000,
        subtotal: 30000,
      },
    ],
  });

  const result = await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [
      {
        purchaseItemId: ids.purchaseItem2,
        productId: ids.product2,
        quantity: 15,
      },
    ],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(result.status, "RECEIVED");
  assert.equal(stockMovementService.movements.length, 1);
  assert.equal(result.items[0].receivedQuantity, 15);
  assert.equal(result.items[1].receivedQuantity, 15);
});

test("PurchaseService.receivePurchase: rechaza cantidad mayor al pendiente", async () => {
  const { service, db } = buildService({
    status: "PARTIAL",
    purchaseItems: [
      {
        id: ids.purchaseItem,
        productId: ids.product,
        orderedQuantity: 15,
        receivedQuantity: 12,
        cost: 1000,
        subtotal: 15000,
      },
    ],
  });

  await assert.rejects(
    () =>
      service.receivePurchase(
        ids.purchase,
        ids.tenant,
        [
          {
            purchaseItemId: ids.purchaseItem,
            productId: ids.product,
            quantity: 4,
          },
        ],
        { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
        actor
      ),
    /received quantity exceeds pending ordered quantity/
  );

  assert.equal(
    db.client.queries.some((query) => query.startsWith("UPDATE purchase_items")),
    false
  );
});

test("PurchaseService.receivePurchase: locationId de otra sucursal se rechaza", async () => {
  const { service } = buildService({
    status: "PENDING",
    productRequiresLot: true,
    locationBelongsToBranch: false,
  });

  await assert.rejects(
    () =>
      service.receivePurchase(
        ids.purchase,
        ids.tenant,
        [
          {
            productId: ids.product,
            quantity: 2,
            lotCode: "L-2026-001",
            locationId: ids.location,
          },
        ],
        { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
        actor
      ),
    /locationId is invalid/
  );
});

test("PurchaseService.receivePurchase: no crea stock_movement_lots para producto no loteado", async () => {
  const { service, stockMovementLotService } = buildService({
    status: "PENDING",
  });

  await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [{ productId: ids.product, quantity: 2 }],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(stockMovementLotService.links.length, 0);
});

test("PurchaseService.receivePurchase: no toca flujo de pagos o caja", async () => {
  const { service, db } = buildService({
    status: "PENDING",
  });

  await service.receivePurchase(
    ids.purchase,
    ids.tenant,
    [{ productId: ids.product, quantity: 2 }],
    { tenantId: ids.tenant, userId: ids.user, branchId: ids.branch },
    actor
  );

  assert.equal(
    db.client.queries.some((query) => query.includes("payment_allocations")),
    false
  );
});

test("PurchaseService.getPurchaseById mapping: expone flags operativos del producto", () => {
  const service = new PurchaseService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );

  const detail = (service as any).mapPurchaseWithItems(buildPurchaseRow(), [
    {
      id: ids.purchaseItem,
      purchase_id: ids.purchase,
      product_id: ids.product,
      product_name: "Producto loteado",
      product_sku: "LOT-001",
      is_perishable: true,
      requires_lot: true,
      requires_expiration: true,
      ordered_quantity: 10,
      received_quantity: 0,
      cost: 1000,
      subtotal: 10000,
    },
  ]);

  assert.equal(detail.items[0].productSku, "LOT-001");
  assert.equal(detail.items[0].isPerishable, true);
  assert.equal(detail.items[0].requiresLot, true);
  assert.equal(detail.items[0].requiresExpiration, true);
});
