"use client";

import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { ConfirmDialog } from "../../../components/design-system/confirm-dialog";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { CustomerForm } from "../../../modules/inventory/components/CustomerForm";
import { FocusActionLayout } from "../../../modules/inventory/components/FocusActionLayout";
import {
  listElectronicInvoicingCustomers,
  type ElectronicInvoicingCustomer,
} from "../../../modules/electronic-invoicing/services/customer.service";
import {
  deleteCustomer,
  getCustomers,
  type CustomerResponse,
} from "../../../modules/inventory/services/customer.service";
import { useConfirm, isConfirmCancelledError } from "../../../hooks/use-confirm";
import { hasPermission } from "../../../lib/permissions";
import { MENU_KEYS } from "../../../domains/menu/constants";
import { useAutoClearState } from "../../../lib/useAutoClearState";

type CustomerFilters = {
  query: string;
};

type ActionFeedback = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
};

const defaultFilters: CustomerFilters = {
  query: "",
};

const pageSizeOptions = [10, 25, 50];

const mergeFiscalCustomers = (
  baseCustomers: CustomerResponse[],
  fiscalCustomers: ElectronicInvoicingCustomer[]
): CustomerResponse[] => {
  const fiscalById = new Map(
    fiscalCustomers.map((customer) => [customer.id, customer])
  );

  return baseCustomers.map((customer) => {
    const fiscal = fiscalById.get(customer.id);
    if (!fiscal) {
      return customer;
    }

    return {
      ...customer,
      ...fiscal,
      email: customer.email ?? fiscal.invoiceEmail ?? fiscal.fiscalEmail ?? null,
      departamentoId: customer.departamentoId,
      municipioId: customer.municipioId,
      ciudad: customer.ciudad,
      departamento: customer.departamento,
    };
  });
};

