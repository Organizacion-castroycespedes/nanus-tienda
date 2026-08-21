import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import { PrinterService } from "../src/modules/printer/printer.service";
import {
  PeripheralAdapterResolver,
  REAL_ADAPTERS_DISABLED_MESSAGE,
} from "../src/shared/adapters/peripheral-adapter.resolver";
import {
  UsbSystemPrinterAdapter,
  type UsbPrintCommandRunner,
} from "../src/shared/adapters/usb-system-printer.adapter";
import { DEVICE_PROFILES } from "../src/shared/profiles/device-profiles";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  type PeripheralDevice,
} from "../src/shared/types/peripheral.types";
import { EscPosMockCommandName } from "../src/shared/escpos-mock/escpos-mock.types";
import {
  buildUsbPrinterDescriptor,
  type UsbPrinterDiscovery,
} from "../src/shared/usb/usb-printer-discovery";

const discoveredUsbPrinter = buildUsbPrinterDescriptor("Xprinter XP-80T USB");

class FakeUsbDiscovery implements UsbPrinterDiscovery {
  constructor(private devices = [discoveredUsbPrinter]) {}

  list() {
    return [...this.devices];
  }

  setDevices(devices: typeof discoveredUsbPrinter[]) {
    this.devices = devices;
  }
}

const buildDevices = (usbDiscovery = new FakeUsbDiscovery()) => {
  const logsService = new LogsService();
  const eventsService = new EventsService();
  const service = new DevicesService(logsService, eventsService, usbDiscovery);

  return {
    controller: new DevicesController(service),
    service,
    usbDiscovery,
    logsService,
    eventsService,
  };
};

const buildUsbPrinter = (): PeripheralDevice => ({
  id: "printer-xp80t-usb-001",
  type: DeviceType.PRINTER,
  name: "Xprinter XP-80T",
  status: DeviceStatus.CONNECTED,
  connectionType: ConnectionType.USB,
  terminalId: "local-terminal",
  profileId: "THERMAL_80MM",
  usb: {
    deviceId: discoveredUsbPrinter.deviceId,
    printerName: discoveredUsbPrinter.printerName,
  },
});

test("USB discovery returns stable agent-generated printer descriptor", () => {
  const { controller } = buildDevices();
  const result = controller.discover();
  const device = result.devices.find(
    (candidate) => candidate.usb?.deviceId === discoveredUsbPrinter.deviceId
  );

  assert.ok(device);
  assert.equal(device.connectionType, ConnectionType.USB);
  assert.equal(device.profileId, "THERMAL_80MM");
  assert.equal(device.usb?.printerName, "Xprinter XP-80T USB");
});

test("USB printer registration requires discovered device and not network fields", () => {
  const { controller } = buildDevices();
  controller.discover();

  const created = controller.create({
    ...buildUsbPrinter(),
    usb: { deviceId: discoveredUsbPrinter.deviceId },
  });

  assert.equal(created.connectionType, ConnectionType.USB);
  assert.equal(created.network, undefined);
  assert.equal(created.usb?.deviceId, discoveredUsbPrinter.deviceId);
  assert.equal(created.profileId, "THERMAL_80MM");
});

test("USB printer registration rejects an undiscovered device", () => {
  const { controller } = buildDevices();
  controller.discover();

  assert.throws(
    () =>
      controller.create({
        ...buildUsbPrinter(),
        id: "printer-xp80t-usb-missing",
        usb: { deviceId: "usb-printer-missing" },
      }),
    NotFoundException
  );
});

test("real adapters disabled blocks USB printer", () => {
  const resolver = new PeripheralAdapterResolver(false);

  assert.throws(
    () => resolver.resolvePrinter(buildUsbPrinter(), "MOCK"),
    new RegExp(REAL_ADAPTERS_DISABLED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
});

test("resolver selects USB RAW adapter when real adapters are enabled", () => {
  const resolver = new PeripheralAdapterResolver(true);
  const adapter = resolver.resolvePrinter(buildUsbPrinter(), "MOCK");

  assert.equal(adapter.adapterName, "UsbRawPrinterAdapter");
  assert.equal(adapter.mode, "REAL");
});

test("USB system adapter prints through CUPS queue with a fake command runner", () => {
  const commands: Array<{ command: string; args: string[]; input?: string }> = [];
  const runner: UsbPrintCommandRunner = (command, args, input) => {
    commands.push({ command, args, input });
  };
  const adapter = new UsbSystemPrinterAdapter("linux", runner, "GDI");
  const result = adapter.printTest({
    agentName: "manus-pos-peripheral-agent",
    mode: "REAL",
    terminalId: "local-terminal",
    device: buildUsbPrinter(),
    profile: DEVICE_PROFILES.THERMAL_80MM,
    jobId: "usb-print-job-test",
    timestamp: "2026-08-19T00:00:00.000Z",
  });

  assert.deepEqual(commands[0], {
    command: "lp",
    args: ["-d", "Xprinter XP-80T USB", "-o", "raw"],
    input: result.preview,
  });
  assert.match(result.preview, /MANUS POS/);
  assert.match(result.preview, /Xprinter XP-80T/);
  assert.match(result.preview, /THERMAL_80MM/);
  assert.match(result.preview, /USB/);
  assert.match(result.preview, /IMPRESION OK/);
  assert.equal(result.capabilities.supportsPhysicalCut, false);
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Cut),
    false
  );
});

