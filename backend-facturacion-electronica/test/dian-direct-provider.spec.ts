import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { FiscalLookupInput } from "../src/modules/fiscal-lookup/fiscal-lookup.types";
import {
  validateDianConfigForProvider,
  validateDianDirectConfig,
} from "../src/modules/providers/dian/dian-config.validator";
import { DianDirectFiscalProviderService } from "../src/modules/providers/dian/dian-direct-fiscal-provider.service";
import { parseGetAcquirerResponse } from "../src/modules/providers/dian/dian-get-acquirer.parser";
import { buildGetAcquirerRequest } from "../src/modules/providers/dian/dian-get-acquirer.request-builder";
import { buildWsSecurityHeader } from "../src/modules/providers/dian/dian-ws-security.builder";
import { buildWsaHeaders } from "../src/modules/providers/dian/dian-wsa.builder";
import { assertDianEndpointAllowed } from "../src/modules/providers/dian/dian-http-client.guard";
import { MockFiscalProviderService } from "../src/modules/providers/mock/mock-fiscal-provider.service";
import { selectFiscalProvider } from "../src/modules/providers/providers.module";
import { startDianGetAcquirerSoapMockServer } from "./mocks/dian-get-acquirer-soap.mock-server";

const fixture = (name: string): string =>
  readFileSync(join(process.cwd(), "test", "fixtures", "dian", name), "utf8");

const input: FiscalLookupInput = {
  partyType: "CUSTOMER",
  documentTypeCode: "31",
  documentNumber: "3199991",
  documentNumberNormalized: "3199991",
};

const originalEnv = {
  FISCAL_PROVIDER: process.env.FISCAL_PROVIDER,
  DIAN_GET_ACQUIRER_FIXTURE_PATH: process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH,
  DIAN_WSDL_URL: process.env.DIAN_WSDL_URL,
  DIAN_CERT_PATH: process.env.DIAN_CERT_PATH,
  DIAN_CERT_PASSWORD: process.env.DIAN_CERT_PASSWORD,
  DIAN_ENVIRONMENT: process.env.DIAN_ENVIRONMENT,
  DIAN_TIMEOUT_MS: process.env.DIAN_TIMEOUT_MS,
  DIAN_GET_ACQUIRER_ACTION: process.env.DIAN_GET_ACQUIRER_ACTION,
  DIAN_ENDPOINT_URL: process.env.DIAN_ENDPOINT_URL,
  DIAN_ALLOW_EXTERNAL_CALLS: process.env.DIAN_ALLOW_EXTERNAL_CALLS,
};

const setEnv = (name: keyof typeof originalEnv, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
};

const setValidDianEnv = () => {
  process.env.DIAN_WSDL_URL = "https://dian.local/GetAcquirer?wsdl";
  process.env.DIAN_CERT_PATH = "C:/safe/local/fixture-cert.p12";
  process.env.DIAN_CERT_PASSWORD = "local-fixture-password";
  process.env.DIAN_ENVIRONMENT = "HABILITACION";
  process.env.DIAN_TIMEOUT_MS = "15000";
  process.env.DIAN_GET_ACQUIRER_ACTION =
    "http://wcf.dian.colombia/IWcfDianCustomerServices/GetAcquirer";
};

test.afterEach(() => {
  setEnv("FISCAL_PROVIDER", originalEnv.FISCAL_PROVIDER);
  setEnv(
    "DIAN_GET_ACQUIRER_FIXTURE_PATH",
    originalEnv.DIAN_GET_ACQUIRER_FIXTURE_PATH
  );
  setEnv("DIAN_WSDL_URL", originalEnv.DIAN_WSDL_URL);
  setEnv("DIAN_CERT_PATH", originalEnv.DIAN_CERT_PATH);
  setEnv("DIAN_CERT_PASSWORD", originalEnv.DIAN_CERT_PASSWORD);
  setEnv("DIAN_ENVIRONMENT", originalEnv.DIAN_ENVIRONMENT);
  setEnv("DIAN_TIMEOUT_MS", originalEnv.DIAN_TIMEOUT_MS);
  setEnv("DIAN_GET_ACQUIRER_ACTION", originalEnv.DIAN_GET_ACQUIRER_ACTION);
  setEnv("DIAN_ENDPOINT_URL", originalEnv.DIAN_ENDPOINT_URL);
  setEnv("DIAN_ALLOW_EXTERNAL_CALLS", originalEnv.DIAN_ALLOW_EXTERNAL_CALLS);
});

