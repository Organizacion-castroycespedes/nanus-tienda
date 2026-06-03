import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { buildGetAcquirerSoapRequest } from "./third-party-lookup.get-acquirer-request.builder";
import {
  signGetAcquirerSoapRequest,
  verifyGetAcquirerSoapSignature,
} from "./third-party-lookup.get-acquirer-xml-signer";

const buildRequestXml = () =>
  buildGetAcquirerSoapRequest({
    createdAt: new Date("2026-06-03T15:00:00.000Z"),
    endpointUrl: "https://example.test/GetAcquirer",
    identificationNumber: "900123456",
    identificationType: "31",
    messageId: "urn:uuid:00000000-0000-4000-8000-000000000001",
  }).xml;

const createTestOnlyCertificateFixture = () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "1001";
  certificate.validity.notBefore = new Date("2026-06-03T00:00:00.000Z");
  certificate.validity.notAfter = new Date("2026-06-04T00:00:00.000Z");
  const attrs = [
    { name: "commonName", value: "TEST ONLY GetAcquirer Fixture" },
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

describe("GetAcquirer XML signer FE-3.7.4", () => {
  it("generates signed SOAP XML with ds:Signature inside wsse:Security", () => {
    const fixture = createTestOnlyCertificateFixture();
    const signed = signGetAcquirerSoapRequest(buildRequestXml(), fixture);
    const document = new DOMParser().parseFromString(signed.signedXml, "text/xml");
    const security = document.getElementsByTagName("wsse:Security")[0];
    const signature = security.getElementsByTagName("ds:Signature")[0];

    assert.ok(signature);
    assert.equal(signature.localName, "Signature");
    assert.equal(signed.signatureXml.includes("<ds:Signature"), true);
  });

  it("includes references to Body and Timestamp", () => {
    const fixture = createTestOnlyCertificateFixture();
    const signed = signGetAcquirerSoapRequest(buildRequestXml(), fixture);
    const document = new DOMParser().parseFromString(signed.signedXml, "text/xml");
    const references = Array.from(
      document.getElementsByTagName("ds:Reference")
    ).map((reference) => reference.getAttribute("URI"));

    assert.deepEqual(references, ["#Body-1", "#Timestamp-1"]);
    assert.deepEqual(signed.signedReferenceUris, ["#Body-1", "#Timestamp-1"]);
  });

  it("validates the signature locally with the test-only certificate", () => {
    const fixture = createTestOnlyCertificateFixture();
    const signed = signGetAcquirerSoapRequest(buildRequestXml(), fixture);

    assert.equal(
      verifyGetAcquirerSoapSignature(signed.signedXml, fixture.publicCertPem),
      true
    );
  });

  it("preserves Body and Timestamp IDs for future DIAN signing alignment", () => {
    const fixture = createTestOnlyCertificateFixture();
    const signed = signGetAcquirerSoapRequest(buildRequestXml(), fixture);
    const document = new DOMParser().parseFromString(signed.signedXml, "text/xml");
    const body = document.getElementsByTagName("soap:Body")[0];
    const timestamp = document.getElementsByTagName("wsu:Timestamp")[0];

    assert.equal(body.getAttribute("wsu:Id"), "Body-1");
    assert.equal(timestamp.getAttribute("wsu:Id"), "Timestamp-1");
  });

  it("does not expose the private key or a real password in the signed XML", () => {
    const fixture = createTestOnlyCertificateFixture();
    const signed = signGetAcquirerSoapRequest(buildRequestXml(), fixture);

    assert.equal(signed.signedXml.includes("PRIVATE KEY"), false);
    assert.equal(signed.signedXml.toLowerCase().includes("password"), false);
    assert.equal(signed.signedXml.includes("TEST ONLY GetAcquirer Fixture"), false);
  });
});
