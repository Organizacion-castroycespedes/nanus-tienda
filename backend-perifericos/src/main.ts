import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";
import { json } from "express";
import { AppModule } from "./app.module";
import {
  buildPeripheralsCorsOptions,
  buildPrivateNetworkAccessMiddleware,
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
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Company logos are persisted as bounded data URIs. The default Express
  // JSON limit rejects valid tenant logos before the printer controller sees
  // them, so use a bounded Agent-specific limit.
  app.use(json({ limit: "6mb" }));
  const config = getPeripheralsConfig();

  app.useGlobalFilters(new SanitizedHttpExceptionFilter());
  app.use(buildPrivateNetworkAccessMiddleware(config.allowedOrigins));
  const corsOptions = buildPeripheralsCorsOptions(config.allowedOrigins);
  app.enableCors(corsOptions);

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
