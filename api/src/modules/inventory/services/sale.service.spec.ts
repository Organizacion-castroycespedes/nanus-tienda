import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { SaleService } from "./sale.service";
import { buildDeterministicSaleExternalReference } from "../mappers/sale-electronic-invoice.mapper";
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
};

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

class FakeCreateSaleClient {
  readonly queries: RecordedQuery[] = [];
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

    if (sql.includes("FROM sale_items")) {
      return {
        rows: [
          {
            product_id: ids.product,
            quantity: 1,
            price: 3000,
            order_item_id: null,
            subtotal: 3000,
            price_without_tax: 3000,
            tax_total: 0,
            base_unit_price: 3000,
            final_unit_price: 3000,
            discount_amount: 0,
            discount_percent: 0,
            discount_total: 0,
            tax_id: null,
            tax_rate: null,
            tax_base: 3000,
            tax_amount: 0,
            line_total: 3000,
            pricing_source: "ORDER_DELIVERY",
            created_at: new Date("2026-06-02T00:00:00.000Z"),
          },
        ] as T[],
      };
    }

    if (sql.startsWith("UPDATE public.deliveries")) {
      return { rows: [{ id: ids.delivery }] as T[] };
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
  configRepository: {
    findEnabledForTenant: (tenantId: string, client: PoolClient) => Promise<Array<{ id: string }>>;
    findDefaultForTenant: (tenantId: string, client: PoolClient) => Promise<{ id: string } | null>;
  };
  providerResolver: {
    resolve: (command: { tenantId: string; providerConfigId: string }, client?: PoolClient) => Promise<{
      context: {
        tenantId: string;
        providerId: string;
        providerConfigId: string;
        environment: "TEST" | "HABILITATION" | "PRODUCTION";
        baseUrl: string | null;
        credentialReference: string | null;
        settings: Record<string, unknown>;
      };
    }>;
  };
  billingService: {
    createInvoiceDocument: (
      command: {
        context: { tenantId: string; providerId: string; providerConfigId: string };
        documentId: string;
        externalReference: string;
        customer: { identification: { number: string } };
        lines: Array<{ description: string }>;
        totals: { totalAmount: number };
      },
      client?: PoolClient,
      source?: { type?: string; id?: string | null }
    ) => Promise<void>;
  };
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
  billing?: SaleBillingHarness
) => {
  const client = new FakeCreateSaleClient();
  const repository = new FakeCreateSaleRepository();
  const pricingService = new FakePricingService([...previews]);
  const createdPayments: unknown[] = [];
  const auditEvents: unknown[] = [];

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
    billing?.billingService as never,
    billing?.providerResolver as never,
    billing?.configRepository as never,
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
    makePreview(),
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
  assert.equal(pricedItem.pricingSnapshot?.channel, "POS");
  assert.deepEqual(
    (pricedItem.pricingSnapshot?.result as LinePricePreview).finalUnitPrice,
    180
  );
});

test("SaleService.createSale creates an electronic invoice intent when billing is enabled", async () => {
  const invoiceCalls: Array<{
    command: {
      context: { tenantId: string; providerId: string; providerConfigId: string };
      externalReference: string;
      customer: { identification: { number: string } };
      lines: Array<{ description: string; sku: string | null }>;
      payment: { methodCode: string } | null;
      totals: { totalAmount: number; currencyCode: string };
    };
    source: { type?: string; id?: string | null } | undefined;
  }> = [];

  const billing = {
    configRepository: {
      findEnabledForTenant: async () => [{ id: "config-1" }],
      findDefaultForTenant: async () => ({ id: "config-1" }),
    },
    providerResolver: {
      resolve: async () => ({
        context: {
          tenantId: ids.tenant,
          providerId: ids.provider,
          providerConfigId: "config-1",
          environment: "TEST" as const,
          baseUrl: null,
          credentialReference: null,
          settings: {},
        },
      }),
    },
    billingService: {
      createInvoiceDocument: async (command: any, _client?: PoolClient, source?: { type?: string; id?: string | null }) => {
        invoiceCalls.push({
          command,
          source,
        });
      },
    },
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
      }),
      findActiveFinalConsumer: async () => null,
    },
  };

  const { service } = buildCreateSaleService([makePreview()], billing);

  await service.createSale(createSalePayload(), posContext);

  assert.equal(invoiceCalls.length, 1);
  assert.equal(
    invoiceCalls[0].command.externalReference,
    buildDeterministicSaleExternalReference(ids.tenant, ids.sale)
  );
  assert.equal(invoiceCalls[0].source?.type, "SALE");
  assert.equal(invoiceCalls[0].source?.id, ids.sale);
  assert.equal(invoiceCalls[0].command.context.providerConfigId, "config-1");
  assert.equal(invoiceCalls[0].command.payment?.methodCode, "CASH");
  assert.equal(invoiceCalls[0].command.lines[0].description, "Producto factura");
  assert.equal(invoiceCalls[0].command.lines[0].sku, "SKU-1");
  assert.equal(invoiceCalls[0].command.totals.currencyCode, "COP");
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
  const invoiceCalls: Array<{
    command: { externalReference: string; totals: { totalAmount: number } };
    source: { type?: string; id?: string | null } | undefined;
  }> = [];

  const billing = {
    configRepository: {
      findEnabledForTenant: async () => [{ id: "config-1" }],
      findDefaultForTenant: async () => ({ id: "config-1" }),
    },
    providerResolver: {
      resolve: async () => ({
        context: {
          tenantId: ids.tenant,
          providerId: ids.provider,
          providerConfigId: "config-1",
          environment: "TEST" as const,
          baseUrl: null,
          credentialReference: null,
          settings: {},
        },
      }),
    },
    billingService: {
      createInvoiceDocument: async (
        command: any,
        _client?: PoolClient,
        source?: { type?: string; id?: string | null }
      ) => {
        invoiceCalls.push({
          command,
          source,
        });
      },
    },
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
      }),
      findActiveFinalConsumer: async () => null,
    },
  };

  const { service } = buildCreateSaleService([], billing);

  const result = await service.createSaleFromOrderDelivery(
    {
      orderId: ids.order,
      type: "CASH",
      payments: [],
    },
    posContext
  );

  assert.equal(invoiceCalls.length, 1);
  assert.equal(
    invoiceCalls[0].command.externalReference,
    buildDeterministicSaleExternalReference(ids.tenant, ids.sale)
  );
  assert.equal(invoiceCalls[0].source?.type, "SALE");
  assert.equal(invoiceCalls[0].source?.id, ids.sale);
  assert.equal(invoiceCalls[0].command.totals.totalAmount, 3000);
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
