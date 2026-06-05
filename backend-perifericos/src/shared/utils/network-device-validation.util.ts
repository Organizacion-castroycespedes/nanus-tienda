import { BadRequestException } from "@nestjs/common";
import { ConnectionType, type NetworkConnectionOptions } from "../types/peripheral.types";

export const DEFAULT_NETWORK_TIMEOUT_MS = 3000;
export const MIN_NETWORK_TIMEOUT_MS = 250;
export const MAX_NETWORK_TIMEOUT_MS = 30000;

const HOST_PATTERN = /^[A-Za-z0-9.-]{1,253}$/;

export const validateNetworkOptions = (
  value: unknown,
  context = "NETWORK devices"
): NetworkConnectionOptions => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`network is required for ${context}`);
  }

  const record = value as Record<string, unknown>;
  const host = validateNetworkHost(record.host, context);
  const port = validateNetworkPort(record.port);
  const timeoutMs = validateNetworkTimeout(record.timeoutMs);

  return { host, port, timeoutMs };
};

export const resolveNetworkOptionsForConnection = (
  value: unknown,
  connectionType: ConnectionType,
  current?: NetworkConnectionOptions
): NetworkConnectionOptions | undefined => {
  if (connectionType !== ConnectionType.NETWORK) {
    if (value !== undefined && value !== null) {
      throw new BadRequestException(
        "network is only supported for NETWORK devices"
      );
    }

    return undefined;
  }

  if (value === undefined || value === null) {
    if (current) {
      return { ...current };
    }

    throw new BadRequestException("network is required for NETWORK devices");
  }

  return validateNetworkOptions(value);
};

const validateNetworkHost = (
  value: unknown,
  context: string
): string => {
  if (typeof value !== "string") {
    throw new BadRequestException(`network.host is required for ${context}`);
  }

  const host = value.trim();
  if (!host) {
    throw new BadRequestException(`network.host is required for ${context}`);
  }
  if (
    host.includes("://") ||
    host.includes("/") ||
    host.includes("\\") ||
    host.includes(":") ||
    !HOST_PATTERN.test(host)
  ) {
    throw new BadRequestException(
      "network.host must be a hostname or IPv4 address without protocol"
    );
  }
  if (isLoopbackHost(host)) {
    throw new BadRequestException(
      "network.host cannot be localhost or loopback address"
    );
  }

  return host;
};

const validateNetworkPort = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BadRequestException(
      "network.port must be an integer between 1 and 65535"
    );
  }
  if (value < 1 || value > 65535) {
    throw new BadRequestException(
      "network.port must be an integer between 1 and 65535"
    );
  }

  return value;
};

const validateNetworkTimeout = (value: unknown): number => {
  if (value === undefined || value === null) {
    return DEFAULT_NETWORK_TIMEOUT_MS;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BadRequestException(
      `network.timeoutMs must be an integer between ${MIN_NETWORK_TIMEOUT_MS} and ${MAX_NETWORK_TIMEOUT_MS}`
    );
  }
  if (value < MIN_NETWORK_TIMEOUT_MS || value > MAX_NETWORK_TIMEOUT_MS) {
    throw new BadRequestException(
      `network.timeoutMs must be an integer between ${MIN_NETWORK_TIMEOUT_MS} and ${MAX_NETWORK_TIMEOUT_MS}`
    );
  }

  return value;
};

const isLoopbackHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.")
  );
};
