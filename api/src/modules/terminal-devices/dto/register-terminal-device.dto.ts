export type RegisterTerminalDeviceDto = {
  installationId: string;
  tenantId?: string;
  platform?: string;
  runtimeVersion?: string;
  agentApiVersion?: number;
};