test("DIAN_DIRECT config valid passes sanitized", () => {
  setValidDianEnv();

  const config = validateDianDirectConfig();

  assert.equal(config.wsdlUrl, "https://dian.local/GetAcquirer?wsdl");
  assert.equal(config.certPath, "C:/safe/local/fixture-cert.p12");
  assert.equal(config.certPasswordConfigured, true);
  assert.equal(config.environment, "HABILITACION");
  assert.equal(config.timeoutMs, 15000);
});

test("DIAN_DIRECT missing DIAN_WSDL_URL fails clearly", () => {
  setValidDianEnv();
  delete process.env.DIAN_WSDL_URL;

  assert.throws(
    () => validateDianDirectConfig(),
    /DIAN_WSDL_URL is required for DIAN_DIRECT/
  );
});

test("DIAN_DIRECT missing DIAN_CERT_PATH fails clearly", () => {
  setValidDianEnv();
  delete process.env.DIAN_CERT_PATH;

  assert.throws(
    () => validateDianDirectConfig(),
    /DIAN_CERT_PATH is required for DIAN_DIRECT/
  );
});

test("DIAN_DIRECT missing DIAN_CERT_PASSWORD fails without exposing value", () => {
  setValidDianEnv();
  process.env.DIAN_CERT_PASSWORD = "super-secret-fixture";
  delete process.env.DIAN_CERT_PASSWORD;

  assert.throws(
    () => validateDianDirectConfig(),
    (error) =>
      error instanceof Error &&
      error.message.includes("DIAN_CERT_PASSWORD") &&
      !error.message.includes("super-secret-fixture")
  );
});

test("DIAN_DIRECT invalid timeout fails clearly", () => {
  setValidDianEnv();
  process.env.DIAN_TIMEOUT_MS = "nope";

  assert.throws(
    () => validateDianDirectConfig(),
    /DIAN_TIMEOUT_MS must be a positive number/
  );
});

test("DIAN_DIRECT invalid environment fails clearly", () => {
  setValidDianEnv();
  process.env.DIAN_ENVIRONMENT = "QA";

  assert.throws(
    () => validateDianDirectConfig(),
    /DIAN_ENVIRONMENT must be HABILITACION or PRODUCCION/
  );
});

test("MOCK_LOCAL does not require DIAN config", () => {
  delete process.env.DIAN_WSDL_URL;
  delete process.env.DIAN_CERT_PATH;
  delete process.env.DIAN_CERT_PASSWORD;

  assert.equal(validateDianConfigForProvider("MOCK_LOCAL"), null);
});

test("DIAN_DIRECT parses success fixture", () => {
  const result = parseGetAcquirerResponse(
    fixture("get-acquirer-success.xml"),
    input
  );

  assert.equal(result.provider, "DIAN_DIRECT");
  assert.equal(result.lookupStatus, "FOUND");
  assert.equal(result.documentTypeCode, "31");
  assert.equal(result.documentNumberNormalized, "3199991");
  assert.equal(result.legalName, "Nombre NIT 1");
  assert.equal(result.fiscalEmail, "Mail_NIT_1@mail.com");
  assert.equal(result.responseSummary?.hasLegalName, true);
});

test("DIAN_DIRECT parses not found fixture", () => {
  const result = parseGetAcquirerResponse(
    fixture("get-acquirer-not-found.xml"),
    input
  );

  assert.equal(result.lookupStatus, "NOT_FOUND");
  assert.equal(result.statusCode, "NOT_FOUND");
  assert.equal(result.legalName, "");
  assert.equal(result.fiscalEmail, "");
});

test("DIAN_DIRECT parses SOAP fault fixture", () => {
  const result = parseGetAcquirerResponse(
    fixture("get-acquirer-soap-fault.xml"),
    input
  );

  assert.equal(result.lookupStatus, "ERROR");
  assert.equal(result.statusCode, "SOAP_FAULT");
  assert.match(result.message, /Invalid synthetic GetAcquirer request/);
});

