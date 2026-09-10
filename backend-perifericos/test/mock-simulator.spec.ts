import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CashDrawerService } from "../src/modules/cash-drawer/cash-drawer.service";
import { CashDrawerController } from "../src/modules/cash-drawer/cash-drawer.controller";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { HealthController } from "../src/modules/health/health.controller";
import { LogsController } from "../src/modules/logs/logs.controller";
import { LogsService } from "../src/modules/logs/logs.service";
import { PrinterController } from "../src/modules/printer/printer.controller";
import { PrinterService } from "../src/modules/printer/printer.service";
import { ScaleController } from "../src/modules/scale/scale.controller";
import { ScaleService } from "../src/modules/scale/scale.service";
import { ScannerController } from "../src/modules/scanner/scanner.controller";
import { ScannerService } from "../src/modules/scanner/scanner.service";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  LogLevel,
  PeripheralEventName,
} from "../src/shared/types/peripheral.types";
import { isOriginAllowed } from "../src/shared/config/peripherals.config";
import { EscPosMockCommandName } from "../src/shared/escpos-mock/escpos-mock.types";
import { MockCashDrawerAdapter } from "../src/shared/adapters/mock-cash-drawer.adapter";
import { MockPrinterAdapter } from "../src/shared/adapters/mock-printer.adapter";
import {
  PeripheralAdapterResolver,
  REAL_ADAPTERS_DISABLED_MESSAGE,
} from "../src/shared/adapters/peripheral-adapter.resolver";
import {
  DEVICE_PROFILES,
  DeviceProfileId,
} from "../src/shared/profiles/device-profiles";
import type { UsbPrinterDiscovery } from "../src/shared/usb/usb-printer-discovery";
import {
  type DeviceRegistryState,
  type DeviceRegistryStateStore,
} from "../src/platform/device-registry-state.store";

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8")
);

const emptyUsbDiscovery: UsbPrinterDiscovery = {
  list: () => [],
};

const testPlatformPaths = {
  configDir: "C:\\Temp\\PeripheralAgent\\config",
  stateDir: "C:\\Temp\\PeripheralAgent\\state",
  logDir: "C:\\Temp\\PeripheralAgent\\logs",
};

const createMemoryDeviceRegistryStore = (): DeviceRegistryStateStore => {
  let state: DeviceRegistryState | null = null;

  return {
    read: () => state,
    write: (_paths, nextState) => {
      state = JSON.parse(JSON.stringify(nextState));
    },
  };
};

const buildServices = () => {
  const logsService = new LogsService();
  const eventsService = new EventsService();
  // MOCK tests must not call the real Windows spooler. Physical discovery is
  // covered independently by the Windows provider and packaged-Agent smoke.
  const devicesService = new DevicesService(
    logsService,
    eventsService,
    emptyUsbDiscovery,
    createMemoryDeviceRegistryStore(),
    testPlatformPaths
  );
  const printerService = new PrinterService(
    devicesService,
    logsService,
    eventsService
  );
  const cashDrawerService = new CashDrawerService(
    devicesService,
    logsService,
    eventsService
  );
  const scaleService = new ScaleService(
    devicesService,
    logsService,
    eventsService
  );
  const scannerService = new ScannerService(
    devicesService,
    logsService,
    eventsService
  );

  return {
    logsService,
    eventsService,
    devicesService,
    printerService,
    cashDrawerService,
    scaleService,
    scannerService,
    healthController: new HealthController(devicesService),
    devicesController: new DevicesController(devicesService),
    printerController: new PrinterController(printerService),
    cashDrawerController: new CashDrawerController(cashDrawerService),
    scaleController: new ScaleController(scaleService),
    scannerController: new ScannerController(scannerService),
    logsController: new LogsController(logsService),
  };
};

test("CORS allows configured origins and no Origin clients", () => {
  const allowed = ["http://localhost:3000", "http://localhost:3029"];

  assert.equal(isOriginAllowed(undefined, allowed), true);
  assert.equal(isOriginAllowed("http://localhost:3000", allowed), true);
  assert.equal(isOriginAllowed("http://evil.localhost", allowed), false);
});

test("health controller responds ok", () => {
  const { healthController } = buildServices();
  const result = healthController.getHealth();

  assert.equal(result.status, "ok");
  assert.equal(result.agent, "manus-pos-peripheral-agent");
  assert.equal(result.mode, "MOCK");
  assert.equal(result.version, packageJson.version);
});

