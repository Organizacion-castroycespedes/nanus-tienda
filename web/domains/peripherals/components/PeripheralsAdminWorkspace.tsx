"use client";

import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
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
  fetchCurrentWeight,
  openCashDrawerCommand,
  updateDevice,
  testPrint,
} from "../api";
import {
  approveAgentPairing, confirmScaleKg, createScaleBinding, deliverAgentEnrollmentEnvelope,
  fetchAgentPairingStatus, fetchScaleAuthorizationSnapshot, startAgentPairing,
  testScaleAuthorizationReading, revokeAgentCredential, revokeScaleBinding,
  type AgentPairingStatus, type ScaleAuthorizationSnapshot,
} from "../scale-authorization.api";
import {
  buildAgentUnitVerificationFromConfirmedBinding,
  buildAgentMetadataAfterBackendKgConfirmation,
  deriveScaleAuthorizationUiState,
  isCurrentKgConfirmationEvidence,
  KG_CONFIRMATION_EVIDENCE_MAX_AGE_MS,
  loadScaleAuthorizationRefresh,
  type KgConfirmationEvidence,
} from "../scale-authorization-ui-state";
import {
  DEFAULT_SCALE_DEVICE_ID,
  resolveCurrentPosTerminalConfig,
  savePosTerminalPeripheralSettings,
} from "../terminal-config";
import {
  buildScaleAssociationSettings,
  buildScaleAgentConfiguration,
  isMockScaleConfiguration,
  resolveScaleAssociationState,
} from "../scale-association";
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
  const tenantSlug = pathname.split("/")[1] ?? "";
  const queryTerminalId = searchParams.get("terminalId")?.trim() ?? "";
  const [terminals, setTerminals] = useState<TerminalResponse[]>([]);
  const [health, setHealth] = useState<PeripheralAgentHealth | null>(null);
  const [devices, setDevices] = useState<PeripheralDevice[]>([]);
  const [resolved, setResolved] = useState<PosTerminalResolvedConfig | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState(queryTerminalId);
  const [printerDeviceId, setPrinterDeviceId] = useState("");
  const [scaleDeviceId, setScaleDeviceId] = useState("");
  const [agentPairing, setAgentPairing] = useState<AgentPairingStatus | null>(null);
  const [authorization, setAuthorization] = useState<ScaleAuthorizationSnapshot | null>(null);
  const [operatorPairingCode, setOperatorPairingCode] = useState("");
  const [realTestResult, setRealTestResult] = useState<{ available: boolean; reason: string; reading?: { weight?: number; unit: string | null; source: string | null; unitVerified: boolean; observedAt: string | null } } | null>(null);
  const [unitConfirmationReading, setUnitConfirmationReading] = useState<KgConfirmationEvidence | null>(null);
  const [authorizationRefresh, setAuthorizationRefresh] = useState<"idle" | "loading" | "success" | "partial">("idle");
  const [authorizationBusy, setAuthorizationBusy] = useState(false);
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
          setScaleDeviceId(
            isMockScaleConfiguration(resolvedResult.value)
              ? ""
              : resolvedResult.value.scaleDeviceId ?? ""
          );
          if (!terminalId && resolvedResult.value.operationalTerminalId) {
            replaceQueryTerminal(resolvedResult.value.operationalTerminalId);
            setSelectedTerminalId(resolvedResult.value.operationalTerminalId);
          }
        } else {
          setResolved(null);
          setPrinterDeviceId("");
          setScaleDeviceId("");
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

  useEffect(() => {
    setUnitConfirmationReading(null);
    setRealTestResult(null);
  }, [resolved?.posTerminalId, resolved?.scaleDeviceId, authorization?.binding?.id, agentPairing?.installationId]);

  useEffect(() => {
    if (!unitConfirmationReading) return;
    const expiresIn = KG_CONFIRMATION_EVIDENCE_MAX_AGE_MS
      - (Date.now() - Date.parse(unitConfirmationReading.observedAt)) + 1;
    const timer = window.setTimeout(() => setUnitConfirmationReading(null), Math.max(0, expiresIn));
    return () => window.clearTimeout(timer);
  }, [unitConfirmationReading]);

  const refreshScaleAuthorization = useCallback(async (posTerminalId: string, probeForCurrentReal = false) => {
    const results = await loadScaleAuthorizationRefresh({
      agent: fetchAgentPairingStatus,
      snapshot: () => fetchScaleAuthorizationSnapshot(posTerminalId),
      devices: fetchPeripheralDevices,
    });
    const agentResult = results.agent;
    const stateResult = results.snapshot;
    const devicesResult = results.devices;
    const agent = agentResult.status === "fulfilled" ? agentResult.value : null;
    const snapshot = stateResult.status === "fulfilled" ? stateResult.value : null;
    setAgentPairing(agent);
    setAuthorization(snapshot);
    if (devicesResult.status === "fulfilled") setDevices(devicesResult.value);
    let probeSucceeded: boolean | null = null;
    if (probeForCurrentReal && agent?.enrolled && snapshot?.agent.authenticated
      && snapshot.binding?.status === "AUTHORIZED" && snapshot.scaleDeviceId) {
      try {
        const reading = await testScaleAuthorizationReading(posTerminalId, snapshot.scaleDeviceId);
        setRealTestResult(reading);
        probeSucceeded = true;
      } catch { setRealTestResult(null); probeSucceeded = false; }
    } else if (probeForCurrentReal) setRealTestResult(null);
    return { agent, snapshot, devices: devicesResult.status === "fulfilled" ? devicesResult.value : null,
      complete: agentResult.status === "fulfilled" && stateResult.status === "fulfilled"
        && devicesResult.status === "fulfilled", probeSucceeded };
  }, []);

  useEffect(() => {
    if (resolved?.posTerminalId) void refreshScaleAuthorization(resolved.posTerminalId, true);
    else { setAuthorization(null); setAgentPairing(null); }
  }, [resolved?.posTerminalId, refreshScaleAuthorization]);

  const withAuthorizationBusy = async (action: () => Promise<void>) => {
    setAuthorizationBusy(true);
    try { await action(); }
    catch (error) { showToast(error instanceof Error ? error.message : "No se pudo completar la autorización.", "error"); }
    finally { setAuthorizationBusy(false); }
  };

  const handleStartAgentPairing = () => withAuthorizationBusy(async () => {
    const status = await startAgentPairing();
    setAgentPairing(status);
    if (!status.pairing) throw new Error("El Agent no generó un desafío de emparejamiento.");
    setOperatorPairingCode("");
    showToast("Agent listo para emparejar. Confirma el código visible localmente.", "success");
  });

  const handleApproveAgentPairing = () => withAuthorizationBusy(async () => {
    const posTerminalId = resolved?.posTerminalId;
    const logicalScaleId = resolved?.scaleDeviceId;
    const pairing = agentPairing?.pairing;
    if (!posTerminalId || !logicalScaleId || !pairing) throw new Error("Falta terminal, balanza o desafío vigente del Agent.");
    if (operatorPairingCode.trim() !== pairing.pairingCode) throw new Error("El código confirmado no coincide con el Agent.");
    const approved = await approveAgentPairing({ signedChallenge: pairing.signedChallenge,
      pairingCode: operatorPairingCode.trim(), posTerminalId, logicalScaleId,
      enrollmentPublicKeyPem: pairing.enrollmentPublicKeyPem });
    await deliverAgentEnrollmentEnvelope(approved.envelope);
    await refreshScaleAuthorization(posTerminalId);
    setOperatorPairingCode("");
    showToast("Agent emparejado y autenticado. El secreto nunca se entrega a la interfaz.", "success");
  });

  const handleCreateScaleBinding = () => withAuthorizationBusy(async () => {
    if (!resolved?.posTerminalId || !resolved.scaleDeviceId || !authorization?.agent.authenticated) throw new Error("Empareja el Agent y persiste la balanza física antes de crear la autorización comercial.");
    await createScaleBinding(resolved.posTerminalId, resolved.scaleDeviceId);
    await refreshScaleAuthorization(resolved.posTerminalId);
  });

  const handleConfirmKg = () => withAuthorizationBusy(async () => {
    if (!authorization?.binding?.id) throw new Error("No existe una asociación comercial pendiente.");
    const device = devices.find((candidate) => candidate.id === resolved?.scaleDeviceId) ?? null;
    if (!isCurrentKgConfirmationEvidence({ evidence: unitConfirmationReading, snapshot: authorization,
      localAgent: agentPairing, configuredScaleId: resolved?.scaleDeviceId ?? null, configuredDevice: device,
      expectedPosTerminalId: resolved?.posTerminalId ?? null, expectedOperationalTerminalId: resolved?.operationalTerminalId ?? null,
      expectedBranchId: resolved?.branchId ?? null })) {
      setUnitConfirmationReading(null);
      throw new Error("Lee de nuevo: se requiere evidencia REAL reciente de la misma instalación, terminal y ROCHI.");
    }
    const confirmed = await confirmScaleKg(authorization.binding.id);
    const verification = buildAgentUnitVerificationFromConfirmedBinding(confirmed);
    if (!verification) throw new Error("Backend confirmation did not include valid operator KG evidence.");
    setUnitConfirmationReading(null);
    try {
      const configuredDevice = devices.find((candidate) => candidate.id === resolved?.scaleDeviceId);
      if (!configuredDevice || !resolved?.scaleDeviceId) throw new Error("Configured scale not found");
      const updated = await updateDevice(resolved.scaleDeviceId, {
        metadata: buildAgentMetadataAfterBackendKgConfirmation(configuredDevice.metadata, confirmed) ?? {},
      });
      setDevices((previous) => previous.map((candidate) => candidate.id === updated.id ? updated : candidate));
    } catch {
      await refreshScaleAuthorization(authorization.posTerminalId);
      showToast("KG quedó confirmado por backend, pero faltó sincronizar la evidencia local del Agent. Use el botón de reintento.", "warning");
      return;
    }
    await refreshScaleAuthorization(authorization.posTerminalId);
    showToast("Confirmación de unidad kg registrada por el operador.", "success");
  });

  const handleReadForKgConfirmation = () => withAuthorizationBusy(async () => {
    if (!resolved?.scaleDeviceId) throw new Error("No hay una balanza física persistida.");
    if (!resolved.posTerminalId || !authorization?.binding) throw new Error("Falta el contexto comercial de la balanza.");
    const device = devices.find((candidate) => candidate.id === resolved.scaleDeviceId);
    if (!device || device.type !== "SCALE" || device.connectionType !== "SERIAL"
      || device.profileId !== "ROCHI_A01E" || device.terminalId !== "local-terminal"
      || device.metadata?.configured !== true) {
      throw new Error("La ROCHI no coincide con el dispositivo SERIAL configurado por el Agent.");
    }
    const reading = await fetchCurrentWeight({ terminalId: "local-terminal", deviceId: resolved.scaleDeviceId });
    const evidence: KgConfirmationEvidence = { weight: reading.weight, unit: reading.unit, source: reading.source ?? "",
      unitVerified: reading.unitVerified === true, stable: reading.stable,
      stabilityVerified: reading.stabilityVerified === true, observedAt: reading.timestamp,
      bindingId: authorization.binding.id, installationId: agentPairing?.installationId ?? "",
      branchId: authorization.branchId,
      terminalId: device.terminalId, profileId: device.profileId ?? "", posTerminalId: resolved.posTerminalId,
      operationalTerminalId: authorization.operationalTerminalId ?? "", logicalScaleId: reading.deviceId };
    if (!isCurrentKgConfirmationEvidence({ evidence, snapshot: authorization, localAgent: agentPairing,
      configuredScaleId: resolved.scaleDeviceId, configuredDevice: device,
      expectedPosTerminalId: resolved.posTerminalId, expectedOperationalTerminalId: resolved.operationalTerminalId,
      expectedBranchId: resolved.branchId })) {
      setUnitConfirmationReading(null);
      throw new Error(reading.source !== "REAL"
        ? "La lectura no proviene de la balanza REAL configurada; no se usará como evidencia."
        : "La lectura REAL no coincide con la configuración comercial actual o no es numérica/fresca.");
    }
    setUnitConfirmationReading(evidence);
    showToast(`Lectura REAL: ${reading.weight} (unidad sin verificar). Confirma físicamente que la balanza está configurada en kg; estabilidad no inferida.`, "success");
  });

  const handleSyncConfirmedUnitVerification = () => withAuthorizationBusy(async () => {
    const verification = buildAgentUnitVerificationFromConfirmedBinding(authorization?.binding ?? null);
    const device = devices.find((candidate) => candidate.id === authorization?.scaleDeviceId);
    if (!verification || !device || !authorization?.scaleDeviceId
      || authorization.binding?.logicalScaleId !== authorization.scaleDeviceId
      || device.id !== authorization.binding.logicalScaleId || device.profileId !== "ROCHI_A01E"
      || device.connectionType !== "SERIAL" || device.terminalId !== "local-terminal") {
      throw new Error("El backend no confirma KG_VERIFIED para esta balanza; no se actualizará el Agent.");
    }
    const updated = await updateDevice(authorization.scaleDeviceId, {
      metadata: buildAgentMetadataAfterBackendKgConfirmation(device.metadata, authorization.binding) ?? {},
    });
    setDevices((previous) => previous.map((candidate) => candidate.id === updated.id ? updated : candidate));
    showToast("Evidencia OPERATOR_CONFIRMATION sincronizada con el Agent.", "success");
  });

  const handleRefreshAuthorization = async () => {
    if (!resolved?.posTerminalId) return;
    setAuthorizationRefresh("loading");
    const result = await refreshScaleAuthorization(resolved.posTerminalId, true);
    const readinessProbeRequired = result.snapshot?.binding?.status === "AUTHORIZED";
    const complete = result.complete && (!readinessProbeRequired || result.probeSucceeded === true);
    setAuthorizationRefresh(complete ? "success" : "partial");
    if (complete) showToast("Estado de Agent, dispositivos y autorización actualizado.", "success");
    else showToast(readinessProbeRequired && result.complete
      ? "Estado actualizado, pero no se pudo verificar una lectura REAL actual."
      : "Actualización parcial: uno o más estados no pudieron consultarse.", "warning");
  };

  const handleTestAuthorizedScale = () => withAuthorizationBusy(async () => {
    if (!resolved?.posTerminalId || !resolved.scaleDeviceId) throw new Error("Selecciona una balanza persistida.");
    const result = await testScaleAuthorizationReading(resolved.posTerminalId, resolved.scaleDeviceId);
    setRealTestResult(result);
    await refreshScaleAuthorization(resolved.posTerminalId);
    showToast(result.available ? "Lectura REAL kg verificada." : `Lectura no disponible: ${result.reason}`, result.available ? "success" : "warning");
  });

  const handleRevokeScaleAuthorization = () => withAuthorizationBusy(async () => {
    if (authorization?.binding?.id) await revokeScaleBinding(authorization.binding.id);
    if (authorization?.agent.credentialId) await revokeAgentCredential(authorization.agent.credentialId);
    if (authorization?.posTerminalId) await refreshScaleAuthorization(authorization.posTerminalId);
    setRealTestResult(null);
    showToast("Autorización comercial y credencial activa revocadas.", "success");
  });

  const selectedTerminal = terminals.find((terminal) => terminal.id === selectedTerminalId);
  const selectedPrinterDevice = devices.find((device) => device.id === printerDeviceId);
  const printerCandidates = devices.filter((device) => device.type === "PRINTER");
  const scaleCandidates = devices.filter(
    (device) =>
      device.type === "SCALE" &&
      device.connectionType !== "MOCK" &&
      device.id !== DEFAULT_SCALE_DEVICE_ID
  );
  const selectedScaleDevice = devices.find((device) => device.id === scaleDeviceId);
  const canonicalScaleDevice = devices.find((device) => device.id === resolved?.scaleDeviceId);
  const backendUnitVerification = buildAgentUnitVerificationFromConfirmedBinding(authorization?.binding ?? null);
  const localUnitVerification = canonicalScaleDevice?.metadata?.unitVerification as
    { unit?: string; method?: string; verifiedAt?: string } | undefined;
  const agentUnitVerificationOutOfSync = Boolean(backendUnitVerification && (!localUnitVerification
    || localUnitVerification.unit !== backendUnitVerification.unit
    || localUnitVerification.method !== backendUnitVerification.method
    || localUnitVerification.verifiedAt !== backendUnitVerification.verifiedAt));
  const hasCurrentKgConfirmationEvidence = isCurrentKgConfirmationEvidence({ evidence: unitConfirmationReading,
    snapshot: authorization, localAgent: agentPairing, configuredScaleId: resolved?.scaleDeviceId ?? null,
    configuredDevice: canonicalScaleDevice ?? null, expectedPosTerminalId: resolved?.posTerminalId ?? null,
    expectedOperationalTerminalId: resolved?.operationalTerminalId ?? null, expectedBranchId: resolved?.branchId ?? null });
  const authorizationUi = deriveScaleAuthorizationUiState({ snapshot: authorization, localAgent: agentPairing,
    testResult: realTestResult, configuredScaleId: resolved?.scaleDeviceId ?? null, hasCurrentKgConfirmationEvidence });
  const scaleState = resolveScaleAssociationState({
    resolved,
    selectedDevice: canonicalScaleDevice,
    realScaleCandidateCount: scaleCandidates.length,
  });
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

  const saveScale = async (nextScaleDeviceId: string | null) => {
    const currentResolved = resolved;
    const targetTerminalId = currentResolved?.posTerminalId;
    if (!targetTerminalId || !currentResolved) {
      showToast("Periféricos no configurados para la terminal.", "warning");
      return;
    }
    if (
      nextScaleDeviceId &&
      !scaleCandidates.some((device) => device.id === nextScaleDeviceId)
    ) {
      showToast("Selecciona una balanza SCALE descubierta por el Agent.", "warning");
      return;
    }

    setLoading((prev) => ({ ...prev, save: true }));
    try {
      if (nextScaleDeviceId) {
        const selected = scaleCandidates.find((device) => device.id === nextScaleDeviceId);
        const agentConfiguration = selected ? buildScaleAgentConfiguration(selected) : null;
        if (!selected || !agentConfiguration) {
          throw new Error("La balanza seleccionada no es una ROCHI SERIAL descubierta válida.");
        }
        // Configure the Agent registry first. A persisted POS association alone
        // must never make a merely discovered device readable by ScaleService.
        const configured = await updateDevice(nextScaleDeviceId, agentConfiguration);
        setDevices((prev) => prev.map((device) => device.id === configured.id ? configured : device));
      }
      await savePosTerminalPeripheralSettings(
        targetTerminalId,
        buildScaleAssociationSettings(currentResolved, nextScaleDeviceId)
      );
      const persisted = await resolveCurrentPosTerminalConfig({
        tenantId: currentResolved.tenantId,
        terminalId: selectedTerminalId || undefined,
      });
      if (
        persisted.scaleDeviceId !== nextScaleDeviceId ||
        persisted.features.scale !== Boolean(nextScaleDeviceId)
      ) {
        throw new Error("La terminal no devolvió la asociación de balanza solicitada.");
      }
      setResolved(persisted);
      setScaleDeviceId(persisted.scaleDeviceId ?? "");
      setUnitConfirmationReading(null);
      setRealTestResult(null);
      if (authorization?.binding?.id && authorization.binding.logicalScaleId !== nextScaleDeviceId) {
        await revokeScaleBinding(authorization.binding.id);
        setRealTestResult(null);
      }
      await loadSnapshot(selectedTerminalId || undefined);
      if (persisted.posTerminalId) await refreshScaleAuthorization(persisted.posTerminalId);
      showToast(
        nextScaleDeviceId ? "Balanza asociada." : "Balanza desasociada.",
        "success"
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo guardar la balanza.", "error");
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
            <Link
              href={`/${tenantSlug}/config/terminals`}
              className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 transition hover:text-blue-800 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a terminales
            </Link>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Configuración operativa</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Periféricos por terminal</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Terminal canónica, periféricos asociados y dispositivos disponibles en Agent local.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/${tenantSlug}/config/terminals`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
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
            status: scaleState === "configured" ? "configured" : scaleState === "missing" ? "missing" : "not-configured",
            title:
              scaleState === "configured"
                ? "Balanza configurada y detectada"
                : scaleState === "missing"
                  ? "Balanza configurada pero no detectada"
                  : "Balanza pendiente",
            detail:
              scaleState === "configured"
                ? "La asociación persistida corresponde a una balanza descubierta por el Agent."
                : scaleState === "missing"
                  ? "La terminal conserva la asociación, pero el Agent no detecta la balanza ahora."
                  : "Selecciona explícitamente una balanza descubierta para asociarla a esta terminal.",
          }}
        >
          <div className="space-y-3">
            {infoBox("deviceId", isMockScaleConfiguration(resolved) ? "mock-scale-001 (fallback; sin asociación real)" : resolved?.scaleDeviceId ?? "-")}
            {selectedScaleDevice
              ? infoBox(
                  "dispositivo descubierto",
                  `${selectedScaleDevice.name} · ${selectedScaleDevice.connectionType} · ${selectedScaleDevice.profileId ?? "-"}`
                )
              : null}
            {selectedScaleDevice?.connectionType === "SERIAL" && selectedScaleDevice.serial
              ? infoBox(
                  "SERIAL",
                  [
                    selectedScaleDevice.serial.port,
                    selectedScaleDevice.serial.baudRate,
                    `${selectedScaleDevice.serial.dataBits}N${selectedScaleDevice.serial.stopBits}`,
                    selectedScaleDevice.serial.parity,
                    selectedScaleDevice.serial.flowControl,
                    selectedScaleDevice.serial.pnp?.deviceId,
                    selectedScaleDevice.serial.pnp?.vendorId &&
                      selectedScaleDevice.serial.pnp?.productId
                      ? `${selectedScaleDevice.serial.pnp.vendorId}/${selectedScaleDevice.serial.pnp.productId}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" / ") || "-"
                )
              : null}
            <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Balanza descubierta</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700"
                value={scaleDeviceId}
                onChange={(event) => setScaleDeviceId(event.target.value)}
              >
                <option value="">Sin configurar</option>
                {resolved?.scaleDeviceId &&
                !isMockScaleConfiguration(resolved) &&
                !scaleCandidates.some((device) => device.id === resolved.scaleDeviceId) ? (
                  <option value={resolved.scaleDeviceId}>
                    {resolved.scaleDeviceId} · configurada, no detectada
                  </option>
                ) : null}
                {scaleCandidates.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} · {device.id} · {device.connectionType} · {device.profileId ?? "-"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void saveScale(scaleDeviceId || null)}
                isLoading={loading.save}
                disabled={
                  !resolved?.posTerminalId ||
                  !scaleDeviceId ||
                  !scaleCandidates.some((device) => device.id === scaleDeviceId)
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                Asociar / Cambiar
              </Button>
              <Button
                variant="ghost"
                onClick={() => void saveScale(null)}
                isLoading={loading.save}
                disabled={!resolved?.posTerminalId || !resolved?.scaleDeviceId}
              >
                Desasociar
              </Button>
            </div>
            <div className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <h4 className="font-semibold text-slate-900 dark:text-white">Autorización comercial de balanza</h4>
              {infoBox("Agent", authorizationUi.agentAuthenticated ? "Autenticado" : "No emparejado / no autenticado")}
              {infoBox("Instalación", agentPairing?.installationId ?? authorization?.agent.installationId ?? "- ")}
              {infoBox("Asociación", authorization?.binding ? `${authorization.binding.status} · ${authorization.binding.logicalScaleId ?? "sin identidad"}` : "Sin asociación comercial")}
              {infoBox("Unidad confirmada", authorization?.binding?.unitState === "KG_VERIFIED" ? `kg · ${authorization.binding.verificationMethod ?? "operador"}` : "Pendiente de confirmación del operador")}
              {infoBox("REAL_AVAILABLE", authorizationUi.realAvailable ? "YES" : authorizationUi.reason)}
              {agentPairing?.pairing ? (
                <div className="rounded-lg border border-amber-300 bg-white p-3 text-sm dark:bg-slate-900">
                  <p className="font-semibold">Código de emparejamiento del Agent</p>
                  <p className="font-mono text-xl tracking-[0.2em]">{agentPairing.pairing.pairingCode}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Vence: {new Date(agentPairing.pairing.expiresAt).toLocaleTimeString()}</p>
                  <label className="mt-3 flex flex-col gap-1">
                    <span>Confirma el código mostrado por el Agent</span>
                    <input className="rounded-lg border px-3 py-2 font-mono" value={operatorPairingCode}
                      onChange={(event) => setOperatorPairingCode(event.target.value)} inputMode="numeric" maxLength={10} />
                  </label>
                  <Button className="mt-2" variant="outline" onClick={() => void handleApproveAgentPairing()} isLoading={authorizationBusy}
                    disabled={!resolved?.scaleDeviceId || !operatorPairingCode.trim()}>
                    Aprobar y emparejar Agent
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => void handleStartAgentPairing()} isLoading={authorizationBusy}
                  disabled={Boolean(agentPairing?.enrolled)}>
                  {agentPairing?.enrolled ? "Agent ya emparejado" : "Emparejar Agent de forma segura"}
                </Button>
              )}
              {unitConfirmationReading ? infoBox("Lectura observada para confirmar", `${unitConfirmationReading.weight} ${unitConfirmationReading.unit ?? "unidad sin verificar"} · ${unitConfirmationReading.source} · ${new Date(unitConfirmationReading.observedAt).toLocaleTimeString()} · estabilidad no inferida`) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void handleCreateScaleBinding()} isLoading={authorizationBusy}
                  disabled={!authorizationUi.canCreateBinding}>
                  Crear asociación comercial
                </Button>
                <Button variant="outline" onClick={() => void handleReadForKgConfirmation()} isLoading={authorizationBusy}
                  disabled={authorizationBusy || !resolved?.scaleDeviceId || !authorization?.binding || authorization.binding.status !== "PENDING"}>
                  Leer y mostrar unidad
                </Button>
                <Button variant="outline" onClick={() => void handleConfirmKg()} isLoading={authorizationBusy}
                  disabled={authorizationBusy || !authorizationUi.canConfirmKg}>
                  Confirmar KG y autorizar
                </Button>
                <Button variant="outline" onClick={() => void handleTestAuthorizedScale()} isLoading={authorizationBusy}
                  disabled={!authorizationUi.canTestReal}>
                  Probar lectura REAL
                </Button>
                <Button variant="ghost" onClick={() => void handleRevokeScaleAuthorization()} isLoading={authorizationBusy}
                  disabled={!authorization?.binding && !authorization?.agent.credentialId}>
                  Revocar autorización
                </Button>
                <Button variant="ghost" onClick={() => void handleRefreshAuthorization()} isLoading={authorizationRefresh === "loading"}
                  disabled={!resolved?.posTerminalId || authorizationRefresh === "loading" || authorizationBusy}>
                  Actualizar estado
                </Button>
                {agentUnitVerificationOutOfSync ? (
                    <Button variant="outline" onClick={() => void handleSyncConfirmedUnitVerification()} isLoading={authorizationBusy}
                      disabled={authorizationBusy}>
                      Sincronizar confirmación con Agent
                    </Button>
                  ) : null}
              </div>
              {authorizationRefresh === "success" ? <p role="status" className="text-xs text-emerald-700">Estado actualizado desde Agent y backend.</p> : null}
              {authorizationRefresh === "partial" ? <p role="status" className="text-xs text-amber-700">Actualización parcial; revise conexión con Agent y backend.</p> : null}
              {realTestResult ? (
                <p role="status" className={`text-sm ${realTestResult.available ? "text-emerald-700" : "text-amber-700"}`}>
                  {realTestResult.available
                    ? `REAL_AVAILABLE=YES · ${realTestResult.reading?.weight ?? "-"} ${realTestResult.reading?.unit ?? ""}`
                    : `REAL_AVAILABLE=NO · ${realTestResult.reason}`}
                </p>
              ) : null}
              <p className="text-xs text-slate-600 dark:text-slate-300">El secreto de Agent y las claves privadas nunca se entregan al navegador. La asociación física de periféricos por sí sola no autoriza ventas por peso.</p>
            </div>
          </div>
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
