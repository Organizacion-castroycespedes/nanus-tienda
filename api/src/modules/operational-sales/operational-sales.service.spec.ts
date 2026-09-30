import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OperationalSalesService } from "./operational-sales.service";

const scope = {
  tenantId: "tenant-a",
  allTenants: false,
  branchIds: ["branch-a"],
  requiresCurrentShift: false,
};

const acceptedCreditNote = {
  kind: "OUTCOME",
  electronicDocument: {
    electronicDocumentId: "nc-doc-1",
    documentType: "CREDIT_NOTE",
    status: "ACCEPTED",
    fullNumber: "NC-1",
    cufe: null,
    cude: "cude-1",
    providerStatus: "ACCEPTED",
    failureClass: "ACCEPTED",
    retryable: false,
    errorCode: null,
    errorMessage: null,
    failures: [],
  },
};

const createService = (options: { creditNoteResult?: unknown } = {}) => {
  const calls: Array<{ method: string; value: unknown }> = [];
  const auditEvents: Array<Record<string, unknown>> = [];
  const scopeService = {
    resolveQueryScope: async (_actor: unknown, filters: unknown) => {
      calls.push({ method: "resolveQueryScope", value: filters });
      return scope;
    },
    resolveScope: async () => scope,
  };
  const repository = {
    findMany: async (resolvedScope: unknown, query: unknown) => {
      calls.push({ method: "findMany", value: { resolvedScope, query } });
      return { items: [], page: 1, limit: 25, total: 0 };
    },
    findById: async (resolvedScope: unknown, saleId: string) => {
      calls.push({ method: "findById", value: { resolvedScope, saleId } });
      return saleId === "sale-a" || saleId === "sale-accepted-fe"
        ? { id: saleId }
        : saleId === "sale-refresh"
          ? {
              id: saleId,
              electronicBilling: {
                status: "PROCESSING",
                electronicDocumentId: "document-a",
              },
            }
          : saleId === "sale-retry"
            ? {
                id: saleId,
                electronicBilling: {
                  status: "REJECTED",
                  electronicDocumentId: "document-retry",
                },
              }
          : null;
    },
  };
  const billingClient = {
    refreshElectronicDocumentStatus: async (tenantId: string, electronicDocumentId: string) => {
      calls.push({ method: "refreshElectronicDocumentStatus", value: { tenantId, electronicDocumentId } });
      return { outcome: "UNCHANGED" };
    },
    getElectronicDocumentRetryability: async (tenantId: string, electronicDocumentId: string) => {
      calls.push({ method: "getElectronicDocumentRetryability", value: { tenantId, electronicDocumentId } });
      return {
        canRetry: true,
        canRecoverProviderCreateIntent: true,
        retryClass: "PRE_PROVIDER",
        decision: "SAFE_PRE_PROVIDER_RECOVERY",
        reasonCode: "PRE_PROVIDER_RECOVERABLE",
        requiredAction: "PROCESS_DOCUMENT",
        requiresReconciliation: false,
        providerDocumentExists: false,
        safeUserMessage: "safe",
      };
    },
    retryElectronicDocument: async (tenantId: string, electronicDocumentId: string) => {
      calls.push({ method: "retryElectronicDocument", value: { tenantId, electronicDocumentId } });
      return {
        allowed: true,
        canRetry: true,
        disposition: "RETRY_STARTED",
        reasonCode: "PRE_PROVIDER_RECOVERABLE",
        requiredAction: "PROCESS_DOCUMENT",
        status: "PROCESSING",
        processingStage: "PROVIDER_CREATE_INTENT",
        safeUserMessage: "done",
      };
    },
    recoverProviderCreateIntent: async (tenantId: string, electronicDocumentId: string) => {
      calls.push({ method: "recoverProviderCreateIntent", value: { tenantId, electronicDocumentId } });
      return {
        allowed: true,
        recovery: "CONFIRMED_PROVIDER_ABSENCE",
        canRetry: true,
        disposition: "RECOVERY_REQUEUED",
        reasonCode: "REMOTE_NOT_FOUND_RECOVERED",
        requiredAction: "PROCESS_DOCUMENT",
        status: "PENDING",
        processingStage: "PRE_PROVIDER_CREATE",
        safeUserMessage: "recovered",
      };
    },
    issueCreditNote: async (tenantId: string, electronicDocumentId: string, payload: any) => {
      calls.push({ method: "issueCreditNote", value: { tenantId, electronicDocumentId, payload } });
      return options.creditNoteResult ?? acceptedCreditNote;
    },
    issueDebitNote: async (tenantId: string, electronicDocumentId: string, payload: any) => {
      calls.push({ method: "issueDebitNote", value: { tenantId, electronicDocumentId, payload } });
      return {
        id: "nd-doc-1",
        documentId: "nd-doc-1",
        status: "SENT",
        queued: true,
      };
    },
  };
  const auditService = {
    logEvent: (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  };
  const executedQueries: Array<{ text: string; params?: unknown[] }> = [];
  const db = {
    getClient: async () => ({
      query: async (text: string, params?: unknown[]) => {
        executedQueries.push({ text, params });
        if (text.includes("FROM sales") && text.includes("FOR UPDATE")) {
          const saleId = params?.[0];
          if (saleId === "sale-cancelled") {
            return { rows: [{ id: saleId, tenant_id: "tenant-a", branch_id: "branch-a", customer_id: "cust-1", total: "100.00", status: "CANCELLED" }] };
          }
          if (saleId === "sale-not-found") {
            return { rows: [] };
          }
          return { rows: [{ id: saleId, tenant_id: "tenant-a", branch_id: "branch-a", customer_id: "cust-1", total: "100.00", status: "CONFIRMED", payment_status: "PAID" }] };
        }
        if (text.includes("FROM electronic_documents")) {
          const saleId = params?.[1];
          if (saleId === "sale-accepted-fe") {
            return { rows: [{ id: "doc-1", status: "ACCEPTED" }] };
          }
          return { rows: [] };
        }
        if (text.includes("FROM customers")) {
          const custId = params?.[0];
          if (custId === "cust-valid") {
            return { rows: [{ id: "cust-valid", name: "Valid Customer" }] };
          }
          return { rows: [] };
        }
        if (text.includes("FROM cash_sessions")) {
          return { rows: [{ id: "session-open-1", branch_id: "branch-a", cash_register_id: "reg-1", status: "OPEN" }] };
        }
        if (text.includes("FROM payment_methods")) {
          return {
            rows: [
              { id: "pm-cash", codigo: "CASH", nombre: "Efectivo", tipo: "CASH", requires_reference: false },
              { id: "pm-transfer", codigo: "TRANSFER", nombre: "Transferencia", tipo: "TRANSFER", requires_reference: true },
            ],
          };
        }
        if (text.includes("FROM payments") && text.includes("FOR UPDATE")) {
          return {
            rows: [
              { id: "pay-1", payment_method_id: "pm-cash", amount: "100.00", reference_number: null, cash_session_id: "session-open-1", status: "COMPLETED" },
            ],
          };
        }
        if (text.includes("INSERT INTO payments")) {
          return { rows: [{ id: "pay-new-1" }] };
        }
        if (text.includes("INSERT INTO sale_void_requests")) {
          return { rows: [{ id: "void-request-1", attempt_count: 1, next_attempt_at: new Date() }] };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  };
  return {
    service: new OperationalSalesService(
      scopeService as any,
      repository as any,
      billingClient as any,
      auditService as any,
      undefined,
      db as any,
    ),
    calls,
    auditEvents,
    executedQueries,
  };
};

test("operational sales list normalizes pagination and sends resolved scope", async () => {
  const { service, calls } = createService();

  const result = await service.list(
    { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] },
    { page: "2", limit: "50", sortBy: "total", sortDirection: "asc" }
  );

  assert.equal(result.page, 1);
  assert.equal(calls[0].method, "resolveQueryScope");
  assert.equal(calls[1].method, "findMany");
  assert.equal((calls[1].value as any).query.limit, 50);
});

test("operational sales list rejects unsafe pagination and sorting", async () => {
  const { service } = createService();

  await assert.rejects(
    () => service.list({ id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] }, { limit: "101" }),
    (error: unknown) => error instanceof BadRequestException
  );
  await assert.rejects(
    () => service.list({ id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] }, { sortBy: "tenant_id" }),
    (error: unknown) => error instanceof BadRequestException
  );
});

test("operational sale detail performs a direct scoped lookup", async () => {
  const { service, calls } = createService();

  assert.deepEqual(
    await service.detail({ id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] }, "sale-a"),
    { id: "sale-a" }
  );
  await assert.rejects(
    () => service.detail({ id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] }, "sale-b"),
    (error: unknown) => error instanceof NotFoundException
  );
  assert.equal(calls.filter((call) => call.method === "findById").length, 2);
});

