import assert from "node:assert/strict";
import test from "node:test";
import {
  isRealPrinterConfig,
  openCashDrawer,
  printReporteriaSaleTicket,
  subscribePeripheralEvents,
} from "./contracts";
import type { PosTerminalResolvedConfig, SaleTicketInput } from "./types";

const configured = (printerDeviceId: string): PosTerminalResolvedConfig => ({
  terminalId: "caja-1", agentTerminalCode: "caja-1",
  operationalTerminalId: "operational-terminal-1",
  operationalTerminalCode: "TERM-001",
  operationalTerminalName: "Terminal 1 Sucursal Principal",
  posTerminalId: "terminal-1", tenantId: "tenant-1",
  branchId: "branch-1", code: "caja-1", name: "Caja 1", mode: "REAL",
  active: true, source: "CONFIGURED", printerDeviceId,
  cashDrawerDeviceId: "mock-cashdrawer-001", scaleDeviceId: "mock-scale-001",
  scannerDeviceId: "mock-scanner-001",
  features: { printSale: true, printPurchase: true, printOrder: true, openDrawer: true, scale: true, scanner: true },
});

test("real terminal requires a non-mock printer", () => {
  assert.equal(isRealPrinterConfig(configured("usb-printer-1")), true);
  assert.equal(isRealPrinterConfig(configured("mock-printer-001")), false);
});

const saleTicket: SaleTicketInput = {
  tenantId: "tenant-1",
  branchId: "branch-1",
  saleId: "sale-1",
  items: [],
  subtotal: 100,
  taxes: 0,
  total: 100,
  payments: [],
};

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

test("Electron event subscription does not evaluate browser Agent configuration", () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  const previousWsUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL;
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
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://agent.example.com";
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL = "ws://agent.example.com/peripherals";
  let callbackCalls = 0;

  try {
    const unsubscribe = subscribePeripheralEvents(() => {
      callbackCalls += 1;
    });
    unsubscribe();
    assert.equal(callbackCalls, 0);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
    if (previousAgentUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    }
    if (previousWsUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_WS_URL = previousWsUrl;
    }
  }
});

test("report direct print resolves the branch terminal before calling the Agent", async () => {
  const previousFetch = globalThis.fetch;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://127.0.0.1:4050";

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.includes("/pos-terminals/resolve-current")) {
      return jsonResponse(configured("usb-printer-1f0028d1fa5243c2"));
    }

    if (url === "http://127.0.0.1:4050/printer/print-ticket") {
      const payload = JSON.parse(String(init?.body)) as {
        terminalId?: string;
        deviceId?: string;
      };
      assert.equal(init?.method, "POST");
      assert.equal(payload.terminalId, "caja-1");
      assert.equal(payload.deviceId, "usb-printer-1f0028d1fa5243c2");
      return jsonResponse({ success: true, jobId: "job-1" });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await printReporteriaSaleTicket(saleTicket, {
      tenantId: "tenant-1",
      branchId: "branch-1",
    });

    assert.equal(result.success, true);
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/pos-terminals\/resolve-current/);
    assert.equal(calls[1].url, "http://127.0.0.1:4050/printer/print-ticket");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAgentUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    }
  }
});

