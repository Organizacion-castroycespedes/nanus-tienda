import type { EscPosMockCommand } from "../../shared/escpos-mock/escpos-mock.types";
import type { DeviceProfile } from "../../shared/profiles/device-profiles";
import type { AdapterCapabilities } from "../../shared/adapters/peripheral-adapter.types";

export type CashDrawerOpenRequest = {
  terminalId?: string;
  deviceId?: string;
  reason?: string;
};

export type CashDrawerOpenResponse = {
  success: true;
  commandId: string;
  mode: "MOCK";
  deviceId: string;
  terminalId: string;
  commands: EscPosMockCommand[];
  profile: DeviceProfile;
  capabilities: AdapterCapabilities;
  message: string;
  timestamp: string;
};
