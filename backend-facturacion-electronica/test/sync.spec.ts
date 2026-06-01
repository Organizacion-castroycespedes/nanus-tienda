import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { MockFiscalProviderService } from "../src/modules/providers/mock/mock-fiscal-provider.service";
import { SyncService } from "../src/modules/sync/sync.service";

type FetchCall = {
  url: string;
  init: RequestInit;
};

const originalFetch = globalThis.fetch;
const originalEnv = {
  API_BASE_URL: process.env.API_BASE_URL,
  API_INTERNAL_TOKEN: process.env.API_INTERNAL_TOKEN,
};

const buildService = () => new SyncService(new MockFiscalProviderService());

const setSyncEnv = () => {
  process.env.API_BASE_URL = "http://api.local";
  process.env.API_INTERNAL_TOKEN = "local-test-token";
};

const restoreEnv = () => {
  process.env.API_BASE_URL = originalEnv.API_BASE_URL;
  process.env.API_INTERNAL_TOKEN = originalEnv.API_INTERNAL_TOKEN;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const mockFetch = (
  handler: (url: string, init: RequestInit) => Response | Promise<Response>
) => {
  const calls: FetchCall[] = [];
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    const safeInit = init ?? {};
    calls.push({ url, init: safeInit });
    return handler(url, safeInit);
  };
  return calls;
};

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

test("sync CUSTOMER creates when api has no existing party", async () => {
  setSyncEnv();
  const calls = mockFetch((url, init) => {
    if (init.method === "GET") {
      return jsonResponse([]);
    }
    if (init.method === "POST") {
      assert.equal(url, "http://api.local/api/electronic-invoicing/customers");
      return jsonResponse({
        id: "customer-1",
        documentTypeCode: "31",
        documentNumberNormalized: "900123456",
        legalName: "Cliente Mock 900123456",
        fiscalEmail: "cliente.mock@example.com",
        fiscalStatus: "VALIDATED",
      });
    }
    throw new Error(`unexpected method ${init.method}`);
  });

  const result = await buildService().syncParty({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "900.123-456",
  });

  assert.equal(result.provider, "MOCK_LOCAL");
  assert.equal(result.partyType, "CUSTOMER");
  assert.equal(result.documentNumberNormalized, "900123456");
  assert.equal(result.syncAction, "CREATE");
  assert.equal(result.targetId, "customer-1");
  assert.equal(calls.length, 2);
});

test("sync CUSTOMER updates when api has existing party", async () => {
  setSyncEnv();
  mockFetch((url, init) => {
    if (init.method === "GET") {
      return jsonResponse([
        {
          id: "customer-1",
          documentTypeCode: "31",
          documentNumberNormalized: "900123456",
          legalName: "Old Name",
          fiscalEmail: "old@example.com",
          fiscalStatus: "PENDING",
        },
      ]);
    }
    if (init.method === "PATCH") {
      assert.equal(
        url,
        "http://api.local/api/electronic-invoicing/customers/customer-1"
      );
      return jsonResponse({
        id: "customer-1",
        documentTypeCode: "31",
        documentNumberNormalized: "900123456",
        legalName: "Cliente Mock 900123456",
        fiscalEmail: "cliente.mock@example.com",
        fiscalStatus: "VALIDATED",
      });
    }
    throw new Error(`unexpected method ${init.method}`);
  });

  const result = await buildService().syncParty({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });

  assert.equal(result.syncAction, "UPDATE");
  assert.equal(result.targetId, "customer-1");
});

