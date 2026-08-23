import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { DevicesController } from "../src/modules/devices/devices.controller";
import { DevicesService } from "../src/modules/devices/devices.service";
import { EventsService } from "../src/modules/events/events.service";
import { LogsService } from "../src/modules/logs/logs.service";
import { PrinterController } from "../src/modules/printer/printer.controller";
import { PrinterService } from "../src/modules/printer/printer.service";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  type PeripheralDevice,
} from "../src/shared/types/peripheral.types";
import {
  PeripheralAdapterResolver,
  REAL_ADAPTERS_DISABLED_MESSAGE,
} from "../src/shared/adapters/peripheral-adapter.resolver";
import {
  NetworkEscposPrinterAdapter,
  type NetworkEscposSocket,
} from "../src/shared/adapters/network-escpos-printer.adapter";
import { DEVICE_PROFILES } from "../src/shared/profiles/device-profiles";
import { EscPosMockCommandName } from "../src/shared/escpos-mock/escpos-mock.types";
import { createEscPosMockCommand } from "../src/shared/escpos-mock/thermal-ticket.formatter";
import {
  type DeviceRegistryState,
  type DeviceRegistryStateStore,
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

const networkPrinter: PeripheralDevice = {
  id: "network-printer-001",
  type: DeviceType.PRINTER,
  name: "Impresora red ESC/POS",
  status: DeviceStatus.CONNECTED,
  connectionType: ConnectionType.NETWORK,
  terminalId: "local-terminal",
  profileId: "THERMAL_80MM",
  network: {
    host: "192.168.1.50",
    port: 9100,
    timeoutMs: 3000,
  },
};

const buildServices = () => {
  const logsService = new LogsService();
  const eventsService = new EventsService();
  const devicesService = new DevicesService(
    logsService,
    eventsService,
    undefined,
    createMemoryDeviceRegistryStore(),
    testPlatformPaths
  );
  const printerService = new PrinterService(
    devicesService,
    logsService,
    eventsService
  );

  return {
    logsService,
    eventsService,
    devicesController: new DevicesController(devicesService),
    printerController: new PrinterController(printerService),
  };
};

const withRealAdaptersFlag = async <T>(
  value: string | undefined,
  action: () => Promise<T>
): Promise<T> => {
  const previous = process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS;
  if (value === undefined) {
    delete process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS;
  } else {
    process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS = value;
  }

  try {
    return await action();
  } finally {
    if (previous === undefined) {
      delete process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS;
    } else {
      process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS = previous;
    }
  }
};

class FakeNetworkSocket implements NetworkEscposSocket {
  timeoutMs = 0;
  connectedTo?: { host: string; port: number };
  written?: Buffer;
  ended = false;
  destroyed = false;
  private errorListener?: (error: Error) => void;
  private timeoutListener?: () => void;

  constructor(
    private readonly failOnConnect = false,
    private readonly timeoutOnConnect = false
  ) {}

  setTimeout(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
  }

  connect(
    options: { host: string; port: number },
    listener?: () => void
  ): void {
    this.connectedTo = options;
    if (this.failOnConnect) {
      this.errorListener?.(new Error("socket refused"));
      return;
    }
    if (this.timeoutOnConnect) {
      this.timeoutListener?.();
      return;
    }
    listener?.();
  }

  write(buffer: Buffer, callback?: (error?: Error) => void): boolean {
    this.written = buffer;
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

  triggerTimeout(): void {
    this.timeoutListener?.();
  }
}

test("real adapters disabled blocks NETWORK printer", () => {
  const resolver = new PeripheralAdapterResolver(false);

  assert.throws(
    () => resolver.resolvePrinter(networkPrinter, "MOCK"),
    new RegExp(REAL_ADAPTERS_DISABLED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
});

test("NetworkEscposPrinterAdapter is not used without feature flag", async () => {
  await withRealAdaptersFlag("false", async () => {
    const { devicesController, printerController } = buildServices();
    devicesController.create({
      ...networkPrinter,
    });

    await assert.rejects(
      () =>
        printerController.testPrint({
          terminalId: "local-terminal",
          deviceId: "network-printer-001",
        }),
      new RegExp(
        REAL_ADAPTERS_DISABLED_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      )
    );
  });
});

test("NETWORK device requires host", () => {
  const { devicesController } = buildServices();

  assert.throws(
    () =>
      devicesController.create({
        id: "network-printer-no-host",
        type: DeviceType.PRINTER,
        connectionType: ConnectionType.NETWORK,
        network: {
          port: 9100,
          timeoutMs: 3000,
        } as never,
      }),
    /network.host is required/
  );
});

test("NETWORK device requires valid port", () => {
  const { devicesController } = buildServices();

  assert.throws(
    () =>
      devicesController.create({
        id: "network-printer-bad-port",
        type: DeviceType.PRINTER,
        connectionType: ConnectionType.NETWORK,
        network: {
          host: "192.168.1.50",
          port: 70000,
          timeoutMs: 3000,
        },
      }),
    /network.port must be an integer between 1 and 65535/
  );
});

test("adapter resolver selects NetworkEscposPrinterAdapter with feature flag true", () => {
  const resolver = new PeripheralAdapterResolver(true);
  const adapter = resolver.resolvePrinter(networkPrinter, "MOCK");

  assert.equal(adapter.adapterName, "NetworkEscposPrinterAdapter");
  assert.equal(adapter.mode, "REAL");
});

test("NetworkEscposPrinterAdapter converts minimum commands to Buffer", () => {
  const adapter = new NetworkEscposPrinterAdapter();
  const buffer = adapter.buildEscPosBuffer(
    [
      createEscPosMockCommand(EscPosMockCommandName.Init),
      createEscPosMockCommand(EscPosMockCommandName.AlignCenter),
      createEscPosMockCommand(EscPosMockCommandName.BoldOn),
      createEscPosMockCommand(EscPosMockCommandName.BoldOff),
      createEscPosMockCommand(EscPosMockCommandName.Feed),
      createEscPosMockCommand(EscPosMockCommandName.Cut),
    ],
    "MANUS POS"
  );

  assert.equal(buffer[0], 0x1b);
  assert.equal(buffer[1], 0x40);
  assert.equal(buffer.includes(Buffer.from("MANUS POS\n", "utf8")), true);
  assert.deepEqual([...buffer.subarray(-3)], [0x1d, 0x56, 0x00]);
});

test("NetworkEscposPrinterAdapter reports bytesSent with socket mock", async () => {
  let socket: FakeNetworkSocket | undefined;
  const adapter = new NetworkEscposPrinterAdapter(() => {
    socket = new FakeNetworkSocket();
    return socket;
  });

  const result = await adapter.printTest({
    agentName: "manus-pos-peripheral-agent",
    mode: "REAL",
    terminalId: "local-terminal",
    device: networkPrinter,
    profile: DEVICE_PROFILES.THERMAL_80MM,
    jobId: "real-print-job-test",
    timestamp: "2026-06-04T00:00:00.000Z",
  });

  assert.ok(socket);
  assert.ok(socket.written);
  assert.equal(result.adapterName, "NetworkEscposPrinterAdapter");
  assert.equal(result.capabilities.mode, "REAL");
  assert.equal(result.bytesSent, socket.written.length);
  assert.equal(socket.connectedTo?.host, "192.168.1.50");
  assert.equal(socket.connectedTo?.port, 9100);
  assert.equal(socket.timeoutMs, 3000);
  assert.equal(socket.ended, true);
});

test("network printer service response exposes host port bytes and cut capability", async () => {
  const previous = process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS;
  process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS = "true";

  try {
    const logsService = new LogsService();
    const eventsService = new EventsService();
    const devicesService = new DevicesService(
      logsService,
      eventsService,
      undefined,
      createMemoryDeviceRegistryStore(),
      testPlatformPaths
    );
    const printerService = new PrinterService(
      devicesService,
      logsService,
      eventsService
    );

    (printerService as unknown as {
      adapterResolver: {
        resolveProfile: (device: PeripheralDevice) => typeof DEVICE_PROFILES.THERMAL_80MM;
        resolvePrinter: () => {
          adapterName: string;
          mode: "REAL";
          printTest: (input: {
            agentName: string;
            mode: "REAL";
            terminalId: string;
            device: PeripheralDevice;
            profile: typeof DEVICE_PROFILES.THERMAL_80MM;
            jobId: string;
            timestamp: string;
          }) => Promise<{
            adapterName: string;
            profile: typeof DEVICE_PROFILES.THERMAL_80MM;
            capabilities: {
              adapterName: string;
              mode: "REAL";
              connectionType: ConnectionType.NETWORK;
              supportsCut: true;
              supportsPhysicalCut: true;
              supportsCashDrawerPulse: false;
            };
            preview: string;
            commands: [];
            bytesSent: number;
          }>;
        };
      };
    }).adapterResolver = {
      resolveProfile: () => DEVICE_PROFILES.THERMAL_80MM,
      resolvePrinter: () => ({
        adapterName: "NetworkEscposPrinterAdapter",
        mode: "REAL" as const,
        printTest: async () => ({
          adapterName: "NetworkEscposPrinterAdapter",
          profile: DEVICE_PROFILES.THERMAL_80MM,
          capabilities: {
            adapterName: "NetworkEscposPrinterAdapter",
            mode: "REAL" as const,
            connectionType: ConnectionType.NETWORK,
            supportsCut: true,
            supportsPhysicalCut: true,
            supportsCashDrawerPulse: false,
          },
          preview: "LAN TEST",
          commands: [],
          bytesSent: 123,
        }),
      }),
    };

    devicesService.create({
      ...networkPrinter,
    });

    const result = await printerService.testPrint({
      terminalId: "local-terminal",
      deviceId: networkPrinter.id,
    });

    assert.equal(result.adapterName, "NetworkEscposPrinterAdapter");
    assert.equal(result.mode, "REAL");
    assert.deepEqual(result.network, {
      host: "192.168.1.50",
      port: 9100,
      timeoutMs: 3000,
    });
    assert.equal(result.capabilities.connectionType, ConnectionType.NETWORK);
    assert.equal(result.capabilities.supportsPhysicalCut, true);
    assert.equal(result.bytesSent, 123);
  } finally {
    if (previous === undefined) {
      delete process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS;
    } else {
      process.env.PERIPHERALS_ENABLE_REAL_ADAPTERS = previous;
    }
  }
});

test("NetworkEscposPrinterAdapter socket error returns controlled error", async () => {
  const adapter = new NetworkEscposPrinterAdapter(
    () => new FakeNetworkSocket(true)
  );

  await assert.rejects(
    async () => {
      await adapter.printTest({
        agentName: "manus-pos-peripheral-agent",
        mode: "REAL",
        terminalId: "local-terminal",
        device: networkPrinter,
        profile: DEVICE_PROFILES.THERMAL_80MM,
        jobId: "real-print-job-failed",
        timestamp: "2026-06-04T00:00:00.000Z",
      });
    },
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.match(
        (error as Error).message,
        /Network ESC\/POS printer socket error: socket refused/
      );
      return true;
    }
  );
});

test("NetworkEscposPrinterAdapter timeout returns controlled error", async () => {
  const adapter = new NetworkEscposPrinterAdapter(() => {
    return new FakeNetworkSocket(false, true);
  });

  await assert.rejects(
    adapter.printTest({
    agentName: "manus-pos-peripheral-agent",
    mode: "REAL",
    terminalId: "local-terminal",
    device: networkPrinter,
    profile: DEVICE_PROFILES.THERMAL_80MM,
    jobId: "real-print-job-timeout",
    timestamp: "2026-08-19T00:00:00.000Z",
    }),
    /Network ESC\/POS printer connection timed out/
  );
});