test("operational status refresh uses the internal read/reconcile client", async () => {
  const { service, calls } = createService();

  await service.refreshElectronicBillingStatus(
    { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] },
    "sale-refresh",
  );

  const refresh = calls.find((call) => call.method === "refreshElectronicDocumentStatus");
  assert.deepEqual(refresh?.value, {
    tenantId: "tenant-a",
    electronicDocumentId: "document-a",
  });
});

test("operational retry uses the narrow safe client and returns its result", async () => {
  const { service, calls } = createService();

  const result = await service.retryElectronicBilling(
    { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] },
    "sale-retry",
  );

  assert.equal(result.retryResult.disposition, "RETRY_STARTED");
  assert.equal(calls.some((call) => call.method === "retryElectronicDocument"), true);
});

test("operational pre-provider recovery uses the dedicated reconciled action", async () => {
  const { service, calls, auditEvents } = createService();

  const result = await service.recoverProviderCreateIntent(
    { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] },
    "sale-retry",
  );

  assert.equal(result.recoveryResult.recovery, "CONFIRMED_PROVIDER_ABSENCE");
  assert.equal(calls.some((call) => call.method === "recoverProviderCreateIntent"), true);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "OP_FE_PROVIDER_RECOVERY");
  assert.ok(String(auditEvents[0].action).length <= 50);
});

