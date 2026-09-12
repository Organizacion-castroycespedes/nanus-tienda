"use client";

import { Plus, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Modal } from "../../../../components/design-system/Modal";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { FinanceAccessNotice } from "../../../../modules/finance/components/FinanceAccessNotice";
import { FinanceMetricCard } from "../../../../modules/finance/components/FinanceMetricCard";
import { FinancePageHeader } from "../../../../modules/finance/components/FinancePageHeader";
import { FinanceSectionNav } from "../../../../modules/finance/components/FinanceSectionNav";
import { FinanceStatusBadge } from "../../../../modules/finance/components/FinanceStatusBadge";
import { PaymentMethodForm } from "../../../../modules/finance/components/PaymentMethodForm";
import { useFinanceCatalogs } from "../../../../modules/finance/hooks/use-finance-catalogs";
import { usePaymentMethods } from "../../../../modules/finance/hooks/use-payment-methods";
import { getFinancePermissions } from "../../../../modules/finance/permissions";
import type {
  CreatePaymentMethodPayload,
  PaymentMethod,
} from "../../../../modules/finance/types";
import { formatDate, normalizeSearch } from "../../../../modules/finance/utils";
import { useAppSelector } from "../../../../store/hooks";

const emptyForm: CreatePaymentMethodPayload = {
  tenantId: undefined,
  codigo: "",
  nombre: "",
  tipo: "CASH",
  requiresReference: false,
  allowsChange: true,
  active: true,
};

const PaymentMethodsPage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantId ?? "default";
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState<CreatePaymentMethodPayload>(emptyForm);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");

  const { canViewFinance, canManagePaymentMethods, isSuperRole } =
    getFinancePermissions(role);
  const {
    paymentMethods,
    loading,
    saving,
    errorMessage,
    loadPaymentMethods,
    createItem,
    updateItem,
    toggleStatus,
  } = usePaymentMethods();
  const { tenantOptions, loadTenants } = useFinanceCatalogs({
    role,
    tenantId: authUser?.tenantId,
  });

  useAutoClearState(toastMessage, setToastMessage);

  useEffect(() => {
    if (!canViewFinance) {
      return;
    }
    void loadPaymentMethods();
    if (isSuperRole) {
      void loadTenants();
    }
  }, [canViewFinance, isSuperRole, loadPaymentMethods, loadTenants]);

  const filteredItems = useMemo(() => {
    const normalized = normalizeSearch(query);
    return paymentMethods.filter((item) => {
      if (activeFilter === "active" && !item.active) {
        return false;
      }
      if (activeFilter === "inactive" && item.active) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return [item.codigo, item.nombre, item.tipo]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [activeFilter, paymentMethods, query]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm({
      ...emptyForm,
      tenantId: isSuperRole ? authUser?.tenantId ?? undefined : undefined,
    });
    setModalOpen(true);
  };

  const openEditModal = (item: PaymentMethod) => {
    setEditingItem(item);
    setForm({
      tenantId: item.tenantId,
      codigo: item.codigo,
      nombre: item.nombre,
      tipo: item.tipo,
      requiresReference: item.requiresReference,
      allowsChange: item.allowsChange,
      active: item.active,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setToastMessage("Completa codigo y nombre.");
      setToastVariant("warning");
      return;
    }
    if (isSuperRole && !form.tenantId) {
      setToastMessage("Selecciona un tenant.");
      setToastVariant("warning");
      return;
    }

    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          requiresReference: form.requiresReference,
          allowsChange: form.allowsChange,
          active: form.active,
        });
        setToastMessage("Metodo actualizado correctamente.");
      } else {
        await createItem({
          ...form,
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          tenantId: isSuperRole ? form.tenantId : undefined,
        });
        setToastMessage("Metodo creado correctamente.");
      }
      setToastVariant("success");
      closeModal();
    } catch {
      setToastMessage("No se pudo guardar el metodo de pago.");
      setToastVariant("error");
    }
  };

  const handleToggleStatus = async (item: PaymentMethod) => {
    try {
      await toggleStatus(item);
      setToastMessage(
        item.active ? "Metodo inactivado." : "Metodo reactivado."
      );
      setToastVariant("success");
    } catch {
      setToastMessage("No se pudo actualizar el estado.");
      setToastVariant("error");
    }
  };

  if (!canViewFinance) {
    return (
      <FinanceAccessNotice description="No tienes acceso a metodos de pago dentro del modulo financiero." />
    );
  }

  const activeCount = paymentMethods.filter((item) => item.active).length;
  const referenceCount = paymentMethods.filter((item) => item.requiresReference).length;
  const creditCount = paymentMethods.filter((item) => item.tipo === "CREDIT").length;

  return (
    <div className="space-y-6">
      <FinancePageHeader
        eyebrow="Finance / Catalogo"
        title="Metodos de pago"
        description="Controla el catalogo operativo que despues soportara caja, checkout y conciliacion. La vista mantiene estados claros y acciones rapidas al estilo POS."
        actions={
          <>
            <Button variant="ghost" onClick={() => void loadPaymentMethods()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canManagePaymentMethods ? (
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4" />
                Crear metodo
              </Button>
            ) : null}
          </>
        }
      />

      <FinanceSectionNav tenantSlug={tenantSlug} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard label="Activos" value={activeCount} accent="emerald" />
        <FinanceMetricCard
          label="Con referencia"
          value={referenceCount}
          accent="blue"
        />
        <FinanceMetricCard label="Credito" value={creditCount} accent="amber" />
        <FinanceMetricCard label="Total" value={paymentMethods.length} accent="slate" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <Input
            label="Buscar"
            placeholder="Codigo, nombre o tipo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            label="Estado"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
          <div className="flex items-end">
            <Button variant="outline" className="w-full md:w-auto">
              <Search className="h-4 w-4" />
              Filtrado local
            </Button>
          </div>
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
                <th className="px-4 py-3 font-medium">Metodo</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Reglas</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Actualizado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Cargando metodos...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay metodos para mostrar.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{item.nombre}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.codigo}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.tipo}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">
                          Ref: {item.requiresReference ? "Si" : "No"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">
                          Cambio: {item.allowsChange ? "Si" : "No"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FinanceStatusBadge value={item.active} kind="active" />
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {canManagePaymentMethods ? (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(item)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleStatus(item)}
                          >
                            {item.active ? "Inactivar" : "Activar"}
                          </Button>
                        </div>
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
        <Modal
          title={editingItem ? "Editar metodo de pago" : "Crear metodo de pago"}
          className="max-w-3xl"
        >
          <PaymentMethodForm
            value={form}
            tenantOptions={tenantOptions}
            isSuperRole={isSuperRole}
            isEditing={Boolean(editingItem)}
            onChange={setForm}
            onCancel={closeModal}
            onSubmit={() => void handleSubmit()}
            isSaving={saving}
          />
        </Modal>
      ) : null}
    </div>
  );
};

export default PaymentMethodsPage;
