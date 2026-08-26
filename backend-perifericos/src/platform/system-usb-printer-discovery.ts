import type { DeviceDiscoveryProvider } from "../shared/discovery/device-discovery-provider";
import {
  buildUsbPrinterDescriptor,
  type UsbPrinterDescriptor,
  type UsbPrinterDiscovery,
} from "../shared/usb/usb-printer-discovery";
import { getAgentInstallationId } from "./agent-installation-state.store";
import { createPlatformDeviceDiscoveryProvider } from "./device-discovery-provider.factory";

/** Platform composition. The shared descriptor builder remains OS-neutral. */
export class SystemUsbPrinterDiscovery implements UsbPrinterDiscovery {
  constructor(
    private readonly provider: DeviceDiscoveryProvider = createPlatformDeviceDiscoveryProvider(),
    private readonly agentInstallationId = getAgentInstallationId()
  ) {}

  list(): UsbPrinterDescriptor[] {
    return this.provider
      .listUsbPrinters()
      .map((printer) => buildUsbPrinterDescriptor(printer.name, printer, this.agentInstallationId));
  }
}
