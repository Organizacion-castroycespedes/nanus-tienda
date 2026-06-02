import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { FiscalLookupService } from "../src/modules/fiscal-lookup/fiscal-lookup.service";
import { MockFiscalProviderService } from "../src/modules/providers/mock/mock-fiscal-provider.service";

const buildService = () =>
  new FiscalLookupService(new MockFiscalProviderService());

test("fiscal lookup preview CUSTOMER responds mock", async () => {
  const service = buildService();

  const result = await service.preview({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });

  assert.equal(result.provider, "MOCK_LOCAL");
  assert.equal(result.partyType, "CUSTOMER");
  assert.equal(result.documentTypeCode, "31");
  assert.equal(result.documentNumberNormalized, "900123456");
  assert.equal(result.legalName, "Cliente Mock 900123456");
  assert.equal(result.fiscalEmail, "cliente.mock@example.com");
  assert.equal(result.lookupStatus, "FOUND");
});

test("fiscal lookup preview SUPPLIER responds mock", async () => {
  const service = buildService();

  const result = await service.preview({
    partyType: "SUPPLIER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });

  assert.equal(result.provider, "MOCK_LOCAL");
  assert.equal(result.partyType, "SUPPLIER");
  assert.equal(result.legalName, "Proveedor Mock 900123456");
  assert.equal(result.fiscalEmail, "proveedor.mock@example.com");
});

test("documentNumber is normalized", async () => {
  const service = buildService();

  const result = await service.preview({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "900.123-456 7",
  });

  assert.equal(result.documentNumberNormalized, "9001234567");
});

test("invalid partyType fails", async () => {
  const service = buildService();

  await assert.rejects(
    () =>
      service.preview({
        partyType: "PARTNER",
        documentTypeCode: "31",
        documentNumber: "900123456",
      }),
    BadRequestException
  );
});

test("current provider is MOCK_LOCAL", async () => {
  const service = buildService();

  const result = await service.preview({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "1",
  });

  assert.equal(result.provider, "MOCK_LOCAL");
});
