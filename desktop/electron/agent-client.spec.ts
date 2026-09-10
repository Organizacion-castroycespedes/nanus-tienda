import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import { getAgentHealth } from "./agent-client.js";

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