test("devices list returns required mock peripherals", () => {
  const { devicesController } = buildServices();
  const devices = devicesController.getDevices();

  assert.equal(devices.length, 4);
  assert.equal(devices[0].id, "mock-printer-001");
  assert.equal(devices[0].profileId, DeviceProfileId.Thermal80mm);
  assert.equal(
    devices.find((device) => device.id === "mock-cashdrawer-001")?.profileId,
    DeviceProfileId.Thermal80mm
  );
  assert.equal(
    devices.some((device) => device.type === DeviceType.PRINTER),
    true
  );
  assert.equal(
    devices.some((device) => device.type === DeviceType.CASH_DRAWER),
    true
  );
  assert.equal(devices.some((device) => device.type === DeviceType.SCALE), true);
  assert.equal(
    devices.some((device) => device.type === DeviceType.SCANNER),
    true
  );
});

test("device profiles expose expected capabilities", () => {
  assert.equal(DEVICE_PROFILES.THERMAL_80MM.widthChars, 48);
  assert.equal(DEVICE_PROFILES.THERMAL_80MM.paperWidthMm, 80);
  assert.equal(DEVICE_PROFILES.THERMAL_80MM.supportsCut, true);
  assert.equal(DEVICE_PROFILES.THERMAL_58MM.widthChars, 32);
  assert.equal(DEVICE_PROFILES.THERMAL_58MM.paperWidthMm, 58);
  assert.equal(DEVICE_PROFILES.GENERIC_TEXT.widthChars, 40);
  assert.equal(DEVICE_PROFILES.GENERIC_TEXT.paperWidthMm, null);
  assert.equal(DEVICE_PROFILES.GENERIC_TEXT.supportsCut, false);
  assert.equal(DEVICE_PROFILES.GENERIC_TEXT.supportsCashDrawerPulse, false);
});

test("mock printer adapter generates test print with profile preview", () => {
  const adapter = new MockPrinterAdapter();
  const device = buildServices().devicesController.getDevices()[0];
  const result = adapter.printTest({
    agentName: "manus-pos-peripheral-agent",
    mode: "MOCK",
    terminalId: "local-terminal",
    device,
    profile: DEVICE_PROFILES.THERMAL_80MM,
    jobId: "mock-print-job-test",
    timestamp: "2026-06-04T00:00:00.000Z",
  });

  assert.equal(result.adapterName, "MockPrinterAdapter");
  assert.equal(result.profile.id, DeviceProfileId.Thermal80mm);
  assert.match(result.preview, /PRUEBA DE IMPRESION/);
  assert.match(result.preview, /80mm \/ 48 chars/);
  assert.equal(result.capabilities.supportsCut, true);
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Init),
    true
  );
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Cut),
    true
  );
});

test("mock printer adapter generates ticket print with commands", () => {
  const adapter = new MockPrinterAdapter();
  const device = buildServices().devicesController.getDevices()[0];
  const result = adapter.printTicket({
    agentName: "manus-pos-peripheral-agent",
    mode: "MOCK",
    terminalId: "local-terminal",
    device,
    profile: DEVICE_PROFILES.THERMAL_58MM,
    jobId: "mock-print-job-ticket",
    timestamp: "2026-06-04T00:00:00.000Z",
    ticketType: "SALE",
    content: {
      businessName: "Castro & Cespedes",
      items: [
        {
          name: "Producto demo",
          quantity: 2,
          unitPrice: 5000,
          total: 10000,
        },
      ],
      total: 11900,
    },
  });

  assert.equal(result.adapterName, "MockPrinterAdapter");
  assert.equal(result.profile.id, DeviceProfileId.Thermal58mm);
  assert.match(result.preview, /TOTAL/);
  assert.equal(
    result.preview.split("\n").every((line) => line.length <= 32),
    true
  );
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Init),
    true
  );
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Cut),
    true
  );
});

test("mock cash drawer adapter generates pulse command", () => {
  const adapter = new MockCashDrawerAdapter();
  const device = buildServices()
    .devicesController.getDevices()
    .find((candidate) => candidate.type === DeviceType.CASH_DRAWER);

  assert.ok(device);

  const result = adapter.open({
    mode: "MOCK",
    terminalId: "local-terminal",
    device,
    profile: DEVICE_PROFILES.THERMAL_80MM,
    commandId: "mock-cashdrawer-open-test",
    reason: "SALE_CASH_PAYMENT",
    timestamp: "2026-06-04T00:00:00.000Z",
  });

  assert.equal(result.adapterName, "MockCashDrawerAdapter");
  assert.equal(result.capabilities.supportsCashDrawerPulse, true);
  assert.equal(
    result.commands.some(
      (command) => command.name === EscPosMockCommandName.CashDrawerPulse
    ),
    true
  );
});

