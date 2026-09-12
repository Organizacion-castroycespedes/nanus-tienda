import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { ReportUser } from "../auth/report-auth.types";
import { SalesReportsService } from "./sales-reports.service";
import { SalesReportAdapter } from "./sql-adapters/sales-report.adapter";
import type {
  PosSaleTicketDataset,
  ReportActorContext,
} from "./types/sales-report.types";

const USER_ID = "40000000-0000-0000-0000-000000000001";
const ADMIN_ID = "40000000-0000-0000-0000-000000000002";
const SUPER_USER_ID = "40000000-0000-0000-0000-000000000003";
const SUPER_ADMIN_ID = "40000000-0000-0000-0000-000000000004";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_TENANT_ID = "00000000-0000-0000-0000-000000000002";
const BRANCH_ID = "30000000-0000-0000-0000-000000000001";
const OTHER_BRANCH_ID = "30000000-0000-0000-0000-000000000002";
const SALE_ID = "70000000-0000-0000-0000-000000000001";
const OTHER_TENANT_SALE_ID = "70000000-0000-0000-0000-000000000002";
const OTHER_BRANCH_SALE_ID = "70000000-0000-0000-0000-000000000003";

type TicketCall = {
  actor: ReportActorContext;
  saleId: string;
};

type TaxBreakdownRow = {
  label: string | null;
  dianCode: string | null;
  taxTypeCode: string | null;
  taxBase: string | number | null;
  taxAmount: string | number | null;
};

class FakeSalesReportAdapter {
  readonly ticketCalls: TicketCall[] = [];

  constructor(
    private readonly tickets: Map<string, PosSaleTicketDataset | null>,
    private readonly existingSales = new Set<string>()
  ) {}

  async getSaleTicket(actor: ReportActorContext, saleId: string) {
    this.ticketCalls.push({ actor, saleId });
    return this.tickets.get(saleId) ?? null;
  }

  async saleExists(saleId: string) {
    return this.existingSales.has(saleId);
  }
}

const ticketDataset = (saleId = SALE_ID) =>
  ({
    header: {
      saleId,
      date: "2026-06-15T12:00:00.000Z",
      tenantName: "Tenant autorizado",
      branch: "Sucursal autorizada",
      branchId: BRANCH_ID,
      terminal: "Terminal autorizada",
      terminalId: "50000000-0000-0000-0000-000000000001",
      cashier: "Caja QA",
      cashierId: USER_ID,
      customer: "Cliente Demo",
      customerId: "60000000-0000-0000-0000-000000000001",
      status: "CONFIRMED",
      paymentStatus: "PAID",
    },
    items: [],
    payments: [],
    paymentBreakdown: [],
    totals: {
      subtotal: "100.50",
      taxes: "0",
      total: "100.50",
      paid: "100.50",
      change: "0",
      balance: "0",
    },
    cashContext: {
      cashSession: "80000000-0000-0000-0000-000000000001",
      cashRegister: "Caja autorizada",
      openedAt: "2026-06-15T10:00:00.000Z",
    },
  }) as unknown as PosSaleTicketDataset;

const user = (roles: string[], overrides: Partial<ReportUser> = {}): ReportUser => ({
  id: USER_ID,
  tenantId: TENANT_ID,
  branchId: BRANCH_ID,
  roles,
  email: "qa.local@example.test",
  ...overrides,
});

const buildService = (
  adapter: FakeSalesReportAdapter,
  taxBreakdown: TaxBreakdownRow[] = []
) =>
  new SalesReportsService(
    adapter as unknown as SalesReportAdapter,
    {
      query: async () => ({ rows: taxBreakdown }),
    } as never,
    {
      generatePdf: async () => Buffer.from("pdf"),
    } as never
  );

test("SalesReportsService.getSaleTicket: USER autorizado pasa", async () => {
  const taxBreakdown: TaxBreakdownRow[] = [
    {
      label: "IVA 19%",
      dianCode: "01",
      taxTypeCode: "VAT",
      taxBase: "84.45",
      taxAmount: "16.05",
    },
  ];
  const adapter = new FakeSalesReportAdapter(
    new Map([[SALE_ID, ticketDataset()]]),
    new Set([SALE_ID])
  );
  const service = buildService(adapter, taxBreakdown);

  const result = await service.getSaleTicket(SALE_ID, user(["USER"]));

  assert.equal(result.header.saleId, SALE_ID);
  assert.equal(result.totals.total, 100.5);
  assert.deepEqual(result.totals.taxBreakdown, [
    {
      label: "IVA 19%",
      dianCode: "01",
      taxTypeCode: "VAT",
      taxBase: 84.45,
      taxAmount: 16.05,
    },
  ]);
  assert.equal(adapter.ticketCalls[0].actor.role, "USER");
  assert.equal(adapter.ticketCalls[0].actor.tenantId, TENANT_ID);
  assert.equal(adapter.ticketCalls[0].actor.branchId, BRANCH_ID);
});

