import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { SaleService, resolveElectronicBillingTaxTreatment } from "./sale.service";
import { buildSaleCompletedForElectronicBillingEventId } from "../mappers/sale-completed-for-electronic-billing-event-id";
import type { CreateSaleInput } from "../repositories/sale.repository";
import type {
  CalculateLinePriceInput,
  LinePricePreview,
} from "../../pricing/pricing.types";

const ids = {
  tenant: "10000000-0000-0000-0000-000000000001",
  branch: "10000000-0000-0000-0000-000000000002",
  terminal: "10000000-0000-0000-0000-000000000003",
  user: "10000000-0000-0000-0000-000000000004",
  customer: "10000000-0000-0000-0000-000000000005",
  sale: "10000000-0000-0000-0000-000000000006",
  product: "10000000-0000-0000-0000-000000000007",
  movementOut: "10000000-0000-0000-0000-000000000008",
  movementIn: "10000000-0000-0000-0000-000000000009",
  lot: "10000000-0000-0000-0000-000000000010",
  balance: "10000000-0000-0000-0000-000000000011",
  location: "10000000-0000-0000-0000-000000000012",
  link: "10000000-0000-0000-0000-000000000013",
  posSession: "10000000-0000-0000-0000-000000000015",
  paymentMethod: "10000000-0000-0000-0000-000000000016",
  promotion: "10000000-0000-0000-0000-000000000017",
  tax: "10000000-0000-0000-0000-000000000018",
  productTwo: "10000000-0000-0000-0000-000000000019",
  order: "10000000-0000-0000-0000-000000000020",
  delivery: "10000000-0000-0000-0000-000000000021",
  orderItem: "10000000-0000-0000-0000-000000000022",
};

test("electronic billing maps authoritative Exento tax to EXEMPT", () => {
  assert.equal(
    resolveElectronicBillingTaxTreatment(
      [{ type: "VAT", code: "01", schemeName: "Exento" }],
      0,
    ),
    "EXEMPT",
  );
  assert.equal(resolveElectronicBillingTaxTreatment([], 0), "EXCLUDED");
  assert.equal(
    resolveElectronicBillingTaxTreatment(
      [{ type: "VAT", code: "01", schemeName: "IVA" }],
      3040,
    ),
    "TAXED",
  );
});

type Scenario = {
  saleStatus?: "DRAFT" | "CONFIRMED" | "CANCELLED" | "REFUNDED";
  requiresLot?: boolean;
  links?: Array<{
    lotStatus?: "ACTIVE" | "EXPIRED" | "BLOCKED" | "CONSUMED" | "CANCELLED";
    quantity?: number;
    locationId?: string | null;
  }>;
};

type RecordedQuery = {
  text: string;
  params: unknown[];
};

const saleRow = (status: Scenario["saleStatus"] = "CONFIRMED") => ({
  id: ids.sale,
  tenant_id: ids.tenant,
  branch_id: ids.branch,
  terminal_id: ids.terminal,
  user_id: ids.user,
  pos_session_id: null,
  customer_id: ids.customer,
  order_id: null,
  type: "CASH",
  status,
  total: 3000,
  balance: 0,
  payment_status: "PAID",
  total_paid: 3000,
  balance_due: 0,
  created_at: new Date("2026-05-28T00:00:00.000Z"),
  customer_name: "Cliente prueba",
});

const saleItemRow = {
  id: "10000000-0000-0000-0000-000000000014",
  tenant_id: ids.tenant,
  sale_id: ids.sale,
  product_id: ids.product,
  order_item_id: null,
  quantity: 3,
  price: 1000,
  price_without_tax: 1000,
  tax_total: 0,
  subtotal: 3000,
  created_at: new Date("2026-05-28T00:00:00.000Z"),
};

const movementOutRow = {
  id: ids.movementOut,
  product_id: ids.product,
  quantity: 3,
  branch_id: ids.branch,
  terminal_id: ids.terminal,
  pos_session_code: "POS-1",
  user_id: ids.user,
};

const makePreview = (
  overrides: Partial<LinePricePreview> = {}
): LinePricePreview => ({
  productId: ids.product,
  quantity: 2,
  baseUnitPrice: 200,
  finalUnitPrice: 180,
  discountAmount: 20,
  discountPercent: 10,
  appliedPromotionId: ids.promotion,
  appliedPromotionName: "Promo POS",
  taxId: ids.tax,
  taxRate: 0.19,
  taxBase: 302.52,
  taxAmount: 57.48,
  taxes: [],
  lineSubtotal: 302.52,
  lineTotal: 360,
  explanation: "test pricing",
  ...overrides,
});

class FakePricingService {
  readonly calls: CalculateLinePriceInput[] = [];

  constructor(private readonly previews: LinePricePreview[] = []) {}

  async calculateLinePrice(input: CalculateLinePriceInput) {
    this.calls.push(input);
    const preview = this.previews.shift() ?? makePreview();
    return {
      ...preview,
      productId: input.productId,
      quantity: input.quantity,
    };
  }
}

const defaultSaleItemTaxRows = [
  {
    id: "10000000-0000-0000-0000-000000000023",
    tenant_id: ids.tenant,
    sale_item_id: saleItemRow.id,
    tax_id: ids.tax,
    tax_name: "IVA",
    tax_rate: 0.19,
    tax_base: 3000,
    tax_amount: 570,
    is_included: true,
    dian_code: "01",
    tax_type_code: "VAT",
    calculation_method_code: "PERCENTAGE",
    created_at: new Date("2026-06-02T00:00:00.000Z"),
  },
];

class FakeCreateSaleClient {
  readonly queries: RecordedQuery[] = [];

