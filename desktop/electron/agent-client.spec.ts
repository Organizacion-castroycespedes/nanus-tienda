import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import { DISCOVERY_REQUEST_TIMEOUT_MS, discoverAgentDevices, getAgentHealth } from "./agent-client.js";

const config = {
  environment: "qa" as const,
  frontendUrl: "https://www.apptiendamanus.space",
  allowedOrigins: ["https://www.apptiendamanus.space"],
  agentLoopbackOrigin: "http://127.0.0.1:4050",
};

const withServer = async (
  handler: http.RequestListener,
  callback: (port: number) => Promise<void>,
) => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await callback(address.port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const configForPort = (port: number) => ({ ...config, agentLoopbackOrigin: `http://127.0.0.1:${port}` });

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

describe("getAgentHealth", () => {
  it("normalizes a real health response", async () => {
    await withServer((_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ status: "ok", mode: "REAL", version: "0.1.1-qa.4", platform: "win32" }));
    }, async (port) => {
      assert.deepEqual(await getAgentHealth(configForPort(port)), {
        available: true,
        status: "ok",
        mode: "REAL",
        version: "0.1.1-qa.4",
        platform: "win32",
      });
    });
  });

  it("returns a safe unavailable result when the agent is absent", async () => {
    const result = await getAgentHealth(configForPort(9));
    assert.equal(result.available, false);
    assert.ok(result.reason === "UNAVAILABLE" || result.reason === "TIMEOUT");
  });

  it("rejects malformed and oversized responses", async () => {
    await withServer((_request, response) => response.end("not-json"), async (port) => {
      assert.deepEqual(await getAgentHealth(configForPort(port)), { available: false, reason: "INVALID_RESPONSE" });
    });

    await withServer((_request, response) => response.end("x".repeat(70 * 1024)), async (port) => {
      assert.deepEqual(await getAgentHealth(configForPort(port)), { available: false, reason: "INVALID_RESPONSE" });
    });
  });
});

describe("discoverAgentDevices", () => {
  it("allows physical discovery to exceed the short default request timeout", async () => {
    await withServer(async (_request, response) => {
      await wait(3_000);
      response.statusCode = 201;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ devices: [{ id: "usb-printer-slow" }] }));
    }, async (port) => {
      const result = await discoverAgentDevices(configForPort(port), "terminal-qa");
      assert.deepEqual(result, { devices: [{ id: "usb-printer-slow" }] });
    });
  });

  it("keeps discovery finite and reports AGENT_TIMEOUT", async () => {
    await withServer(async (_request, response) => {
      await wait(DISCOVERY_REQUEST_TIMEOUT_MS + 100);
      response.end(JSON.stringify({ devices: [] }));
    }, async (port) => {
      await assert.rejects(
        discoverAgentDevices(configForPort(port), "terminal-qa"),
        (error: unknown) => error instanceof Error && error.message === "AGENT_TIMEOUT",
      );
    });
  });
});
