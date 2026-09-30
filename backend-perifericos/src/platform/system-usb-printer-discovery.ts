import type { DeviceDiscoveryProvider } from "../shared/discovery/device-discovery-provider";
import {
  buildUsbPrinterDescriptor,
  buildRochiSerialDescriptor,
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

  listSerialDevices() {
    return (this.provider.listSerialDevices?.() ?? [])
      .map((device) => buildRochiSerialDescriptor(device, this.agentInstallationId))
      .filter((device): device is NonNullable<typeof device> => Boolean(device));
  }
}
