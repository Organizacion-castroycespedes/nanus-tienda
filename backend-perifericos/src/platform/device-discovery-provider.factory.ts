import { BadRequestException } from "@nestjs/common";
import type { DeviceDiscoveryProvider } from "../shared/discovery/device-discovery-provider";
import { CupsPrinterDiscoveryProvider } from "./unix/cups-printer-discovery.provider";
import { WindowsPrinterDiscoveryProvider } from "./windows/windows-printer-discovery.provider";

export const createPlatformDeviceDiscoveryProvider = (
  platform = process.platform
): DeviceDiscoveryProvider => {
  if (platform === "win32") {
    return new WindowsPrinterDiscoveryProvider();
  }
  if (platform === "linux" || platform === "darwin") {
    return new CupsPrinterDiscoveryProvider(platform);
  }
  throw new BadRequestException(`USB printer discovery is not supported on ${platform}`);
};
