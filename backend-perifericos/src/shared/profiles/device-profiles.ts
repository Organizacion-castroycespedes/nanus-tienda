import { BadRequestException } from "@nestjs/common";
import { DeviceType } from "../types/peripheral.types";

export const DeviceProfileId = {
  Thermal80mm: "THERMAL_80MM",
  Thermal58mm: "THERMAL_58MM",
  GenericText: "GENERIC_TEXT",
} as const;

export type DeviceProfileId =
  (typeof DeviceProfileId)[keyof typeof DeviceProfileId];

export type DeviceProfile = {
  id: DeviceProfileId;
  widthChars: number;
  paperWidthMm: number | null;
  supportsCut: boolean;
  supportsCashDrawerPulse: boolean;
};

export const DEVICE_PROFILES: Record<DeviceProfileId, DeviceProfile> = {
  THERMAL_80MM: {
    id: DeviceProfileId.Thermal80mm,
    widthChars: 48,
    paperWidthMm: 80,
    supportsCut: true,
    supportsCashDrawerPulse: true,
  },
  THERMAL_58MM: {
    id: DeviceProfileId.Thermal58mm,
    widthChars: 32,
    paperWidthMm: 58,
    supportsCut: true,
    supportsCashDrawerPulse: true,
  },
  GENERIC_TEXT: {
    id: DeviceProfileId.GenericText,
    widthChars: 40,
    paperWidthMm: null,
    supportsCut: false,
    supportsCashDrawerPulse: false,
  },
};

export const getDeviceProfile = (profileId: string | undefined): DeviceProfile => {
  if (!profileId) {
    throw new BadRequestException("device profile is required");
  }

  const profile = DEVICE_PROFILES[profileId as DeviceProfileId];
  if (!profile) {
    throw new BadRequestException(`device profile ${profileId} is not supported`);
  }

  return profile;
};

export const getDefaultProfileIdForDeviceType = (
  deviceType: DeviceType
): DeviceProfileId | undefined => {
  if (deviceType === DeviceType.PRINTER || deviceType === DeviceType.CASH_DRAWER) {
    return DeviceProfileId.Thermal80mm;
  }

  return undefined;
};