  constructor(
    private readonly includeTaxSnapshot = false,
    private readonly saleItemTaxRows: Array<Record<string, unknown>> = defaultSaleItemTaxRows
  ) {}
  released = false;

  async query<T>(text: string, params: unknown[] = []) {
    this.queries.push({ text, params });
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [] as T[] };
    }

    if (sql.includes("SELECT total_paid FROM sales")) {
      return { rows: [{ total_paid: 360 }] as T[] };
    }

    if (sql.includes("FROM orders") && sql.includes("status IN")) {
      return {
        rows: [
          {
            id: ids.order,
            customer_id: ids.customer,
            type: "CASH",
          },
        ] as T[],
      };
    }

    if (sql.includes("FROM public.deliveries") && sql.includes("sale_id = $2")) {
      return { rows: [] as T[] };
    }

    if (
      sql.includes("fnc_list_sale_item_taxes") ||
      sql.includes("FROM sale_item_taxes")
    ) {
      return {
        rows: this.includeTaxSnapshot
          ? (this.saleItemTaxRows as T[])
          : ([] as T[]),
      };
    }

    if (sql.includes("prc_sync_sale_item_taxes_from_order")) {
      return { rows: [{ ok: true }] as T[] };
    }

    if (sql.includes("SELECT id, ordered_quantity") && sql.includes("FROM order_items")) {
      return {
        rows: [
          {
            id: ids.orderItem,
            ordered_quantity: 1,
          },
        ] as T[],
      };
    }

    if (sql.includes("FROM order_item_taxes")) {
      return {
        rows: this.includeTaxSnapshot
          ? ([
              {
                order_item_id: ids.orderItem,
                tax_id: ids.tax,
                tax_name: "IVA",
                tax_rate: 0,
                tax_base: 3000,
                tax_amount: 0,
                is_included: true,
                dian_code: "01",
                tax_type_code: "VAT",
                calculation_method_code: "PERCENTAGE",
                calculation_order: 1,
              },
            ] as T[])
          : ([] as T[]),
      };
    }

    if (sql.includes("FROM sale_items")) {
      if (sql.includes("order_item_id IS NOT NULL")) {
        return {
          rows: [
            {
              id: saleItemRow.id,
              order_item_id: ids.orderItem,
              quantity: 1,
              tax_base: 3000,
              tax_amount: 0,
            },
          ] as T[],
        };
      }
      return {
        rows: [
          {
            id: saleItemRow.id,
            product_id: ids.product,
            quantity: 1,
            price: 3000,
            order_item_id: ids.orderItem,
            subtotal: 3000,
            price_without_tax: 3000,
            tax_total: 0,
            base_unit_price: 3000,
            final_unit_price: 3000,
            discount_amount: 0,
            discount_percent: 0,
            discount_total: 0,
            tax_base: 3000,
            tax_amount: 0,
            line_total: 3000,
            pricing_source: "ORDER_DELIVERY",
            pricing_snapshot: null,
            created_at: new Date("2026-06-02T00:00:00.000Z"),
          },
        ] as T[],
      };
    }

    if (sql.startsWith("UPDATE public.deliveries")) {
      return { rows: [{ id: ids.delivery }] as T[] };
    }

    if (sql.includes("vat_responsibility")) {
      return { rows: [{ vat_responsibility: "RESPONSIBLE" }] as T[] };
    }

    throw new Error(`Unexpected SQL in create sale test: ${sql}`);
  }

  release() {
    this.released = true;
  }
}

class FakeCreateSaleRepository {
  readonly createSaleCalls: Array<{
    data: CreateSaleInput;
    paymentMethods: Array<{
      paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
      amount: number;
      reference?: string | null;
    }>;
  }> = [];
  readonly invoiceOrderCalls: unknown[] = [];
  readonly statusUpdates: unknown[] = [];

  async validateActivePosSession() {
    return true;
  }

  async validateCustomer() {
    return true;
  }

  async validateOrder() {
    return true;
  }

  async findPaymentMethodTypesByIds() {
    return new Map([[ids.paymentMethod, "CASH"]]);
  }

  async createSaleWithFunction(
    data: CreateSaleInput,
    paymentMethods: Array<{
      paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
      amount: number;
      reference?: string | null;
    }>
  ) {
    this.createSaleCalls.push({ data, paymentMethods });
    return {
      id: ids.sale,
      tenant_id: ids.tenant,
      customer_id: data.customerId,
      order_id: data.orderId ?? null,
      type: data.type,
      status: "CONFIRMED" as const,
      total: data.items.reduce(
        (sum, item) => sum + (item.lineTotal ?? item.subtotal ?? 0),
        0
      ),
      balance: 0,
      created_at: new Date("2026-06-02T00:00:00.000Z"),
    };
  }

  async invoiceOrderWithFunction(data: {
    tenantId: string;
    orderId: string;
    type: "CASH" | "CREDIT";
  }) {
    this.invoiceOrderCalls.push(data);
    return {
      id: ids.sale,
      tenant_id: data.tenantId,
      customer_id: ids.customer,
      order_id: data.orderId,
      type: data.type,
      status: "CONFIRMED" as const,
      total: 3000,
      balance: 0,
      created_at: new Date("2026-06-02T00:00:00.000Z"),
    };
  }

  async updateSaleStatus(...args: unknown[]) {
    this.statusUpdates.push(args);
  }
}

class FakeCancelClient {
  readonly queries: RecordedQuery[] = [];
  readonly balanceUpdates: RecordedQuery[] = [];
  readonly reverseLotLinks: RecordedQuery[] = [];
  released = false;

  constructor(private readonly scenario: Scenario = {}) {}

