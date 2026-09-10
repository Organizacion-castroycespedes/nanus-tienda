import { Inject, Controller, Get } from "@nestjs/common";
import { getAgentInstallationId } from "../../platform/agent-installation-state.store";
import { DevicesService } from "../devices/devices.service";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";
import type { PeripheralsMode } from "../../shared/config/peripherals.config";

export type HealthResponse = {
  status: "ok";
  agent: string;
  mode: PeripheralsMode;
  agentInstallationId: string;
  platform: string;
  architecture: string;
  version: string;
  uptimeSeconds: number;
  configuredDevices: number;
  discoveredDevices: number;
  persistenceState: {
    schemaVersion: number;
    status: "empty" | "loaded" | "corrupt";
  };
};

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DevicesService) private readonly devicesService: DevicesService
  ) {}

  @Get()
  getHealth(): HealthResponse {
    const config = getPeripheralsConfig();
    const runtime = this.devicesService.getHealthSnapshot();

    return {
      status: "ok",
      agent: config.agentName,
      mode: config.mode,
      agentInstallationId: getAgentInstallationId(),
      platform: process.platform,
      architecture: process.arch,
      version: config.version,
      uptimeSeconds: Math.max(
        0,
        Math.floor((Date.now() - config.startedAt) / 1000)
      ),
      configuredDevices: runtime.configuredDevices,
      discoveredDevices: runtime.discoveredDevices,
      persistenceState: {
        schemaVersion: runtime.schemaVersion,
        status: runtime.persistenceState,
      },
    };
  }
}
