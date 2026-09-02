import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  LogLevel,
  PeripheralEventName,
  type PeripheralDevice,
  type UsbPrinterConnectionOptions,
} from "../../shared/types/peripheral.types";
import { createId } from "../../shared/utils/id.util";
import {
  getDefaultProfileIdForDeviceType,
  getDeviceProfile,
} from "../../shared/profiles/device-profiles";
import {
  asRecord,
  optionalMetadata,
  optionalString,
  parseConnectionType,
  parseDeviceStatus,
  parseDeviceType,
  validateIdentifier,
  validateShortText,
} from "../../shared/utils/request-validation.util";
import { resolveNetworkOptionsForConnection } from "../../shared/utils/network-device-validation.util";
import {
  type UsbPrinterDescriptor,
  type UsbPrinterDiscovery,
} from "../../shared/usb/usb-printer-discovery";
import { SystemUsbPrinterDiscovery } from "../../platform/system-usb-printer-discovery";
import { resolvePlatformPaths } from "../../platform/platform-paths";
import {
  FileDeviceRegistryStateStore,
  type DeviceRegistryStateStore,
  type PersistedPeripheralDevice,
} from "../../platform/device-registry-state.store";
import type { PlatformPaths } from "../../shared/platform/platform-paths";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";
import type {
  CreateMockDeviceRequest,
  DiscoverDevicesResponse,
  UpdateMockDeviceRequest,
} from "./devices.types";

const LOCAL_TERMINAL_ID = "local-terminal";

const MOCK_DEVICES: PeripheralDevice[] = [
  {
    id: "mock-printer-001",
    type: DeviceType.PRINTER,
    name: "Impresora termica MOCK",
    status: DeviceStatus.CONNECTED,
    connectionType: ConnectionType.MOCK,
    terminalId: LOCAL_TERMINAL_ID,
    profileId: "THERMAL_80MM",
  },
  {
    id: "mock-cashdrawer-001",
    type: DeviceType.CASH_DRAWER,
    name: "Caja registradora MOCK",
    status: DeviceStatus.CONNECTED,
    connectionType: ConnectionType.MOCK,
    terminalId: LOCAL_TERMINAL_ID,
    profileId: "THERMAL_80MM",
  },
  {
    id: "mock-scale-001",
    type: DeviceType.SCALE,
    name: "Balanza electronica MOCK",
    status: DeviceStatus.CONNECTED,
    connectionType: ConnectionType.MOCK,
    terminalId: LOCAL_TERMINAL_ID,
  },
  {
    id: "mock-scanner-001",
    type: DeviceType.SCANNER,
    name: "Scanner QR/Barras MOCK",
    status: DeviceStatus.CONNECTED,
    connectionType: ConnectionType.MOCK,
    terminalId: LOCAL_TERMINAL_ID,
  },
];

@Injectable()
export class DevicesService {
  private readonly seedDevices = MOCK_DEVICES.map((device) => ({ ...device }));
  private configuredDevices = new Map<string, PeripheralDevice>();
  private discoveredUsbDevices = new Map<string, PeripheralDevice>();
  private runtimeStatuses = new Map<string, DeviceStatus>();
  private usbDevices = new Map<string, UsbPrinterDescriptor>();
  private registryPersistenceState: "empty" | "loaded" | "corrupt" = "empty";
  private readonly platformPaths: PlatformPaths;
  private readonly deviceRegistryStore: DeviceRegistryStateStore;

  constructor(
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Optional()
    private readonly usbDiscovery: UsbPrinterDiscovery = new SystemUsbPrinterDiscovery(),
    @Optional()
    deviceRegistryStore: DeviceRegistryStateStore = new FileDeviceRegistryStateStore(),
    @Optional()
    platformPaths = resolvePlatformPaths()
  ) {
    this.deviceRegistryStore = deviceRegistryStore;
    this.platformPaths = platformPaths;
    this.logsService.append({
      source: "agent",
      event: "agent.starting",
      message: "Peripheral Agent starting",
      metadata: {
        platform: process.platform,
        architecture: process.arch,
      },
    });
    this.loadConfiguredDevices();
  }