  async query<T>(text: string, params: unknown[] = []) {
    this.queries.push({ text, params });
    const sql = text.replace(/\s+/g, " ").trim();

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [] as T[] };
    }

    if (sql.includes("FROM sales s") && sql.includes("FOR UPDATE")) {
      return { rows: [saleRow(this.scenario.saleStatus)] as T[] };
    }

    if (
      sql.includes("FROM sale_items") &&
      !sql.includes("sale_item_id IN")
    ) {
      return { rows: [saleItemRow] as T[] };
    }

    if (
      sql.includes("FROM stock_movements") &&
      sql.includes("reference_type = 'SALE'")
    ) {
      return { rows: [movementOutRow] as T[] };
    }

    if (sql.includes("FROM stock_movement_lots AS sml")) {
      const links = (this.scenario.links ?? []).map((link, index) => ({
        id: `${ids.link.slice(0, -1)}${index}`,
        product_id: ids.product,
        lot_id: ids.lot,
        location_id: link.locationId === undefined ? ids.location : link.locationId,
        quantity: link.quantity ?? 3,
        lot_status: link.lotStatus ?? "ACTIVE",
        lot_branch_id: ids.branch,
        lot_product_id: ids.product,
      }));
      return { rows: links as T[] };
    }

    if (sql.includes("SELECT id, requires_lot FROM products")) {
      return {
        rows: [
          {
            id: ids.product,
            requires_lot: this.scenario.requiresLot ?? false,
          },
        ] as T[],
      };
    }

    if (sql.includes("FROM inventory_lots") && sql.includes("FOR UPDATE")) {
      return {
        rows: [
          {
            id: ids.lot,
            status: this.scenario.links?.[0]?.lotStatus ?? "ACTIVE",
            branch_id: ids.branch,
            product_id: ids.product,
          },
        ] as T[],
      };
    }

    if (sql.startsWith("UPDATE inventory_lot_balances AS balance")) {
      this.balanceUpdates.push({ text, params });
      return { rows: [{ id: ids.balance }] as T[] };
    }

    if (sql.startsWith("INSERT INTO stock_movement_lots")) {
      this.reverseLotLinks.push({ text, params });
      return { rows: [] as T[] };
    }

    if (sql.startsWith("UPDATE sales")) {
      return { rows: [] as T[] };
    }

    throw new Error(`Unexpected SQL in test: ${sql}`);
  }

  release() {
    this.released = true;
  }
}

const buildService = (scenario: Scenario = {}) => {
  const client = new FakeCancelClient(scenario);
  const createdMovements: unknown[] = [];

  const service = new SaleService(
    {
      getClient: async () => client as unknown as PoolClient,
    } as never,
    {} as never,
    {} as never,
    {
      createMovement: async (data: unknown) => {
        createdMovements.push(data);
        return { ...(data as object), id: ids.movementIn };
      },
    } as never,
    {
      findAccessibleBranchIds: async () => [],
    } as never,
    {
      listAllocatedPayments: async () => [],
    } as never,
    {} as never,
    new FakePricingService() as never
  );

  (service as unknown as { getSaleById: () => Promise<unknown> }).getSaleById =
    async () => ({ id: ids.sale, status: "CANCELLED" });

  return { service, client, createdMovements };
};

type SaleBillingHarness = {
  outboxService?: unknown;
  customerRepository: {
    findById: (id: string, tenantId: string, client?: PoolClient) => Promise<{
      id: string;
      tenantId: string;
      name: string;
      documentNumber: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      municipioId: string | null;
      isFinalConsumer: boolean;
    } | null>;
  };
  productRepository: {
    findById: (id: string, tenantId: string) => Promise<{
      id: string;
      sku: string;
      name: string;
      description: string | null;
      measurementUnit: string;
    } | null>;
  };
  taxRepository: {
    findById: (id: string, tenantId: string) => Promise<{
      id: string;
      name: string;
      rate: number;
    } | null>;
  };
  invoicingCustomersRepository: {
    findByNormalizedDocument: (tenantId: string, documentNumber: string) => Promise<{
      dianIdentificationType: string | null;
      documentTypeCode: string | null;
      identificationNumber: string | null;
      documentNumberNormalized: string | null;
      verificationDigit: string | null;
      legalName: string | null;
      tradeName: string | null;
      invoiceEmail: string | null;
      fiscalEmail: string | null;
      phone: string | null;
      address: string | null;
      municipalityCode: string | null;
      personType: "NATURAL" | "JURIDICA" | "UNKNOWN" | null;
      taxResponsibilities: string[];
      taxRegime: string | null;
    } | null>;
    findActiveFinalConsumer: (tenantId: string) => Promise<{
      dianIdentificationType: string | null;
      documentTypeCode: string | null;
      identificationNumber: string | null;
      documentNumberNormalized: string | null;
      verificationDigit: string | null;
      legalName: string | null;
      tradeName: string | null;
      invoiceEmail: string | null;
      fiscalEmail: string | null;
      phone: string | null;
      address: string | null;
      municipalityCode: string | null;
      personType: "NATURAL" | "JURIDICA" | "UNKNOWN" | null;
      taxResponsibilities: string[];
      taxRegime: string | null;
      } | null>;
  };
};

