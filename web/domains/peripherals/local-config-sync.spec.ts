import assert from "node:assert/strict";
import test from "node:test";
import { syncLocalPeripheralAssignments } from "./local-config-sync";
import type { PeripheralDevice, PosTerminalPeripheralSettings } from "./types";

const electronWindow = () => {
  (globalThis as typeof globalThis & { window?: unknown }).window = {
    manusTerminal: { listDevices: async () => [] },
  };
};

const device = (input: Partial<PeripheralDevice>): PeripheralDevice => ({
  id: input.id ?? "device-1",
  type: input.type ?? "PRINTER",
  name: input.name ?? "QA device",
  status: input.status ?? "CONNECTED",
  connectionType: input.connectionType ?? "NETWORK",
  terminalId: input.terminalId ?? "local-terminal",
  profileId: input.profileId ?? "THERMAL_80MM",
  metadata: input.metadata,
  network: input.network,
  usb: input.usb,
});

const settings = (): PosTerminalPeripheralSettings => ({
  printerDeviceId: null,
  cashDrawerDeviceId: null,
  scaleDeviceId: null,
  scannerDeviceId: null,
  features: {
    printSale: true,
    printPurchase: true,
    printOrder: true,
    openDrawer: true,
    scale: true,
    scanner: true,
  },
});

test("syncs assigned local devices to the authenticated operational terminal", async () => {
  electronWindow();
  let received: unknown;
  const result = await syncLocalPeripheralAssignments(
    {
      authenticated: true,
      tenantId: "tenant-1",
      branchId: "branch-1",
      terminalId: "terminal-1",
    },
    async () => [
      device({ id: "printer-qa", metadata: { manusAssignmentRole: "PRIMARY_PRINTER" } }),
      device({ id: "scanner-qa", type: "SCANNER", connectionType: "USB_HID", metadata: { manusAssignmentRole: "SCANNER" } }),
      device({ id: "drawer-qa", type: "CASH_DRAWER", metadata: { manusAssignmentRole: "CASH_DRAWER" } }),
    ],
    async (_terminalId, payload) => {
      received = payload;
      return { ...settings(), printerDeviceId: "printer-qa", scannerDeviceId: "scanner-qa", cashDrawerDeviceId: "drawer-qa" };
    },
  );
  assert.equal(result.status, "SYNCED");
  assert.deepEqual(received, {
    printerDeviceId: "printer-qa",
    scannerDeviceId: "scanner-qa",
    cashDrawerDeviceId: "drawer-qa",
  });
});

test("is idempotent and preserves local configuration when cloud is offline", async () => {
  electronWindow();
  const local = [device({ id: "printer-qa", metadata: { manusAssignmentRole: "PRIMARY_PRINTER" } })];
  let writes = 0;
  const first = await syncLocalPeripheralAssignments(
    { authenticated: true, tenantId: "tenant-1", branchId: "branch-1", terminalId: "terminal-1" },
    async () => local,
    async () => { writes += 1; return settings(); },
  );
  const second = await syncLocalPeripheralAssignments(
    { authenticated: true, tenantId: "tenant-1", branchId: "branch-1", terminalId: "terminal-1" },
    async () => local,
    async () => { writes += 1; return settings(); },
  );
  assert.equal(first.status, "SYNCED");
  assert.equal(second.status, "SYNCED");
  assert.equal(writes, 2);

  const offline = await syncLocalPeripheralAssignments(
    { authenticated: true, tenantId: "tenant-1", branchId: "branch-1", terminalId: "terminal-1" },
    async () => local,
    async () => { throw new Error("API_OFFLINE"); },
  );
  assert.equal(offline.status, "PENDING_SYNC");
  assert.equal(local[0].id, "printer-qa");
});

test("does not sync Web clients or bootstrap local-terminal context", async () => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window;
  const web = await syncLocalPeripheralAssignments({ authenticated: true, tenantId: "t", branchId: "b", terminalId: "terminal-1" });
  assert.equal(web.status, "NOT_APPLICABLE");
  electronWindow();
  const local = await syncLocalPeripheralAssignments({ authenticated: true, tenantId: "t", branchId: "b", terminalId: "local-terminal" });
  assert.equal(local.status, "NOT_APPLICABLE");
});

test("zero local peripherals is a successful no-op", async () => {
  electronWindow();
  let writes = 0;
  const result = await syncLocalPeripheralAssignments(
    { authenticated: true, tenantId: "tenant-1", branchId: "branch-1", terminalId: "terminal-1" },
    async () => [],
    async () => { writes += 1; return settings(); },
  );
  assert.equal(result.status, "NOOP");
  assert.equal(writes, 0);
});
