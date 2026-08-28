import assert from "node:assert/strict";
import test from "node:test";
import {
  FactuCoreAuthenticationError,
  FactuCoreAttachmentNotFoundError,
  FactuCoreConflictError,
  FactuCoreNetworkError,
  FactuCoreRateLimitError,
  FactuCoreTimeoutError,
  FactuCoreUnavailableError,
  FactuCoreValidationError,
} from "../src/modules/electronic-billing/providers/factucore";
import { FactuCoreClient } from "../src/modules/electronic-billing/providers/factucore";

const context = {
  baseUrl: "https://factucore.test",
  credentials: {
    clientKey: "client-key-test",
    clientSecret: "client-secret-test",
  },
  timeoutMs: 50,
};

const buildJsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });

const buildBinaryResponse = (status: number, body: Uint8Array, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers,
  });

test("createInvoice posts to the FactuCore invoice endpoint with headers", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new FactuCoreClient(async (url, init) => {
    calls.push({ url: String(url), init });
    return buildJsonResponse(200, {
      id: "factucore-doc-1",
      status: "VALIDATED_INTERNAL",
      providerStatus: "VALIDATED_INTERNAL",
    });
  });

  const result = await client.createInvoice(context, {
    externalReference: "SALE-001",
    issueDate: "2026-08-27T10:00:00.000Z",
    issueTime: "10:00:00",
    customer: {
      identificationTypeCode: "31",
      identificationNumber: "900123456",
      legalName: "Cliente Uno",
      identification: {
        typeCode: "31",
        number: "900123456",
      },
    } as never,
    lines: [],
    totals: {
      subtotalAmount: 1000,
      discountAmount: 0,
      taxAmount: 190,
      totalAmount: 1190,
      currencyCode: "COP",
    },
  } as never);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://factucore.test/api/v1/external/documents/invoices");
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers["x-client-key"], context.credentials.clientKey);
  assert.equal(headers["x-client-secret"], context.credentials.clientSecret);
  assert.equal(result.id, "factucore-doc-1");
});

test("409 maps to conflict", async () => {
  const client = new FactuCoreClient(async () => buildJsonResponse(409, { message: "conflict" }));

  await assert.rejects(
    () =>
      client.createInvoice(context, {
        externalReference: "SALE-001",
        issueDate: "2026-08-27T10:00:00.000Z",
        customer: {
          identification: {
            typeCode: "31",
            number: "900123456",
          },
          legalName: "Cliente Uno",
        } as never,
        lines: [],
        totals: {
          subtotalAmount: 1000,
          discountAmount: 0,
          taxAmount: 190,
          totalAmount: 1190,
          currencyCode: "COP",
        },
      } as never),
    FactuCoreConflictError,
  );
});

test("401 maps to authentication error", async () => {
  const client = new FactuCoreClient(async () => buildJsonResponse(401, { message: "unauthorized" }));

  await assert.rejects(
    () => client.getStatus(context, "factucore-doc-1"),
    FactuCoreAuthenticationError,
  );
});

test("422 maps to validation error", async () => {
  const client = new FactuCoreClient(async () => buildJsonResponse(422, { message: "invalid" }));

  await assert.rejects(
    () => client.sign(context, "factucore-doc-1"),
    FactuCoreValidationError,
  );
});

test("429 maps to rate limit error", async () => {
  const client = new FactuCoreClient(async () =>
    buildJsonResponse(429, { message: "rate limited" }, {
      "Retry-After": "12",
      "X-RateLimit-Limit": "120",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1700000000",
    }));

  await assert.rejects(
    async () => {
      await client.retryTransmission(context, "factucore-doc-1");
    },
    (error: unknown) => {
      const typed = error as FactuCoreRateLimitError;
      assert.ok(error instanceof FactuCoreRateLimitError);
      assert.equal(typed.retryAfterSeconds, 12);
      assert.equal(typed.rateLimitLimit, "120");
      assert.equal(typed.rateLimitRemaining, "0");
      assert.equal(typed.rateLimitReset, "1700000000");
      return true;
    },
  );
});

test("5xx maps to unavailable error", async () => {
  const client = new FactuCoreClient(async () => buildJsonResponse(500, { message: "boom" }));

  await assert.rejects(
    () => client.transmit(context, "factucore-doc-1"),
    FactuCoreUnavailableError,
  );
});

test("timeout maps to timeout error", async () => {
  const client = new FactuCoreClient((_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        },
        { once: true },
      );
    }));

  await assert.rejects(
    () => client.generateXml({ ...context, timeoutMs: 1 }, "factucore-doc-1"),
    FactuCoreTimeoutError,
  );
});

test("network error maps to network error", async () => {
  const client = new FactuCoreClient(async () => {
    throw new Error("network detail");
  });

  await assert.rejects(
    () => client.getStatus(context, "factucore-doc-1"),
    FactuCoreNetworkError,
  );
});

test("downloadPdf returns binary content and not a string", async () => {
  const content = Buffer.from("%PDF-1.4", "utf8");
  const client = new FactuCoreClient(async () =>
    buildBinaryResponse(200, content, {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="invoice.pdf"',
    }));

  const result = await client.downloadPdf(context, "factucore-doc-1");

  assert.equal(result.fileName, "invoice.pdf");
  assert.equal(result.contentType, "application/pdf");
  assert.equal(result.content.toString("utf8"), "%PDF-1.4");
});

test("missing pdf maps to attachment not found", async () => {
  const client = new FactuCoreClient(async () => buildJsonResponse(404, { message: "missing" }));

  await assert.rejects(
    () => client.downloadPdf(context, "factucore-doc-1"),
    FactuCoreAttachmentNotFoundError,
  );
});
