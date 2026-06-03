import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseGetAcquirerResponse } from "./third-party-lookup.get-acquirer-response.parser";

const fixturePath = join(
  process.cwd(),
  "src",
  "modules",
  "electronic-invoicing",
  "third-party-lookup",
  "fixtures",
  "get-acquirer-basic-response.xml"
);

const identity = {
  identificationType: "31",
  identificationNumber: "900123456",
};

describe("parseGetAcquirerResponse FE-3.9", () => {
  it("parses a safe GetAcquirer success fixture without raw SOAP", () => {
    const parsed = parseGetAcquirerResponse(
      readFileSync(fixturePath, "utf8"),
      identity
    );

    assert.equal(parsed.lookupStatus, "FOUND");
    assert.equal(parsed.statusCode, "DIAN_OK");
    assert.equal(parsed.data?.documentTypeCode, "31");
    assert.equal(parsed.data?.documentNumberNormalized, "900123456");
    assert.equal(parsed.data?.legalName, "Fixture Acquirer SAS");
    assert.equal(parsed.data?.fiscalEmail, "facturacion.fixture@example.test");
    assert.deepEqual(parsed.responseSummary.fields, [
      "documentTypeCode",
      "documentNumber",
      "legalName",
      "fiscalEmail",
    ]);
    assert.equal(parsed.responseSummary.hasLegalName, true);
    assert.equal(parsed.responseSummary.hasFiscalEmail, true);
    assert.equal(parsed.sanitizedSummary.hasGetAcquirerResult, true);
    assert.equal(
      Object.prototype.hasOwnProperty.call(parsed.sanitizedSummary, "raw"),
      false
    );
  });

  it("maps SOAP fault to a safe error summary", () => {
    const parsed = parseGetAcquirerResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <soap:Fault>
      <soap:Code><soap:Value>soap:Sender</soap:Value></soap:Code>
      <soap:Reason><soap:Text>Controlled fault</soap:Text></soap:Reason>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`,
      identity
    );

    assert.equal(parsed.lookupStatus, "ERROR");
    assert.equal(parsed.statusCode, "SOAP_FAULT");
    assert.equal(parsed.sanitizedSummary.hasSoapFault, true);
    assert.equal(parsed.data, null);
  });

  it("maps not found responses without data", () => {
    const parsed = parseGetAcquirerResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:dian="http://wcf.dian.colombia">
  <soap:Body>
    <dian:GetAcquirerResponse>
      <dian:GetAcquirerResult>
        <dian:StatusCode>NOT_FOUND</dian:StatusCode>
        <dian:StatusMessage>No encontrado</dian:StatusMessage>
      </dian:GetAcquirerResult>
    </dian:GetAcquirerResponse>
  </soap:Body>
</soap:Envelope>`,
      identity
    );

    assert.equal(parsed.lookupStatus, "NOT_FOUND");
    assert.equal(parsed.statusCode, "NOT_FOUND");
    assert.equal(parsed.data, null);
    assert.equal(parsed.sanitizedSummary.hasGetAcquirerResult, true);
  });

  it("maps invalid XML to a safe parser error", () => {
    const parsed = parseGetAcquirerResponse("<soap:Envelope>", identity);

    assert.equal(parsed.lookupStatus, "ERROR");
    assert.equal(parsed.statusCode, "XML_PARSE_ERROR");
    assert.equal(parsed.data, null);
    assert.deepEqual(parsed.responseSummary.fields, []);
  });
});
