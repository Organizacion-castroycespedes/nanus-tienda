import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import {
  GET_ACQUIRER_ACTION,
  GET_ACQUIRER_VALID_IDENTIFICATION_TYPES,
  GET_ACQUIRER_WS_ADDRESSING_ENABLED,
  GET_ACQUIRER_WSDL_ENDPOINT_SOURCE,
  buildGetAcquirerSoapRequest,
  buildGetAcquirerSoapContentType,
} from "./third-party-lookup.get-acquirer-request.builder";

const expectedFixturePath = join(
  process.cwd(),
  "src",
  "modules",
  "electronic-invoicing",
  "third-party-lookup",
  "fixtures",
  "get-acquirer-basic-request.xml"
);

const buildRequest = () =>
  buildGetAcquirerSoapRequest({
    createdAt: new Date("2026-06-03T15:00:00.000Z"),
    endpointUrl: "https://example.test/GetAcquirer",
    identificationNumber: "900123456",
    identificationType: "31",
    messageId: "urn:uuid:00000000-0000-4000-8000-000000000001",
  });

const normalizeXml = (value: string) => value.replace(/\r\n/g, "\n").trim();

describe("GetAcquirer SOAP request builder FE-3.7.3", () => {
  it("exposes DIAN guide constants for FE-3.7.8", () => {
    assert.deepEqual(GET_ACQUIRER_VALID_IDENTIFICATION_TYPES, [
      "11",
      "12",
      "13",
      "21",
      "22",
      "31",
      "41",
      "42",
      "47",
      "48",
      "50",
      "91",
    ]);
    assert.equal(GET_ACQUIRER_ACTION, "http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer");
    assert.equal(
      buildGetAcquirerSoapContentType(),
      `application/soap+xml; charset=utf-8; action="${GET_ACQUIRER_ACTION}"`
    );
    assert.equal(GET_ACQUIRER_WS_ADDRESSING_ENABLED, true);
    assert.equal(GET_ACQUIRER_WSDL_ENDPOINT_SOURCE, "DIAN participant catalog");
  });

  it("generates the expected SOAP request fixture", () => {
    const request = buildRequest();
    const expectedXml = readFileSync(expectedFixturePath, "utf8");

    assert.equal(normalizeXml(request.xml), normalizeXml(expectedXml));
  });

  it("generates XML parseable by @xmldom/xmldom", () => {
    const request = buildRequest();
    const document = new DOMParser().parseFromString(request.xml, "text/xml");

    assert.equal(document.documentElement.localName, "Envelope");
    assert.equal(document.getElementsByTagName("soap:Header").length, 1);
    assert.equal(document.getElementsByTagName("soap:Body").length, 1);
    assert.equal(document.getElementsByTagName("parsererror").length, 0);
  });

  it("includes WS-Addressing headers and stable IDs for future signing", () => {
    const request = buildRequest();
    const document = new DOMParser().parseFromString(request.xml, "text/xml");
    const action = document.getElementsByTagName("wsa:Action")[0];
    const to = document.getElementsByTagName("wsa:To")[0];
    const messageId = document.getElementsByTagName("wsa:MessageID")[0];

    assert.equal(action.textContent, GET_ACQUIRER_ACTION);
    assert.equal(request.wsAddressingEnabled, true);
    assert.equal(action.getAttribute("wsu:Id"), "Action-1");
    assert.equal(to.textContent, "https://example.test/GetAcquirer");
    assert.equal(to.getAttribute("wsu:Id"), "To-1");
    assert.equal(
      messageId.textContent,
      "urn:uuid:00000000-0000-4000-8000-000000000001"
    );
    assert.equal(messageId.getAttribute("wsu:Id"), "MessageID-1");
  });

  it("includes WS-Security Timestamp placeholder with stable ID", () => {
    const request = buildRequest();
    const document = new DOMParser().parseFromString(request.xml, "text/xml");
    const security = document.getElementsByTagName("wsse:Security")[0];
    const timestamp = document.getElementsByTagName("wsu:Timestamp")[0];
    const created = document.getElementsByTagName("wsu:Created")[0];
    const expires = document.getElementsByTagName("wsu:Expires")[0];

    assert.equal(security.getAttribute("wsu:Id"), "Security-1");
    assert.equal(timestamp.getAttribute("wsu:Id"), "Timestamp-1");
    assert.equal(created.textContent, "2026-06-03T15:00:00.000Z");
    assert.equal(expires.textContent, "2026-06-03T15:05:00.000Z");
  });

  it("includes GetAcquirer body with identification fields", () => {
    const request = buildRequest();
    const document = new DOMParser().parseFromString(request.xml, "text/xml");
    const body = document.getElementsByTagName("soap:Body")[0];
    const operation = document.getElementsByTagName("dian:GetAcquirer")[0];
    const identificationType = document.getElementsByTagName(
      "dian:identificationType"
    )[0];
    const identificationNumber = document.getElementsByTagName(
      "dian:identificationNumber"
    )[0];

    assert.equal(body.getAttribute("wsu:Id"), "Body-1");
    assert.equal(operation.localName, "GetAcquirer");
    assert.equal(request.identificationType, "31");
    assert.equal(request.identificationNumber, "900123456");
    assert.equal(identificationType.textContent, "31");
    assert.equal(identificationNumber.textContent, "900123456");
  });

  it("allows only DIAN guide identificationType values", () => {
    for (const identificationType of GET_ACQUIRER_VALID_IDENTIFICATION_TYPES) {
      const request = buildGetAcquirerSoapRequest({
        createdAt: new Date("2026-06-03T15:00:00.000Z"),
        endpointUrl: "https://example.test/GetAcquirer",
        identificationNumber: "900123456",
        identificationType,
        messageId: "urn:uuid:00000000-0000-4000-8000-000000000001",
      });

      assert.equal(request.identificationType, identificationType);
    }
  });

  it("rejects identificationType values outside the DIAN guide", () => {
    assert.throws(
      () =>
        buildGetAcquirerSoapRequest({
          createdAt: new Date("2026-06-03T15:00:00.000Z"),
          endpointUrl: "https://example.test/GetAcquirer",
          identificationNumber: "900123456",
          identificationType: "14",
          messageId: "urn:uuid:00000000-0000-4000-8000-000000000001",
        }),
      /identificationType must be one of 11, 12, 13, 21, 22, 31, 41, 42, 47, 48, 50, 91/
    );
  });

  it("does not include real signature, certificate, password, or raw secret placeholders", () => {
    const request = buildRequest();

    assert.equal(request.xml.includes("<ds:Signature"), false);
    assert.equal(request.xml.includes("BinarySecurityToken"), false);
    assert.equal(request.xml.toLowerCase().includes("password"), false);
    assert.equal(request.xml.toLowerCase().includes("privatekey"), false);
    assert.equal(request.xml.toLowerCase().includes("certificate"), false);
  });
});
