import assert from "node:assert/strict";
import test from "node:test";
import { buildScaleAgentConfiguration, buildScaleAssociationSettings, resolveScaleAssociationState } from "./scale-association";
import type { PeripheralDevice, PosTerminalResolvedConfig } from "./types";

const resolved = (overrides: Partial<PosTerminalResolvedConfig> = {}) => ({
  terminalId: "terminal",
  agentTerminalCode: "terminal",
  operationalTerminalId: "terminal",
  operationalTerminalCode: "T1",
  operationalTerminalName: "Terminal 1",
  posTerminalId: "pos-terminal-1",
  tenantId: "tenant",
  branchId: "branch",
  code: "T1",
  name: "Terminal 1",
  mode: "REAL" as const,
  active: true,
  source: "CONFIGURED" as const,
  scale: { assignment: "ASSIGNED" as const, classification: "UNKNOWN" as const, deviceId: "rochi" },
  printerDeviceId: "printer",
  cashDrawerDeviceId: "drawer",
  scaleDeviceId: "rochi",
  scannerDeviceId: "scanner",
  features: {
    printSale: true,
    printPurchase: false,
    printOrder: true,
    openDrawer: true,
    scale: true,
    scanner: false,
  },
  ...overrides,
}) as PosTerminalResolvedConfig;

const scale = { id: "rochi", type: "SCALE", name: "ROCHI", status: "CONNECTED", connectionType: "SERIAL", terminalId: "agent" } as PeripheralDevice;

test("local Agent scale config accepts only a ROCHI SERIAL profile and does not set authorization", () => {
  assert.deepEqual(buildScaleAgentConfiguration({ ...scale, profileId: "ROCHI_A01E" }), {
    terminalId: "local-terminal", connectionType: "SERIAL", profileId: "ROCHI_A01E",
  });
  assert.equal(buildScaleAgentConfiguration(scale), null);
});

test("construye una asociación de escala preservando el resto de periféricos y flags", () => {
  assert.deepEqual(buildScaleAssociationSettings(resolved(), "rochi"), {
    printerDeviceId: "printer",
    cashDrawerDeviceId: "drawer",
    scaleDeviceId: "rochi",
    scannerDeviceId: "scanner",
    enablePrintSale: true,
    enablePrintPurchase: false,
    enablePrintOrder: true,
    enableOpenDrawer: true,
    enableScale: true,
    enableScanner: false,
  });
});

test("desasociar limpia solo escala y la deshabilita", () => {
  const settings = buildScaleAssociationSettings(resolved(), null);
  assert.equal(settings.scaleDeviceId, null);
  assert.equal(settings.enableScale, false);
  assert.equal(settings.printerDeviceId, "printer");
  assert.equal(settings.cashDrawerDeviceId, "drawer");
});

test("no auto-asocia fallback mock aunque exista una escala real", () => {
  assert.equal(
    resolveScaleAssociationState({
      resolved: resolved({ source: "FALLBACK_MOCK", scaleDeviceId: "mock-scale-001" }),
      selectedDevice: scale,
      realScaleCandidateCount: 1,
    }),
    "pending"
  );
});

test("distingue configurada detectada de configurada no detectada", () => {
  assert.equal(resolveScaleAssociationState({ resolved: resolved(), selectedDevice: scale, realScaleCandidateCount: 1 }), "configured");
  assert.equal(resolveScaleAssociationState({ resolved: resolved(), selectedDevice: undefined, realScaleCandidateCount: 0 }), "missing");
});
