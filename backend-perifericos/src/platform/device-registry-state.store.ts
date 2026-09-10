import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { PlatformPaths } from "../shared/platform/platform-paths";
import {
  asRecord,
  optionalMetadata,
  optionalString,
  parseConnectionType,
  parseDeviceType,
  validateIdentifier,
  validateShortText,
} from "../shared/utils/request-validation.util";
import {
  ConnectionType,
  type NetworkConnectionOptions,
  type PeripheralDevice,
  DeviceType,
  type UsbPrinterConnectionOptions,
} from "../shared/types/peripheral.types";
import { resolveNetworkOptionsForConnection } from "../shared/utils/network-device-validation.util";

const DEVICE_REGISTRY_FILE = "device-registry.state.json";
const DEVICE_REGISTRY_SCHEMA_VERSION = 1;

export type PersistedPeripheralDevice = {
  id: string;
  type: DeviceType;
  name: string;
  connectionType: ConnectionType;
  terminalId: string;
  profileId?: string;
  network?: NetworkConnectionOptions;
  usb?: UsbPrinterConnectionOptions;
  metadata?: Record<string, unknown>;
};

export type DeviceRegistryState = {
  schemaVersion: 1;
  devices: PersistedPeripheralDevice[];
};

export interface DeviceRegistryStateStore {
  read(paths: PlatformPaths): DeviceRegistryState | null;
  write(paths: PlatformPaths, state: DeviceRegistryState): void;
}

export class FileDeviceRegistryStateStore implements DeviceRegistryStateStore {
  read(paths: PlatformPaths): DeviceRegistryState | null {
    const filePath = join(paths.stateDir, DEVICE_REGISTRY_FILE);
    if (!existsSync(filePath)) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse error";
      throw new Error(`Unable to read Peripheral Agent device registry state: ${message}`);
    }

    return this.normalizeState(parsed);
  }

  write(paths: PlatformPaths, state: DeviceRegistryState): void {
    mkdirSync(paths.stateDir, { recursive: true });
    const filePath = join(paths.stateDir, DEVICE_REGISTRY_FILE);
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = `${JSON.stringify(state, null, 2)}\n`;

    try {
      writeFileSync(tempPath, payload, { encoding: "utf8", mode: 0o600 });
      try {
        renameSync(tempPath, filePath);
      } catch (error) {
        unlinkSync(filePath);
        renameSync(tempPath, filePath);
      }
    } catch (error) {
      try {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath);
        }
      } catch {
        // Ignore cleanup failures.
      }
      throw error;
    }
  }

  private normalizeState(value: unknown): DeviceRegistryState {
    const record = asRecord(value, "device registry state");
    const schemaVersion = record.schemaVersion;
    if (schemaVersion !== DEVICE_REGISTRY_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported Peripheral Agent device registry schema version: ${String(schemaVersion)}`
      );
    }

    const devices = record.devices;
    if (!Array.isArray(devices)) {
      throw new Error("Peripheral Agent device registry devices must be an array");
    }

    const normalizedDevices = devices.map((device, index) =>
      this.normalizeDevice(device, index)
    );

    return {
      schemaVersion: DEVICE_REGISTRY_SCHEMA_VERSION,
      devices: normalizedDevices,
    };
  }

  private normalizeDevice(value: unknown, index: number): PersistedPeripheralDevice {
    const record = asRecord(value, `device registry state devices[${index}]`);
    const type = parseDeviceType(record.type);
    const id = validateIdentifier(optionalString(record, "id", ""), "id");
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", ""),
      "terminalId"
    );
    const connectionType = parseConnectionType(record.connectionType, ConnectionType.MOCK);
    const name = validateShortText(optionalString(record, "name", ""), "name");
    const profileId = typeof record.profileId === "string" ? record.profileId : undefined;
    const network = resolveNetworkOptionsForConnection(record.network, connectionType);
    const usb = this.normalizeUsb(record.usb, connectionType, type);
    const metadata = optionalMetadata(record);

    return {
      id,
      type,
      name,
      connectionType,
      terminalId,
      profileId,
      network,
      usb,
      metadata,
    };
  }

  private normalizeUsb(
    value: unknown,
    connectionType: ConnectionType,
    deviceType: DeviceType
  ): UsbPrinterConnectionOptions | undefined {
    if (connectionType !== ConnectionType.USB) {
      if (value !== undefined && value !== null) {
        throw new Error("usb is only supported for USB devices");
      }
      return undefined;
    }
    if (deviceType !== DeviceType.PRINTER) {
      throw new Error("USB connection is only supported for PRINTER devices");
    }
    if (value === undefined || value === null) {
      return undefined;
    }
    const record = asRecord(value, "usb");
    return {
      deviceId: validateIdentifier(optionalString(record, "deviceId", ""), "usb.deviceId"),
      printerName: validateShortText(
        optionalString(record, "printerName", ""),
        "usb.printerName"
      ),
      windowsQueueName: typeof record.windowsQueueName === "string"
        ? validateShortText(record.windowsQueueName, "usb.windowsQueueName")
        : undefined,
    };
  }
}
