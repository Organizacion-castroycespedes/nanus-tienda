"use client";

import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "../../../components/design-system/Button";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import {
  listTerminals as listOperationalTerminals,
  type TerminalResponse,
} from "../../../modules/terminals/services/terminals.service";
import {
  discoverPeripheralDevices,
  fetchPeripheralDevices,
  fetchPeripheralHealth,
  openCashDrawerCommand,
  updateDevice,
  testPrint,
} from "../api";
import {
  resolveCurrentPosTerminalConfig,
  savePosTerminalPeripheralSettings,
} from "../terminal-config";
import {
  isPrinterBackedCashDrawer,
  resolveCashDrawerDeviceIdToPersist,
} from "../cash-drawer-routing";
import SupportDiagnosticsCard from "./SupportDiagnosticsCard";
import type {
  PeripheralAgentHealth,
  PeripheralDevice,
  CashDrawerResponse,
  PosTerminalResolvedConfig,
  PeripheralDiscoverResponse,
  PrinterProfileId,
} from "../types";

type ToastState = {
  message: string;
  detail?: string;
  variant: ToastVariant;
};

type BlockState = {
  status: "configured" | "not-configured" | "detected" | "missing" | "error";
  title: string;
  detail: string;
};

const formatEndpoint = (device?: PeripheralDevice | null) => {
  if (!device) return "-";
  if (device.connectionType === "NETWORK" && device.network) {
    return `${device.network.host}:${device.network.port}`;
  }
  if (device.connectionType === "USB" && device.usb) {
    return device.usb.deviceId;
  }
  return device.id;
};

const PRINTER_PROFILE_OPTIONS: Array<{ id: PrinterProfileId; label: string; detail: string }> = [
  {
    id: "THERMAL_58MM",
    label: "58 mm",
    detail: "32 chars. Perfil real para Xprinter 58 mm USB.",
  },
  {
    id: "THERMAL_80MM",
    label: "80 mm",
    detail: "48 chars. Mantiene el layout existente.",
  },
];

const getPrinterProfileLabel = (profileId?: PrinterProfileId | string | null) =>
  PRINTER_PROFILE_OPTIONS.find((option) => option.id === profileId)?.label ?? "80 mm";

const getUsbCashDrawerCertification = (device?: PeripheralDevice | null) =>
  device?.metadata?.["usbRawCashDrawerPulseCertified"] === true;

const terminalLabel = (terminal: TerminalResponse) =>
  `${terminal.code}  ${terminal.name}  ${terminal.branchName ?? "-"}`;

const infoBox = (label: string, value: string) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:bg-slate-800 dark:border-slate-700">
    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</p>
  </div>
);

const blockTone = (state: BlockState["status"]) =>
  state === "configured" || state === "detected"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : state === "missing"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : state === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

