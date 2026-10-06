import { BadRequestException } from "@nestjs/common";
import {
  ConnectionType,
  DeviceStatus,
  DeviceType,
  type SerialConnectionOptions,
  type SerialFlowControl,
  type SerialParity,
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

// Device display names include Windows friendly-name port suffixes, e.g. (COM5).
// Identity remains in the device/PnP fields; other short-text contracts stay unchanged.
export const validateDeviceName = (value: string): string => {
  if (!/^[\p{L}\p{N} ._:/#()-]{1,160}$/u.test(value)) {
    throw new BadRequestException("name contains unsupported characters or is too long");
  }
  return value;
};

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
    value === DeviceStatus.NOT_REACHABLE ||
    value === DeviceStatus.ERROR ||
    value === DeviceStatus.SIMULATED
  ) {
    return value;
  }

  throw new BadRequestException(
    "status must be CONNECTED, DISCONNECTED, NOT_REACHABLE, ERROR or SIMULATED"
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

const SERIAL_BAUD_RATES = new Set([
  110, 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200,
  230400, 460800, 921600,
]);

const SERIAL_PORT_PATTERN = /^(?:[A-Za-z]:)?[A-Za-z0-9._:/\\-]+$/;
const SERIAL_PARITIES = new Set<SerialParity>(["none", "even", "odd"]);
const SERIAL_FLOW_CONTROLS = new Set<SerialFlowControl>(["none", "rtscts"]);

const requiredSerialString = (
  record: UnknownRecord,
  field: string,
  context: string
): string => {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${context}.${field} must be a non-empty string`);
  }
  return value.trim();
};

const requiredSerialNumber = (
  record: UnknownRecord,
  field: string,
  context: string
): number => {
  const value = record[field];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BadRequestException(`${context}.${field} must be an integer`);
  }
  return value;
};

export const parseSerialConnectionOptions = (
  value: unknown,
  context = "serial"
): SerialConnectionOptions => {
  const record = asRecord(value, context);
  const port = requiredSerialString(record, "port", context);
  if (!SERIAL_PORT_PATTERN.test(port)) {
    throw new BadRequestException(`${context}.port has an unsupported format`);
  }

  const baudRate = requiredSerialNumber(record, "baudRate", context);
  if (!SERIAL_BAUD_RATES.has(baudRate)) {
    throw new BadRequestException(`${context}.baudRate is not supported`);
  }

  const dataBits = requiredSerialNumber(record, "dataBits", context);
  if (![5, 6, 7, 8].includes(dataBits)) {
    throw new BadRequestException(`${context}.dataBits is not supported`);
  }

  const stopBits = requiredSerialNumber(record, "stopBits", context);
  if (stopBits !== 1 && stopBits !== 2) {
    throw new BadRequestException(`${context}.stopBits is not supported`);
  }

  const parity = record.parity;
  if (typeof parity !== "string" || !SERIAL_PARITIES.has(parity as SerialParity)) {
    throw new BadRequestException(`${context}.parity is not supported`);
  }

  const flowControl = record.flowControl;
  if (
    typeof flowControl !== "string" ||
    !SERIAL_FLOW_CONTROLS.has(flowControl as SerialFlowControl)
  ) {
    throw new BadRequestException(`${context}.flowControl is not supported`);
  }

  let pnp: SerialConnectionOptions["pnp"];
  if (record.pnp !== undefined && record.pnp !== null) {
    const pnpRecord = asRecord(record.pnp, `${context}.pnp`);
    const deviceId = requiredSerialString(pnpRecord, "deviceId", `${context}.pnp`);
    const vendorId = pnpRecord.vendorId === undefined
      ? undefined
      : requiredSerialString(pnpRecord, "vendorId", `${context}.pnp`);
    const productId = pnpRecord.productId === undefined
      ? undefined
      : requiredSerialString(pnpRecord, "productId", `${context}.pnp`);
    pnp = { deviceId, vendorId, productId };
  }

  return {
    port,
    baudRate,
    dataBits: dataBits as SerialConnectionOptions["dataBits"],
    stopBits: stopBits as SerialConnectionOptions["stopBits"],
    parity: parity as SerialParity,
    flowControl: flowControl as SerialFlowControl,
    pnp,
  };
};

export const resolveSerialOptionsForConnection = (
  value: unknown,
  connectionType: ConnectionType,
  current?: SerialConnectionOptions
): SerialConnectionOptions | undefined => {
  if (connectionType !== ConnectionType.SERIAL) {
    if (value !== undefined && value !== null) {
      throw new BadRequestException("serial is only supported for SERIAL devices");
    }
    return undefined;
  }
  if (value === undefined || value === null) {
    if (current) return { ...current, pnp: current.pnp ? { ...current.pnp } : undefined };
    throw new BadRequestException("serial configuration is required for SERIAL devices");
  }
  return parseSerialConnectionOptions(value);
};
