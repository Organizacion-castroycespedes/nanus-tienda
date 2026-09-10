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
import { renderThermalEscPos } from "../src/shared/escpos/thermal-escpos.renderer";
import { WindowsRawSpoolerTransport } from "../src/platform/windows/windows-raw-spooler.transport";
import {
  type DeviceRegistryState,
  type DeviceRegistryStateStore,
} from "../src/platform/device-registry-state.store";

const testPlatformPaths = {
  configDir: "C:\\Temp\\PeripheralAgent\\config",
  stateDir: "C:\\Temp\\PeripheralAgent\\state",
  logDir: "C:\\Temp\\PeripheralAgent\\logs",
};

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

class FailingUsbDiscovery implements UsbPrinterDiscovery {
  list() {
    throw new Error("Get-Printer unavailable");
  }
}

const createMemoryDeviceRegistryStore = (): DeviceRegistryStateStore => {
  let state: DeviceRegistryState | null = null;

  return {
    read: () => state,
    write: (_paths, nextState) => {
      state = JSON.parse(JSON.stringify(nextState));
    },
  };
};

const buildDevices = (usbDiscovery = new FakeUsbDiscovery()) => {
  const logsService = new LogsService();
  const eventsService = new EventsService();
  const service = new DevicesService(
    logsService,
    eventsService,
    usbDiscovery,
    createMemoryDeviceRegistryStore(),
    testPlatformPaths
  );

  return {
    controller: new DevicesController(service),
    service,
    usbDiscovery,
    logsService,
    eventsService,
  };
};

const buildUsbPrinter = (metadata?: Record<string, unknown>): PeripheralDevice => ({
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
  ...(metadata ? { metadata } : {}),
});

test("USB discovery returns stable agent-generated printer descriptor", () => {
  const { controller } = buildDevices();
  const result = controller.discover();
  const device = result.devices.find(
    (candidate) => candidate.usb?.deviceId === discoveredUsbPrinter.deviceId
  );

  assert.ok(device);
  assert.equal(device.connectionType, ConnectionType.USB);
  assert.equal(device.profileId, undefined);
  assert.equal(device.usb?.printerName, "Xprinter XP-80T USB");
});

test("REAL discovery reports REAL and excludes MOCK seed devices", () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  try {
    const { controller, logsService } = buildDevices();
    const result = controller.discover();
    assert.equal(result.mode, "REAL");
    assert.equal(result.devices.some((device) => device.connectionType === "MOCK"), false);
    assert.equal(
      logsService.list().some((entry) => entry.metadata.outcome === "FOUND"),
      true
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.PERIPHERALS_MODE;
    } else {
      process.env.PERIPHERALS_MODE = previousMode;
    }
  }
});

test("REAL discovery exposes physical discovery failures instead of returning mocks", () => {
  const previousMode = process.env.PERIPHERALS_MODE;
  process.env.PERIPHERALS_MODE = "REAL";
  try {
    const { controller, logsService } = buildDevices(new FailingUsbDiscovery());
    assert.throws(
      () => controller.discover(),
      /Physical printer discovery failed: Get-Printer unavailable/
    );
    assert.equal(
      logsService.list().some((entry) => entry.metadata.outcome === "FAILED"),
      true
    );
  } finally {
    if (previousMode === undefined) {
      delete process.env.PERIPHERALS_MODE;
    } else {
      process.env.PERIPHERALS_MODE = previousMode;
    }
  }
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
  const rawTransport = new WindowsRawSpoolerTransport((command, args) => {
    commands.push({ command, args });
  });
  const adapter = new UsbSystemPrinterAdapter("win32", () => {}, "RAW", rawTransport);

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
  const encodedPayload = script.match(/FromBase64String\('([^']+)'\)/g)?.[1]
    ?.match(/'([^']+)'/)?.[1];
  assert.ok(encodedPayload);
  assert.deepEqual(
    Buffer.from(encodedPayload, "base64"),
    renderThermalEscPos(result.commands, result.preview, {
      encoding: "latin1",
      includePhysicalCut: true,
    })
  );
  assert.equal(Buffer.from(encodedPayload, "base64").includes(Buffer.from([0x1d, 0x56, 0x00])), true);
  assert.equal(result.adapterName, "UsbRawPrinterAdapter");
  assert.equal(result.capabilities.supportsPhysicalCut, false);
  assert.ok((result.bytesSent ?? 0) > 0);
});

