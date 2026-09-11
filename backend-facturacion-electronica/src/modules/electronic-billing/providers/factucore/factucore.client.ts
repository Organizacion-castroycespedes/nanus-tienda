import {
  FactuCoreAuthenticationError,
  FactuCoreAttachmentNotFoundError,
  FactuCoreConflictError,
  FactuCoreNetworkError,
  FactuCoreRateLimitError,
  FactuCoreTimeoutError,
  FactuCoreUnavailableError,
  FactuCoreValidationError,
  extractFactuCoreValidationDetails,
} from "./factucore.errors";
import {
  FACTUCORE_DEFAULT_TIMEOUT_MS,
  FACTUCORE_DOCUMENT_ENDPOINT,
  type FactuCoreBinaryResponse,
  type FactuCoreCreditNoteRequest,
  type FactuCoreDocumentOperationsResponse,
  type FactuCoreDocumentResponse,
  type FactuCoreDownloadType,
  type FactuCoreInvoiceRequest,
  type FactuCoreRuntimeContext,
  type FactuCoreStatusResponse,
} from "./factucore.types";

export type FactuCoreFetch = typeof fetch;

type FactuCoreJsonRequest = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  operation: string;
  context: FactuCoreRuntimeContext;
  timeoutMs?: number;
  body?: unknown;
  headers?: Record<string, string>;
};

type FactuCoreBinaryRequest = {
  method: "GET";
  path: string;
  operation: string;
  context: FactuCoreRuntimeContext;
  timeoutMs?: number;
  headers?: Record<string, string>;
  attachmentType: FactuCoreDownloadType;
};

const FACTUCORE_DEFAULT_HEADERS = {
  Accept: "application/json",
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/+$/, "");

const parseRetryAfterSeconds = (value: string | null) => {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }

  const parsedDate = Date.parse(value);
  if (Number.isFinite(parsedDate)) {
    const deltaSeconds = Math.ceil((parsedDate - Date.now()) / 1000);
    return deltaSeconds >= 0 ? deltaSeconds : 0;
  }

  return null;
};

const readHeader = (headers: Headers, name: string) => headers.get(name) ?? headers.get(name.toLowerCase());