const resolveFiscalBadge = (customer: CustomerResponse) => {
  if (customer.isFinalConsumer || customer.fiscalStatus === "NOT_REQUIRED") {
    return {
      label: "Consumidor Final",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }
  if (customer.isDianValidated || customer.fiscalStatus === "VALIDATED") {
    return {
      label: "Validado DIAN",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (customer.fiscalDataSource === "MANUAL") {
    return {
      label: "Manual",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  return {
    label: "Pendiente",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  };
};

const getCustomerDocument = (customer: CustomerResponse) =>
  customer.identificationNumber ??
  customer.documentNumberNormalized ??
  customer.documentNumber ??
  "-";

const CustomersPage = () => {
  const confirm = useConfirm();
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<CustomerFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<CustomerFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fiscalWarning, setFiscalWarning] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResponse | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

  const canCreate = hasPermission(MENU_KEYS.CUSTOMERS, "write");
  const canEdit = hasPermission(MENU_KEYS.CUSTOMERS, "write");
  const canDelete = hasPermission("customers.delete");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setFiscalWarning(null);
    try {
      const [baseResult, fiscalResult] = await Promise.allSettled([
        getCustomers(),
        listElectronicInvoicingCustomers(),
      ]);

      if (baseResult.status === "rejected") {
        throw baseResult.reason;
      }

      if (fiscalResult.status === "fulfilled") {
        setCustomers(mergeFiscalCustomers(baseResult.value, fiscalResult.value));
      } else {
        setCustomers(baseResult.value);
        setFiscalWarning(
          "No se pudieron cargar datos fiscales. Se muestra catalogo basico."
        );
      }
      setHasSearched(true);
    } catch {
      setErrorMessage("No se pudieron cargar los clientes.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      const name = customer.name.toLowerCase();
      const legalName = (customer.legalName ?? "").toLowerCase();
      const documentNumber = getCustomerDocument(customer).toLowerCase();
      const email = (
        customer.invoiceEmail ??
        customer.fiscalEmail ??
        customer.email ??
        ""
      ).toLowerCase();
      return (
        name.includes(query) ||
        legalName.includes(query) ||
        documentNumber.includes(query) ||
        email.includes(query)
      );
    });
  }, [appliedFilters.query, customers]);

  const paginatedCustomers = useMemo(() => {
    const start = page * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadCustomers();
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedCustomer(null);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeForm();
    setActionFeedback({
      title:
        mode === "create"
          ? "Cliente creado correctamente"
          : "Cliente actualizado correctamente",
      description:
        mode === "create"
          ? "El cliente quedo registrado y el listado puede actualizarse."
          : "Los cambios del cliente fueron guardados correctamente.",
      variant: "success",
    });
    if (hasSearched) {
      void loadCustomers();
    }
  };

  const openCreateForm = () => {
    setSelectedCustomer(null);
    setFormMode("create");
  };

  const openEditForm = (customer: CustomerResponse) => {
    setSelectedCustomer(customer);
    setFormMode("edit");
  };

  const isActionMode = formMode !== null;
  const actionTitle = formMode === "edit" ? "Editar cliente" : "Crear cliente";
  const actionDescription =
    formMode === "edit"
      ? "Actualiza los datos comerciales y fiscales del cliente seleccionado."
      : "Registra un cliente nuevo sin mezclar el formulario con el listado.";
  const actionContextLabel =
    formMode === "edit" && selectedCustomer
      ? `${selectedCustomer.name} · ${getCustomerDocument(selectedCustomer)}`
      : undefined;

  const handleDelete = async (customer: CustomerResponse) => {
    if (customer.isFinalConsumer) {
      showToast("Consumidor Final esta protegido.", "warning");
      return;
    }

    try {
      await confirm({
        title: "Confirmar eliminacion",
        description: `Se inactivara el cliente ${customer.name}.`,
        confirmText: "Eliminar cliente",
        variant: "danger",
      });

      await deleteCustomer(customer.id);
      showToast("Cliente eliminado correctamente.", "success");
      if (hasSearched) {
        await loadCustomers();
      }
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      showToast("No se pudo eliminar el cliente.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(actionFeedback)}
        onOpenChange={(open) => {
          if (!open) {
            setActionFeedback(null);
          }
        }}
        title={actionFeedback?.title ?? ""}
        description={actionFeedback?.description}
        confirmText="Entendido"
        variant={actionFeedback?.variant ?? "success"}
        hideCancel
        onConfirm={() => setActionFeedback(null)}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Customers</p>
            <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
            <p className="mt-2 text-sm text-slate-600">
              {isActionMode
                ? "Completa la accion activa y vuelve al listado cuando termines."
                : "Administra clientes, contactos y ubicacion comercial."}
            </p>
          </div>
          {!isActionMode ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadCustomers()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Crear cliente
              </Button>
            ) : null}
          </div>
          ) : null}
        </div>
      </section>

      {formMode ? (
        <FocusActionLayout
          title={actionTitle}
          description={actionDescription}
          contextLabel={actionContextLabel}
          onBack={closeForm}
          onCancel={closeForm}
        >
          <CustomerForm
            mode={formMode}
            customer={selectedCustomer}
            onCancel={closeForm}
            onSuccess={handleFormSuccess}
          />
        </FocusActionLayout>
      ) : null}

      {!isActionMode ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Nombre, documento o email"
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, query: event.target.value }))
            }
          />
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={applyFilters}>
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
      ) : null}

      {!isActionMode && errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {!isActionMode && fiscalWarning ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          {fiscalWarning}
        </section>
      ) : null}

      {!isActionMode && toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      {!isActionMode ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Estado fiscal</th>
                <th className="px-4 py-3 font-medium">Telefono</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Ubicacion</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Cargando clientes...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar clientes.
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No hay clientes para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => {
                  const fiscalBadge = resolveFiscalBadge(customer);
                  return (
                    <tr key={customer.id}>
                      <td className="px-4 py-3 text-slate-900">
                        <div className="font-medium">{customer.name}</div>
                        {customer.legalName && customer.legalName !== customer.name ? (
                          <div className="text-xs text-slate-500">{customer.legalName}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {getCustomerDocument(customer)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${fiscalBadge.className}`}
                        >
                          {fiscalBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {customer.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {customer.invoiceEmail || customer.fiscalEmail || customer.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {[customer.ciudad, customer.departamento].filter(Boolean).join(", ") ||
                          [customer.municipalityCode, customer.departmentCode]
                            .filter(Boolean)
                            .join(", ") ||
                          "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditForm(customer)}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={customer.isFinalConsumer}
                              title={
                                customer.isFinalConsumer
                                  ? "Consumidor Final protegido"
                                  : undefined
                              }
                              onClick={() => void handleDelete(customer)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
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
      ) : null}
    </div>
  );
};

export default CustomersPage;
