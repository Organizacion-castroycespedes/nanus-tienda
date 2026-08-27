"use client";

import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  PlugZap,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Scale,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import {
  listTerminals as listOperationalTerminals,
  type TerminalResponse,
} from "../../../modules/terminals/services/terminals.service";
import {
  createDevice,
  discoverPeripheralDevices,
  fetchCurrentWeight,
  fetchPeripheralDevices,
  fetchPeripheralHealth,
  fetchPeripheralLogs,
  getPeripheralAgentConfig,
  isPeripheralAgentRequestError,
  openCashDrawer,
  printMockTicket,
  simulateScanner,
  testPrint,
  type PeripheralAgentConfig,
} from "../api";
import {
  createPosTerminal,
  getPosTerminalPeripheralSettings,
  listPosTerminals,
  resolveCurrentPosTerminalConfig,
  savePosTerminalPeripheralSettings,
} from "../terminal-config";
import {
  buildPrinterPayload,
  printerDefaults,
  printerProfiles,
  validatePrinterForm,
  type PrinterRegistrationForm,
} from "../printer-registration";
import type {
  CreateDeviceRequest,
  CreatePosTerminalRequest,
  PeripheralActionResponse,
  PeripheralAgentHealth,
  PeripheralDevice,
  PeripheralDeviceStatus,
  PeripheralLog,
  PeripheralScaleWeight,
  PeripheralScannerResponse,
  PeripheralSocketEvent,
  PosTerminalMode,
  PosTerminalResolvedConfig,
  PosTerminalResponse,
} from "../types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ConnectionState =
  | "loading"
  | "connected"
  | "disconnected"
  | "error"
  | "missing-config"
  | "invalid-config"
  | "network-error";

type ActionState = {
  message: string;
  detail?: string;
  variant: ToastVariant;
};

type ActionResultState = {
  status: "idle" | "loading" | "success" | "error";
  title: string;
  message: string;
  detail?: string;
  response?: PeripheralActionResponse;
  updatedAt?: string;
};

const terminalId = "local-terminal";
const eventLimit = 30;
const realAdaptersDisabledMessage =
  "Real peripheral adapters are disabled. Enable PERIPHERALS_ENABLE_REAL_ADAPTERS=true to use them.";
const realAdaptersDisabledUiDetail =
  "El adapter real esta desactivado por seguridad. Para pruebas reales debe habilitarse PERIPHERALS_ENABLE_REAL_ADAPTERS=true en backend-perifericos.";

type PosTerminalFormState = {
  branchId: string;
  code: string;
  name: string;
  description: string;
  mode: PosTerminalMode;
};

type PosTerminalSettingsFormState = {
  printerDeviceId: string;
  cashDrawerDeviceId: string;
  scaleDeviceId: string;
  scannerDeviceId: string;
  enablePrintSale: boolean;
  enablePrintPurchase: boolean;
  enablePrintOrder: boolean;
  enableOpenDrawer: boolean;
  enableScale: boolean;
  enableScanner: boolean;
};

const defaultPosTerminalForm: PosTerminalFormState = {
  branchId: "",
  code: terminalId,
  name: "Terminal MOCK local",
  description: "Terminal POS MOCK para QA local",
  mode: "MOCK",
};

const defaultTerminalSettingsForm: PosTerminalSettingsFormState = {
  printerDeviceId: "mock-printer-001",
  cashDrawerDeviceId: "mock-cashdrawer-001",
  scaleDeviceId: "mock-scale-001",
  scannerDeviceId: "mock-scanner-001",
  enablePrintSale: true,
  enablePrintPurchase: true,
  enablePrintOrder: true,
  enableOpenDrawer: true,
  enableScale: true,
  enableScanner: true,
};

const formatTimestamp = (value?: string) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const statusTone: Record<PeripheralDeviceStatus, string> = {
  CONNECTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DISCONNECTED: "border-slate-200 bg-slate-100 text-slate-600",
  NOT_REACHABLE: "border-amber-200 bg-amber-50 text-amber-800",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
  SIMULATED: "border-blue-200 bg-blue-50 text-blue-700",
};

const socketTone: Record<ConnectionState, string> = {
  loading: "border-amber-200 bg-amber-50 text-amber-700",
  connected: "border-emerald-200 bg-emerald-50 text-emerald-700",
  disconnected: "border-slate-200 bg-slate-100 text-slate-600",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  "missing-config": "border-amber-200 bg-amber-50 text-amber-700",
  "invalid-config": "border-rose-200 bg-rose-50 text-rose-700",
  "network-error": "border-rose-200 bg-rose-50 text-rose-700",
};

const connectionTone: Record<string, string> = {
  MOCK: "border-indigo-200 bg-indigo-50 text-indigo-700",
  USB: "border-amber-200 bg-amber-50 text-amber-800",
  SERIAL: "border-amber-200 bg-amber-50 text-amber-800",
  HID: "border-amber-200 bg-amber-50 text-amber-800",
  USB_HID: "border-amber-200 bg-amber-50 text-amber-800",
  NETWORK: "border-blue-200 bg-blue-50 text-blue-800",
  BLUETOOTH: "border-blue-200 bg-blue-50 text-blue-800",
};

const profileTone: Record<string, string> = {
  THERMAL_80MM: "border-cyan-200 bg-cyan-50 text-cyan-800",
  THERMAL_58MM: "border-sky-200 bg-sky-50 text-sky-800",
  GENERIC_TEXT: "border-slate-200 bg-slate-50 text-slate-700",
};

const booleanTone = (value?: boolean) => {
  if (value === true) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === false) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
};