test("adapter resolver selects mock adapters and rejects real connection types", () => {
  const resolver = new PeripheralAdapterResolver();
  const { devicesController } = buildServices();
  const printer = devicesController.getDevices()[0];
  const cashDrawer = devicesController
    .getDevices()
    .find((device) => device.type === DeviceType.CASH_DRAWER);

  assert.ok(cashDrawer);
  assert.equal(resolver.resolvePrinter(printer, "MOCK").adapterName, "MockPrinterAdapter");
  assert.equal(
    resolver.resolveCashDrawer(cashDrawer, "MOCK").adapterName,
    "MockCashDrawerAdapter"
  );

  for (const connectionType of [
    ConnectionType.USB,
    ConnectionType.SERIAL,
    ConnectionType.HID,
    ConnectionType.USB_HID,
  ]) {
    assert.throws(
      () =>
        resolver.resolvePrinter(
          {
            ...printer,
            connectionType,
          },
          "MOCK"
        ),
      new RegExp(REAL_ADAPTERS_DISABLED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  }
});

test("discover logs and emits connected events", () => {
  const {
    devicesController,
    logsService,
    eventsService,
  } = buildServices();

  const result = devicesController.discover();

  assert.equal(result.success, true);
  assert.ok(result.devices.length >= 4);
  assert.equal(
    logsService.list().find((entry) => entry.event === "devices.discover.simulated")?.event,
    "devices.discover.simulated"
  );
  assert.equal(
    eventsService.getRecentEvents().filter(
      (event) => event.event === PeripheralEventName.DeviceConnected
    ).length,
    result.devices.length
  );
});

test("test print simulates job logs and events", async () => {
  const {
    printerController,
    logsService,
    eventsService,
  } = buildServices();

  const result = await printerController.testPrint({
    terminalId: "local-terminal",
    deviceId: "mock-printer-001",
  });

  assert.equal(result.success, true);
  assert.match(result.jobId, /^mock-print-job-/);
  assert.equal(result.mode, "MOCK");
  assert.equal(result.adapterName, "MockPrinterAdapter");
  assert.equal(result.bytesSent, undefined);
  assert.equal(result.deviceId, "mock-printer-001");
  assert.equal(result.terminalId, "local-terminal");
  assert.match(result.preview, /PRUEBA DE IMPRESION/);
  assert.match(result.preview, /80mm \/ 48 chars/);
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Init),
    true
  );
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Cut),
    true
  );
  const testPrintLog = logsService
    .list()
    .find((entry) => entry.event === "printer.test_print.simulated");
  assert.ok(testPrintLog);
  assert.equal(testPrintLog?.metadata.previewLength, result.preview.length);
  assert.equal(
    testPrintLog?.metadata.commandCount,
    result.commands.length
  );
  assert.equal("preview" in testPrintLog!.metadata, false);
  assert.equal(
    eventsService.getRecentEvents()[0].event,
    PeripheralEventName.PrinterJobCompleted
  );
  assert.equal(eventsService.getRecentEvents()[0].data.mode, "MOCK");
  assert.equal(eventsService.getRecentEvents()[0].data.previewAvailable, true);
  assert.equal(
    eventsService.getRecentEvents()[0].data.commandCount,
    result.commands.length
  );
  assert.equal("preview" in eventsService.getRecentEvents()[0].data, false);
  assert.equal(
    eventsService.getRecentEvents()[1].event,
    PeripheralEventName.PrinterJobStarted
  );
});

test("ticket print simulates without logging full content", async () => {
  const { printerController, logsService } = buildServices();

  const result = await printerController.printTicket({
    terminalId: "local-terminal",
    deviceId: "mock-printer-001",
    ticketType: "SALE",
    content: {
      businessName: "Castro & Cespedes",
      documentNumber: "FV-MOCK-001",
      cashier: "Caja 1",
      items: [
        {
          name: "Producto demo con nombre suficientemente largo para envolver",
          quantity: 2,
          unitPrice: 5000,
          total: 10000,
        },
      ],
      subtotal: 10000,
      taxes: 1900,
      discounts: 0,
      total: 11900,
      payments: [{ method: "EFECTIVO", amount: 11900 }],
      footer: "Gracias por su compra",
    },
  });

  const log = logsService
    .list()
    .find((entry) => entry.event === "printer.ticket_print.simulated");
  assert.ok(log);
  assert.equal(result.success, true);
  assert.equal(result.adapterName, "MockPrinterAdapter");
  assert.equal(result.bytesSent, undefined);
  assert.match(result.preview, /Castro & Cespedes/);
  assert.match(result.preview, /TOTAL/);
  assert.match(result.preview, /\$ 11,900/);
  assert.equal(
    result.preview.split("\n").every((line) => line.length <= 48),
    true
  );
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Init),
    true
  );
  assert.equal(
    result.commands.some((command) => command.name === EscPosMockCommandName.Cut),
    true
  );
  assert.equal(log?.event, "printer.ticket_print.simulated");
  assert.deepEqual(log?.metadata.itemCount, 1);
  assert.deepEqual(log?.metadata.commandCount, result.commands.length);
  assert.deepEqual(log?.metadata.previewLength, result.preview.length);
  assert.equal("lines" in log!.metadata, false);
  assert.equal("items" in log!.metadata, false);
  assert.equal("preview" in log!.metadata, false);
});

