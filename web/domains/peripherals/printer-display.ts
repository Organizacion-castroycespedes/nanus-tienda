import type { PeripheralDevice, PosTerminalResolvedConfig } from "./types";

export const resolvePrinterDisplayName = (
  config: Pick<PosTerminalResolvedConfig, "printerDeviceId"> | null,
  devices: PeripheralDevice[]
) => {
  const printerDeviceId = config?.printerDeviceId?.trim();
  if (!printerDeviceId) {
    return null;
  }

  const printer = devices.find(
    (device) => device.id === printerDeviceId && device.type === "PRINTER"
  );

  return printer?.usb?.printerName?.trim() || printer?.name?.trim() || null;
};
