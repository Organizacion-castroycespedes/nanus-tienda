"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "../../components/design-system/Button";
import { ReportSummary } from "../../components/design-system/ReportSummary";
import { Toast } from "../../components/design-system/Toast";
import { ApiError } from "../../lib/request";
import { getControlCenterReadiness } from "./api";
import { READINESS_ISSUE_LABELS, classifyControlCenterError, type ControlCenterLoadError } from "./access";
import { AccessRestricted, ControlCenterShell, useControlCenterAccess } from "./components/ControlCenterShell";
import type { ControlCenterReadiness as Readiness } from "./types";

const errorMessages: Record<ControlCenterLoadError, string> = {
  UNAUTHORIZED: "No tienes acceso al Control Center.",
  DISABLED:
    "El Control Center está deshabilitado en este ambiente. Revisa CONTROL_CENTER_ENABLED y las credenciales del usuario dedicado.",
  UNAVAILABLE: "No fue posible consultar el estado del Control Center.",
};

const CheckRow = ({ label, ok }: { label: string; ok: boolean }) => (
  <li className="flex items-center justify-between gap-3 px-5 py-3">
    <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
    {ok ? (
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Correcto" />
    ) : (
      <XCircle className="h-5 w-5 shrink-0 text-rose-500" aria-label="Con problema" />
    )}
  </li>
);

export const ControlCenterReadiness = () => {
  const { permissionsLoaded, visible } = useControlCenterAccess();

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

  if (error === "UNAUTHORIZED") return <AccessRestricted />;

  const ready = readiness?.status === "READY";

  return (
    <ControlCenterShell
      section="overview"
      description="Estado de la plataforma de administración comercial"
      toolbar={
        <Button variant="outline" size="sm" onClick={() => void load()} isLoading={loading}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Actualizar
        </Button>
      }
      summary={
        readiness ? (
          <ReportSummary
            items={[
              { label: "Estado", value: ready ? "Listo" : "Requiere atención" },
              { label: "Problemas", value: readiness.issues.length },
              { label: "Usuario BD", value: <span className="font-mono text-base">{readiness.database.user}</span> },
              { label: "Verificado", value: new Date(readiness.checkedAt).toLocaleTimeString("es-CO") },
            ]}
          />
        ) : null
      }
    >
      <div className="space-y-4">
        {error ? <Toast variant="warning" message={errorMessages[error]} /> : null}

        {readiness ? (
          <>
            <Toast
              variant={ready ? "success" : "error"}
              message={
                ready ? (
                  "La plataforma está lista para operar."
                ) : (
                  <ul className="list-disc space-y-1 pl-4">
                    {readiness.issues.map((issue) => (
                      <li key={issue}>{READINESS_ISSUE_LABELS[issue] ?? issue}</li>
                    ))}
                  </ul>
                )
              }
            />
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
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
      </div>
    </ControlCenterShell>
  );
};
