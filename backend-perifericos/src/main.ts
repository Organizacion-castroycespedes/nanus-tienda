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

loadEnv();

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

  await app.listen(config.port, "127.0.0.1");

  console.log(
    `${config.agentName} running in ${config.mode} mode on http://localhost:${config.port}`
  );
}

void bootstrap();
