"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Power, RefreshCw, Search } from "lucide-react";
import { ApiError } from "../../lib/request";
import { hasMenuAccess } from "../../lib/permissions";
import { useAppSelector } from "../../store/hooks";
import { Button } from "../../components/design-system/Button";
import { Input } from "../../components/design-system/Input";
import { Modal } from "../../components/design-system/Modal";
import { Pagination } from "../../components/design-system/Pagination";
import { Select } from "../../components/design-system/Select";
import {
  createElectronicBillingProvider,
  listElectronicBillingProviders,
  updateElectronicBillingProvider,
  updateElectronicBillingProviderStatus,
} from "./api";
import {
  ELECTRONIC_BILLING_PROVIDER_CAPABILITIES,
  type ElectronicBillingProvider,
  type ElectronicBillingProviderCapability,
} from "./types";

type DialogMode = "create" | "edit" | null;
type CapabilityMap = Record<ElectronicBillingProviderCapability, boolean>;

const capabilityLabels: Record<ElectronicBillingProviderCapability, string> = {
  invoice: "Factura",
  creditNote: "Nota crédito",
  debitNote: "Nota débito",
  retry: "Reintentos",
  pdf: "PDF",
  xml: "XML",
  signedXml: "XML firmado",
  asyncStatus: "Estado asíncrono",
  attachmentDownload: "Descarga de adjuntos",
};

const defaultCapabilities = (): CapabilityMap =>
  Object.fromEntries(
    ELECTRONIC_BILLING_PROVIDER_CAPABILITIES.map((key) => [key, true]),
  ) as CapabilityMap;

const readCapabilities = (value: unknown): CapabilityMap => {
  const defaults = defaultCapabilities();
  if (!value || typeof value !== "object") return defaults;
  for (const key of ELECTRONIC_BILLING_PROVIDER_CAPABILITIES) {
    if (typeof (value as Record<string, unknown>)[key] === "boolean") {
      defaults[key] = Boolean((value as Record<string, unknown>)[key]);
    }
  }
  return defaults;
};

const errorMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return "No fue posible completar la operación.";
  if (error.status === 400) return "Datos inválidos. Revisa nombre y capacidades.";
  if (error.status === 403) return "No tienes permiso para administrar proveedores.";
  if (error.status === 404) return "El proveedor no existe.";
  if (error.status === 409) return "La operación entra en conflicto con datos existentes o dependencias activas.";
  if (error.status === 503) return "El servicio de facturación no está disponible.";
  return "No fue posible completar la operación.";
};

