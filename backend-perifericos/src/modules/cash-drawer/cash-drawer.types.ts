import type { EscPosMockCommand } from "../../shared/escpos-mock/escpos-mock.types";
import type { DeviceProfile } from "../../shared/profiles/device-profiles";
import type {
  AdapterCapabilities,
  AdapterMode,
  CashDrawerPulseProfile,
} from "../../shared/adapters/peripheral-adapter.types";
import type {
  ConnectionType,
  NetworkConnectionOptions,
} from "../../shared/types/peripheral.types";

export type CashDrawerOpenRequest = {
  terminalId?: string;
  printerDeviceId?: string;
  deviceId?: string;
  reason?: string;
};

export type CashDrawerOpenResponse = {
  success: true;
  commandId: string;
  mode: AdapterMode;
  adapterName: string;
  printerDeviceId: string;
  deviceId: string;
  terminalId: string;
  connectionType: ConnectionType;
  network?: NetworkConnectionOptions;
  commands: EscPosMockCommand[];
  profile: DeviceProfile;
  capabilities: AdapterCapabilities;
  pulse: CashDrawerPulseProfile;
  bytesSent?: number;
  message: string;
  timestamp: string;
};
