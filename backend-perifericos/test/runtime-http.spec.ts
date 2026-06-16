import "reflect-metadata";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { buildPeripheralsCorsOptions } from "../src/shared/config/peripherals.config";
import { SanitizedHttpExceptionFilter } from "../src/shared/filters/sanitized-http-exception.filter";

const readJson = async <T>(response: Response): Promise<T> => {
  return (await response.json()) as T;
};

test("runtime HTTP endpoints resolve Nest-injected services under tsx", async (t) => {
  const allowedOrigin = "https://www.apptiendamanus.space";
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalFilters(new SanitizedHttpExceptionFilter());
  app.enableCors(buildPeripheralsCorsOptions([allowedOrigin]));

  const server = await app.listen(0, "127.0.0.1");
  t.after(async () => {
    await app.close();
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);

  const devices = await fetch(`${baseUrl}/devices`);
  assert.equal(devices.status, 200);
  const devicePayload = await readJson<unknown[]>(devices);
  assert.equal(devicePayload.length, 4);

  const logs = await fetch(`${baseUrl}/logs`);
  assert.equal(logs.status, 200);
  assert.equal(Array.isArray(await readJson<unknown>(logs)), true);

  const discover = await fetch(`${baseUrl}/devices/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ terminalId: "local-terminal" }),
  });
  assert.equal(discover.status, 201);
  const discoverPayload = await readJson<{ success: boolean }>(discover);
  assert.equal(discoverPayload.success, true);

  const testPrint = await fetch(`${baseUrl}/printer/test-print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      terminalId: "local-terminal",
      deviceId: "mock-printer-001",
    }),
  });
  assert.equal(testPrint.status, 201);
  const testPrintPayload = await readJson<{
    success: boolean;
    mode: string;
    adapterName: string;
  }>(testPrint);
  assert.equal(testPrintPayload.success, true);
  assert.equal(testPrintPayload.mode, "MOCK");
  assert.equal(testPrintPayload.adapterName, "MockPrinterAdapter");

  const allowedPreflight = await fetch(`${baseUrl}/devices`, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(allowedPreflight.status, 204);
  assert.equal(
    allowedPreflight.headers.get("access-control-allow-origin"),
    allowedOrigin
  );
  assert.match(
    allowedPreflight.headers.get("access-control-allow-methods") ?? "",
    /POST/
  );
  assert.match(
    allowedPreflight.headers.get("access-control-allow-headers") ?? "",
    /Content-Type/i
  );

  const disallowedPreflight = await fetch(`${baseUrl}/devices`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://malicious.example",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(
    disallowedPreflight.headers.get("access-control-allow-origin"),
    null
  );
});