test("printer preview respects configured line width", async () => {
  const { devicesController, printerController } = buildServices();
  devicesController.update("mock-printer-001", {
    profileId: "THERMAL_58MM",
  });

  const result = await printerController.printTicket({
    terminalId: "local-terminal",
    deviceId: "mock-printer-001",
    ticketType: "SALE",
    content: {
      businessName: "Castro & Cespedes Development",
      items: [
        {
          name: "Producto demo con descripcion muy larga para wrap",
          quantity: 1,
          unitPrice: 12345,
          total: 12345,
        },
      ],
      total: 12345,
    },
  });

  assert.equal(
    result.preview.split("\n").every((line) => line.length <= 32),
    true
  );
  assert.equal(result.profile.id, "THERMAL_58MM");
  assert.equal(result.profile.widthChars, 32);
});

test("cash drawer open emits event and log", async () => {
  const {
    cashDrawerController,
    logsService,
    eventsService,
  } = buildServices();

  const result = await cashDrawerController.open({
    terminalId: "local-terminal",
    deviceId: "mock-cashdrawer-001",
    reason: "SALE_CASH_PAYMENT",
  });

  assert.equal(result.success, true);
  assert.match(result.commandId, /^mock-cashdrawer-open-/);
  assert.equal(result.mode, "MOCK");
  assert.equal(result.printerDeviceId, "mock-printer-001");
  assert.equal(result.connectionType, ConnectionType.MOCK);
  assert.equal(
    result.commands.some(
      (command) => command.name === EscPosMockCommandName.CashDrawerPulse
    ),
    true
  );
  assert.equal(result.commands.length, 1);
  assert.equal(logsService.list()[0].event, "cashdrawer.open.simulated");
  assert.equal(logsService.list()[0].metadata.commandCount, 1);
  assert.equal(
    eventsService.getRecentEvents()[0].event,
    PeripheralEventName.CashDrawerOpened
  );
  assert.equal(eventsService.getRecentEvents()[0].data.commandCount, 1);
  assert.equal(eventsService.getRecentEvents()[0].data.printerDeviceId, "mock-printer-001");
});

test("scale returns simulated weight and emits event", () => {
  const { scaleController, logsService, eventsService } = buildServices();

  const result = scaleController.getCurrentWeight(
    "local-terminal",
    "mock-scale-001"
  );

  assert.equal(result.deviceId, "mock-scale-001");
  assert.equal(result.weight, 1.25);
  assert.equal(result.unit, "kg");
  assert.equal(result.stable, true);
  assert.equal(logsService.list()[0].event, "scale.current_weight.simulated");
  assert.equal(
    eventsService.getRecentEvents()[0].event,
    PeripheralEventName.ScaleWeightChanged
  );
});

test("scanner simulate emits code read and log", () => {
  const { scannerController, logsService, eventsService } = buildServices();

  const result = scannerController.simulate({
    terminalId: "local-terminal",
    deviceId: "mock-scanner-001",
    code: "7701234567890",
    format: "EAN13",
  });

  assert.equal(result.success, true);
  assert.equal(result.code, "7701234567890");
  assert.equal(result.format, "EAN13");
  assert.equal(logsService.list()[0].event, "scanner.code_read.simulated");
  assert.equal(
    eventsService.getRecentEvents()[0].event,
    PeripheralEventName.ScannerCodeRead
  );
});

test("logs controller returns in-memory technical logs", () => {
  const { logsController, scannerController } = buildServices();

  scannerController.simulate({
    terminalId: "local-terminal",
    deviceId: "mock-scanner-001",
    code: "7701234567890",
    format: "EAN13",
  });

  const logs = logsController.getLogs();
  assert.equal(logs[0].level, LogLevel.INFO);
  assert.equal(logs[0].source, "scanner");
  assert.equal(logs[0].event, "scanner.code_read.simulated");
});