test("DIAN_DIRECT invalid XML fails clearly", () => {
  assert.throws(
    () => parseGetAcquirerResponse("<not-valid", input),
    /Invalid GetAcquirer SOAP XML fixture/
  );
});

test("buildGetAcquirerRequest includes identificationType", () => {
  const request = buildGetAcquirerRequest(input);

  assert.match(request, /<dian:identificationType>31<\/dian:identificationType>/);
});

test("buildGetAcquirerRequest includes identificationNumber", () => {
  const request = buildGetAcquirerRequest(input);

  assert.match(
    request,
    /<dian:identificationNumber>3199991<\/dian:identificationNumber>/
  );
});

test("WS-Security builder includes Timestamp", () => {
  const header = buildWsSecurityHeader({
    createdAt: new Date("2026-05-31T12:00:00.000Z"),
    ttlMs: 300000,
  });

  assert.match(header, /<wsu:Timestamp/);
  assert.match(header, /<wsu:Created>2026-05-31T12:00:00.000Z<\/wsu:Created>/);
  assert.match(header, /<wsu:Expires>2026-05-31T12:05:00.000Z<\/wsu:Expires>/);
  assert.match(header, /DIAN_SIGNATURE_PLACEHOLDER/);
});

test("WS-Security Timestamp Expires is greater than Created", () => {
  const createdAt = new Date("2026-05-31T12:00:00.000Z");
  const header = buildWsSecurityHeader({ createdAt, ttlMs: 60000 });
  const created = header.match(/<wsu:Created>(.*?)<\/wsu:Created>/)?.[1];
  const expires = header.match(/<wsu:Expires>(.*?)<\/wsu:Expires>/)?.[1];

  assert.ok(created);
  assert.ok(expires);
  assert.equal(new Date(expires).getTime() > new Date(created).getTime(), true);
});

test("WS-A builder includes GetAcquirer Action", () => {
  const headers = buildWsaHeaders({
    to: "https://dian.local/GetAcquirer?wsdl",
    messageId: "urn:uuid:test-message",
  });

  assert.match(
    headers,
    /http:\/\/wcf\.dian\.colombia\/IWcfDianCustomerServices\/GetAcquirer/
  );
  assert.match(headers, /<wsa:To>https:\/\/dian.local\/GetAcquirer\?wsdl<\/wsa:To>/);
  assert.match(headers, /<wsa:MessageID>urn:uuid:test-message<\/wsa:MessageID>/);
});

test("buildGetAcquirerRequest includes conceptual WS-A and Security headers", () => {
  process.env.DIAN_WSDL_URL = "https://dian.local/GetAcquirer?wsdl";

  const request = buildGetAcquirerRequest(input);

  assert.match(request, /<wsa:Action>/);
  assert.match(request, /<wsa:To>/);
  assert.match(request, /<wsse:Security/);
  assert.match(request, /<ds:Signature/);
});

test("default provider remains MOCK_LOCAL", () => {
  delete process.env.FISCAL_PROVIDER;
  const mock = new MockFiscalProviderService();
  const dian = new DianDirectFiscalProviderService();

  assert.equal(selectFiscalProvider(mock, dian), mock);
});

test("FISCAL_PROVIDER=DIAN_DIRECT selects DIAN adapter without network", async () => {
  setValidDianEnv();
  process.env.FISCAL_PROVIDER = "DIAN_DIRECT";
  process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH = join(
    process.cwd(),
    "test",
    "fixtures",
    "dian",
    "get-acquirer-success.xml"
  );
  const mock = new MockFiscalProviderService();
  const dian = new DianDirectFiscalProviderService();
  const selected = selectFiscalProvider(mock, dian);

  assert.equal(selected, dian);

  const result = await selected.lookupParty(input);
  assert.equal(result.provider, "DIAN_DIRECT");
  assert.equal(result.lookupStatus, "FOUND");
  assert.ok(result.requestHash?.startsWith("sha256:"));
});

test("DIAN_DIRECT calls local mock SOAP server success", async () => {
  const server = await startDianGetAcquirerSoapMockServer();
  try {
    setValidDianEnv();
    delete process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH;
    process.env.DIAN_ENDPOINT_URL = server.url;

    const result = await new DianDirectFiscalProviderService().lookupParty(input);

    assert.equal(result.lookupStatus, "FOUND");
    assert.equal(result.legalName, "Nombre NIT 1");
    assert.equal(result.fiscalEmail, "Mail_NIT_1@mail.com");
  } finally {
    await server.close();
  }
});

