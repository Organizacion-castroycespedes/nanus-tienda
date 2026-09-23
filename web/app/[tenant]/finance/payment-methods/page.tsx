"use client";

import { Plus, RefreshCw, Search, Landmark, CreditCard } from "lucide-react";
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
import { FinancialInstitutionForm } from "../../../../modules/finance/components/FinancialInstitutionForm";
import { useFinanceCatalogs } from "../../../../modules/finance/hooks/use-finance-catalogs";
import { usePaymentMethods } from "../../../../modules/finance/hooks/use-payment-methods";
import { useFinancialInstitutions } from "../../../../modules/finance/hooks/use-financial-institutions";
import { getFinancePermissions } from "../../../../modules/finance/permissions";
import type {
  CreatePaymentMethodPayload,
  FinancialInstitution,
  PaymentMethod,
} from "../../../../modules/finance/types";
import { formatDate, normalizeSearch } from "../../../../modules/finance/utils";
import { BankLogo } from "../../../../modules/shared/payments/BankLogo";
import { useAppSelector } from "../../../../store/hooks";

const emptyForm: CreatePaymentMethodPayload = {
  tenantId: undefined,
  codigo: "",
  nombre: "",
  tipo: "CASH",
  requiresReference: true,
  requiresFinancialInstitution: false,
  allowsChange: true,
  active: true,
  electronicBillingEnabled: false,
};