const buildCreateSaleService = (
  previews: LinePricePreview[],
  billing?: SaleBillingHarness,
  includeTaxSnapshot = false,
  saleItemTaxRows: Array<Record<string, unknown>> = defaultSaleItemTaxRows,
) => {
  const client = new FakeCreateSaleClient(includeTaxSnapshot, saleItemTaxRows);
  const repository = new FakeCreateSaleRepository();
  const pricingService = new FakePricingService([...previews]);
  const createdPayments: unknown[] = [];
  const auditEvents: unknown[] = [];
  const outboxEvents: Array<unknown> = [];

  const service = new SaleService(
    {
      getClient: async () => client as unknown as PoolClient,
    } as never,
    repository as never,
    {
      logEvent: (event: unknown) => {
        auditEvents.push(event);
      },
    } as never,
    {} as never,
    {
      findAccessibleBranchIds: async () => [],
    } as never,
    {
      syncSaleFinancialState: async () => undefined,
    } as never,
    {
      createInTransaction: async (payload: {
        amount: number;
        referenceNumber?: string | null;
        notes?: string | null;
      }) => {
        createdPayments.push(payload);
        return {
          paymentMethodTipo: "CASH",
          amount: payload.amount,
          referenceNumber: payload.referenceNumber ?? null,
          notes: payload.notes ?? null,
        };
      },
    } as never,
    pricingService as never,
    billing?.outboxService
      ? {
          enqueueSaleCompletedEvent: async (input: unknown) => {
            outboxEvents.push(input);
          },
        }
      : undefined,
    billing?.customerRepository as never,
    billing?.productRepository as never,
    billing?.taxRepository as never,
    billing?.invoicingCustomersRepository as never
  );

  (service as unknown as { getSaleById: () => Promise<unknown> }).getSaleById =
    async () => ({ id: ids.sale, status: "CONFIRMED" });

  return {
    service,
    client,
    repository,
    pricingService,
    createdPayments,
    auditEvents,
    outboxEvents,
  };
};

const createSalePayload = (overrides: Partial<CreateSaleInput> = {}) => ({
  customerId: ids.customer,
  orderId: null,
  type: "CASH" as const,
  items: [
    {
      productId: ids.product,
      quantity: 2,
      price: 0.01,
    },
  ],
  payments: [
    {
      paymentMethodId: ids.paymentMethod,
      amount: 360,
      cashSessionId: ids.posSession,
      referenceNumber: "POS-TEST",
    },
  ],
  ...overrides,
});

const actor = {
  tenantId: ids.tenant,
  userId: ids.user,
  roles: ["SUPER_ADMIN"],
};

const posContext = {
  tenantId: ids.tenant,
  userId: ids.user,
  branchId: ids.branch,
  terminalId: ids.terminal,
  posSessionId: ids.posSession,
  roles: ["USER"],
};

test("SaleService.createSale calculates POS pricing and sends enriched payload", async () => {
  const { service, repository, pricingService } = buildCreateSaleService([
    makePreview({
      taxes: [
        {
          taxId: ids.tax,
          taxName: "IVA",
          dianCode: "01",
          taxTypeCode: "VAT",
          calculationMethodCode: "PERCENTAGE",
          taxRate: 0.19,
          taxBase: 302.52,
          taxAmount: 57.48,
          isIncluded: true,
        },
      ],
    }),
  ]);

  await service.createSale(createSalePayload(), posContext);

  assert.equal(pricingService.calls.length, 1);
  assert.equal(pricingService.calls[0].tenantId, ids.tenant);
  assert.equal(pricingService.calls[0].branchId, ids.branch);
  assert.equal(pricingService.calls[0].customerId, ids.customer);
  assert.equal(pricingService.calls[0].productId, ids.product);
  assert.equal(pricingService.calls[0].quantity, 2);
  assert.equal(pricingService.calls[0].channel, "POS");
  assert.ok(pricingService.calls[0].date);

  assert.equal(repository.createSaleCalls.length, 1);
  const pricedItem = repository.createSaleCalls[0].data.items[0];
  assert.equal(pricedItem.price, 180);
  assert.equal(pricedItem.subtotal, 360);
  assert.equal(pricedItem.priceWithoutTax, 151.26);
  assert.equal(pricedItem.taxTotal, 57.48);
  assert.equal(pricedItem.baseUnitPrice, 200);
  assert.equal(pricedItem.finalUnitPrice, 180);
  assert.equal(pricedItem.discountAmount, 20);
  assert.equal(pricedItem.discountPercent, 10);
  assert.equal(pricedItem.discountTotal, 40);
  assert.equal(pricedItem.appliedPromotionId, ids.promotion);
  assert.equal(pricedItem.appliedPromotionName, "Promo POS");
  assert.equal(pricedItem.taxId, ids.tax);
  assert.equal(pricedItem.taxRate, 0.19);
  assert.equal(pricedItem.taxBase, 302.52);
  assert.equal(pricedItem.taxAmount, 57.48);
  assert.equal(pricedItem.lineTotal, 360);
  assert.equal(pricedItem.pricingSource, "POS_PRICING_SERVICE");
  assert.deepEqual(pricedItem.taxes, [
    {
      taxId: ids.tax,
      taxName: "IVA",
      dianCode: "01",
      taxTypeCode: "VAT",
      calculationMethodCode: "PERCENTAGE",
      taxRate: 0.19,
      taxBase: 302.52,
      taxAmount: 57.48,
      isIncluded: true,
    },
  ]);
  assert.equal(pricedItem.pricingSnapshot?.channel, "POS");
  assert.deepEqual(pricedItem.pricingSnapshot?.taxes, pricedItem.taxes);
  assert.deepEqual(
    (pricedItem.pricingSnapshot?.result as LinePricePreview).finalUnitPrice,
    180
  );
});

