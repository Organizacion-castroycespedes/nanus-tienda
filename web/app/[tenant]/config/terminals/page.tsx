"use client";

import { Monitor, Plus, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Modal } from "../../../../components/design-system/Modal";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { useAppSelector } from "../../../../store/hooks";
import {
  useTerminals,
  type TerminalBranchOption,
} from "../../../../modules/terminals/hooks/use-terminals";
import type { TerminalResponse } from "../../../../modules/terminals/services/terminals.service";
import { buildTerminalPeripheralsPath } from "../../../../modules/terminals/utils/terminal-links";
import { TerminalDeviceBindingPanel } from "../../../../modules/terminals/components/TerminalDeviceBindingPanel";

type TerminalFilters = {
  query: string;
  tenantId: string;
  branchId: string;
};

type TerminalFormState = {
  tenantId: string;
  branchId: string;
  name: string;
  code: string;
  deviceFingerprint: string;
  isActive: boolean;
};

const defaultFilters: TerminalFilters = {
  query: "",
  tenantId: "",
  branchId: "",
};

const emptyForm: TerminalFormState = {
  tenantId: "",
  branchId: "",
  name: "",
  code: "",
  deviceFingerprint: "",
  isActive: true,
};

const pageSizeOptions = [10, 25, 50];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const TerminalsPage = () => {
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);
  const [draftFilters, setDraftFilters] = useState<TerminalFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<TerminalFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalResponse | null>(null);
  const [bindingTerminal, setBindingTerminal] = useState<TerminalResponse | null>(null);
  const [form, setForm] = useState<TerminalFormState>(emptyForm);

  const {
    terminals,
    branches,
    tenantOptions,
    loading,
    saving,
    errorMessage,
    hasSearched,
    isSuperRole,
    loadTenants,
    loadBranches,
    loadTerminals,
    createItem,
    updateItem,
    updateStatus,
  } = useTerminals({
    role: authUser?.role,
    tenantId: authUser?.tenantId,
  });

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  useEffect(() => {
    if (!isSuperRole) {
      void loadBranches(authUser?.tenantId ?? undefined);
      return;
    }

    void (async () => {
      await loadTenants();
      await loadBranches(draftFilters.tenantId || authUser?.tenantId || undefined);
    })();
  }, [
    authUser?.tenantId,
    draftFilters.tenantId,
    isSuperRole,
    loadBranches,
    loadTenants,
  ]);

  const availableBranches = useMemo(() => {
    const selectedTenantId = isSuperRole
      ? form.tenantId || draftFilters.tenantId
      : authUser?.tenantId ?? "";

    return branches.filter((branch) =>
      selectedTenantId ? branch.tenantId === selectedTenantId : true
    );
  }, [authUser?.tenantId, branches, draftFilters.tenantId, form.tenantId, isSuperRole]);

  const filteredTerminals = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return terminals;
    }

    return terminals.filter((terminal) => {
      const branchName = (terminal.branchName ?? "").toLowerCase();
      const tenantName = (terminal.tenantName ?? "").toLowerCase();
      return (
        terminal.name.toLowerCase().includes(query) ||
        terminal.code.toLowerCase().includes(query) ||
        branchName.includes(query) ||
        tenantName.includes(query)
      );
    });
  }, [appliedFilters.query, terminals]);

  const paginatedTerminals = useMemo(() => {
    const start = page * pageSize;
    return filteredTerminals.slice(start, start + pageSize);
  }, [filteredTerminals, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTerminals.length / pageSize));

  const openCreateModal = () => {
    setSelectedTerminal(null);
    setForm({
      ...emptyForm,
      tenantId: isSuperRole ? draftFilters.tenantId || authUser?.tenantId || "" : "",
    });
    setModalMode("create");
  };

  const openEditModal = (terminal: TerminalResponse) => {
    setSelectedTerminal(terminal);
    setForm({
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      name: terminal.name,
      code: terminal.code,
      deviceFingerprint: terminal.deviceFingerprint ?? "",
      isActive: terminal.isActive,
    });
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedTerminal(null);
    setForm(emptyForm);
  };

  const applyFilters = async () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    await loadTerminals(
      isSuperRole
        ? {
            tenantId: draftFilters.tenantId || undefined,
            branchId: draftFilters.branchId || undefined,
          }
        : {
            branchId: draftFilters.branchId || undefined,
          }
    );
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const handleTenantFilterChange = async (tenantId: string) => {
    setDraftFilters((prev) => ({
      ...prev,
      tenantId,
      branchId: prev.tenantId && prev.tenantId !== tenantId ? "" : prev.branchId,
    }));
    await loadBranches(tenantId || authUser?.tenantId || undefined);
  };

  const handleFormTenantChange = async (tenantId: string) => {
    setForm((prev) => ({
      ...prev,
      tenantId,
      branchId: prev.tenantId && prev.tenantId !== tenantId ? "" : prev.branchId,
    }));
    await loadBranches(tenantId || authUser?.tenantId || undefined);
  };

  const handleSubmit = async () => {
    const effectiveTenantId = isSuperRole ? form.tenantId || authUser?.tenantId : undefined;
    if (!form.branchId || !form.name.trim() || !form.code.trim()) {
      showToast("Completa sucursal, nombre y codigo.", "warning");
      return;
    }
    if (isSuperRole && !effectiveTenantId) {
      showToast("Selecciona un tenant.", "warning");
      return;
    }

    try {
      if (modalMode === "create") {
        await createItem({
          tenantId: effectiveTenantId || undefined,
          branchId: form.branchId,
          name: form.name.trim(),
          code: form.code.trim(),
          deviceFingerprint: form.deviceFingerprint.trim() || undefined,
          isActive: form.isActive,
        });
        showToast("Terminal creada correctamente.", "success");
      } else if (modalMode === "edit" && selectedTerminal) {
        await updateItem(selectedTerminal.id, {
          branchId: form.branchId,
          name: form.name.trim(),
          code: form.code.trim(),
          deviceFingerprint: form.deviceFingerprint.trim() || null,
        });
        showToast("Terminal actualizada correctamente.", "success");
      }

      closeModal();
      if (hasSearched) {
        await applyFilters();
      }
    } catch {
      showToast("No se pudo guardar la terminal.", "error");
    }
  };

  const handleStatusChange = async (terminal: TerminalResponse) => {
    try {
      await updateStatus(terminal.id, !terminal.isActive);
      showToast(
        terminal.isActive
          ? "Terminal inactivada correctamente."
          : "Terminal reactivada correctamente.",
        "success"
      );
      if (hasSearched) {
        await applyFilters();
      }
    } catch {
      showToast("No se pudo actualizar el estado.", "error");
    }
  };

  const handleConfigurePeripherals = (terminal: TerminalResponse) => {
    const tenantSlug = terminal.tenantId || authUser?.tenantId || "";
    router.push(buildTerminalPeripheralsPath(tenantSlug, terminal.id));
  };

  const openBindingPanel = (terminal: TerminalResponse) => {
    setBindingTerminal(terminal);
  };

  if (authUser?.role !== "SUPER_ADMIN") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Acceso restringido</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Solo SUPER_ADMIN puede administrar terminales.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Configuracion</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Terminales</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Administra terminales por sucursal y controla su estado operativo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void applyFilters()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Crear terminal
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Nombre, codigo, tenant o sucursal"
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, query: event.target.value }))
            }
          />
          <Select
            label="Tenant"
            value={draftFilters.tenantId}
            onChange={(event) => void handleTenantFilterChange(event.target.value)}
          >
            <option value="">Todos</option>
            {tenantOptions.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
          <Select
            label="Sucursal"
            value={draftFilters.branchId}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, branchId: event.target.value }))
            }
          >
            <option value="">Todas</option>
            {availableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => void applyFilters()}>
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button variant="ghost" onClick={resetFilters}>
              Limpiar
            </Button>
          </div>
          <Select
            label="Filas por pagina"
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Codigo</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creada</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Cargando terminales...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Usa el boton Buscar para consultar terminales.
                  </td>
                </tr>
              ) : paginatedTerminals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay terminales para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedTerminals.map((terminal) => (
                  <tr key={terminal.id}>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">{terminal.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{terminal.code}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      <div className="flex flex-col gap-1">
                        <span>{terminal.branchName ?? "-"}</span>
                        {terminal.tenantName ? (
                          <span className="text-xs text-slate-400">{terminal.tenantName}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          terminal.isActive
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-100 text-slate-600"
                        } dark:text-slate-300`}
                      >
                        {terminal.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatDate(terminal.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openBindingPanel(terminal)}
                        >
                          Administrar dispositivo
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleConfigurePeripherals(terminal)}
                        >
                          Configurar periféricos
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(terminal)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleStatusChange(terminal)}
                          disabled={saving}
                        >
                          {terminal.isActive ? "Inactivar" : "Reactivar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span>
            Pagina {Math.min(page + 1, totalPages)} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0 || loading}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPage((prev) => Math.min(prev + 1, Math.max(totalPages - 1, 0)))}
              disabled={page >= totalPages - 1 || loading}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>

      {bindingTerminal ? (
        <TerminalDeviceBindingPanel
          terminal={bindingTerminal}
          onClose={() => setBindingTerminal(null)}
        />
      ) : null}

      {modalMode ? (
        <Modal title={modalMode === "create" ? "Crear terminal" : "Editar terminal"}>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Tenant"
                value={form.tenantId}
                onChange={(event) => void handleFormTenantChange(event.target.value)}
              >
                <option value="">Selecciona un tenant</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Sucursal"
                value={form.branchId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, branchId: event.target.value }))
                }
              >
                <option value="">Selecciona una sucursal</option>
                {availableBranches.map((branch: TerminalBranchOption) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Nombre"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <Input
                label="Codigo"
                value={form.code}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, code: event.target.value }))
                }
              />
              <Input
                label="Device fingerprint"
                value={form.deviceFingerprint}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    deviceFingerprint: event.target.value,
                  }))
                }
              />
              {modalMode === "create" ? (
                <Select
                  label="Estado inicial"
                  value={form.isActive ? "active" : "inactive"}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </Select>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={closeModal}>
                Cerrar
              </Button>
              <Button variant="primary" onClick={() => void handleSubmit()} isLoading={saving}>
                <Monitor className="h-4 w-4" />
                {modalMode === "create" ? "Crear terminal" : "Actualizar terminal"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

export default TerminalsPage;
