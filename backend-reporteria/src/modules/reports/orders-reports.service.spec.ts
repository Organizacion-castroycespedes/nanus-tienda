import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { OrdersReportsService } from "./orders-reports.service";
import { OrdersReportAdapter } from "./sql-adapters/orders-report.adapter";
import type {
  OrderSaleTicketDataset,
  ReportActorContext,
} from "./types/orders-report.types";

const USER_ID = "40000000-0000-0000-0000-000000000001";
const ADMIN_ID = "40000000-0000-0000-0000-000000000002";
const SUPER_USER_ID = "40000000-0000-0000-0000-000000000003";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_TENANT_ID = "00000000-0000-0000-0000-000000000002";
const BRANCH_ID = "30000000-0000-0000-0000-000000000001";
const OTHER_BRANCH_ID = "30000000-0000-0000-0000-000000000002";
const ORDER_ID = "70000000-0000-0000-0000-000000000001";
const OTHER_TENANT_ORDER_ID = "70000000-0000-0000-0000-000000000002";
const OTHER_BRANCH_ORDER_ID = "70000000-0000-0000-0000-000000000003";

type TicketCall = {
  actor: ReportActorContext;
  orderId: string;
};

class FakeOrdersReportAdapter {
  readonly ticketCalls: TicketCall[] = [];

  constructor(
    private readonly tickets: Map<string, OrderSaleTicketDataset | null>,
    private readonly existingOrders = new Set<string>()
  ) {}

  async getOrderSaleTicket(actor: ReportActorContext, orderId: string) {
    this.ticketCalls.push({ actor, orderId });
    return this.tickets.get(orderId) ?? null;
  }

  async orderSaleExists(orderId: string) {
    return this.existingOrders.has(orderId);
  }
}

const ticketDataset = (orderId = ORDER_ID) =>
  ({
    orderId,
    tenantName: "Tenant autorizado",
    branchId: BRANCH_ID,
    branchName: "Sucursal autorizada",
    customerName: "Cliente Demo",
    status: "CONFIRMED",
    paymentStatus: "PENDING",
    createdAt: "2026-06-13T12:00:00.000Z",
    generatedSales: [],
    items: [],
    payments: [],
    totals: {
      total: "100.50",
      paid: "25.25",
      balance: "75.25",
    },
  }) as unknown as OrderSaleTicketDataset;

const user = (roles: string[], overrides: Partial<ReportUser> = {}): ReportUser => ({
  id: USER_ID,
  tenantId: TENANT_ID,
  branchId: BRANCH_ID,
  roles,
  email: "user@example.test",
  ...overrides,
});

const buildService = (adapter: FakeOrdersReportAdapter) =>
  new OrdersReportsService(
    adapter as unknown as OrdersReportAdapter,
    {
      generatePdf: async () => Buffer.from("pdf"),
    } as never
  );

test("OrdersReportsService.getOrderSaleTicket: USER autorizado pasa", async () => {
  const adapter = new FakeOrdersReportAdapter(
    new Map([[ORDER_ID, ticketDataset()]]),
    new Set([ORDER_ID])
  );
  const service = buildService(adapter);

  const result = await service.getOrderSaleTicket(ORDER_ID, user(["USER"]));

  assert.equal(result.orderId, ORDER_ID);
  assert.equal(result.totals.total, 100.5);
  assert.equal(adapter.ticketCalls[0].actor.role, "USER");
  assert.equal(adapter.ticketCalls[0].actor.tenantId, TENANT_ID);
  assert.equal(adapter.ticketCalls[0].actor.branchId, BRANCH_ID);
});

test("OrdersReportsService.getOrderSaleTicket: USER otro tenant recibe FORBIDDEN", async () => {
  const adapter = new FakeOrdersReportAdapter(new Map(), new Set([OTHER_TENANT_ORDER_ID]));
  const service = buildService(adapter);

  await assert.rejects(
    () =>
      service.getOrderSaleTicket(
        OTHER_TENANT_ORDER_ID,
        user(["USER"], { tenantId: OTHER_TENANT_ID })
      ),
    ForbiddenException
  );
});

test("OrdersReportsService.getOrderSaleTicket: USER sucursal no autorizada recibe FORBIDDEN", async () => {
  const adapter = new FakeOrdersReportAdapter(new Map(), new Set([OTHER_BRANCH_ORDER_ID]));
  const service = buildService(adapter);

  await assert.rejects(
    () =>
      service.getOrderSaleTicket(
        OTHER_BRANCH_ORDER_ID,
        user(["USER"], { branchId: OTHER_BRANCH_ID })
      ),
    ForbiddenException
  );
});

test("OrdersReportsService.getOrderSaleTicket: ADMIN autorizado pasa", async () => {
  const adapter = new FakeOrdersReportAdapter(
    new Map([[ORDER_ID, ticketDataset()]]),
    new Set([ORDER_ID])
  );
  const service = buildService(adapter);

  const result = await service.getOrderSaleTicket(
    ORDER_ID,
    user(["ADMIN"], { id: ADMIN_ID })
  );

  assert.equal(result.orderId, ORDER_ID);
  assert.equal(adapter.ticketCalls[0].actor.role, "ADMIN");
});

test("OrdersReportsService.getOrderSaleTicket: SUPER_USER tenant autorizado pasa", async () => {
  const adapter = new FakeOrdersReportAdapter(
    new Map([[ORDER_ID, ticketDataset()]]),
    new Set([ORDER_ID])
  );
  const service = buildService(adapter);

  const result = await service.getOrderSaleTicket(
    ORDER_ID,
    user(["SUPER_USER"], { id: SUPER_USER_ID, branchId: null })
  );

  assert.equal(result.orderId, ORDER_ID);
  assert.equal(adapter.ticketCalls[0].actor.role, "SUPER_USER");
  assert.equal(adapter.ticketCalls[0].actor.tenantId, TENANT_ID);
});
