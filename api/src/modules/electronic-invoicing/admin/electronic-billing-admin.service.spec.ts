import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { BillingAdminRequestError } from "../../integration-outbox/services/billing-integration-client";
import { ElectronicBillingAdminService } from "./electronic-billing-admin.service";

const tenantId = "00000000-0000-4000-8000-000000000001";

test("admin service validates target tenant before billing backend call", async () => {
  const calls: string[] = [];
  const service = new ElectronicBillingAdminService(
    { query: async () => ({ rows: [] }) } as never,
    { getTenantElectronicBillingConfiguration: async () => {
      calls.push("billing");
      return { tenantId, configurations: [] };
    } } as never,
  );

  await assert.rejects(() => service.getTenantConfiguration(tenantId), NotFoundException);
  assert.deepEqual(calls, []);
});

test("admin service scopes billing read to the requested existing tenant", async () => {
  const calls: string[] = [];
  const service = new ElectronicBillingAdminService(
    { query: async (_sql: string, params: unknown[]) => {
      calls.push(String(params[0]));
      return { rows: [{ id: tenantId }] };
    } } as never,
    { getTenantElectronicBillingConfiguration: async (id: string) => {
      calls.push(id);
      return { tenantId: id, configurations: [] };
    } } as never,
  );

  const result = await service.getTenantConfiguration(tenantId);
  assert.equal(result.tenantId, tenantId);
  assert.deepEqual(calls, [tenantId, tenantId]);
});

test("admin identity read compares authenticated FactuCore tenant and issuer safely", async () => {
  const service = new ElectronicBillingAdminService(
    { query: async (sql: string) => sql.includes("tenants_detalles")
      ? { rows: [{ nit: "900.123.456", dv: "7", razonSocial: "Empresa Uno" }] }
      : { rows: [{ id: tenantId }] } } as never,
    { getTenantFactuCoreContext: async () => ({
      tenantId,
      providerCode: "FACTUCORE",
      configuredFactuCoreTenantId: "fc-tenant-1",
      context: {
        apiClientId: "client-1",
        tenantId: "fc-tenant-1",
        environment: "QA",
        issuer: {
          identificationTypeCode: "31",
          identificationNumber: "900123456",
          verificationDigit: "7",
          legalName: "EMPRESA UNO",
          tradeName: null,
          complete: true,
        },
        resolution: { configured: true, status: "ACTIVE", isDefault: true, validTo: null, remaining: 10 },
        dianReadiness: {
          status: "READY",
          configurationComplete: true,
          issuerComplete: true,
          resolutionConfigured: true,
          configurationEnvironment: "QA",
          failedChecks: [],
          basis: "CONFIGURATION_ONLY",
        },
      },
    }) } as never,
  );

  const result = await service.getTenantFactuCoreContext(tenantId);
  assert.equal(result.identityStatus, "MATCH");
  assert.equal(result.factuCore?.dianReadiness.status, "READY");
});

test("admin identity read never treats a tenant mismatch as ready", async () => {
  const service = new ElectronicBillingAdminService(
    { query: async () => ({ rows: [{ id: tenantId }] }) } as never,
    { getTenantFactuCoreContext: async () => ({
      tenantId,
      providerCode: "FACTUCORE",
      configuredFactuCoreTenantId: "fc-principal",
      context: {
        apiClientId: "client-1",
        tenantId: "fc-other",
        environment: "QA",
        issuer: { identificationTypeCode: null, identificationNumber: null, verificationDigit: null, legalName: null, tradeName: null, complete: false },
        resolution: { configured: false, status: null, isDefault: false, validTo: null, remaining: null },
        dianReadiness: { status: "UNKNOWN", configurationComplete: false, issuerComplete: false, resolutionConfigured: false, configurationEnvironment: null, failedChecks: ["READINESS_UNAVAILABLE"], basis: "CONFIGURATION_ONLY" },
      },
    }) } as never,
  );

  const result = await service.getTenantFactuCoreContext(tenantId);
  assert.equal(result.identityStatus, "MISMATCH");
  assert.equal(result.factuCore?.tenantId, "fc-other");
});

test("admin identity read returns sanitized QA diagnostic metadata only", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "qa";
  const diagnostic = {
    category: "FACTUCORE_AUTHORIZATION_403" as const,
    layer: "factucore-http" as const,
    upstreamStatus: 403,
    responseBodyPresent: true,
    correlationId: "corr-qa-2",
  };
  const service = new ElectronicBillingAdminService(
    { query: async () => ({ rows: [{ id: tenantId }] }) } as never,
    { getTenantFactuCoreContext: async () => { throw new BillingAdminRequestError(503, "hidden", diagnostic); } } as never,
  );

  try {
    const result = await service.getTenantFactuCoreContext(tenantId);
    assert.equal(result.identityStatus, "UNAVAILABLE");
    assert.deepEqual(result.diagnostic, diagnostic);
    assert.doesNotMatch(JSON.stringify(result), /hidden|secret|ciphertext|authorization header/i);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

const providerResponse = {
  id: "00000000-0000-4000-8000-000000000002",
  code: "FACTUCORE",
  name: "FactuCore",
  providerType: "ELECTRONIC_BILLING" as const,
  active: true,
  capabilities: { invoice: true },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const createPayload = {
  code: " factucore ",
  name: "FactuCore",
  providerType: "ELECTRONIC_BILLING",
  capabilities: {
    invoice: true,
    creditNote: true,
    debitNote: true,
    retry: true,
    pdf: true,
    xml: true,
    signedXml: true,
    asyncStatus: true,
    attachmentDownload: true,
  },
};

test("provider proxy validates and forwards only safe create DTO", async () => {
  let forwarded: unknown;
  const service = new ElectronicBillingAdminService(
    {} as never,
    { createElectronicBillingProvider: async (payload: unknown) => { forwarded = payload; return providerResponse; } } as never,
  );
  const result = await service.createProvider(createPayload);
  assert.equal(result.code, "FACTUCORE");
  assert.deepEqual(forwarded, { ...createPayload, code: "FACTUCORE" });
});

test("provider proxy rejects secret-shaped and malformed mutation payloads", async () => {
  const calls: unknown[] = [];
  const service = new ElectronicBillingAdminService(
    {} as never,
    { createElectronicBillingProvider: async (payload: unknown) => { calls.push(payload); return providerResponse; } } as never,
  );
  await assert.rejects(() => service.createProvider({ ...createPayload, clientSecret: "secret" }), BadRequestException);
  await assert.rejects(() => service.updateProvider("not-a-uuid", { name: "x" }), BadRequestException);
  assert.equal(calls.length, 0);
});

test("provider proxy maps Billing conflicts, not-found and unavailable errors", async () => {
  const makeService = (error: Error) => new ElectronicBillingAdminService(
    {} as never,
    { createElectronicBillingProvider: async () => { throw error; } } as never,
  );
  const error = (statusCode: number) => new BillingAdminRequestError(statusCode, "hidden");
  await assert.rejects(() => makeService(error(409)).createProvider(createPayload), ConflictException);
  await assert.rejects(() => makeService(error(404)).createProvider(createPayload), NotFoundException);
  await assert.rejects(() => makeService(error(503)).createProvider(createPayload), ServiceUnavailableException);
});
