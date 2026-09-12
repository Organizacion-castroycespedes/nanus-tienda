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

const createService = () => {
  const calls: Array<{ method: string; value: unknown }> = [];
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
      return saleId === "sale-a"
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
  };
  return {
    service: new OperationalSalesService(scopeService as any, repository as any, billingClient as any),
    calls,
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
