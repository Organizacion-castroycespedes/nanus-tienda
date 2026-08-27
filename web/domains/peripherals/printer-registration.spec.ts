import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPrinterPayload,
  printerDefaults,
  validatePrinterForm,
} from "./printer-registration";

test("historical configuration without manufacturer or model remains valid", () => {
  const form = {
    ...printerDefaults,
    id: "printer-legacy-001",
    name: "Xprinter XP-80T",
    host: "printer.local",
    port: "9100",
    terminalId: "terminal-caja-1",
  };

  assert.equal(validatePrinterForm(form), null);

  const payload = buildPrinterPayload(form);
  assert.equal(payload.metadata, undefined);
  assert.equal(payload.connectionType, "NETWORK");
  assert.equal(payload.network?.port, 9100);
});

test("XPrinter existing device does not become Digital POS by default", () => {
  assert.equal(printerDefaults.manufacturer, "");
  assert.equal(printerDefaults.model, "");

  const form = {
    ...printerDefaults,
    id: "printer-xp80t-lan-001",
    name: "Xprinter XP-80T",
    host: "printer.local",
    terminalId: "terminal-caja-1",
  };

  assert.equal(validatePrinterForm(form), null);

  const payload = buildPrinterPayload(form);
  assert.equal(payload.metadata, undefined);
  assert.equal(payload.name, "Xprinter XP-80T");
});

test("generic NETWORK printer keeps blank manufacturer and model", () => {
  const form = {
    ...printerDefaults,
    id: "printer-network-generic-001",
    name: "Impresora red",
    host: "printer.local",
    terminalId: "terminal-caja-1",
  };

  assert.equal(validatePrinterForm(form), null);

  const payload = buildPrinterPayload(form);
  assert.equal(payload.metadata, undefined);
  assert.equal(payload.network?.port, 9100);
});

test("DIG-E200I explicit form uses manufacturer, model and 9100 default", () => {
  const form = {
    ...printerDefaults,
    id: "printer-dig-e200i-lan-001",
    name: "Digital POS DIG-E200I",
    manufacturer: "Digital POS",
    model: "DIG-E200I",
    host: "printer.local",
    terminalId: "terminal-caja-1",
  };

  assert.equal(validatePrinterForm(form), null);
  assert.equal(form.port, "9100");

  const payload = buildPrinterPayload(form);
  assert.equal(payload.metadata?.manufacturer, "Digital POS");
  assert.equal(payload.metadata?.model, "DIG-E200I");
  assert.equal(payload.network?.port, 9100);
});

test("DIG-E200I preserves overridden port", () => {
  const form = {
    ...printerDefaults,
    id: "printer-dig-e200i-lan-002",
    name: "Digital POS DIG-E200I",
    manufacturer: "Digital POS",
    model: "DIG-E200I",
    host: "printer.local",
    port: "9200",
    terminalId: "terminal-caja-1",
  };

  assert.equal(validatePrinterForm(form), null);

  const payload = buildPrinterPayload(form);
  assert.equal(payload.network?.port, 9200);
});

test("editing existing printer data keeps prior values over defaults", () => {
  const existing = {
    ...printerDefaults,
    id: "printer-edit-001",
    name: "Xprinter XP-80T",
    host: "printer.local",
    port: "9200",
    terminalId: "terminal-caja-1",
  };
  const edited = {
    ...printerDefaults,
    ...existing,
    name: "Xprinter XP-80T LAN",
  };

  assert.equal(edited.port, "9200");
  assert.equal(edited.name, "Xprinter XP-80T LAN");
  assert.equal(validatePrinterForm(edited), null);
});

test("USB existing printer does not receive NETWORK defaults accidentally", () => {
  const form = {
    ...printerDefaults,
    id: "printer-xp80t-usb-001",
    name: "Xprinter XP-80T USB",
    connectionType: "USB" as const,
    usbDeviceId: "usb-printer-123",
    terminalId: "terminal-caja-1",
  };

  assert.equal(validatePrinterForm(form), null);

  const payload = buildPrinterPayload(form, {
    id: "usb-printer-123",
    type: "PRINTER",
    name: "Xprinter XP-80T USB",
    status: "CONNECTED",
    connectionType: "USB",
    terminalId: "local-terminal",
    profileId: "THERMAL_80MM",
    usb: { deviceId: "usb-printer-123", printerName: "Xprinter XP-80T USB" },
  });

  assert.equal(payload.connectionType, "USB");
  assert.equal(payload.network, undefined);
  assert.equal(payload.metadata, undefined);
  assert.equal(payload.usb?.deviceId, "usb-printer-123");
});
