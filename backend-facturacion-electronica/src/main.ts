import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { config as loadEnv } from "dotenv";
import { AppModule } from "./app.module";
import { getServiceConfig } from "./config/electronic-invoicing.config";

loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const serviceConfig = getServiceConfig();

  app.enableShutdownHooks();
  await app.listen(serviceConfig.port);
}

void bootstrap();
