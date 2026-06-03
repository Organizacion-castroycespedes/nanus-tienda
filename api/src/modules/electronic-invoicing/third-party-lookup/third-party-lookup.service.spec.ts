import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ThirdPartyLookupMockAdapter } from "./third-party-lookup.mock-adapter";
import {
  ThirdPartyLookupService,
  normalizeThirdPartyLookupDocument,
} from "./third-party-lookup.service";

const buildService = () =>
  new ThirdPartyLookupService(new ThirdPartyLookupMockAdapter());

const withLookupEnv = async (
  enabled: string | undefined,
  mode: string | undefined,
  fn: () => Promise<void> | void
) => {
  const previousEnabled = process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED;
  const previousMode = process.env.DIAN_THIRD_PARTY_LOOKUP_MODE;
  if (enabled === undefined) {
    delete process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED;
  } else {
    process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED = enabled;
  }
  if (mode === undefined) {
    delete process.env.DIAN_THIRD_PARTY_LOOKUP_MODE;
  } else {
    process.env.DIAN_THIRD_PARTY_LOOKUP_MODE = mode;
  }

  try {
    await fn();
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED;
    } else {
      process.env.DIAN_THIRD_PARTY_LOOKUP_ENABLED = previousEnabled;
    }
    if (previousMode === undefined) {
      delete process.env.DIAN_THIRD_PARTY_LOOKUP_MODE;
    } else {
      process.env.DIAN_THIRD_PARTY_LOOKUP_MODE = previousMode;
    }
  }
};

describe("ThirdPartyLookupService", () => {
  it("normalizes lookup document numbers", () => {
    assert.equal(normalizeThirdPartyLookupDocument(" 900.123-456 "), "900123456");
    assert.equal(normalizeThirdPartyLookupDocument(" nit-abc-123 "), "NITABC123");
    assert.equal(normalizeThirdPartyLookupDocument(" --- "), null);
  });

  it("returns disabled preview when lookup env is off", async () => {
    await withLookupEnv("false", "disabled", () => {
      const service = buildService();

      const preview = service.lookup({
        tenantId: "tenant-1",
        partyType: "CUSTOMER",
        documentTypeCode: "31",
        documentNumber: "900123456",
      });

      assert.equal(preview.lookupStatus, "SKIPPED");
      assert.equal(preview.statusCode, "DISABLED");
      assert.equal(preview.provider, "NONE");
      assert.equal(preview.data, null);
    });
  });

  it("returns mock provider preview without raw payload", async () => {
    await withLookupEnv("true", "mock", () => {
      const service = buildService();

      const preview = service.lookup({
        tenantId: "tenant-1",
        partyType: "SUPPLIER",
        documentTypeCode: "31",
        documentNumber: "900.123-456",
      });

      assert.equal(preview.lookupStatus, "FOUND");
      assert.equal(preview.provider, "MOCK_LOCAL");
      assert.equal(preview.data?.legalName, "Proveedor Mock SAS 3456");
      assert.equal(preview.documentNumberNormalized, "900123456");
      assert.equal(Object.prototype.hasOwnProperty.call(preview, "raw"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(preview, "soap"), false);
    });
  });

  it("validates fields selected for apply", () => {
    const service = buildService();

    assert.deepEqual(
      service.resolveFieldsToApply({
        fieldsToApply: ["legalName", "legalName", "fiscalEmail"],
      }),
      ["legalName", "fiscalEmail"]
    );
    assert.throws(
      () =>
        service.resolveFieldsToApply({
          fieldsToApply: ["legalName", "rawResponse" as never],
        }),
      /field rawResponse cannot be applied/
    );
  });

  it("requires document identity", () => {
    const service = buildService();

    assert.throws(
      () =>
        service.lookup({
          tenantId: "tenant-1",
          partyType: "CUSTOMER",
          documentTypeCode: "31",
        }),
      /documentNumber is required/
    );
  });
});
