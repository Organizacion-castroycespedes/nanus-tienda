import type {
  PeripheralAgentHealth,
  PeripheralDevice,
  PosTerminalResolvedConfig,
} from "./types";

export type PeripheralHeaderState = {
  status: string;
  tone: "ok" | "warning" | "error" | "idle";
  detail: string;
};

type AgentHealth = Pick<PeripheralAgentHealth, "status" | "mode" | "agentApiVersion"> | null;
type TerminalConfig = Pick<
  PosTerminalResolvedConfig,
  "source" | "printerDeviceId" | "scaleDeviceId" | "features" | "mode" | "active"
> | null;
type SocketStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED";

const isAgentReady = (health: AgentHealth) =>
  health?.status.toLowerCase() === "ok" &&
  health.mode === "REAL" &&
  health.agentApiVersion === 1;

const metadataFlag = (device: PeripheralDevice | undefined, key: string) => {
  const value = device?.metadata?.[key];
  return value === true || value === "true";
};

export const resolvePrinterHeaderState = (input: {
  isElectron: boolean;
  socketStatus: SocketStatus;
  printerName: string | null;
  config: TerminalConfig;
  devices: PeripheralDevice[];
  health: AgentHealth;
}): PeripheralHeaderState => {
  if (!input.isElectron) {
    if (input.socketStatus === "CONNECTED") {
      return { status: "OK", tone: "ok", detail: input.printerName ?? "Nombre no disponible" };
    }
    if (input.socketStatus === "CONNECTING") {
      return { status: "Conectando", tone: "warning", detail: "Conectando con el servicio de impresión" };
    }
    return { status: "Error", tone: "error", detail: "Revise el Peripheral Agent" };
  }

  const printerId =
    input.config?.source === "CONFIGURED" && input.config.active && input.config.mode !== "MOCK"
      ? input.config.printerDeviceId
      : null;
  if (!printerId) {
    return { status: "Sin config.", tone: "warning", detail: "No hay impresora asociada a esta terminal" };
  }
  if (!isAgentReady(input.health)) {
    return { status: "Sin servicio", tone: "error", detail: "Agent local no disponible o incompatible" };
  }

  const printer = input.devices.find((device) => device.id === printerId && device.type === "PRINTER");
  if (!printer) {
    return { status: "No detectada", tone: "warning", detail: `Impresora configurada: ${printerId}` };
  }
  const ready =
    printer.status === "CONNECTED" &&
    metadataFlag(printer, "physicalDetected") &&
    metadataFlag(printer, "queueInstalled") &&
    printer.metadata?.reconciliationStatus === "CONNECTED";
  return ready
    ? {
        status: "OK",
        tone: "ok",
        detail: `${printer.usb?.windowsQueueName ?? printer.name} lista; Agent local saludable`,
      }
    : {
        status: "Revisar",
        tone: "warning",
        detail: "Impresora física o cola de Windows no lista",
      };
};

export const resolveScaleHeaderState = (input: {
  config: TerminalConfig;
  devices: PeripheralDevice[];
  health: AgentHealth;
}): PeripheralHeaderState => {
  const scaleId =
    input.config?.source === "CONFIGURED" &&
    input.config.active &&
    input.config.mode !== "MOCK" &&
    input.config.features.scale
      ? input.config.scaleDeviceId
      : null;
  if (!scaleId || scaleId === "mock-scale-001") {
    return { status: "Sin config.", tone: "warning", detail: "No hay una balanza real asociada a esta terminal" };
  }
  if (!isAgentReady(input.health)) {
    return { status: "Sin servicio", tone: "error", detail: "Agent local no disponible o incompatible" };
  }

  const scale = input.devices.find((device) => device.id === scaleId && device.type === "SCALE");
  const validIdentity = Boolean(
    scale?.profileId === "ROCHI_A01E" &&
      scale.connectionType === "SERIAL" &&
      scale.serial?.pnp?.deviceId?.trim()
  );
  if (!scale || !metadataFlag(scale, "physicalDetected") || !validIdentity) {
    return { status: "No detectada", tone: "warning", detail: "Balanza configurada, pero la identidad física no está disponible" };
  }

  return {
    status: "Detectada",
    tone: "ok",
    detail: "ROCHI física detectada; lectura disponible bajo demanda. La autorización comercial es independiente.",
  };
};