const normalizeSocketEvent = (raw: MessageEvent<string>): PeripheralSocketEvent => {
  const receivedAt = new Date().toISOString();

  try {
    const parsed = JSON.parse(raw.data) as {
      event?: string;
      type?: string;
      payload?: unknown;
      data?: unknown;
      timestamp?: string;
    };

    return {
      event: parsed.event ?? parsed.type ?? "message",
      payload: parsed.payload ?? parsed.data ?? parsed,
      timestamp: parsed.timestamp ?? receivedAt,
    };
  } catch {
    return {
      event: "message",
      payload: raw.data,
      timestamp: receivedAt,
    };
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la accion.";

const getAgentStateFromError = (error: unknown): ConnectionState => {
  if (!isPeripheralAgentRequestError(error)) {
    return "error";
  }

  if (error.code === "MISSING_CONFIG") {
    return "missing-config";
  }

  if (error.code === "INVALID_CONFIG") {
    return "invalid-config";
  }

  if (error.code === "NETWORK_ERROR") {
    return "network-error";
  }

  if (error.code === "AGENT_OFFLINE") {
    return "disconnected";
  }

  return "error";
};

const getErrorDetail = (error: unknown) => {
  if (!isPeripheralAgentRequestError(error)) {
    return undefined;
  }

  return [
    error.code,
    error.status ? `HTTP ${error.status}` : null,
    error.endpoint,
  ]
    .filter(Boolean)
    .join(" | ");
};

const getEndpointLabel = (value: string) => value || "Sin configurar";

const pickDevice = (devices: PeripheralDevice[], type: PeripheralDevice["type"]) =>
  devices.find((device) => device.type === type);

const renderJson = (value: unknown) => JSON.stringify(value, null, 2);

const boolLabel = (value?: boolean) => {
  if (value === true) {
    return "Si";
  }

  if (value === false) {
    return "No";
  }

  return "-";
};

const getAdapterName = (response?: PeripheralActionResponse) =>
  response?.adapterName ?? response?.capabilities?.adapterName;

const getCommandCount = (response?: PeripheralActionResponse) =>
  response?.commandCount ?? response?.commands?.length ?? 0;

const getNetworkEndpoint = (device: PeripheralDevice) => {
  if (!device.network) {
    return "-";
  }

  return `${device.network.host}:${device.network.port}`;
};

const getResponseNetworkEndpoint = (response?: PeripheralActionResponse) => {
  if (!response?.network) {
    return "-";
  }

  return `${response.network.host}:${response.network.port}`;
};

const isRealAdapterDisabledError = (message: string) =>
  message.includes("Real peripheral adapters are disabled");

const commandTone = (name: string) => {
  if (name === "CUT" || name === "CASH_DRAWER_PULSE") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (name.startsWith("ALIGN")) {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const SectionCard = ({
  title,
  eyebrow,
  children,
  actions,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-xs uppercase tracking-wide text-slate-500">{eyebrow}</p>
        ) : null}
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const Badge = ({ children, className }: { children: ReactNode; className: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
    {children}
  </span>
);

const CapabilityBadge = ({
  label,
  value,
}: {
  label: string;
  value?: boolean;
}) => (
  <Badge className={booleanTone(value)}>
    {label}: {boolLabel(value)}
  </Badge>
);

const PeripheralDeviceProfileBadge = ({ device }: { device: PeripheralDevice }) => {
  const profileId = device.profileId ?? device.profile?.id;

  if (!profileId) {
    return <span className="text-sm text-slate-400">-</span>;
  }

  return (
    <Badge className={profileTone[profileId] ?? "border-slate-200 bg-slate-50 text-slate-700"}>
      {profileId}
    </Badge>
  );
};

const InfoField = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</div>
  </div>
);

const PeripheralCapabilitiesList = ({
  response,
}: {
  response?: PeripheralActionResponse;
}) => {
  if (!response) {
    return null;
  }

  const capabilities = response.capabilities;
  const profile = response.profile;
  const adapterName = getAdapterName(response);
  const commandCount = getCommandCount(response);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">
          {response.mode ?? capabilities?.mode ?? "MOCK"}
        </Badge>
        {adapterName ? (
          <Badge className="border-violet-200 bg-violet-50 text-violet-700">
            {adapterName}
          </Badge>
        ) : null}
        {profile?.id ? (
          <Badge className={profileTone[profile.id] ?? "border-slate-200 bg-slate-50 text-slate-700"}>
            {profile.id}
          </Badge>
        ) : null}
        <CapabilityBadge label="supportsCut" value={capabilities?.supportsCut} />
        <CapabilityBadge
          label="supportsCashDrawerPulse"
          value={capabilities?.supportsCashDrawerPulse}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoField label="adapterName" value={adapterName ?? "-"} />
        <InfoField label="profile.id" value={profile?.id ?? "-"} />
        <InfoField
          label="paperWidthMm"
          value={profile?.paperWidthMm === null ? "N/A" : profile?.paperWidthMm ?? "-"}
        />
        <InfoField label="widthChars" value={profile?.widthChars ?? "-"} />
        <InfoField label="connectionType" value={capabilities?.connectionType ?? "-"} />
        <InfoField label="network" value={getResponseNetworkEndpoint(response)} />
        <InfoField label="commandCount" value={commandCount} />
      </div>
    </div>
  );
};

const PeripheralAdapterMetadata = ({
  response,
}: {
  response?: PeripheralActionResponse;
}) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-slate-900">Adapter y profile</h3>
    <PeripheralCapabilitiesList response={response} />
  </div>
);

const PeripheralAgentStatusCard = ({
  health,
  state,
  error,
  loading,
  config,
  onRetry,
}: {
  health: PeripheralAgentHealth | null;
  state: ConnectionState;
  error: string | null;
  loading: boolean;
  config: PeripheralAgentConfig;
  onRetry: () => void;
}) => {
  const isConnected = state === "connected";
  const isWarning = state === "missing-config" || state === "loading";
  const statusLabel =
    state === "connected"
      ? "Conectado"
      : state === "missing-config"
        ? "Configuracion faltante"
        : state === "invalid-config"
          ? "Configuracion invalida"
          : state === "network-error"
            ? "Error de red/CORS"
            : state === "loading"
              ? "Validando"
              : "No disponible";
  const containerTone = isConnected
    ? "border-emerald-200 bg-emerald-50"
    : isWarning
      ? "border-amber-200 bg-amber-50"
      : "border-rose-200 bg-rose-50";
  const iconTone = isConnected
    ? "text-emerald-600"
    : isWarning
      ? "text-amber-600"
      : "text-rose-600";
  const textTone = isConnected
    ? "text-emerald-800"
    : isWarning
      ? "text-amber-800"
      : "text-rose-800";
  const detailTone = isConnected
    ? "text-emerald-700"
    : isWarning
      ? "text-amber-700"
      : "text-rose-700";

  return (
    <SectionCard
      title="Agent local"
      eyebrow="Perifericos MOCK"
      actions={
        <Button variant="ghost" onClick={onRetry} isLoading={loading}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className={`rounded-xl border p-4 ${containerTone}`}>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <CheckCircle2 className={`h-5 w-5 ${iconTone}`} />
            ) : (
              <AlertTriangle className={`h-5 w-5 ${iconTone}`} />
            )}
            <div>
              <p className={`text-sm font-semibold ${textTone}`}>
                {statusLabel}
              </p>
              <p className={`mt-1 text-sm ${detailTone}`}>
                {isConnected
                  ? `${health?.agent ?? "agent"} en ${getEndpointLabel(config.httpUrl)}`
                  : error ?? config.message ?? "Backend de perifericos no disponible."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField label="status" value={health?.status ?? "-"} />
          <InfoField label="mode" value={health?.mode ?? "-"} />
          <InfoField label="agentInstallationId" value={health?.agentInstallationId ?? "-"} />
          <InfoField
            label="platform"
            value={[health?.platform, health?.architecture].filter(Boolean).join(" / ") || "-"}
          />
          <InfoField label="version" value={health?.version ?? "-"} />
          <InfoField label="uptime" value={health ? `${health.uptimeSeconds}s` : "-"} />
          <InfoField
            label="configuredDevices"
            value={health?.configuredDevices ?? "-"}
          />
          <InfoField
            label="discoveredDevices"
            value={health?.discoveredDevices ?? "-"}
          />
          <InfoField
            label="persistenceState"
            value={
              health?.persistenceState
                ? `${health.persistenceState.status} / v${health.persistenceState.schemaVersion}`
                : "-"
            }
          />
          <InfoField label="http" value={getEndpointLabel(config.httpUrl)} />
          <InfoField label="ws" value={getEndpointLabel(config.wsUrl)} />
        </div>
      </div>
    </SectionCard>
  );
};

const PrinterRegistrationPanel = ({
  loading,
  onRegister,
  devices,
}: {
  loading: boolean;
  onRegister: (payload: CreateDeviceRequest) => Promise<PeripheralDevice>;
  devices: PeripheralDevice[];
}) => {
  const [form, setForm] = useState<PrinterRegistrationForm>(printerDefaults);
  const [state, setState] = useState<{
    status: "idle" | "success" | "error";
    message: string;
    detail?: string;
  }>({
    status: "idle",
    message: "Seleccione una conexión para registrar la impresora.",
  });

  const usbPrinters = devices.filter(
    (device) => device.type === "PRINTER" && device.connectionType === "USB" && device.usb
  );
  const selectedUsbPrinter = usbPrinters.find(
    (device) => device.usb?.deviceId === form.usbDeviceId
  );

  const updateForm = (field: keyof PrinterRegistrationForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitForm = async (candidate: PrinterRegistrationForm) => {
    const error = validatePrinterForm(candidate);
    if (error) {
      setState({ status: "error", message: error });
      return;
    }

    try {
      const payload = buildPrinterPayload(candidate, selectedUsbPrinter);
      const device = await onRegister(payload);
      setState({
        status: "success",
        message: `Impresora ${device.connectionType} registrada.`,
        detail:
          device.connectionType === "NETWORK"
            ? `${device.id} ${getNetworkEndpoint(device)}`
            : `${device.id} ${device.usb?.printerName ?? ""}`,
      });
    } catch (errorValue) {
      setState({
        status: "error",
        message: getErrorMessage(errorValue),
      });
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitForm(form);
  };

  const statusClass =
    state.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : state.status === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-600";
  const printerBrand = [form.manufacturer, form.model].filter(Boolean).join(" ");
  const printerEyebrow = `${printerBrand || "Impresora"} / ${form.connectionType}`;

  return (
    <SectionCard
      title="Registrar impresora"
      eyebrow={printerEyebrow}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-2">
          <Badge className={connectionTone[form.connectionType]}>{form.connectionType}</Badge>
          <Badge className="border-slate-200 bg-slate-50 text-slate-700">
            PRINTER
          </Badge>
          <Badge className={statusTone.CONNECTED}>CONNECTED</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            label="id"
            value={form.id}
            required
            onChange={(event) => updateForm("id", event.target.value)}
          />
          <Input
            label="name"
            value={form.name}
            required
            onChange={(event) => updateForm("name", event.target.value)}
          />
          <Input
            label="manufacturer"
            value={form.manufacturer}
            placeholder="Opcional. Ej: Digital POS"
            onChange={(event) => updateForm("manufacturer", event.target.value)}
          />
          <Input
            label="model"
            value={form.model}
            placeholder="Opcional. Ej: DIG-E200I"
            onChange={(event) => updateForm("model", event.target.value)}
          />
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-medium">Conexión</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={form.connectionType}
              onChange={(event) => updateForm("connectionType", event.target.value)}
            >
              <option value="NETWORK">NETWORK</option>
              <option value="USB">USB</option>
            </select>
          </label>
          {form.connectionType === "NETWORK" ? (
            <>
              <Input
                label="host"
                value={form.host}
                required
                placeholder="IP o hostname de la impresora"
                onChange={(event) => updateForm("host", event.target.value)}
              />
              <Input
                label="port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                required
                placeholder="Puerto RAW configurado"
                onChange={(event) => updateForm("port", event.target.value)}
              />
              <Input
                label="timeoutMs"
                type="number"
                min={250}
                value={form.timeoutMs}
                required
                onChange={(event) => updateForm("timeoutMs", event.target.value)}
              />
            </>
          ) : (
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              <span className="font-medium">Dispositivo USB descubierto</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={form.usbDeviceId}
                onChange={(event) => updateForm("usbDeviceId", event.target.value)}
              >
                <option value="">Seleccione después de Buscar dispositivos</option>
                {usbPrinters.map((device) => (
                  <option key={device.usb?.deviceId} value={device.usb?.deviceId}>
                    {device.name} ({device.usb?.deviceId})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-medium">profileId</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={form.profileId}
              onChange={(event) =>
                updateForm(
                  "profileId",
                  event.target.value as PrinterRegistrationForm["profileId"]
                )
              }
            >
              {printerProfiles.map((profileId) => (
                <option key={profileId} value={profileId}>
                  {profileId}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="terminalId"
            value={form.terminalId}
            required
            onChange={(event) => updateForm("terminalId", event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`rounded-lg border px-3 py-2 text-sm ${statusClass}`}>
            <span className="font-medium">{state.message}</span>
            {state.detail ? (
              <span className="ml-2 font-mono text-xs">{state.detail}</span>
            ) : null}
          </div>
          <Button type="submit" isLoading={loading}>
            <Printer className="h-4 w-4" />
            Registrar
          </Button>
        </div>
      </form>
    </SectionCard>
  );
};

const settingsFromResolved = (
  resolved?: PosTerminalResolvedConfig | null
): PosTerminalSettingsFormState => ({
  printerDeviceId:
    resolved?.printerDeviceId ?? defaultTerminalSettingsForm.printerDeviceId,
  cashDrawerDeviceId:
    resolved?.cashDrawerDeviceId ??
    defaultTerminalSettingsForm.cashDrawerDeviceId,
  scaleDeviceId: resolved?.scaleDeviceId ?? defaultTerminalSettingsForm.scaleDeviceId,
  scannerDeviceId:
    resolved?.scannerDeviceId ?? defaultTerminalSettingsForm.scannerDeviceId,
  enablePrintSale:
    resolved?.features.printSale ?? defaultTerminalSettingsForm.enablePrintSale,
  enablePrintPurchase:
    resolved?.features.printPurchase ??
    defaultTerminalSettingsForm.enablePrintPurchase,
  enablePrintOrder:
    resolved?.features.printOrder ?? defaultTerminalSettingsForm.enablePrintOrder,
  enableOpenDrawer:
    resolved?.features.openDrawer ?? defaultTerminalSettingsForm.enableOpenDrawer,
  enableScale: resolved?.features.scale ?? defaultTerminalSettingsForm.enableScale,
  enableScanner:
    resolved?.features.scanner ?? defaultTerminalSettingsForm.enableScanner,
});

const deviceOptionsByType = (
  devices: PeripheralDevice[],
  type: PeripheralDevice["type"]
) => devices.filter((device) => device.type === type);

const TerminalPosPanel = ({
  tenantId,
  devices,
  onToast,
}: {
  tenantId?: string | null;
  devices: PeripheralDevice[];
  onToast: (message: string, variant: ToastVariant, detail?: string) => void;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryTerminalId = searchParams.get("terminalId")?.trim() ?? "";
  const [terminals, setTerminals] = useState<PosTerminalResponse[]>([]);
  const [operationalTerminals, setOperationalTerminals] = useState<
    TerminalResponse[]
  >([]);
  const [resolved, setResolved] = useState<PosTerminalResolvedConfig | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState(queryTerminalId);
  const [terminalForm, setTerminalForm] = useState<PosTerminalFormState>({
    ...defaultPosTerminalForm,
  });
  const [settingsForm, setSettingsForm] = useState<PosTerminalSettingsFormState>({
    ...defaultTerminalSettingsForm,
  });
  const [loading, setLoading] = useState({
    snapshot: false,
    create: false,
    save: false,
  });
  const [status, setStatus] = useState<{
    variant: "info" | "success" | "warning" | "error";
    message: string;
  }>({
    variant: "info",
    message: "Selecciona una terminal canónica para cargar sus periféricos.",
  });

  const syncQueryTerminalId = useCallback(
    (nextTerminalId: string) => {
      if (!pathname) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      if (nextTerminalId) {
        params.set("terminalId", nextTerminalId);
      } else {
        params.delete("terminalId");
      }

      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;
      router.replace(nextUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadTerminalSnapshot = useCallback(async () => {
    setLoading((prev) => ({ ...prev, snapshot: true }));
    try {
      const requestedTerminalId = queryTerminalId || undefined;
      const [resolvedResult, terminalsResult, operationalTerminalsResult] =
        await Promise.allSettled([
          resolveCurrentPosTerminalConfig({
            tenantId,
            terminalId: requestedTerminalId,
          }),
          listPosTerminals({ tenantId }),
          listOperationalTerminals({ tenantId: tenantId ?? undefined }),
        ]);

      if (resolvedResult.status === "fulfilled") {
        setResolved(resolvedResult.value);
        setSettingsForm(settingsFromResolved(resolvedResult.value));
        setTerminalForm((prev) => ({
          ...prev,
          branchId: resolvedResult.value.branchId ?? prev.branchId,
          code: resolvedResult.value.code || prev.code,
          name: resolvedResult.value.name || prev.name,
          mode: resolvedResult.value.mode ?? prev.mode,
        }));
        const canonicalTerminalId =
          resolvedResult.value.operationalTerminalId ?? requestedTerminalId ?? "";
        setSelectedTerminalId(canonicalTerminalId);
        if (!requestedTerminalId && canonicalTerminalId) {
          syncQueryTerminalId(canonicalTerminalId);
        }
        setStatus({
          variant:
            resolvedResult.value.source === "CONFIGURED" ? "success" : "warning",
          message:
            resolvedResult.value.source === "CONFIGURED"
              ? "Terminal canónica con perifericos configurados."
              : resolvedResult.value.source === "OPERATIONAL_UNCONFIGURED"
                ? "Terminal operativa sin configuracion de perifericos."
                : "Perifericos no configurados para la terminal seleccionada.",
        });
      } else {
        setStatus({
          variant: "warning",
          message: "No se pudo resolver la terminal seleccionada.",
        });
      }

      if (terminalsResult.status === "fulfilled") {
        setTerminals(terminalsResult.value);
      }
      if (operationalTerminalsResult.status === "fulfilled") {
        setOperationalTerminals(operationalTerminalsResult.value);
      }
    } finally {
      setLoading((prev) => ({ ...prev, snapshot: false }));
    }
  }, [queryTerminalId, syncQueryTerminalId, tenantId]);

  useEffect(() => {
    void loadTerminalSnapshot();
  }, [loadTerminalSnapshot]);

  useEffect(() => {
    if (queryTerminalId && queryTerminalId !== selectedTerminalId) {
      setSelectedTerminalId(queryTerminalId);
    }
    if (!queryTerminalId && resolved?.operationalTerminalId) {
      setSelectedTerminalId(resolved.operationalTerminalId);
    }
  }, [queryTerminalId, resolved?.operationalTerminalId, selectedTerminalId]);

  const updateTerminalForm = (
    field: keyof PosTerminalFormState,
    value: string
  ) => {
    setTerminalForm((prev) => ({
      ...prev,
      [field]: field === "mode" ? (value as PosTerminalMode) : value,
    }));
  };

  const updateSettingsForm = (
    field: keyof PosTerminalSettingsFormState,
    value: string | boolean
  ) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateTerminal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const branchId = terminalForm.branchId.trim();
    const code = terminalForm.code.trim();
    const name = terminalForm.name.trim();

    if (!branchId || !code || !name) {
      setStatus({
        variant: "error",
        message: "branchId, code y name son requeridos.",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, create: true }));
    try {
      const payload: CreatePosTerminalRequest = {
        tenantId: tenantId ?? undefined,
        branchId,
        code,
        name,
        description: terminalForm.description.trim() || null,
        active: true,
        mode: terminalForm.mode,
      };
      const created = await createPosTerminal(payload);
      setSelectedTerminalId(created.id);
      onToast("Terminal POS creada.", "success", created.code);
      await loadTerminalSnapshot();
    } catch (error) {
      const message = getErrorMessage(error);
      setStatus({ variant: "error", message });
      onToast(message, "error");
    } finally {
      setLoading((prev) => ({ ...prev, create: false }));
    }
  };

  const handleSelectTerminal = async (nextTerminalId: string) => {
    setSelectedTerminalId(nextTerminalId);
    syncQueryTerminalId(nextTerminalId);
    setResolved(null);
    setSettingsForm({
      ...defaultTerminalSettingsForm,
      printerDeviceId: "",
      cashDrawerDeviceId: "",
      scaleDeviceId: "",
      scannerDeviceId: "",
      enablePrintSale: false,
      enablePrintPurchase: false,
      enablePrintOrder: false,
      enableOpenDrawer: false,
      enableScale: false,
      enableScanner: false,
    });

    const selected = operationalTerminals.find(
      (terminal) => terminal.id === nextTerminalId
    );
    if (selected) {
      setTerminalForm((prev) => ({
        ...prev,
        branchId: selected.branchId,
        code: selected.code,
        name: selected.name,
      }));
    }
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetTerminalId = resolved?.posTerminalId;
    if (!targetTerminalId) {
      setStatus({
        variant: "warning",
        message:
          "Perifericos no configurados. Crea primero el perfil POS asociado a la terminal.",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, save: true }));
    try {
      await savePosTerminalPeripheralSettings(targetTerminalId, {
        printerDeviceId: settingsForm.printerDeviceId,
        cashDrawerDeviceId: settingsForm.cashDrawerDeviceId,
        scaleDeviceId: settingsForm.scaleDeviceId,
        scannerDeviceId: settingsForm.scannerDeviceId,
        enablePrintSale: settingsForm.enablePrintSale,
        enablePrintPurchase: settingsForm.enablePrintPurchase,
        enablePrintOrder: settingsForm.enablePrintOrder,
        enableOpenDrawer: settingsForm.enableOpenDrawer,
        enableScale: settingsForm.enableScale,
        enableScanner: settingsForm.enableScanner,
      });
      onToast("Perifericos de terminal guardados.", "success");
      await loadTerminalSnapshot();
    } catch (error) {
      const message = getErrorMessage(error);
      setStatus({ variant: "error", message });
      onToast(message, "error");
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  const persistPrinterDevice = async (printerDeviceId: string | null) => {
    const targetTerminalId = resolved?.posTerminalId;
    if (!targetTerminalId) {
      setStatus({
        variant: "warning",
        message:
          "Perifericos no configurados. Crea primero el perfil POS asociado a la terminal.",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, save: true }));
    try {
      await savePosTerminalPeripheralSettings(targetTerminalId, {
        printerDeviceId,
        cashDrawerDeviceId:
          settingsForm.cashDrawerDeviceId.trim() || defaultTerminalSettingsForm.cashDrawerDeviceId,
        scaleDeviceId:
          settingsForm.scaleDeviceId.trim() || defaultTerminalSettingsForm.scaleDeviceId,
        scannerDeviceId:
          settingsForm.scannerDeviceId.trim() || defaultTerminalSettingsForm.scannerDeviceId,
        enablePrintSale: settingsForm.enablePrintSale,
        enablePrintPurchase: settingsForm.enablePrintPurchase,
        enablePrintOrder: settingsForm.enablePrintOrder,
        enableOpenDrawer: settingsForm.enableOpenDrawer,
        enableScale: settingsForm.enableScale,
        enableScanner: settingsForm.enableScanner,
      });
      setSettingsForm((prev) => ({ ...prev, printerDeviceId: printerDeviceId ?? "" }));
      onToast(
        printerDeviceId ? "Impresora asociada." : "Impresora desasociada.",
        "success"
      );
      await loadTerminalSnapshot();
    } catch (error) {
      const message = getErrorMessage(error);
      setStatus({ variant: "error", message });
      onToast(message, "error");
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  const handleTestPrinter = async () => {
    const printerId = settingsForm.printerDeviceId.trim() || resolved?.printerDeviceId || "";
    if (!printerId) {
      onToast("No hay impresora configurada.", "warning");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, save: true }));
      const terminalForPrint =
        resolved?.operationalTerminalId ?? selectedTerminalId ?? terminalId;
      const result = await testPrint(
        terminalForPrint,
        printerId
      );
      onToast(result.message ?? "Impresion de prueba enviada.", "success");
    } catch (error) {
      const message = getErrorMessage(error);
      setStatus({ variant: "error", message });
      onToast(message, "error");
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  const statusClass =
    status.variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status.variant === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : status.variant === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  const selectedOperationalTerminal = operationalTerminals.find(
    (terminal) => terminal.id === selectedTerminalId
  );
  const selectedPosTerminal = resolved?.posTerminalId
    ? terminals.find((terminal) => terminal.id === resolved.posTerminalId)
    : null;
  const printerCandidates = deviceOptionsByType(devices, "PRINTER");
  const selectedPrinterDevice = devices.find(
    (device) =>
      device.id === settingsForm.printerDeviceId ||
      device.id === resolved?.printerDeviceId
  );
  const printerConnected = Boolean(selectedPrinterDevice);
  const printerConfigured = Boolean(
    settingsForm.printerDeviceId.trim() || resolved?.printerDeviceId
  );
  const printerStatusLabel = printerConfigured
    ? printerConnected
      ? "Configurada y detectada"
      : "Configurada pero no detectada"
    : "No configurada";
  const printerEndpoint = selectedPrinterDevice ? getNetworkEndpoint(selectedPrinterDevice) : "-";
  const terminalOptionLabel = (terminal: TerminalResponse) =>
    `${terminal.code}  ${terminal.name}  ${terminal.branchName ?? "-"}`;

  const operationalTerminalLabel = (terminal?: PosTerminalResponse | null) => {
    if (!terminal?.operationalTerminalId) {
      return "Sin terminal operativa asociada";
    }
    const operational = operationalTerminals.find(
      (item) => item.id === terminal.operationalTerminalId
    );
    const code = operational?.code ?? terminal.operationalTerminalCode ?? "-";
    const name = operational?.name ?? terminal.operationalTerminalName ?? "-";
    return `${code} - ${name}`;
  };

  const renderDeviceDatalist = (
    id: string,
    type: PeripheralDevice["type"]
  ) => (
    <datalist id={id}>
      {deviceOptionsByType(devices, type).map((device) => (
        <option key={device.id} value={device.id}>
          {device.name}
        </option>
      ))}
    </datalist>
  );

  return (
    <SectionCard
      title="Terminal POS"
      eyebrow="Configuracion operativa"
      actions={
        <Button
          variant="ghost"
          onClick={() => void loadTerminalSnapshot()}
          isLoading={loading.snapshot}
        >
          <RefreshCw className="h-4 w-4" />
          Resolver
        </Button>
      }
    >
      <div className="space-y-5">
        <div className={`rounded-lg border px-3 py-2 text-sm ${statusClass}`}>
          <span className="font-medium">{status.message}</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoField
            label="Terminal operativa"
            value={
              resolved?.operationalTerminalCode
                ? `${resolved.operationalTerminalCode} - ${resolved.operationalTerminalName ?? ""}`.trim()
                : "Sin asociar"
            }
          />
          <InfoField
            label="Agent code"
            value={resolved?.agentTerminalCode ?? terminalId}
          />
          <InfoField
            label="Origen"
            value={resolved?.source ?? "FALLBACK_MOCK"}
          />
          <InfoField
            label="Sucursal"
            value={resolved?.branchName ?? resolved?.branchId ?? "-"}
          />
        </div>

        <form className="space-y-4" onSubmit={handleCreateTerminal}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              label="branchId"
              value={terminalForm.branchId}
              required
              onChange={(event) => updateTerminalForm("branchId", event.target.value)}
            />
            <Input
              label="Agent code"
              value={terminalForm.code}
              required
              onChange={(event) => updateTerminalForm("code", event.target.value)}
            />
            <Input
              label="Nombre perfil perifericos"
              value={terminalForm.name}
              required
              onChange={(event) => updateTerminalForm("name", event.target.value)}
            />
            <Input
              label="description"
              value={terminalForm.description}
              onChange={(event) =>
                updateTerminalForm("description", event.target.value)
              }
            />
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              <span className="font-medium">mode</span>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={terminalForm.mode}
                onChange={(event) => updateTerminalForm("mode", event.target.value)}
              >
                <option value="MOCK">MOCK</option>
                <option value="REAL">REAL</option>
                <option value="HYBRID">HYBRID</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="submit" isLoading={loading.create}>
              <Terminal className="h-4 w-4" />
              Crear perfil perifericos
            </Button>
          </div>
        </form>

        <form className="space-y-4" onSubmit={handleSaveSettings}>
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-medium">Perfil de perifericos configurado</span>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={selectedTerminalId}
              onChange={(event) => void handleSelectTerminal(event.target.value)}
            >
              <option value="">Fallback MOCK / sin seleccion</option>
              {terminals.map((terminal) => (
                <option key={terminal.id} value={terminal.id}>
                  {operationalTerminalLabel(terminal)} · Agent: {terminal.code}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">Terminal operativa asociada: </span>
            {operationalTerminalLabel(
              terminals.find((terminal) => terminal.id === selectedTerminalId)
            )}
            {selectedTerminalId ? (
              <span className="ml-2 text-slate-500">
                `local-terminal` es solo Agent code/compatibilidad; no es otra caja comercial.
              </span>
            ) : null}
          </div>

          {renderDeviceDatalist("printer-device-options", "PRINTER")}
          {renderDeviceDatalist("cash-drawer-device-options", "CASH_DRAWER")}
          {renderDeviceDatalist("scale-device-options", "SCALE")}
          {renderDeviceDatalist("scanner-device-options", "SCANNER")}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="printer_device_id"
              list="printer-device-options"
              value={settingsForm.printerDeviceId}
              onChange={(event) =>
                updateSettingsForm("printerDeviceId", event.target.value)
              }
            />
            <Input
              label="cash_drawer_device_id"
              list="cash-drawer-device-options"
              value={settingsForm.cashDrawerDeviceId}
              onChange={(event) =>
                updateSettingsForm("cashDrawerDeviceId", event.target.value)
              }
            />
            <Input
              label="scale_device_id"
              list="scale-device-options"
              value={settingsForm.scaleDeviceId}
              onChange={(event) =>
                updateSettingsForm("scaleDeviceId", event.target.value)
              }
            />
            <Input
              label="scanner_device_id"
              list="scanner-device-options"
              value={settingsForm.scannerDeviceId}
              onChange={(event) =>
                updateSettingsForm("scannerDeviceId", event.target.value)
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["enablePrintSale", "Imprimir ventas"],
              ["enablePrintPurchase", "Imprimir compras"],
              ["enablePrintOrder", "Imprimir pedidos"],
              ["enableOpenDrawer", "Abrir caja"],
              ["enableScale", "Balanza"],
              ["enableScanner", "Scanner"],
            ].map(([field, label]) => (
              <label
                key={field}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={Boolean(
                    settingsForm[field as keyof PosTerminalSettingsFormState]
                  )}
                  onChange={(event) =>
                    updateSettingsForm(
                      field as keyof PosTerminalSettingsFormState,
                      event.target.checked
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <Button type="submit" isLoading={loading.save}>
              <CheckCircle2 className="h-4 w-4" />
              Guardar perifericos
            </Button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
};

const PeripheralDevicesTable = ({
  devices,
  loading,
  onDiscover,
  onTestPrint,
  onPrintTicket,
  onOpenDrawer,
  onReadWeight,
}: {
  devices: PeripheralDevice[];
  loading: boolean;
  onDiscover: () => void;
  onTestPrint: (device: PeripheralDevice) => void;
  onPrintTicket: (device: PeripheralDevice) => void;
  onOpenDrawer: (device: PeripheralDevice) => void;
  onReadWeight: () => void;
}) => (
  <SectionCard
    title="Dispositivos locales"
    actions={
      <Button variant="outline" onClick={onDiscover} isLoading={loading}>
        <Search className="h-4 w-4" />
        Buscar dispositivos
      </Button>
    }
  >
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">ID</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Conexion</th>
            <th className="px-4 py-3 font-medium">Profile</th>
            <th className="px-4 py-3 font-medium">Red</th>
            <th className="px-4 py-3 font-medium">Terminal</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                Cargando dispositivos...
              </td>
            </tr>
          ) : devices.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                No hay dispositivos simulados para mostrar.
              </td>
            </tr>
          ) : (
            devices.map((device) => (
              <tr key={device.id}>
                <td className="max-w-[220px] break-all px-4 py-3 text-slate-700">
                  {device.id}
                </td>
                <td className="px-4 py-3 text-slate-900">{device.type}</td>
                <td className="px-4 py-3 text-slate-700">{device.name}</td>
                <td className="px-4 py-3">
                  <Badge className={statusTone[device.status] ?? statusTone.DISCONNECTED}>
                    {device.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      connectionTone[device.connectionType] ??
                      "border-slate-200 bg-slate-50 text-slate-700"
                    }
                  >
                    {device.connectionType}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <PeripheralDeviceProfileBadge device={device} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {getNetworkEndpoint(device)}
                </td>
                <td className="px-4 py-3 text-slate-700">{device.terminalId}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {device.type === "PRINTER" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => onTestPrint(device)}>
                          <Printer className="h-4 w-4" />
                          Prueba
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onPrintTicket(device)}>
                          <FileText className="h-4 w-4" />
                          Ticket demo
                        </Button>
                      </>
                    ) : null}
                    {device.type === "CASH_DRAWER" ? (
                      <Button size="sm" variant="ghost" onClick={() => onOpenDrawer(device)}>
                        <Archive className="h-4 w-4" />
                        Abrir
                      </Button>
                    ) : null}
                    {device.type === "SCALE" ? (
                      <Button size="sm" variant="ghost" onClick={onReadWeight}>
                        <Scale className="h-4 w-4" />
                        Peso
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </SectionCard>
);

const PeripheralScalePanel = ({
  lastWeight,
  loading,
  onReadWeight,
}: {
  lastWeight: PeripheralScaleWeight | null;
  loading: boolean;
  onReadWeight: () => void;
}) => (
  <SectionCard
    title="Balanza"
    actions={
      <Button variant="outline" onClick={onReadWeight} isLoading={loading}>
        <Scale className="h-4 w-4" />
        Leer peso
      </Button>
    }
  >
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoField
        label="peso"
        value={lastWeight ? `${lastWeight.weight} ${lastWeight.unit}` : "-"}
      />
      <InfoField label="estable" value={lastWeight ? (lastWeight.stable ? "Si" : "No") : "-"} />
      <InfoField label="deviceId" value={lastWeight?.deviceId ?? "-"} />
      <InfoField label="timestamp" value={formatTimestamp(lastWeight?.timestamp)} />
    </div>
  </SectionCard>
);

const PeripheralScannerSimulator = ({
  scannerDevice,
  loading,
  result,
  onSubmit,
}: {
  scannerDevice: PeripheralDevice | undefined;
  loading: boolean;
  result: PeripheralScannerResponse | null;
  onSubmit: (code: string, format: string) => void;
}) => {
  const [code, setCode] = useState("7701234567890");
  const [format, setFormat] = useState("EAN13");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(code.trim(), format.trim());
  };

  return (
    <SectionCard title="Scanner">
      <form className="grid gap-4 md:grid-cols-[1fr_180px_auto]" onSubmit={handleSubmit}>
        <Input
          label="Codigo"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="7701234567890"
        />
        <Input
          label="Formato"
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          placeholder="EAN13"
        />
        <div className="flex items-end">
          <Button type="submit" isLoading={loading} disabled={!scannerDevice}>
            <ScanLine className="h-4 w-4" />
            Simular
          </Button>
        </div>
      </form>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoField label="deviceId" value={scannerDevice?.id ?? "-"} />
        <InfoField label="codigo" value={result?.code ?? "-"} />
        <InfoField label="timestamp" value={formatTimestamp(result?.timestamp)} />
      </div>
    </SectionCard>
  );
};

const PeripheralCommandList = ({
  commands,
}: {
  commands?: PeripheralActionResponse["commands"];
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-900">Comandos ESC/POS MOCK</h3>
      <Badge className="border-slate-200 bg-slate-50 text-slate-700">
        {commands?.length ?? 0}
      </Badge>
    </div>
    {!commands?.length ? (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        Sin comandos conceptuales.
      </div>
    ) : (
      <div className="grid gap-2">
        {commands.map((command, index) => (
          <div
            key={`${command.name}-${index}`}
            className="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Badge className={commandTone(command.name)}>{command.name}</Badge>
              <span className="font-mono text-xs text-slate-400">
                #{String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{command.description}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PeripheralPrintPreviewPanel = ({
  preview,
  onCopy,
  onClear,
}: {
  preview?: string;
  onCopy: () => void;
  onClear: () => void;
}) => (
  <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-900">Preview termico</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCopy}
          disabled={!preview}
          title="Copiar preview"
        >
          <Copy className="h-4 w-4" />
          Copiar
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} title="Limpiar resultado">
          <Trash2 className="h-4 w-4" />
          Limpiar
        </Button>
      </div>
    </div>
    {preview ? (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
        <pre className="mx-auto max-w-[430px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-4 py-5 font-mono text-[12px] leading-5 text-slate-900 shadow-sm">
          {preview}
        </pre>
      </div>
    ) : (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        Sin preview textual. Para caja registradora se muestran comandos conceptuales.
      </div>
    )}
  </div>
);

const PeripheralActionResult = ({
  result,
  onCopyPreview,
  onClear,
}: {
  result: ActionResultState;
  onCopyPreview: () => void;
  onClear: () => void;
}) => {
  const response = result.response;
  const hasResponse = Boolean(response);
  const statusClass =
    result.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : result.status === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : result.status === "loading"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <SectionCard title="Resultado ESC/POS" eyebrow="Pruebas locales">
      <div className="space-y-5">
        <div className={`rounded-xl border p-4 ${statusClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{result.title}</p>
              <p className="mt-1 text-sm">{result.message}</p>
              {result.detail ? (
                <p className="mt-2 font-mono text-xs">{result.detail}</p>
              ) : null}
            </div>
            <Badge className="border-current bg-white/60 text-inherit">
              {result.status}
            </Badge>
          </div>
        </div>

        {isRealAdapterDisabledError(result.message) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {realAdaptersDisabledUiDetail}
          </div>
        ) : null}

        {hasResponse ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoField label="mode" value={response?.mode ?? "MOCK"} />
              <InfoField
                label="operacion"
                value={response?.jobId ? "PRINT_JOB" : "CASH_DRAWER"}
              />
              <InfoField label="jobId" value={response?.jobId ?? "-"} />
              <InfoField label="commandId" value={response?.commandId ?? "-"} />
              <InfoField label="deviceId" value={response?.deviceId ?? "-"} />
              <InfoField label="terminalId" value={response?.terminalId ?? "-"} />
            </div>

            <PeripheralAdapterMetadata response={response} />

            {!response?.preview && response?.commandId ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                Apertura de caja simulada
              </div>
            ) : null}

            <PeripheralPrintPreviewPanel
              preview={response?.preview}
              onCopy={onCopyPreview}
              onClear={onClear}
            />
            <PeripheralCommandList commands={response?.commands} />
          </>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Ejecuta una impresion MOCK o apertura de caja para ver preview y comandos.
          </div>
        )}
      </div>
    </SectionCard>
  );
};

const PeripheralLogsPanel = ({
  logs,
  loading,
  onRefresh,
}: {
  logs: PeripheralLog[];
  loading: boolean;
  onRefresh: () => void;
}) => (
  <SectionCard
    title="Logs tecnicos"
    actions={
      <Button variant="ghost" onClick={onRefresh} isLoading={loading}>
        <RefreshCw className="h-4 w-4" />
        Actualizar
      </Button>
    }
  >
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">Timestamp</th>
            <th className="px-4 py-3 font-medium">Level</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">Message</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Cargando logs...
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Sin logs tecnicos.
              </td>
            </tr>
          ) : (
            logs.slice(0, 60).map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      log.level === "ERROR"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : log.level === "WARN"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }
                  >
                    {log.level}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-700">{log.source}</td>
                <td className="px-4 py-3 text-slate-700">{log.event}</td>
                <td className="max-w-[320px] break-words px-4 py-3 text-slate-700">
                  {log.message}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </SectionCard>
);

const PeripheralEventsPanel = ({
  state,
  events,
  wsUrl,
  onReconnect,
}: {
  state: ConnectionState;
  events: PeripheralSocketEvent[];
  wsUrl: string;
  onReconnect: () => void;
}) => (
  <SectionCard
    title="Eventos WebSocket"
    actions={
      <Button variant="ghost" onClick={onReconnect}>
        <PlugZap className="h-4 w-4" />
        Reconectar
      </Button>
    }
  >
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Badge className={socketTone[state]}>
        {state === "connected" ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
        {state}
      </Badge>
      <span className="break-all text-sm text-slate-500">{getEndpointLabel(wsUrl)}</span>
    </div>
    <div className="space-y-3">
      {events.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
          Sin eventos recibidos.
        </div>
      ) : (
        events.map((event, index) => (
          <div
            key={`${event.timestamp}-${event.event}-${index}`}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-slate-900">
                {event.event}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white p-2 text-xs text-slate-700">
              {renderJson(event.payload)}
            </pre>
          </div>
        ))
      )}
    </div>
  </SectionCard>
);

const PeripheralsPage = () => {
  const params = useParams<{ tenant?: string }>();
  const tenantIdParam = typeof params?.tenant === "string" ? params.tenant : null;
  const agentConfig = useMemo(() => getPeripheralAgentConfig(), []);
  const [health, setHealth] = useState<PeripheralAgentHealth | null>(null);
  const [devices, setDevices] = useState<PeripheralDevice[]>([]);
  const [logs, setLogs] = useState<PeripheralLog[]>([]);
  const [lastWeight, setLastWeight] = useState<PeripheralScaleWeight | null>(null);
  const [scannerResult, setScannerResult] = useState<PeripheralScannerResponse | null>(null);
  const [agentState, setAgentState] = useState<ConnectionState>("loading");
  const [socketState, setSocketState] = useState<ConnectionState>("loading");
  const [agentError, setAgentError] = useState<string | null>(null);
  const [toast, setToast] = useState<ActionState | null>(null);
  const [actionResult, setActionResult] = useState<ActionResultState>({
    status: "idle",
    title: "Sin operacion",
    message: "Ejecuta una accion MOCK para ver el resultado.",
  });
  const [events, setEvents] = useState<PeripheralSocketEvent[]>([]);
  const [socketAttempt, setSocketAttempt] = useState(0);
  const [loading, setLoading] = useState({
    snapshot: true,
    devices: false,
    logs: false,
    action: false,
    networkRegistration: false,
    scale: false,
    scanner: false,
  });

  const printerDevice = useMemo(
    () =>
      devices.find(
        (device) =>
          device.type === "PRINTER" && device.connectionType === "MOCK"
      ) ?? pickDevice(devices, "PRINTER"),
    [devices]
  );
  const cashDrawerDevice = useMemo(() => pickDevice(devices, "CASH_DRAWER"), [devices]);
  const scannerDevice = useMemo(() => pickDevice(devices, "SCANNER"), [devices]);

  const showToast = useCallback((message: string, variant: ToastVariant, detail?: string) => {
    setToast({ message, detail, variant });
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading((prev) => ({ ...prev, logs: true }));
    try {
      setLogs(await fetchPeripheralLogs());
    } catch (error) {
      showToast(getErrorMessage(error), "error", getErrorDetail(error));
    } finally {
      setLoading((prev) => ({ ...prev, logs: false }));
    }
  }, [showToast]);

  const loadSnapshot = useCallback(async () => {
    setLoading((prev) => ({ ...prev, snapshot: true }));
    setAgentError(null);

    if (!agentConfig.isConfigured) {
      setHealth(null);
      setDevices([]);
      setLogs([]);
      setAgentState(
        agentConfig.status === "missing" ? "missing-config" : "invalid-config"
      );
      setAgentError(
        agentConfig.message ?? "Configuracion de backend-perifericos invalida."
      );
      setLoading((prev) => ({ ...prev, snapshot: false }));
      return;
    }

    const [healthResult, devicesResult, logsResult] = await Promise.allSettled([
      fetchPeripheralHealth(),
      fetchPeripheralDevices(),
      fetchPeripheralLogs(),
    ]);

    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value);
      setAgentState("connected");
    } else {
      setHealth(null);
      setAgentState(getAgentStateFromError(healthResult.reason));
      setAgentError(getErrorMessage(healthResult.reason));
    }

    setDevices(devicesResult.status === "fulfilled" ? devicesResult.value : []);
    setLogs(logsResult.status === "fulfilled" ? logsResult.value : []);
    setLoading((prev) => ({ ...prev, snapshot: false }));
  }, [agentConfig]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closedByEffect = false;

    if (!agentConfig.isConfigured) {
      setSocketState(
        agentConfig.status === "missing" ? "missing-config" : "invalid-config"
      );
      return () => undefined;
    }

    try {
      setSocketState("loading");
      socket = new WebSocket(agentConfig.wsUrl);

      socket.onopen = () => {
        setSocketState("connected");
      };

      socket.onmessage = (message) => {
        const normalized = normalizeSocketEvent(message);
        setEvents((prev) => [normalized, ...prev].slice(0, eventLimit));
      };

      socket.onerror = () => {
        setSocketState("error");
      };

      socket.onclose = () => {
        if (!closedByEffect) {
          setSocketState((prev) => (prev === "error" ? "error" : "disconnected"));
        }
      };
    } catch {
      setSocketState("error");
    }

    return () => {
      closedByEffect = true;
      socket?.close();
    };
  }, [agentConfig, socketAttempt]);

  const refreshDevices = useCallback(async () => {
    setLoading((prev) => ({ ...prev, devices: true }));
    try {
      setDevices(await fetchPeripheralDevices());
    } catch (error) {
      showToast(getErrorMessage(error), "error", getErrorDetail(error));
    } finally {
      setLoading((prev) => ({ ...prev, devices: false }));
    }
  }, [showToast]);

  const handleDiscover = useCallback(async () => {
    setLoading((prev) => ({ ...prev, devices: true }));
    try {
      const discovered = await discoverPeripheralDevices();
      setDevices(discovered.devices);
      await loadLogs();
      showToast(
        `Busqueda completada: ${discovered.devices.filter((device) => device.connectionType === "USB").length} USB detectado(s).`,
        "success"
      );
    } catch (error) {
      showToast(getErrorMessage(error), "error", getErrorDetail(error));
    } finally {
      setLoading((prev) => ({ ...prev, devices: false }));
    }
  }, [loadLogs, showToast]);

  const handleRegisterPrinter = useCallback(
    async (payload: CreateDeviceRequest) => {
      setLoading((prev) => ({ ...prev, networkRegistration: true }));
      try {
        const created = await createDevice(payload);
        await refreshDevices();
        await loadLogs();
        showToast(
          `Impresora ${created.connectionType} registrada.`,
          "success",
          created.connectionType === "NETWORK"
            ? `${created.id} ${getNetworkEndpoint(created)}`
            : `${created.id} ${created.usb?.printerName ?? ""}`
        );
        return created;
      } finally {
        setLoading((prev) => ({ ...prev, networkRegistration: false }));
      }
    },
    [loadLogs, refreshDevices, showToast]
  );

  const handleDeviceAction = useCallback(
    async (
      action: () => Promise<PeripheralActionResponse>,
      successMessage: string,
      title = "Accion MOCK"
    ) => {
      setLoading((prev) => ({ ...prev, action: true }));
      setActionResult((prev) => ({
        ...prev,
        status: "loading",
        title,
        message: "Ejecutando accion contra backend-perifericos...",
        detail: undefined,
      }));
      try {
        const result = await action();
        const detail = result.jobId
          ? `jobId: ${result.jobId}`
          : result.commandId
            ? `commandId: ${result.commandId}`
            : undefined;
        setActionResult({
          status: result.success ? "success" : "error",
          title,
          message: result.message ?? successMessage,
          detail,
          response: result,
          updatedAt: new Date().toISOString(),
        });
        showToast(
          result.message ?? successMessage,
          result.success ? "success" : "warning",
          detail
        );
        await loadLogs();
      } catch (error) {
        const message = getErrorMessage(error);
        const errorDetail = getErrorDetail(error);
        const disabledDetail = isRealAdapterDisabledError(message)
          ? realAdaptersDisabledUiDetail
          : undefined;
        setActionResult((prev) => {
          const previewDetail = prev.response?.preview
            ? "El ultimo preview exitoso se conserva."
            : undefined;
          return {
            ...prev,
            status: "error",
            title,
            message,
            detail: [disabledDetail, errorDetail, previewDetail]
              .filter(Boolean)
              .join(" "),
          };
        });
        showToast(message, "error", [disabledDetail, errorDetail].filter(Boolean).join(" "));
      } finally {
        setLoading((prev) => ({ ...prev, action: false }));
      }
    },
    [loadLogs, showToast]
  );

  const handleReadWeight = useCallback(async () => {
    setLoading((prev) => ({ ...prev, scale: true }));
    try {
      const weight = await fetchCurrentWeight();
      setLastWeight(weight);
      showToast(`Peso simulado: ${weight.weight} ${weight.unit}`, "success");
      await loadLogs();
    } catch (error) {
      showToast(getErrorMessage(error), "error", getErrorDetail(error));
    } finally {
      setLoading((prev) => ({ ...prev, scale: false }));
    }
  }, [loadLogs, showToast]);

  const handleScannerSubmit = useCallback(
    async (code: string, format: string) => {
      if (!scannerDevice) {
        showToast("No hay scanner MOCK disponible.", "warning");
        return;
      }
      if (!code || !format) {
        showToast("Codigo y formato son requeridos.", "warning");
        return;
      }

      setLoading((prev) => ({ ...prev, scanner: true }));
      try {
        const result = await simulateScanner(
          scannerDevice.terminalId || terminalId,
          scannerDevice.id,
          code,
          format
        );
        setScannerResult(result);
        showToast(`Lectura simulada: ${result.code}`, "success");
        await loadLogs();
      } catch (error) {
        showToast(getErrorMessage(error), "error", getErrorDetail(error));
      } finally {
        setLoading((prev) => ({ ...prev, scanner: false }));
      }
    },
    [loadLogs, scannerDevice, showToast]
  );

  const handleReconnectSocket = useCallback(() => {
    setSocketAttempt((prev) => prev + 1);
  }, []);

  const handleCopyPreview = useCallback(async () => {
    const preview = actionResult.response?.preview;
    if (!preview) {
      showToast("No hay preview para copiar.", "warning");
      return;
    }

    try {
      await navigator.clipboard.writeText(preview);
      showToast("Preview copiado al portapapeles.", "success");
    } catch {
      showToast("No se pudo copiar el preview.", "error");
    }
  }, [actionResult.response?.preview, showToast]);

  const handleClearActionResult = useCallback(() => {
    setActionResult({
      status: "idle",
      title: "Sin operacion",
      message: "Ejecuta una accion MOCK para ver el resultado.",
    });
  }, []);

  const headerActions = (
    <div className="flex flex-wrap gap-3">
      <Button variant="ghost" onClick={() => void refreshDevices()} isLoading={loading.devices}>
        <RefreshCw className="h-4 w-4" />
        Devices
      </Button>
      <Button onClick={() => void loadSnapshot()} isLoading={loading.snapshot}>
        <Activity className="h-4 w-4" />
        Health
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Administracion tecnica
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Perifericos POS
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Diagnostico local de agent, dispositivos, logs y eventos. USB se descubre por el agent local.
            </p>
          </div>
          {headerActions}
        </div>
      </section>

      {toast ? (
        <Toast
          message={
            <span>
              {toast.message}
              {toast.detail ? (
                <span className="ml-2 font-mono text-xs">{toast.detail}</span>
              ) : null}
            </span>
          }
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}

      <PeripheralAgentStatusCard
        health={health}
        state={agentState}
        error={agentError}
        loading={loading.snapshot}
        config={agentConfig}
        onRetry={() => void loadSnapshot()}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          <TerminalPosPanel
            tenantId={tenantIdParam}
            devices={devices}
            onToast={showToast}
          />

          <PrinterRegistrationPanel
            loading={loading.networkRegistration}
            onRegister={handleRegisterPrinter}
            devices={devices}
          />
          <PeripheralDevicesTable
            devices={devices}
            loading={loading.snapshot || loading.devices}
            onDiscover={() => void handleDiscover()}
            onTestPrint={(device) =>
              void handleDeviceAction(
                () => testPrint(device.terminalId || terminalId, device.id),
                "Test print simulated successfully",
                "Impresion de prueba"
              )
            }
            onPrintTicket={(device) =>
              void handleDeviceAction(
                () => printMockTicket(device.terminalId || terminalId, device.id),
                "Ticket print simulated successfully",
                "Ticket demo SALE"
              )
            }
            onOpenDrawer={(device) =>
              void handleDeviceAction(
                () => openCashDrawer(device.terminalId || terminalId, device.id),
                "Cash drawer open simulated successfully",
                "Apertura de caja"
              )
            }
            onReadWeight={() => void handleReadWeight()}
          />
          <PeripheralLogsPanel
            logs={logs}
            loading={loading.logs}
            onRefresh={() => void loadLogs()}
          />
        </div>

        <div className="space-y-6">
          <SectionCard title="Acciones rapidas">
            <div className="grid gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  printerDevice
                    ? void handleDeviceAction(
                        () => testPrint(printerDevice.terminalId || terminalId, printerDevice.id),
                        "Test print simulated successfully",
                        "Impresion de prueba"
                      )
                    : showToast("No hay impresora MOCK disponible.", "warning")
                }
                isLoading={loading.action}
              >
                <Printer className="h-4 w-4" />
                Imprimir prueba
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  printerDevice
                    ? void handleDeviceAction(
                        () =>
                          printMockTicket(
                            printerDevice.terminalId || terminalId,
                            printerDevice.id
                          ),
                        "Ticket print simulated successfully",
                        "Ticket demo SALE"
                      )
                    : showToast("No hay impresora MOCK disponible.", "warning")
                }
                isLoading={loading.action}
              >
                <FileText className="h-4 w-4" />
                Imprimir ticket demo
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  cashDrawerDevice
                    ? void handleDeviceAction(
                        () =>
                          openCashDrawer(
                            cashDrawerDevice.terminalId || terminalId,
                            cashDrawerDevice.id
                          ),
                        "Cash drawer open simulated successfully",
                        "Apertura de caja"
                      )
                    : showToast("No hay caja MOCK disponible.", "warning")
                }
                isLoading={loading.action}
              >
                <Archive className="h-4 w-4" />
                Abrir caja
              </Button>
            </div>
          </SectionCard>

          <PeripheralActionResult
            result={actionResult}
            onCopyPreview={() => void handleCopyPreview()}
            onClear={handleClearActionResult}
          />

          <PeripheralScalePanel
            lastWeight={lastWeight}
            loading={loading.scale}
            onReadWeight={() => void handleReadWeight()}
          />

          <PeripheralScannerSimulator
            scannerDevice={scannerDevice}
            loading={loading.scanner}
            result={scannerResult}
            onSubmit={(code, format) => void handleScannerSubmit(code, format)}
          />

          <PeripheralEventsPanel
            state={socketState}
            events={events}
            wsUrl={agentConfig.wsUrl}
            onReconnect={handleReconnectSocket}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Terminal className="h-4 w-4 text-slate-500" />
          <span className="break-all">HTTP {getEndpointLabel(agentConfig.httpUrl)}</span>
          <span className="break-all">WS {getEndpointLabel(agentConfig.wsUrl)}</span>
        </div>
      </div>
    </div>
  );
};

export default PeripheralsPage;
