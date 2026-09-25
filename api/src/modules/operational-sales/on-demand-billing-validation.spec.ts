import assert from "node:assert/strict";
import test from "node:test";
import { ParametersService } from "../parameters/parameters.service";
import { evaluateElectronicBillingEligibility } from "../integration-outbox/contracts/electronic-billing-eligibility";
import { isEligibleForElectronicBillingRequest } from "../../../../web/modules/operational-sales/services/operational-sales.service";
import { OperationalSalesService } from "./operational-sales.service";
import { BadRequestException } from "@nestjs/common";

test("On-Demand Validation 1: ParametersService correctly resolves ON_DEMAND mode", async () => {
  const repository = {
    resolveValue: async (code: string) => {
      if (code === "SEND_INVOICE") return "AUTOMATIC";
      if (code === "GENERATE_INVOICE") return "ON_DEMAND";
      return "DISABLED";
    },
  };
  const service = new ParametersService(repository as never);
  const policy = await service.resolveElectronicBillingPolicy("tenant-test");
  assert.equal(policy.enabled, true);
  assert.equal(policy.mode, "ON_DEMAND");
  assert.equal(policy.rawMode, "ON_DEMAND");
});

test("On-Demand Validation 2: isEligibleForElectronicBillingRequest predicate accurately gates on-demand billing", () => {
  const baseSale = {
    status: "CONFIRMED",
    paymentStatus: "PAID",
    electronicBilling: null,
    customer: { id: "cust-1", name: "Cliente Prueba" },
  };

  // Eligible on-demand sale
  assert.equal(isEligibleForElectronicBillingRequest(baseSale), true);

  // Ineligible if already billed
  assert.equal(
    isEligibleForElectronicBillingRequest({
      ...baseSale,
      electronicBilling: {
        status: "ACCEPTED",
        electronicDocumentId: "doc-1",
        documentNumber: "SETP-990000001",
        cufe: "cufe-abc",
        providerDocumentId: "prov-1",
        providerStatus: "ACCEPTED",
      },
    }),
    false
  );

  // Ineligible if not confirmed
  assert.equal(
    isEligibleForElectronicBillingRequest({
      ...baseSale,
      status: "DRAFT",
    }),
    false
  );

  // Ineligible if unpaid
  assert.equal(
    isEligibleForElectronicBillingRequest({
      ...baseSale,
      paymentStatus: "PENDING",
    }),
    false
  );

  // Ineligible if missing customer
  assert.equal(
    isEligibleForElectronicBillingRequest({
      ...baseSale,
      customer: { id: "", name: null },
    }),
    false
  );
});

test("On-Demand Validation 3: evaluateElectronicBillingEligibility prevents DIAN rejection on incomplete customer fiscal data when tax exists", () => {
  // Case A: Has taxes, but customer is Final Consumer / incomplete fiscal data -> INCOMPLETE_CUSTOMER_FISCAL_DATA
  const ineligibleResult = evaluateElectronicBillingEligibility({
    saleStatus: "CONFIRMED",
    paymentStatus: "PAID",
    customerId: "cust-final",
    documentStatuses: [],
    requestExists: false,
    hasTaxLines: true,
    customerFiscalDataComplete: false,
    isFinalConsumer: true,
  });
  assert.equal(ineligibleResult, "INCOMPLETE_CUSTOMER_FISCAL_DATA");

  // Case B: Has taxes and customer fiscal data is complete -> ELIGIBLE
  const eligibleResult = evaluateElectronicBillingEligibility({
    saleStatus: "CONFIRMED",
    paymentStatus: "PAID",
    customerId: "cust-fiscal",
    documentStatuses: [],
    requestExists: false,
    hasTaxLines: true,
    customerFiscalDataComplete: true,
    isFinalConsumer: false,
  });
  assert.equal(eligibleResult, "ELIGIBLE");

  // Case C: Document already accepted -> ALREADY_ACCEPTED
  const documentExistsResult = evaluateElectronicBillingEligibility({
    saleStatus: "CONFIRMED",
    paymentStatus: "PAID",
    customerId: "cust-fiscal",
    documentStatuses: ["ACCEPTED"],
    requestExists: false,
    hasTaxLines: true,
    customerFiscalDataComplete: true,
    isFinalConsumer: false,
  });
  assert.equal(documentExistsResult, "ALREADY_ACCEPTED");
});