test("DIAN_DIRECT sends identificationType and identificationNumber to mock SOAP server", async () => {
  const server = await startDianGetAcquirerSoapMockServer();
  try {
    setValidDianEnv();
    delete process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH;
    process.env.DIAN_ENDPOINT_URL = server.url;

    await new DianDirectFiscalProviderService().lookupParty(input);
    const lastRequest = server.getLastRequest();

    assert.ok(lastRequest?.body.includes("<dian:identificationType>31</dian:identificationType>"));
    assert.ok(
      lastRequest?.body.includes(
        "<dian:identificationNumber>3199991</dian:identificationNumber>"
      )
    );
    assert.ok(lastRequest?.contentType.includes("GetAcquirer"));
  } finally {
    await server.close();
  }
});

test("DIAN_DIRECT handles local mock SOAP not found", async () => {
  const server = await startDianGetAcquirerSoapMockServer();
  try {
    setValidDianEnv();
    delete process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH;
    process.env.DIAN_ENDPOINT_URL = server.url;

    const result = await new DianDirectFiscalProviderService().lookupParty({
      ...input,
      documentNumber: "0000000",
      documentNumberNormalized: "0000000",
    });

    assert.equal(result.lookupStatus, "NOT_FOUND");
    assert.equal(result.statusCode, "NOT_FOUND");
  } finally {
    await server.close();
  }
});

test("DIAN_DIRECT handles local mock SOAP fault", async () => {
  const server = await startDianGetAcquirerSoapMockServer();
  try {
    setValidDianEnv();
    delete process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH;
    process.env.DIAN_ENDPOINT_URL = server.url;

    const result = await new DianDirectFiscalProviderService().lookupParty({
      ...input,
      documentNumber: "FAULT",
      documentNumberNormalized: "FAULT",
    });

    assert.equal(result.lookupStatus, "ERROR");
    assert.equal(result.statusCode, "SOAP_FAULT");
  } finally {
    await server.close();
  }
});

test("DIAN_DIRECT handles local mock timeout", async () => {
  const server = await startDianGetAcquirerSoapMockServer(100);
  try {
    setValidDianEnv();
    delete process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH;
    process.env.DIAN_ENDPOINT_URL = server.url;
    process.env.DIAN_TIMEOUT_MS = "10";

    await assert.rejects(
      () =>
        new DianDirectFiscalProviderService().lookupParty({
          ...input,
          documentNumber: "TIMEOUT",
          documentNumberNormalized: "TIMEOUT",
        }),
      /DIAN GetAcquirer request timed out/
    );
  } finally {
    await server.close();
  }
});

test("DIAN_DIRECT blocks external endpoint when external calls disabled", async () => {
  assert.throws(
    () => assertDianEndpointAllowed("https://dian.example.invalid/GetAcquirer", false),
    /DIAN endpoint blocked/
  );
});

test("DIAN_DIRECT does not log certificate password during mock HTTP call", async () => {
  const server = await startDianGetAcquirerSoapMockServer();
  const messages: string[] = [];
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = (...args: unknown[]) => messages.push(args.join(" "));
  console.warn = (...args: unknown[]) => messages.push(args.join(" "));
  console.error = (...args: unknown[]) => messages.push(args.join(" "));

  try {
    setValidDianEnv();
    delete process.env.DIAN_GET_ACQUIRER_FIXTURE_PATH;
    process.env.DIAN_ENDPOINT_URL = server.url;
    process.env.DIAN_CERT_PASSWORD = "super-secret-dian-password";

    await new DianDirectFiscalProviderService().lookupParty(input);
  } finally {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    await server.close();
  }

  assert.equal(
    messages.some((message) => message.includes("super-secret-dian-password")),
    false
  );
});

test("DIAN_DIRECT skips suppliers because GetAcquirer is for acquirers", async () => {
  const result = await new DianDirectFiscalProviderService().lookupParty({
    ...input,
    partyType: "SUPPLIER",
  });

  assert.equal(result.lookupStatus, "SKIPPED");
  assert.equal(result.statusCode, "UNSUPPORTED_PARTY_TYPE");
});