test("SalesReportsService.getSaleTicket: USER otro tenant recibe FORBIDDEN", async () => {
  const adapter = new FakeSalesReportAdapter(new Map(), new Set([OTHER_TENANT_SALE_ID]));
  const service = buildService(adapter);

  await assert.rejects(
    () =>
      service.getSaleTicket(
        OTHER_TENANT_SALE_ID,
        user(["USER"], { tenantId: OTHER_TENANT_ID })
      ),
    ForbiddenException
  );
});

test("SalesReportsService.getSaleTicket: USER sucursal no autorizada recibe FORBIDDEN", async () => {
  const adapter = new FakeSalesReportAdapter(new Map(), new Set([OTHER_BRANCH_SALE_ID]));
  const service = buildService(adapter);

  await assert.rejects(
    () =>
      service.getSaleTicket(
        OTHER_BRANCH_SALE_ID,
        user(["USER"], { branchId: OTHER_BRANCH_ID })
      ),
    ForbiddenException
  );
});

test("SalesReportsService.getSaleTicket: ADMIN autorizado pasa", async () => {
  const adapter = new FakeSalesReportAdapter(
    new Map([[SALE_ID, ticketDataset()]]),
    new Set([SALE_ID])
  );
  const service = buildService(adapter);

  const result = await service.getSaleTicket(
    SALE_ID,
    user(["ADMIN"], { id: ADMIN_ID })
  );

  assert.equal(result.header.saleId, SALE_ID);
  assert.equal(adapter.ticketCalls[0].actor.role, "ADMIN");
});

test("SalesReportsService.getSaleTicket: SUPER_USER tenant autorizado pasa", async () => {
  const adapter = new FakeSalesReportAdapter(
    new Map([[SALE_ID, ticketDataset()]]),
    new Set([SALE_ID])
  );
  const service = buildService(adapter);

  const result = await service.getSaleTicket(
    SALE_ID,
    user(["SUPER_USER"], { id: SUPER_USER_ID, branchId: null })
  );

  assert.equal(result.header.saleId, SALE_ID);
  assert.equal(adapter.ticketCalls[0].actor.role, "SUPER_USER");
  assert.equal(adapter.ticketCalls[0].actor.tenantId, TENANT_ID);
});

test("SalesReportsService.getSaleTicket: SUPER_ADMIN conserva acceso", async () => {
  const adapter = new FakeSalesReportAdapter(
    new Map([[SALE_ID, ticketDataset()]]),
    new Set([SALE_ID])
  );
  const service = buildService(adapter);

  const result = await service.getSaleTicket(
    SALE_ID,
    user(["SUPER_ADMIN"], { id: SUPER_ADMIN_ID, branchId: null })
  );

  assert.equal(result.header.saleId, SALE_ID);
  assert.equal(adapter.ticketCalls[0].actor.role, "SUPER_ADMIN");
});

test("SalesReportsService.getSaleTicketPrintData: conserva dataset canonico", async () => {
  const taxBreakdown: TaxBreakdownRow[] = [
    {
      label: "INC",
      dianCode: "",
      taxTypeCode: "",
      taxBase: "100.50",
      taxAmount: "8.00",
    },
  ];
  const adapter = new FakeSalesReportAdapter(
    new Map([[SALE_ID, ticketDataset()]]),
    new Set([SALE_ID])
  );
  const service = buildService(adapter, taxBreakdown);

  const result = await service.getSaleTicketPrintData(SALE_ID, user(["USER"]));

  assert.equal(result.tenantId, TENANT_ID);
  assert.equal(result.ticket.header.saleId, SALE_ID);
  assert.equal(result.ticket.totals.total, 100.5);
  assert.equal(result.ticket.totals.taxBreakdown?.[0]?.label, "INC");
});

test("SalesReportsService.getSaleTicket: multi-tax IVA/ICL/ADV breakdown", async () => {
  const taxBreakdown: TaxBreakdownRow[] = [
    {
      label: "IVA 19%",
      dianCode: "01",
      taxTypeCode: "VAT",
      taxBase: "10000",
      taxAmount: "1900",
    },
    {
      label: "ICL",
      dianCode: "04",
      taxTypeCode: "ICL",
      taxBase: "10000",
      taxAmount: "350",
    },
    {
      label: "ADV",
      dianCode: "05",
      taxTypeCode: "ADV",
      taxBase: "10000",
      taxAmount: "250",
    },
  ];
  const dataset = {
    ...ticketDataset(),
    totals: {
      ...ticketDataset().totals,
      taxes: 2500,
    },
  } as unknown as PosSaleTicketDataset;
  const adapter = new FakeSalesReportAdapter(
    new Map([[SALE_ID, dataset]]),
    new Set([SALE_ID])
  );
  const service = buildService(adapter, taxBreakdown);

  const result = await service.getSaleTicket(SALE_ID, user(["USER"]));

  assert.equal(result.totals.taxes, 2500);
  assert.equal(result.totals.taxBreakdown?.length, 3);
  assert.deepEqual(
    result.totals.taxBreakdown?.map((tax) => tax.label),
    ["IVA 19%", "ICL", "ADV"]
  );
  assert.equal(
    result.totals.taxBreakdown?.reduce((sum, tax) => sum + tax.taxAmount, 0),
    2500
  );
});
