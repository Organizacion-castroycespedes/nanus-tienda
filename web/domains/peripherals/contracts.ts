import {
  fetchCurrentWeight,
  fetchPeripheralDevices,
  fetchPeripheralHealth,
  openCashDrawerCommand,
  printTicket,
  simulateScannerCommand,
} from "./api";
import {
  buildOrderTicketPayload,
  buildPurchaseTicketPayload,
  buildSaleTicketPayload,
} from "./ticket-builders";
import {
  DEFAULT_CASH_DRAWER_DEVICE_ID,
  DEFAULT_PRINTER_DEVICE_ID,
  DEFAULT_SCALE_DEVICE_ID,
  DEFAULT_SCANNER_DEVICE_ID,
  DEFAULT_POS_TERMINAL_ID,
  resolvePeripheralTerminalConfig,
} from "./terminal-config";
import type {
  CashDrawerOpenInput,
  CashDrawerResponse,
  OrderTicketInput,
  PeripheralAgentHealth,
  PeripheralDevice,
  PeripheralFeatureFlags,
  PeripheralOperationError,
  PeripheralOperationResult,
  PeripheralScannerResponse,
  PeripheralSocketEvent,
  PosTerminalFeatureFlags,
  PrintJobResponse,
  PurchaseTicketInput,
  SaleTicketInput,
  ScaleReadInput,
  ScaleReadResult,
  ScannerReadResult,
  ScannerSimulateInput,
} from "./types";

export {
  buildOrderTicketPayload,
  buildPurchaseTicketPayload,
  buildSaleTicketPayload,
};

type FeatureName = keyof PeripheralFeatureFlags;
type TerminalFeatureName = keyof PosTerminalFeatureFlags;
type ConfigurablePeripheralInput = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  deviceId?: string;
};
type DeviceRole = "printer" | "cashDrawer" | "scale" | "scanner";

const defaultScannerFormat = "CODE128";
const defaultDeviceByRole: Record<DeviceRole, string> = {
  printer: DEFAULT_PRINTER_DEVICE_ID,
  cashDrawer: DEFAULT_CASH_DRAWER_DEVICE_ID,
  scale: DEFAULT_SCALE_DEVICE_ID,
  scanner: DEFAULT_SCANNER_DEVICE_ID,
};

const parsePublicFlag = (value: string | undefined, defaultValue = true) => {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  return value === "true";
};

export const getPeripheralFeatureFlags = (): PeripheralFeatureFlags => ({
  peripheralsEnabled: parsePublicFlag(process.env.NEXT_PUBLIC_PERIPHERALS_ENABLED),
  printSaleEnabled: parsePublicFlag(
    process.env.NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED
  ),
  printPurchaseEnabled: parsePublicFlag(
    process.env.NEXT_PUBLIC_PERIPHERALS_PRINT_PURCHASE_ENABLED
  ),
  printOrderEnabled: parsePublicFlag(
    process.env.NEXT_PUBLIC_PERIPHERALS_PRINT_ORDER_ENABLED
  ),
  openDrawerEnabled: parsePublicFlag(
    process.env.NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED
  ),
  scaleEnabled: parsePublicFlag(process.env.NEXT_PUBLIC_PERIPHERALS_SCALE_ENABLED),
  scannerEnabled: parsePublicFlag(
    process.env.NEXT_PUBLIC_PERIPHERALS_SCANNER_ENABLED
  ),
});

const buildOperationError = (
  operation: string,
  code: PeripheralOperationError["code"],
  message: string
): PeripheralOperationError => ({
  code,
  message,
  operation,
  timestamp: new Date().toISOString(),
});

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Error controlado de perifericos.";

const normalizeOperationError = (
  operation: string,
  error: unknown
): PeripheralOperationError => {
  const message = getErrorMessage(error);
  const code = message.includes("agente local de perifericos no esta disponible")
    ? "AGENT_OFFLINE"
    : "AGENT_ERROR";

  return buildOperationError(operation, code, message);
};

const runPeripheralOperation = async <T>(
  operation: string,
  featureName: FeatureName | null,
  action: () => Promise<T>
): Promise<PeripheralOperationResult<T>> => {
  const flags = getPeripheralFeatureFlags();

  if (!flags.peripheralsEnabled) {
    return {
      success: false,
      error: buildOperationError(
        operation,
        "PERIPHERALS_DISABLED",
        "La capa frontend de perifericos esta desactivada por NEXT_PUBLIC_PERIPHERALS_ENABLED=false."
      ),
    };
  }

  if (featureName && !flags[featureName]) {
    return {
      success: false,
      error: buildOperationError(
        operation,
        "OPERATION_DISABLED",
        `La operacion ${operation} esta desactivada por feature flag frontend.`
      ),
    };
  }

  try {
    return {
      success: true,
      data: await action(),
    };
  } catch (error) {
    return {
      success: false,
      error: normalizeOperationError(operation, error),
    };
  }
};

