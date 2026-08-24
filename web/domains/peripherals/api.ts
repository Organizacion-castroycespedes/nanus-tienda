import type {
  CashDrawerResponse,
  CashDrawerOpenInput,
  CreateDeviceRequest,
  PeripheralAgentHealth,
  PeripheralDevice,
  PeripheralDiscoverResponse,
  PeripheralLog,
  PeripheralTicketPayload,
  ScaleReadInput,
  PeripheralScaleWeight,
  PeripheralScannerResponse,
  ScannerSimulateInput,
  PrintJobResponse,
} from "./types";

export type PeripheralAgentConfigStatus = "configured" | "missing" | "invalid";

export type PeripheralAgentRequestErrorCode =
  | "MISSING_CONFIG"
  | "INVALID_CONFIG"
  | "AGENT_OFFLINE"
  | "NETWORK_ERROR"
  | "DEVICE_NOT_FOUND"
  | "TIMEOUT"
  | "CONNECTION_REFUSED"
  | "PRINT_ERROR"
  | "PRINTER_NOT_CONFIGURED"
  | "HTTP_ERROR";

export type PeripheralAgentConfig = {
  httpUrl: string;
  wsUrl: string;
  isConfigured: boolean;
  isProduction: boolean;
  status: PeripheralAgentConfigStatus;
  source: "environment" | "development-default";
  message?: string;
  errorCode?: PeripheralAgentRequestErrorCode;
};

type PeripheralAgentRequestErrorOptions = {
  endpoint?: string;
  status?: number;
  cause?: unknown;
};

export class PeripheralAgentRequestError extends Error {
  readonly code: PeripheralAgentRequestErrorCode;
  readonly endpoint?: string;
  readonly status?: number;

  constructor(
    code: PeripheralAgentRequestErrorCode,
    message: string,
    options: PeripheralAgentRequestErrorOptions = {}
  ) {
    super(message);
    this.name = "PeripheralAgentRequestError";
    this.code = code;
    this.endpoint = options.endpoint;
    this.status = options.status;
    (this as { cause?: unknown }).cause = options.cause;
  }
}

export const isPeripheralAgentRequestError = (
  error: unknown
): error is PeripheralAgentRequestError =>
  error instanceof PeripheralAgentRequestError;

const developmentHttpUrl = "http://127.0.0.1:4050";
const developmentWsUrl = "ws://127.0.0.1:4050/peripherals";

const productionHttpsRequiredMessage =
  "NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL debe ser una URL HTTPS publica en produccion.";

const missingProductionConfigMessage =
  "Falta configurar NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL para produccion.";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const normalizeHttpBaseUrl = (url: URL) => {
  const normalized = new URL(url.toString());
  normalized.search = "";
  normalized.hash = "";
  return normalizeBaseUrl(normalized.toString());
};

const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const normalizeHostname = (url: URL) =>
  url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

const isLocalHostname = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const isLocalAgentUrl = (value: string) => {
  const url = parseUrl(value);
  return url ? isLocalHostname(normalizeHostname(url)) : false;
};