  discoverOnStartup(): void {
    if (!getPeripheralsConfig().realAdaptersEnabled) {
      return;
    }

    try {
      this.logsService.append({
        source: "devices",
        event: "discovery.started",
        message: "Device discovery started during agent startup",
        metadata: {
          configuredDevices: this.configuredDevices.size,
        },
      });
      const discovery = this.discover();
      this.logsService.append({
        source: "devices",
        event: "discovery.completed",
        message: "Device discovery completed during agent startup",
        metadata: {
          configuredDevices: this.configuredDevices.size,
          usbPrinterCount: discovery.devices.filter(
            (device) => device.connectionType === ConnectionType.USB
          ).length,
        },
      });
    } catch (error) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "discovery.completed",
        message: "Device discovery failed during agent startup",
        metadata: {
          configuredDevices: this.configuredDevices.size,
          errorMessage: error instanceof Error ? error.message : "unknown error",
        },
      });
    }
  }

  list(): PeripheralDevice[] {
    return Array.from(this.buildMergedDevices().values()).map((device) =>
      this.cloneDevice(device)
    );
  }

  discover(): DiscoverDevicesResponse {
    const config = getPeripheralsConfig();
    const discoveredAt = new Date().toISOString();
    if (config.mode === "MOCK") {
      this.logsService.append({
        source: "devices",
        event: "devices.discover.simulated",
        message: "Device discovery simulated",
        metadata: {
          configuredDevices: this.configuredDevices.size,
        },
      });
    }
    this.logsService.append({
      source: "devices",
      event: "discovery.started",
      message: "Device discovery started",
      metadata: {
        configuredDevices: this.configuredDevices.size,
      },
    });
    let usbDescriptors: UsbPrinterDescriptor[] = [];

    try {
      usbDescriptors = this.usbDiscovery.list();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "unknown error";
      this.logsService.append({
        level: config.mode === "REAL" ? LogLevel.ERROR : LogLevel.WARN,
        source: "devices",
        event: "devices.discover.usb_failed",
        message: config.mode === "REAL"
          ? "Physical printer discovery failed"
          : "USB printer discovery failed; keeping mock device list",
        metadata: {
          mode: config.mode,
          outcome: "FAILED",
          errorMessage,
        },
      });
      if (config.mode === "REAL") {
        throw new BadRequestException(
          `Physical printer discovery failed: ${errorMessage}`
        );
      }
    }

    this.usbDevices = new Map(
      usbDescriptors.map((descriptor) => [descriptor.deviceId, descriptor])
    );

    const nextDiscoveredUsbDevices = new Map<string, PeripheralDevice>();
    const matchedConfiguredIds = new Set<string>();

    for (const descriptor of usbDescriptors) {
      const configuredMatch = this.findConfiguredUsbDeviceByUsbDeviceId(
        descriptor.deviceId
      );
      const runtimeId = configuredMatch?.id ?? descriptor.id;
      const discoveredDevice = this.buildDiscoveredUsbDevice(
        descriptor,
        runtimeId
      );

      nextDiscoveredUsbDevices.set(runtimeId, discoveredDevice);
      matchedConfiguredIds.add(runtimeId);
      this.runtimeStatuses.set(runtimeId, DeviceStatus.CONNECTED);
    }

    for (const device of this.configuredDevices.values()) {
      if (
        device.connectionType === ConnectionType.USB &&
        !matchedConfiguredIds.has(device.id)
      ) {
        this.runtimeStatuses.set(device.id, DeviceStatus.DISCONNECTED);
      }
    }

    this.discoveredUsbDevices = nextDiscoveredUsbDevices;
    const devices = config.mode === "REAL"
      ? this.list().filter((device) => device.connectionType !== ConnectionType.MOCK)
      : this.list();

    this.logsService.append({
      source: "devices",
      event: "discovery.completed",
      message: nextDiscoveredUsbDevices.size > 0
        ? "Physical printer discovery completed with results"
        : "Physical printer discovery completed without results",
      metadata: {
        count: devices.length,
        configuredDevices: this.configuredDevices.size,
        usbPrinterCount: nextDiscoveredUsbDevices.size,
        mode: config.mode,
        outcome: nextDiscoveredUsbDevices.size > 0 ? "FOUND" : "EMPTY",
      },
    });

    for (const device of devices) {
      if (device.status !== DeviceStatus.CONNECTED) {
        continue;
      }
      this.eventsService.emit(PeripheralEventName.DeviceConnected, {
        terminalId: device.terminalId,
        deviceId: device.id,
        deviceType: device.type,
        timestamp: discoveredAt,
      });
    }

    return {
      success: true,
      mode: config.mode,
      devices,
      discoveredAt,
    };
  }

  setRuntimeStatus(deviceId: string, status: DeviceStatus): void {
    const safeDeviceId = validateIdentifier(deviceId, "deviceId");
    if (!this.buildMergedDevices().has(safeDeviceId)) {
      return;
    }

    this.runtimeStatuses.set(safeDeviceId, status);
  }

  getHealthSnapshot(): {
    configuredDevices: number;
    discoveredDevices: number;
    persistenceState: "empty" | "loaded" | "corrupt";
    schemaVersion: number;
  } {
    return {
      configuredDevices: this.configuredDevices.size,
      discoveredDevices: this.discoveredUsbDevices.size,
      persistenceState: this.registryPersistenceState,
      schemaVersion: 1,
    };
  }

  getRuntimeDeviceCounts(): { configured: number; discovered: number } {
    return {
      configured: this.configuredDevices.size,
      discovered: this.discoveredUsbDevices.size,
    };
  }

  create(request: CreateMockDeviceRequest): PeripheralDevice {
    const record = this.safeRecord(request, "device payload");
    const type = parseDeviceType(record.type);
    const id = validateIdentifier(
      optionalString(record, "id", createId("mock-device")),
      "id"
    );
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", LOCAL_TERMINAL_ID),
      "terminalId"
    );
    const connectionType = parseConnectionType(
      record.connectionType,
      ConnectionType.MOCK
    );
    const name = validateShortText(
      optionalString(record, "name", `${type} ${connectionType}`),
      "name"
    );
    const status = parseDeviceStatus(record.status, DeviceStatus.CONNECTED);
    const metadata = optionalMetadata(record) ?? {};
    const profileId = this.resolveProfileId(record.profileId, type);
    const network = resolveNetworkOptionsForConnection(
      record.network,
      connectionType
    );
    const usb = this.resolveUsbOptions(record.usb, connectionType, type);

    if (this.buildMergedDevices().has(id)) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "device.register.rejected",
        message: "Mock device registration rejected because id already exists",
        metadata: { deviceId: id },
      });
      throw new BadRequestException("device id already exists");
    }

    const device: PeripheralDevice = {
      id,
      type,
      name,
      status,
      connectionType,
      terminalId,
      profileId,
      network,
      usb,
      metadata,
    };

    const nextConfiguredDevices = new Map(this.configuredDevices);
    nextConfiguredDevices.set(id, this.cloneDevice(device));
    this.persistConfiguredDevices(nextConfiguredDevices);
    this.configuredDevices = nextConfiguredDevices;
    this.runtimeStatuses.set(id, status);

    this.logsService.append({
      source: "devices",
      event: "device.registered.simulated",
      message: "Mock device registered",
      metadata: {
        deviceId: device.id,
        deviceType: device.type,
        terminalId: device.terminalId,
        profileId: device.profileId,
        connectionType: device.connectionType,
        networkHost: device.network?.host,
        networkPort: device.network?.port,
      },
    });
    this.eventsService.emit(PeripheralEventName.DeviceConnected, {
      terminalId: device.terminalId,
      deviceId: device.id,
      deviceType: device.type,
      timestamp: new Date().toISOString(),
    });

    return this.cloneDevice(device);
  }

  update(id: string, request: UpdateMockDeviceRequest): PeripheralDevice {
    const deviceId = validateIdentifier(id, "id");
    const record = this.safeRecord(request, "device update payload");
    const current = this.buildMergedDevices().get(deviceId);
    if (!current) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "device.update.rejected",
        message: "Mock device update rejected because device was not found",
        metadata: { deviceId },
      });
      throw new NotFoundException("device not found");
    }

    const status = parseDeviceStatus(record.status, current.status);
    const connectionType = parseConnectionType(
      record.connectionType,
      current.connectionType
    );
    const name = validateShortText(
      optionalString(record, "name", current.name),
      "name"
    );
    const terminalId = validateIdentifier(
      optionalString(record, "terminalId", current.terminalId),
      "terminalId"
    );
    const profileId = this.resolveProfileId(
      record.profileId,
      current.type,
      current.profileId
    );
    const network = resolveNetworkOptionsForConnection(
      record.network,
      connectionType,
      current.network
    );
    const usb = this.resolveUsbOptions(
      record.usb,
      connectionType,
      current.type,
      current.usb
    );
    const updated: PeripheralDevice = {
      ...current,
      name,
      status,
      terminalId,
      connectionType,
      profileId,
      network,
      usb,
      metadata: optionalMetadata(record) ?? current.metadata,
    };

    const nextConfiguredDevices = new Map(this.configuredDevices);
    nextConfiguredDevices.set(deviceId, this.cloneDevice(updated));
    this.persistConfiguredDevices(nextConfiguredDevices);
    this.configuredDevices = nextConfiguredDevices;
    this.runtimeStatuses.set(updated.id, updated.status);

    this.logsService.append({
      source: "devices",
      event: "device.updated.simulated",
      message: "Mock device updated",
      metadata: {
        deviceId: updated.id,
        status: updated.status,
        profileId: updated.profileId,
        connectionType: updated.connectionType,
        networkHost: updated.network?.host,
        networkPort: updated.network?.port,
      },
    });

    if (updated.status === DeviceStatus.CONNECTED) {
      this.eventsService.emit(PeripheralEventName.DeviceConnected, {
        terminalId: updated.terminalId,
        deviceId: updated.id,
        deviceType: updated.type,
        timestamp: new Date().toISOString(),
      });
    }

    if (updated.status === DeviceStatus.DISCONNECTED) {
      this.eventsService.emit(PeripheralEventName.DeviceDisconnected, {
        terminalId: updated.terminalId,
        deviceId: updated.id,
        deviceType: updated.type,
        timestamp: new Date().toISOString(),
      });
    }

    if (updated.status === DeviceStatus.ERROR) {
      this.eventsService.emit(PeripheralEventName.DeviceError, {
        terminalId: updated.terminalId,
        deviceId: updated.id,
        deviceType: updated.type,
        timestamp: new Date().toISOString(),
      });
    }

    return this.cloneDevice(updated);
  }

  findRequired(deviceId: string, expectedType: DeviceType): PeripheralDevice {
    const safeDeviceId = validateIdentifier(deviceId, "deviceId");
    const device = this.buildMergedDevices().get(safeDeviceId);
    if (!device) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "device.lookup.not_found",
        message: "Device lookup failed because device was not found",
        metadata: { deviceId: safeDeviceId, expectedType },
      });
      throw new NotFoundException("device not found");
    }
    if (device.type !== expectedType) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "device.lookup.type_mismatch",
        message: "Device lookup failed because device type did not match endpoint",
        metadata: {
          deviceId: device.id,
          actualType: device.type,
          expectedType,
        },
      });
      throw new BadRequestException(`device must be ${expectedType}`);
    }
    if (
      device.connectionType !== ConnectionType.NETWORK &&
      device.status !== DeviceStatus.CONNECTED
    ) {
      const level =
        device.status === DeviceStatus.ERROR ? LogLevel.ERROR : LogLevel.WARN;
      this.logsService.append({
        level,
        source: "devices",
        event: "device.lookup.not_operational",
        message: "Device lookup failed because device is not connected",
        metadata: {
          deviceId: device.id,
          deviceType: device.type,
          status: device.status,
        },
      });
      if (device.status === DeviceStatus.ERROR) {
        this.eventsService.emit(PeripheralEventName.DeviceError, {
          terminalId: device.terminalId,
          deviceId: device.id,
          deviceType: device.type,
          timestamp: new Date().toISOString(),
        });
      }
      throw new BadRequestException("device is not connected");
    }

    return this.cloneDevice(device);
  }

  findById(deviceId: string): PeripheralDevice | undefined {
    const safeDeviceId = validateIdentifier(deviceId, "deviceId");
    const device = this.buildMergedDevices().get(safeDeviceId);
    return device ? this.cloneDevice(device) : undefined;
  }

  assertUsbPrinterAvailable(device: PeripheralDevice): void {
    if (device.connectionType !== ConnectionType.USB) {
      return;
    }

    const usbDeviceId = device.usb?.deviceId;
    if (!usbDeviceId) {
      throw new BadRequestException("USB printer deviceId is required");
    }

    const available = this.usbDiscovery
      .list()
      .some((descriptor) => descriptor.deviceId === usbDeviceId);
    if (!available) {
      throw new NotFoundException("USB printer device not found");
    }
  }

  private safeRecord(value: unknown, context: string) {
    try {
      return asRecord(value, context);
    } catch (error) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "device.payload.invalid",
        message: "Device payload rejected by validation",
        metadata: { context },
      });
      throw error;
    }
  }

  private loadConfiguredDevices(): void {
    try {
      const state = this.deviceRegistryStore.read(this.platformPaths);
      if (!state) {
        this.registryPersistenceState = "empty";
        this.logsService.append({
          source: "devices",
          event: "registry.restore.success",
          message: "Device registry state loaded as empty",
          metadata: {
            configuredDevices: 0,
            schemaVersion: 1,
          },
        });
        return;
      }

      const configuredDevices = new Map<string, PeripheralDevice>();
      for (const device of state.devices) {
        configuredDevices.set(device.id, this.restoreConfiguredDevice(device));
      }

      this.configuredDevices = configuredDevices;
      this.registryPersistenceState = "loaded";
      this.logsService.append({
        source: "devices",
        event: "registry.restore.success",
        message: "Device registry state restored",
        metadata: {
          configuredDevices: configuredDevices.size,
          schemaVersion: state.schemaVersion,
        },
      });
    } catch (error) {
      this.registryPersistenceState = "corrupt";
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "registry.restore.failure",
        message: "Device registry state could not be loaded; starting with defaults",
        metadata: {
          errorMessage: error instanceof Error ? error.message : "unknown error",
        },
      });
      this.configuredDevices = new Map();
    }
  }

  private persistConfiguredDevices(
    nextConfiguredDevices: Map<string, PeripheralDevice>
  ): void {
    this.deviceRegistryStore.write(this.platformPaths, {
      schemaVersion: 1,
      devices: Array.from(nextConfiguredDevices.values()).map((device) =>
        this.serializeConfiguredDevice(device)
      ),
    });
  }

  private serializeConfiguredDevice(
    device: PeripheralDevice
  ): PersistedPeripheralDevice {
    return {
      id: device.id,
      type: device.type,
      name: device.name,
      connectionType: device.connectionType,
      terminalId: device.terminalId,
      profileId: device.profileId,
      network: device.network ? { ...device.network } : undefined,
      usb: device.usb ? { ...device.usb } : undefined,
      metadata: device.metadata ? { ...device.metadata } : undefined,
    };
  }

  private restoreConfiguredDevice(
    device: PersistedPeripheralDevice
  ): PeripheralDevice {
    return {
      ...device,
      status: this.defaultRuntimeStatus(device.connectionType),
      network: device.network ? { ...device.network } : undefined,
      usb: device.usb ? { ...device.usb } : undefined,
      metadata: device.metadata ? { ...device.metadata } : undefined,
    };
  }

  private defaultRuntimeStatus(connectionType: ConnectionType): DeviceStatus {
    if (connectionType === ConnectionType.MOCK) {
      return DeviceStatus.CONNECTED;
    }
    if (connectionType === ConnectionType.NETWORK) {
      return DeviceStatus.NOT_REACHABLE;
    }
    return DeviceStatus.DISCONNECTED;
  }

  private applyRuntimeStatus(device: PeripheralDevice): PeripheralDevice {
    const status =
      this.runtimeStatuses.get(device.id) ??
      this.defaultRuntimeStatus(device.connectionType);

    return {
      ...device,
      status,
    };
  }

  private buildMergedDevices(): Map<string, PeripheralDevice> {
    const merged = new Map<string, PeripheralDevice>();

    for (const device of this.seedDevices) {
      merged.set(device.id, this.applyRuntimeStatus(device));
    }

    for (const device of this.configuredDevices.values()) {
      merged.set(device.id, this.applyRuntimeStatus(device));
    }

    for (const discoveredDevice of this.discoveredUsbDevices.values()) {
      const current = merged.get(discoveredDevice.id);
      if (!current) {
        merged.set(discoveredDevice.id, this.cloneDevice(discoveredDevice));
        continue;
      }

      merged.set(
        current.id,
        this.mergeDiscoveredUsbDevice(current, discoveredDevice)
      );
    }

    return merged;
  }

  private mergeDiscoveredUsbDevice(
    current: PeripheralDevice,
    discovered: PeripheralDevice
  ): PeripheralDevice {
    return {
      ...current,
      status: DeviceStatus.CONNECTED,
      connectionType: ConnectionType.USB,
      usb: discovered.usb ? { ...discovered.usb } : current.usb,
      descriptor: discovered.descriptor
        ? {
            ...discovered.descriptor,
            fingerprint: discovered.descriptor.fingerprint
              ? {
                  ...discovered.descriptor.fingerprint,
                  values: discovered.descriptor.fingerprint.values
                    ? { ...discovered.descriptor.fingerprint.values }
                    : undefined,
                }
              : discovered.descriptor.fingerprint,
          }
        : current.descriptor,
      metadata: {
        ...(current.metadata ?? {}),
        ...(discovered.metadata ?? {}),
        discoverySource: "USB_SYSTEM",
      },
    };
  }

  private findConfiguredUsbDeviceByUsbDeviceId(
    usbDeviceId: string
  ): PeripheralDevice | undefined {
    for (const device of this.configuredDevices.values()) {
      if (
        device.connectionType === ConnectionType.USB &&
        device.usb?.deviceId === usbDeviceId
      ) {
        return device;
      }
    }

    for (const device of this.seedDevices) {
      if (
        device.connectionType === ConnectionType.USB &&
        device.usb?.deviceId === usbDeviceId
      ) {
        return device;
      }
    }

    return undefined;
  }

  private buildDiscoveredUsbDevice(
    descriptor: UsbPrinterDescriptor,
    runtimeId = descriptor.id
  ): PeripheralDevice {
    return {
      id: runtimeId,
      type: DeviceType.PRINTER,
      name: descriptor.name,
      status: DeviceStatus.CONNECTED,
      connectionType: ConnectionType.USB,
      terminalId: LOCAL_TERMINAL_ID,
      // Discovery is hardware inventory only. Profile is selected during
      // terminal configuration and persisted by update().
      usb: {
        deviceId: descriptor.deviceId,
        printerName: descriptor.printerName,
      },
      descriptor: descriptor.descriptor,
      metadata: { discoverySource: "USB_SYSTEM" },
    };
  }

  private resolveProfileId(
    value: unknown,
    deviceType: DeviceType,
    fallback: string | undefined = getDefaultProfileIdForDeviceType(deviceType)
  ): string | undefined {
    if (value === undefined || value === null) {
      return fallback;
    }
    if (typeof value !== "string") {
      throw new BadRequestException("profileId must be a string");
    }

    const profileId = validateIdentifier(value.trim(), "profileId");
    getDeviceProfile(profileId);
    return profileId;
  }

  private resolveUsbOptions(
    value: unknown,
    connectionType: ConnectionType,
    deviceType: DeviceType,
    current?: UsbPrinterConnectionOptions
  ): UsbPrinterConnectionOptions | undefined {
    if (connectionType !== ConnectionType.USB) {
      if (value !== undefined && value !== null) {
        throw new BadRequestException("usb is only supported for USB devices");
      }
      return undefined;
    }
    if (deviceType !== DeviceType.PRINTER) {
      throw new BadRequestException(
        "USB connection is only supported for PRINTER devices"
      );
    }
    if (value === undefined || value === null) {
      if (current) {
        return { ...current };
      }
      throw new BadRequestException("usb is required for USB printers");
    }

    const record = asRecord(value, "usb");
    const deviceId = validateIdentifier(
      optionalString(record, "deviceId", ""),
      "usb.deviceId"
    );
    const descriptor = this.usbDevices.get(deviceId);
    if (!descriptor) {
      throw new NotFoundException(
        "USB printer device not found; run discovery and select a discovered device"
      );
    }

    return {
      deviceId: descriptor.deviceId,
      printerName: descriptor.printerName,
    };
  }

  private cloneDevice(device: PeripheralDevice): PeripheralDevice {
    return {
      ...device,
      network: device.network ? { ...device.network } : undefined,
      usb: device.usb ? { ...device.usb } : undefined,
      descriptor: device.descriptor
        ? {
            ...device.descriptor,
            fingerprint: {
              ...device.descriptor.fingerprint,
              values: device.descriptor.fingerprint.values
                ? { ...device.descriptor.fingerprint.values }
                : undefined,
            },
          }
        : undefined,
      metadata: device.metadata ? { ...device.metadata } : undefined,
    };
  }
}
