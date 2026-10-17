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

export type UsbDiscoveryDiagnostic = {
  stage: "WINDOWS_PNP";
  phase: "STARTED" | "COMPLETED";
  outcome: "COMPLETED" | "UNKNOWN";
  reasonCode:
    | "UNKNOWN"
    | "OK"
    | "EXECUTION_FAILED"
    | "ACCESS_DENIED"
    | "TIMEOUT"
    | "EMPTY_OUTPUT"
    | "PARSE_FAILED"
    | "INCOMPLETE_RECORD"
    | "FILTERED_OUT";
  elapsedMs: number;
  timeoutMs: number;
  exitCode?: number;
  rawRecordCount?: number;
  parsedRecordCount?: number;
  incompleteRecordCount?: number;
  missingCompatibleIdCount?: number;
  class07RecordCount?: number;
  filteredRecordCount?: number;
  acceptedRecordCount?: number;
};

/** Portable input port. Platform adapters enumerate local printer queues. */
export interface DeviceDiscoveryProvider {
  listUsbPrinters(): DiscoveredUsbPrinter[] | Promise<DiscoveredUsbPrinter[]>;
  getLastUsbDiscoveryDiagnostics?(): UsbDiscoveryDiagnostic[];
  listSerialDevices?(): DiscoveredSerialDevice[] | Promise<DiscoveredSerialDevice[]>;
}
