import type {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  NetworkConnectionOptions,
  SerialConnectionOptions,
  UsbPrinterConnectionOptions,
  PeripheralDevice,
} from "../../shared/types/peripheral.types";
import type { PeripheralsMode } from "../../shared/config/peripherals.config";

export type CreateMockDeviceRequest = {
  id?: string;
  type?: DeviceType;
  name?: string;
  status?: DeviceStatus;
  connectionType?: ConnectionType;
  terminalId?: string;
  profileId?: string;
  network?: NetworkConnectionOptions;
  usb?: Partial<UsbPrinterConnectionOptions>;
  serial?: Partial<SerialConnectionOptions>;
  metadata?: Record<string, unknown>;
};

export type UpdateMockDeviceRequest = {
  name?: string;
  status?: DeviceStatus;
  terminalId?: string;
  connectionType?: ConnectionType;
  profileId?: string;
  network?: NetworkConnectionOptions | null;
  usb?: Partial<UsbPrinterConnectionOptions> | null;
  serial?: Partial<SerialConnectionOptions> | null;
  metadata?: Record<string, unknown>;
};

export type DiscoverDevicesResponse = {
  success: true;
  mode: PeripheralsMode;
  devices: PeripheralDevice[];
  discoveredAt: string;
};
