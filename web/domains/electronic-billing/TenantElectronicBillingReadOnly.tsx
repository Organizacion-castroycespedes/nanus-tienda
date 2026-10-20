"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/design-system/Button";
import { ConfirmDialog } from "../../components/design-system/confirm-dialog";
import { Input } from "../../components/design-system/Input";
import { Select } from "../../components/design-system/Select";
import { ApiError } from "../../lib/request";
import {
  getElectronicBillingRuntimeCryptoReadiness,
  getElectronicBillingTenantConfiguration,
  getElectronicBillingFactuCoreContext,
  createElectronicBillingTenantConfiguration,
  listElectronicBillingProviders,
  updateElectronicBillingTenantConfiguration,
  activateElectronicBillingTenantConfiguration,
} from "./api";
import { toSafeElectronicBillingConfiguration } from "./read-model";
import type {
  ElectronicBillingProvider,
  SafeElectronicBillingConfiguration,
  ElectronicBillingFactuCoreContextResponse,
  ElectronicBillingRuntimeCryptoReadiness,
} from "./types";
import {
  draftFromConfiguration,
  ELECTRONIC_BILLING_ENVIRONMENTS,
  emptyTenantElectronicBillingDraft,
  validateTenantElectronicBillingDraft,
  type TenantElectronicBillingDraft,
} from "./tenant-config-editor-model";

type LoadState = "loading" | "ready" | "empty" | "denied" | "error";

const statusLabels = {
  COMPLETE: "Completa",
  INCOMPLETE: "Incompleta",
  INCONSISTENT: "Inconsistente",
} as const;

const boolLabel = (value: boolean) => (value ? "Sí" : "No");

