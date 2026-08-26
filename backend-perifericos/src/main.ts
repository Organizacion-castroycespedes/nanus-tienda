import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import {
  buildPeripheralsCorsOptions,
  getCorsAllowedOrigin,
  getPeripheralsConfig,
} from "./shared/config/peripherals.config";
import { SanitizedHttpExceptionFilter } from "./shared/filters/sanitized-http-exception.filter";
import { EventsService } from "./modules/events/events.service";
import { LogsService } from "./modules/logs/logs.service";
import { DevicesService } from "./modules/devices/devices.service";
import { loadAgentLocalConfig } from "./platform/agent-local-config";

loadEnv();
loadAgentLocalConfig();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = getPeripheralsConfig();

  app.useGlobalFilters(new SanitizedHttpExceptionFilter());
  const corsOptions = buildPeripheralsCorsOptions(config.allowedOrigins);
  app.enableCors(corsOptions);
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.method !== "OPTIONS") {
      next();
      return;
    }

    const origin = Array.isArray(request.headers.origin)
      ? request.headers.origin[0]
      : request.headers.origin;
    const allowedOrigin = getCorsAllowedOrigin(
      origin,
      config.allowedOrigins
    );
    if (typeof allowedOrigin !== "string") {
      next();
      return;
    }

    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    response.setHeader(
      "Access-Control-Allow-Headers",
      String(
        request.headers["access-control-request-headers"] ??
          "Content-Type, Authorization, Accept, Origin"
      )
    );
    response.setHeader("Vary", "Origin");
    response.status(204).send();
  });

  const eventsService = app.get(EventsService);
  const logsService = app.get(LogsService);
  eventsService.attach(app.getHttpServer(), config.allowedOrigins);
  logsService.append({
    source: "agent",
    event: "agent.starting",
    message: "Peripheral Agent starting",
    metadata: {
      platform: process.platform,
      architecture: process.arch,
      version: config.version,
    },
  });

  await app.listen(config.port, config.bind);

  console.log(
    `${config.agentName} running in ${config.mode} mode on http://${config.bind}:${config.port}`,
  );

  if (config.realAdaptersEnabled) {
    const devicesService = app.get(DevicesService);
    setImmediate(() => {
      devicesService.discoverOnStartup();
    });
  }

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log(`${config.agentName} stopping after ${signal}.`);
    logsService.append({
      source: "agent",
      event: "shutdown.clean",
      message: "Peripheral Agent shutting down cleanly",
      metadata: { signal },
    });
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
