"use client";

import Link from "next/link";
import { Loader2, Lock, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "../../../store/hooks";
import { getCurrentCashSession } from "../../../modules/finance/services/finance.service";
import type { CashSession } from "../../../modules/finance/types";
import { PosScreen } from "../../../modules/pos/components/PosScreen";
import { useRequirePosSession } from "../../../domains/pos/hooks/useRequirePosSession";
import { useTerminalReadiness } from "../../../domains/terminal-readiness/useTerminalReadiness";
import type { ReadinessReason } from "../../../domains/terminal-readiness/contracts";
import { TerminalReadinessDiagnostics } from "../../../domains/terminal-readiness/TerminalReadinessDiagnostics";
import {
  hasElectronTerminalBridge,
  isLocalQaLocation,
  isTerminalDiagnosticsShortcut,
} from "../../../domains/terminal-readiness/diagnostics-access";

const PosBlockedState = ({
  tenantSlug,
  title,
  description,
  loading = false,
}: {
  tenantSlug: string;
  title: string;
  description: string;
  loading?: boolean;
}) => (
  <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-white p-8 shadow-sm dark:bg-slate-800">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-700">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Lock className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          POS requiere caja
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/${tenantSlug}/pos/select-context`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Wallet className="h-4 w-4" />
            Seleccionar contexto y abrir caja
          </Link>
          <Link
            href={`/${tenantSlug}/dashboard`}
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          >
            Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const readinessMessage: Partial<Record<ReadinessReason, string>> = {
  DEVICE_UNKNOWN: "Este dispositivo no está registrado para este tenant.",
  DEVICE_UNBOUND: "Este dispositivo no tiene una terminal asignada.",
  DEVICE_REVOKED: "Este dispositivo fue revocado.",
  TERMINAL_UNKNOWN: "La terminal vinculada ya no está disponible.",
  TERMINAL_DISABLED: "La terminal vinculada está deshabilitada.",
  TERMINAL_CONTEXT_MISMATCH: "Esta instalación está vinculada a otra terminal.",
  CLOUD_UNAVAILABLE: "No fue posible validar la terminal con Manus Cloud.",
  BRIDGE_CONTRACT_UNSUPPORTED: "El runtime local no es compatible con esta versión de Manus.",
  AGENT_API_UNSUPPORTED: "El runtime local no es compatible con esta versión de Manus.",
  AGENT_API_UNKNOWN: "No se pudo confirmar la versión del Agent local.",
  AGENT_UNAVAILABLE: "El servicio local de periféricos no está disponible.",
  INSTALLATION_ID_UNAVAILABLE: "No se pudo obtener la identidad local del dispositivo.",
  BRIDGE_LEGACY: "El bridge local requiere una actualización.",
  METADATA_INVALID: "La metadata del runtime local no es válida.",
};

const PosPage = () => {
  const { hasSession } = useRequirePosSession({ redirect: false });
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const tenantSlug = useAppSelector((state) => state.auth.user?.tenantSlug ?? state.auth.user?.tenantId ?? "default");
  const posBranchId = useAppSelector((state) => state.pos.branchId);
  const posTerminalId = useAppSelector((state) => state.pos.terminalId);
  const posCashRegisterId = useAppSelector((state) => state.pos.cashRegisterId);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [loadingCashSession, setLoadingCashSession] = useState(true);
  const [cashSessionError, setCashSessionError] = useState<string | null>(null);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(() =>
    typeof window !== "undefined" &&
    isLocalQaLocation(window.location) &&
    new URLSearchParams(window.location.search).get("terminalReadinessDiagnostics") === "1"
  );
  const readinessInput = useMemo(
    () => hasSession && authStatus === "authenticated" && bootstrapped
      ? { authenticated: true, posTerminalId }
      : null,
    [authStatus, bootstrapped, hasSession, posTerminalId]
  );
  const readiness = useTerminalReadiness(readinessInput);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isLocalQaLocation(window.location) ||
      !hasElectronTerminalBridge(window.manusTerminal)
    ) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTerminalDiagnosticsShortcut(event)) {
        return;
      }
      event.preventDefault();
      setDiagnosticsVisible((visible) => !visible);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!bootstrapped || authStatus !== "authenticated" || !hasSession) {
      setLoadingCashSession(false);
      setCashSession(null);
      return;
    }

    let active = true;
    setLoadingCashSession(true);
    setCashSessionError(null);

    void getCurrentCashSession(posCashRegisterId ?? undefined)
      .then((session) => {
        if (!active) {
          return;
        }
        setCashSession(session);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCashSession(null);
        setCashSessionError("No se pudo validar la caja abierta.");
      })
      .finally(() => {
        if (active) {
          setLoadingCashSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authStatus, bootstrapped, hasSession, posCashRegisterId]);

  if (!bootstrapped || authStatus === "refreshing") {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="Validando sesion"
        description="Estamos confirmando tu sesion antes de habilitar el POS."
        loading
      />
    );
  }

  if (!hasSession) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="Selecciona contexto operativo"
        description="Antes de vender debes seleccionar sucursal, terminal y abrir una caja autorizada."
      />
    );
  }

  if (loadingCashSession) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="Validando caja abierta"
        description="Estamos revisando si tienes una caja abierta para operar el POS."
        loading
      />
    );
  }

  if (cashSessionError) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="No se pudo validar la caja"
        description={cashSessionError}
      />
    );
  }

  if (!cashSession) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="No tienes caja abierta"
        description="El POS esta bloqueado para ventas hasta abrir una caja en tu contexto autorizado."
      />
    );
  }

  if (posBranchId && cashSession.branchId !== posBranchId) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="La caja abierta no coincide con la sucursal POS"
        description="Cambia el contexto operativo o cierra la caja actual antes de iniciar ventas."
      />
    );
  }

  if (readiness.error) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="No se pudo validar el terminal"
        description="Reintenta la validación del runtime local antes de entrar al POS."
      />
    );
  }

  if (!readiness.value) {
    return (
      <PosBlockedState
        tenantSlug={tenantSlug}
        title="Verificando terminal Manus"
        description="Estamos validando el runtime y la terminal vinculada antes de entrar al POS."
        loading
      />
    );
  }

  const diagnostics = (
    <TerminalReadinessDiagnostics
      value={readiness.value}
      enabled={diagnosticsVisible}
    />
  );

  if (!readiness.value.canEnterPos) {
    return (
      <>
        {diagnostics}
        <section className="mx-auto max-w-3xl rounded-[28px] border border-amber-200 bg-white p-8 shadow-sm dark:bg-slate-800">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-700">
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Terminal Manus</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">No se puede entrar al POS</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {readinessMessage[readiness.value.reason] ?? "La configuración del terminal requiere atención."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => void readiness.retry()} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">Reintentar</button>
              <Link href={`/${tenantSlug}/dashboard`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white">Volver al dashboard</Link>
            </div>
          </div>
        </div>
        </section>
      </>
    );
  }

  return (
    <>
      {diagnostics}
      {readiness.value.state === "DEGRADED" ? (
        <div className="mx-auto mb-4 max-w-7xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          El servicio local de periféricos no está disponible. Puedes continuar con las operaciones cloud autorizadas.
        </div>
      ) : null}
      <PosScreen />
    </>
  );
};

export default PosPage;
