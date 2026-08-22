import type {
  EscPosMockCommand,
  ThermalTicketContent,
} from "../../shared/escpos-mock/escpos-mock.types";
import type {
  AdapterCapabilities,
  AdapterMode,
} from "../../shared/adapters/peripheral-adapter.types";
import type { DeviceProfile } from "../../shared/profiles/device-profiles";
import type { NetworkConnectionOptions } from "../../shared/types/peripheral.types";

export type TestPrintRequest = {
  terminalId?: string;
  deviceId?: string;
};

export type PrintTicketRequest = {
  terminalId?: string;
  deviceId?: string;
  ticketType?: string;
  content?: ThermalTicketContent;
};

export type PrinterJobResponse = {
  success: true;
  jobId: string;
  mode: AdapterMode;
  adapterName: string;
  deviceId: string;
  terminalId: string;
  network?: NetworkConnectionOptions;
  preview: string;
  commands: EscPosMockCommand[];
  profile: DeviceProfile;
  capabilities: AdapterCapabilities;
  bytesSent?: number;
  message: string;
};
