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
  user: "40000000-0000-0000-0000-000000000001",
};

type Scenario = {
  status?: "DRAFT" | "PENDING" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  paymentStatus?: "PENDING" | "PARTIAL" | "PAID" | "OVERPAID";
  totalPaid?: number;
  receivedQuantity?: number;
  hasMovement?: boolean;
  tenantMatches?: boolean;
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
  released = false;

  constructor(private readonly scenario: Scenario = {}) {}

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
      return {
        rows: [
          {
            branch_id: ids.branch,
            branch_name: "Principal",
            terminal_id: null,
            terminal_name: null,
          },
        ],
      };
    }
    if (trimmed.includes("FROM purchase_items")) {
      return { rows: [{ received_quantity: this.scenario.receivedQuantity ?? 0 }] };
    }
    if (trimmed.includes("FROM stock_movements")) {
      return { rows: this.scenario.hasMovement ? [{ id: "movement-1" }] : [] };
    }
    if (trimmed.startsWith("UPDATE purchases")) {
      return {
        rows: [
          {
            ...buildPurchaseRow({ ...this.scenario, status: "CANCELLED" }),
            motivo_cancelacion: params[2],
            cancelado_por: params[3],
            cancelado_en: params[4],
          },
        ],
      };
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

  constructor(scenario: Scenario = {}) {
    this.client = new FakeClient(scenario);
  }

  async getClient() {
    return this.client;
  }

  async query() {
    return { rows: [] };
  }
}

const buildService = (scenario: Scenario = {}) => {
  const db = new FakeDatabaseService(scenario);
  const service = new PurchaseService(
    db as never,
    {} as never,
    { findAccessibleBranchIds: async () => [] } as never,
    { isModuleEnabled: () => true, logEvent: () => undefined } as never
  );
  return { service, db };
};

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
