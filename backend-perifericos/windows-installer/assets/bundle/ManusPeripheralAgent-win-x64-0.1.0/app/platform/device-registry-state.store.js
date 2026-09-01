"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileDeviceRegistryStateStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const request_validation_util_1 = require("../shared/utils/request-validation.util");
const peripheral_types_1 = require("../shared/types/peripheral.types");
const network_device_validation_util_1 = require("../shared/utils/network-device-validation.util");
const DEVICE_REGISTRY_FILE = "device-registry.state.json";
const DEVICE_REGISTRY_SCHEMA_VERSION = 1;
class FileDeviceRegistryStateStore {
    read(paths) {
        const filePath = (0, node_path_1.join)(paths.stateDir, DEVICE_REGISTRY_FILE);
        if (!(0, node_fs_1.existsSync)(filePath)) {
            return null;
        }
        let parsed;
        try {
            parsed = JSON.parse((0, node_fs_1.readFileSync)(filePath, "utf8"));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "unknown parse error";
            throw new Error(`Unable to read Peripheral Agent device registry state: ${message}`);
        }
        return this.normalizeState(parsed);
    }
    write(paths, state) {
        (0, node_fs_1.mkdirSync)(paths.stateDir, { recursive: true });
        const filePath = (0, node_path_1.join)(paths.stateDir, DEVICE_REGISTRY_FILE);
        const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
        const payload = `${JSON.stringify(state, null, 2)}\n`;
        try {
            (0, node_fs_1.writeFileSync)(tempPath, payload, { encoding: "utf8", mode: 0o600 });
            try {
                (0, node_fs_1.renameSync)(tempPath, filePath);
            }
            catch (error) {
                (0, node_fs_1.unlinkSync)(filePath);
                (0, node_fs_1.renameSync)(tempPath, filePath);
            }
        }
        catch (error) {
            try {
                if ((0, node_fs_1.existsSync)(tempPath)) {
                    (0, node_fs_1.unlinkSync)(tempPath);
                }
            }
            catch {
            }
            throw error;
        }
    }
    normalizeState(value) {
        const record = (0, request_validation_util_1.asRecord)(value, "device registry state");
        const schemaVersion = record.schemaVersion;
        if (schemaVersion !== DEVICE_REGISTRY_SCHEMA_VERSION) {
            throw new Error(`Unsupported Peripheral Agent device registry schema version: ${String(schemaVersion)}`);
        }
        const devices = record.devices;
        if (!Array.isArray(devices)) {
            throw new Error("Peripheral Agent device registry devices must be an array");
        }
        const normalizedDevices = devices.map((device, index) => this.normalizeDevice(device, index));
        return {
            schemaVersion: DEVICE_REGISTRY_SCHEMA_VERSION,
            devices: normalizedDevices,
        };
    }
    normalizeDevice(value, index) {
        const record = (0, request_validation_util_1.asRecord)(value, `device registry state devices[${index}]`);
        const type = (0, request_validation_util_1.parseDeviceType)(record.type);
        const id = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "id", ""), "id");
        const terminalId = (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "terminalId", ""), "terminalId");
        const connectionType = (0, request_validation_util_1.parseConnectionType)(record.connectionType, peripheral_types_1.ConnectionType.MOCK);
        const name = (0, request_validation_util_1.validateShortText)((0, request_validation_util_1.optionalString)(record, "name", ""), "name");
        const profileId = typeof record.profileId === "string" ? record.profileId : undefined;
        const network = (0, network_device_validation_util_1.resolveNetworkOptionsForConnection)(record.network, connectionType);
        const usb = this.normalizeUsb(record.usb, connectionType, type);
        const metadata = (0, request_validation_util_1.optionalMetadata)(record);
        return {
            id,
            type,
            name,
            connectionType,
            terminalId,
            profileId,
            network,
            usb,
            metadata,
        };
    }
    normalizeUsb(value, connectionType, deviceType) {
        if (connectionType !== peripheral_types_1.ConnectionType.USB) {
            if (value !== undefined && value !== null) {
                throw new Error("usb is only supported for USB devices");
            }
            return undefined;
        }
        if (deviceType !== peripheral_types_1.DeviceType.PRINTER) {
            throw new Error("USB connection is only supported for PRINTER devices");
        }
        if (value === undefined || value === null) {
            return undefined;
        }
        const record = (0, request_validation_util_1.asRecord)(value, "usb");
        return {
            deviceId: (0, request_validation_util_1.validateIdentifier)((0, request_validation_util_1.optionalString)(record, "deviceId", ""), "usb.deviceId"),
            printerName: (0, request_validation_util_1.validateShortText)((0, request_validation_util_1.optionalString)(record, "printerName", ""), "usb.printerName"),
        };
    }
}
exports.FileDeviceRegistryStateStore = FileDeviceRegistryStateStore;
//# sourceMappingURL=device-registry-state.store.js.map