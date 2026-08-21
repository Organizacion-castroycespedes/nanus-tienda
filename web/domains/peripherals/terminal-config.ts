import { apiClient } from "../../lib/http";
import type {
  CreatePosTerminalRequest,
  PosTerminalPeripheralSettings,
  PosTerminalResolvedConfig,
  PosTerminalResponse,
  UpdatePosTerminalPeripheralSettingsRequest,
  UpdatePosTerminalRequest,
} from "./types";

export const DEFAULT_POS_TERMINAL_ID = "local-terminal";
export const DEFAULT_PRINTER_DEVICE_ID = "mock-printer-001";
export const DEFAULT_CASH_DRAWER_DEVICE_ID = "mock-cashdrawer-001";
export const DEFAULT_SCALE_DEVICE_ID = "mock-scale-001";
export const DEFAULT_SCANNER_DEVICE_ID = "mock-scanner-001";

type ResolveConfigInput = {
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  terminalCode?: string | null;
};

const buildQueryString = (
  params: Record<string, string | null | undefined>
) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const normalized = value?.trim();
    if (normalized) {
      query.set(key, normalized);
    }
  });
  const value = query.toString();
  return value ? `?${value}` : "";
};

const getTenantFromPath = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const [, tenant] = window.location.pathname.split("/");
  return tenant || null;
};

export const buildFallbackPosTerminalConfig = (
  input: ResolveConfigInput = {}
): PosTerminalResolvedConfig => ({
  terminalId: input.terminalId?.trim() || DEFAULT_POS_TERMINAL_ID,
  agentTerminalCode: DEFAULT_POS_TERMINAL_ID,
  operationalTerminalId: null,
  operationalTerminalCode: null,
  operationalTerminalName: null,
  posTerminalId: null,
  tenantId: input.tenantId?.trim() || getTenantFromPath(),
  branchId: input.branchId?.trim() || null,
  branchName: null,
  code: input.terminalId?.trim() || DEFAULT_POS_TERMINAL_ID,
  name: "Terminal MOCK local",
  mode: "MOCK",
  active: true,
  source: "FALLBACK_MOCK",
  printerDeviceId: DEFAULT_PRINTER_DEVICE_ID,
  cashDrawerDeviceId: DEFAULT_CASH_DRAWER_DEVICE_ID,
  scaleDeviceId: DEFAULT_SCALE_DEVICE_ID,
  scannerDeviceId: DEFAULT_SCANNER_DEVICE_ID,
  features: {
    printSale: true,
    printPurchase: true,
    printOrder: true,
    openDrawer: true,
    scale: true,
    scanner: true,
  },
  createdAt: null,
  updatedAt: null,
});

export const listPosTerminals = (params: {
  tenantId?: string | null;
  branchId?: string | null;
}) =>
  apiClient<PosTerminalResponse[]>(
    `/pos-terminals${buildQueryString({
      tenantId: params.tenantId,
      branchId: params.branchId,
    })}`
  );

export const createPosTerminal = (payload: CreatePosTerminalRequest) =>
  apiClient<PosTerminalResponse>("/pos-terminals", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updatePosTerminal = (
  terminalId: string,
  payload: UpdatePosTerminalRequest
) =>
  apiClient<PosTerminalResponse>(`/pos-terminals/${terminalId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const getPosTerminalPeripheralSettings = (terminalId: string) =>
  apiClient<PosTerminalPeripheralSettings>(
    `/pos-terminals/${terminalId}/peripherals`
  );

export const savePosTerminalPeripheralSettings = (
  terminalId: string,
  payload: UpdatePosTerminalPeripheralSettingsRequest
) =>
  apiClient<PosTerminalPeripheralSettings>(
    `/pos-terminals/${terminalId}/peripherals`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );

export const resolveCurrentPosTerminalConfig = (input: ResolveConfigInput = {}) =>
  apiClient<PosTerminalResolvedConfig>(
    `/pos-terminals/resolve-current${buildQueryString({
      tenantId: input.tenantId ?? getTenantFromPath(),
      branchId: input.branchId,
      terminalId: input.terminalId,
      terminalCode: input.terminalCode,
    })}`
  );

export const resolvePeripheralTerminalConfig = async (
  input: ResolveConfigInput = {}
) => {
  try {
    return await resolveCurrentPosTerminalConfig(input);
  } catch {
    const requestedTerminalId = input.terminalId?.trim();
    const isOperationalTerminalId = Boolean(
      requestedTerminalId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          requestedTerminalId
        )
    );
    if (isOperationalTerminalId) {
      throw new Error("No se pudo resolver la configuracion de la terminal operativa.");
    }
    return buildFallbackPosTerminalConfig(input);
  }
};
