import assert from "node:assert/strict";
import test from "node:test";
import { resolvePrinterHeaderState, resolveScaleHeaderState } from "./header-readiness";
import type { PeripheralDevice, PosTerminalResolvedConfig } from "./types";

const health = { status: "ok", mode: "REAL", agentApiVersion: 1 };
const config = (overrides: Partial<PosTerminalResolvedConfig> = {}) => ({
  source: "CONFIGURED" as const,
  printerDeviceId: "printer-1",
  scaleDeviceId: "scale-1",
  active: true,
  mode: "REAL" as const,
  features: { printSale: true, printPurchase: true, printOrder: true, openDrawer: true, scale: true, scanner: true },
  ...overrides,
}) as PosTerminalResolvedConfig;

const printer = (metadata: Record<string, unknown> = {}) => ({
  id: "printer-1",
  type: "PRINTER",
  name: "Printer POS-80",
  status: "CONNECTED",
  connectionType: "USB",
  terminalId: "terminal-1",
  usb: { deviceId: "usb-1", printerName: "Printer POS-80", windowsQueueName: "XP-80" },
  metadata: { physicalDetected: "true", queueInstalled: "true", reconciliationStatus: "CONNECTED", ...metadata },
}) as PeripheralDevice;

const scale = (overrides: Partial<PeripheralDevice> = {}) => ({
  id: "scale-1",
  type: "SCALE",
  name: "ROCHI RC-A01E",
  status: "DISCONNECTED",
  connectionType: "SERIAL",
  terminalId: "terminal-1",
  profileId: "ROCHI_A01E",
  serial: { port: "COM5", baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none", pnp: { deviceId: "USB\\VID_1A86&PID_7523\\ROCHI", vendorId: "1A86", productId: "7523" } },
  metadata: { physicalDetected: "true" },
  ...overrides,
}) as PeripheralDevice;

test("Electron printer remains OK when its disabled WebSocket reports disconnected", () => {
  assert.deepEqual(
    resolvePrinterHeaderState({ isElectron: true, socketStatus: "DISCONNECTED", printerName: null, config: config(), devices: [printer()], health }),
    { status: "OK", tone: "ok", detail: "XP-80 lista; Agent local saludable" }
  );
});

test("printer warns when physical queue readiness is missing", () => {
  assert.equal(
    resolvePrinterHeaderState({ isElectron: true, socketStatus: "DISCONNECTED", printerName: null, config: config(), devices: [printer({ queueInstalled: "false" })], health }).tone,
    "warning"
  );
});

test("printer keeps the existing browser WebSocket status behavior", () => {
  assert.deepEqual(
    resolvePrinterHeaderState({ isElectron: false, socketStatus: "CONNECTED", printerName: "XP-80", config: null, devices: [], health: null }),
    { status: "OK", tone: "ok", detail: "XP-80" }
  );
});

test("ROCHI is shown detected despite DISCONNECTED status for read-on-demand transport", () => {
  assert.equal(resolveScaleHeaderState({ config: config(), devices: [scale()], health }).status, "Detectada");
});

test("scale missing or unconfigured stays fail-closed in the header", () => {
  assert.equal(resolveScaleHeaderState({ config: config(), devices: [], health }).tone, "warning");
  assert.equal(resolveScaleHeaderState({ config: null, devices: [scale()], health }).status, "Sin config.");
});