test("operational detail exposes backend-owned provider-create recovery capability", async () => {
  const { service } = createService();

  const result = await service.detail(
    { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] },
    "sale-retry",
  );

  assert.equal(result.electronicBilling.retryability.canRecoverProviderCreateIntent, true);
});

test("updateCustomer rejects missing customerId or cancelled sale", async () => {
  const { service } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await assert.rejects(
    () => service.updateCustomer(actor, "sale-a", { customerId: "" }),
    /customerId es requerido/
  );

  await assert.rejects(
    () => service.updateCustomer(actor, "sale-cancelled", { customerId: "cust-valid" }),
    /No se puede modificar el cliente de una venta cancelada o reembolsada/
  );
});

test("updateCustomer rejects sale with already ACCEPTED electronic document", async () => {
  const { service } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await assert.rejects(
    () => service.updateCustomer(actor, "sale-accepted-fe", { customerId: "cust-valid" }),
    /ya tiene factura electrónica aceptada/
  );
});

test("updateCustomer updates customer and records audit event", async () => {
  const { service, auditEvents, executedQueries } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await service.updateCustomer(actor, "sale-a", { customerId: "cust-valid" });

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "UPDATE_SALE_CUSTOMER");
  assert.equal(auditEvents[0].entityId, "sale-a");
  assert.equal((auditEvents[0].after as any).customerId, "cust-valid");
  assert.ok(executedQueries.some((q) => q.text.includes("UPDATE sales SET customer_id = $1")));
});

test("correctPayments rejects missing reason or unmatched total", async () => {
  const { service } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await assert.rejects(
    () => service.correctPayments(actor, "sale-a", {
      reason: "abc",
      payments: [{ paymentMethodId: "pm-cash", amount: 100 }],
    }),
    /Motivo de corrección obligatorio/
  );

  await assert.rejects(
    () => service.correctPayments(actor, "sale-a", {
      reason: "Corrección por error de digitación",
      payments: [{ paymentMethodId: "pm-cash", amount: 50 }],
    }),
    /no coincide con el total de la venta/
  );
});

test("correctPayments cancels previous payments, inserts new payments and audits", async () => {
  const { service, auditEvents, executedQueries } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await service.correctPayments(actor, "sale-a", {
    reason: "Cambio de efectivo a transferencia",
    payments: [{ paymentMethodId: "pm-transfer", amount: 100, reference: "TRX-9988" }],
  });

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "CORRECT_SALE_PAYMENTS");
  assert.equal((auditEvents[0].after as any).reason, "Cambio de efectivo a transferencia");
  assert.ok(executedQueries.some((q) => q.text.includes("UPDATE payments")));
  assert.ok(executedQueries.some((q) => q.text.includes("INSERT INTO payments")));
});

test("voidSale rejects cancelled sale or missing reason", async () => {
  const { service } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await assert.rejects(
    () => service.voidSale(actor, "sale-a", { reason: "abc" }),
    /El motivo de anulación debe tener al menos 5 caracteres/
  );

  await assert.rejects(
    () => service.voidSale(actor, "sale-cancelled", { reason: "Anulación de prueba" }),
    /La venta ya ha sido anulada previamente/
  );
});

test("voidSale executes local voiding for sale without electronic invoice", async () => {
  const { service, auditEvents, executedQueries } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await service.voidSale(actor, "sale-a", {
    reason: "Cliente desistió de la compra",
    returnInventory: true,
  });

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "VOID_SALE");
  assert.equal((auditEvents[0].after as any).status, "CANCELLED");
  assert.ok(executedQueries.some((q) => q.text.includes("UPDATE sales")));
});

