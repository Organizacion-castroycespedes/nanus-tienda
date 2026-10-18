import assert from "node:assert/strict";
import test from "node:test";
import { WindowsPrinterDiscoveryProvider, correlateWindowsPrinterQueues, parseWindowsPnpDiagnostics, type WindowsPnpDiagnostic, type WindowsPrinterDiagnostic } from "../src/platform/windows/windows-printer-discovery.provider";
import { buildUsbPrinterDescriptor, type UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import { ConnectionType, DeviceStatus, DeviceType } from "../src/shared/types/peripheral.types";
import type { DeviceRegistryStateStore } from "../src/platform/device-registry-state.store";
import { forbidHardwareIO } from "./support/no-hardware";

forbidHardwareIO();

const parentId = "USB\\VID_1FC9&PID_2016\\5D2F0E663532";
const childId = "USBPRINT\\PRINTERPOS-80\\6&2A2017DD&0&USB001";
const container = "498E79B7-F146-5533-8739-3C033D632C88";
const canonicalId = "usb-printer-1f0028d1fa5243c2";
const obsoleteId = "usb-printer-804a1994045911fd";
const queue: WindowsPrinterDiagnostic = { Name: "XP-80", Type: "Local", PortName: "USB001", DriverName: "XP-80", Shared: false, WorkOffline: false };
const inventories = (): WindowsPnpDiagnostic[] => [
  { InstanceId: parentId, Class: "USB", FriendlyName: "Printer POS-80", Status: "OK", Present: true,
    HardwareIds: ["USB\\VID_1FC9&PID_2016"], CompatibleIds: ["USB\\Class_07"], Children: [childId], ContainerId: container },
  { InstanceId: childId, Class: "Printer", FriendlyName: "Printer POS-80", Status: "OK", Present: true,
    Parent: parentId, ContainerId: container },
];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const providerFor = (state: { queues: WindowsPrinterDiagnostic[]; pnp: WindowsPnpDiagnostic[] }) =>
  new WindowsPrinterDiscoveryProvider((_command, args) => {
    const script = args[args.length - 1];
    if (script.includes("Get-Printer")) return JSON.stringify(state.queues);
    assert.ok(script.includes("Get-PnpDevice -PresentOnly"));
    assert.ok(script.includes("foreach ($key"));
    for (const key of ["DEVPKEY_Device_Parent", "DEVPKEY_Device_Children", "DEVPKEY_Device_ContainerId", "USBPRINT"]) assert.ok(script.includes(key));
    return JSON.stringify(state.pnp);
  }, () => {});

test("exact Windows parent/container/port proof is parsed and published without commands", async () => {
  const parsed = parseWindowsPnpDiagnostics(JSON.stringify(inventories()));
  assert.equal(parsed[1].Parent, parentId);
  assert.deepEqual(parsed[0].Children, [childId]);
  const provider = providerFor({ queues: [queue], pnp: parsed });
  const found = await provider.listUsbPrinters();
  assert.equal(provider.getLastUsbDiscoveryDiagnostics().at(-1)?.reasonCode, "OK");
  const canonical = found.find((device) => device.name === "XP-80")!;
  assert.equal(canonical.fingerprint.values?.physicalNativeIdentifier, parentId);
  assert.equal(canonical.fingerprint.values?.usbPrintInstanceId, childId);
  assert.equal(canonical.fingerprint.values?.queueCorrelation, "USBPRINT_PARENT_CONTAINER_PORT");
});

const negatives: Array<[string, (q: WindowsPrinterDiagnostic[], p: WindowsPnpDiagnostic[]) => void]> = [
  ["missing USBPRINT", (_q, p) => { p.pop(); }],
  ["absent parent", (_q, p) => { p.shift(); }],
  ["mismatched parent", (_q, p) => { p[1].Parent = parentId + "OTHER"; }],
  ["missing reciprocal child", (_q, p) => { p[0].Children = []; }],
  ["mismatched container", (_q, p) => { p[1].ContainerId = "11111111-1111-1111-1111-111111111111"; }],
  ["missing container", (_q, p) => { p[0].ContainerId = ""; }],
  ["mismatched VID PID", (_q, p) => { p[0].HardwareIds = ["USB\\VID_0001&PID_0002"]; }],
  ["disconnected physical", (_q, p) => { p[0].Present = false; }],
  ["unhealthy USBPRINT", (_q, p) => { p[1].Status = "ERROR"; }],
  ["duplicate port queues", (q) => { q.push({ ...q[0], Name: "Second queue" }); }],
  ["duplicate USBPRINT", (_q, p) => { p.push(copy(p[1])); }],
  ["duplicate physical identity", (_q, p) => { p.push(copy(p[0])); }],
  ["stale offline queue", (q) => { q[0].WorkOffline = true; }],
  ["mismatched port", (q) => { q[0].PortName = "USB009"; }],
];
for (const [name, mutate] of negatives) {
  test(`fails closed for ${name}`, async () => {
    const queues = [copy(queue)]; const pnp = inventories();
    mutate(queues, pnp);
    assert.equal(correlateWindowsPrinterQueues(queues, pnp).size, 0);
    const devices = await providerFor({ queues, pnp }).listUsbPrinters();
    assert.ok(devices.every((device) => !device.fingerprint.values?.queueCorrelation));
  });
}

test("queue-only and hardware-only never manufacture a proven join", () => {
  assert.equal(correlateWindowsPrinterQueues([queue], []).size, 0);
  assert.equal(correlateWindowsPrinterQueues([], inventories()).size, 0);
});

test("PnP script filters present printing candidates before any property acquisition", async () => {
  const provider = new WindowsPrinterDiscoveryProvider((_command, args) => {
    const script = args.at(-1)!;
    if (script.includes("Get-Printer")) return JSON.stringify([queue]);
    const filter = script.slice(script.indexOf("Where-Object {"), script.indexOf("| ForEach-Object {"));
    assert.ok(script.includes("Get-PnpDevice -PresentOnly | Where-Object {"));
    assert.equal(filter.trim(), String.raw`Where-Object {
  ($_.InstanceId -like 'USB\*' -and ($_.CompatibleID -match 'Class_07')) -or $_.InstanceId -like 'USBPRINT\*'
}`);
    assert.ok(script.indexOf("| ForEach-Object {") < script.indexOf("Get-PnpDeviceProperty"));
    assert.equal(script.match(/Get-PnpDeviceProperty/g)?.length, 1);
    // Static script contract only: no PowerShell execution or latency claim.
    return JSON.stringify(inventories());
  }, () => {});
  const devices = await provider.listUsbPrinters();
  assert.equal(devices.find((device) => device.name === "XP-80")?.fingerprint.values?.physicalNativeIdentifier, parentId);
});

test("many irrelevant USB inventory records cannot create or displace an exact join", () => {
  const irrelevant: WindowsPnpDiagnostic[] = Array.from({ length: 500 }, (_, index) => ({
    InstanceId: `USB\\VID_0001&PID_0002\\HUB${index}`, Class: "USB", FriendlyName: "USB hub",
    Status: "OK", Present: true, CompatibleIds: ["USB\\Class_09"],
  }));
  const joins = correlateWindowsPrinterQueues([queue], [...irrelevant, ...inventories()]);
  assert.equal(joins.size, 1);
  assert.equal(joins.get("XP-80")?.physicalNativeIdentifier, parentId);
  assert.equal(correlateWindowsPrinterQueues([queue], irrelevant).size, 0);
});

test("PnP timeout retains queue without physical proof and leaves ROCHI serial inventory independent", async () => {
  const provider = new WindowsPrinterDiscoveryProvider((_command, args) => {
    const script = args.at(-1)!;
    if (script.includes("Get-Printer")) return JSON.stringify([queue]);
    if (script.includes("Get-CimInstance Win32_SerialPort")) {
      assert.ok(!script.includes("Get-PnpDeviceProperty"));
      return JSON.stringify([{ DeviceID: "COM5", Name: "ROCHI", PNPDeviceID: "USB\\VID_1A86&PID_7523\\SCALE", Status: "OK", Present: true }]);
    }
    throw Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" });
  }, () => {});
  const devices = await provider.listUsbPrinters();
  assert.equal(devices.length, 1);
  assert.equal(devices[0].fingerprint.values?.queueCorrelation, undefined);
  const diagnostic = provider.getLastUsbDiscoveryDiagnostics().at(-1)!;
  assert.equal(diagnostic.reasonCode, "TIMEOUT");
  assert.equal(diagnostic.timeoutMs, 7_000);
  const serial = await provider.listSerialDevices();
  assert.equal(serial.length, 1);
  assert.equal(serial[0].port, "COM5");
  assert.equal(serial[0].present, true);
});

const withRealMode = async (run: () => Promise<void>) => {
  const previous = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  try { await run(); } finally {
    if (previous === undefined) delete process.env.PERIPHERALS_MODE;
    else process.env.PERIPHERALS_MODE = previous;
  }
};

test("persisted canonical ID profile and certification survive join unplug and refresh", async () => withRealMode(async () => {
  const state = { queues: [copy(queue)], pnp: inventories() };
  const provider = providerFor(state);
  let writes = 0;
  const store: DeviceRegistryStateStore = {
    read: () => ({ schemaVersion: 1, devices: [
      { id: canonicalId, type: DeviceType.PRINTER, name: "XP-80", connectionType: ConnectionType.USB, terminalId: "fixture", profileId: "THERMAL_80MM",
        usb: { deviceId: canonicalId, printerName: "XP-80", windowsQueueName: "XP-80" }, metadata: { usbRawCashDrawerPulseCertified: true } },
      { id: obsoleteId, type: DeviceType.PRINTER, name: "Printer POS-80", connectionType: ConnectionType.USB, terminalId: "fixture",
        usb: { deviceId: obsoleteId, printerName: "Printer POS-80" } },
    ] }),
    write: () => { writes += 1; },
  };
  const discovery: UsbPrinterDiscovery = { list: async () => (await provider.listUsbPrinters()).map((item) => buildUsbPrinterDescriptor(item.name, item, "fixture")) };
  const service = new DevicesService(new LogsService(), new EventsService(), discovery, store,
    { stateDir: "fixture-unused", configDir: "fixture-unused", logDir: "fixture-unused" });
  await service.discover();
  const selected = service.findRequired(canonicalId, DeviceType.PRINTER);
  assert.equal(selected.status, DeviceStatus.CONNECTED);
  assert.equal(selected.usb?.windowsQueueName, "XP-80");
  assert.equal(selected.usb?.deviceId, canonicalId);
  assert.equal(selected.profileId, "THERMAL_80MM");
  assert.equal(selected.terminalId, "fixture");
  assert.equal(selected.metadata?.usbRawCashDrawerPulseCertified, true);
  assert.equal(selected.metadata?.physicalDetected, true);
  assert.equal(selected.metadata?.queueInstalled, true);
  assert.equal(service.list().filter((device) => device.status === DeviceStatus.CONNECTED).length, 1);
  assert.equal(service.findById(obsoleteId)?.status, DeviceStatus.DISCONNECTED);
  state.pnp = [];
  await service.discover();
  assert.equal(service.findById(canonicalId)?.status, DeviceStatus.DISCONNECTED);
  assert.throws(() => service.findRequired(canonicalId, DeviceType.PRINTER));
  state.pnp = inventories();
  await service.discover();
  assert.equal(service.findRequired(canonicalId, DeviceType.PRINTER).profileId, "THERMAL_80MM");
  assert.equal(writes, 0);
}));

test("identical printer names keep separate proven queues and XP-58 stays independent", async () => withRealMode(async () => {
  const second = inventories();
  const secondParent = "USB\\VID_1FC9&PID_2016\\SECOND";
  const secondChild = "USBPRINT\\PRINTERPOS-80\\SECOND&USB002";
  second[0] = { ...second[0], InstanceId: secondParent, Children: [secondChild] };
  second[1] = { ...second[1], InstanceId: secondChild, Parent: secondParent };
  const state = { queues: [copy(queue), { ...queue, Name: "XP-58", PortName: "USB002" }], pnp: [...inventories(), ...second] };
  const provider = providerFor(state);
  const discovery: UsbPrinterDiscovery = { list: async () => (await provider.listUsbPrinters()).map((item) => buildUsbPrinterDescriptor(item.name, item, "fixture")) };
  const service = new DevicesService(new LogsService(), new EventsService(), discovery,
    { read: () => null, write: () => { throw new Error("unexpected persistence"); } },
    { stateDir: "fixture-unused", configDir: "fixture-unused", logDir: "fixture-unused" });
  await service.discover();
  const listed = service.list();
  assert.equal(listed.length, 2);
  assert.equal(service.findRequired(canonicalId, DeviceType.PRINTER).name, "XP-80");
  assert.equal(service.findRequired(canonicalId, DeviceType.PRINTER).usb?.windowsQueueName, "XP-80");
  const xp58 = service.findRequired("usb-printer-45207a0cc744eb10", DeviceType.PRINTER);
  assert.equal(xp58.usb?.windowsQueueName, "XP-58");
  state.pnp = second;
  await service.discover();
  assert.equal(service.findById(canonicalId)?.status, DeviceStatus.DISCONNECTED);
  assert.equal(service.findRequired(xp58.id, DeviceType.PRINTER).status, DeviceStatus.CONNECTED);
}));