const BlockCard = ({
  title,
  state,
  children,
}: {
  title: string;
  state: BlockState;
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{state.title}</h3>
      </div>
      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${blockTone(state.status)}`}>
        {state.status}
      </span>
    </div>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{state.detail}</p>
    <div className="mt-4">{children}</div>
  </section>
);

const PeripheralsAdminWorkspace = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => pathname.split("/")[1] ?? "", [pathname]);
  const queryTerminalId = searchParams.get("terminalId")?.trim() ?? "";
  const [terminals, setTerminals] = useState<TerminalResponse[]>([]);
  const [health, setHealth] = useState<PeripheralAgentHealth | null>(null);
  const [devices, setDevices] = useState<PeripheralDevice[]>([]);
  const [resolved, setResolved] = useState<PosTerminalResolvedConfig | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState(queryTerminalId);
  const [printerDeviceId, setPrinterDeviceId] = useState("");
  const [printerProfileId, setPrinterProfileId] = useState<PrinterProfileId>("THERMAL_80MM");
  const [drawerCertified, setDrawerCertified] = useState(false);
  const [drawerResult, setDrawerResult] = useState<CashDrawerResponse | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [loading, setLoading] = useState({
    snapshot: true,
    discover: false,
    save: false,
    testPrint: false,
    testDrawer: false,
  });

  const showToast = useCallback((message: string, variant: ToastVariant, detail?: string) => {
    setToast({ message, variant, detail });
  }, []);

  const replaceQueryTerminal = useCallback(
    (terminalId: string) => {
      if (!pathname) return;
      const params = new URLSearchParams(searchParams.toString());
      if (terminalId) params.set("terminalId", terminalId);
      else params.delete("terminalId");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadSnapshot = useCallback(
    async (terminalId?: string) => {
      setLoading((prev) => ({ ...prev, snapshot: true }));
      try {
        const [terminalsResult, healthResult, devicesResult] = await Promise.allSettled([
          listOperationalTerminals({ tenantId: tenantSlug || undefined }),
          fetchPeripheralHealth(),
          fetchPeripheralDevices(),
        ]);

        const availableTerminals =
          terminalsResult.status === "fulfilled" ? terminalsResult.value : [];
        const requestedTerminal: TerminalResponse | null = terminalId
          ? availableTerminals.find((terminal) => terminal.id === terminalId) ?? null
          : null;
        const effectiveTerminalId =
          requestedTerminal?.id ?? availableTerminals[0]?.id ?? terminalId;
        const resolvedResult = effectiveTerminalId
          ? await Promise.resolve(
              resolveCurrentPosTerminalConfig({
                tenantId: tenantSlug || undefined,
                terminalId: effectiveTerminalId,
              })
            ).then(
              (value) => ({ status: "fulfilled" as const, value }),
              (reason) => ({ status: "rejected" as const, reason })
            )
          : await Promise.resolve(
              resolveCurrentPosTerminalConfig({
                tenantId: tenantSlug || undefined,
              })
            ).then(
              (value) => ({ status: "fulfilled" as const, value }),
              (reason) => ({ status: "rejected" as const, reason })
            );

        if (terminalsResult.status === "fulfilled") {
          setTerminals(terminalsResult.value);
          if (!terminalId && availableTerminals[0]) {
            replaceQueryTerminal(availableTerminals[0].id);
            setSelectedTerminalId(availableTerminals[0].id);
          } else if (requestedTerminal) {
            setSelectedTerminalId(requestedTerminal.id);
          } else if (effectiveTerminalId) {
            setSelectedTerminalId(effectiveTerminalId);
          }
        }

        if (healthResult.status === "fulfilled") {
          setHealth(healthResult.value);
        } else {
          setHealth(null);
        }

        if (devicesResult.status === "fulfilled") {
          setDevices(devicesResult.value);
        } else {
          setDevices([]);
        }

        if (resolvedResult.status === "fulfilled") {
          setResolved(resolvedResult.value);
          setPrinterDeviceId(resolvedResult.value.printerDeviceId ?? "");
          if (!terminalId && resolvedResult.value.operationalTerminalId) {
            replaceQueryTerminal(resolvedResult.value.operationalTerminalId);
            setSelectedTerminalId(resolvedResult.value.operationalTerminalId);
          }
        } else {
          setResolved(null);
          setPrinterDeviceId("");
        }
      } finally {
        setLoading((prev) => ({ ...prev, snapshot: false }));
      }
    },
    [replaceQueryTerminal, tenantSlug]
  );

  useEffect(() => {
    void loadSnapshot(queryTerminalId || undefined);
  }, [loadSnapshot, queryTerminalId]);

  useEffect(() => {
    if (queryTerminalId && queryTerminalId !== selectedTerminalId) {
      setSelectedTerminalId(queryTerminalId);
    }
  }, [queryTerminalId, selectedTerminalId]);

  const selectedTerminal = terminals.find((terminal) => terminal.id === selectedTerminalId);
  const selectedPrinterDevice = devices.find((device) => device.id === printerDeviceId);
  const printerCandidates = devices.filter((device) => device.type === "PRINTER");
  const selectedPrinterDrawerCertified = getUsbCashDrawerCertification(selectedPrinterDevice);
  const printerBackedDrawer = isPrinterBackedCashDrawer({
    currentCashDrawerDeviceId: resolved?.cashDrawerDeviceId ?? null,
    selectedPrinterDeviceId: selectedPrinterDevice?.id ?? printerDeviceId ?? null,
    selectedPrinterConnectionType: selectedPrinterDevice?.connectionType ?? null,
    printerDrawerCertified: selectedPrinterDrawerCertified,
  });

  useEffect(() => {
    const profileId = selectedPrinterDevice?.profileId;
    if (profileId === "THERMAL_58MM" || profileId === "THERMAL_80MM") {
      setPrinterProfileId(profileId);
      return;
    }

    if (printerDeviceId || resolved?.printerDeviceId) {
      setPrinterProfileId("THERMAL_80MM");
    }
  }, [printerDeviceId, resolved?.printerDeviceId, selectedPrinterDevice?.profileId]);

  useEffect(() => {
    setDrawerCertified(selectedPrinterDrawerCertified);
  }, [selectedPrinterDrawerCertified, selectedPrinterDevice?.id]);

  const currentBlockState: BlockState = resolved?.source === "CONFIGURED"
    ? {
        status: "configured",
        title: "Periféricos configurados",
        detail: "La terminal canónica ya tiene configuración persistida.",
      }
    : {
        status: "not-configured",
        title: "Periféricos no configurados",
        detail: "La terminal no tiene perfil persistido todavía.",
      };

  const printerState: BlockState = printerDeviceId
    ? selectedPrinterDevice
      ? {
          status: "detected",
          title: "Impresora configurada y detectada",
          detail: "La impresora persistida responde en el Agent local.",
        }
      : {
          status: "missing",
          title: "Impresora configurada pero no detectada",
          detail: "La configuración existe, pero el Agent no la ve ahora.",
        }
    : {
        status: "not-configured",
        title: "Impresora no configurada",
        detail: "Asociar una impresora desde los dispositivos descubiertos.",
      };

  const savePrinter = async (nextPrinterDeviceId: string | null) => {
    const currentResolved = resolved;
    const targetTerminalId = currentResolved?.posTerminalId;
    if (!targetTerminalId || !currentResolved) {
      showToast("Periféricos no configurados para la terminal.", "warning");
      return;
    }

    const targetDeviceId =
      selectedPrinterDevice?.id || printerDeviceId || currentResolved.printerDeviceId;
    const nextCashDrawerDeviceId = nextPrinterDeviceId
      ? resolveCashDrawerDeviceIdToPersist({
          currentCashDrawerDeviceId: currentResolved.cashDrawerDeviceId,
          selectedPrinterDeviceId: nextPrinterDeviceId,
          selectedPrinterConnectionType: selectedPrinterDevice?.connectionType ?? null,
          printerDrawerCertified: drawerCertified,
        })
      : currentResolved.cashDrawerDeviceId;

    setLoading((prev) => ({ ...prev, save: true }));
    try {
      if (nextPrinterDeviceId && targetDeviceId) {
        const targetDevice = devices.find((device) => device.id === targetDeviceId) ?? selectedPrinterDevice;
        const targetDeviceMetadata = targetDevice?.metadata ?? {};
        const nextMetadata =
          targetDevice?.connectionType === "USB"
            ? {
                ...targetDeviceMetadata,
              usbRawCashDrawerPulseCertified: drawerCertified,
              }
            : undefined;
        const updatedDevice = await updateDevice(targetDeviceId, {
          profileId: printerProfileId,
          ...(nextMetadata ? { metadata: nextMetadata } : {}),
        });
        setDevices((prev) =>
          prev.map((device) => (device.id === updatedDevice.id ? updatedDevice : device))
        );
      }

      await savePosTerminalPeripheralSettings(targetTerminalId, {
        printerDeviceId: nextPrinterDeviceId,
        cashDrawerDeviceId: nextCashDrawerDeviceId,
        scaleDeviceId: currentResolved.scaleDeviceId,
        scannerDeviceId: currentResolved.scannerDeviceId,
        enablePrintSale: currentResolved.features.printSale,
        enablePrintPurchase: currentResolved.features.printPurchase,
        enablePrintOrder: currentResolved.features.printOrder,
        enableOpenDrawer: currentResolved.features.openDrawer,
        enableScale: currentResolved.features.scale,
        enableScanner: currentResolved.features.scanner,
      });
      await loadSnapshot(selectedTerminalId || undefined);
      showToast(
        nextPrinterDeviceId
          ? `Impresora asociada con perfil ${getPrinterProfileLabel(printerProfileId)}.`
          : "Impresora desasociada.",
        "success"
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar.", "error");
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  const handleDiscover = async () => {
    setLoading((prev) => ({ ...prev, discover: true }));
    try {
      const discovered: PeripheralDiscoverResponse = await discoverPeripheralDevices();
      setDevices(discovered.devices);
      showToast(`Busqueda completa: ${discovered.devices.length} device(s).`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Busqueda fallida.", "error");
    } finally {
      setLoading((prev) => ({ ...prev, discover: false }));
    }
  };

  const handleTestPrint = async () => {
    const terminalIdForPrint =
      resolved?.operationalTerminalId ?? selectedTerminalId ?? queryTerminalId;
    const deviceId = printerDeviceId || resolved?.printerDeviceId;
    if (!terminalIdForPrint || !deviceId) {
      showToast("Falta terminal o impresora.", "warning");
      return;
    }

    setLoading((prev) => ({ ...prev, testPrint: true }));
    try {
      const response = await testPrint(terminalIdForPrint, deviceId);
      showToast(response.message ?? "Test print enviado.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Test print fallido.", "error");
    } finally {
      setLoading((prev) => ({ ...prev, testPrint: false }));
    }
  };

  const handleTestDrawer = async () => {
    const terminalIdForDrawer =
      resolved?.operationalTerminalId ?? selectedTerminalId ?? queryTerminalId;
    const printerId =
      selectedPrinterDevice?.id || printerDeviceId || resolved?.printerDeviceId;
    if (!terminalIdForDrawer || !printerId) {
      showToast("Falta terminal o impresora para el cajon.", "warning");
      return;
    }

    setLoading((prev) => ({ ...prev, testDrawer: true }));
    try {
      const response = await openCashDrawerCommand({
        terminalId: terminalIdForDrawer,
        printerDeviceId: printerId,
        deviceId: printerId,
        reason: "MANUAL_TEST",
      });
      setDrawerResult(response);
      showToast(
        response.success
          ? `Cajon via impresora ${response.mode}.`
          : "Cajon sin resultado.",
        response.success ? "success" : "warning",
        response.adapterName
      );
    } catch (error) {
      setDrawerResult(null);
      showToast(error instanceof Error ? error.message : "Apertura fallida.", "error");
    } finally {
      setLoading((prev) => ({ ...prev, testDrawer: false }));
    }
  };

  return (
    <div className="space-y-6">
      {toast ? (
        <Toast
          message={
            <span>
              {toast.message}
              {toast.detail ? <span className="ml-2 font-mono text-xs">{toast.detail}</span> : null}
            </span>
          }
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Configuración operativa</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Periféricos por terminal</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Terminal canónica, periféricos asociados y dispositivos disponibles en Agent local.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => void loadSnapshot(selectedTerminalId || undefined)} isLoading={loading.snapshot}>
              <RefreshCw className="h-4 w-4" />
              Resolver
            </Button>
            <Button variant="outline" onClick={() => void handleDiscover()} isLoading={loading.discover}>
              <Search className="h-4 w-4" />
              Buscar dispositivos
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {infoBox("Terminal", selectedTerminal ? terminalLabel(selectedTerminal) : "Sin seleccionar")}
          {infoBox("Estado", currentBlockState.title)}
          {infoBox("Sucursal", selectedTerminal?.branchName ?? resolved?.branchName ?? "-")}
          {infoBox("Perfil POS", resolved?.posTerminalId ?? "No asignado")}
        </div>

        <div className="mt-4">
          <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">Terminal canónica</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700"
              value={selectedTerminalId}
              onChange={(event) => {
                const nextTerminalId = event.target.value;
                setSelectedTerminalId(nextTerminalId);
                replaceQueryTerminal(nextTerminalId);
                void loadSnapshot(nextTerminalId || undefined);
              }}
            >
              <option value="">Selecciona una terminal</option>
              {terminals.map((terminal) => (
                <option key={terminal.id} value={terminal.id}>
                  {terminalLabel(terminal)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Servicio Manus</p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {health ? "Servicio Manus conectado" : "No encontramos el servicio Manus en este equipo"}
            </h2>
          </div>
          <Button variant="ghost" onClick={() => void loadSnapshot(selectedTerminalId || undefined)} isLoading={loading.snapshot}>
            <RefreshCw className="h-4 w-4" />
            Reconectar
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {infoBox("Versión", health?.version ?? "-")}
          {infoBox("Conexión local", health?.agent ?? "127.0.0.1:4050")}
          {infoBox("Dispositivos", String(devices.length))}
          {infoBox("Estado técnico", health?.status ?? "offline")}
          {infoBox("configuredDevices", String(health?.configuredDevices ?? "-"))}
          {infoBox("discoveredDevices", String(health?.discoveredDevices ?? "-"))}
          {infoBox("persistenceState", health?.persistenceState ? `${health.persistenceState.status} / v${health.persistenceState.schemaVersion}` : "-")}
          {infoBox("platform", [health?.platform, health?.architecture].filter(Boolean).join(" / ") || "-")}
        </div>
      </section>

      <SupportDiagnosticsCard />

      <BlockCard title="Impresora" state={printerState}>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {infoBox("connectionType", selectedPrinterDevice?.connectionType ?? "-")}
            {infoBox("profile", getPrinterProfileLabel(selectedPrinterDevice?.profileId ?? printerProfileId))}
            {infoBox("endpoint", formatEndpoint(selectedPrinterDevice))}
            {infoBox("deviceId", (selectedPrinterDevice?.id ?? printerDeviceId) || "-")}
            {infoBox("cajon", printerBackedDrawer ? "Vía impresora" : "Independiente")}
          </div>
          <div className="space-y-3">
            <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Dispositivo</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700"
                value={printerDeviceId}
                onChange={(event) => setPrinterDeviceId(event.target.value)}
              >
                <option value="">Sin configurar</option>
                {printerCandidates.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} · {device.connectionType} · {formatEndpoint(device)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Perfil de impresión</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700"
                value={printerProfileId}
                onChange={(event) => setPrinterProfileId(event.target.value as PrinterProfileId)}
              >
                {PRINTER_PROFILE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} - {option.detail}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                checked={drawerCertified}
                onChange={(event) => setDrawerCertified(event.target.checked)}
                disabled={selectedPrinterDevice?.connectionType !== "USB"}
              />
              <span>
                Cajón vía impresora
                <span className="ml-2 font-semibold text-slate-900 dark:text-white">
                  {selectedPrinterDevice?.connectionType === "USB"
                    ? selectedPrinterDrawerCertified
                      ? "CERTIFICADO"
                      : "NO CERTIFICADO"
                    : "NO APLICA"}
                </span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void handleTestPrint()} isLoading={loading.testPrint}>
                <Printer className="h-4 w-4" />
                Probar impresión
              </Button>
              <Button variant="outline" onClick={() => void savePrinter(printerDeviceId || null)} isLoading={loading.save}>
                <CheckCircle2 className="h-4 w-4" />
                Asociar / Cambiar
              </Button>
              <Button variant="ghost" onClick={() => void savePrinter(null)} isLoading={loading.save}>
                Desasociar
              </Button>
            </div>
          </div>
        </div>
      </BlockCard>

      <div className="grid gap-4 md:grid-cols-3">
        <BlockCard
          title="Scanner"
          state={{
            status: resolved?.scannerDeviceId ? "configured" : "not-configured",
            title: resolved?.scannerDeviceId ? "Scanner configurado" : "Scanner pendiente",
            detail: resolved?.scannerDeviceId
              ? "Configuración persistida visible."
              : "Próximamente / Pendiente de integración.",
          }}
        >
          <div className="space-y-3">
            {infoBox("connectionType", "USB_HID")}
            {infoBox("deviceId", resolved?.scannerDeviceId ?? "-")}
          </div>
        </BlockCard>
        <BlockCard
          title="Balanza"
          state={{
            status: resolved?.scaleDeviceId ? "configured" : "not-configured",
            title: resolved?.scaleDeviceId ? "Balanza configurada" : "Balanza pendiente",
            detail: resolved?.scaleDeviceId
              ? "Configuración persistida visible."
              : "Próximamente / Pendiente de integración.",
          }}
        >
          {infoBox("deviceId", resolved?.scaleDeviceId ?? "-")}
        </BlockCard>
        <BlockCard
          title="Cajón vía impresora"
          state={{
            status: selectedPrinterDevice ? "configured" : "not-configured",
            title: selectedPrinterDevice ? "Cajón vía impresora configurado" : "Cajón pendiente",
            detail: selectedPrinterDevice
              ? "El cajón cuelga de la impresora canónica."
              : "Próximamente / Pendiente de integración.",
          }}
        >
          <div className="space-y-3">
            {infoBox("printerDeviceId", selectedPrinterDevice?.id ?? resolved?.printerDeviceId ?? "-")}
            {infoBox("connectionType", selectedPrinterDevice?.connectionType ?? "-")}
            {infoBox("endpoint", selectedPrinterDevice ? formatEndpoint(selectedPrinterDevice) : "-")}
            {infoBox(
              "drawerPulse",
              selectedPrinterDevice?.connectionType === "USB"
                ? selectedPrinterDrawerCertified
                  ? "CERTIFICADO"
                  : "NO CERTIFICADO"
                : "NO APLICA"
            )}
            {infoBox(
              "último resultado",
              drawerResult ? `${drawerResult.mode} / ${drawerResult.adapterName} / ${drawerResult.message}` : "-"
            )}
            <Button
              variant="outline"
              onClick={() => void handleTestDrawer()}
              isLoading={loading.testDrawer}
              disabled={!selectedPrinterDevice && !resolved?.printerDeviceId}
            >
              <Archive className="h-4 w-4" />
              Probar apertura
            </Button>
          </div>
        </BlockCard>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <ChevronRight className="h-4 w-4" />
          Herramientas técnicas / QA
        </summary>
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {infoBox("operationalTerminalId", resolved?.operationalTerminalId ?? "-")}
            {infoBox("posTerminalId", resolved?.posTerminalId ?? "-")}
            {infoBox("agentTerminalCode", resolved?.agentTerminalCode ?? "-")}
            {infoBox("source", resolved?.source ?? "-")}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Conexion</th>
                  <th className="px-4 py-3 font-medium">Endpoint</th>
                  <th className="px-4 py-3 font-medium">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                      Sin dispositivos descubiertos.
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => (
                    <tr key={device.id}>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{device.id}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{device.type}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{device.name}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{device.connectionType}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">
                        {formatEndpoint(device)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">-</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
};

export default PeripheralsAdminWorkspace;
