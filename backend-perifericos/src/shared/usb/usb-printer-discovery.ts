import { createHash } from "node:crypto";
import type {
  PortableDeviceDescriptor,
  SerialConnectionOptions,
  UsbPrinterConnectionOptions,
} from "../types/peripheral.types";
import type { DiscoveredSerialDevice } from "../discovery/device-discovery-provider";
import { DeviceProfileId, getDeviceProfile } from "../profiles/device-profiles";

export type UsbPrinterDescriptor = UsbPrinterConnectionOptions & {
  id: string;
  name: string;
  descriptor: PortableDeviceDescriptor;
};

export type UsbPrinterDiscovery = {
  list(): UsbPrinterDescriptor[];
  listSerialDevices?(): SerialDeviceDescriptor[];
};

export type SerialDeviceDescriptor = {
  id: string;
  name: string;
  type: "ROCHI_A01E";
  serial: SerialConnectionOptions;
  descriptor: PortableDeviceDescriptor;
};

export const buildRochiSerialDescriptor = (
  device: DiscoveredSerialDevice,
  agentInstallationId = "legacy-agent-installation"
): SerialDeviceDescriptor | undefined => {
  if (
    !device.present ||
    device.vendorId?.toUpperCase() !== "1A86" ||
    device.productId?.toUpperCase() !== "7523"
  ) {
    return undefined;
  }
  const identity = device.pnpDeviceId.toUpperCase();
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  const id = `serial-rochi-a01e-${hash}`;
  const profile = getDeviceProfile(DeviceProfileId.RochiA01e);
  if (!profile.serial) {
    return undefined;
  }
  return {
    id,
    name: device.name || "ROCHI RC-A01E",
    type: DeviceProfileId.RochiA01e,
    serial: {
      port: device.port,
      ...profile.serial,
      pnp: {
        deviceId: device.pnpDeviceId,
        vendorId: device.vendorId?.toUpperCase(),
        productId: device.productId?.toUpperCase(),
      },
    },
    descriptor: {
      agentInstallationId,
      deviceId: id,
      nativeIdentifier: device.nativeIdentifier,
      fingerprint: device.fingerprint,
      platform: device.platform,
      architecture: device.architecture,
    },
  };
};

export const buildUsbPrinterDescriptor = (
  printerName: string,
  portable?: {
    nativeIdentifier: string;
    fingerprint: PortableDeviceDescriptor["fingerprint"];
    platform: PortableDeviceDescriptor["platform"];
    architecture: string;
  },
  agentInstallationId = "legacy-agent-installation"
): UsbPrinterDescriptor => {
  const normalizedName = printerName.trim();
  const hash = createHash("sha256").update(normalizedName).digest("hex").slice(0, 16);
  const deviceId = `usb-printer-${hash}`;

  const source = portable?.fingerprint.source;
  return {
    id: deviceId,
    name: normalizedName,
    deviceId,
    printerName: normalizedName,
    windowsQueueName: source === "WINDOWS_PRINT_QUEUE" ? normalizedName : undefined,
    descriptor: {
      agentInstallationId,
      deviceId,
      nativeIdentifier: portable?.nativeIdentifier ?? normalizedName,
      fingerprint: portable?.fingerprint ?? {
        source: "LEGACY_QUEUE_NAME",
        values: { queueName: normalizedName },
      },
      platform: portable?.platform ?? "UNKNOWN",
      architecture: portable?.architecture ?? "unknown",
    },
  };
};
