import type { CreateDeviceRequest, PeripheralDevice, PrinterProfileId } from "./types";

export const printerProfiles = [
  "THERMAL_80MM",
  "THERMAL_58MM",
  "GENERIC_TEXT",
] as const;

export type PrinterRegistrationForm = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  connectionType: "NETWORK" | "USB";
  host: string;
  port: string;
  timeoutMs: string;
  usbDeviceId: string;
  profileId: PrinterProfileId;
  terminalId: string;
  status: "CONNECTED";
};

export const printerDefaults: PrinterRegistrationForm = {
  id: "",
  name: "",
  manufacturer: "",
  model: "",
  connectionType: "NETWORK",
  host: "",
  port: "9100",
  timeoutMs: "3000",
  usbDeviceId: "",
  profileId: "THERMAL_80MM",
  terminalId: "local-terminal",
  status: "CONNECTED",
};

export const buildPrinterPayload = (
  form: PrinterRegistrationForm,
  usbDevice?: PeripheralDevice
): CreateDeviceRequest => {
  const common = {
    id: form.id.trim(),
    type: "PRINTER" as const,
    name: form.name.trim(),
    status: form.status,
    terminalId: form.terminalId.trim(),
    profileId: form.profileId,
  };

  const manufacturer = form.manufacturer.trim();
  const model = form.model.trim();

  if (form.connectionType === "NETWORK") {
    const payload: CreateDeviceRequest = {
      ...common,
      connectionType: "NETWORK",
      network: {
        host: form.host.trim(),
        port: Number(form.port),
        timeoutMs: Number(form.timeoutMs),
      },
    };

    if (manufacturer || model) {
      payload.metadata = {
        ...(manufacturer ? { manufacturer } : {}),
        ...(model ? { model } : {}),
      };
    }

    return payload;
  }

  const payload: CreateDeviceRequest = {
    ...common,
    connectionType: "USB",
    usb: {
      deviceId: form.usbDeviceId,
      printerName: usbDevice?.usb?.printerName ?? "",
    },
  };

  if (manufacturer || model) {
    payload.metadata = {
      ...(manufacturer ? { manufacturer } : {}),
      ...(model ? { model } : {}),
    };
  }

  return payload;
};

export const validatePrinterForm = (form: PrinterRegistrationForm): string | null => {
  if (!form.id.trim()) {
    return "id requerido";
  }
  if (!form.name.trim()) {
    return "name requerido";
  }
  if (!form.terminalId.trim()) {
    return "terminalId requerido";
  }

  if (form.connectionType === "NETWORK") {
    const port = Number(form.port);
    const timeoutMs = Number(form.timeoutMs);
    if (!form.host.trim()) {
      return "host requerido";
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return "port debe estar entre 1 y 65535";
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      return "timeoutMs debe ser mayor a 0";
    }
  }
  if (form.connectionType === "USB" && !form.usbDeviceId) {
    return "Seleccione un dispositivo USB descubierto por el agent";
  }

  return null;
};