test("SaleService.createSale creates a sale billing outbox event when billing is enabled", async () => {
  const billing = {
    outboxService: {},
    customerRepository: {
      findById: async () => ({
        id: ids.customer,
        tenantId: ids.tenant,
        name: "Cliente prueba",
        documentNumber: "900123456",
        phone: "3001234567",
        email: "cliente@example.com",
        address: "Calle 1",
        municipioId: null,
        ciudad: "Medellin",
        departamento: "Antioquia",
        isFinalConsumer: false,
      }),
    },
    productRepository: {
      findById: async () => ({
        id: ids.product,
        sku: "SKU-1",
        name: "Producto factura",
        description: "Producto factura",
        measurementUnit: "UND",
      }),
    },
    taxRepository: {
      findById: async () => ({
        id: ids.tax,
        name: "IVA",
        rate: 19,
      }),
    },
    invoicingCustomersRepository: {
      findByNormalizedDocument: async () => ({
        dianIdentificationType: "31",
        documentTypeCode: "31",
        identificationNumber: "900123456",
        documentNumberNormalized: "900123456",
        verificationDigit: "1",
        legalName: "Cliente factura SA",
        tradeName: "Cliente factura SA",
        invoiceEmail: "cliente@example.com",
        fiscalEmail: "cliente@example.com",
        phone: "3001234567",
        address: "Calle 1",
        municipalityCode: "11001",
        personType: "JURIDICA" as const,
        taxResponsibilities: ["O-13"],
        taxRegime: "IVA",
        departmentCode: "05",
      }),
      findActiveFinalConsumer: async () => null,
    },
  };

  const { service, outboxEvents } = buildCreateSaleService([makePreview()], billing, true);

  await service.createSale(createSalePayload(), posContext);

  assert.equal(outboxEvents.length, 1);
  const event = outboxEvents[0] as {
    eventId: string;
    tenantId: string;
    correlationId: string;
    sale: { saleId: string; saleType?: string | null; saleStatus?: string | null };
    customer: { identificationNumber?: string | null; legalName?: string | null };
    lines: Array<{
      sourceLineId: string;
      description: string;
      sku?: string | null;
      taxes: Array<{ type?: string; rate: string; amount: string; code?: string | null }>;
    }>;
    taxes: Array<{ sourceLineId?: string | null }>;
    payments: Array<{ methodCode: string; amount?: string | null }>;
    totals: { totalAmount: string };
    currencyCode: string;
  };

  assert.equal(
    event.eventId,
    buildSaleCompletedForElectronicBillingEventId(ids.tenant, ids.sale)
  );
  assert.equal(event.tenantId, ids.tenant);
  assert.equal(event.correlationId, ids.sale);
  assert.equal(event.sale.saleId, ids.sale);
  assert.equal(event.sale.saleType, "CASH");
  assert.equal(event.sale.saleStatus, "CONFIRMED");
  assert.equal(event.customer.identificationNumber, "900123456");
  assert.equal((event.customer as { departmentCode?: string }).departmentCode, "05");
  assert.equal((event.customer as { cityName?: string }).cityName, "Medellin");
  assert.equal((event.customer as { departmentName?: string }).departmentName, "Antioquia");
  assert.equal(event.lines[0].description, "Producto factura");
  assert.equal(event.lines[0].sku, "SKU-1");
  assert.equal(event.lines[0].sourceLineId, saleItemRow.id);
  assert.equal(event.lines[0].taxes.length, 1);
  assert.equal(event.lines[0].taxes[0].type, "VAT");
  assert.equal(event.lines[0].taxes[0].rate, "0.19");
  assert.equal(event.lines[0].taxes[0].amount, "570.00");
  assert.equal(event.lines[0].taxes[0].code, "01");
  assert.notEqual(event.lines[0].taxes[0].code, ids.tax);
  assert.equal(event.taxes.length, 1);
  assert.equal(event.payments[0].methodCode, "CASH");
  assert.equal(event.payments[0].amount, "360.00");
  assert.equal(event.totals.totalAmount, "3000.00");
  assert.equal(event.currencyCode, "COP");
});

