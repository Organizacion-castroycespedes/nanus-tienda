import { Controller, Get } from "@nestjs/common";
import { getServiceConfig } from "../../config/electronic-invoicing.config";

export type HealthResponse = {
  status: "ok";
  service: string;
  timestamp: string;
  environment: string;
};

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    const config = getServiceConfig();

    return {
      status: "ok",
      service: config.serviceName,
      timestamp: new Date().toISOString(),
      environment: config.environment,
    };
  }
}
