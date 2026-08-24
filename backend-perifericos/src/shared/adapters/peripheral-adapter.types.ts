import type {
  ConnectionType,
  DeviceType,
  PeripheralDevice,
} from "../types/peripheral.types";
import type {
  EscPosMockCommand,
  ThermalTicketContent,
} from "../escpos-mock/escpos-mock.types";
import type { DeviceProfile } from "../profiles/device-profiles";

export type AdapterMode = "MOCK" | "REAL";

export type CashDrawerPulseProfile = {
  connector: 0 | 1;
  pin: 2 | 5;
  pulseOnMs: number;
  pulseOffMs: number;
};

export type AdapterCapabilities = {
  adapterName: string;
  mode: AdapterMode;
  connectionType: ConnectionType;
  supportsCut: boolean;
  supportsPhysicalCut: boolean;
  supportsCashDrawerPulse: boolean;
};

export type AdapterResult = {
  adapterName: string;
  profile: DeviceProfile;
  capabilities: AdapterCapabilities;
  commands: EscPosMockCommand[];
  bytesSent?: number;
  pulse?: CashDrawerPulseProfile;
};

export type PrinterAdapterResult = AdapterResult & {
  preview: string;
};

export type PrinterAdapterInput = {
  agentName: string;
  mode: AdapterMode;
  terminalId: string;
  device: PeripheralDevice;
  profile: DeviceProfile;
  jobId: string;
  timestamp: string;
};

export type PrintTicketAdapterInput = PrinterAdapterInput & {
  ticketType: string;
  content: ThermalTicketContent;
};

export type CashDrawerAdapterInput = {
  mode: AdapterMode;
  terminalId: string;
  device: PeripheralDevice;
  profile: DeviceProfile;
  commandId: string;
  reason: string;
  timestamp: string;
  pulse: CashDrawerPulseProfile;
};

export type PeripheralAdapter = {
  type: DeviceType;
  connectionType: ConnectionType;
  mode: AdapterMode;
  adapterName: string;
  getCapabilities(profile: DeviceProfile): AdapterCapabilities;
};

export type PrinterAdapterOutput =
  | PrinterAdapterResult
  | Promise<PrinterAdapterResult>;

export type PrinterAdapter = PeripheralAdapter & {
  printTest(input: PrinterAdapterInput): PrinterAdapterOutput;
  printTicket(input: PrintTicketAdapterInput): PrinterAdapterOutput;
  openCashDrawer(input: CashDrawerAdapterInput): AdapterResult | Promise<AdapterResult>;
};

export type CashDrawerAdapter = PeripheralAdapter & {
  open(input: CashDrawerAdapterInput): AdapterResult;
};
