"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNetworkOptionsForConnection = exports.validateNetworkOptions = exports.MAX_NETWORK_TIMEOUT_MS = exports.MIN_NETWORK_TIMEOUT_MS = exports.DEFAULT_NETWORK_TIMEOUT_MS = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../types/peripheral.types");
exports.DEFAULT_NETWORK_TIMEOUT_MS = 3000;
exports.MIN_NETWORK_TIMEOUT_MS = 250;
exports.MAX_NETWORK_TIMEOUT_MS = 30000;
const HOST_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;
const validateNetworkOptions = (value, context = "NETWORK devices") => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new common_1.BadRequestException(`network is required for ${context}`);
    }
    const record = value;
    const host = validateNetworkHost(record.host, context);
    const port = validateNetworkPort(record.port);
    const timeoutMs = validateNetworkTimeout(record.timeoutMs);
    return { host, port, timeoutMs };
};
exports.validateNetworkOptions = validateNetworkOptions;
const resolveNetworkOptionsForConnection = (value, connectionType, current) => {
    if (connectionType !== peripheral_types_1.ConnectionType.NETWORK) {
        if (value !== undefined && value !== null) {
            throw new common_1.BadRequestException("network is only supported for NETWORK devices");
        }
        return undefined;
    }
    if (value === undefined || value === null) {
        if (current) {
            return { ...current };
        }
        throw new common_1.BadRequestException("network is required for NETWORK devices");
    }
    return (0, exports.validateNetworkOptions)(value);
};
exports.resolveNetworkOptionsForConnection = resolveNetworkOptionsForConnection;
const validateNetworkHost = (value, context) => {
    if (typeof value !== "string") {
        throw new common_1.BadRequestException(`network.host is required for ${context}`);
    }
    const host = value.trim();
    if (!host) {
        throw new common_1.BadRequestException(`network.host is required for ${context}`);
    }
    if (host.includes("://") ||
        host.includes("/") ||
        host.includes("\\") ||
        host.includes(":") ||
        !HOST_PATTERN.test(host)) {
        throw new common_1.BadRequestException("network.host must be a hostname or IPv4 address without protocol");
    }
    if (isLoopbackHost(host)) {
        throw new common_1.BadRequestException("network.host cannot be localhost or loopback address");
    }
    return host;
};
const validateNetworkPort = (value) => {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new common_1.BadRequestException("network.port must be an integer between 1 and 65535");
    }
    if (value < 1 || value > 65535) {
        throw new common_1.BadRequestException("network.port must be an integer between 1 and 65535");
    }
    return value;
};
const validateNetworkTimeout = (value) => {
    if (value === undefined || value === null) {
        return exports.DEFAULT_NETWORK_TIMEOUT_MS;
    }
    if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new common_1.BadRequestException(`network.timeoutMs must be an integer between ${exports.MIN_NETWORK_TIMEOUT_MS} and ${exports.MAX_NETWORK_TIMEOUT_MS}`);
    }
    if (value < exports.MIN_NETWORK_TIMEOUT_MS || value > exports.MAX_NETWORK_TIMEOUT_MS) {
        throw new common_1.BadRequestException(`network.timeoutMs must be an integer between ${exports.MIN_NETWORK_TIMEOUT_MS} and ${exports.MAX_NETWORK_TIMEOUT_MS}`);
    }
    return value;
};
const isLoopbackHost = (host) => {
    const normalized = host.toLowerCase();
    return (normalized === "localhost" ||
        normalized === "0.0.0.0" ||
        normalized === "::1" ||
        normalized === "[::1]" ||
        normalized.startsWith("127."));
};
//# sourceMappingURL=network-device-validation.util.js.map