test("voidSale voids only after the online credit note is accepted by DIAN", async () => {
  const { service, calls, auditEvents, executedQueries } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  const result = await service.voidSale(actor, "sale-accepted-fe", {
    reason: "Devolución total con nota crédito",
    discrepancyResponseCode: "2",
  });

  const ncCall = calls.find((c) => c.method === "issueCreditNote");
  assert.ok(ncCall);
  assert.equal((ncCall.value as any).electronicDocumentId, "doc-1");
  assert.equal((ncCall.value as any).payload.discrepancyResponseCode, "2");
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "VOID_SALE");
  assert.equal((result as any).creditNote.status, "ACCEPTED");
  assert.ok(executedQueries.some((q) => q.text.includes("UPDATE sales")));
  assert.ok(!executedQueries.some((q) => q.text.includes("INSERT INTO electronic_documents")));
  assert.ok(executedQueries.some((q) => q.text.includes("document_type = 'INVOICE'")));
});

test("voidSale keeps the sale when DIAN rejects the credit note and returns code + solution", async () => {
  const { service, executedQueries } = createService({
    creditNoteResult: {
      kind: "OUTCOME",
      electronicDocument: {
        ...acceptedCreditNote.electronicDocument,
        status: "REJECTED",
        failureClass: "DIAN_REJECTED",
        errorCode: "CBA06",
        errorMessage: "Regla: CBA06, Rechazo: referencia",
        failures: [{
          code: "CBA06",
          message: "Regla: CBA06, Rechazo: referencia",
          origin: "DIAN",
          path: null,
          severity: "REJECTION",
          title: "Referencia de nota crédito",
          solution: "Verificar que la factura origen esté aceptada y reemitir.",
          retryable: false,
        }],
      },
    },
  });
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await assert.rejects(
    () => service.voidSale(actor, "sale-accepted-fe", { reason: "Devolución total con nota crédito" }),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
      assert.equal(body.errorCode, "CBA06");
      assert.equal(body.solution, "Verificar que la factura origen esté aceptada y reemitir.");
      return true;
    },
  );
  assert.ok(!executedQueries.some((q) => q.text.includes("UPDATE sales")));
});

test("voidSale queues a pending void when the credit note hits a network failure", async () => {
  const { service, auditEvents, executedQueries } = createService({
    creditNoteResult: { kind: "NETWORK_FAILURE", message: "Billing backend request timed out" },
  });
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  const result = await service.voidSale(actor, "sale-accepted-fe", { reason: "Devolución total con nota crédito" });

  assert.equal((result as any).voidRequest.status, "PENDING_CREDIT_NOTE");
  assert.equal((result as any).creditNote.status, "QUEUED_NETWORK");
  assert.ok(executedQueries.some((q) => q.text.includes("INSERT INTO sale_void_requests")));
  assert.ok(!executedQueries.some((q) => q.text.includes("UPDATE sales")));
  assert.equal(auditEvents[0].action, "VOID_SALE_PENDING_CREDIT_NOTE");
});

test("processDueVoidRequests skips quietly when V096 is not applied", async () => {
  const service = new OperationalSalesService(
    {} as never,
    {} as never,
    {} as never,
    undefined,
    undefined,
    {
      getClient: async () => ({
        query: async () => {
          throw Object.assign(new Error('relation "sale_void_requests" does not exist'), { code: "42P01" });
        },
        release: () => undefined,
      }),
    } as never,
  );

  assert.deepEqual(await service.processDueVoidRequests(), { processed: 0 });
});

test("issueDebitNote rejects sale without accepted electronic invoice", async () => {
  const { service } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await assert.rejects(
    () => service.issueDebitNote(actor, "sale-a", {
      reason: "Intereses por mora",
      discrepancyResponseCode: "1",
      amount: 15000,
    }),
    /No se puede emitir una Nota Débito sin una factura electrónica aceptada previa/
  );
});

test("issueDebitNote dispatches to Factucore and saves document", async () => {
  const { service, calls, auditEvents, executedQueries } = createService();
  const actor = { id: "user-a", tenantId: "tenant-a", roles: ["ADMIN"] };

  await service.issueDebitNote(actor, "sale-accepted-fe", {
    reason: "Intereses moratorios",
    discrepancyResponseCode: "1",
    amount: 15000,
  });

  const ndCall = calls.find((c) => c.method === "issueDebitNote");
  assert.ok(ndCall);
  assert.equal((ndCall.value as any).electronicDocumentId, "doc-1");
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "ISSUE_DEBIT_NOTE");
  assert.ok(executedQueries.some((q) => q.text.includes("INSERT INTO electronic_documents")));
});


