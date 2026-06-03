import assert from "node:assert/strict";
import { describe, it } from "node:test";
import forge from "node-forge";
import {
  ThirdPartyLookupGetAcquirerAdapter,
  type GetAcquirerSignedSoapRequest,
  type GetAcquirerSoapTransport,
  type GetAcquirerSoapTransportResult,
} from "./third-party-lookup.get-acquirer-adapter";
import { verifyGetAcquirerSoapSignature } from "./third-party-lookup.get-acquirer-xml-signer";
import type { ValidatedGetAcquirerConfig } from "./third-party-lookup.config";
import type {
  NormalizedThirdPartyLookupRequest,
  ThirdPartyLookupContext,
} from "./third-party-lookup.types";

class RecordingTransport implements GetAcquirerSoapTransport {
  requests: GetAcquirerSignedSoapRequest[] = [];

  submitSignedRequest(
    request: GetAcquirerSignedSoapRequest
  ): GetAcquirerSoapTransportResult {
    this.requests.push(request);
    return {
      externalCallMade: false,
      statusCode: "EXTERNAL_CALL_DISABLED",
      signedXmlSha256: request.signedXmlSha256,
      signedXmlSize: request.signedXmlSize,
      hasBinarySecurityToken: request.signedXml.includes("BinarySecurityToken"),
      hasSignature: request.signedXml.includes("<ds:Signature"),
      signedReferenceUris: request.signedReferenceUris,
    };
  }
}

const createTestOnlyCertificateFixture = () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "1002";
  certificate.validity.notBefore = new Date("2026-06-03T00:00:00.000Z");
  certificate.validity.notAfter = new Date("2026-06-04T00:00:00.000Z");
  const attrs = [
    { name: "commonName", value: "TEST ONLY Adapter Fixture" },
    { name: "organizationName", value: "ManusTienda TEST ONLY" },
  ];
  certificate.setSubject(attrs);
  certificate.setIssuer(attrs);
  certificate.sign(keys.privateKey, forge.md.sha256.create());

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    publicCertPem: forge.pki.certificateToPem(certificate),
  };
};

const config: ValidatedGetAcquirerConfig = {
  wsdlUrl: "https://example.test/GetAcquirer?wsdl",
  endpointUrl: "https://example.test/GetAcquirer",
  certificatePath: "C:\\certs\\test-only-fixture.p12",
  certificatePassword: "test-only-password",
  timeoutMs: 15000,
};

const customerInput: NormalizedThirdPartyLookupRequest = {
  tenantId: "tenant-1",
  partyType: "CUSTOMER",
  documentTypeCode: "31",
  dianIdentificationType: "31",
  documentNumber: "900123456",
  identificationNumber: "900123456",
  documentNumberNormalized: "900123456",
};

const context: ThirdPartyLookupContext = {
  lookupId: "real-test",
  correlationId: "00000000-0000-4000-8000-000000000001",
  provider: "DIAN_GET_ACQUIRER",
  mode: "real",
  lookupAt: "2026-06-03T15:00:00.000Z",
  requestHash: "request-hash",
};

describe("ThirdPartyLookupGetAcquirerAdapter FE-3.7.6", () => {
  it("builds a signed SOAP request from config and signer material", () => {
    const adapter = new ThirdPartyLookupGetAcquirerAdapter();
    const material = createTestOnlyCertificateFixture();
    const signedRequest = adapter.buildSignedSoapRequest(
      customerInput,
      config,
      material,
      {
        createdAt: new Date(context.lookupAt),
        messageId: `urn:uuid:${context.correlationId}`,
      }
    );

    assert.equal(signedRequest.operation, "GetAcquirer");
    assert.equal(signedRequest.externalCallEnabled, false);
    assert.equal(signedRequest.endpointUrl, config.endpointUrl);
    assert.equal(signedRequest.timeoutMs, 15000);
    assert.equal(signedRequest.identificationType, "31");
    assert.equal(signedRequest.identificationNumber, "900123456");
    assert.equal(signedRequest.signedXml.includes("<ds:Signature"), true);
    assert.equal(signedRequest.signedXml.includes("BinarySecurityToken"), true);
    assert.deepEqual(signedRequest.signedReferenceUris, [
      "#Body-1",
      "#Timestamp-1",
    ]);
    assert.equal(
      verifyGetAcquirerSoapSignature(signedRequest.signedXml, material.publicCertPem),
      true
    );
  });

  it("uses fake transport in lookup and does not call external network", () => {
    const adapter = new ThirdPartyLookupGetAcquirerAdapter();
    const transport = new RecordingTransport();
    const material = createTestOnlyCertificateFixture();
    adapter.configureGetAcquirerRuntime({
      signingMaterialProvider: () => material,
      transport,
    });

    const preview = adapter.lookup(customerInput, context, {
      getAcquirerConfig: config,
    });

    assert.equal(preview.lookupStatus, "ERROR");
    assert.equal(preview.statusCode, "REAL_LOOKUP_NOT_IMPLEMENTED");
    assert.equal(transport.requests.length, 1);
    assert.equal(transport.requests[0].externalCallEnabled, false);
    assert.equal(
      verifyGetAcquirerSoapSignature(
        transport.requests[0].signedXml,
        material.publicCertPem
      ),
      true
    );
    assert.equal(Object.prototype.hasOwnProperty.call(preview, "soap"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(preview, "raw"), false);
  });

  it("does not invoke transport when signing material is not configured", () => {
    const adapter = new ThirdPartyLookupGetAcquirerAdapter();
    const transport = new RecordingTransport();
    adapter.configureGetAcquirerRuntime({ transport });

    const preview = adapter.lookup(customerInput, context, {
      getAcquirerConfig: config,
    });

    assert.equal(preview.statusCode, "REAL_LOOKUP_NOT_IMPLEMENTED");
    assert.equal(transport.requests.length, 0);
  });

  it("keeps suppliers out before any signed SOAP preparation", () => {
    const adapter = new ThirdPartyLookupGetAcquirerAdapter();
    const transport = new RecordingTransport();
    const material = createTestOnlyCertificateFixture();
    adapter.configureGetAcquirerRuntime({
      signingMaterialProvider: () => material,
      transport,
    });

    const preview = adapter.lookup(
      { ...customerInput, partyType: "SUPPLIER" },
      context,
      { getAcquirerConfig: config }
    );

    assert.equal(preview.statusCode, "UNSUPPORTED_PARTY_TYPE");
    assert.equal(transport.requests.length, 0);
  });

  it("throws clear error when config is missing", () => {
    const adapter = new ThirdPartyLookupGetAcquirerAdapter();

    assert.throws(
      () => adapter.lookup(customerInput, context),
      /DIAN GetAcquirer real mode requires validated configuration/
    );
  });
});