test("report direct print never sends a fallback mock terminal to the Agent", async () => {
  const previousFetch = globalThis.fetch;
  let agentCalled = false;

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/pos-terminals/resolve-current")) {
      return jsonResponse({
        ...configured("mock-printer-001"),
        mode: "MOCK",
        source: "FALLBACK_MOCK",
      });
    }
    agentCalled = true;
    throw new Error(`Agent must not be called: ${url}`);
  };

  try {
    const result = await printReporteriaSaleTicket(saleTicket, {
      tenantId: "tenant-1",
      branchId: "branch-1",
    });

    assert.equal(result.success, false);
    assert.equal(result.error.code, "PRINTER_NOT_CONFIGURED");
    assert.equal(agentCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("report direct print does not send an unconfigured operational terminal to the Agent", async () => {
  const previousFetch = globalThis.fetch;
  let agentCalled = false;

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/pos-terminals/resolve-current")) {
      return jsonResponse({
        ...configured("usb-printer-1f0028d1fa5243c2"),
        terminalId: null,
        agentTerminalCode: null,
        posTerminalId: null,
        mode: null,
        source: "OPERATIONAL_UNCONFIGURED",
        printerDeviceId: null,
      });
    }
    agentCalled = true;
    throw new Error(`Agent must not be called: ${url}`);
  };

  try {
    const result = await printReporteriaSaleTicket(saleTicket, {
      tenantId: "tenant-1",
      branchId: "branch-1",
      terminalId: "11111111-1111-1111-1111-111111111111",
    });

    assert.equal(result.success, false);
    assert.equal(result.error.code, "PRINTER_NOT_CONFIGURED");
    assert.equal(agentCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("report direct print returns AGENT_OFFLINE after real terminal resolution", async () => {
  const previousFetch = globalThis.fetch;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://127.0.0.1:4050";

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/pos-terminals/resolve-current")) {
      return jsonResponse(configured("usb-printer-1f0028d1fa5243c2"));
    }
    throw new TypeError("fetch failed");
  };

  try {
    const result = await printReporteriaSaleTicket(saleTicket, {
      tenantId: "tenant-1",
      branchId: "branch-1",
    });

    assert.equal(result.success, false);
    assert.equal(result.error.code, "AGENT_OFFLINE");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAgentUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    }
  }
});

test("report direct print returns DEVICE_NOT_FOUND from the Agent", async () => {
  const previousFetch = globalThis.fetch;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://127.0.0.1:4050";

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/pos-terminals/resolve-current")) {
      return jsonResponse(configured("usb-printer-1f0028d1fa5243c2"));
    }
    return new Response(JSON.stringify({ message: "Device not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await printReporteriaSaleTicket(saleTicket, {
      tenantId: "tenant-1",
      branchId: "branch-1",
    });

    assert.equal(result.success, false);
    assert.equal(result.error.code, "DEVICE_NOT_FOUND");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAgentUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    }
  }
});

test("local-terminal resolves the canonical configured terminal before drawer routing", async () => {
  const previousFetch = globalThis.fetch;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://127.0.0.1:4050";

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url === "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1") {
      return jsonResponse({
        ...configured("usb-printer-45207a0cc744eb10"),
        terminalId: "local-terminal",
        operationalTerminalId: "693921eb-d28d-4c1b-af17-087b589c6467",
        cashDrawerDeviceId: "mock-cashdrawer-001",
        agentTerminalCode: "local-terminal",
      });
    }

    if (url === "http://127.0.0.1:4050/cash-drawer/open") {
      const payload = JSON.parse(String(init?.body)) as {
        terminalId?: string;
        deviceId?: string;
        printerDeviceId?: string;
        reason?: string;
      };
      assert.equal(init?.method, "POST");
      assert.equal(payload.terminalId, "693921eb-d28d-4c1b-af17-087b589c6467");
      assert.equal(payload.deviceId, "usb-printer-45207a0cc744eb10");
      assert.equal(payload.printerDeviceId, "usb-printer-45207a0cc744eb10");
      return jsonResponse({
        success: true,
        commandId: "drawer-1",
        mode: "REAL",
        printerDeviceId: "usb-printer-45207a0cc744eb10",
        deviceId: "usb-printer-45207a0cc744eb10",
        terminalId: "693921eb-d28d-4c1b-af17-087b589c6467",
        connectionType: "USB",
        commands: [],
        profile: {
          id: "THERMAL_58MM",
          paperWidthMm: 58,
          widthChars: 32,
          supportsCut: false,
          supportsCashDrawerPulse: true,
        },
        pulse: {
          connector: 0,
          pin: 2,
          pulseOnMs: 120,
          pulseOffMs: 120,
        },
        bytesSent: 5,
        message: "drawer opened",
        adapterName: "UsbRawPrinterAdapter",
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await openCashDrawer({
      tenantId: "tenant-1",
      branchId: "branch-1",
      terminalId: "local-terminal",
      deviceId: "mock-cashdrawer-001",
      reason: "SALE_CASH_PAYMENT",
    });

    assert.equal(result.success, true);
    assert.equal(calls[0].url, "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1");
    assert.equal(calls[1].url, "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1");
    assert.equal(calls[2].url, "http://127.0.0.1:4050/cash-drawer/open");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAgentUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    }
  }
});
