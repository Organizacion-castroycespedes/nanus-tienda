import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPrinterPayload,
  printerDefaults,
  validatePrinterForm,
} from "./printer-registration";

test("USB hides network requirements in registration validation", () => {
  const form = {
    ...printerDefaults,
    id: "printer-xp80t-usb-001",
    connectionType: "USB" as const,
    usbDeviceId: "usb-printer-123",
  };

  assert.equal(validatePrinterForm(form), null);
  const payload = buildPrinterPayload(form, {
    id: "usb-printer-123",
    type: "PRINTER",
    name: "Xprinter XP-80T",
    status: "CONNECTED",
    connectionType: "USB",
    terminalId: "local-terminal",
    profileId: "THERMAL_80MM",
    usb: { deviceId: "usb-printer-123", printerName: "Xprinter XP-80T USB" },
  });

  assert.equal(payload.connectionType, "USB");
  assert.equal(payload.network, undefined);
  assert.equal(payload.usb?.deviceId, "usb-printer-123");
});

test("NETWORK requires host and port", () => {
  const form = { ...printerDefaults, id: "printer-xp80t-lan-001" };
  assert.equal(validatePrinterForm(form), "host requerido");
  assert.equal(
    validatePrinterForm({ ...form, host: "printer.local", port: "" }),
    "port debe estar entre 1 y 65535"
  );
});

test("changing connection retains common printer fields", () => {
  const networkForm = {
    ...printerDefaults,
    id: "printer-xp80t-lan-001",
    name: "Xprinter XP-80T",
    terminalId: "terminal-caja-1",
    profileId: "THERMAL_80MM" as const,
  };
  const usbForm = { ...networkForm, connectionType: "USB" as const, usbDeviceId: "usb-printer-123" };

  assert.deepEqual(
    {
      id: usbForm.id,
      name: usbForm.name,
      terminalId: usbForm.terminalId,
      profileId: usbForm.profileId,
    },
    {
      id: networkForm.id,
      name: networkForm.name,
      terminalId: networkForm.terminalId,
      profileId: networkForm.profileId,
    }
  );
});