const resolveConfiguredInput = async <T extends ConfigurablePeripheralInput>(
  input: T,
  deviceRole: DeviceRole
): Promise<T> => {
  const config = await resolvePeripheralTerminalConfig({
    tenantId: input.tenantId,
    branchId: input.branchId,
    terminalId: input.terminalId,
  });
  const defaultDeviceId = defaultDeviceByRole[deviceRole];
  const configuredDeviceId =
    deviceRole === "printer"
      ? config.printerDeviceId
      : deviceRole === "cashDrawer"
        ? config.cashDrawerDeviceId
        : deviceRole === "scale"
          ? config.scaleDeviceId
          : config.scannerDeviceId;
  const shouldUseConfiguredDevice =
    !input.deviceId || input.deviceId === defaultDeviceId;
  const terminalId =
    config.source === "CONFIGURED"
      ? config.terminalId
      : input.terminalId ?? config.terminalId ?? DEFAULT_POS_TERMINAL_ID;

  return {
    ...input,
    terminalId,
    deviceId: shouldUseConfiguredDevice ? configuredDeviceId : input.deviceId,
  };
};

const runConfiguredPeripheralOperation = async <
  TResponse,
  TInput extends ConfigurablePeripheralInput,
>(
  operation: string,
  featureName: FeatureName,
  terminalFeatureName: TerminalFeatureName,
  deviceRole: DeviceRole,
  input: TInput,
  action: (configuredInput: TInput) => Promise<TResponse>
): Promise<PeripheralOperationResult<TResponse>> => {
  const flags = getPeripheralFeatureFlags();

  if (!flags.peripheralsEnabled) {
    return {
      success: false,
      error: buildOperationError(
        operation,
        "PERIPHERALS_DISABLED",
        "La capa frontend de perifericos esta desactivada por NEXT_PUBLIC_PERIPHERALS_ENABLED=false."
      ),
    };
  }

  if (!flags[featureName]) {
    return {
      success: false,
      error: buildOperationError(
        operation,
        "OPERATION_DISABLED",
        `La operacion ${operation} esta desactivada por feature flag frontend.`
      ),
    };
  }

  const config = await resolvePeripheralTerminalConfig({
    tenantId: input.tenantId,
    branchId: input.branchId,
    terminalId: input.terminalId,
  });

  if (!config.features[terminalFeatureName]) {
    return {
      success: false,
      error: buildOperationError(
        operation,
        "OPERATION_DISABLED",
        `La operacion ${operation} esta desactivada para la terminal POS.`
      ),
    };
  }

  try {
    const configuredInput = await resolveConfiguredInput(input, deviceRole);
    return {
      success: true,
      data: await action(configuredInput),
    };
  } catch (error) {
    return {
      success: false,
      error: normalizeOperationError(operation, error),
    };
  }
};

export const getPeripheralAgentHealth = () =>
  runPeripheralOperation<PeripheralAgentHealth>(
    "getPeripheralAgentHealth",
    null,
    fetchPeripheralHealth
  );

export const getPeripheralDevices = () =>
  runPeripheralOperation<PeripheralDevice[]>(
    "getPeripheralDevices",
    null,
    fetchPeripheralDevices
  );

export const printSaleTicket = (input: SaleTicketInput) =>
  runConfiguredPeripheralOperation<PrintJobResponse, SaleTicketInput>(
    "printSaleTicket",
    "printSaleEnabled",
    "printSale",
    "printer",
    input,
    (configuredInput) => printTicket(buildSaleTicketPayload(configuredInput))
  );

export const printPurchaseTicket = (input: PurchaseTicketInput) =>
  runConfiguredPeripheralOperation<PrintJobResponse, PurchaseTicketInput>(
    "printPurchaseTicket",
    "printPurchaseEnabled",
    "printPurchase",
    "printer",
    input,
    (configuredInput) => printTicket(buildPurchaseTicketPayload(configuredInput))
  );

export const printOrderTicket = (input: OrderTicketInput) =>
  runConfiguredPeripheralOperation<PrintJobResponse, OrderTicketInput>(
    "printOrderTicket",
    "printOrderEnabled",
    "printOrder",
    "printer",
    input,
    (configuredInput) => printTicket(buildOrderTicketPayload(configuredInput))
  );

export const openCashDrawer = (input: CashDrawerOpenInput) =>
  runConfiguredPeripheralOperation<CashDrawerResponse, CashDrawerOpenInput>(
    "openCashDrawer",
    "openDrawerEnabled",
    "openDrawer",
    "cashDrawer",
    input,
    openCashDrawerCommand
  );

export const readCurrentWeight = (input: ScaleReadInput = {}) =>
  runConfiguredPeripheralOperation<ScaleReadResult, ScaleReadInput>(
    "readCurrentWeight",
    "scaleEnabled",
    "scale",
    "scale",
    input,
    fetchCurrentWeight
  );

