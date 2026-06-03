import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ThirdPartyLookupGetAcquirerAdapter } from "./third-party-lookup.get-acquirer-adapter";
import { ThirdPartyLookupMockAdapter } from "./third-party-lookup.mock-adapter";
import {
  ThirdPartyLookupService,
  normalizeThirdPartyLookupDocument,
} from "./third-party-lookup.service";

const buildService = () =>
  new ThirdPartyLookupService(
    new ThirdPartyLookupMockAdapter(),
    new ThirdPartyLookupGetAcquirerAdapter()
  );

const LOOKUP_ENV_KEYS = [
  "DIAN_THIRD_PARTY_LOOKUP_ENABLED",
  "DIAN_THIRD_PARTY_LOOKUP_MODE",
  "DIAN_GET_ACQUIRER_WSDL_URL",
  "DIAN_GET_ACQUIRER_ENDPOINT_URL",
  "DIAN_CERTIFICATE_PATH",
  "DIAN_CERTIFICATE_PASSWORD",
  "DIAN_GET_ACQUIRER_TIMEOUT_MS",
] as const;

const withLookupEnv = async (
  enabled: string | undefined,
  mode: string | undefined,
  fn: () => Promise<void> | void,
  extraEnv: Partial<Record<(typeof LOOKUP_ENV_KEYS)[number], string | undefined>> = {}
) => {
  const previousValues = new Map<string, string | undefined>();
  const nextValues: Partial<
    Record<(typeof LOOKUP_ENV_KEYS)[number], string | undefined>
  > = {
    DIAN_THIRD_PARTY_LOOKUP_ENABLED: enabled,
    DIAN_THIRD_PARTY_LOOKUP_MODE: mode,
    DIAN_GET_ACQUIRER_WSDL_URL: undefined,
    DIAN_GET_ACQUIRER_ENDPOINT_URL: undefined,
    DIAN_CERTIFICATE_PATH: undefined,
    DIAN_CERTIFICATE_PASSWORD: undefined,
    DIAN_GET_ACQUIRER_TIMEOUT_MS: undefined,
    ...extraEnv,
  };

  for (const key of LOOKUP_ENV_KEYS) {
    previousValues.set(key, process.env[key]);
    const value = nextValues[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await fn();
  } finally {
    for (const key of LOOKUP_ENV_KEYS) {
      const previousValue = previousValues.get(key);
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
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

  it("fails clearly when real GetAcquirer mode lacks customer config", async () => {
    await withLookupEnv(
      "true",
      "real",
      () => {
        const service = buildService();
        let message = "";

        try {
          service.lookup({
            tenantId: "tenant-1",
            partyType: "CUSTOMER",
            documentTypeCode: "31",
            documentNumber: "900123456",
          });
        } catch (error) {
          message = error instanceof Error ? error.message : String(error);
        }

        assert.match(
          message,
          /DIAN GetAcquirer real mode requires DIAN_GET_ACQUIRER_WSDL_URL/
        );
        assert.equal(message.includes("super-secret"), false);
      },
      {
        DIAN_CERTIFICATE_PASSWORD: "super-secret",
      }
    );
  });

  it("keeps suppliers out of real GetAcquirer mode", async () => {
    await withLookupEnv("true", "real", () => {
      const service = buildService();

      const preview = service.lookup({
        tenantId: "tenant-1",
        partyType: "SUPPLIER",
        documentTypeCode: "31",
        documentNumber: "900123456",
      });

      assert.equal(preview.lookupStatus, "ERROR");
      assert.equal(preview.statusCode, "UNSUPPORTED_PARTY_TYPE");
      assert.equal(preview.provider, "DIAN_GET_ACQUIRER");
      assert.equal(preview.data, null);
      assert.equal(Object.prototype.hasOwnProperty.call(preview, "raw"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(preview, "soap"), false);
    });
  });

  it("returns safe configured skeleton result for real customer mode", async () => {
    await withLookupEnv(
      "true",
      "real",
      () => {
        const service = buildService();

        const preview = service.lookup({
          tenantId: "tenant-1",
          partyType: "CUSTOMER",
          documentTypeCode: "31",
          documentNumber: "900.123-456",
        });

        assert.equal(preview.lookupStatus, "ERROR");
        assert.equal(preview.statusCode, "REAL_LOOKUP_NOT_IMPLEMENTED");
        assert.equal(preview.provider, "DIAN_GET_ACQUIRER");
        assert.equal(preview.mode, "real");
        assert.equal(preview.documentNumberNormalized, "900123456");
        assert.equal(preview.data, null);
        assert.equal(Object.prototype.hasOwnProperty.call(preview, "raw"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(preview, "soap"), false);
      },
      {
        DIAN_GET_ACQUIRER_WSDL_URL: "https://example.test/GetAcquirer?wsdl",
        DIAN_GET_ACQUIRER_ENDPOINT_URL: "https://example.test/GetAcquirer",
        DIAN_CERTIFICATE_PATH: "C:\\certs\\dian.p12",
        DIAN_CERTIFICATE_PASSWORD: "super-secret",
        DIAN_GET_ACQUIRER_TIMEOUT_MS: "15000",
      }
    );
  });

  it("builds GetAcquirer request skeleton without certificate secrets", () => {
    const adapter = new ThirdPartyLookupGetAcquirerAdapter();

    const skeleton = adapter.buildRequestSkeleton(
      {
        tenantId: "tenant-1",
        partyType: "CUSTOMER",
        documentTypeCode: "31",
        dianIdentificationType: "31",
        documentNumber: "900123456",
        identificationNumber: "900123456",
        documentNumberNormalized: "900123456",
      },
      {
        wsdlUrl: "https://example.test/GetAcquirer?wsdl",
        endpointUrl: "https://example.test/GetAcquirer",
        certificatePath: "C:\\certs\\dian.p12",
        certificatePassword: "super-secret",
        timeoutMs: 15000,
      }
    );

    const serialized = JSON.stringify(skeleton);
    assert.equal(skeleton.operation, "GetAcquirer");
    assert.equal(skeleton.externalCallEnabled, false);
    assert.equal(skeleton.identificationType, "31");
    assert.equal(skeleton.identificationNumber, "900123456");
    assert.equal(skeleton.wsSecurity.rawCertificateIncluded, false);
    assert.equal(skeleton.wsSecurity.rawPasswordIncluded, false);
    assert.equal(serialized.includes("super-secret"), false);
    assert.equal(serialized.includes("dian.p12"), false);
  });
});
