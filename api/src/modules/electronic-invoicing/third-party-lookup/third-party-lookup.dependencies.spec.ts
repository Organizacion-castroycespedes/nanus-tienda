import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import { XMLParser } from "fast-xml-parser";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";

const fixturePath = join(
  process.cwd(),
  "src",
  "modules",
  "electronic-invoicing",
  "third-party-lookup",
  "fixtures",
  "get-acquirer-basic-response.xml"
);

const readSoapFixture = () => readFileSync(fixturePath, "utf8");

describe("GetAcquirer dependency spike FE-3.7.2", () => {
  it("imports dependency entrypoints", () => {
    assert.equal(typeof DOMParser, "function");
    assert.equal(typeof SignedXml, "function");
    assert.equal(typeof forge.asn1.fromDer, "function");
    assert.equal(typeof XMLParser, "function");
  });

  it("parses the SOAP fixture with @xmldom/xmldom", () => {
    const document = new DOMParser().parseFromString(readSoapFixture(), "text/xml");
    const envelope = document.documentElement;
    const body = document.getElementsByTagName("soap:Body")[0];
    const legalName = document.getElementsByTagName("cbc:Name")[0];
    const fiscalEmail = document.getElementsByTagName("cbc:ElectronicMail")[0];

    assert.equal(envelope.localName, "Envelope");
    assert.equal(body.getAttribute("wsu:Id"), "Body-1");
    assert.equal(legalName.textContent, "Fixture Acquirer SAS");
    assert.equal(fiscalEmail.textContent, "facturacion.fixture@example.test");
  });

  it("constructs a basic SignedXml instance without signing a DIAN request", () => {
    const signer = new SignedXml({
      canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
      signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    });

    signer.addReference({
      xpath: "//*[local-name(.)='Body']",
      digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
      transforms: ["http://www.w3.org/2001/10/xml-exc-c14n#"],
    });

    assert.equal(typeof signer.computeSignature, "function");
    assert.equal(typeof signer.getSignedXml, "function");
  });

  it("parses the safe SOAP fixture with fast-xml-parser", () => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
    const parsed = parser.parse(readSoapFixture());
    const result = parsed.Envelope.Body.GetAcquirerResponse.GetAcquirerResult;

    assert.equal(result.StatusCode, "DIAN_OK");
    assert.equal(result.AccountingCustomerParty.PartyIdentification.ID["#text"], 900123456);
    assert.equal(result.AccountingCustomerParty.PartyIdentification.ID["@_schemeName"], "31");
    assert.equal(result.AccountingCustomerParty.Contact.Name, "Fixture Acquirer SAS");
    assert.equal(
      result.AccountingCustomerParty.Contact.ElectronicMail,
      "facturacion.fixture@example.test"
    );
    assert.equal(result.TaxRepresentativeParty.PartyIdentification.ID, 900123456);
  });

  it(
    "keeps P12 structure parsing pending until a synthetic fixture is approved",
    { skip: "No P12/PFX fixture is approved in FE-3.7.2; no real certificate is allowed." },
    () => {
      assert.fail("Pending fixture-only P12/PFX validation");
    }
  );
});