test("USB RAW Windows sends shared ESC/POS bytes to the discovered queue", () => {
  const commands: Array<{ command: string; args: string[] }> = [];
  const adapter = new UsbSystemPrinterAdapter("win32", (command, args) => {
    commands.push({ command, args });
  }, "RAW", true);

  const result = adapter.printTicket({
    agentName: "manus-pos-peripheral-agent",
    mode: "REAL",
    terminalId: "local-terminal",
    device: buildUsbPrinter(),
    profile: DEVICE_PROFILES.THERMAL_80MM,
    jobId: "usb-raw-ticket-job",
    timestamp: "2026-08-21T00:00:00.000Z",
    ticketType: "SALE",
    content: {
      header: "MANUS POS",
      items: [{ name: "Producto con nombre largo que debe envolver seguro", quantity: 1, total: 40000 }],
      total: 40000,
    },
  });

  assert.equal(commands[0]?.command, "powershell.exe");
  assert.equal(commands[0]?.args[2], "-EncodedCommand");
  const script = Buffer.from(commands[0]?.args[3] ?? "", "base64").toString("utf16le");
  assert.match(script, /OpenPrinter/);
  assert.match(script, /StartDocPrinter/);
  assert.match(script, /WritePrinter/);
  assert.match(script, /pDatatype = 'RAW'/);
  assert.equal(result.adapterName, "UsbRawPrinterAdapter");
  assert.equal(result.capabilities.supportsPhysicalCut, true);
  assert.ok((result.bytesSent ?? 0) > 0);
});

test("USB RAW failure remains controlled and does not fall back to GDI", () => {
  const adapter = new UsbSystemPrinterAdapter("win32", () => {
    throw new Error("spooler rejected RAW job");
  }, "RAW");

  assert.throws(
    () =>
      adapter.printTest({
        agentName: "manus-pos-peripheral-agent",
        mode: "REAL",
        terminalId: "local-terminal",
        device: buildUsbPrinter(),
        profile: DEVICE_PROFILES.THERMAL_80MM,
        jobId: "usb-raw-fail",
        timestamp: "2026-08-21T00:00:00.000Z",
      }),
    /USB RAW printer print failed: spooler rejected RAW job/
  );
});

test("USB RAW keeps physical-cut capability false until physical certification", () => {
  const adapter = new UsbSystemPrinterAdapter("win32", () => {}, "RAW", false);

  assert.equal(
    adapter.getCapabilities(DEVICE_PROFILES.THERMAL_80MM).supportsPhysicalCut,
    false
  );
});

test("USB adapter returns a controlled print error", () => {
  const adapter = new UsbSystemPrinterAdapter("linux", () => {
    throw new Error("queue rejected job");
  }, "GDI");

  assert.throws(
    () =>
      adapter.printTest({
        agentName: "manus-pos-peripheral-agent",
        mode: "REAL",
        terminalId: "local-terminal",
        device: buildUsbPrinter(),
        profile: DEVICE_PROFILES.THERMAL_80MM,
        jobId: "usb-print-job-fail",
        timestamp: "2026-08-19T00:00:00.000Z",
      }),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.match((error as Error).message, /USB GDI printer print failed: queue rejected job/);
      return true;
    }
  );
});

test("USB unavailable queue emits a controlled printer failure event", async () => {
  const discovery = new FakeUsbDiscovery();
  const { controller, service, logsService, eventsService } = buildDevices(discovery);
  controller.discover();
  controller.create({ ...buildUsbPrinter(), usb: { deviceId: discoveredUsbPrinter.deviceId } });
  discovery.setDevices([]);
  const previous = process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS;
  process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS = "true";
  const printerService = new PrinterService(service, logsService, eventsService);

  try {
    await assert.rejects(
      () => printerService.testPrint({ terminalId: "local-terminal", deviceId: "printer-xp80t-usb-001" }),
      NotFoundException
    );
    assert.equal(eventsService.getRecentEvents()[0]?.event, "printer.job.failed");
  } finally {
    if (previous === undefined) {
      delete process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS;
    } else {
      process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS = previous;
    }
  }
});
