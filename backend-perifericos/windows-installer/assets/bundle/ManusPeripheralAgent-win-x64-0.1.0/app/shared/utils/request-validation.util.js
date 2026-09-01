"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConnectionType = exports.parseDeviceStatus = exports.parseDeviceType = exports.validateFormat = exports.validateCode = exports.validateShortText = exports.validateIdentifier = exports.optionalMetadata = exports.optionalString = exports.asRecord = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../types/peripheral.types");
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const SHORT_TEXT_PATTERN = /^[A-Za-z0-9 ÁÉÍÓÚÜÑáéíóúüñ._:/#-]{1,160}$/;
const CODE_PATTERN = /^[^\s][\x20-\x7EÁÉÍÓÚÜÑáéíóúüñ]{0,127}$/;
const FORMAT_PATTERN = /^[A-Z0-9_-]{1,32}$/;
const asRecord = (value, context) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new common_1.BadRequestException(`${context} must be a JSON object`);
    }
    return value;
};
exports.asRecord = asRecord;
const optionalString = (record, field, fallback) => {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
        return fallback;
    }
    const value = record[field];
    if (typeof value !== "string") {
        throw new common_1.BadRequestException(`${field} must be a string`);
    }
    const trimmed = value.trim();
    if (!trimmed) {
        throw new common_1.BadRequestException(`${field} cannot be empty`);
    }
    return trimmed;
};
exports.optionalString = optionalString;
const optionalMetadata = (record, field = "metadata") => {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
        return undefined;
    }
    const value = record[field];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new common_1.BadRequestException(`${field} must be a JSON object`);
    }
    return value;
};
exports.optionalMetadata = optionalMetadata;
const validateIdentifier = (value, field) => {
    if (!IDENTIFIER_PATTERN.test(value)) {
        throw new common_1.BadRequestException(`${field} must use letters, numbers, dot, dash, underscore or colon, max 80 characters`);
    }
    return value;
};
exports.validateIdentifier = validateIdentifier;
const validateShortText = (value, field) => {
    if (!isSupportedShortText(value)) {
        throw new common_1.BadRequestException(`${field} contains unsupported characters or is too long`);
    }
    return value;
};
exports.validateShortText = validateShortText;
const isSupportedShortText = (value) => /^[\p{L}\p{N} ._:/#-]{1,160}$/u.test(value);
const validateCode = (value, field = "code") => {
    if (!CODE_PATTERN.test(value)) {
        throw new common_1.BadRequestException(`${field} must be printable text and max 128 characters`);
    }
    return value;
};
exports.validateCode = validateCode;
const validateFormat = (value, field = "format") => {
    if (!FORMAT_PATTERN.test(value)) {
        throw new common_1.BadRequestException(`${field} must use uppercase letters, numbers, dash or underscore`);
    }
    return value;
};
exports.validateFormat = validateFormat;
const parseDeviceType = (value) => {
    if (value === peripheral_types_1.DeviceType.PRINTER ||
        value === peripheral_types_1.DeviceType.CASH_DRAWER ||
        value === peripheral_types_1.DeviceType.SCALE ||
        value === peripheral_types_1.DeviceType.SCANNER ||
        value === peripheral_types_1.DeviceType.DISPLAY ||
        value === peripheral_types_1.DeviceType.OTHER) {
        return value;
    }
    throw new common_1.BadRequestException("type must be a supported DeviceType");
};
exports.parseDeviceType = parseDeviceType;
const parseDeviceStatus = (value, fallback) => {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (value === peripheral_types_1.DeviceStatus.CONNECTED ||
        value === peripheral_types_1.DeviceStatus.DISCONNECTED ||
        value === peripheral_types_1.DeviceStatus.NOT_REACHABLE ||
        value === peripheral_types_1.DeviceStatus.ERROR ||
        value === peripheral_types_1.DeviceStatus.SIMULATED) {
        return value;
    }
    throw new common_1.BadRequestException("status must be CONNECTED, DISCONNECTED, NOT_REACHABLE, ERROR or SIMULATED");
};
exports.parseDeviceStatus = parseDeviceStatus;
const parseConnectionType = (value, fallback) => {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (value === peripheral_types_1.ConnectionType.MOCK ||
        value === peripheral_types_1.ConnectionType.USB ||
        value === peripheral_types_1.ConnectionType.SERIAL ||
        value === peripheral_types_1.ConnectionType.HID ||
        value === peripheral_types_1.ConnectionType.USB_HID ||
        value === peripheral_types_1.ConnectionType.NETWORK ||
        value === peripheral_types_1.ConnectionType.BLUETOOTH) {
        return value;
    }
    throw new common_1.BadRequestException("connectionType must be MOCK, USB, SERIAL, HID, USB_HID, NETWORK or BLUETOOTH");
};
exports.parseConnectionType = parseConnectionType;
//# sourceMappingURL=request-validation.util.js.map