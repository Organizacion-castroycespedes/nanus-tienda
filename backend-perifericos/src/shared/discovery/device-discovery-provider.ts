import type { DeviceFingerprint, DevicePlatform } from "../types/peripheral.types";

export type DiscoveredUsbPrinter = {
  name: string;
  nativeIdentifier: string;
  fingerprint: DeviceFingerprint;
  platform: DevicePlatform;
  architecture: string;
};

export type DiscoveredSerialDevice = {
  port: string;
  name: string;
  nativeIdentifier: string;
  pnpDeviceId: string;
  vendorId?: string;
  productId?: string;
  status: string;
  present: boolean;
  fingerprint: DeviceFingerprint;
  platform: DevicePlatform;
  architecture: string;
};

/** Portable input port. Platform adapters enumerate local printer queues. */
export interface DeviceDiscoveryProvider {
  listUsbPrinters(): DiscoveredUsbPrinter[] | Promise<DiscoveredUsbPrinter[]>;
  listSerialDevices?(): DiscoveredSerialDevice[] | Promise<DiscoveredSerialDevice[]>;
}