test("POST /devices validates type and connection fields", () => {
  const { devicesController } = buildServices();

  assert.throws(
    () =>
      devicesController.create({
        type: "INVALID" as never,
        name: "Bad device",
      }),
    BadRequestException
  );

  const created = devicesController.create({
    type: DeviceType.PRINTER,
    id: "mock-printer-extra",
    name: "Printer extra MOCK",
    terminalId: "local-terminal",
  });

  assert.equal(created.id, "mock-printer-extra");
  assert.equal(created.connectionType, ConnectionType.MOCK);
});

test("SCANNER devices can use USB_HID without usb payload", () => {
  const { devicesController } = buildServices();

  const created = devicesController.create({
    type: DeviceType.SCANNER,
    id: "usb-hid-scanner-001",
    name: "Scanner HID USB",
    connectionType: ConnectionType.USB_HID,
    terminalId: "local-terminal",
  });

  assert.equal(created.type, DeviceType.SCANNER);
  assert.equal(created.connectionType, ConnectionType.USB_HID);
});

test("PATCH /devices/:id validates status and updates state", () => {
  const { devicesController } = buildServices();

  assert.throws(
    () =>
      devicesController.update("mock-printer-001", {
        status: "BROKEN" as never,
      }),
    BadRequestException
  );

  const updated = devicesController.update("mock-printer-001", {
    status: DeviceStatus.DISCONNECTED,
  });

  assert.equal(updated.status, DeviceStatus.DISCONNECTED);
});

test("deviceId not found returns controlled error and WARN log", async () => {
  const { printerController, logsService } = buildServices();

  await assert.rejects(
    () =>
      printerController.testPrint({
        terminalId: "local-terminal",
        deviceId: "mock-missing-001",
      }),
    NotFoundException
  );

  assert.equal(logsService.list()[0].level, LogLevel.WARN);
  assert.equal(logsService.list()[0].event, "device.lookup.not_found");
});

test("legacy cash drawer request resolves canonical printer device", async () => {
  const { cashDrawerController, logsService } = buildServices();

  const result = await cashDrawerController.open({
    terminalId: "local-terminal",
    deviceId: "mock-printer-001",
  });

  assert.equal(result.success, true);
  assert.equal(result.printerDeviceId, "mock-printer-001");
  assert.equal(result.connectionType, ConnectionType.MOCK);
  assert.equal(result.commands.length, 1);
  assert.equal(logsService.list()[0].event, "cashdrawer.open.simulated");
});

test("disconnected device cannot execute operational action", async () => {
  const { devicesController, printerController, logsService } = buildServices();

  devicesController.update("mock-printer-001", {
    status: DeviceStatus.DISCONNECTED,
  });

  await assert.rejects(
    () =>
      printerController.testPrint({
        terminalId: "local-terminal",
        deviceId: "mock-printer-001",
      }),
    BadRequestException
  );

  assert.equal(logsService.list()[0].level, LogLevel.WARN);
  assert.equal(logsService.list()[0].event, "device.lookup.not_operational");
});

test("payload validation rejects invalid scanner and ticket requests", async () => {
  const { scannerController, printerController } = buildServices();

  assert.throws(
    () =>
      scannerController.simulate({
        terminalId: "local-terminal",
        deviceId: "mock-scanner-001",
        code: "",
        format: "EAN13",
      }),
    BadRequestException
  );

  assert.throws(
    () =>
      scannerController.simulate({
        terminalId: "local-terminal",
        deviceId: "mock-scanner-001",
        code: "7701234567890",
        format: "ean 13",
      }),
    BadRequestException
  );

  await assert.rejects(
    () =>
      printerController.printTicket({
        terminalId: "local-terminal",
        deviceId: "mock-printer-001",
        ticketType: "SALE",
      }),
    BadRequestException
  );
});

test("in-memory logs have configurable cap", () => {
  const previousLimit = process.env.PERIPHERALS_LOG_LIMIT;
  process.env.PERIPHERALS_LOG_LIMIT = "3";

  const logsService = new LogsService();
  logsService.append({
    source: "test",
    event: "one",
    message: "one",
  });
  logsService.append({
    source: "test",
    event: "two",
    message: "two",
  });
  logsService.append({
    source: "test",
    event: "three",
    message: "three",
  });
  logsService.append({
    source: "test",
    event: "four",
    message: "four",
  });

  assert.equal(logsService.getLimit(), 3);
  assert.equal(logsService.list().length, 3);
  assert.equal(logsService.list()[0].event, "four");

  if (previousLimit === undefined) {
    delete process.env.PERIPHERALS_LOG_LIMIT;
  } else {
    process.env.PERIPHERALS_LOG_LIMIT = previousLimit;
  }
});
