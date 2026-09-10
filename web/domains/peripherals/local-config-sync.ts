import { fetchPeripheralDevices, isElectronTerminal } from "./api";
import {
  getPosTerminalPeripheralSettings,
  savePosTerminalPeripheralSettings,
} from "./terminal-config";
import type {
  PeripheralDevice,
  PosTerminalPeripheralSettings,
  UpdatePosTerminalPeripheralSettingsRequest,
} from "./types";

export type LocalPeripheralSyncStatus =
  | "SYNCED"
  | "PENDING_SYNC"
  | "NOT_APPLICABLE"
  | "NOOP";

export type LocalPeripheralSyncContext = {
  authenticated: boolean;
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
};

export type LocalPeripheralSyncResult = {
  status: LocalPeripheralSyncStatus;
  settings?: PosTerminalPeripheralSettings;
  reason?: string;
};

const LOCAL_TERMINAL_ID = "local-terminal";

const assignmentRole = (device: PeripheralDevice) => {
  const role = device.metadata?.manusAssignmentRole;
  return typeof role === "string" ? role : null;
};

const validCloudContext = (context: LocalPeripheralSyncContext) =>
  context.authenticated &&
  Boolean(context.tenantId?.trim()) &&
  Boolean(context.branchId?.trim()) &&
  Boolean(context.terminalId?.trim()) &&
  context.terminalId?.trim() !== LOCAL_TERMINAL_ID;

const buildAssignment = (devices: PeripheralDevice[]) => {
  const assigned = devices.filter(
    (device) => device.terminalId === LOCAL_TERMINAL_ID && !device.id.startsWith("mock-")
  );
  const printer = assigned.find(
    (device) => device.type === "PRINTER" && assignmentRole(device) === "PRIMARY_PRINTER"
  );
  const scanner = assigned.find(
    (device) => device.type === "SCANNER" && assignmentRole(device) === "SCANNER"
  );
  const drawer = assigned.find(
    (device) => device.type === "CASH_DRAWER" && assignmentRole(device) === "CASH_DRAWER"
  );
  const payload: UpdatePosTerminalPeripheralSettingsRequest = {};
  if (printer) payload.printerDeviceId = printer.id;
  if (scanner) payload.scannerDeviceId = scanner.id;
  if (drawer) payload.cashDrawerDeviceId = drawer.id;
  return payload;
};

export const syncLocalPeripheralAssignments = async (
  context: LocalPeripheralSyncContext,
  source: () => Promise<PeripheralDevice[]> = fetchPeripheralDevices,
  writer: (
    terminalId: string,
    payload: UpdatePosTerminalPeripheralSettingsRequest
  ) => Promise<PosTerminalPeripheralSettings> = savePosTerminalPeripheralSettings
): Promise<LocalPeripheralSyncResult> => {
  if (!isElectronTerminal()) {
    return { status: "NOT_APPLICABLE", reason: "WEB_CLIENT" };
  }
  if (!validCloudContext(context)) {
    return { status: "NOT_APPLICABLE", reason: "MISSING_TERMINAL_CONTEXT" };
  }

  try {
    const localDevices = await source();
    const payload = buildAssignment(localDevices);
    if (Object.keys(payload).length === 0) {
      return { status: "NOOP", reason: "NO_LOCAL_ASSIGNMENT" };
    }
    const settings = await writer(context.terminalId!.trim(), payload);
    return { status: "SYNCED", settings };
  } catch (error) {
    return {
      status: "PENDING_SYNC",
      reason: error instanceof Error ? error.message : "SYNC_ERROR",
    };
  }
};

export const loadCloudPeripheralSettings = (terminalId: string) =>
  getPosTerminalPeripheralSettings(terminalId);

