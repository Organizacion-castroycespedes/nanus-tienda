"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "../../components/design-system/Button";
import { ApiError } from "../../lib/request";
import { hasMenuAccess } from "../../lib/permissions";
import { useAppSelector } from "../../store/hooks";
import { MENU_KEYS } from "../menu/constants";
import { getControlCenterReadiness } from "./api";
import {
  READINESS_ISSUE_LABELS,
  canSeeControlCenter,
  classifyControlCenterError,
  type ControlCenterLoadError,
} from "./access";
import type { ControlCenterReadiness as Readiness } from "./types";

const errorMessages: Record<ControlCenterLoadError, string> = {
  UNAUTHORIZED: "No tienes acceso al Control Center.",
  DISABLED:
    "El Control Center está deshabilitado en este ambiente. Revisa CONTROL_CENTER_ENABLED y las credenciales del usuario dedicado.",
  UNAVAILABLE: "No fue posible consultar el estado del Control Center.",
};

const CheckRow = ({ label, ok }: { label: string; ok: boolean }) => (
  <li className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
    <span className="text-sm text-slate-700">{label}</span>
    {ok ? (
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Correcto" />
    ) : (
      <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-label="Con problema" />
    )}
  </li>
);

export const ControlCenterReadiness = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const tenantId = useAppSelector((state) => state.auth.user?.tenantId ?? state.auth.tenantId);
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const visible = canSeeControlCenter({
    role,
    tenantId,
    hasReadAccess: hasMenuAccess(MENU_KEYS.CONTROL_CENTER, "READ"),
  });

  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState<ControlCenterLoadError | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getControlCenterReadiness(signal);
      if (!signal?.aborted) setReadiness(result);
    } catch (caught) {
      if (signal?.aborted) return;
      setReadiness(null);
      setError(
        caught instanceof ApiError
          ? classifyControlCenterError(caught.status, caught.code)
          : "UNAVAILABLE",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissionsLoaded || !visible) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, permissionsLoaded, visible]);

  if (!permissionsLoaded) {
    return <p className="p-6 text-sm text-slate-500">Cargando permisos…</p>;
  }

  if (!visible || error === "UNAUTHORIZED") {
    return (
      <section className="mx-auto max-w-xl p-6 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Acceso restringido</h1>
        <p className="mt-1 text-sm text-slate-600">{errorMessages.UNAUTHORIZED}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-blue-600" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">MANUS Control Center</h1>
            <p className="text-sm text-slate-600">Estado de la plataforma de administración comercial</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} isLoading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Actualizar
        </Button>
      </header>

      {error ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {errorMessages[error]}
        </div>
      ) : null}

      {readiness ? (
        <>
          <div
            className={`rounded-lg border p-4 ${
              readiness.status === "READY"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <p className="text-sm font-semibold">
              {readiness.status === "READY" ? "Listo para operar" : "Requiere atención"}
            </p>
            <p className="mt-1 text-xs opacity-80">
              Verificado {new Date(readiness.checkedAt).toLocaleString("es-CO")} · usuario BD{" "}
              <span className="font-mono">{readiness.database.user}</span>
            </p>
            {readiness.issues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {readiness.issues.map((issue) => (
                  <li key={issue}>{READINESS_ISSUE_LABELS[issue] ?? issue}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <ul className="rounded-lg border border-slate-200 bg-white px-4">
            <CheckRow label="Esquema control_center" ok={readiness.database.schemaPresent} />
            <CheckRow label="Tabla de auditoría administrativa" ok={readiness.database.auditTablePresent} />
            <CheckRow label="Registro de auditoría permitido" ok={readiness.database.canInsertAudit} />
            <CheckRow label="Auditoría inmutable" ok={readiness.database.auditImmutable} />
            <CheckRow label="Tenant plataforma activo" ok={readiness.database.platformTenantPresent} />
            <CheckRow
              label="Usuario operativo sin acceso al esquema"
              ok={!readiness.isolation.operationalRoleHasSchemaAccess}
            />
            <CheckRow
              label="Impuestos configurados en el tenant plataforma (requerido en fase 1)"
              ok={readiness.database.platformTaxConfigured}
            />
          </ul>
        </>
      ) : null}
    </section>
  );
};