test("PnP-only USB printer never calls OpenPrinter without a Windows queue", () => {
  let calls = 0;
  const device = {
    ...buildUsbPrinter(),
    descriptor: {
      agentInstallationId: "fixture",
      deviceId: "usb-pnp-only",
      nativeIdentifier: "USB\\VID_0483&PID_070B\\B82D3A880106",
      fingerprint: { source: "WINDOWS_PNP", values: { physicalDetected: "true", queueInstalled: "false" } },
      platform: "WINDOWS" as const,
      architecture: "x64",
    },
    metadata: { physicalDetected: true, queueInstalled: false },
  };
  const adapter = new UsbSystemPrinterAdapter("win32", () => { calls += 1; }, "RAW");
  assert.throws(() => adapter.printTest({
    agentName: "manus-pos-peripheral-agent", mode: "REAL", terminalId: "local-terminal",
    device, profile: DEVICE_PROFILES.THERMAL_58MM, jobId: "pnp-only", timestamp: "2026-08-21T00:00:00.000Z",
  }), /PRINT_TRANSPORT_NOT_READY/);
  assert.equal(calls, 0);
});

test("exact PnP plus queue uses the resolved Windows queue name", () => {
  const commands: Array<{ command: string; args: string[] }> = [];
  const rawTransport = new WindowsRawSpoolerTransport((command, args) => commands.push({ command, args }));
  const device = { ...buildUsbPrinter(), usb: { ...buildUsbPrinter().usb!, windowsQueueName: "XP-80" }, metadata: { physicalDetected: true, queueInstalled: true } };
  const adapter = new UsbSystemPrinterAdapter("win32", () => {}, "RAW", rawTransport);
  adapter.printTest({
    agentName: "manus-pos-peripheral-agent", mode: "REAL", terminalId: "local-terminal",
    device, profile: DEVICE_PROFILES.THERMAL_80MM, jobId: "queue-resolved", timestamp: "2026-08-21T00:00:00.000Z",
  });
  const script = Buffer.from(commands[0]?.args[3] ?? "", "base64").toString("utf16le");
  const queueEncoded = script.match(/FromBase64String\('([^']+)'\)/)?.[1];
  assert.equal(Buffer.from(queueEncoded ?? "", "base64").toString("utf8"), "XP-80");
  assert.doesNotMatch(script, /Xprinter XP-80T USB/);
});

test("Win32 error 1801 is normalized without encoded PowerShell details", () => {
  const rawTransport = new WindowsRawSpoolerTransport(() => { throw new Error("OpenPrinter failed: 1801"); });
  const adapter = new UsbSystemPrinterAdapter("win32", () => {}, "RAW", rawTransport);
  assert.throws(() => adapter.printTest({
    agentName: "manus-pos-peripheral-agent", mode: "REAL", terminalId: "local-terminal",
    device: buildUsbPrinter(), profile: DEVICE_PROFILES.THERMAL_58MM, jobId: "invalid-queue", timestamp: "2026-08-21T00:00:00.000Z",
  }), (error) => {
    assert.match((error as Error).message, /WINDOWS_INVALID_PRINTER_QUEUE/);
    assert.match((error as Error).message, /1801/);
    assert.doesNotMatch((error as Error).message, /EncodedCommand|FromBase64String/);
    return true;
  });
});

test("portable USB descriptor keeps legacy deviceId and serializes identity fields", () => {
  const descriptor = buildUsbPrinterDescriptor("XP-80", {
    nativeIdentifier: "XP-80",
    fingerprint: { source: "WINDOWS_PRINT_QUEUE", values: { queueName: "XP-80" } },
    platform: "WINDOWS",
    architecture: "x64",
  }, "agent-installation-001");

  assert.equal(descriptor.deviceId, "usb-printer-1f0028d1fa5243c2");
  assert.deepEqual(JSON.parse(JSON.stringify(descriptor)).descriptor, {
    agentInstallationId: "agent-installation-001",
    deviceId: "usb-printer-1f0028d1fa5243c2",
    nativeIdentifier: "XP-80",
    fingerprint: { source: "WINDOWS_PRINT_QUEUE", values: { queueName: "XP-80" } },
    platform: "WINDOWS",
    architecture: "x64",
  });
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
  const adapter = new UsbSystemPrinterAdapter("win32", () => {}, "RAW");

  assert.equal(
    adapter.getCapabilities(DEVICE_PROFILES.THERMAL_80MM).supportsPhysicalCut,
    false
  );
});

test("USB drawer capability stays false until the device is certified", () => {
  const adapter = new UsbSystemPrinterAdapter("win32", () => {}, "RAW");

  assert.equal(
    adapter.getCapabilities(DEVICE_PROFILES.THERMAL_58MM, buildUsbPrinter())
      .supportsCashDrawerPulse,
    false
  );
  assert.equal(
    adapter.getCapabilities(
      DEVICE_PROFILES.THERMAL_58MM,
      buildUsbPrinter({ usbRawCashDrawerPulseCertified: true })
    ).supportsCashDrawerPulse,
    true
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
      BadRequestException
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
