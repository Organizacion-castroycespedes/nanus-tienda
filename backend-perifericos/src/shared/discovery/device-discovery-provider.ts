import type { DeviceFingerprint, DevicePlatform } from "../types/peripheral.types";

export type DiscoveredUsbPrinter = {
  name: string;
  nativeIdentifier: string;
  fingerprint: DeviceFingerprint;
  platform: DevicePlatform;
  architecture: string;
};

/** Portable input port. Platform adapters enumerate local printer queues. */
export interface DeviceDiscoveryProvider {
  listUsbPrinters(): DiscoveredUsbPrinter[];
}