const statusClassName = (status: SafeElectronicBillingConfiguration["configurationStatus"]) => {
  if (status === "COMPLETE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "INCONSISTENT") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
};

export const TenantElectronicBillingReadOnly = ({
  tenantId,
  tenantName,
  visible,
}: {
  tenantId: string;
  tenantName?: string | null;
  visible: boolean;
}) => {
  const [state, setState] = useState<LoadState>("loading");
  const [providers, setProviders] = useState<ElectronicBillingProvider[]>([]);
  const [configurations, setConfigurations] = useState<
    SafeElectronicBillingConfiguration[]
  >([]);
  const [identityState, setIdentityState] = useState<"idle" | "loading" | "ready" | "denied" | "error">("idle");
  const [identity, setIdentity] = useState<ElectronicBillingFactuCoreContextResponse | null>(null);
  const [draft, setDraft] = useState<TenantElectronicBillingDraft>(emptyTenantElectronicBillingDraft);
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [runtimeReadiness, setRuntimeReadiness] = useState<ElectronicBillingRuntimeCryptoReadiness | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activationTarget, setActivationTarget] = useState<SafeElectronicBillingConfiguration | null>(null);
  const identityController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible || !tenantId) {
      setState("empty");
      setProviders([]);
      setConfigurations([]);
      return;
    }

    const controller = new AbortController();
    let current = true;
    setState("loading");
    setProviders([]);
    setConfigurations([]);
    setIdentity(null);
    setIdentityState("idle");
    setDraft(emptyTenantElectronicBillingDraft());
    setDraftErrors([]);
    setRuntimeReadiness(null);
    setSaveError(null);
    setSaving(false);
    setEditorOpen(false);
    identityController.current?.abort();

    Promise.all([
      listElectronicBillingProviders(controller.signal),
      getElectronicBillingTenantConfiguration(tenantId, controller.signal),
    ])
      .then(([providerCatalog, configurationResponse]) => {
        if (!current) {
          return;
        }
        setProviders(providerCatalog.providers);
        setConfigurations(
          configurationResponse.tenantId === tenantId
            ? configurationResponse.configurations.map(
                toSafeElectronicBillingConfiguration,
              )
            : [],
        );
        const safeConfigurations = configurationResponse.tenantId === tenantId
          ? configurationResponse.configurations.map(toSafeElectronicBillingConfiguration)
          : [];
        setDraft(draftFromConfiguration(safeConfigurations[0]));
        setState(
          configurationResponse.tenantId !== tenantId ||
            configurationResponse.configurations.length === 0
            ? "empty"
            : "ready",
        );
      })
      .catch((error: unknown) => {
        if (!current || controller.signal.aborted) {
          return;
        }
        setState(error instanceof ApiError && error.status === 403 ? "denied" : "error");
      });

    getElectronicBillingRuntimeCryptoReadiness(controller.signal)
      .then((readiness) => {
        if (current && !controller.signal.aborted) setRuntimeReadiness(readiness);
      })
      .catch(() => {
        if (current && !controller.signal.aborted) setRuntimeReadiness(null);
      });

    return () => {
      current = false;
      controller.abort();
      identityController.current?.abort();
    };
  }, [tenantId, visible]);

  const updateDraft = <K extends keyof TenantElectronicBillingDraft>(
    key: K,
    value: TenantElectronicBillingDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDraftErrors([]);
  };

  const validateDraftLocally = () => {
    const errors = validateTenantElectronicBillingDraft(draft);
    setDraftErrors(errors);
    return errors;
  };

  const saveConfiguration = async () => {
    const configuration = configurations[0];
    const errors = validateTenantElectronicBillingDraft(draft, {
      requireCredentials: !configuration,
    });
    setDraftErrors(errors);
    if (errors.length > 0 || !runtimeReadiness?.writeReady) return;

    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        baseUrl: draft.baseUrl.trim() || null,
        settings: { factuCoreTenantId: draft.factuCoreTenantId.trim() || null },
        clientKey: draft.clientKey.trim(),
        clientSecret: draft.clientSecret,
      };
      if (configuration) {
        await updateElectronicBillingTenantConfiguration(tenantId, configuration.id, {
          baseUrl: payload.baseUrl ?? undefined,
          settings: payload.settings,
          ...(payload.clientKey && payload.clientSecret
            ? { clientKey: payload.clientKey, clientSecret: payload.clientSecret }
            : {}),
        });
      } else {
        await createElectronicBillingTenantConfiguration(tenantId, {
          providerId: draft.providerId,
          environment: draft.environment,
          baseUrl: payload.baseUrl,
          settings: payload.settings,
          clientKey: payload.clientKey,
          clientSecret: payload.clientSecret,
        });
      }
      setDraft((current) => ({ ...current, clientKey: "", clientSecret: "" }));
      setDraftErrors([]);
      if (!configuration) {
        const refreshed = await getElectronicBillingTenantConfiguration(tenantId);
        const safeConfigurations = refreshed.tenantId === tenantId
          ? refreshed.configurations.map(toSafeElectronicBillingConfiguration)
          : [];
        setConfigurations(safeConfigurations);
        setDraft(draftFromConfiguration(safeConfigurations[0]));
        setState(safeConfigurations.length > 0 ? "ready" : "empty");
        setEditorOpen(false);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setSaveError(error.status === 503
          ? "Guardado no disponible: el backend no tiene listo el keyring o la escritura segura."
          : error.status === 403
            ? "No tienes permiso para guardar esta configuración."
            : error.status === 409
              ? "La configuración cambió o entró en conflicto. Recarga antes de guardar."
              : "No fue posible guardar la configuración.");
      } else {
        setSaveError("No fue posible guardar la configuración.");
      }
    } finally {
      setSaving(false);
    }
  };

  const validateFactuCoreIdentity = () => {
    identityController.current?.abort();
    const controller = new AbortController();
    identityController.current = controller;
    const requestedTenantId = tenantId;
    setIdentityState("loading");
    setIdentity(null);
    getElectronicBillingFactuCoreContext(requestedTenantId, controller.signal)
      .then((response) => {
        if (requestedTenantId !== tenantId || controller.signal.aborted) return;
        setIdentity(response);
        setIdentityState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestedTenantId !== tenantId) return;
        setIdentityState(error instanceof ApiError && error.status === 403 ? "denied" : "error");
      });
  };

  const activateConfiguration = async () => {
    const configuration = activationTarget;
    if (!configuration) return;
    if (!configuration.credentialStatus.encryptedConfigured || configuration.configurationStatus !== "COMPLETE") return;
    setActivating(true);
    setSaveError(null);
    try {
      await activateElectronicBillingTenantConfiguration(tenantId, configuration.id);
      const refreshed = await getElectronicBillingTenantConfiguration(tenantId);
      const safe = refreshed.tenantId === tenantId ? refreshed.configurations.map(toSafeElectronicBillingConfiguration) : [];
      setConfigurations(safe);
      setActivationTarget(null);
    } catch (error: unknown) {
      setSaveError(error instanceof ApiError && error.status === 409
        ? "La identidad debe estar validada y la configuración no puede cambiar en paralelo."
        : "No fue posible activar la configuración.");
    } finally {
      setActivating(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <section
      aria-labelledby="electronic-billing-title"
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <div>
        <h3 id="electronic-billing-title" className="text-lg font-semibold text-slate-900 dark:text-white">
          Facturación electrónica
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Consulta y configuración segura para este tenant. Los secretos son de escritura única y nunca se muestran después de guardar.
        </p>
      </div>

      {state === "loading" ? (
        <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
          Cargando configuración de facturación electrónica...
        </p>
      ) : state === "denied" ? (
        <p role="alert" className="text-sm text-rose-700">
          No tienes autorización para consultar esta configuración.
        </p>
      ) : state === "error" ? (
        <p role="alert" className="text-sm text-rose-700">
          No fue posible cargar la configuración de facturación electrónica.
        </p>
      ) : state === "empty" && !editorOpen ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-600 dark:bg-slate-900/40">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No hay configuración de facturación electrónica registrada para este tenant.
        </p>
        <Button className="mt-4" onClick={() => setEditorOpen(true)}>
          Configurar facturación electrónica
        </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="font-medium text-slate-900 dark:text-white">Catálogo de proveedores</h4>
            {providers.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No hay proveedores disponibles.</p>
            ) : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Proveedores de facturación">
                {providers.map((provider) => (
                  <li key={provider.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                    <span className="font-medium text-slate-900 dark:text-white">{provider.name}</span>
                    <span className="ml-2 text-slate-500 dark:text-slate-400">{provider.code}</span>
                    <span className="ml-2 text-xs text-slate-500">{provider.active ? "Activo" : "Inactivo"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            {configurations.map((configuration) => (
              <article key={configuration.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{configuration.providerName}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{configuration.providerCode} · Ambiente {configuration.environment}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(configuration.configurationStatus)}`}>
                    {statusLabels[configuration.configurationStatus]}
                  </span>
                </div>
                {configuration.configurationStatus === "INCONSISTENT" ? (
                  <p className="mt-3 text-sm text-rose-700">La configuración requiere revisión administrativa antes de cualquier activación.</p>
                ) : null}
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-slate-500">Habilitado</dt><dd className="font-medium">{boolLabel(configuration.enabled)}</dd></div>
                  <div><dt className="text-slate-500">Predeterminado</dt><dd className="font-medium">{boolLabel(configuration.isDefault)}</dd></div>
                  <div><dt className="text-slate-500">Base URL configurada</dt><dd className="font-medium">{boolLabel(configuration.baseUrlConfigured)}</dd></div>
                  <div><dt className="text-slate-500">Credencial cifrada</dt><dd className="font-medium">{boolLabel(configuration.credentialStatus.encryptedConfigured)}</dd></div>
                  <div><dt className="text-slate-500">Referencia heredada</dt><dd className="font-medium">{boolLabel(configuration.credentialStatus.legacyReferenceConfigured)}</dd></div>
                  <div><dt className="text-slate-500">Tenant FactuCore</dt><dd className="font-medium">{configuration.settings.factuCoreTenantId || "No definido"}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <p className="text-xs text-slate-600 dark:text-slate-300">La activación exige identidad MATCH, credencial V2 y limpia la referencia heredada.</p>
                  <Button
                    disabled={
                      activating
                      || (configuration.enabled && configuration.isDefault)
                      || !configuration.credentialStatus.encryptedConfigured
                      || configuration.configurationStatus !== "COMPLETE"
                    }
                    onClick={() => setActivationTarget(configuration)}
                  >
                    {activating ? "Activando..." : configuration.enabled && configuration.isDefault ? "Activa y predeterminada" : "Activar y hacer predeterminada"}
                  </Button>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h5 className="font-medium text-slate-900 dark:text-white">Identidad FactuCore</h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Consulta de solo lectura. No prueba aceptación DIAN.</p>
                    </div>
                    <button
                      type="button"
                      onClick={validateFactuCoreIdentity}
                      disabled={identityState === "loading"}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
                    >
                      {identityState === "loading" ? "Validando..." : "Validar identidad"}
                    </button>
                  </div>
                  {identityState === "denied" ? <p role="alert" className="mt-3 text-sm text-rose-700">No tienes autorización para validar esta identidad.</p> : null}
                  {identityState === "error" ? <p role="alert" className="mt-3 text-sm text-rose-700">No fue posible consultar FactuCore.</p> : null}
                  {identity?.factuCore ? (
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-slate-500">Estado de identidad</dt><dd className="font-medium">{identity.identityStatus}</dd></div>
                      <div><dt className="text-slate-500">Tenant autenticado</dt><dd className="font-medium break-all">{identity.factuCore.tenantId}</dd></div>
                      <div><dt className="text-slate-500">Emisor</dt><dd className="font-medium">{identity.factuCore.issuer.complete ? "Completo" : "Incompleto"}</dd></div>
                      <div><dt className="text-slate-500">Readiness de configuración</dt><dd className="font-medium">{identity.factuCore.dianReadiness.status}</dd></div>
                    </dl>
                  ) : null}
                </div>
              </article>
            ))}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">Editar configuración</h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    Los secretos nunca se precargan. Campos vacíos conservan la credencial existente.
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${runtimeReadiness?.writeReady ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-amber-300 bg-amber-100 text-amber-800"}`}>
                  {runtimeReadiness?.writeReady ? "Guardado disponible" : "Guardado bloqueado"}
                </span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Select
                  label="Proveedor"
                  value={draft.providerId}
                  onChange={(event) => updateDraft("providerId", event.target.value)}
                >
                  <option value="">Selecciona un proveedor</option>
                  {providers.filter((provider) => provider.active).map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name} ({provider.code})</option>
                  ))}
                </Select>
                <Select
                  label="Ambiente"
                  value={draft.environment}
                  onChange={(event) => updateDraft("environment", event.target.value as TenantElectronicBillingDraft["environment"])}
                >
                  {ELECTRONIC_BILLING_ENVIRONMENTS.map((environment) => (
                    <option key={environment} value={environment}>{environment}</option>
                  ))}
                </Select>
                <Input
                  label="URL base"
                  value={draft.baseUrl}
                  onChange={(event) => updateDraft("baseUrl", event.target.value)}
                  placeholder="Deja vacío para conservar la actual"
                  autoComplete="off"
                />
                <Input
                  label="Tenant FactuCore"
                  value={draft.factuCoreTenantId}
                  onChange={(event) => updateDraft("factuCoreTenantId", event.target.value)}
                  autoComplete="off"
                />
                <Input
                  label="API Client key (opcional, reemplazo)"
                  type="password"
                  value={draft.clientKey}
                  onChange={(event) => updateDraft("clientKey", event.target.value)}
                  autoComplete="new-password"
                  placeholder="No se muestra la key almacenada"
                />
                <Input
                  label="API Client secret (opcional, reemplazo)"
                  type="password"
                  value={draft.clientSecret}
                  onChange={(event) => updateDraft("clientSecret", event.target.value)}
                  autoComplete="new-password"
                  placeholder="No se muestra el secret almacenado"
                />
              </div>
              {draftErrors.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-700" role="alert">
                  {draftErrors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <Button variant="outline" onClick={validateDraftLocally}>Validar datos</Button>
                <Button
                  variant={runtimeReadiness?.writeReady ? "primary" : "disabled"}
                  disabled={!runtimeReadiness?.writeReady || saving}
                  isLoading={saving}
                  onClick={saveConfiguration}
                  title={runtimeReadiness?.writeReady ? "Guardar configuración cifrada" : "El backend aún no autoriza escritura segura"}
                >
                  Guardar configuración
                </Button>
              </div>
              {saveError ? <p className="mt-3 text-sm text-rose-700" role="alert">{saveError}</p> : null}
              <p className="mt-3 text-xs text-amber-800 dark:text-amber-200">
                {runtimeReadiness?.writeReady
                  ? "La escritura usa AES-256-GCM v2. Los secretos no se muestran después de guardar."
                  : "Guardado deshabilitado: el backend no reporta readiness segura de keyring y escritura. HTTP 503 sigue siendo fail-closed."}
              </p>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={activationTarget !== null}
        onOpenChange={(open) => {
          if (!open && !activating) setActivationTarget(null);
        }}
        title="Activar facturación electrónica"
        description={activationTarget
          ? `Tenant: ${tenantName || "Tenant seleccionado"}. Proveedor: ${activationTarget.providerName}. Ambiente: ${activationTarget.environment}. Esta acción habilita la emisión automática, hace esta configuración predeterminada y elimina la referencia heredada. No cambia las credenciales cifradas.`
          : undefined}
        confirmText="Confirmar activación"
        cancelText="Cancelar"
        variant="warning"
        onConfirm={activateConfiguration}
        loading={activating}
      />
    </section>
  );
};