export const ProviderAdministration = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const isSuperAdmin = role.trim().toUpperCase() === "SUPER_ADMIN";
  const canRead = isSuperAdmin && hasMenuAccess("ELECTRONIC_BILLING_PROVIDERS", "READ");
  const canWrite = isSuperAdmin && hasMenuAccess("ELECTRONIC_BILLING_PROVIDERS", "WRITE");
  const [providers, setProviders] = useState<ElectronicBillingProvider[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [selected, setSelected] = useState<ElectronicBillingProvider | null>(null);
  const [name, setName] = useState("");
  const [capabilities, setCapabilities] = useState<CapabilityMap>(defaultCapabilities);

  const loadProviders = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listElectronicBillingProviders(signal);
      if (!signal?.aborted) setProviders(result.providers);
    } catch (loadError) {
      if (!signal?.aborted) setError(errorMessage(loadError));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissionsLoaded || !canRead) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void loadProviders(controller.signal);
    return () => controller.abort();
  }, [canRead, loadProviders, permissionsLoaded]);

  const visibleProviders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return providers.filter((provider) => {
      const matchesSearch = !term || `${provider.code} ${provider.name}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" && provider.active)
        || (statusFilter === "inactive" && !provider.active);
      return matchesSearch && matchesStatus;
    });
  }, [providers, search, statusFilter]);

  const paginatedProviders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleProviders.slice(start, start + pageSize);
  }, [page, pageSize, visibleProviders]);

  useEffect(() => {
    const totalPages = Math.max(Math.ceil(visibleProviders.length / pageSize), 1);
    if (page > totalPages) setPage(totalPages);
  }, [page, pageSize, visibleProviders.length]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  const closeDialog = () => {
    if (!saving) setDialog(null);
  };

  const openCreate = () => {
    setSelected(null);
    setName("");
    setCapabilities(defaultCapabilities());
    setError(null);
    setDialog("create");
  };

  const openEdit = (provider: ElectronicBillingProvider) => {
    setSelected(provider);
    setName(provider.name);
    setCapabilities(readCapabilities(provider.capabilities));
    setError(null);
    setDialog("edit");
  };

  const saveProvider = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (dialog === "create") {
        await createElectronicBillingProvider({
          code: "FACTUCORE",
          name: name.trim(),
          providerType: "ELECTRONIC_BILLING",
          capabilities,
        });
      } else if (dialog === "edit" && selected) {
        await updateElectronicBillingProvider(selected.id, {
          name: name.trim(),
          capabilities,
        });
      }
      setDialog(null);
      await loadProviders();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (provider: ElectronicBillingProvider) => {
    const nextActive = !provider.active;
    const action = nextActive ? "activar" : "desactivar";
    if (!window.confirm(`¿Confirmas ${action} ${provider.name}?`)) return;
    setError(null);
    try {
      await updateElectronicBillingProviderStatus(provider.id, nextActive);
      await loadProviders();
    } catch (statusError) {
      setError(errorMessage(statusError));
    }
  };

  if (!permissionsLoaded) {
    return <p role="status" className="p-6 text-sm text-slate-500">Cargando permisos...</p>;
  }
  if (!canRead) {
    return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Acceso denegado.</p>;
  }

  return (
    <main className="space-y-6 p-4 sm:p-6" aria-labelledby="provider-admin-title">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Configuración</p>
          <h1 id="provider-admin-title" className="text-2xl font-bold text-slate-900 dark:text-white">Proveedores de facturación electrónica</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Catálogo global. No modifica credenciales ni asignaciones de tenants.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void loadProviders()} disabled={loading} aria-label="Actualizar proveedores"><RefreshCw className="h-4 w-4" />Actualizar</Button>
          {canWrite ? <Button onClick={openCreate}><Plus className="h-4 w-4" />Nuevo proveedor</Button> : null}
        </div>
      </section>

      {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <label className="relative block max-w-xl flex-1">
          <span className="sr-only">Buscar proveedor</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input aria-label="Buscar proveedor" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código o nombre" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        </label>
          <Select label="Estado" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as "all" | "active" | "inactive"); setPage(1); }}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
          <Button variant="ghost" onClick={resetFilters} disabled={!search && statusFilter === "all"}>Limpiar</Button>
        </div>
      </section>

      {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800">Cargando proveedores...</div> : null}
      {!loading && visibleProviders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800">No hay proveedores que mostrar.</div> : null}
      {!loading && visibleProviders.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
              <tr><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Capacidades</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {paginatedProviders.map((provider) => {
                const providerCapabilities = readCapabilities(provider.capabilities);
                return <tr key={provider.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 last:border-0 dark:border-slate-700 dark:hover:bg-slate-700/40">
                  <td className="px-4 py-4"><div className="font-semibold text-slate-900 dark:text-white">{provider.name}</div><div className="font-mono text-xs text-slate-500">{provider.code}</div></td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">Facturación electrónica</td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{ELECTRONIC_BILLING_PROVIDER_CAPABILITIES.filter((key) => providerCapabilities[key]).map((key) => capabilityLabels[key]).join(", ") || "Ninguna"}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${provider.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{provider.active ? "Activo" : "Inactivo"}</span></td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={!canWrite} onClick={() => openEdit(provider)}><Pencil className="h-4 w-4" />Editar</Button><Button size="sm" variant={provider.active ? "warning" : "secondary"} disabled={!canWrite} onClick={() => void changeStatus(provider)}><Power className="h-4 w-4" />{provider.active ? "Desactivar" : "Activar"}</Button></div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {dialog ? <Modal responsive size="lg" title={dialog === "create" ? "Nuevo proveedor" : "Editar proveedor"} description="Solo se permiten metadatos del catálogo. FactuCore es el único adaptador registrado." onClose={closeDialog} footer={<><Button variant="ghost" onClick={closeDialog}>Cancelar</Button><Button onClick={() => void saveProvider()} isLoading={saving}>Guardar</Button></>}>
        <div className="space-y-4">
          {dialog === "create" ? <Input label="Código del adaptador" value="FACTUCORE" readOnly hint="Código normalizado. No se pueden registrar adaptadores arbitrarios." /> : <Input label="Código del adaptador" value={selected?.code ?? ""} readOnly />}
          <Input label="Nombre" required value={name} onChange={(event) => setName(event.target.value)} maxLength={160} />
          <fieldset><legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Capacidades del adaptador FACTUCORE</legend><div className="grid gap-2 sm:grid-cols-2">{ELECTRONIC_BILLING_PROVIDER_CAPABILITIES.map((key) => <label key={key} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={capabilities[key]} onChange={(event) => setCapabilities((current) => ({ ...current, [key]: event.target.checked }))} />{capabilityLabels[key]}</label>)}</div></fieldset>
        </div>
      </Modal> : null}
      {!loading && visibleProviders.length > 0 ? <Pagination page={page} pageSize={pageSize} totalItems={visibleProviders.length} onPageChange={setPage} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }} loading={loading} /> : null}

    </main>
  );
};
