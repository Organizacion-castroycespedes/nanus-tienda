import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSaleTicketInputFromPos,
  hasCashPeripheralPayment,
  isCashPeripheralPayment,
  runSalePeripheralOperations,
} from "./pos-sale-integration";

test("automatic POS ticket uses the canonical semantic fields", () => {
  const ticket = buildSaleTicketInputFromPos({
    saleId: "sale-1",
    tenantId: "tenant-1",
    branchId: "branch-1",
    businessName: "Empresa QA",
    logo: "data:image/png;base64,logo",
    items: [{ name: "Producto", quantity: 1, unitPrice: 32000, total: 32000 }],
    subtotal: 32000,
    taxes: 0,
    discounts: 0,
    total: 32000,
    payments: [{ paymentMethodId: "cash", methodName: "Efectivo", amount: 32000 }],
  });

  assert.equal(ticket.businessName, "Empresa QA");
  assert.equal(ticket.logo, "data:image/png;base64,logo");
  assert.deepEqual(ticket.payments, [{ method: "Efectivo", amount: 32000 }]);
  assert.equal(ticket.footer, "Gracias por su compra");
});

test("sale cash predicate accepts canonical cash, code and name", () => {
  assert.equal(
    isCashPeripheralPayment({
      paymentMethodId: "cash-1",
      amount: 40000,
      methodType: "CASH",
    }),
    true
  );
  assert.equal(
    isCashPeripheralPayment({
      paymentMethodId: "cash-2",
      amount: 40000,
      methodType: "BANK",
      methodCode: "EFECTIVO",
    }),
    true
  );
  assert.equal(
    isCashPeripheralPayment({
      paymentMethodId: "cash-3",
      amount: 40000,
      methodType: "CARD",
      methodName: "Pago en Efectivo",
    }),
    true
  );
  assert.equal(
    isCashPeripheralPayment({
      paymentMethodId: "card-1",
      amount: 40000,
      methodType: "CARD",
      methodName: "Tarjeta",
    }),
    false
  );
});

test("sale cash detection stays positive when any payment is cash", () => {
  assert.equal(
    hasCashPeripheralPayment([
      {
        paymentMethodId: "card-1",
        amount: 10000,
        methodType: "CARD",
        methodName: "Tarjeta",
      },
      {
        paymentMethodId: "cash-1",
        amount: 30000,
        methodType: "BANK",
        methodCode: "EFECTIVO",
      },
    ]),
    true
  );

  assert.equal(
    hasCashPeripheralPayment([
      {
        paymentMethodId: "card-1",
        amount: 40000,
        methodType: "CARD",
        methodName: "Tarjeta",
      },
    ]),
    false
  );
});

test("sale flow resolves the canonical terminal and printer-backed drawer", async () => {
  const previousFetch = globalThis.fetch;
  const previousAgentUrl = process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = "http://127.0.0.1:4050";
  process.env.NEXT_PUBLIC_PERIPHERALS_ENABLED = "true";
  process.env.NEXT_PUBLIC_PERIPHERALS_PRINT_SALE_ENABLED = "true";
  process.env.NEXT_PUBLIC_PERIPHERALS_OPEN_DRAWER_ENABLED = "true";

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url === "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1") {
      return new Response(
        JSON.stringify({
          terminalId: "local-terminal",
          agentTerminalCode: "local-terminal",
          operationalTerminalId: "693921eb-d28d-4c1b-af17-087b589c6467",
          operationalTerminalCode: "TERM-001",
          operationalTerminalName: "Terminal 1",
          posTerminalId: "terminal-1",
          tenantId: "tenant-1",
          branchId: "branch-1",
          branchName: "Sucursal 1",
          code: "TERM-001",
          name: "Caja 1",
          mode: "REAL",
          active: true,
          source: "CONFIGURED",
          printerDeviceId: "usb-printer-804a1994045911fd",
          cashDrawerDeviceId: "mock-cashdrawer-001",
          scaleDeviceId: "mock-scale-001",
          scannerDeviceId: "mock-scanner-001",
          features: {
            printSale: true,
            printPurchase: true,
            printOrder: true,
            openDrawer: true,
            scale: true,
            scanner: true,
          },
          createdAt: null,
          updatedAt: null,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (url === "http://127.0.0.1:4050/printer/print-ticket") {
      const payload = JSON.parse(String(init?.body)) as {
        terminalId?: string;
        deviceId?: string;
      };
      assert.equal(payload.terminalId, "693921eb-d28d-4c1b-af17-087b589c6467");
      assert.equal(payload.deviceId, "usb-printer-804a1994045911fd");
      return new Response(JSON.stringify({ success: true, jobId: "job-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url === "http://127.0.0.1:4050/cash-drawer/open") {
      const payload = JSON.parse(String(init?.body)) as {
        terminalId?: string;
        deviceId?: string;
        printerDeviceId?: string;
      };
      assert.equal(payload.terminalId, "693921eb-d28d-4c1b-af17-087b589c6467");
      assert.equal(payload.deviceId, "usb-printer-804a1994045911fd");
      assert.equal(payload.printerDeviceId, "usb-printer-804a1994045911fd");
      return new Response(
        JSON.stringify({
          success: true,
          commandId: "drawer-1",
          mode: "REAL",
          printerDeviceId: "usb-printer-804a1994045911fd",
          deviceId: "usb-printer-804a1994045911fd",
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
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await runSalePeripheralOperations({
      saleId: "sale-1",
      tenantId: "tenant-1",
      branchId: "branch-1",
      terminalId: "local-terminal",
      items: [],
      subtotal: 100,
      taxes: 0,
      discounts: 0,
      total: 100,
      payments: [
        {
          paymentMethodId: "cash-1",
          amount: 100,
          methodType: "BANK",
          methodCode: "EFECTIVO",
        },
      ],
    });

    assert.equal(result.some((item) => item.operation === "cash-drawer"), true);
    assert.equal(result.some((item) => item.operation === "print"), true);
    assert.equal(result.find((item) => item.operation === "print")?.message, "Ticket enviado a impresion");
    assert.equal(result.find((item) => item.operation === "cash-drawer")?.message, "Cajon abierto");
    assert.equal(result.some((item) => item.message.includes("MOCK")), false);
    assert.equal(calls[0].url, "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1");
    assert.equal(calls[1].url, "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1");
    assert.equal(calls[2].url, "http://127.0.0.1:4050/printer/print-ticket");
    assert.equal(calls[3].url, "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1");
    assert.equal(calls[4].url, "/pos-terminals/resolve-current?tenantId=tenant-1&branchId=branch-1");
    assert.equal(calls[5].url, "http://127.0.0.1:4050/cash-drawer/open");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousAgentUrl === undefined) {
      delete process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL;
    } else {
      process.env.NEXT_PUBLIC_PERIPHERALS_AGENT_HTTP_URL = previousAgentUrl;
    }
  }
});
