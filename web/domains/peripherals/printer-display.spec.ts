import assert from "node:assert/strict";
import test from "node:test";
import { resolvePrinterDisplayName } from "./printer-display";

const config = { printerDeviceId: "printer-1" };

test("uses the real USB printer name for the header", () => {
  assert.equal(
    resolvePrinterDisplayName(config, [
      {
        id: "printer-1",
        type: "PRINTER",
        name: "Impresora POS",
        status: "CONNECTED",
        connectionType: "USB",
        terminalId: "terminal-1",
        usb: { deviceId: "usb-1", printerName: "Xprinter XP-80C" },
      },
    ]),
    "Xprinter XP-80C"
  );
});

test("returns null when the configured printer is not available", () => {
  assert.equal(resolvePrinterDisplayName(config, []), null);
});
