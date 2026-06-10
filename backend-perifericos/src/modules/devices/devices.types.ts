import type {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  NetworkConnectionOptions,
  PeripheralDevice,
} from "../../shared/types/peripheral.types";

export type CreateMockDeviceRequest = {
  id?: string;
  type?: DeviceType;
  name?: string;
  status?: DeviceStatus;
  connectionType?: ConnectionType;
  terminalId?: string;
  profileId?: string;
  network?: NetworkConnectionOptions;
  metadata?: Record<string, unknown>;
};

export type UpdateMockDeviceRequest = {
  name?: string;
  status?: DeviceStatus;
  terminalId?: string;
  connectionType?: ConnectionType;
  profileId?: string;
  network?: NetworkConnectionOptions | null;
  metadata?: Record<string, unknown>;
};

export type DiscoverDevicesResponse = {
  success: true;
  mode: "MOCK";
  devices: PeripheralDevice[];
  discoveredAt: string;
};