export const simulateScannerRead = (input: ScannerSimulateInput) =>
  runConfiguredPeripheralOperation<ScannerReadResult, ScannerSimulateInput>(
    "simulateScannerRead",
    "scannerEnabled",
    "scanner",
    "scanner",
    input,
    async (configuredInput) => {
      const response = await simulateScannerCommand({
        ...configuredInput,
        format: configuredInput.format ?? defaultScannerFormat,
      });

      return {
        ...response,
        terminalId: configuredInput.terminalId,
        deviceId: configuredInput.deviceId,
      };
    }
  );

const parseSocketEvent = (raw: MessageEvent<string>): PeripheralSocketEvent => {
  const receivedAt = new Date().toISOString();

  try {
    const parsed = JSON.parse(raw.data) as {
      event?: string;
      type?: string;
      payload?: unknown;
      data?: unknown;
      timestamp?: string;
    };

    return {
      event: parsed.event ?? parsed.type ?? "message",
      payload: parsed.payload ?? parsed.data ?? parsed,
      timestamp: parsed.timestamp ?? receivedAt,
    };
  } catch {
    return {
      event: "message",
      payload: raw.data,
      timestamp: receivedAt,
    };
  }
};

const emitSubscriptionError = (
  callback: (event: PeripheralSocketEvent) => void,
  operation: string,
  code: PeripheralOperationError["code"],
  message: string
) => {
  const error = buildOperationError(operation, code, message);
  callback({
    event: "agent.connection.error",
    payload: error,
    timestamp: error.timestamp,
  });
};

export const subscribePeripheralEvents = (
  callback: (event: PeripheralSocketEvent) => void
) => {
  const flags = getPeripheralFeatureFlags();

  if (!flags.peripheralsEnabled) {
    emitSubscriptionError(
      callback,
      "subscribePeripheralEvents",
      "PERIPHERALS_DISABLED",
      "La capa frontend de perifericos esta desactivada por NEXT_PUBLIC_PERIPHERALS_ENABLED=false."
    );
    return () => undefined;
  }

  if (typeof window === "undefined" || typeof WebSocket === "undefined") {
    emitSubscriptionError(
      callback,
      "subscribePeripheralEvents",
      "UNSUPPORTED_RUNTIME",
      "WebSocket de perifericos solo esta disponible en runtime browser."
    );
    return () => undefined;
  }

  try {
    const socket = new WebSocket(
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL ??
        "ws://localhost:4050/peripherals"
    );

    socket.onmessage = (event) => {
      callback(parseSocketEvent(event));
    };

    socket.onerror = () => {
      emitSubscriptionError(
        callback,
        "subscribePeripheralEvents",
        "AGENT_OFFLINE",
        "No se pudo conectar al WebSocket local de perifericos."
      );
    };

    return () => {
      socket.close();
    };
  } catch (error) {
    emitSubscriptionError(
      callback,
      "subscribePeripheralEvents",
      "AGENT_ERROR",
      getErrorMessage(error)
    );
    return () => undefined;
  }
};

const isPeripheralOperationError = (
  payload: unknown
): payload is PeripheralOperationError =>
  typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  "code" in payload &&
  "operation" in payload &&
  "timestamp" in payload;

export const subscribeScannerEvents = (
  callback: (result: ScannerReadResult) => void,
  onConnectionError?: (error: PeripheralOperationError) => void,
  context: ConfigurablePeripheralInput = {}
) => {
  const flags = getPeripheralFeatureFlags();
  if (!flags.peripheralsEnabled || !flags.scannerEnabled) {
    return () => undefined;
  }

  let unsubscribe: () => void = () => undefined;
  let cancelled = false;

  void resolvePeripheralTerminalConfig(context).then((config) => {
    if (cancelled) {
      return;
    }

    if (!config.features.scanner) {
      onConnectionError?.(
        buildOperationError(
          "subscribeScannerEvents",
          "OPERATION_DISABLED",
          "Scanner desactivado para la terminal POS."
        )
      );
      return;
    }

    unsubscribe = subscribePeripheralEvents((event) => {
    if (event.event === "agent.connection.error") {
      if (isPeripheralOperationError(event.payload)) {
        onConnectionError?.(event.payload);
      }
      return;
    }

    if (event.event !== "scanner.code.read") {
      return;
    }

    const payload = event.payload as Partial<ScannerReadResult>;

    if (typeof payload.code !== "string") {
      return;
    }

    callback({
      success: true,
      code: payload.code,
      format: payload.format ?? defaultScannerFormat,
      terminalId: payload.terminalId,
      deviceId: payload.deviceId,
      timestamp: payload.timestamp ?? event.timestamp,
    });
  });
  });

  return () => {
    cancelled = true;
    unsubscribe();
  };
};
