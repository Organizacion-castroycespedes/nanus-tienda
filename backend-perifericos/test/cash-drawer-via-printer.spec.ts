import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CashDrawerController } from "../src/modules/cash-drawer/cash-drawer.controller";
import { CashDrawerService } from "../src/modules/cash-drawer/cash-drawer.service";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  type PeripheralDevice,
} from "../src/shared/types/peripheral.types";
import {
  NetworkEscposPrinterAdapter,
  type NetworkEscposSocket,
} from "../src/shared/adapters/network-escpos-printer.adapter";
import { PeripheralAdapterResolver } from "../src/shared/adapters/peripheral-adapter.resolver";
import {
  UsbSystemPrinterAdapter,
  type UsbPrintCommandRunner,
} from "../src/shared/adapters/usb-system-printer.adapter";
import { DEVICE_PROFILES } from "../src/shared/profiles/device-profiles";
import {
  DEFAULT_CASH_DRAWER_PULSE_PROFILE,
  buildCashDrawerPulseBytes,
} from "../src/shared/escpos/thermal-escpos.renderer";
import {
  buildUsbPrinterDescriptor,
  type UsbPrinterDiscovery,
} from "../src/shared/usb/usb-printer-discovery";
import { WindowsRawSpoolerTransport } from "../src/platform/windows/windows-raw-spooler.transport";
import type {
  DeviceRegistryState,
  DeviceRegistryStateStore,
} from "../src/platform/device-registry-state.store";

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

class FakeNetworkSocket implements NetworkEscposSocket {
  timeoutMs = 0;
  connectedTo?: { host: string; port: number };
  written?: Buffer;
  writeCount = 0;
  ended = false;
  destroyed = false;
  private errorListener?: (error: Error) => void;
  private timeoutListener?: () => void;

  constructor(
    private readonly options: {
      failOnWrite?: boolean;
      failOnConnect?: boolean;
      timeoutOnConnect?: boolean;
    } = {}
  ) {}

  setTimeout(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
  }

  connect(
    options: { host: string; port: number },
    listener?: () => void
  ): void {
    this.connectedTo = options;

    if (this.options.failOnConnect) {
      this.errorListener?.(new Error("socket refused"));
      return;
    }

    if (this.options.timeoutOnConnect) {
      this.timeoutListener?.();
      return;
    }

    listener?.();
  }

  write(buffer: Buffer, callback?: (error?: Error) => void): boolean {
    this.writeCount += 1;
    this.written = buffer;

    if (this.options.failOnWrite) {
      callback?.(new Error("write failed"));
      return true;
    }

    callback?.();
    return true;
  }

  end(): void {
    this.ended = true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  once(
    event: "error" | "timeout",
    listener: ((error: Error) => void) | (() => void)
  ): NetworkEscposSocket {
    if (event === "error") {
      this.errorListener = listener as (error: Error) => void;
    } else {
      this.timeoutListener = listener as () => void;
    }
    return this;
  }
}

const certifiedUsbPrinterDescriptor = buildUsbPrinterDescriptor(
  "XP-58",
  {
    nativeIdentifier: "XP-58",
    fingerprint: {
      source: "WINDOWS_PRINT_QUEUE",
      values: { queueName: "XP-58" },
    },
    platform: "WINDOWS",
    architecture: "x64",
  },
  "agent-installation-qa"
);

class FakeUsbDiscovery implements UsbPrinterDiscovery {
  constructor(private readonly devices = [certifiedUsbPrinterDescriptor]) {}

