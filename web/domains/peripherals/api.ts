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

export const PERIPHERALS_AGENT_HTTP_URL =
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL ?? "http://localhost:4050";

export const PERIPHERALS_AGENT_WS_URL =
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL ??
  "ws://localhost:4050/peripherals";

const unavailableMessage =
  "El agente local de perifericos no esta disponible en localhost:4050.";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

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
  const url = `${normalizeBaseUrl(PERIPHERALS_AGENT_HTTP_URL)}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(unavailableMessage);
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as T;
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
  reason = "SALE_CASH_PAYMENT"
) =>
  openCashDrawerCommand({ terminalId, deviceId, reason });

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
