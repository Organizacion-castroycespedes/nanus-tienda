import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";
import { AppModule } from "./app.module";
import {
  buildPeripheralsCorsOptions,
  getPeripheralsConfig,
} from "./shared/config/peripherals.config";
import { SanitizedHttpExceptionFilter } from "./shared/filters/sanitized-http-exception.filter";
import { EventsService } from "./modules/events/events.service";
import { DevicesService } from "./modules/devices/devices.service";
import { loadAgentLocalConfig } from "./platform/agent-local-config";

loadEnv();
loadAgentLocalConfig();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = getPeripheralsConfig();

  app.useGlobalFilters(new SanitizedHttpExceptionFilter());
  app.enableCors(buildPeripheralsCorsOptions(config.allowedOrigins));

  const eventsService = app.get(EventsService);
  eventsService.attach(app.getHttpServer(), config.allowedOrigins);

  if (config.realAdaptersEnabled) {
    app.get(DevicesService).discoverOnStartup();
  }

  await app.listen(config.port, config.bind);

  console.log(
    `${config.agentName} running in ${config.mode} mode on http://${config.bind}:${config.port}`,
  );

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log(`${config.agentName} stopping after ${signal}.`);
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void bootstrap();
