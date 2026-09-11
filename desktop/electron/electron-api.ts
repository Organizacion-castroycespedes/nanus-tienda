export type AgentHealth = {
  agentApiVersion?: number;
  available: boolean;
  status?: string;
  mode?: string;
  version?: string;
  agentInstallationId?: string;
  platform?: string;
  reason?: "UNAVAILABLE" | "INVALID_RESPONSE" | "TIMEOUT";
};

export type ShellInfo = {
  environment: "dev" | "qa" | "production";
  shellVersion: string;
  frontendOrigin: string;
  agentAvailable: boolean;
};

export const IPC_CHANNELS = {
  getRuntimeInfo: "manusTerminal.getRuntimeInfo",
  getShellInfo: "manusTerminal.getShellInfo",
  getAgentHealth: "manusTerminal.getAgentHealth",
  listDevices: "manusTerminal.listDevices",
  discoverDevices: "manusTerminal.discoverDevices",
  createDevice: "manusTerminal.createDevice",
  updateDevice: "manusTerminal.updateDevice",
  testPrint: "manusTerminal.testPrint",
  printTicket: "manusTerminal.printTicket",
  openCashDrawer: "manusTerminal.openCashDrawer",
  simulateScanner: "manusTerminal.simulateScanner",
  currentWeight: "manusTerminal.currentWeight",
  listLogs: "manusTerminal.listLogs",
} as const;

export type ManusTerminalApi = {
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  getShellInfo: () => Promise<ShellInfo>;
  getAgentHealth: () => Promise<AgentHealth>;
  listDevices: () => Promise<unknown[]>;
  discoverDevices: (terminalId: string) => Promise<{ devices: unknown[] }>;
  createDevice: (payload: unknown) => Promise<unknown>;
  updateDevice: (deviceId: string, payload: unknown) => Promise<unknown>;
  testPrint: (payload: unknown) => Promise<unknown>;
  printTicket: (payload: unknown) => Promise<unknown>;
  openCashDrawer: (payload: unknown) => Promise<unknown>;
  simulateScanner: (payload: unknown) => Promise<unknown>;
  currentWeight: (payload: unknown) => Promise<unknown>;
  listLogs: () => Promise<unknown[]>;
};

export const RUNTIME_CAPABILITIES = [
  "agent.health", "devices.list", "devices.discover", "devices.create",
  "devices.update", "printer.testPrint", "printer.printTicket", "drawer.open",
  "scanner.simulate", "scale.currentWeight", "logs.list",
] as const;

export type RuntimeCapability = typeof RUNTIME_CAPABILITIES[number];
export type RuntimeInfo = {
  electronRuntimeVersion: string;
  bridgeContractVersion: number;
  agentApiVersion: number | null;
  capabilities: RuntimeCapability[];
};

export const buildRuntimeInfo = (electronRuntimeVersion: string, health: AgentHealth): RuntimeInfo => ({
  electronRuntimeVersion,
  bridgeContractVersion: 1,
  agentApiVersion: health.available ? health.agentApiVersion ?? null : null,
  capabilities: health.available && health.agentApiVersion === 1
    ? [...RUNTIME_CAPABILITIES]
    : ["agent.health"],
});

declare global {
  interface Window {
    manusTerminal: ManusTerminalApi;
  }
}