test("On-Demand Validation 4: Pre-invoice wizard customer update and payment correction safeguard data integrity", async () => {
  const auditEvents: Array<Record<string, unknown>> = [];
  const dbQueries: Array<{ sql: string; params?: unknown[] }> = [];

  const mockClient = {
    query: async (sql: string, params?: unknown[]) => {
      dbQueries.push({ sql, params });
      if (sql.includes("FROM sales") || sql.includes("from sales")) {
        return {
          rows: [
            {
              id: "sale-1",
              tenant_id: "tenant-1",
              branch_id: "branch-1",
              status: "CONFIRMED",
              total: 50000,
              payment_status: "PAID",
              customer_id: "cust-1",
              billing_status: null,
            },
          ],
        };
      }
      if (sql.includes("FROM customers") || sql.includes("from customers")) {
        return {
          rows: [{ id: "cust-2", name: "Nuevo Cliente" }],
        };
      }
      if (sql.includes("payment_methods")) {
        return {
          rows: [{ id: "pm-card", tipo: "CARD", codigo: "DEBIT", nombre: "Tarjeta Débito" }],
        };
      }
      if (sql.includes("cash_sessions")) {
        return {
          rows: [{ id: "session-1", branch_id: "branch-1", cash_register_id: "reg-1", status: "OPEN" }],
        };
      }
      if (sql.includes("INSERT INTO payments")) {
        return {
          rows: [{ id: "new-pm-1" }],
        };
      }
      return { rows: [] };
    },
    release: () => undefined,
  };

  const db = {
    getClient: async () => mockClient,
  };

  const repository = {
    findById: async () => ({ id: "sale-1", customer: { id: "cust-2", name: "Nuevo Cliente" } }),
  };

  const auditService = {
    logEvent: (event: Record<string, unknown>) => auditEvents.push(event),
  };

  const scopeService = {
    resolveScope: async () => ({ tenantId: "tenant-1", branchIds: ["branch-1"], allTenants: false }),
    resolveQueryScope: async () => ({ tenantId: "tenant-1", branchIds: ["branch-1"], allTenants: false }),
  };

  const service = new OperationalSalesService(
    scopeService as never,
    repository as never,
    {} as never,
    auditService as never,
    {} as never,
    db as never,
  );

  const actor = {
    tenantId: "tenant-1",
    userId: "user-1",
    role: "ADMIN",
    branchId: "branch-1",
  };

  // 1. Update customer successfully
  const updatedSale = await service.updateCustomer(actor as never, "sale-1", {
    customerId: "cust-2",
  });
  assert.equal(updatedSale.customer.id, "cust-2");
  assert.equal(auditEvents[0]?.action, "UPDATE_SALE_CUSTOMER");

  // 2. Reject payment correction if unbalanced
  await assert.rejects(
    async () => {
      await service.correctPayments(actor as never, "sale-1", {
        reason: "Corrección por tarjeta",
        payments: [{ paymentMethodId: "pm-1", amount: 40000 }], // total is 50000, difference 10000
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match((err as Error).message, /no coincide con el total de la venta/);
      return true;
    }
  );

  // 3. Reject payment correction if reason is too short
  await assert.rejects(
    async () => {
      await service.correctPayments(actor as never, "sale-1", {
        reason: "err",
        payments: [{ paymentMethodId: "pm-1", amount: 50000 }],
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match((err as Error).message, /motivo de corrección obligatorio/i);
      return true;
    }
  );

  // 4. Accept payment correction when balanced and reason is valid
  await service.correctPayments(actor as never, "sale-1", {
    reason: "Cliente pagó por datáfono Bancolombia",
    payments: [
      {
        paymentMethodId: "pm-card",
        amount: 50000,
        reference: "AUTH-89823",
        financialInstitutionId: "bank-bancolombia",
      },
    ],
  });

  assert.equal(auditEvents[1]?.action, "CORRECT_SALE_PAYMENTS");
});
