import { DEFAULT_SCALE_DEVICE_ID } from "./terminal-config";
import type {
  PeripheralDevice,
  PosTerminalResolvedConfig,
  UpdatePosTerminalPeripheralSettingsRequest,
} from "./types";

export type ScaleAssociationState = "pending" | "configured" | "missing";

export const buildScaleAgentConfiguration = (device: PeripheralDevice) => {
  if (device.type !== "SCALE" || device.connectionType !== "SERIAL" || device.profileId !== "ROCHI_A01E") return null;
  return { terminalId: "local-terminal", connectionType: "SERIAL" as const, profileId: "ROCHI_A01E" as const };
};

export const buildScaleAssociationSettings = (
  resolved: PosTerminalResolvedConfig,
  scaleDeviceId: string | null
): UpdatePosTerminalPeripheralSettingsRequest => ({
  printerDeviceId: resolved.printerDeviceId,
  cashDrawerDeviceId: resolved.cashDrawerDeviceId,
  scaleDeviceId,
  scannerDeviceId: resolved.scannerDeviceId,
  enablePrintSale: resolved.features.printSale,
  enablePrintPurchase: resolved.features.printPurchase,
  enablePrintOrder: resolved.features.printOrder,
  enableOpenDrawer: resolved.features.openDrawer,
  enableScale: Boolean(scaleDeviceId),
  enableScanner: resolved.features.scanner,
});

export const isMockScaleConfiguration = (resolved: PosTerminalResolvedConfig | null) =>
  resolved?.source === "FALLBACK_MOCK" || resolved?.scaleDeviceId === DEFAULT_SCALE_DEVICE_ID;

export const resolveScaleAssociationState = (input: {
  resolved: PosTerminalResolvedConfig | null;
  selectedDevice: PeripheralDevice | undefined;
  realScaleCandidateCount: number;
}): ScaleAssociationState => {
  const deviceId = input.resolved?.scaleDeviceId?.trim();
  if (!deviceId || (isMockScaleConfiguration(input.resolved) && input.realScaleCandidateCount > 0)) {
    return "pending";
  }
  return input.selectedDevice ? "configured" : "missing";
};