const PaymentMethodsPage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantSlug ?? authUser?.tenantId ?? "default";
  
  const [activeTab, setActiveTab] = useState<"methods" | "banks">("methods");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  
  // Method Modal State
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [methodForm, setMethodForm] = useState<CreatePaymentMethodPayload>(emptyForm);
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<string[]>([]);
  
  // Bank Modal State
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<FinancialInstitution | null>(null);
  const [bankForm, setBankForm] = useState<Partial<FinancialInstitution>>({
    codigo: "",
    nombre: "",
    tipo: "BANK",
    active: true,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");

  const { canViewFinance, canManagePaymentMethods, isSuperRole } = getFinancePermissions(role);
  
  const {
    paymentMethods,
    loading: loadingMethods,
    saving: savingMethod,
    errorMessage: errorMethods,
    loadPaymentMethods,
    createItem: createMethod,
    updateItem: updateMethod,
    toggleStatus: toggleMethodStatus,
  } = usePaymentMethods();

  const {
    financialInstitutions,
    loading: loadingBanks,
    saving: savingBank,
    errorMessage: errorBanks,
    loadFinancialInstitutions,
    createItem: createBank,
    updateItem: updateBank,
    toggleStatus: toggleBankStatus,
    loadMethodInstitutions,
    saveMethodInstitutions,
  } = useFinancialInstitutions();

  const { tenantOptions, loadTenants } = useFinanceCatalogs({
    role,
    tenantId: authUser?.tenantId,
  });

  useAutoClearState(toastMessage, setToastMessage);

  useEffect(() => {
    if (!canViewFinance) return;
    void loadPaymentMethods();
    void loadFinancialInstitutions();
    if (isSuperRole) {
      void loadTenants();
    }
  }, [canViewFinance, isSuperRole, loadPaymentMethods, loadFinancialInstitutions, loadTenants]);

  const filteredMethods = useMemo(() => {
    const normalized = normalizeSearch(query);
    return paymentMethods.filter((item) => {
      if (activeFilter === "active" && !item.active) return false;
      if (activeFilter === "inactive" && item.active) return false;
      if (!normalized) return true;
      return [item.codigo, item.nombre, item.tipo].some((val) =>
        val.toLowerCase().includes(normalized)
      );
    });
  }, [activeFilter, paymentMethods, query]);

  const filteredBanks = useMemo(() => {
    const normalized = normalizeSearch(query);
    return financialInstitutions.filter((item) => {
      if (activeFilter === "active" && !item.active) return false;
      if (activeFilter === "inactive" && item.active) return false;
      if (!normalized) return true;
      return [item.codigo, item.nombre, item.nombreCorto || "", item.tipo].some((val) =>
        val.toLowerCase().includes(normalized)
      );
    });
  }, [activeFilter, financialInstitutions, query]);

  // Method Actions
  const openCreateMethodModal = () => {
    setEditingMethod(null);
    setMethodForm({
      ...emptyForm,
      tenantId: isSuperRole ? authUser?.tenantId ?? undefined : undefined,
    });
    setSelectedInstitutionIds([]);
    setMethodModalOpen(true);
  };

  const openEditMethodModal = async (item: PaymentMethod) => {
    setEditingMethod(item);
    setMethodForm({
      tenantId: item.tenantId,
      codigo: item.codigo,
      nombre: item.nombre,
      tipo: item.tipo,
      requiresReference: item.requiresReference,
      requiresFinancialInstitution: item.requiresFinancialInstitution,
      sortOrder: item.sortOrder,
      allowsChange: item.allowsChange,
      active: item.active,
      electronicBillingEnabled: item.electronicBillingEnabled,
    });
    if (item.requiresFinancialInstitution) {
      const mappedInstitutions = await loadMethodInstitutions(item.id);
      setSelectedInstitutionIds(mappedInstitutions.map((institution) => institution.id));
    } else {
      setSelectedInstitutionIds([]);
    }
    setMethodModalOpen(true);
  };

  const handleMethodSubmit = async () => {
    if (!methodForm.codigo.trim() || !methodForm.nombre.trim()) {
      setToastMessage("Completa código y nombre.");
      setToastVariant("warning");
      return;
    }
    try {
      if (editingMethod) {
        const updated = await updateMethod(editingMethod.id, methodForm);
        await saveMethodInstitutions(
          updated.id,
          methodForm.requiresFinancialInstitution ? selectedInstitutionIds : []
        );
        setToastMessage("Método actualizado correctamente.");
      } else {
        const created = await createMethod(methodForm);
        await saveMethodInstitutions(
          created.id,
          methodForm.requiresFinancialInstitution ? selectedInstitutionIds : []
        );
        setToastMessage("Método creado correctamente.");
      }
      setToastVariant("success");
      setMethodModalOpen(false);
    } catch {
      setToastMessage("No se pudo guardar el método de pago.");
      setToastVariant("error");
    }
  };

  // Bank Actions
  const openCreateBankModal = () => {
    setEditingBank(null);
    setBankForm({ codigo: "", nombre: "", tipo: "BANK", active: true, sortOrder: 0 });
    setBankModalOpen(true);
  };

  const openEditBankModal = (item: FinancialInstitution) => {
    setEditingBank(item);
    setBankForm(item);
    setBankModalOpen(true);
  };

  const handleBankSubmit = async () => {
    if (!bankForm.codigo?.trim() || !bankForm.nombre?.trim()) {
      setToastMessage("Completa código y nombre.");
      setToastVariant("warning");
      return;
    }
    try {
      if (editingBank) {
        await updateBank(editingBank.id, bankForm);
        setToastMessage("Entidad financiera actualizada.");
      } else {
        await createBank(bankForm);
        setToastMessage("Entidad financiera creada.");
      }
      setToastVariant("success");
      setBankModalOpen(false);
    } catch {
      setToastMessage("No se pudo guardar la entidad financiera.");
      setToastVariant("error");
    }
  };

  if (!canViewFinance) {
    return <FinanceAccessNotice description="No tienes acceso a métodos de pago." />;
  }

  const activeMethodsCount = paymentMethods.filter((item) => item.active).length;
  const activeBanksCount = financialInstitutions.filter((item) => item.active).length;

  return (
    <div className="space-y-6">
      <FinancePageHeader
        eyebrow="Finance / Catálogo"
        title="Medios de pago y Entidades"
        description="Administra los medios de pago disponibles en el POS y sus bancos/billeteras asociados."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                void loadPaymentMethods();
                void loadFinancialInstitutions();
              }}
              isLoading={loadingMethods || loadingBanks}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canManagePaymentMethods ? (
              activeTab === "methods" ? (
                <Button onClick={openCreateMethodModal}>
                  <Plus className="h-4 w-4" />
                  Crear método
                </Button>
              ) : (
                <Button onClick={openCreateBankModal}>
                  <Plus className="h-4 w-4" />
                  Crear banco / billetera
                </Button>
              )
            ) : null}
          </>
        }
      />

      <FinanceSectionNav tenantSlug={tenantSlug} />

      {/* Tabs bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("methods")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "methods"
              ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Medios de pago ({paymentMethods.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("banks")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "banks"
              ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Landmark className="h-4 w-4" />
          Bancos y billeteras ({financialInstitutions.length})
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard label="Métodos activos" value={activeMethodsCount} accent="emerald" />
        <FinanceMetricCard label="Bancos / Billeteras" value={activeBanksCount} accent="blue" />
        <FinanceMetricCard
          label="Requieren Banco"
          value={paymentMethods.filter((m) => m.requiresFinancialInstitution).length}
          accent="amber"
        />
        <FinanceMetricCard label="Total catálogo" value={paymentMethods.length + financialInstitutions.length} accent="slate" />
      </section>

      {/* Search & Filter bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
          <Input
            label="Buscar"
            placeholder={activeTab === "methods" ? "Código, nombre o tipo..." : "Nombre o código de banco..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            label="Estado"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
          <div className="flex items-end">
            <Button variant="outline" className="w-full md:w-auto">
              <Search className="h-4 w-4" />
              Filtrar
            </Button>
          </div>
        </div>
      </section>

      {(errorMethods || errorBanks) && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMethods || errorBanks}
        </section>
      )}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      {/* Tab 1: Payment Methods Table */}
      {activeTab === "methods" && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Reglas</th>
                  <th className="px-4 py-3 font-medium">Bancos vinculados</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingMethods ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Cargando métodos...
                    </td>
                  </tr>
                ) : filteredMethods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No hay métodos de pago registrados.
                    </td>
                  </tr>
                ) : (
                  filteredMethods.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{item.nombre}</p>
                          <p className="text-xs text-slate-500">{item.codigo}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.tipo}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            Ref: {item.requiresReference ? "Obligatoria" : "Opcional"}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Bancos: {item.requiresFinancialInstitution ? "Sí" : "No"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {item.requiresFinancialInstitution ? "Muestra catálogo" : "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <FinanceStatusBadge value={item.active} kind="active" />
                      </td>
                      <td className="px-4 py-3">
                        {canManagePaymentMethods ? (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => void openEditMethodModal(item)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void toggleMethodStatus(item)}
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
      )}

      {/* Tab 2: Financial Institutions Table */}
      {activeTab === "banks" && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Entidad</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingBanks ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Cargando entidades...
                    </td>
                  </tr>
                ) : filteredBanks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No hay bancos o billeteras para mostrar.
                    </td>
                  </tr>
                ) : (
                  filteredBanks.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <BankLogo code={item.codigo} name={item.nombre} logoUrl={item.logoUrl} className="h-7 w-7" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{item.nombre}</p>
                            {item.nombreCorto && <p className="text-xs text-slate-400">{item.nombreCorto}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{item.codigo}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.tipo}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.sortOrder}</td>
                      <td className="px-4 py-3">
                        <FinanceStatusBadge value={item.active} kind="active" />
                      </td>
                      <td className="px-4 py-3">
                        {canManagePaymentMethods && (item.tenantId !== null || role === "SUPER_ADMIN") ? (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditBankModal(item)}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void toggleBankStatus(item)}
                            >
                              {item.active ? "Inactivar" : "Activar"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {item.tenantId === null ? "Catálogo global" : "Solo lectura"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal Payment Method */}
      {methodModalOpen && (
        <Modal
          title={editingMethod ? "Editar método de pago" : "Crear método de pago"}
          size="lg"
          onClose={() => setMethodModalOpen(false)}
        >
          <PaymentMethodForm
            value={methodForm}
            tenantOptions={tenantOptions}
            isSuperRole={isSuperRole}
            isEditing={Boolean(editingMethod)}
            financialInstitutions={financialInstitutions}
            selectedInstitutionIds={selectedInstitutionIds}
            onSelectedInstitutionIdsChange={setSelectedInstitutionIds}
            onChange={setMethodForm}
            onCancel={() => setMethodModalOpen(false)}
            onSubmit={() => void handleMethodSubmit()}
            isSaving={savingMethod}
          />
        </Modal>
      )}

      {/* Modal Bank / Wallet */}
      {bankModalOpen && (
        <Modal
          title={editingBank ? "Editar banco / billetera" : "Crear banco / billetera"}
          size="md"
          onClose={() => setBankModalOpen(false)}
        >
          <FinancialInstitutionForm
            value={bankForm}
            isEditing={Boolean(editingBank)}
            isSaving={savingBank}
            onChange={setBankForm}
            onCancel={() => setBankModalOpen(false)}
            onSubmit={() => void handleBankSubmit()}
          />
        </Modal>
      )}
    </div>
  );
};

export default PaymentMethodsPage;
