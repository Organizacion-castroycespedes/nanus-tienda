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
  private devices = MOCK_DEVICES.map((device) => ({ ...device }));
  private usbDevices = new Map<string, UsbPrinterDescriptor>();

  constructor(
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(EventsService) private readonly eventsService: EventsService,
    @Optional()
    private readonly usbDiscovery: UsbPrinterDiscovery = new SystemUsbPrinterDiscovery()
  ) {}

  discoverOnStartup(): void {
    if (!getPeripheralsConfig().realAdaptersEnabled) {
      return;
    }

    try {
      const discovery = this.discover();
      this.logsService.append({
        source: "devices",
        event: "devices.discover.startup",
        message: "USB printer discovery completed during agent startup",
        metadata: {
          usbPrinterCount: discovery.devices.filter(
            (device) => device.connectionType === ConnectionType.USB
          ).length,
        },
      });
    } catch (error) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "devices.discover.startup_failed",
        message: "USB printer discovery failed during agent startup",
        metadata: {
          errorMessage: error instanceof Error ? error.message : "unknown error",
        },
      });
    }
  }

  list(): PeripheralDevice[] {
    return this.devices.map((device) => this.cloneDevice(device));
  }

  discover(): DiscoverDevicesResponse {
    const discoveredAt = new Date().toISOString();
    let usbDescriptors: UsbPrinterDescriptor[] = [];
    try {
      usbDescriptors = this.usbDiscovery.list();
    } catch (error) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "devices.discover.usb_failed",
        message: "USB printer discovery failed; keeping mock device list",
        metadata: {
          errorMessage: error instanceof Error ? error.message : "unknown error",
        },
      });
    }
    this.usbDevices = new Map(
      usbDescriptors.map((descriptor) => [descriptor.deviceId, descriptor])
    );
    const systemUsbDevices = usbDescriptors.map((descriptor): PeripheralDevice => ({
      id: descriptor.id,
      type: DeviceType.PRINTER,
      name: descriptor.name,
      status: DeviceStatus.CONNECTED,
      connectionType: ConnectionType.USB,
      terminalId: LOCAL_TERMINAL_ID,
      profileId: "THERMAL_80MM",
      usb: {
        deviceId: descriptor.deviceId,
        printerName: descriptor.printerName,
      },
      descriptor: descriptor.descriptor,
      metadata: { discoverySource: "USB_SYSTEM" },
    }));
    this.devices = [
      ...this.devices.filter(
        (device) => device.metadata?.discoverySource !== "USB_SYSTEM"
      ),
      ...systemUsbDevices,
    ];

    this.logsService.append({
      source: "devices",
      event: "devices.discover.simulated",
      message: "Mock device discovery completed",
      metadata: {
        count: this.devices.length,
        usbPrinterCount: systemUsbDevices.length,
        mode: systemUsbDevices.length > 0 ? "HYBRID" : "MOCK",
      },
    });

    for (const device of this.devices) {
      this.eventsService.emit(PeripheralEventName.DeviceConnected, {
        terminalId: device.terminalId,
        deviceId: device.id,
        deviceType: device.type,
        timestamp: discoveredAt,
      });
    }

    return {
      success: true,
      mode: "MOCK",
      devices: this.list(),
      discoveredAt,
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

    if (this.devices.some((device) => device.id === id)) {
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

    this.devices = [device, ...this.devices];
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
    const index = this.devices.findIndex((device) => device.id === deviceId);
    if (index < 0) {
      this.logsService.append({
        level: LogLevel.WARN,
        source: "devices",
        event: "device.update.rejected",
        message: "Mock device update rejected because device was not found",
        metadata: { deviceId },
      });
      throw new NotFoundException("device not found");
    }

    const current = this.devices[index];
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
    const profileId = this.resolveProfileId(record.profileId, current.type, current.profileId);
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

    this.devices[index] = updated;
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
    const device = this.devices.find((candidate) => candidate.id === safeDeviceId);
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
    if (device.status !== DeviceStatus.CONNECTED) {
      const level = device.status === DeviceStatus.ERROR ? LogLevel.ERROR : LogLevel.WARN;
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
      throw new BadRequestException("USB connection is only supported for PRINTER devices");
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
      throw new NotFoundException("USB printer device not found; run discovery and select a discovered device");
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
