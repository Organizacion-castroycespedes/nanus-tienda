export type AgentHealth = {
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

declare global {
  interface Window {
    manusTerminal: ManusTerminalApi;
  }
}
