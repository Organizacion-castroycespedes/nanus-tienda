import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";
import { AppModule } from "./app.module";
import {
  getPeripheralsConfig,
  isOriginAllowed,
} from "./shared/config/peripherals.config";
import { SanitizedHttpExceptionFilter } from "./shared/filters/sanitized-http-exception.filter";
import { EventsService } from "./modules/events/events.service";

loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = getPeripheralsConfig();

  app.useGlobalFilters(new SanitizedHttpExceptionFilter());
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin, config.allowedOrigins));
    },
    credentials: true,
    allowedHeaders: "*",
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    optionsSuccessStatus: 204,
  });

  const eventsService = app.get(EventsService);
  eventsService.attach(app.getHttpServer(), config.allowedOrigins);

  await app.listen(config.port, "127.0.0.1");

  console.log(
    `${config.agentName} running in ${config.mode} mode on http://localhost:${config.port}`
  );
}

void bootstrap();
