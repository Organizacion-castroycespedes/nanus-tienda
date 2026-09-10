import { createHash } from "node:crypto";
import type {
  PortableDeviceDescriptor,
  UsbPrinterConnectionOptions,
} from "../types/peripheral.types";

export type UsbPrinterDescriptor = UsbPrinterConnectionOptions & {
  id: string;
  name: string;
  descriptor: PortableDeviceDescriptor;
};

export type UsbPrinterDiscovery = {
  list(): UsbPrinterDescriptor[];
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