  list() {
    return [...this.devices];
  }
}

const buildHarness = (socketFactory: () => NetworkEscposSocket) => {
  const logsService = new LogsService();
  const eventsService = new EventsService();
  const devicesService = new DevicesService(
    logsService,
    eventsService,
    undefined,
    createMemoryDeviceRegistryStore(),
    testPlatformPaths
  );
  const cashDrawerService = new CashDrawerService(
    devicesService,
    logsService,
    eventsService
  );
  const resolver = new PeripheralAdapterResolver(true);

  (resolver as unknown as {
    networkEscposPrinterAdapter: NetworkEscposPrinterAdapter;
  }).networkEscposPrinterAdapter = new NetworkEscposPrinterAdapter(socketFactory);
  (cashDrawerService as unknown as { adapterResolver: PeripheralAdapterResolver }).adapterResolver =
    resolver;

  return {
    logsService,
    eventsService,
    devicesService,
    cashDrawerService,
    cashDrawerController: new CashDrawerController(cashDrawerService),
  };
};

const buildUsbHarness = (commandRunner: UsbPrintCommandRunner) => {
  const logsService = new LogsService();
  const eventsService = new EventsService();
  const devicesService = new DevicesService(
    logsService,
    eventsService,
    new FakeUsbDiscovery(),
    createMemoryDeviceRegistryStore(),
    testPlatformPaths
  );
  const cashDrawerService = new CashDrawerService(
    devicesService,
    logsService,
    eventsService
  );
  const resolver = new PeripheralAdapterResolver(true);
  const usbAdapter = new UsbSystemPrinterAdapter(
    "win32",
    () => {},
    "RAW",
    new WindowsRawSpoolerTransport(commandRunner)
  );

  (resolver as unknown as { usbSystemPrinterAdapter: UsbSystemPrinterAdapter }).usbSystemPrinterAdapter =
    usbAdapter;
  (cashDrawerService as unknown as { adapterResolver: PeripheralAdapterResolver }).adapterResolver =
    resolver;

  return {
    logsService,
    eventsService,
    devicesService,
    cashDrawerService,
    cashDrawerController: new CashDrawerController(cashDrawerService),
    usbAdapter,
    certifiedUsbPrinterDescriptor,
  };
};

const networkPrinter: PeripheralDevice = {
  id: "network-xp80-qa-001",
  type: DeviceType.PRINTER,
  name: "XP-80 LAN QA",
  status: DeviceStatus.NOT_REACHABLE,
  connectionType: ConnectionType.NETWORK,
  terminalId: "local-terminal",
  profileId: "THERMAL_80MM",
  network: {
    host: "192.168.123.100",
    port: 9100,
    timeoutMs: 3000,
  },
};

test("drawer pulse bytes are standard ESC/POS", () => {
  assert.deepEqual(
    [...buildCashDrawerPulseBytes(DEFAULT_CASH_DRAWER_PULSE_PROFILE)],
    [0x1b, 0x70, 0x00, 0x32, 0xfa]
  );
});

test("network drawer pulse uses the printer adapter and sends one write", async () => {
  const socket = new FakeNetworkSocket();
  const adapter = new NetworkEscposPrinterAdapter(() => socket);

  const result = await adapter.openCashDrawer({
    mode: "REAL",
    terminalId: "local-terminal",
    device: networkPrinter,
    profile: DEVICE_PROFILES.THERMAL_80MM,
    commandId: "real-cashdrawer-open-test",
    reason: "MANUAL",
    timestamp: "2026-08-23T00:00:00.000Z",
    pulse: DEFAULT_CASH_DRAWER_PULSE_PROFILE,
  });

  assert.equal(result.adapterName, "NetworkEscposPrinterAdapter");
  assert.equal(result.capabilities.supportsCashDrawerPulse, true);
  assert.equal(result.bytesSent, socket.written?.length);
  assert.equal(socket.writeCount, 1);
  assert.equal(socket.connectedTo?.host, "192.168.123.100");
  assert.equal(socket.connectedTo?.port, 9100);
  assert.deepEqual(socket.written, buildCashDrawerPulseBytes(DEFAULT_CASH_DRAWER_PULSE_PROFILE));
});

test("cash drawer open resolves legacy deviceId to canonical printer and returns QA data", async () => {
  const socket = new FakeNetworkSocket();
  const harness = buildHarness(() => socket);
  harness.devicesService.create(networkPrinter);

  const response = await harness.cashDrawerController.open({
    terminalId: "local-terminal",
    deviceId: "mock-cashdrawer-001",
    reason: "SALE_CASH_PAYMENT",
  });

  assert.equal(response.success, true);
  assert.equal(response.mode, "REAL");
  assert.equal(response.adapterName, "NetworkEscposPrinterAdapter");
  assert.equal(response.printerDeviceId, "network-xp80-qa-001");
  assert.equal(response.connectionType, ConnectionType.NETWORK);
  assert.equal(response.network?.host, "192.168.123.100");
  assert.equal(response.network?.port, 9100);
  assert.equal(response.bytesSent, socket.written?.length);
  assert.equal(response.commands.length, 1);
  assert.equal(response.pulse.connector, 0);
  assert.equal(response.pulse.pulseOnMs, 50);
  assert.equal(response.pulse.pulseOffMs, 250);
  assert.equal(harness.devicesService.findById("network-xp80-qa-001")?.status, DeviceStatus.CONNECTED);
  assert.equal(socket.writeCount, 1);
});

test("cash drawer open does not retry after write failure", async () => {
  const socket = new FakeNetworkSocket({ failOnWrite: true });
  const harness = buildHarness(() => socket);
  harness.devicesService.create(networkPrinter);

  await assert.rejects(
    () =>
      harness.cashDrawerController.open({
        terminalId: "local-terminal",
        printerDeviceId: "network-xp80-qa-001",
        reason: "SALE_CASH_PAYMENT",
      }),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.match((error as Error).message, /Network ESC\/POS printer write error: write failed/);
      return true;
    }
  );
  assert.equal(socket.writeCount, 1);
  assert.equal(
    harness.devicesService.findById("network-xp80-qa-001")?.status,
    DeviceStatus.NOT_REACHABLE
  );
});

