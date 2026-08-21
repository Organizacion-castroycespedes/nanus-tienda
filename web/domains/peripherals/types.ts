export type PeripheralAgentHealth = {
  status: string;
  agent: string;
  mode: string;
  version: string;
  uptimeSeconds: number;
};

export type PeripheralDeviceType =
  | "PRINTER"
  | "CASH_DRAWER"
  | "SCALE"
  | "SCANNER"
  | "DISPLAY"
  | "OTHER";

export type PeripheralDeviceStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "SIMULATED";

export type PeripheralConnectionType =
  | "MOCK"
  | "USB"
  | "SERIAL"
  | "HID"
  | "NETWORK"
  | "BLUETOOTH";

export type DeviceNetworkConfig = {
  host: string;
  port: number;
  timeoutMs?: number;
};

export type DeviceUsbConfig = {
  deviceId: string;
  printerName: string;
};

export type PeripheralDevice = {
  id: string;
  type: PeripheralDeviceType;
  name: string;
  status: PeripheralDeviceStatus;
  connectionType: PeripheralConnectionType;
  terminalId: string;
  profileId?: string;
  profile?: DeviceProfile;
  network?: DeviceNetworkConfig;
  usb?: DeviceUsbConfig;
};

export type CreateDeviceRequest = {
  id: string;
  type: PeripheralDeviceType;
  name: string;
  status: PeripheralDeviceStatus;
  connectionType: PeripheralConnectionType;
  terminalId: string;
  profileId?: string;
  network?: DeviceNetworkConfig;
  usb?: DeviceUsbConfig;
};

export type PeripheralTicketItem = {
  name: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
};

export type PeripheralTicketPayment = {
  method: string;
  amount?: number;
};

export type PeripheralTicketContent = {
  header?: string;
  businessName?: string;
  nit?: string;
  address?: string;
  cashier?: string;
  documentNumber?: string;
  saleNumber?: string;
  date?: string;
  items?: PeripheralTicketItem[];
  subtotal?: number;
  taxes?: number;
  discounts?: number;
  total?: number;
  paid?: number;
  change?: number;
  balance?: number;
  payments?: PeripheralTicketPayment[];
  footer?: string;
  title?: string;
  lines?: string[];
};

export type PeripheralTicketPayload = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  deviceId?: string;
  ticketType: "SALE" | "PURCHASE" | "ORDER";
  content: PeripheralTicketContent;
};

export type BaseTicketInput = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  deviceId?: string;
  businessName?: string;
  nit?: string;
  address?: string;
  cashier?: string;
  documentNumber?: string;
  date?: string;
  items?: PeripheralTicketItem[];
  subtotal?: number;
  taxes?: number;
  discounts?: number;
  total?: number;
  paid?: number;
  change?: number;
  balance?: number;
  payments?: PeripheralTicketPayment[];
  footer?: string;
  notes?: string[];
};

export type SaleTicketInput = BaseTicketInput & {
  saleId?: string;
  saleNumber?: string;
  customerName?: string;
};

export type PurchaseTicketInput = BaseTicketInput & {
  purchaseId?: string;
  purchaseNumber?: string;
  supplierName?: string;
};

export type OrderTicketInput = BaseTicketInput & {
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  tableName?: string;
};

export type CashDrawerOpenInput = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  deviceId?: string;
  reason?: string;
};

export type ScaleReadInput = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  deviceId?: string;
};

export type ScannerSimulateInput = {
  tenantId?: string;
  branchId?: string;
  terminalId?: string;
  deviceId?: string;
  code: string;
  format?: string;
};

export type PeripheralOperationError = {
  code:
    | "PERIPHERALS_DISABLED"
    | "OPERATION_DISABLED"
    | "MISSING_CONFIG"
    | "INVALID_CONFIG"
    | "AGENT_OFFLINE"
    | "DEVICE_NOT_FOUND"
    | "TIMEOUT"
    | "CONNECTION_REFUSED"
    | "PRINT_ERROR"
    | "PRINTER_NOT_CONFIGURED"
    | "NETWORK_ERROR"
    | "HTTP_ERROR"
    | "AGENT_ERROR"
    | "UNSUPPORTED_RUNTIME";
  message: string;
  operation: string;
  timestamp: string;
};

export type PeripheralOperationResult<T> =
  | {
      success: true;
      data: T;
      error?: never;
    }
  | {
      success: false;
      data?: never;
      error: PeripheralOperationError;
    };

export type PeripheralFeatureFlags = {
  peripheralsEnabled: boolean;
  printSaleEnabled: boolean;
  printPurchaseEnabled: boolean;
  printOrderEnabled: boolean;
  openDrawerEnabled: boolean;
  scaleEnabled: boolean;
  scannerEnabled: boolean;
};