const buildWsUrlFromHttpUrl = (httpUrl: string) => {
  const url = new URL(httpUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/peripherals`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const buildInvalidConfig = (
  message: string,
  httpUrl = "",
  wsUrl = ""
): PeripheralAgentConfig => ({
  httpUrl,
  wsUrl,
  isConfigured: false,
  isProduction: process.env.NODE_ENV === "production",
  status: "invalid",
  source: "environment",
  message,
  errorCode: "INVALID_CONFIG",
});

const validateWsUrl = (
  value: string,
  isProduction: boolean,
  httpUrl: string
): PeripheralAgentConfig | null => {
  const parsedWsUrl = parseUrl(value);

  if (
    !parsedWsUrl ||
    (parsedWsUrl.protocol !== "ws:" && parsedWsUrl.protocol !== "wss:")
  ) {
    return buildInvalidConfig(
      "NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL debe ser una URL ws:// o wss:// valida.",
      httpUrl,
      value
    );
  }

  if (
    isProduction &&
    (parsedWsUrl.protocol !== "wss:" ||
      isLocalHostname(normalizeHostname(parsedWsUrl)))
  ) {
    return buildInvalidConfig(
      "NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL debe ser una URL WSS publica en produccion.",
      httpUrl,
      value
    );
  }

  return null;
};

export const getPeripheralAgentConfig = (): PeripheralAgentConfig => {
  const rawHttpUrl =
    process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL?.trim() ?? "";
  const rawWsUrl =
    process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL?.trim() ?? "";
  const isProduction = process.env.NODE_ENV === "production";

  if (!rawHttpUrl) {
    if (isProduction) {
      return {
        httpUrl: "",
        wsUrl: "",
        isConfigured: false,
        isProduction,
        status: "missing",
        source: "environment",
        message: missingProductionConfigMessage,
        errorCode: "MISSING_CONFIG",
      };
    }

    const wsUrl = rawWsUrl || developmentWsUrl;
    const invalidWsConfig = validateWsUrl(wsUrl, false, developmentHttpUrl);
    if (invalidWsConfig) {
      return invalidWsConfig;
    }

    return {
      httpUrl: developmentHttpUrl,
      wsUrl,
      isConfigured: true,
      isProduction,
      status: "configured",
      source: "development-default",
    };
  }

  const parsedHttpUrl = parseUrl(rawHttpUrl);
  if (
    !parsedHttpUrl ||
    (parsedHttpUrl.protocol !== "http:" && parsedHttpUrl.protocol !== "https:")
  ) {
    return buildInvalidConfig(
      "NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL debe ser una URL http:// o https:// valida.",
      rawHttpUrl
    );
  }

  const httpUrl = normalizeHttpBaseUrl(parsedHttpUrl);
  if (
    isProduction &&
    (parsedHttpUrl.protocol !== "https:" ||
      isLocalHostname(normalizeHostname(parsedHttpUrl)))
  ) {
    return buildInvalidConfig(productionHttpsRequiredMessage, httpUrl);
  }

  const wsUrl = rawWsUrl || buildWsUrlFromHttpUrl(httpUrl);
  const invalidWsConfig = validateWsUrl(wsUrl, isProduction, httpUrl);
  if (invalidWsConfig) {
    return invalidWsConfig;
  }

  return {
    httpUrl,
    wsUrl,
    isConfigured: true,
    isProduction,
    status: "configured",
    source: "environment",
  };
};

export const PERIPHERALS_AGENT_HTTP_URL = getPeripheralAgentConfig().httpUrl;
export const PERIPHERALS_AGENT_WS_URL = getPeripheralAgentConfig().wsUrl;

const requirePeripheralAgentConfig = () => {
  const config = getPeripheralAgentConfig();

  if (!config.isConfigured) {
    throw new PeripheralAgentRequestError(
      config.errorCode ?? "INVALID_CONFIG",
      config.message ?? "Configuracion de backend-perifericos invalida.",
      { endpoint: config.httpUrl }
    );
  }

  return config;
};

const buildQueryString = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
};

const parseErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof payload.message === "string") {
      return payload.message;
    }
    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }
    if (typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    return response.statusText || "Error HTTP local";
  }

  return response.statusText || "Error HTTP local";
};

export const requestPeripheral = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const config = requirePeripheralAgentConfig();
  const url = `${normalizeBaseUrl(config.httpUrl)}${path}`;
  const headers = new Headers(init?.headers);

  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (error) {
    const code: PeripheralAgentRequestErrorCode = isLocalAgentUrl(config.httpUrl)
      ? "AGENT_OFFLINE"
      : "NETWORK_ERROR";
    const message =
      code === "AGENT_OFFLINE"
        ? `El backend de perifericos no esta disponible en ${config.httpUrl}.`
        : `No se pudo conectar con backend-perifericos en ${config.httpUrl}. Verifique CORS, red y HTTPS.`;

    throw new PeripheralAgentRequestError(code, message, {
      endpoint: url,
      cause: error,
    });
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new PeripheralAgentRequestError(
      classifyAgentHttpError(response.status, message),
      message,
      {
        endpoint: url,
        status: response.status,
      }
    );
  }

  return (await response.json()) as T;
};

const classifyAgentHttpError = (
  status: number,
  message: string
): PeripheralAgentRequestErrorCode => {
  const normalized = message.toLowerCase();
  if (status === 404 || normalized.includes("device not found")) {
    return "DEVICE_NOT_FOUND";
  }
  if (normalized.includes("timed out")) {
    return "TIMEOUT";
  }
  if (normalized.includes("refused") || normalized.includes("socket error")) {
    return "CONNECTION_REFUSED";
  }
  if (normalized.includes("printer") && normalized.includes("failed")) {
    return "PRINT_ERROR";
  }
  return "HTTP_ERROR";
};

export const fetchPeripheralHealth = () =>
  requestPeripheral<PeripheralAgentHealth>("/health");

export const fetchPeripheralDevices = () =>
  requestPeripheral<PeripheralDevice[]>("/devices");

export const discoverPeripheralDevices = () =>
  requestPeripheral<PeripheralDiscoverResponse>("/devices/discover", {
    method: "POST",
    body: JSON.stringify({ terminalId: "local-terminal" }),
  });

export const createDevice = (payload: CreateDeviceRequest) =>
  requestPeripheral<PeripheralDevice>("/devices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const testPrint = (terminalId: string, deviceId: string) =>
  requestPeripheral<PrintJobResponse>("/printer/test-print", {
    method: "POST",
    body: JSON.stringify({ terminalId, deviceId }),
  });

export const printTicket = (payload: PeripheralTicketPayload) =>
  requestPeripheral<PrintJobResponse>("/printer/print-ticket", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const printMockTicket = (terminalId: string, deviceId: string) =>
  printTicket({
    terminalId,
    deviceId,
    ticketType: "SALE",
    content: {
      businessName: "Castro & Cespedes",
      documentNumber: "FV-MOCK-001",
      cashier: "Caja 1",
      items: [
        {
          name: "Producto demo",
          quantity: 2,
          unitPrice: 5000,
          total: 10000,
        },
      ],
      subtotal: 10000,
      taxes: 1900,
      discounts: 0,
      total: 11900,
      payments: [
        {
          method: "EFECTIVO",
          amount: 11900,
        },
      ],
      footer: "Gracias por su compra",
    },
  });

export const openCashDrawerCommand = (payload: CashDrawerOpenInput) =>
  requestPeripheral<CashDrawerResponse>("/cash-drawer/open", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const openCashDrawer = (
  terminalId: string,
  deviceId: string,
  reason = "SALE_CASH_PAYMENT",
  printerDeviceId?: string
) =>
  openCashDrawerCommand({ terminalId, deviceId, printerDeviceId, reason });

export const fetchCurrentWeight = (input: ScaleReadInput = {}) =>
  requestPeripheral<PeripheralScaleWeight>(
    `/scale/current-weight${buildQueryString({
      terminalId: input.terminalId,
      deviceId: input.deviceId,
    })}`
  );

export const simulateScannerCommand = (payload: ScannerSimulateInput) =>
  requestPeripheral<PeripheralScannerResponse>("/scanner/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const simulateScanner = (
  terminalId: string,
  deviceId: string,
  code: string,
  format: string
) =>
  simulateScannerCommand({ terminalId, deviceId, code, format });

export const fetchPeripheralLogs = () =>
  requestPeripheral<PeripheralLog[]>("/logs");
