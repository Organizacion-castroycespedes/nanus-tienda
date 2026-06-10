import { Request, Response, NextFunction } from "express";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import process from "node:process";
import { assertAuthEnv } from "./common/config/auth-env";
import { loadApiEnv } from "./common/config/env";


/**
 * =========================
 * Helpers
 * =========================
 */

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
  allowedOrigins: string[],
): boolean => {
  // Permitir requests sin origin (mobile apps, Postman, etc.)
  if (!origin) return true;

  const requestOrigin = normalizeOrigin(origin);
  if (!requestOrigin) return false;

  return allowedOrigins.some((allowedOrigin) => {
    const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);

    if (normalizedAllowedOrigin) {
      const sameProtocol =
        normalizedAllowedOrigin.protocol === requestOrigin.protocol;

      const sameHost =
        normalizedAllowedOrigin.hostname === requestOrigin.hostname ||
        requestOrigin.hostname.endsWith(
          `.${normalizedAllowedOrigin.hostname}`,
        ) ||
        normalizedAllowedOrigin.hostname ===
          requestOrigin.hostname.replace(/^www\./, "");

      const samePort =
        !normalizedAllowedOrigin.port ||
        normalizedAllowedOrigin.port === requestOrigin.port;

      return sameProtocol && sameHost && samePort;
    }

    // Caso dominio sin protocolo
    return (
      allowedOrigin === requestOrigin.hostname ||
      requestOrigin.hostname.endsWith(`.${allowedOrigin}`)
    );
  });
};

/**
 * =========================
 * Bootstrap
 * =========================
 */

const bootstrap = async () => {
  loadApiEnv();
  assertAuthEnv();

  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);
  const { AppModule } = await import("./modules/app.module");

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  /**
   * =====================================
   * Middleware CORS (CONTROL TOTAL)
   * =====================================
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && isOriginAllowed(origin, allowedOrigins)) {
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");

      res.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );

      // 🔥 Dinámico: acepta cualquier header que pida el navegador
      res.header(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] ||
          "Content-Type, Authorization, Accept, Origin, X-Requested-With",
      );

      res.header("Access-Control-Expose-Headers", "Authorization");
    }

    // 🔥 Manejo explícito de preflight
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });

  /**
   * =====================================
   * CORS de Nest (fallback/control interno)
   * =====================================
   */
  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, true);
      }

      console.warn("CORS blocked:", origin);
      return callback(null, false);
    },
    credentials: true,
    allowedHeaders: "*", // 🔥 evita problemas futuros
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposedHeaders: ["Authorization"],
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 4000);

  console.log("🚀 API running on port", process.env.PORT || 4000);
};

bootstrap();