test("SaleService.createSale maps multi-tax whisky snapshot for electronic billing", async () => {
  const iclTaxId = "10000000-0000-0000-0000-000000000031";
  const advTaxId = "10000000-0000-0000-0000-000000000032";
  const ivaTaxId = "10000000-0000-0000-0000-000000000033";
  const whiskyTaxes = [
    {
      id: "10000000-0000-0000-0000-000000000041",
      tenant_id: ids.tenant,
      sale_item_id: saleItemRow.id,
      tax_id: iclTaxId,
      tax_name: "ICL",
      tax_rate: 0,
      tax_base: 40,
      tax_amount: 14400,
      is_included: true,
      dian_code: "02",
      tax_type_code: "ICL",
      calculation_method_code: "PER_ALCOHOL_DEGREE_VOLUME",
      created_at: new Date("2026-06-02T00:00:00.000Z"),
    },
    {
      id: "10000000-0000-0000-0000-000000000042",
      tenant_id: ids.tenant,
      sale_item_id: saleItemRow.id,
      tax_id: advTaxId,
      tax_name: "ADV",
      tax_rate: 0.25,
      tax_base: 400000,
      tax_amount: 100000,
      is_included: true,
      dian_code: "04",
      tax_type_code: "AD_VALOREM",
      calculation_method_code: "AD_VALOREM",
      created_at: new Date("2026-06-02T00:00:01.000Z"),
    },
    {
      id: "10000000-0000-0000-0000-000000000043",
      tenant_id: ids.tenant,
      sale_item_id: saleItemRow.id,
      tax_id: ivaTaxId,
      tax_name: "IVA 5%",
      tax_rate: 0.05,
      tax_base: 452952.38,
      tax_amount: 22647.62,
      is_included: true,
      dian_code: "01",
      tax_type_code: "VAT",
      calculation_method_code: "PERCENTAGE",
      created_at: new Date("2026-06-02T00:00:02.000Z"),
    },
  ];

  const billing = {
    outboxService: {},
    customerRepository: {
      findById: async () => ({
        id: ids.customer,
        tenantId: ids.tenant,
        name: "Cliente whisky",
        documentNumber: "900123456",
        phone: "3001234567",
        email: "cliente@example.com",
        address: "Calle 1",
        municipioId: null,
        ciudad: "Medellin",
        departamento: "Antioquia",
        isFinalConsumer: false,
      }),
    },
    productRepository: {
      findById: async () => ({
        id: ids.product,
        sku: "WHISKY-1",
        name: "Whisky",
        description: "Whisky",
        measurementUnit: "UND",
      }),
    },
    taxRepository: {
      findById: async () => null,
    },
    invoicingCustomersRepository: {
      findByNormalizedDocument: async () => ({
        dianIdentificationType: "31",
        documentTypeCode: "31",
        identificationNumber: "900123456",
        documentNumberNormalized: "900123456",
        verificationDigit: "1",
        legalName: "Cliente factura SA",
        tradeName: "Cliente factura SA",
        invoiceEmail: "cliente@example.com",
        fiscalEmail: "cliente@example.com",
        phone: "3001234567",
        address: "Calle 1",
        municipalityCode: "11001",
        personType: "JURIDICA" as const,
        taxResponsibilities: ["O-13"],
        taxRegime: "IVA",
        departmentCode: "05",
      }),
      findActiveFinalConsumer: async () => null,
    },
  };

  const { service, outboxEvents, repository } = buildCreateSaleService(
    [
      makePreview({
        taxId: ivaTaxId,
        taxRate: 0.05,
        taxBase: 452952.38,
        taxAmount: 137047.62,
        lineSubtotal: 452952.38,
        lineTotal: 590000,
        finalUnitPrice: 590000,
        baseUnitPrice: 590000,
        discountAmount: 0,
        discountPercent: 0,
        taxes: whiskyTaxes.map((tax) => ({
          taxId: String(tax.tax_id),
          taxName: String(tax.tax_name),
          dianCode: String(tax.dian_code),
          taxTypeCode: String(tax.tax_type_code),
          calculationMethodCode: String(tax.calculation_method_code),
          taxRate: Number(tax.tax_rate),
          taxBase: Number(tax.tax_base),
          taxAmount: Number(tax.tax_amount),
          isIncluded: true,
        })),
      }),
    ],
    billing,
    true,
    whiskyTaxes
  );

  await service.createSale(
    createSalePayload({
      payments: [
        {
          paymentMethodId: ids.paymentMethod,
          amount: 590000,
          cashSessionId: ids.posSession,
        },
      ],
    }),
    posContext
  );

  assert.equal(repository.createSaleCalls[0].data.items[0].taxes?.length, 3);
  assert.equal(outboxEvents.length, 1);
  const event = outboxEvents[0] as {
    lines: Array<{
      taxes: Array<{ type: string; code: string | null; amount: string; rate: string }>;
    }>;
    taxes: Array<{ sourceLineId?: string | null }>;
  };

  assert.equal(event.lines[0].taxes.length, 3);
  assert.deepEqual(
    event.lines[0].taxes.map((tax) => ({
      type: tax.type,
      code: tax.code,
      rate: tax.rate,
      amount: tax.amount,
    })),
    [
      { type: "ICL", code: "02", rate: "0.00", amount: "14400.00" },
      { type: "AD_VALOREM", code: "04", rate: "0.25", amount: "100000.00" },
      { type: "VAT", code: "01", rate: "0.05", amount: "22647.62" },
    ]
  );
  assert.equal(event.taxes.length, 3);
  for (const tax of event.lines[0].taxes) {
    assert.notEqual(tax.code, iclTaxId);
    assert.notEqual(tax.code, advTaxId);
    assert.notEqual(tax.code, ivaTaxId);
  }
});

test("SaleService.createSale skips sale billing outbox event when outbox service is unavailable", async () => {
  const { service, outboxEvents } = buildCreateSaleService([makePreview()]);

  await service.createSale(createSalePayload(), posContext);

  assert.equal(outboxEvents.length, 0);
});

test("SaleService.createSaleFromOrderDelivery links existing order delivery to sale", async () => {
  const { service, client, repository } = buildCreateSaleService([]);

  const result = await service.createSaleFromOrderDelivery(
    {
      orderId: ids.order,
      type: "CASH",
      payments: [],
    },
    posContext
  );

  assert.equal(repository.invoiceOrderCalls.length, 1);
  const invoiceCall = repository.invoiceOrderCalls[0] as {
    tenantId: string;
    userId: string;
    branchId: string;
    terminalId: string;
    posSessionId: string;
    orderId: string;
    type: string;
    payments: unknown[];
  };
  assert.equal(invoiceCall.tenantId, ids.tenant);
  assert.equal(invoiceCall.userId, ids.user);
  assert.equal(invoiceCall.branchId, ids.branch);
  assert.equal(invoiceCall.terminalId, ids.terminal);
  assert.equal(invoiceCall.posSessionId, ids.posSession);
  assert.equal(invoiceCall.orderId, ids.order);
  assert.equal(invoiceCall.type, "CASH");
  assert.deepEqual(invoiceCall.payments, []);
  const deliveryUpdate = client.queries.find((query) =>
    query.text.includes("UPDATE public.deliveries")
  );
  assert.ok(deliveryUpdate);
  assert.deepEqual(deliveryUpdate.params, [
    ids.tenant,
    ids.order,
    ids.sale,
    ids.user,
  ]);
  assert.equal(deliveryUpdate.text.includes("sale_id = $3"), true);
  assert.equal(deliveryUpdate.text.includes("sale_id = $3::uuid"), true);
  assert.equal(deliveryUpdate.text.includes("($3::uuid)::text"), true);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "COMMIT")
  );
  assert.deepEqual(result, { id: ids.sale, status: "CONFIRMED" });
});

