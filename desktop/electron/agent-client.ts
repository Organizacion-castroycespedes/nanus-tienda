import http from "node:http";

import type { AgentHealth } from "./electron-api.js";
import type { AgentRoutingConfig } from "./config.js";

export const DEFAULT_AGENT_REQUEST_TIMEOUT_MS = 2500;
export const DISCOVERY_REQUEST_TIMEOUT_MS = 15000;
export const PRINT_TICKET_REQUEST_TIMEOUT_MS = 15000;
export const CASH_DRAWER_REQUEST_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 64 * 1024;

type RequestOptions = { timeoutMs?: number };

const SAFE_AGENT_ERROR_CODES = new Set([
  "PRINT_TRANSPORT_NOT_READY",
  "WINDOWS_PRINT_QUEUE_REQUIRED",
]);

export class AgentHttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string) {
    super(code);
    this.name = "AgentHttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const safeAgentErrorCode = (value: unknown): string => {
  if (typeof value !== "string") return "AGENT_HTTP_ERROR";
  const match = value.match(/^([A-Z][A-Z0-9_]{2,79})(?::|$)/);
  const candidate = match?.[1];
  return candidate && SAFE_AGENT_ERROR_CODES.has(candidate) ? candidate : "AGENT_HTTP_ERROR";
};

const requestJson = (shellConfig: AgentRoutingConfig, path: string, method = "GET", body?: unknown, options: RequestOptions = {}): Promise<unknown> => new Promise((resolve, reject) => {
  const target = new URL(path, shellConfig.agentLoopbackOrigin);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const request = http.request({ hostname: target.hostname, port: Number(target.port), path: target.pathname + target.search, method, timeout: options.timeoutMs ?? DEFAULT_AGENT_REQUEST_TIMEOUT_MS, headers: { Accept: "application/json", ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}) } }, (response) => {
    let text = ""; let bytes = 0;
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => { bytes += Buffer.byteLength(chunk); if (bytes <= MAX_RESPONSE_BYTES) text += chunk; });
    response.on("end", () => {
      const statusCode = response.statusCode;
      if (bytes > MAX_RESPONSE_BYTES || statusCode === undefined) {
        reject(new Error("AGENT_RESPONSE_INVALID"));
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        let code = "AGENT_HTTP_ERROR";
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          code = safeAgentErrorCode(parsed.code ?? parsed.errorCode ?? parsed.message);
        } catch {
          // Keep the safe generic code; never expose an arbitrary response body.
        }
        reject(new AgentHttpError(statusCode, code));
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("AGENT_RESPONSE_INVALID"));
      }
    });
  });
  request.on("timeout", () => { request.destroy(new Error("AGENT_TIMEOUT")); });
  request.on("error", reject);
  if (payload) request.write(payload);
  request.end();
});

const normalizeHealth = (value: unknown): AgentHealth => {
  if (!value || typeof value !== "object") {
    return { available: false, reason: "INVALID_RESPONSE" };
  }

  const source = value as Record<string, unknown>;
  if (source.status !== "ok") {
    return { available: false, reason: "INVALID_RESPONSE" };
  }

  const result: AgentHealth = { available: true, status: "ok" };
  if (typeof source.agentApiVersion === "number" && Number.isSafeInteger(source.agentApiVersion) && source.agentApiVersion > 0) {
    result.agentApiVersion = source.agentApiVersion;
  }
  for (const key of ["mode", "version", "agentInstallationId", "platform"] as const) {
    if (typeof source[key] === "string") {
      result[key] = source[key];
    }
  }
  return result;
};

export const getAgentHealth = (
  shellConfig: AgentRoutingConfig,
): Promise<AgentHealth> => {
  return new Promise((resolve) => {
    const target = new URL("/health", shellConfig.agentLoopbackOrigin);
    const request = http.get(
      {
        hostname: target.hostname,
        port: Number(target.port),
        path: target.pathname,
        timeout: DEFAULT_AGENT_REQUEST_TIMEOUT_MS,
        headers: { Accept: "application/json" },
      },
      (response) => {
        let body = "";
        let bytes = 0;
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          bytes += Buffer.byteLength(chunk);
          if (bytes <= MAX_RESPONSE_BYTES) {
            body += chunk;
          }
        });
        response.on("end", () => {
          if (bytes > MAX_RESPONSE_BYTES || response.statusCode !== 200) {
            resolve({ available: false, reason: "INVALID_RESPONSE" });
            return;
          }
          try {
            resolve(normalizeHealth(JSON.parse(body)));
          } catch {
            resolve({ available: false, reason: "INVALID_RESPONSE" });
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy();
      resolve({ available: false, reason: "TIMEOUT" });
    });
    request.on("error", () => {
      resolve({ available: false, reason: "UNAVAILABLE" });
    });
  });
};

export const listAgentDevices = async (shellConfig: AgentRoutingConfig): Promise<unknown[]> => {
  const value = await requestJson(shellConfig, "/devices");
  return Array.isArray(value) ? value : [];
};

export const discoverAgentDevices = async (shellConfig: AgentRoutingConfig, terminalId: string): Promise<{ devices: unknown[] }> => {
  const value = await requestJson(shellConfig, "/devices/discover", "POST", { terminalId: terminalId.slice(0, 128) }, { timeoutMs: DISCOVERY_REQUEST_TIMEOUT_MS });
  if (!value || typeof value !== "object") return { devices: [] };
  const source = value as { devices?: unknown };
  return { devices: Array.isArray(source.devices) ? source.devices : [] };
};

const requestAgentOperation = (config: AgentRoutingConfig, path: string, method: string, body: unknown, options: RequestOptions = {}) => requestJson(config, path, method, body, options);
export const createAgentDevice = (config: AgentRoutingConfig, payload: unknown) => requestAgentOperation(config, "/devices", "POST", payload);
export const updateAgentDevice = (config: AgentRoutingConfig, id: string, payload: unknown) => requestAgentOperation(config, `/devices/${encodeURIComponent(id.slice(0, 128))}`, "PATCH", payload);
export const testAgentPrint = (config: AgentRoutingConfig, payload: unknown) => requestAgentOperation(config, "/printer/test-print", "POST", payload);
export const printAgentTicket = (config: AgentRoutingConfig, payload: unknown, options: RequestOptions = { timeoutMs: PRINT_TICKET_REQUEST_TIMEOUT_MS }) => requestAgentOperation(config, "/printer/print-ticket", "POST", payload, options);
export const openAgentCashDrawer = (config: AgentRoutingConfig, payload: unknown, options: RequestOptions = { timeoutMs: CASH_DRAWER_REQUEST_TIMEOUT_MS }) => requestAgentOperation(config, "/cash-drawer/open", "POST", payload, options);
export const simulateAgentScanner = (config: AgentRoutingConfig, payload: unknown) => requestAgentOperation(config, "/scanner/simulate", "POST", payload);
export const getAgentCurrentWeight = (config: AgentRoutingConfig, payload: unknown) => {
  const input = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const query = new URLSearchParams();
  for (const key of ["terminalId", "deviceId"]) if (typeof input[key] === "string" && input[key]) query.set(key, String(input[key]).slice(0, 128));
  return requestJson(config, `/scale/current-weight${query.toString() ? `?${query}` : ""}`);
};
export const listAgentLogs = (config: AgentRoutingConfig) => requestJson(config, "/logs").then((value) => Array.isArray(value) ? value : []);
