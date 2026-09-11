export const CAPABILITY_METHODS = {
  "agent.health": "getAgentHealth",
  "devices.list": "listDevices",
  "devices.discover": "discoverDevices",
  "devices.create": "createDevice",
  "devices.update": "updateDevice",
  "printer.testPrint": "testPrint",
  "printer.printTicket": "printTicket",
  "drawer.open": "openCashDrawer",
  "scanner.simulate": "simulateScanner",
  "scale.currentWeight": "currentWeight",
  "logs.list": "listLogs",
} as const;

export type RuntimeCapability = keyof typeof CAPABILITY_METHODS;
export type RuntimeInfo = {
  electronRuntimeVersion: string;
  bridgeContractVersion: number;
  agentApiVersion: number | null;
  capabilities: RuntimeCapability[];
};
export type RuntimeCompatibility = {
  state: "COMPATIBLE" | "DEGRADED" | "INCOMPATIBLE";
  reason: "SUPPORTED" | "NO_BRIDGE" | "LEGACY_BRIDGE" | "METADATA_UNAVAILABLE" | "INVALID_METADATA" | "UNSUPPORTED_CONTRACT" | "MISSING_CAPABILITY" | "AGENT_UNKNOWN";
  info: RuntimeInfo | null;
  capabilities: RuntimeCapability[];
};

export const readRuntimeBridge = (): object | null => {
  if (typeof window === "undefined") return null;
  const bridge = (window as Window & { manusTerminal?: unknown }).manusTerminal;
  return bridge && typeof bridge === "object" ? bridge : null;
};

const capabilityNames = Object.keys(CAPABILITY_METHODS) as RuntimeCapability[];
const isGeneration = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export const hasRuntimeCapability = (runtime: RuntimeCompatibility, capability: RuntimeCapability) =>
  runtime.state !== "INCOMPATIBLE" && runtime.capabilities.includes(capability);

export const getTerminalRuntime = async (
  bridge: object | null = readRuntimeBridge(),
  required: readonly RuntimeCapability[] = capabilityNames,
  timeoutMs = 3000,
): Promise<RuntimeCompatibility> => {
  const result = (state: RuntimeCompatibility["state"], reason: RuntimeCompatibility["reason"], capabilities: RuntimeCapability[] = [], info: RuntimeInfo | null = null): RuntimeCompatibility => ({ state, reason, capabilities, info });
  if (!bridge) return result("DEGRADED", "NO_BRIDGE");
  const source = bridge as Record<string, unknown>;
  const callable = capabilityNames.filter((name) => typeof source[CAPABILITY_METHODS[name]] === "function");
  if (source.getRuntimeInfo === undefined) return result("DEGRADED", "LEGACY_BRIDGE", callable);
  if (typeof source.getRuntimeInfo !== "function") return result("INCOMPATIBLE", "INVALID_METADATA");

  let timer: ReturnType<typeof setTimeout> | undefined;
  let raw: unknown;
  try {
    const getInfo = source.getRuntimeInfo as () => Promise<unknown>;
    raw = await Promise.race([
      Promise.resolve().then(() => getInfo.call(bridge)),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("RUNTIME_TIMEOUT")), timeoutMs);
      }),
    ]);
  } catch {
    return result("DEGRADED", "METADATA_UNAVAILABLE");
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  if (!raw || typeof raw !== "object") return result("INCOMPATIBLE", "INVALID_METADATA");
  const value = raw as Record<string, unknown>;
  if (typeof value.electronRuntimeVersion !== "string" || !value.electronRuntimeVersion.trim()
    || !isGeneration(value.bridgeContractVersion)
    || (value.agentApiVersion !== null && !isGeneration(value.agentApiVersion))
    || !Array.isArray(value.capabilities) || !value.capabilities.every((item) => typeof item === "string")) {
    return result("INCOMPATIBLE", "INVALID_METADATA");
  }
  const advertised = value.capabilities;
  const info: RuntimeInfo = {
    electronRuntimeVersion: value.electronRuntimeVersion,
    bridgeContractVersion: value.bridgeContractVersion,
    agentApiVersion: value.agentApiVersion as number | null,
    capabilities: capabilityNames.filter((name) => advertised.includes(name)),
  };
  if (info.bridgeContractVersion !== 1 || (info.agentApiVersion !== null && info.agentApiVersion !== 1)) {
    return result("INCOMPATIBLE", "UNSUPPORTED_CONTRACT", [], info);
  }
  const capabilities = callable.filter((name) => info.capabilities.includes(name)
    && (info.agentApiVersion !== null || name === "agent.health"));
  if (info.agentApiVersion === null) return result("DEGRADED", "AGENT_UNKNOWN", capabilities, info);
  return required.every((name) => capabilities.includes(name))
    ? result("COMPATIBLE", "SUPPORTED", capabilities, info)
    : result("DEGRADED", "MISSING_CAPABILITY", capabilities, info);
};
