import {
  DEFAULT_CASH_DRAWER_DEVICE_ID,
  DEFAULT_PRINTER_DEVICE_ID,
} from "./terminal-config";
import type { PeripheralConnectionType } from "./types";

export type CashDrawerTransportResolution = {
  currentCashDrawerDeviceId: string | null;
  selectedPrinterDeviceId: string | null;
  selectedPrinterConnectionType?: PeripheralConnectionType | null;
  printerDrawerCertified: boolean;
};

export const isPrinterBackedCashDrawer = (
  resolution: CashDrawerTransportResolution
) =>
  Boolean(
    resolution.printerDrawerCertified &&
      resolution.selectedPrinterConnectionType === "USB" &&
      resolution.selectedPrinterDeviceId &&
      resolution.currentCashDrawerDeviceId === resolution.selectedPrinterDeviceId
  );

export const resolveCashDrawerDeviceIdForOperation = (
  resolution: CashDrawerTransportResolution
) => {
  if (
    resolution.currentCashDrawerDeviceId &&
    resolution.currentCashDrawerDeviceId !== DEFAULT_CASH_DRAWER_DEVICE_ID
  ) {
    return resolution.currentCashDrawerDeviceId;
  }

  if (
    resolution.selectedPrinterDeviceId &&
    resolution.selectedPrinterDeviceId !== DEFAULT_PRINTER_DEVICE_ID
  ) {
    return resolution.selectedPrinterDeviceId;
  }

  return resolution.currentCashDrawerDeviceId;
};

export const resolveCashDrawerDeviceIdToPersist = (
  resolution: CashDrawerTransportResolution
) => {
  if (
    resolution.printerDrawerCertified &&
    resolution.selectedPrinterConnectionType === "USB" &&
    resolution.selectedPrinterDeviceId
  ) {
    return resolution.selectedPrinterDeviceId;
  }

  return resolution.currentCashDrawerDeviceId;
};
