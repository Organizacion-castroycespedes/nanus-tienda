import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getPeripheralAgentConfig } from "./api";

const withProductionEnvironment = (
  httpUrl: string | undefined,
  wsUrl: string | undefined,
  assertion: () => void
) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousHttpUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  const previousWsUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL;
  Object.defineProperty(process.env, "NODE_ENV", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: "production",
  });
  if (httpUrl === undefined) {
    delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  } else {
    process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = httpUrl;
  }
  if (wsUrl === undefined) {
    delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL;
  } else {
    process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL = wsUrl;
  }

  try {
    assertion();
  } finally {
    Object.defineProperty(process.env, "NODE_ENV", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: previousNodeEnv,
    });
    if (previousHttpUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousHttpUrl;
    }
    if (previousWsUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL = previousWsUrl;
    }
  }
};

test("production defaults to the local Manus service without environment variables", () => {
  withProductionEnvironment(undefined, undefined, () => {
    const config = getPeripheralAgentConfig();
    assert.equal(config.httpUrl, "http://127.0.0.1:4050");
    assert.equal(config.wsUrl, "ws://127.0.0.1:4050/peripherals");
    assert.equal(config.isConfigured, true);
    assert.equal(config.source, "loopback-default");
  });
});

test("production permits HTTP and WS for localhost and IPv4 loopback", () => {
  for (const httpUrl of ["http://localhost:4050", "http://127.0.0.1:4050"]) {
    withProductionEnvironment(httpUrl, undefined, () => {
      assert.equal(getPeripheralAgentConfig().isConfigured, true);
    });
  }
});

test("production rejects remote HTTP and permits remote HTTPS override", () => {
  withProductionEnvironment("http://agent.example.com", undefined, () => {
    assert.equal(getPeripheralAgentConfig().status, "invalid");
  });
  withProductionEnvironment("https://agent.example.com", undefined, () => {
    const config = getPeripheralAgentConfig();
    assert.equal(config.status, "configured");
    assert.equal(config.httpUrl, "https://agent.example.com");
    assert.equal(config.wsUrl, "wss://agent.example.com/peripherals");
    assert.equal(config.source, "environment");
  });
});

test("operator-facing peripheral components do not mention NEXT_PUBLIC variables", () => {
  for (const file of [
    "components/PeripheralsPage.tsx",
    "components/PeripheralsAdminWorkspace.tsx",
  ]) {
    const source = readFileSync(join(process.cwd(), "domains", "peripherals", file), "utf8");
    assert.equal(source.includes("NEXT_PUBLIC_"), false, file);
  }
});
