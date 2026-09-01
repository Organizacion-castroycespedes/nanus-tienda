"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesService = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../../shared/types/peripheral.types");
const id_util_1 = require("../../shared/utils/id.util");
const device_profiles_1 = require("../../shared/profiles/device-profiles");
const request_validation_util_1 = require("../../shared/utils/request-validation.util");
const network_device_validation_util_1 = require("../../shared/utils/network-device-validation.util");
const system_usb_printer_discovery_1 = require("../../platform/system-usb-printer-discovery");
const platform_paths_1 = require("../../platform/platform-paths");
const device_registry_state_store_1 = require("../../platform/device-registry-state.store");
const events_service_1 = require("../events/events.service");
const logs_service_1 = require("../logs/logs.service");
const peripherals_config_1 = require("../../shared/config/peripherals.config");
const LOCAL_TERMINAL_ID = "local-terminal";
const DEFAULT_DISCOVERED_USB_PRINTER_PROFILE_ID = "THERMAL_80MM";
const MOCK_DEVICES = [
    {
        id: "mock-printer-001",
        type: peripheral_types_1.DeviceType.PRINTER,
        name: "Impresora termica MOCK",
        status: peripheral_types_1.DeviceStatus.CONNECTED,
        connectionType: peripheral_types_1.ConnectionType.MOCK,
        terminalId: LOCAL_TERMINAL_ID,
        profileId: "THERMAL_80MM",
    },
    {
        id: "mock-cashdrawer-001",
        type: peripheral_types_1.DeviceType.CASH_DRAWER,
        name: "Caja registradora MOCK",
        status: peripheral_types_1.DeviceStatus.CONNECTED,
        connectionType: peripheral_types_1.ConnectionType.MOCK,
        terminalId: LOCAL_TERMINAL_ID,
        profileId: "THERMAL_80MM",
    },
    {
        id: "mock-scale-001",
        type: peripheral_types_1.DeviceType.SCALE,
        name: "Balanza electronica MOCK",
        status: peripheral_types_1.DeviceStatus.CONNECTED,
        connectionType: peripheral_types_1.ConnectionType.MOCK,
        terminalId: LOCAL_TERMINAL_ID,
    },
    {
        id: "mock-scanner-001",
        type: peripheral_types_1.DeviceType.SCANNER,
        name: "Scanner QR/Barras MOCK",
        status: peripheral_types_1.DeviceStatus.CONNECTED,
        connectionType: peripheral_types_1.ConnectionType.MOCK,
        terminalId: LOCAL_TERMINAL_ID,
    },
];
let DevicesService = class DevicesService {
    logsService;
    eventsService;
    usbDiscovery;
    seedDevices = MOCK_DEVICES.map((device) => ({ ...device }));
    configuredDevices = new Map();
    discoveredUsbDevices = new Map();
    runtimeStatuses = new Map();
    usbDevices = new Map();
    registryPersistenceState = "empty";
    platformPaths;
    deviceRegistryStore;
    constructor(logsService, eventsService, usbDiscovery = new system_usb_printer_discovery_1.SystemUsbPrinterDiscovery(), deviceRegistryStore = new device_registry_state_store_1.FileDeviceRegistryStateStore(), platformPaths = (0, platform_paths_1.resolvePlatformPaths)()) {
        this.logsService = logsService;
        this.eventsService = eventsService;
        this.usbDiscovery = usbDiscovery;
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
    discoverOnStartup() {
        if (!(0, peripherals_config_1.getPeripheralsConfig)().realAdaptersEnabled) {
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
                    usbPrinterCount: discovery.devices.filter((device) => device.connectionType === peripheral_types_1.ConnectionType.USB).length,
                },
            });
        }
        catch (error) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
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
    list() {
        return Array.from(this.buildMergedDevices().values()).map((device) => this.cloneDevice(device));
    }
    discover() {
        const discoveredAt = new Date().toISOString();
        this.logsService.append({
            source: "devices",
            event: "devices.discover.simulated",
            message: "Device discovery simulated",
            metadata: {
                configuredDevices: this.configuredDevices.size,
            },
        });
        this.logsService.append({
            source: "devices",
            event: "discovery.started",
            message: "Device discovery started",
            metadata: {
                configuredDevices: this.configuredDevices.size,
            },
        });
        let usbDescriptors = [];
        try {
            usbDescriptors = this.usbDiscovery.list();
        }
        catch (error) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "devices",
                event: "devices.discover.usb_failed",
                message: "USB printer discovery failed; keeping mock device list",
                metadata: {
                    errorMessage: error instanceof Error ? error.message : "unknown error",
                },
            });
        }
        this.usbDevices = new Map(usbDescriptors.map((descriptor) => [descriptor.deviceId, descriptor]));
        const nextDiscoveredUsbDevices = new Map();
        const matchedConfiguredIds = new Set();
        for (const descriptor of usbDescriptors) {
            const configuredMatch = this.findConfiguredUsbDeviceByUsbDeviceId(descriptor.deviceId);
            const runtimeId = configuredMatch?.id ?? descriptor.id;
            const discoveredDevice = this.buildDiscoveredUsbDevice(descriptor, runtimeId);
            nextDiscoveredUsbDevices.set(runtimeId, discoveredDevice);
            matchedConfiguredIds.add(runtimeId);
            this.runtimeStatuses.set(runtimeId, peripheral_types_1.DeviceStatus.CONNECTED);
        }
        for (const device of this.configuredDevices.values()) {
            if (device.connectionType === peripheral_types_1.ConnectionType.USB &&
                !matchedConfiguredIds.has(device.id)) {
                this.runtimeStatuses.set(device.id, peripheral_types_1.DeviceStatus.DISCONNECTED);
            }
        }
        this.discoveredUsbDevices = nextDiscoveredUsbDevices;
        const devices = this.list();
        this.logsService.append({
            source: "devices",
            event: "discovery.completed",
            message: "Device discovery completed",
            metadata: {
                count: devices.length,
                configuredDevices: this.configuredDevices.size,
                usbPrinterCount: nextDiscoveredUsbDevices.size,
                mode: nextDiscoveredUsbDevices.size > 0 ? "HYBRID" : "MOCK",
            },
        });
        for (const device of devices) {
            if (device.status !== peripheral_types_1.DeviceStatus.CONNECTED) {
                continue;
            }
            this.eventsService.emit(peripheral_types_1.PeripheralEventName.DeviceConnected, {
                terminalId: device.terminalId,
                deviceId: device.id,
                deviceType: device.type,
                timestamp: discoveredAt,
            });
        }
        return {
            success: true,
            mode: "MOCK",
            devices,
            discoveredAt,
        };
    }
    setRuntimeStatus(deviceId, status) {
        const safeDeviceId = (0, request_validation_util_1.validateIdentifier)(deviceId, "deviceId");
        if (!this.buildMergedDevices().has(safeDeviceId)) {
            return;
        }
        this.runtimeStatuses.set(safeDeviceId, status);
    }
    getHealthSnapshot() {
        return {
            configuredDevices: this.configuredDevices.size,
            discoveredDevices: this.discoveredUsbDevices.size,
            persistenceState: this.registryPersistenceState,
            schemaVersion: 1,
        };
    }
    getRuntimeDeviceCounts() {
        return {
            configured: this.configuredDevices.size,
            discovered: this.discoveredUsbDevices.size,
        };
    }
    create(request) {
        const record = this.safeRecord(request, "device payload");
        const type = (0, request_validation_util_1.parseDeviceType)(record.type);
        const id = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "id", (0, id_util_1.createId)("mock-device")), "id");
        const terminalId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "terminalId", LOCAL_TERMINAL_ID), "terminalId");
        const connectionType = (0, request_validation_util_1.parseConnectionType)(record.connectionType, peripheral_types_1.ConnectionType.MOCK);
        const name = (0, request_validation_util_1.validateShortText)((0, request_validation_util_1.optionalString)(record, "name", `${type} ${connectionType}`), "name");
        const status = (0, request_validation_util_1.parseDeviceStatus)(record.status, peripheral_types_1.DeviceStatus.CONNECTED);
        const metadata = (0, request_validation_util_1.optionalMetadata)(record) ?? {};
        const profileId = this.resolveProfileId(record.profileId, type);
        const network = (0, network_device_validation_util_1.resolveNetworkOptionsForConnection)(record.network, connectionType);
        const usb = this.resolveUsbOptions(record.usb, connectionType, type);
        if (this.buildMergedDevices().has(id)) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "devices",
                event: "device.register.rejected",
                message: "Mock device registration rejected because id already exists",
                metadata: { deviceId: id },
            });
            throw new common_1.BadRequestException("device id already exists");
        }
        const device = {
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
        this.eventsService.emit(peripheral_types_1.PeripheralEventName.DeviceConnected, {
            terminalId: device.terminalId,
            deviceId: device.id,
            deviceType: device.type,
            timestamp: new Date().toISOString(),
        });
        return this.cloneDevice(device);
    }
    update(id, request) {
        const deviceId = (0, request_validation_util_1.validateIdentifier)(id, "id");
        const record = this.safeRecord(request, "device update payload");
        const current = this.buildMergedDevices().get(deviceId);
        if (!current) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "devices",
                event: "device.update.rejected",
                message: "Mock device update rejected because device was not found",
                metadata: { deviceId },
            });
            throw new common_1.NotFoundException("device not found");
        }
        const status = (0, request_validation_util_1.parseDeviceStatus)(record.status, current.status);
        const connectionType = (0, request_validation_util_1.parseConnectionType)(record.connectionType, current.connectionType);
        const name = (0, request_validation_util_1.validateShortText)((0, request_validation_util_1.optionalString)(record, "name", current.name), "name");
        const terminalId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "terminalId", current.terminalId), "terminalId");
        const profileId = this.resolveProfileId(record.profileId, current.type, current.profileId);
        const network = (0, network_device_validation_util_1.resolveNetworkOptionsForConnection)(record.network, connectionType, current.network);
        const usb = this.resolveUsbOptions(record.usb, connectionType, current.type, current.usb);
        const updated = {
            ...current,
            name,
            status,
            terminalId,
            connectionType,
            profileId,
            network,
            usb,
            metadata: (0, request_validation_util_1.optionalMetadata)(record) ?? current.metadata,
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
        if (updated.status === peripheral_types_1.DeviceStatus.CONNECTED) {
            this.eventsService.emit(peripheral_types_1.PeripheralEventName.DeviceConnected, {
                terminalId: updated.terminalId,
                deviceId: updated.id,
                deviceType: updated.type,
                timestamp: new Date().toISOString(),
            });
        }
        if (updated.status === peripheral_types_1.DeviceStatus.DISCONNECTED) {
            this.eventsService.emit(peripheral_types_1.PeripheralEventName.DeviceDisconnected, {
                terminalId: updated.terminalId,
                deviceId: updated.id,
                deviceType: updated.type,
                timestamp: new Date().toISOString(),
            });
        }
        if (updated.status === peripheral_types_1.DeviceStatus.ERROR) {
            this.eventsService.emit(peripheral_types_1.PeripheralEventName.DeviceError, {
                terminalId: updated.terminalId,
                deviceId: updated.id,
                deviceType: updated.type,
                timestamp: new Date().toISOString(),
            });
        }
        return this.cloneDevice(updated);
    }
    findRequired(deviceId, expectedType) {
        const safeDeviceId = (0, request_validation_util_1.validateIdentifier)(deviceId, "deviceId");
        const device = this.buildMergedDevices().get(safeDeviceId);
        if (!device) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "devices",
                event: "device.lookup.not_found",
                message: "Device lookup failed because device was not found",
                metadata: { deviceId: safeDeviceId, expectedType },
            });
            throw new common_1.NotFoundException("device not found");
        }
        if (device.type !== expectedType) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "devices",
                event: "device.lookup.type_mismatch",
                message: "Device lookup failed because device type did not match endpoint",
                metadata: {
                    deviceId: device.id,
                    actualType: device.type,
                    expectedType,
                },
            });
            throw new common_1.BadRequestException(`device must be ${expectedType}`);
        }
        if (device.connectionType !== peripheral_types_1.ConnectionType.NETWORK &&
            device.status !== peripheral_types_1.DeviceStatus.CONNECTED) {
            const level = device.status === peripheral_types_1.DeviceStatus.ERROR ? peripheral_types_1.LogLevel.ERROR : peripheral_types_1.LogLevel.WARN;
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
            if (device.status === peripheral_types_1.DeviceStatus.ERROR) {
                this.eventsService.emit(peripheral_types_1.PeripheralEventName.DeviceError, {
                    terminalId: device.terminalId,
                    deviceId: device.id,
                    deviceType: device.type,
                    timestamp: new Date().toISOString(),
                });
            }
            throw new common_1.BadRequestException("device is not connected");
        }
        return this.cloneDevice(device);
    }
    findById(deviceId) {
        const safeDeviceId = (0, request_validation_util_1.validateIdentifier)(deviceId, "deviceId");
        const device = this.buildMergedDevices().get(safeDeviceId);
        return device ? this.cloneDevice(device) : undefined;
    }
    assertUsbPrinterAvailable(device) {
        if (device.connectionType !== peripheral_types_1.ConnectionType.USB) {
            return;
        }
        const usbDeviceId = device.usb?.deviceId;
        if (!usbDeviceId) {
            throw new common_1.BadRequestException("USB printer deviceId is required");
        }
        const available = this.usbDiscovery
            .list()
            .some((descriptor) => descriptor.deviceId === usbDeviceId);
        if (!available) {
            throw new common_1.NotFoundException("USB printer device not found");
        }
    }
    safeRecord(value, context) {
        try {
            return (0, request_validation_util_1.asRecord)(value, context);
        }
        catch (error) {
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
                source: "devices",
                event: "device.payload.invalid",
                message: "Device payload rejected by validation",
                metadata: { context },
            });
            throw error;
        }
    }
    loadConfiguredDevices() {
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
            const configuredDevices = new Map();
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
        }
        catch (error) {
            this.registryPersistenceState = "corrupt";
            this.logsService.append({
                level: peripheral_types_1.LogLevel.WARN,
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
    persistConfiguredDevices(nextConfiguredDevices) {
        this.deviceRegistryStore.write(this.platformPaths, {
            schemaVersion: 1,
            devices: Array.from(nextConfiguredDevices.values()).map((device) => this.serializeConfiguredDevice(device)),
        });
    }
    serializeConfiguredDevice(device) {
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
    restoreConfiguredDevice(device) {
        return {
            ...device,
            status: this.defaultRuntimeStatus(device.connectionType),
            network: device.network ? { ...device.network } : undefined,
            usb: device.usb ? { ...device.usb } : undefined,
            metadata: device.metadata ? { ...device.metadata } : undefined,
        };
    }
    defaultRuntimeStatus(connectionType) {
        if (connectionType === peripheral_types_1.ConnectionType.MOCK) {
            return peripheral_types_1.DeviceStatus.CONNECTED;
        }
        if (connectionType === peripheral_types_1.ConnectionType.NETWORK) {
            return peripheral_types_1.DeviceStatus.NOT_REACHABLE;
        }
        return peripheral_types_1.DeviceStatus.DISCONNECTED;
    }
    applyRuntimeStatus(device) {
        const status = this.runtimeStatuses.get(device.id) ??
            this.defaultRuntimeStatus(device.connectionType);
        return {
            ...device,
            status,
        };
    }
    buildMergedDevices() {
        const merged = new Map();
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
            merged.set(current.id, this.mergeDiscoveredUsbDevice(current, discoveredDevice));
        }
        return merged;
    }
    mergeDiscoveredUsbDevice(current, discovered) {
        return {
            ...current,
            status: peripheral_types_1.DeviceStatus.CONNECTED,
            connectionType: peripheral_types_1.ConnectionType.USB,
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
    findConfiguredUsbDeviceByUsbDeviceId(usbDeviceId) {
        for (const device of this.configuredDevices.values()) {
            if (device.connectionType === peripheral_types_1.ConnectionType.USB &&
                device.usb?.deviceId === usbDeviceId) {
                return device;
            }
        }
        for (const device of this.seedDevices) {
            if (device.connectionType === peripheral_types_1.ConnectionType.USB &&
                device.usb?.deviceId === usbDeviceId) {
                return device;
            }
        }
        return undefined;
    }
    buildDiscoveredUsbDevice(descriptor, runtimeId = descriptor.id) {
        return {
            id: runtimeId,
            type: peripheral_types_1.DeviceType.PRINTER,
            name: descriptor.name,
            status: peripheral_types_1.DeviceStatus.CONNECTED,
            connectionType: peripheral_types_1.ConnectionType.USB,
            terminalId: LOCAL_TERMINAL_ID,
            profileId: DEFAULT_DISCOVERED_USB_PRINTER_PROFILE_ID,
            usb: {
                deviceId: descriptor.deviceId,
                printerName: descriptor.printerName,
            },
            descriptor: descriptor.descriptor,
            metadata: { discoverySource: "USB_SYSTEM" },
        };
    }
    resolveProfileId(value, deviceType, fallback = (0, device_profiles_1.getDefaultProfileIdForDeviceType)(deviceType)) {
        if (value === undefined || value === null) {
            return fallback;
        }
        if (typeof value !== "string") {
            throw new common_1.BadRequestException("profileId must be a string");
        }
        const profileId = (0, request_validation_util_1.validateIdentifier)(value.trim(), "profileId");
        (0, device_profiles_1.getDeviceProfile)(profileId);
        return profileId;
    }
    resolveUsbOptions(value, connectionType, deviceType, current) {
        if (connectionType !== peripheral_types_1.ConnectionType.USB) {
            if (value !== undefined && value !== null) {
                throw new common_1.BadRequestException("usb is only supported for USB devices");
            }
            return undefined;
        }
        if (deviceType !== peripheral_types_1.DeviceType.PRINTER) {
            throw new common_1.BadRequestException("USB connection is only supported for PRINTER devices");
        }
        if (value === undefined || value === null) {
            if (current) {
                return { ...current };
            }
            throw new common_1.BadRequestException("usb is required for USB printers");
        }
        const record = (0, request_validation_util_1.asRecord)(value, "usb");
        const deviceId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "deviceId", ""), "usb.deviceId");
        const descriptor = this.usbDevices.get(deviceId);
        if (!descriptor) {
            throw new common_1.NotFoundException("USB printer device not found; run discovery and select a discovered device");
        }
        return {
            deviceId: descriptor.deviceId,
            printerName: descriptor.printerName,
        };
    }
    cloneDevice(device) {
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
};
exports.DevicesService = DevicesService;
exports.DevicesService = DevicesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(logs_service_1.LogsService)),
    __param(1, (0, common_1.Inject)(events_service_1.EventsService)),
    __param(2, (0, common_1.Optional)()),
    __param(3, (0, common_1.Optional)()),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [logs_service_1.LogsService,
        events_service_1.EventsService, Object, Object, Object])
], DevicesService);
//# sourceMappingURL=devices.service.js.map