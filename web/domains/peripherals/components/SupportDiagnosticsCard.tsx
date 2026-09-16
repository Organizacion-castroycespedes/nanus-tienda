"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { requestRaw } from "../../../lib/request";
import { fetchPeripheralHealth } from "../api";
import type { PeripheralAgentHealth } from "../types";

type DiagnosticState = "VERIFIED" | "NOT_AVAILABLE" | "NOT_VERIFIED";

type DiagnosticResult = {
  state: DiagnosticState;
  detail: string;
};

const API_TIMEOUT_MS = 4_000;
const AGENT_TIMEOUT_MS = 4_000;

const initialResults: Record<"web" | "api" | "agent", DiagnosticResult> = {
  web: {
    state: "NOT_VERIFIED",
    detail: "Aún no se ha cargado este diagnóstico.",
  },
  api: {
    state: "NOT_VERIFIED",
    detail: "Ejecuta una comprobación para validar el servicio.",
  },
  agent: {
    state: "NOT_VERIFIED",
    detail: "Ejecuta una comprobación para validar el servicio local.",
  },
};

const stateLabel: Record<DiagnosticState, string> = {
  VERIFIED: "VERIFICADO",
  NOT_AVAILABLE: "NO DISPONIBLE",
  NOT_VERIFIED: "NO VERIFICADO",
};

const stateTone: Record<DiagnosticState, string> = {
  VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  NOT_AVAILABLE: "border-rose-200 bg-rose-50 text-rose-800",
  NOT_VERIFIED: "border-slate-200 bg-slate-50 text-slate-700",
};

const apiProbe = async (): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await requestRaw("/system/version", { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
};

const agentProbe = async (): Promise<PeripheralAgentHealth | null> => {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      fetchPeripheralHealth(),
      new Promise<null>((resolve) => {
        timeout = window.setTimeout(() => resolve(null), AGENT_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
};

const DiagnosticItem = ({ label, result }: { label: string; result: DiagnosticResult }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide ${stateTone[result.state]}`}>
        {stateLabel[result.state]}
      </span>
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{result.detail}</p>
  </div>
);

const SupportDiagnosticsCard = () => {
  const [results, setResults] = useState(initialResults);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  const checkDiagnostics = useCallback(async () => {
    setChecking(true);
    setResults((current) => ({
      ...current,
      web: {
        state: "VERIFIED",
        detail: "La interfaz web está cargada. Esto no prueba API ni Agent.",
      },
      api: { state: "NOT_VERIFIED", detail: "Comprobación en curso." },
      agent: { state: "NOT_VERIFIED", detail: "Comprobación en curso." },
    }));

    const [apiAvailable, agentHealth] = await Promise.all([apiProbe(), agentProbe()]);
    const timestamp = Date.now();
    setResults((current) => ({
      ...current,
      api: apiAvailable
        ? { state: "VERIFIED", detail: "El health estable de API respondió correctamente." }
        : { state: "NOT_AVAILABLE", detail: "No se obtuvo una respuesta válida de API." },
      agent: agentHealth?.status === "ok"
        ? { state: "VERIFIED", detail: "El Agent local respondió correctamente." }
        : { state: "NOT_AVAILABLE", detail: "No se obtuvo una respuesta válida del Agent local." },
    }));
    setCheckedAt(timestamp);
    setChecking(false);
  }, []);

  useEffect(() => {
    void checkDiagnostics();
  }, [checkDiagnostics]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-labelledby="support-diagnostics-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Soporte</p>
          <h2 id="support-diagnostics-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
            Diagnóstico de conexión
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Separa la pantalla web, API y Agent local. No muestra tokens, URLs, trazas ni datos de negocio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkDiagnostics()}
          disabled={checking}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Comprobando" : "Comprobar de nuevo"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <DiagnosticItem label="Web" result={results.web} />
        <DiagnosticItem label="API" result={results.api} />
        <DiagnosticItem label="Agent local" result={results.agent} />
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        {checkedAt ? `Última comprobación: ${new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(checkedAt)}.` : "Sin comprobación registrada."}
      </p>
    </section>
  );
};

export default SupportDiagnosticsCard;
