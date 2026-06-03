import assert from "node:assert/strict";
import crypto from "crypto";
import { describe, it } from "node:test";
import type { GetAcquirerSignedSoapRequest } from "./third-party-lookup.get-acquirer-adapter";
import {
  GetAcquirerHttpTransport,
  type GetAcquirerFetch,
} from "./third-party-lookup.get-acquirer-http-transport";
import {
  GET_ACQUIRER_ACTION,
  buildGetAcquirerSoapContentType,
} from "./third-party-lookup.get-acquirer-request.builder";

const signedXml =
  "<soap:Envelope><wsse:BinarySecurityToken>TEST ONLY</wsse:BinarySecurityToken><ds:Signature>TEST ONLY</ds:Signature></soap:Envelope>";

const buildSignedRequest = (
  overrides: Partial<GetAcquirerSignedSoapRequest> = {}
): GetAcquirerSignedSoapRequest => ({
  operation: "GetAcquirer",
  externalCallEnabled: false,
  endpointUrl: "https://example.test/GetAcquirer",
  timeoutMs: 50,
  action: GET_ACQUIRER_ACTION,
  contentType: buildGetAcquirerSoapContentType(),
  messageId: "urn:uuid:00000000-0000-4000-8000-000000000001",
  identificationType: "31",
  identificationNumber: "900123456",
  signedXml,
  signedXmlSha256: crypto.createHash("sha256").update(signedXml).digest("hex"),
  signedXmlSize: Buffer.byteLength(signedXml, "utf8"),
  binarySecurityTokenId: "BinarySecurityToken-1",
  signedReferenceUris: ["#Body-1", "#Timestamp-1"],
  rawCertificateIncluded: false,
  rawPasswordIncluded: false,
  ...overrides,
});

const buildResponse = (status: number, body: string): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }) as Response;

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

describe("GetAcquirerHttpTransport FE-3.7.7", () => {
  it("does not call fetch when external HTTP is disabled", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      throw new Error("fetch must not be called");
    }) as GetAcquirerFetch;
    const transport = new GetAcquirerHttpTransport(fetchImpl);

    const result = await transport.submitSignedRequest(buildSignedRequest());

    assert.equal(calls, 0);
    assert.equal(result.externalCallMade, false);
    assert.equal(result.statusCode, "EXTERNAL_CALL_DISABLED");
    assert.equal(result.hasBinarySecurityToken, true);
    assert.equal(result.hasSignature, true);
    assert.deepEqual(result.signedReferenceUris, [
      "#Body-1",
      "#Timestamp-1",
    ]);
  });

  it("posts signed SOAP with fetch when explicit HTTP flag is enabled", async () => {
    const responseXml =
      "<soap:Envelope><soap:Body><GetAcquirerResponse /></soap:Body></soap:Envelope>";
    const calls: Array<{
      url: Parameters<GetAcquirerFetch>[0];
      init: Parameters<GetAcquirerFetch>[1];
    }> = [];
    const fetchImpl = (async (url, init) => {
      calls.push({ url, init });
      return buildResponse(200, responseXml);
    }) as GetAcquirerFetch;
    const transport = new GetAcquirerHttpTransport(fetchImpl);
    const request = buildSignedRequest({ externalCallEnabled: true });

    const result = await transport.submitSignedRequest(request);

    assert.equal(calls.length, 1);
    assert.equal(String(calls[0].url), request.endpointUrl);
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(calls[0].init?.body, request.signedXml);
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Accept, "application/soap+xml, text/xml");
    assert.equal(
      headers["Content-Type"],
      `application/soap+xml; charset=utf-8; action="${GET_ACQUIRER_ACTION}"`
    );
    assert.equal(result.externalCallMade, true);
    assert.equal(result.statusCode, "HTTP_OK");
    assert.equal(result.httpStatus, 200);
    assert.equal(
      result.responseTextSha256,
      crypto.createHash("sha256").update(responseXml).digest("hex")
    );
    assert.equal(result.responseTextSize, Buffer.byteLength(responseXml, "utf8"));
    assert.equal(hasOwn(result, "responseText"), false);
    assert.equal(hasOwn(result, "signedXml"), false);
    assert.equal(hasOwn(result, "raw"), false);
  });

  it("maps non-2xx HTTP responses without raw SOAP", async () => {
    const responseXml = "<soap:Envelope><soap:Fault /></soap:Envelope>";
    const fetchImpl = (async () => buildResponse(500, responseXml)) as GetAcquirerFetch;
    const transport = new GetAcquirerHttpTransport(fetchImpl);

    const result = await transport.submitSignedRequest(
      buildSignedRequest({ externalCallEnabled: true })
    );

    assert.equal(result.externalCallMade, true);
    assert.equal(result.statusCode, "HTTP_ERROR");
    assert.equal(result.httpStatus, 500);
    assert.equal(result.responseTextSize, Buffer.byteLength(responseXml, "utf8"));
    assert.equal(hasOwn(result, "responseText"), false);
  });

  it("maps network errors to a safe technical status", async () => {
    const fetchImpl = (async () => {
      throw new Error("network detail should stay out");
    }) as GetAcquirerFetch;
    const transport = new GetAcquirerHttpTransport(fetchImpl);

    const result = await transport.submitSignedRequest(
      buildSignedRequest({ externalCallEnabled: true })
    );

    assert.equal(result.externalCallMade, true);
    assert.equal(result.statusCode, "HTTP_NETWORK_ERROR");
    assert.equal(result.message.includes("network detail"), false);
    assert.equal(hasOwn(result, "responseText"), false);
  });

  it("maps abort timeout to a safe technical status", async () => {
    const fetchImpl = ((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      })) as GetAcquirerFetch;
    const transport = new GetAcquirerHttpTransport(fetchImpl);

    const result = await transport.submitSignedRequest(
      buildSignedRequest({ externalCallEnabled: true, timeoutMs: 1 })
    );

    assert.equal(result.externalCallMade, true);
    assert.equal(result.statusCode, "HTTP_TIMEOUT");
    assert.equal(result.message.includes("aborted"), false);
    assert.equal(hasOwn(result, "responseText"), false);
  });
});
