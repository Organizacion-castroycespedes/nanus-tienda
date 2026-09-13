"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Modal } from "../../../../components/design-system/Modal";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { FinanceAccessNotice } from "../../../../modules/finance/components/FinanceAccessNotice";
import { CashRegisterForm } from "../../../../modules/finance/components/CashRegisterForm";
import { FinanceMetricCard } from "../../../../modules/finance/components/FinanceMetricCard";
import { FinancePageHeader } from "../../../../modules/finance/components/FinancePageHeader";
import { FinanceSectionNav } from "../../../../modules/finance/components/FinanceSectionNav";
import { FinanceStatusBadge } from "../../../../modules/finance/components/FinanceStatusBadge";
import { useFinanceCatalogs } from "../../../../modules/finance/hooks/use-finance-catalogs";
import { useCashRegisters } from "../../../../modules/finance/hooks/use-cash-registers";
import { getFinancePermissions } from "../../../../modules/finance/permissions";
import type {
  CashRegister,
  CreateCashRegisterPayload,
} from "../../../../modules/finance/types";
import { formatDate, normalizeSearch } from "../../../../modules/finance/utils";
import { useAppSelector } from "../../../../store/hooks";

const emptyForm: CreateCashRegisterPayload = {
  tenantId: undefined,
  branchId: "",
  terminalId: undefined,
  codigo: "",
  nombre: "",
  activo: true,
};

const CashRegistersPage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantSlug ?? authUser?.tenantId ?? "default";
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CashRegister | null>(null);
  const [form, setForm] = useState<CreateCashRegisterPayload>(emptyForm);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");

  const { canViewFinance, canManageCashRegisters, isSuperRole } =
    getFinancePermissions(role);
  const {
    cashRegisters,
    loading,
    saving,
    errorMessage,
    loadCashRegisters,
    createItem,
    updateItem,
  } = useCashRegisters();
  const {
    tenantOptions,
    branchOptions,
    terminalOptions,
    loadTenants,
    loadBranches,
    loadTerminals,
  } = useFinanceCatalogs({
    role,
    tenantId: authUser?.tenantId,
  });

  useAutoClearState(toastMessage, setToastMessage);

  useEffect(() => {
    if (!canViewFinance) {
      return;
    }

    void loadCashRegisters();
    void loadBranches(authUser?.tenantId ?? undefined);
    void loadTerminals({ tenantId: authUser?.tenantId ?? undefined });

    if (isSuperRole) {
      void loadTenants();
    }
  }, [
    authUser?.tenantId,
    canViewFinance,
    isSuperRole,
    loadBranches,
    loadCashRegisters,
    loadTerminals,
    loadTenants,
  ]);

  const filteredItems = useMemo(() => {
    const normalized = normalizeSearch(query);

    return cashRegisters.filter((item) => {
      if (branchFilter && item.branchId !== branchFilter) {
        return false;
      }
      if (statusFilter === "active" && !item.activo) {
        return false;
      }
      if (statusFilter === "inactive" && item.activo) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return [
        item.nombre,
        item.codigo,
        item.branchNombre ?? "",
        item.terminalNombre ?? "",
      ].some((value) => value.toLowerCase().includes(normalized));
    });
  }, [branchFilter, cashRegisters, query, statusFilter]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(emptyForm);
    void loadTerminals({ tenantId: authUser?.tenantId ?? undefined });
    setModalOpen(true);
  };

  const openEditModal = (item: CashRegister) => {
    void loadTerminals({ tenantId: item.tenantId, branchId: item.branchId });
    setEditingItem(item);
    setForm({
      tenantId: item.tenantId,
      branchId: item.branchId,
      terminalId: item.terminalId ?? undefined,
      codigo: item.codigo,
      nombre: item.nombre,
      activo: item.activo,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (!form.branchId || !form.codigo.trim() || !form.nombre.trim()) {
      setToastMessage("Completa sucursal, codigo y nombre.");
      setToastVariant("warning");
      return;
    }

    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          branchId: form.branchId,
          terminalId: form.terminalId ?? null,
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          activo: form.activo,
        });
        setToastMessage("Caja actualizada correctamente.");
      } else {
        await createItem({
          ...form,
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
        });
        setToastMessage("Caja creada correctamente.");
      }
      setToastVariant("success");
      closeModal();
    } catch {
      setToastMessage("No se pudo guardar la caja.");
      setToastVariant("error");
    }
  };

  const handleTenantChange = async (tenantId: string) => {
    setForm((prev) => ({
      ...prev,
      tenantId: tenantId || undefined,
      branchId: "",
      terminalId: undefined,
    }));
    await loadBranches(tenantId || undefined);
    await loadTerminals({ tenantId: tenantId || undefined });
  };

  const handleBranchChange = async (branchId: string) => {
    setForm((prev) => ({
      ...prev,
      branchId,
      terminalId: undefined,
    }));
    await loadTerminals({
      tenantId: form.tenantId ?? authUser?.tenantId ?? undefined,
      branchId: branchId || undefined,
    });
  };

  if (!canViewFinance) {
    return (
      <FinanceAccessNotice description="No tienes acceso a la administracion de cajas." />
    );
  }

  const activeCount = cashRegisters.filter((item) => item.activo).length;
  const assignedToTerminal = cashRegisters.filter((item) => item.terminalId).length;

  return (
    <div className="space-y-6">
      <FinancePageHeader
        eyebrow="Finance / Operacion"
        title="Cajas"
        description="Organiza puntos de recaudo por sucursal con una interfaz compacta, visual y preparada para futuras integraciones de caja y conciliacion."
        actions={
          <>
            <Button variant="ghost" onClick={() => void loadCashRegisters()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canManageCashRegisters ? (
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4" />
                Crear caja
              </Button>
            ) : null}
          </>
        }
      />

      <FinanceSectionNav tenantSlug={tenantSlug} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard label="Total cajas" value={cashRegisters.length} accent="slate" />
        <FinanceMetricCard label="Activas" value={activeCount} accent="emerald" />
        <FinanceMetricCard
          label="Ligadas a terminal"
          value={assignedToTerminal}
          accent="blue"
        />
        <FinanceMetricCard
          label="Sucursales visibles"
          value={new Set(cashRegisters.map((item) => item.branchId)).size}
          accent="amber"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            label="Buscar"
            placeholder="Caja, codigo, sucursal o terminal"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            label="Sucursal"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </Select>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Caja</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Terminal</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creada</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Cargando cajas...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay cajas para mostrar.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{item.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.codigo}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.branchNombre ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.terminalNombre ?? "-"}</td>
                    <td className="px-4 py-3">
                      <FinanceStatusBadge value={item.activo} kind="active" />
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      {canManageCashRegisters ? (
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                          Editar
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <Modal title={editingItem ? "Editar caja" : "Crear caja"} className="max-w-3xl">
          <CashRegisterForm
            value={form}
            tenantOptions={tenantOptions}
            branchOptions={branchOptions}
            terminalOptions={terminalOptions}
            isSuperRole={isSuperRole}
            isEditing={Boolean(editingItem)}
            onChange={setForm}
            onTenantChange={(tenantId) => void handleTenantChange(tenantId)}
            onBranchChange={(branchId) => void handleBranchChange(branchId)}
            onCancel={closeModal}
            onSubmit={() => void handleSubmit()}
            isSaving={saving}
          />
        </Modal>
      ) : null}
    </div>
  );
};

export default CashRegistersPage;
