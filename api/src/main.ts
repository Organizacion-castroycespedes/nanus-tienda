import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";
import process from "node:process";

const bootstrap = async () => {
  try {
    process.loadEnvFile();
  } catch {
    process.loadEnvFile("apps/api/.env");
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);
};

bootstrap();
