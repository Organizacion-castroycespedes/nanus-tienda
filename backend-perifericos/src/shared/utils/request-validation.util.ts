import { BadRequestException } from "@nestjs/common";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
} from "../types/peripheral.types";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const SHORT_TEXT_PATTERN = /^[A-Za-z0-9 ÁÉÍÓÚÜÑáéíóúüñ._:/#-]{1,160}$/;
const CODE_PATTERN = /^[^\s][\x20-\x7EÁÉÍÓÚÜÑáéíóúüñ]{0,127}$/;
const FORMAT_PATTERN = /^[A-Z0-9_-]{1,32}$/;

export type UnknownRecord = Record<string, unknown>;

export const asRecord = (value: unknown, context: string): UnknownRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${context} must be a JSON object`);
  }

  return value as UnknownRecord;
};

export const optionalString = (
  record: UnknownRecord,
  field: string,
  fallback: string
): string => {
  if (!(field in record) || record[field] === undefined || record[field] === null) {
    return fallback;
  }

  const value = record[field];
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} cannot be empty`);
  }

  return trimmed;
};

export const optionalMetadata = (
  record: UnknownRecord,
  field = "metadata"
): Record<string, unknown> | undefined => {
  if (!(field in record) || record[field] === undefined || record[field] === null) {
    return undefined;
  }

  const value = record[field];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${field} must be a JSON object`);
  }

  return value as Record<string, unknown>;
};

export const validateIdentifier = (value: string, field: string): string => {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new BadRequestException(
      `${field} must use letters, numbers, dot, dash, underscore or colon, max 80 characters`
    );
  }

  return value;
};

export const validateShortText = (value: string, field: string): string => {
  if (!isSupportedShortText(value)) {
    throw new BadRequestException(
      `${field} contains unsupported characters or is too long`
    );
  }

  return value;
};

const isSupportedShortText = (value: string): boolean =>
  /^[\p{L}\p{N} ._:/#-]{1,160}$/u.test(value);

export const validateCode = (value: string, field = "code"): string => {
  if (!CODE_PATTERN.test(value)) {
    throw new BadRequestException(
      `${field} must be printable text and max 128 characters`
    );
  }

  return value;
};

export const validateFormat = (value: string, field = "format"): string => {
  if (!FORMAT_PATTERN.test(value)) {
    throw new BadRequestException(
      `${field} must use uppercase letters, numbers, dash or underscore`
    );
  }

  return value;
};

export const parseDeviceType = (value: unknown): DeviceType => {
  if (
    value === DeviceType.PRINTER ||
    value === DeviceType.CASH_DRAWER ||
    value === DeviceType.SCALE ||
    value === DeviceType.SCANNER ||
    value === DeviceType.DISPLAY ||
    value === DeviceType.OTHER
  ) {
    return value;
  }

  throw new BadRequestException("type must be a supported DeviceType");
};

export const parseDeviceStatus = (
  value: unknown,
  fallback: DeviceStatus
): DeviceStatus => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (
    value === DeviceStatus.CONNECTED ||
    value === DeviceStatus.DISCONNECTED ||
    value === DeviceStatus.ERROR ||
    value === DeviceStatus.SIMULATED
  ) {
    return value;
  }

  throw new BadRequestException(
    "status must be CONNECTED, DISCONNECTED, ERROR or SIMULATED"
  );
};

export const parseConnectionType = (
  value: unknown,
  fallback: ConnectionType
): ConnectionType => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (
    value === ConnectionType.MOCK ||
    value === ConnectionType.USB ||
    value === ConnectionType.SERIAL ||
    value === ConnectionType.HID ||
    value === ConnectionType.USB_HID ||
    value === ConnectionType.NETWORK ||
    value === ConnectionType.BLUETOOTH
  ) {
    return value;
  }

  throw new BadRequestException(
    "connectionType must be MOCK, USB, SERIAL, HID, USB_HID, NETWORK or BLUETOOTH"
  );
};
