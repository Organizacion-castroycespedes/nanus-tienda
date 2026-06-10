import { Controller, Get } from "@nestjs/common";
import { getPeripheralsConfig } from "../../shared/config/peripherals.config";

export type HealthResponse = {
  status: "ok";
  agent: string;
  mode: "MOCK";
  version: string;
  uptimeSeconds: number;
};

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    const config = getPeripheralsConfig();

    return {
      status: "ok",
      agent: config.agentName,
      mode: config.mode,
      version: config.version,
      uptimeSeconds: Math.max(
        0,
        Math.floor((Date.now() - config.startedAt) / 1000)
      ),
    };
  }
}