const readResponseText = async (response: Response) => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const parseJson = <T>(value: string, fallback: T): T => {
  if (!value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const buildUrl = (baseUrl: string, path: string) => new URL(path.startsWith("/") ? path : `/${path}`, normalizeBaseUrl(baseUrl));

const isAbortError = (error: unknown) =>
  error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");

const getFileNameFromDisposition = (value: string | null) => {
  if (!value) {
    return null;
  }

  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(value);
  const raw = match?.[1] ?? match?.[2] ?? null;
  return raw ? decodeURIComponent(raw) : null;
};

export class FactuCoreClient {
  constructor(
    private readonly fetchImpl: FactuCoreFetch = fetch,
    private readonly defaultTimeoutMs = FACTUCORE_DEFAULT_TIMEOUT_MS,
  ) {}

  async createInvoice(context: FactuCoreRuntimeContext, request: FactuCoreInvoiceRequest) {
    return this.requestJson<FactuCoreDocumentResponse>({
      method: "POST",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/invoices`,
      operation: "create_invoice",
      context,
      body: request,
    });
  }

  async createCreditNote(context: FactuCoreRuntimeContext, request: FactuCoreCreditNoteRequest) {
    return this.requestJson<FactuCoreDocumentResponse>({
      method: "POST",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/credit-notes`,
      operation: "create_credit_note",
      context,
      body: request,
    });
  }

  async generateXml(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestJson<FactuCoreDocumentResponse>({
      method: "POST",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/generate-xml`,
      operation: "generate_xml",
      context,
    });
  }

  async sign(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestJson<FactuCoreDocumentResponse>({
      method: "POST",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/sign`,
      operation: "sign",
      context,
    });
  }

  async transmit(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestJson<FactuCoreDocumentResponse>({
      method: "POST",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/transmit`,
      operation: "transmit",
      context,
    });
  }

  async retryTransmission(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestJson<FactuCoreDocumentResponse>({
      method: "POST",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/retry-transmission`,
      operation: "retry_transmission",
      context,
    });
  }

  async getStatus(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestJson<FactuCoreStatusResponse>({
      method: "GET",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/status`,
      operation: "get_status",
      context,
    });
  }

  async getOperations(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestJson<FactuCoreDocumentOperationsResponse>({
      method: "GET",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/operations`,
      operation: "get_operations",
      context,
    });
  }

  async getStatusByExternalReference(
    context: FactuCoreRuntimeContext,
    externalReference: string,
    documentType?: string | null,
  ) {
    const query = documentType ? `?documentType=${encodeURIComponent(documentType)}` : "";
    return this.requestJson<FactuCoreStatusResponse>({
      method: "GET",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/status/by-external-reference/${encodeURIComponent(externalReference)}${query}`,
      operation: "get_status_by_external_reference",
      context,
    });
  }

  async downloadXml(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestBinary({
      method: "GET",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/download/xml`,
      operation: "download_xml",
      context,
      attachmentType: "XML",
      headers: { Accept: "application/xml, text/xml, application/octet-stream, */*" },
    });
  }

  async downloadSignedXml(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestBinary({
      method: "GET",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/download/xml-signed`,
      operation: "download_signed_xml",
      context,
      attachmentType: "SIGNED_XML",
      headers: { Accept: "application/xml, text/xml, application/octet-stream, */*" },
    });
  }

  async downloadPdf(context: FactuCoreRuntimeContext, documentId: string) {
    return this.requestBinary({
      method: "GET",
      path: `${FACTUCORE_DOCUMENT_ENDPOINT}/${encodeURIComponent(documentId)}/download/pdf`,
      operation: "download_pdf",
      context,
      attachmentType: "PDF",
      headers: { Accept: "application/pdf, application/octet-stream, */*" },
    });
  }

  private async requestJson<T>(request: FactuCoreJsonRequest): Promise<T> {
    const response = await this.request(request);
    const responseText = await readResponseText(response);

    if (!response.ok) {
      throw this.mapHttpError(request.operation, response, responseText);
    }

    if (!responseText.trim()) {
      return {} as T;
    }

    return parseJson<T>(responseText, {} as T);
  }

  private async requestBinary(request: FactuCoreBinaryRequest): Promise<FactuCoreBinaryResponse> {
    const response = await this.request(request);

    if (!response.ok) {
      const responseText = await readResponseText(response);
      if (response.status === 404) {
        throw new FactuCoreAttachmentNotFoundError(request.operation, "FactuCore attachment not found");
      }
      throw this.mapHttpError(request.operation, response, responseText);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      content: buffer,
      contentType: readHeader(response.headers, "content-type"),
      fileName:
        getFileNameFromDisposition(readHeader(response.headers, "content-disposition"))
        ?? `${request.attachmentType.toLowerCase().replace(/_/g, "-")}.bin`,
      sizeBytes: buffer.byteLength,
      providerAttachmentId: readHeader(response.headers, "x-factucore-attachment-id"),
    };
  }

  private async request(request: FactuCoreJsonRequest | FactuCoreBinaryRequest) {
    const controller = new AbortController();
    const timeoutMs = request.timeoutMs ?? request.context.timeoutMs ?? this.defaultTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const url = buildUrl(request.context.baseUrl, request.path);
    const credentials = request.context.credentials;

    try {
      const hasBody = "body" in request && request.body !== undefined;
      return await this.fetchImpl(url, {
        method: request.method,
        headers: {
          ...FACTUCORE_DEFAULT_HEADERS,
          ...(request.headers ?? {}),
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          "x-client-key": credentials.clientKey,
          "x-client-secret": credentials.clientSecret,
        },
        body: hasBody ? JSON.stringify((request as FactuCoreJsonRequest).body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new FactuCoreTimeoutError(request.operation);
      }

      throw new FactuCoreNetworkError(request.operation);
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapHttpError(operation: string, response: Response, responseText: string) {
    const status = response.status;
    const payload = parseJson<unknown>(responseText, null);
    const validationDetails = extractFactuCoreValidationDetails(payload);
    const providerCode = this.readProviderCode(payload);
    const validationMessage = validationDetails.length > 0
      ? validationDetails.map((detail) => detail.path ? `${detail.path}: ${detail.message}` : detail.message).join("; ").slice(0, 2000)
      : "FactuCore rejected the request payload";

    if (status === 401 || status === 403) {
      return new FactuCoreAuthenticationError(operation, status);
    }

    if (status === 409) {
      return new FactuCoreConflictError(operation, status, "FactuCore conflict for existing external reference");
    }

    if (status === 422) {
      return new FactuCoreValidationError(operation, status, validationMessage, validationDetails, providerCode);
    }

    if (status === 429) {
      return new FactuCoreRateLimitError(
        operation,
        status,
        parseRetryAfterSeconds(readHeader(response.headers, "retry-after")),
        readHeader(response.headers, "x-ratelimit-limit"),
        readHeader(response.headers, "x-ratelimit-remaining"),
        readHeader(response.headers, "x-ratelimit-reset"),
        "FactuCore rate limit exceeded",
      );
    }

    if (status >= 500) {
      return new FactuCoreUnavailableError(operation, status, "FactuCore service unavailable");
    }

    if (status === 404) {
      return new FactuCoreValidationError(operation, status, "FactuCore resource not found");
    }

    const bodyPreview = responseText.trim().slice(0, 200);
    return new FactuCoreValidationError(
      operation,
      status,
      validationDetails.length > 0
        ? validationMessage
        : bodyPreview.length > 0
          ? `FactuCore request failed with status ${status}`
          : `FactuCore request failed with status ${status}`,
      validationDetails,
      providerCode,
    );
  }

  private readProviderCode(payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const code = (payload as Record<string, unknown>).code;
    return typeof code === "string" && /^[A-Z][A-Z0-9_]{2,79}$/.test(code) ? code : null;
  }
}
