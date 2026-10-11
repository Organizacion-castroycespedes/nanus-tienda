import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getPeripheralAgentConfig, PeripheralAgentRequestError, requestPeripheral } from "./api";
import { getScaleCaptureOperatorMessage } from "../../modules/pos/utils/scale-capture-error";

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
        printTicket: async () => ({}),
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
        printTicket: async () => ({}),
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

test("Electron capture bridge preserves SCALE_WEIGHT_ZERO as a semantic error code", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { manusTerminal: { scaleCapture: async () => ({
      kind: "scale-capture-result-v1",
      ok: false,
      errorCode: "SCALE_WEIGHT_ZERO",
    }) } },
  });
  globalThis.fetch = (async () => { throw new Error("renderer fetch must not run"); }) as typeof fetch;

  try {
    await assert.rejects(
      requestPeripheral("/scale/capture", { method: "POST", body: JSON.stringify({ captureId: "capture-1" }) }),
      (error: unknown) => error instanceof PeripheralAgentRequestError
        && error.code === "SCALE_WEIGHT_ZERO"
        && getScaleCaptureOperatorMessage(error) === "Coloca el producto en la balanza para continuar.",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("Electron capture bridge unwraps a positive REAL weight without changing precision", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const response = { captureId: "capture-1", status: "READY", reading: { weight: 0.245, unit: "kg", source: "REAL", unitVerified: true } };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { manusTerminal: { scaleCapture: async () => ({
      kind: "scale-capture-result-v1",
      ok: true,
      value: response,
    }) } },
  });
  globalThis.fetch = (async () => { throw new Error("renderer fetch must not run"); }) as typeof fetch;

  try {
    assert.deepEqual(
      await requestPeripheral<typeof response>("/scale/capture", { method: "POST", body: "{}" }),
      response,
    );
    assert.equal(response.reading.weight, 0.245);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("Electron capture bridge maps unavailable and unknown structured errors safely", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { manusTerminal: { scaleCapture: async () => ({
      kind: "scale-capture-result-v1",
      ok: false,
      errorCode: "AGENT_UNAVAILABLE",
    }) } },
  });
  globalThis.fetch = (async () => { throw new Error("renderer fetch must not run"); }) as typeof fetch;

  try {
    await assert.rejects(
      requestPeripheral("/scale/capture", { method: "POST", body: "{}" }),
      (error: unknown) => error instanceof PeripheralAgentRequestError && error.code === "AGENT_OFFLINE",
    );
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { manusTerminal: { scaleCapture: async () => ({
        kind: "scale-capture-result-v1",
        ok: false,
        errorCode: "AGENT_HTTP_ERROR",
      }) } },
    });
    await assert.rejects(
      requestPeripheral("/scale/capture", { method: "POST", body: "{}" }),
      (error: unknown) => error instanceof PeripheralAgentRequestError
        && error.code === "HTTP_ERROR"
        && !error.message.includes("AGENT_HTTP_ERROR"),
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("browser capture transport classifies the exact Agent zero-weight code", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = globalThis.fetch;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://127.0.0.1:4050";
  globalThis.fetch = (async () => new Response(JSON.stringify({ message: "SCALE_WEIGHT_ZERO" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;

  try {
    await assert.rejects(
      requestPeripheral("/scale/capture", { method: "POST", body: JSON.stringify({ captureId: "capture-1" }) }),
      (error: unknown) => error instanceof PeripheralAgentRequestError && error.code === "SCALE_WEIGHT_ZERO",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAgentUrl === undefined) delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    else process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
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
        printTicket: async (payload: unknown) => {
          calls.push(`print-ticket:${JSON.stringify(payload)}`);
          return { success: true };
        },
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
    await requestPeripheral("/printer/print-ticket", {
      method: "POST",
      body: JSON.stringify({ deviceId: "printer-1" }),
    });
    assert.deepEqual(calls, [
      "devices",
      "discover:terminal-1",
      'update:device-1:{"status":"READY"}',
      'print-ticket:{"deviceId":"printer-1"}',
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});