test("SaleService.createSaleFromOrderDelivery creates an electronic invoice intent when billing is enabled", async () => {
  const billing = {
    outboxService: {},
    customerRepository: {
      findById: async () => ({
        id: ids.customer,
        tenantId: ids.tenant,
        name: "Cliente prueba",
        documentNumber: "900123456",
        phone: "3001234567",
        email: "cliente@example.com",
        address: "Calle 1",
        municipioId: null,
        ciudad: "Medellin",
        departamento: "Antioquia",
        isFinalConsumer: false,
      }),
    },
    productRepository: {
      findById: async () => ({
        id: ids.product,
        sku: "SKU-1",
        name: "Producto factura",
        description: "Producto factura",
        measurementUnit: "UND",
      }),
    },
    taxRepository: {
      findById: async () => ({
        id: ids.tax,
        name: "IVA",
        rate: 19,
      }),
    },
    invoicingCustomersRepository: {
      findByNormalizedDocument: async () => ({
        dianIdentificationType: "31",
        documentTypeCode: "31",
        identificationNumber: "900123456",
        documentNumberNormalized: "900123456",
        verificationDigit: "1",
        legalName: "Cliente factura SA",
        tradeName: "Cliente factura SA",
        invoiceEmail: "cliente@example.com",
        fiscalEmail: "cliente@example.com",
        phone: "3001234567",
        address: "Calle 1",
        municipalityCode: "11001",
        personType: "JURIDICA" as const,
        taxResponsibilities: ["O-13"],
        taxRegime: "IVA",
        departmentCode: "05",
      }),
      findActiveFinalConsumer: async () => null,
    },
  };

  const { service, outboxEvents } = buildCreateSaleService([], billing, true);

  const result = await service.createSaleFromOrderDelivery(
    {
      orderId: ids.order,
      type: "CASH",
      payments: [],
    },
    posContext
  );

  assert.equal(outboxEvents.length, 1);
  const event = outboxEvents[0] as {
    eventId: string;
    sale: { saleId: string };
    customer: { identificationNumber?: string | null };
    lines: Array<{ taxes: Array<{ rate: string; amount: string; code?: string | null }> }>;
    taxes: Array<{ sourceLineId?: string | null }>;
    totals: { totalAmount: string };
    currencyCode: string;
  };
  assert.equal(
    event.eventId,
    buildSaleCompletedForElectronicBillingEventId(ids.tenant, ids.sale)
  );
  assert.equal(event.sale.saleId, ids.sale);
  assert.equal(event.customer.identificationNumber, "900123456");
  assert.equal(event.lines[0].taxes[0].rate, "0.19");
  assert.equal(event.lines[0].taxes[0].amount, "570.00");
  assert.equal(event.lines[0].taxes[0].code, "01");
  assert.equal(event.taxes.length, 1);
  assert.equal(event.totals.totalAmount, "3000.00");
  assert.equal(event.currencyCode, "COP");
  assert.deepEqual(result, { id: ids.sale, status: "CONFIRMED" });
});

test("SaleService.createSale rejects CASH mismatch using backend lineTotal and skips repository", async () => {
  const { service, repository } = buildCreateSaleService([
    makePreview({
      productId: ids.product,
      quantity: 1,
      finalUnitPrice: 100,
      lineSubtotal: 100,
      taxBase: 100,
      taxAmount: 0,
      lineTotal: 100,
    }),
    makePreview({
      productId: ids.productTwo,
      quantity: 1,
      finalUnitPrice: 199,
      lineSubtotal: 200,
      taxBase: 200,
      taxAmount: 0,
      lineTotal: 200,
    }),
  ]);

  await assert.rejects(
    () =>
      service.createSale(
        createSalePayload({
          items: [
            {
              productId: ids.product,
              quantity: 1,
              price: 99,
            },
            {
              productId: ids.productTwo,
              quantity: 1,
              price: 200,
            },
          ],
          payments: [
            {
              paymentMethodId: ids.paymentMethod,
              amount: 299,
              cashSessionId: ids.posSession,
            },
          ],
        }),
        posContext
      ),
    (error) =>
      error instanceof BadRequestException &&
      error.message ===
        "Payment total does not match backend calculated sale total"
  );

  assert.equal(repository.createSaleCalls.length, 0);
});

test("SaleService.cancelSale keeps non-lotted cancellation without lot mutations", async () => {
  const { service, client, createdMovements } = buildService({
    requiresLot: false,
    links: [],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(createdMovements.length, 1);
  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "COMMIT")
  );
});

test("SaleService.cancelSale restores original lot balance and creates reverse stock_movement_lots", async () => {
  const { service, client, createdMovements } = buildService({
    links: [{ lotStatus: "ACTIVE", quantity: 3 }],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(createdMovements.length, 1);
  assert.equal(client.balanceUpdates.length, 1);
  assert.equal(client.balanceUpdates[0].params[3], ids.lot);
  assert.equal(client.balanceUpdates[0].params[4], 3);
  assert.equal(client.reverseLotLinks.length, 1);
  assert.equal(client.reverseLotLinks[0].params[2], ids.movementIn);
  assert.equal(client.reverseLotLinks[0].params[4], ids.lot);
  assert.equal(client.reverseLotLinks[0].params[6], 3);
});

test("SaleService.cancelSale allows reversal into BLOCKED lot", async () => {
  const { service, client } = buildService({
    links: [{ lotStatus: "BLOCKED", quantity: 3 }],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(client.balanceUpdates.length, 1);
  assert.equal(client.reverseLotLinks.length, 1);
});

test("SaleService.cancelSale rejects CANCELLED lot and rolls back", async () => {
  const { service, client } = buildService({
    links: [{ lotStatus: "CANCELLED", quantity: 3 }],
  });

  await assert.rejects(
    () => service.cancelSale(ids.sale, actor),
    (error) =>
      error instanceof BadRequestException &&
      error.message === "CANCELLED lot cannot be reversed automatically"
  );

  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "ROLLBACK")
  );
});

test("SaleService.cancelSale rejects lotted sale movement without lot links", async () => {
  const { service, client } = buildService({
    requiresLot: true,
    links: [],
  });

  await assert.rejects(
    () => service.cancelSale(ids.sale, actor),
    (error) =>
      error instanceof BadRequestException &&
      error.message ===
        "lotted sale movement is missing stock_movement_lots for reversal"
  );

  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "ROLLBACK")
  );
});