test("sync SUPPLIER creates when api has no existing party", async () => {
  setSyncEnv();
  mockFetch((url, init) => {
    if (init.method === "GET") {
      return jsonResponse([]);
    }
    if (init.method === "POST") {
      assert.equal(url, "http://api.local/api/electronic-invoicing/suppliers");
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      assert.equal(body.fiscalProvider, "MOCK_LOCAL");
      assert.equal(body.fiscalLastLookupStatus, "FOUND");
      return jsonResponse({
        id: "supplier-1",
        documentTypeCode: "31",
        documentNumberNormalized: "900123456",
        legalName: "Proveedor Mock 900123456",
        fiscalEmail: "proveedor.mock@example.com",
        fiscalStatus: "VALIDATED",
        fiscalProvider: "MOCK_LOCAL",
        fiscalLastLookupStatus: "FOUND",
      });
    }
    throw new Error(`unexpected method ${init.method}`);
  });

  const result = await buildService().syncParty({
    partyType: "SUPPLIER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });

  assert.equal(result.syncAction, "CREATE");
  assert.equal(result.targetType, "SUPPLIER");
  assert.equal(result.targetId, "supplier-1");
});

test("sync SUPPLIER updates when api has existing party", async () => {
  setSyncEnv();
  mockFetch((url, init) => {
    if (init.method === "GET") {
      return jsonResponse([
        {
          id: "supplier-1",
          documentTypeCode: "31",
          documentNumberNormalized: "900123456",
          legalName: "Old Supplier",
          fiscalEmail: "old@example.com",
          fiscalStatus: "PENDING",
          fiscalProvider: null,
          fiscalLastLookupStatus: null,
        },
      ]);
    }
    if (init.method === "PATCH") {
      assert.equal(
        url,
        "http://api.local/api/electronic-invoicing/suppliers/supplier-1"
      );
      return jsonResponse({
        id: "supplier-1",
        documentTypeCode: "31",
        documentNumberNormalized: "900123456",
        legalName: "Proveedor Mock 900123456",
        fiscalEmail: "proveedor.mock@example.com",
        fiscalStatus: "VALIDATED",
        fiscalProvider: "MOCK_LOCAL",
        fiscalLastLookupStatus: "FOUND",
      });
    }
    throw new Error(`unexpected method ${init.method}`);
  });

  const result = await buildService().syncParty({
    partyType: "SUPPLIER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });

  assert.equal(result.syncAction, "UPDATE");
  assert.equal(result.targetId, "supplier-1");
});

test("invalid partyType fails in sync", async () => {
  setSyncEnv();

  await assert.rejects(
    () =>
      buildService().syncParty({
        partyType: "PARTNER",
        documentTypeCode: "31",
        documentNumber: "900123456",
      }),
    BadRequestException
  );
});

test("api unavailable fails with clear error", async () => {
  setSyncEnv();
  mockFetch(() => {
    throw new Error("connection refused");
  });

  await assert.rejects(
    () =>
      buildService().syncParty({
        partyType: "CUSTOMER",
        documentTypeCode: "31",
        documentNumber: "900123456",
      }),
    (error) =>
      error instanceof ServiceUnavailableException &&
      error.message.includes("api unavailable")
  );
});

test("sync requires API_INTERNAL_TOKEN and does not expose token in logs", async () => {
  process.env.API_BASE_URL = "http://api.local";
  process.env.API_INTERNAL_TOKEN = "very-secret-token";
  const messages: string[] = [];
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = (...args: unknown[]) => messages.push(args.join(" "));
  console.warn = (...args: unknown[]) => messages.push(args.join(" "));
  console.error = (...args: unknown[]) => messages.push(args.join(" "));
  mockFetch((url, init) => {
    assert.equal(init.headers && "Authorization" in init.headers, true);
    return init.method === "GET"
      ? jsonResponse([])
      : jsonResponse({ id: "customer-1" });
  });

  try {
    await buildService().syncParty({
      partyType: "CUSTOMER",
      documentTypeCode: "31",
      documentNumber: "900123456",
    });
  } finally {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }

  assert.equal(messages.some((message) => message.includes("very-secret-token")), false);

  delete process.env.API_INTERNAL_TOKEN;
  await assert.rejects(
    () =>
      buildService().syncParty({
        partyType: "CUSTOMER",
        documentTypeCode: "31",
        documentNumber: "900123456",
      }),
    (error) =>
      error instanceof ServiceUnavailableException &&
      error.message.includes("API_INTERNAL_TOKEN is required")
  );
});

test("sync is idempotent and second call does not duplicate", async () => {
  setSyncEnv();
  const stored = {
    id: "customer-1",
    documentTypeCode: "31",
    documentNumberNormalized: "900123456",
    legalName: "Cliente Mock 900123456",
    fiscalEmail: "cliente.mock@example.com",
    fiscalStatus: "VALIDATED",
  };
  let exists = false;
  let createCount = 0;
  mockFetch((url, init) => {
    if (init.method === "GET") {
      return jsonResponse(exists ? [stored] : []);
    }
    if (init.method === "POST") {
      createCount += 1;
      exists = true;
      return jsonResponse(stored);
    }
    throw new Error(`unexpected method ${init.method}`);
  });
  const service = buildService();

  const first = await service.syncParty({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });
  const second = await service.syncParty({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });

  assert.equal(first.syncAction, "CREATE");
  assert.equal(second.syncAction, "SKIP");
  assert.equal(createCount, 1);
});

test("api 409 conflict is handled as idempotent lookup", async () => {
  setSyncEnv();
  let getCount = 0;
  mockFetch((url, init) => {
    if (init.method === "GET") {
      getCount += 1;
      return jsonResponse(
        getCount === 1
          ? []
          : [
              {
                id: "customer-1",
                documentTypeCode: "31",
                documentNumberNormalized: "900123456",
                legalName: "Cliente Mock 900123456",
                fiscalEmail: "cliente.mock@example.com",
                fiscalStatus: "VALIDATED",
              },
            ]
      );
    }
    if (init.method === "POST") {
      return jsonResponse({ message: "duplicate" }, 409);
    }
    throw new Error(`unexpected method ${init.method}`);
  });

  const result = await buildService().syncParty({
    partyType: "CUSTOMER",
    documentTypeCode: "31",
    documentNumber: "900123456",
  });

  assert.equal(result.syncAction, "SKIP");
  assert.equal(result.targetId, "customer-1");
});
