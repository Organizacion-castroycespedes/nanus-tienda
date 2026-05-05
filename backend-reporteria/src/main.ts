import { Request, Response, NextFunction } from "express";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import * as path from "path";
import process from "node:process";
import { AppModule } from "./app.module";

const parseAllowedOrigins = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const normalizeOrigin = (origin: string): URL | null => {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
};

const isOriginAllowed = (
  origin: string | undefined,
  allowedOrigins: string[]
): boolean => {
  if (!origin) {
    return true;
  }

  const requestOrigin = normalizeOrigin(origin);
  if (!requestOrigin) {
    return false;
  }

  return allowedOrigins.some((allowedOrigin) => {
    const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);

    if (normalizedAllowedOrigin) {
      const sameProtocol =
        normalizedAllowedOrigin.protocol === requestOrigin.protocol;
      const sameHost =
        normalizedAllowedOrigin.hostname === requestOrigin.hostname ||
        requestOrigin.hostname.endsWith(
          `.${normalizedAllowedOrigin.hostname}`
        ) ||
        normalizedAllowedOrigin.hostname ===
          requestOrigin.hostname.replace(/^www\./, "");
      const samePort =
        !normalizedAllowedOrigin.port ||
        normalizedAllowedOrigin.port === requestOrigin.port;

      return sameProtocol && sameHost && samePort;
    }

    return (
      allowedOrigin === requestOrigin.hostname ||
      requestOrigin.hostname.endsWith(`.${allowedOrigin}`)
    );
  });
};

const bootstrap = async () => {
  dotenv.config({
    path: path.resolve(process.cwd(), ".env"),
  });

  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );
      res.header(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] ||
          "Content-Type, Authorization, Accept, Origin, X-Requested-With"
      );
      res.header("Access-Control-Expose-Headers", "Authorization");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    allowedHeaders: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["Authorization"],
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 4100;
  await app.listen(port);

  console.log("backend-reporteria running on port", port);
};

void bootstrap();