test("SaleService.cancelSale does not duplicate reversal when sale is already cancelled", async () => {
  const { service, client, createdMovements } = buildService({
    saleStatus: "CANCELLED",
    links: [{ lotStatus: "ACTIVE", quantity: 3 }],
  });

  await service.cancelSale(ids.sale, actor);

  assert.equal(createdMovements.length, 0);
  assert.equal(client.balanceUpdates.length, 0);
  assert.equal(client.reverseLotLinks.length, 0);
  assert(
    client.queries.some((query) => query.text.replace(/\s+/g, " ").trim() === "COMMIT")
  );
});

test("SaleService.normalizeSaleContext preserves roles for explicit POS context", async () => {
  const { service } = buildService();

  const normalized = await (
    service as unknown as {
      normalizeSaleContext: (context: unknown) => Promise<{
        tenantId: string;
        userId: string;
        branchId: string;
        terminalId: string;
        posSessionId: string;
        sessionId?: string;
        roles: string[];
      }>;
    }
  ).normalizeSaleContext({
    tenantId: ids.tenant,
    userId: ids.user,
    branchId: ids.branch,
    terminalId: ids.terminal,
    posSessionId: "10000000-0000-0000-0000-000000000015",
    sessionId: "10000000-0000-0000-0000-000000000016",
    roles: ["SUPER_ADMIN"],
  });

  assert.deepEqual(normalized.roles, ["SUPER_ADMIN"]);
  assert.equal(normalized.sessionId, "10000000-0000-0000-0000-000000000016");
});

test("SaleService.normalizeSaleContext preserves roles when POS context is resolved", async () => {
  const { service } = buildService();
  const repository = (
    service as unknown as {
      repository: {
        findCurrentPosContext: () => Promise<{
          branch_id: string;
          terminal_id: string;
          pos_session_id: string;
        }>;
      };
    }
  ).repository;
  repository.findCurrentPosContext = async () => ({
    branch_id: ids.branch,
    terminal_id: ids.terminal,
    pos_session_id: "10000000-0000-0000-0000-000000000015",
  });

  const normalized = await (
    service as unknown as {
      normalizeSaleContext: (context: unknown) => Promise<{
        branchId: string;
        terminalId: string;
        posSessionId: string;
        sessionId?: string;
        roles: string[];
      }>;
    }
  ).normalizeSaleContext({
    tenantId: ids.tenant,
    userId: ids.user,
    sessionId: "10000000-0000-0000-0000-000000000016",
    roles: ["ADMIN", "USER"],
  });

  assert.equal(normalized.branchId, ids.branch);
  assert.deepEqual(normalized.roles, ["ADMIN", "USER"]);
  assert.equal(normalized.sessionId, "10000000-0000-0000-0000-000000000016");
});

test("SaleService.getSales filters by customerId", async () => {
  const queries: RecordedQuery[] = [];
  const service = new SaleService(
    {
      query: async (text: string, params: unknown[] = []) => {
        queries.push({ text, params });
        return { rows: [] };
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    { findAccessibleBranchIds: async () => [] } as never,
    {} as never,
    {} as never,
    new FakePricingService() as never
  );

  await service.getSales(
    {
      roles: ["SUPER_ADMIN"],
      tenantId: ids.tenant,
      userId: ids.user,
    },
    {
      customerId: ids.customer,
    }
  );

  assert.match(queries[0].text, /s\.customer_id = \$2::uuid/);
  assert.deepEqual(queries[0].params, [ids.tenant, ids.customer]);
});

test("SaleService classifies a draft electronic-billing snapshot as stale after confirmation", () => {
  const { service } = buildService();
  const customer = {
    identificationNumber: "900123456",
    legalName: "Cliente prueba",
    countryCode: "CO",
    departmentCode: "05",
    municipalityCode: "05001",
    taxLevelCode: "JURIDICA",
    taxSchemeId: "ORDINARIO",
    fiscalResponsibilityCodes: ["O-13"],
  };
  const event = {
    payload: {
      sale: { saleStatus: "DRAFT" },
      customer,
      totals: { subtotalAmount: "100.00", taxAmount: "19.00", totalAmount: "119.00" },
    },
  };
  const currentLines = [{ subtotalAmount: "100.00", taxAmount: "19.00", totalAmount: "119.00" }];
  const isStale = (service as unknown as {
    isElectronicBillingSnapshotStale: (...args: unknown[]) => boolean;
  }).isElectronicBillingSnapshotStale;

  assert.equal(isStale.call(service, event, { status: "CONFIRMED", total: "119.00" }, customer, currentLines), true);
  assert.equal(
    isStale.call(
      service,
      { payload: { ...event.payload, sale: { saleStatus: "CONFIRMED" } } },
      { status: "CONFIRMED", total: "119.00" },
      customer,
      currentLines,
    ),
    false,
  );
});
