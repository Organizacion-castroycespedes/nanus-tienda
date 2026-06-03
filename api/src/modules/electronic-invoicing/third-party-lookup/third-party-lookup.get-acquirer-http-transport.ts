import crypto from "crypto";
import type {
  GetAcquirerSignedSoapRequest,
  GetAcquirerSoapTransport,
  GetAcquirerSoapTransportResult,
} from "./third-party-lookup.get-acquirer-adapter";

export type GetAcquirerFetch = typeof fetch;

const buildSignedRequestSummary = (
  request: GetAcquirerSignedSoapRequest
) => ({
  signedXmlSha256: request.signedXmlSha256,
  signedXmlSize: request.signedXmlSize,
  hasBinarySecurityToken: request.signedXml.includes("BinarySecurityToken"),
  hasSignature: request.signedXml.includes("<ds:Signature"),
  signedReferenceUris: request.signedReferenceUris,
});

const hashText = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

export class GetAcquirerHttpTransport implements GetAcquirerSoapTransport {
  constructor(private readonly fetchImpl: GetAcquirerFetch = fetch) {}

  async submitSignedRequest(
    request: GetAcquirerSignedSoapRequest
  ): Promise<GetAcquirerSoapTransportResult> {
    const summary = buildSignedRequestSummary(request);

    if (!request.externalCallEnabled) {
      return {
        externalCallMade: false,
        statusCode: "EXTERNAL_CALL_DISABLED",
        message:
          "DIAN GetAcquirer HTTP transport is disabled by configuration",
        ...summary,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await this.fetchImpl(request.endpointUrl, {
        method: "POST",
        headers: {
          Accept: "application/soap+xml, text/xml",
          "Content-Type": `application/soap+xml; charset=utf-8; action="${request.action}"`,
        },
        body: request.signedXml,
        signal: controller.signal,
      });
      const responseText = await response.text();
      const responseTextSize = Buffer.byteLength(responseText, "utf8");

      return {
        externalCallMade: true,
        statusCode: response.ok ? "HTTP_OK" : "HTTP_ERROR",
        message: response.ok
          ? "DIAN GetAcquirer HTTP response received"
          : "DIAN GetAcquirer HTTP error response received",
        httpStatus: response.status,
        responseTextSha256: hashText(responseText),
        responseTextSize,
        ...summary,
      };
    } catch (error) {
      return {
        externalCallMade: true,
        statusCode: isAbortError(error)
          ? "HTTP_TIMEOUT"
          : "HTTP_NETWORK_ERROR",
        message: isAbortError(error)
          ? "DIAN GetAcquirer HTTP request timed out"
          : "DIAN GetAcquirer HTTP request failed",
        ...summary,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
