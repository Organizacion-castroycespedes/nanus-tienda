"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudOff, Loader2, RefreshCw, X } from "lucide-react";
import { requestRaw } from "../../lib/request";

type ConnectivityState = "ONLINE" | "OFFLINE" | "RECONNECTING" | "RESTORED" | "SERVICE_UNAVAILABLE";

const RETRY_INTERVAL_MS = 5_000;
const HEALTH_TIMEOUT_MS = 4_000;
const LAST_CONNECTION_KEY = "manus:last-connection-at";

const stateLabel: Record<ConnectivityState, string> = {
  ONLINE: "En línea",
  OFFLINE: "Sin conexión a Internet",
  SERVICE_UNAVAILABLE: "Servicio temporalmente no disponible",
  RECONNECTING: "Restableciendo conexión...",
  RESTORED: "Conexión restablecida",
};

const stateTone: Record<ConnectivityState, string> = {
  ONLINE: "bg-emerald-500",
  OFFLINE: "bg-rose-500",
  SERVICE_UNAVAILABLE: "bg-rose-500",
  RECONNECTING: "bg-amber-400",
  RESTORED: "bg-emerald-500",
};

const formatLastConnection = (value: number | null) => {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(value);
};

export function OfflineIndicator() {
  const [state, setState] = useState<ConnectivityState>("RECONNECTING");
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastConnection, setLastConnection] = useState<number | null>(null);
  const [nextAttemptIn, setNextAttemptIn] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const lastStateRef = useRef<ConnectivityState>("RECONNECTING");
  const hasCheckedRef = useRef(false);
  const nextAttemptAtRef = useRef(0);

  const checkConnectivity = useCallback(async (manual = false) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setBackendOnline(false);
      setState("OFFLINE");
      setHasChecked(true);
      setDismissed(false);
      nextAttemptAtRef.current = Date.now() + RETRY_INTERVAL_MS;
      return false;
    }

    setState((current) => current === "ONLINE" && !manual ? current : "RECONNECTING");
    setNextAttemptIn(0);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await requestRaw("/system/version", { signal: controller.signal });
      if (!response.ok) throw new Error("BACKEND_UNAVAILABLE");
      const wasUnavailable = hasCheckedRef.current && (lastStateRef.current === "OFFLINE" || lastStateRef.current === "RECONNECTING" || lastStateRef.current === "SERVICE_UNAVAILABLE");
      const timestamp = Date.now();
      setBackendOnline(true);
      setLastConnection(timestamp);
      setNextAttemptIn(0);
      window.localStorage.setItem(LAST_CONNECTION_KEY, String(timestamp));
      setDismissed(false);
      setState(wasUnavailable ? "RESTORED" : "ONLINE");
      setHasChecked(true);
      hasCheckedRef.current = true;
      nextAttemptAtRef.current = 0;
      if (wasUnavailable) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("manus:backend-restored"));
        }
        window.setTimeout(() => setState("ONLINE"), 2500);
      }
      return true;
    } catch {
      setBackendOnline(false);
      if (typeof navigator !== "undefined" && navigator.onLine) {
        setState("SERVICE_UNAVAILABLE");
      } else {
        setState("OFFLINE");
      }
      setHasChecked(true);
      hasCheckedRef.current = true;
      setDismissed(false);
      nextAttemptAtRef.current = Date.now() + RETRY_INTERVAL_MS;
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(LAST_CONNECTION_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed)) setLastConnection(parsed);

    const handleOffline = () => {
      setBackendOnline(false);
      setState("OFFLINE");
      setDismissed(false);
      nextAttemptAtRef.current = Date.now() + RETRY_INTERVAL_MS;
    };
    const handleOnline = () => void checkConnectivity(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void checkConnectivity();
    const poll = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((nextAttemptAtRef.current - Date.now()) / 1000));
      setNextAttemptIn(seconds);
      if (nextAttemptAtRef.current > 0 && seconds === 0) void checkConnectivity();
    }, 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(poll);
    };
  }, [checkConnectivity]);

  useEffect(() => {
    lastStateRef.current = state;
  }, [state]);

  const showOverlay = hasChecked && !dismissed && (state === "OFFLINE" || state === "RECONNECTING" || state === "RESTORED" || state === "SERVICE_UNAVAILABLE");

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200">
        <span className={`h-2.5 w-2.5 rounded-full ${stateTone[state]}`} aria-hidden="true" />
        <span>{stateLabel[state]}</span>
        {(state === "ONLINE" || state === "RESTORED") && (
          <>
            <span className="text-slate-400">·</span>
            <span className="text-emerald-600">Servicio disponible</span>
          </>
        )}
      </div>

      {showOverlay ? (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/35 p-6 backdrop-blur-[2px]">
          <section className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-8 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900" role="status" aria-live="polite">
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${state === "RESTORED" ? "bg-emerald-100 text-emerald-600" : state === "RECONNECTING" ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
              {state === "RESTORED" ? <CheckCircle2 className="h-8 w-8" /> : state === "RECONNECTING" ? <Loader2 className="h-8 w-8 animate-spin" /> : <CloudOff className="h-8 w-8" />}
            </div>
            <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
              {state === "RESTORED" ? "Conexión restablecida" : state === "RECONNECTING" ? "Reconectando Manus POS" : state === "SERVICE_UNAVAILABLE" ? "Servicio temporalmente no disponible" : "Sin conexión a Internet"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {state === "RESTORED" ? "Sincronizando información..." : state === "SERVICE_UNAVAILABLE" ? "Estamos intentando restablecer la conexión." : "Revisa tu conexión. Reintentaremos automáticamente."}
            </p>
            <div className="mt-6 space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-sm dark:bg-slate-800">
              <div className="flex justify-between"><span>Internet</span><strong>{typeof navigator !== "undefined" && navigator.onLine ? "Disponible" : "No disponible"}</strong></div>
              <div className="flex justify-between"><span>Servicio</span><strong>{backendOnline ? "Disponible" : "No disponible"}</strong></div>
              <div className="flex justify-between"><span>Última conexión</span><strong>{formatLastConnection(lastConnection)}</strong></div>
            </div>
            {state !== "RESTORED" ? <button type="button" onClick={() => void checkConnectivity(true)} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white transition hover:bg-blue-700"><RefreshCw className="h-4 w-4" />Reintentar ahora</button> : null}
            {nextAttemptIn > 0 && state !== "RESTORED" ? <p className="mt-3 text-xs text-slate-500">Próximo intento en {nextAttemptIn}s</p> : null}
            {state === "OFFLINE" || state === "SERVICE_UNAVAILABLE" ? <button type="button" onClick={() => setDismissed(true)} className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"><X className="h-3 w-3" />Continuar viendo la pantalla</button> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