test("cash drawer open rejects missing printer", async () => {
  const harness = buildHarness(() => new FakeNetworkSocket());

  await assert.rejects(
    () =>
      harness.cashDrawerController.open({
        terminalId: "local-terminal",
        printerDeviceId: "missing-printer",
      }),
    NotFoundException
  );
});

test("cash drawer open rejects printers without drawer pulse support", async () => {
  const socket = new FakeNetworkSocket();
  const harness = buildHarness(() => socket);
  harness.devicesService.create({
    id: "network-generic-001",
    type: DeviceType.PRINTER,
    name: "Generic network printer",
    status: DeviceStatus.CONNECTED,
    connectionType: ConnectionType.NETWORK,
    terminalId: "local-terminal",
    profileId: "GENERIC_TEXT",
    network: {
      host: "192.168.123.101",
      port: 9100,
      timeoutMs: 3000,
    },
  });

  await assert.rejects(
    () =>
      harness.cashDrawerController.open({
        terminalId: "local-terminal",
        printerDeviceId: "network-generic-001",
      }),
    /printer does not support cash drawer pulse/
  );
  assert.equal(socket.writeCount, 0);
});

test("USB certified drawer pulse uses one raw write and returns QA data", async () => {
  const writes: Array<{ command: string; args: string[] }> = [];
  const harness = buildUsbHarness((command, args) => {
    writes.push({ command, args });
  });
  harness.devicesService.discover();

  const printer = harness.devicesService.create({
    id: "printer-xp58-usb-qa-001",
    type: DeviceType.PRINTER,
    name: "XP-58 USB QA",
    status: DeviceStatus.CONNECTED,
    connectionType: ConnectionType.USB,
    terminalId: "local-terminal",
    profileId: "THERMAL_58MM",
    usb: {
      deviceId: harness.certifiedUsbPrinterDescriptor.deviceId,
      printerName: harness.certifiedUsbPrinterDescriptor.printerName,
    },
    metadata: { usbRawCashDrawerPulseCertified: true },
  });

  const response = await harness.cashDrawerController.open({
    terminalId: "local-terminal",
    printerDeviceId: printer.id,
    reason: "MANUAL_TEST",
  });

  assert.equal(response.success, true);
  assert.equal(response.mode, "REAL");
  assert.equal(response.adapterName, "UsbRawPrinterAdapter");
  assert.equal(response.printerDeviceId, printer.id);
  assert.equal(response.connectionType, ConnectionType.USB);
  assert.equal(response.profile.id, "THERMAL_58MM");
  assert.equal(response.capabilities.supportsCashDrawerPulse, true);
  assert.equal(response.capabilities.supportsPhysicalCut, false);
  assert.equal(response.bytesSent, 5);
  assert.deepEqual(response.pulse, DEFAULT_CASH_DRAWER_PULSE_PROFILE);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.command, "powershell.exe");
});

test("USB uncertified drawer pulse is rejected before transport write", async () => {
  let writes = 0;
  const harness = buildUsbHarness(() => {
    writes += 1;
  });
  harness.devicesService.discover();

  harness.devicesService.create({
    id: "printer-xp58-usb-qa-002",
    type: DeviceType.PRINTER,
    name: "XP-58 USB QA",
    status: DeviceStatus.CONNECTED,
    connectionType: ConnectionType.USB,
    terminalId: "local-terminal",
    profileId: "THERMAL_58MM",
    usb: {
      deviceId: harness.certifiedUsbPrinterDescriptor.deviceId,
      printerName: harness.certifiedUsbPrinterDescriptor.printerName,
    },
  });

  await assert.rejects(
    () =>
      harness.cashDrawerController.open({
        terminalId: "local-terminal",
        printerDeviceId: "printer-xp58-usb-qa-002",
        reason: "MANUAL_TEST",
      }),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.match(
        (error as Error).message,
        /printer drawer pulse is not certified for this device/
      );
      return true;
    }
  );
  assert.equal(writes, 0);
});
