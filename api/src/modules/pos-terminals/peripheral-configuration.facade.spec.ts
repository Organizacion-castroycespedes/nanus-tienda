import assert from "node:assert/strict";
import test from "node:test";
import { PeripheralConfigurationFacade } from "./peripheral-configuration.facade";

test("wizard and POS share the same peripheral settings contract", async () => {
  const state = new Map<string, Record<string, unknown>>();
  const terminals = {
    getPeripheralSettings: async (terminalId: string) => state.get(terminalId) ?? {},
    savePeripheralSettings: async (terminalId: string, settings: Record<string, unknown>) => {
      const next = { ...(state.get(terminalId) ?? {}), ...settings };
      state.set(terminalId, next);
      return next;
    },
  } as never;
  const facade = new PeripheralConfigurationFacade(terminals);
  const actor = { roles: ["ADMIN"], tenantId: "tenant-a" };

  await facade.createPeripheralConfiguration("terminal-a", {
    printerDeviceId: "network-qa",
    cashDrawerDeviceId: "drawer-qa",
    scannerDeviceId: "scanner-qa",
    enableScanner: true,
  }, actor);
  await facade.setDefaultPrinter("terminal-a", "network-qa", actor);

  const posReload = await facade.listTerminalPeripheralConfiguration("terminal-a", actor);
  assert.equal(posReload.printerDeviceId, "network-qa");
  assert.equal(posReload.cashDrawerDeviceId, "drawer-qa");
  assert.equal(posReload.scannerDeviceId, "scanner-qa");
});

test("changing default printer preserves prior configured device", async () => {
  const state = new Map<string, Record<string, unknown>>([["terminal-a", {
    printerDeviceId: "printer-a",
    configuredPrinters: ["printer-a", "printer-b"],
  }]]);
  const terminals = {
    getPeripheralSettings: async (terminalId: string) => state.get(terminalId) ?? {},
    savePeripheralSettings: async (terminalId: string, settings: Record<string, unknown>) => {
      const next = { ...(state.get(terminalId) ?? {}), ...settings };
      state.set(terminalId, next);
      return next;
    },
  } as never;
  const facade = new PeripheralConfigurationFacade(terminals);
  await facade.setDefaultPrinter("terminal-a", "printer-b", { roles: ["ADMIN"], tenantId: "tenant-a" });
  const reloaded = await facade.getTerminalPeripheralConfiguration("terminal-a", { roles: ["ADMIN"], tenantId: "tenant-a" });
  assert.equal(reloaded.printerDeviceId, "printer-b");
  assert.deepEqual(reloaded.configuredPrinters, ["printer-a", "printer-b"]);
});
