"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultProfileIdForDeviceType = exports.getDeviceProfile = exports.DEVICE_PROFILES = exports.DeviceProfileId = void 0;
const common_1 = require("@nestjs/common");
const peripheral_types_1 = require("../types/peripheral.types");
exports.DeviceProfileId = {
    Thermal80mm: "THERMAL_80MM",
    Thermal58mm: "THERMAL_58MM",
    GenericText: "GENERIC_TEXT",
};
exports.DEVICE_PROFILES = {
    THERMAL_80MM: {
        id: exports.DeviceProfileId.Thermal80mm,
        widthChars: 48,
        paperWidthMm: 80,
        supportsCut: true,
        supportsCashDrawerPulse: true,
    },
    THERMAL_58MM: {
        id: exports.DeviceProfileId.Thermal58mm,
        widthChars: 32,
        paperWidthMm: 58,
        supportsCut: true,
        supportsCashDrawerPulse: true,
    },
    GENERIC_TEXT: {
        id: exports.DeviceProfileId.GenericText,
        widthChars: 40,
        paperWidthMm: null,
        supportsCut: false,
        supportsCashDrawerPulse: false,
    },
};
const getDeviceProfile = (profileId) => {
    if (!profileId) {
        throw new common_1.BadRequestException("device profile is required");
    }
    const profile = exports.DEVICE_PROFILES[profileId];
    if (!profile) {
        throw new common_1.BadRequestException(`device profile ${profileId} is not supported`);
    }
    return profile;
};
exports.getDeviceProfile = getDeviceProfile;
const getDefaultProfileIdForDeviceType = (deviceType) => {
    if (deviceType === peripheral_types_1.DeviceType.PRINTER || deviceType === peripheral_types_1.DeviceType.CASH_DRAWER) {
        return exports.DeviceProfileId.Thermal80mm;
    }
    return undefined;
};
exports.getDefaultProfileIdForDeviceType = getDefaultProfileIdForDeviceType;
//# sourceMappingURL=device-profiles.js.map