import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getPeripheralAgentConfig, requestPeripheral } from "./api";

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

test("Electron bridge wins over invalid production Agent URL", async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousFetch = globalThis.fetch;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  let fetchCalls = 0;
  const health = { status: "ok", mode: "REAL", version: "0.1.1-qa.9" };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      manusTerminal: {
        getAgentHealth: async () => health,
        listDevices: async () => [],
        discoverDevices: async () => ({ devices: [] }),
        createDevice: async () => ({}),
        updateDevice: async () => ({}),
        testPrint: async () => ({}),
        openCashDrawer: async () => ({}),
        simulateScanner: async () => ({}),
        currentWeight: async () => ({}),
        listLogs: async () => [],
      },
    },
  });
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("renderer fetch must not run");
  }) as typeof fetch;

  try {
    process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://agent.example.com";
    assert.equal(await requestPeripheral<typeof health>("/health"), health);
    assert.equal(fetchCalls, 0);
  } finally {
    if (previousAgentUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    }
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("Electron bridge fails closed for an unmapped peripheral path", async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      manusTerminal: {
        getAgentHealth: async () => ({ status: "ok" }),
        listDevices: async () => [],
        discoverDevices: async () => ({ devices: [] }),
        createDevice: async () => ({}),
        updateDevice: async () => ({}),
        testPrint: async () => ({}),
        openCashDrawer: async () => ({}),
        simulateScanner: async () => ({}),
        currentWeight: async () => ({}),
        listLogs: async () => [],
      },
    },
  });
  globalThis.fetch = (async () => {
    throw new Error("renderer fetch must not run");
  }) as typeof fetch;

  try {
    await assert.rejects(
      requestPeripheral("/arbitrary-local-endpoint"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("operación aún no está disponible")
    );
  } finally {
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("Electron bridge routes discovery and device updates without renderer HTTP", async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousFetch = globalThis.fetch;
  const calls: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      manusTerminal: {
        getAgentHealth: async () => ({ status: "ok" }),
        listDevices: async () => {
          calls.push("devices");
          return [];
        },
        discoverDevices: async (terminalId: string) => {
          calls.push(`discover:${terminalId}`);
          return { devices: [] };
        },
        createDevice: async () => ({}),
        updateDevice: async (deviceId: string, payload: unknown) => {
          calls.push(`update:${deviceId}:${JSON.stringify(payload)}`);
          return { id: deviceId };
        },
        testPrint: async () => ({}),
        openCashDrawer: async () => ({}),
        simulateScanner: async () => ({}),
        currentWeight: async () => ({}),
        listLogs: async () => [],
      },
    },
  });
  globalThis.fetch = (async () => {
    throw new Error("renderer fetch must not run");
  }) as typeof fetch;

  try {
    await requestPeripheral("/devices");
    await requestPeripheral("/devices/discover", {
      method: "POST",
      body: JSON.stringify({ terminalId: "terminal-1" }),
    });
    await requestPeripheral("/devices/device-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "READY" }),
    });
    assert.deepEqual(calls, [
      "devices",
      "discover:terminal-1",
      'update:device-1:{"status":"READY"}',
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