export type PosTerminalMode = "MOCK" | "REAL" | "HYBRID";

export type PosTerminalResponse = {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string | null;
  operationalTerminalId: string | null;
  operationalTerminalCode: string | null;
  operationalTerminalName: string | null;
  operationalTerminalActive: boolean | null;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  mode: PosTerminalMode;
  createdAt: string;
  updatedAt: string;
};

export type PosTerminalFeatureFlags = {
  printSale: boolean;
  printPurchase: boolean;
  printOrder: boolean;
  openDrawer: boolean;
  scale: boolean;
  scanner: boolean;
};

export type PosTerminalPeripheralSettings = {
  printerDeviceId: string | null;
  cashDrawerDeviceId: string | null;
  scaleDeviceId: string | null;
  scannerDeviceId: string | null;
  features: PosTerminalFeatureFlags;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PosTerminalResolvedConfig = PosTerminalPeripheralSettings & {
  /** @deprecated Legacy alias for agentTerminalCode. */
  terminalId: string | null;
  agentTerminalCode: string | null;
  operationalTerminalId: string | null;
  operationalTerminalCode: string | null;
  operationalTerminalName: string | null;
  posTerminalId: string | null;
  tenantId: string | null;
  branchId: string | null;
  branchName?: string | null;
  code: string;
  name: string;
  mode: PosTerminalMode | null;
  active: boolean;
  source: "CONFIGURED" | "FALLBACK_MOCK" | "OPERATIONAL_UNCONFIGURED";
};

export type CreatePosTerminalRequest = {
  tenantId?: string;
  branchId: string;
  operationalTerminalId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
  mode?: PosTerminalMode;
};

export type UpdatePosTerminalRequest = Partial<
  Omit<CreatePosTerminalRequest, "tenantId">
>;

export type UpdatePosTerminalPeripheralSettingsRequest = Partial<{
  printerDeviceId: string | null;
  cashDrawerDeviceId: string | null;
  scaleDeviceId: string | null;
  scannerDeviceId: string | null;
  enablePrintSale: boolean;
  enablePrintPurchase: boolean;
  enablePrintOrder: boolean;
  enableOpenDrawer: boolean;
  enableScale: boolean;
  enableScanner: boolean;
}>;

export type PeripheralLogLevel = "INFO" | "WARN" | "ERROR";

export type PeripheralLog = {
  id: string;
  timestamp: string;
  level: PeripheralLogLevel;
  source: string;
  event: string;
  message: string;
  metadata: Record<string, unknown>;
};

export type PrintCommand = {
  name: string;
  description: string;
};

export type DeviceProfile = {
  id: string;
  paperWidthMm: number | null;
  widthChars: number;
  supportsCut: boolean;
  supportsCashDrawerPulse: boolean;
};

export type PeripheralCapabilities = {
  adapterName?: string;
  mode?: string;
  connectionType?: PeripheralConnectionType | string;
  supportsCut?: boolean;
  supportsPhysicalCut?: boolean;
  supportsCashDrawerPulse?: boolean;
  [key: string]: unknown;
};

export type PeripheralActionResponse = {
  success: boolean;
  jobId?: string;
  commandId?: string;
  mode?: string;
  deviceId?: string;
  terminalId?: string;
  preview?: string;
  commands?: PrintCommand[];
  adapterName?: string;
  profile?: DeviceProfile;
  capabilities?: PeripheralCapabilities;
  commandCount?: number;
  message?: string;
  timestamp?: string;
};

export type PrintJobResponse = PeripheralActionResponse & {
  success: true;
  jobId: string;
  mode: string;
  deviceId: string;
  terminalId: string;
  preview: string;
  commands: PrintCommand[];
  profile?: DeviceProfile;
  capabilities?: PeripheralCapabilities;
};

export type CashDrawerResponse = PeripheralActionResponse & {
  success: true;
  commandId: string;
  mode: string;
  deviceId: string;
  terminalId: string;
  commands: PrintCommand[];
  profile?: DeviceProfile;
  capabilities?: PeripheralCapabilities;
};

export type PeripheralDiscoverResponse = {
  success: boolean;
  mode: string;
  devices: PeripheralDevice[];
  discoveredAt: string;
};

export type PeripheralScaleWeight = {
  deviceId: string;
  weight: number;
  unit: string;
  stable: boolean;
  timestamp: string;
};

export type ScaleReadResult = PeripheralScaleWeight;

export type PeripheralScannerResponse = {
  success: boolean;
  code: string;
  format: string;
  timestamp: string;
};

export type ScannerReadResult = PeripheralScannerResponse & {
  terminalId?: string;
  deviceId?: string;
};

export type PeripheralSocketEvent = {
  event: string;
  payload: unknown;
  timestamp: string;
};
