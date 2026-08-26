import assert from "node:assert/strict";
import test from "node:test";
import {
  isPrinterBackedCashDrawer,
  resolveCashDrawerDeviceIdForOperation,
  resolveCashDrawerDeviceIdToPersist,
} from "./cash-drawer-routing";

test("printer-backed drawer persists the printer device id when certified", () => {
  assert.equal(
    resolveCashDrawerDeviceIdToPersist({
      currentCashDrawerDeviceId: "mock-cashdrawer-001",
      selectedPrinterDeviceId: "usb-printer-45207a0cc744eb10",
      selectedPrinterConnectionType: "USB",
      printerDrawerCertified: true,
    }),
    "usb-printer-45207a0cc744eb10"
  );

  assert.equal(
    isPrinterBackedCashDrawer({
      currentCashDrawerDeviceId: "usb-printer-45207a0cc744eb10",
      selectedPrinterDeviceId: "usb-printer-45207a0cc744eb10",
      selectedPrinterConnectionType: "USB",
      printerDrawerCertified: true,
    }),
    true
  );
});

test("standalone drawer keeps the existing cash drawer device id", () => {
  assert.equal(
    resolveCashDrawerDeviceIdToPersist({
      currentCashDrawerDeviceId: "mock-cashdrawer-001",
      selectedPrinterDeviceId: "usb-printer-45207a0cc744eb10",
      selectedPrinterConnectionType: "USB",
      printerDrawerCertified: false,
    }),
    "mock-cashdrawer-001"
  );

  assert.equal(
    isPrinterBackedCashDrawer({
      currentCashDrawerDeviceId: "mock-cashdrawer-001",
      selectedPrinterDeviceId: "usb-printer-45207a0cc744eb10",
      selectedPrinterConnectionType: "USB",
      printerDrawerCertified: false,
    }),
    false
  );
});

test("mock fallback keeps the mock cash drawer device id", () => {
  assert.equal(
    resolveCashDrawerDeviceIdForOperation({
      currentCashDrawerDeviceId: "mock-cashdrawer-001",
      selectedPrinterDeviceId: "mock-printer-001",
      selectedPrinterConnectionType: "MOCK",
      printerDrawerCertified: false,
    }),
    "mock-cashdrawer-001"
  );
});
