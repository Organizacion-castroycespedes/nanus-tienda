"use client";

import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "../../../components/design-system/Button";
import { ConfirmDialog } from "../../../components/design-system/confirm-dialog";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { FocusActionLayout } from "../../../modules/inventory/components/FocusActionLayout";
import { SupplierForm } from "../../../modules/inventory/components/SupplierForm";
import {
  listElectronicInvoicingSuppliers,
  type ElectronicInvoicingSupplier,
} from "../../../modules/electronic-invoicing/services/supplier.service";
import {
  deleteSupplier,
  getSuppliers,
  type SupplierResponse,
} from "../../../modules/inventory/services/supplier.service";
import { useConfirm, isConfirmCancelledError } from "../../../hooks/use-confirm";
import { hasPermission } from "../../../lib/permissions";
import { useAutoClearState } from "../../../lib/useAutoClearState";

type SupplierFilters = {
  query: string;
};

type ActionFeedback = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
};

const defaultFilters: SupplierFilters = {
  query: "",
};

const pageSizeOptions = [10, 25, 50];

const mergeFiscalSuppliers = (
  baseSuppliers: SupplierResponse[],
  fiscalSuppliers: ElectronicInvoicingSupplier[]
): SupplierResponse[] => {
  const fiscalById = new Map(
    fiscalSuppliers.map((supplier) => [supplier.id, supplier])
  );

  return baseSuppliers.map((supplier) => {
    const fiscal = fiscalById.get(supplier.id);
    if (!fiscal) {
      return supplier;
    }

    return {
      ...supplier,
      ...fiscal,
      email: supplier.email ?? fiscal.invoiceEmail ?? fiscal.fiscalEmail ?? null,
      departamentoId: supplier.departamentoId,
      municipioId: supplier.municipioId,
      ciudad: supplier.ciudad,
      departamento: supplier.departamento,
    };
  });
};

const resolveFiscalBadge = (supplier: SupplierResponse) => {
  if (supplier.isDianValidated || supplier.fiscalStatus === "VALIDATED") {
    return {
      label: "Validado fiscal",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (supplier.fiscalStatus === "FAILED") {
    return {
      label: "Fallido",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (supplier.fiscalDataSource === "MANUAL") {
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

const getSupplierDocument = (supplier: SupplierResponse) =>
  supplier.identificationNumber ??
  supplier.documentNumberNormalized ??
  supplier.documentNumber ??
  "-";

const SuppliersPage = () => {
  const searchParams = useSearchParams();
  const requestedSupplierId = searchParams.get("editSupplierId");
  const confirm = useConfirm();
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<SupplierFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<SupplierFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fiscalWarning, setFiscalWarning] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierResponse | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

  const canCreate = hasPermission("inventory.create");
  const canEdit = hasPermission("inventory.update");
  const canDelete = hasPermission("inventory.delete");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setFiscalWarning(null);
    try {
      const [baseResult, fiscalResult] = await Promise.allSettled([
        getSuppliers(),
        listElectronicInvoicingSuppliers(),
      ]);

      if (baseResult.status === "rejected") {
        throw baseResult.reason;
      }

      if (fiscalResult.status === "fulfilled") {
        setSuppliers(mergeFiscalSuppliers(baseResult.value, fiscalResult.value));
      } else {
        setSuppliers(baseResult.value);
        setFiscalWarning(
          "No se pudieron cargar datos fiscales. Se muestra catalogo basico."
        );
      }
      setHasSearched(true);
    } catch {
      setErrorMessage("No se pudieron cargar los proveedores.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredSuppliers = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return suppliers;
    }

    return suppliers.filter((supplier) => {
      const name = supplier.name.toLowerCase();
      const legalName = (supplier.legalName ?? "").toLowerCase();
      const documentNumber = getSupplierDocument(supplier).toLowerCase();
      const email = (
        supplier.invoiceEmail ??
        supplier.fiscalEmail ??
        supplier.email ??
        ""
      ).toLowerCase();
      return (
        name.includes(query) ||
        legalName.includes(query) ||
        documentNumber.includes(query) ||
        email.includes(query)
      );
    });
  }, [appliedFilters.query, suppliers]);

  const paginatedSuppliers = useMemo(() => {
    const start = page * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadSuppliers();
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedSupplier(null);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeForm();
    setActionFeedback({
      title:
        mode === "create"
          ? "Proveedor creado correctamente"
          : "Proveedor actualizado correctamente",
      description:
        mode === "create"
          ? "El proveedor quedo registrado y disponible para compras."
          : "Los cambios del proveedor fueron guardados correctamente.",
      variant: "success",
    });
    if (hasSearched) {
      void loadSuppliers();
    }
  };

  const openCreateForm = () => {
    setSelectedSupplier(null);
    setFormMode("create");
  };

  const openEditForm = (supplier: SupplierResponse) => {
    setSelectedSupplier(supplier);
    setFormMode("edit");
  };

  useEffect(() => {
    if (!requestedSupplierId || !suppliers.length) return;
    const supplier = suppliers.find((item) => item.id === requestedSupplierId);
    if (supplier) openEditForm(supplier);
  }, [requestedSupplierId, suppliers]);

  const isActionMode = formMode !== null;
  const actionTitle = formMode === "edit" ? "Editar proveedor" : "Crear proveedor";
  const actionDescription =
    formMode === "edit"
      ? "Actualiza los datos comerciales y fiscales del proveedor seleccionado."
      : "Registra un proveedor nuevo sin mezclar el formulario con el listado.";
  const actionContextLabel =
    formMode === "edit" && selectedSupplier
      ? `${selectedSupplier.name} · ${getSupplierDocument(selectedSupplier)}`
      : undefined;

  const handleDelete = async (supplier: SupplierResponse) => {
    try {
      await confirm({
        title: "Confirmar eliminacion",
        description: `Se inactivara el proveedor ${supplier.name}.`,
        confirmText: "Eliminar proveedor",
        variant: "danger",
      });

      await deleteSupplier(supplier.id);
      showToast("Proveedor eliminado correctamente.", "success");
      if (hasSearched) {
        await loadSuppliers();
      }
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      showToast("No se pudo eliminar el proveedor.", "error");
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Suppliers</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Proveedores</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {isActionMode
                ? "Completa la accion activa y vuelve al listado cuando termines."
                : "Administra proveedores, contactos y ubicacion comercial."}
            </p>
          </div>
          {!isActionMode ? (
          <div className="flex flex-wrap gap-3">
            <Link href="fiscal-review"><Button variant="secondary">Revisión fiscal</Button></Link>
            <Button variant="ghost" onClick={() => void loadSuppliers()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Crear proveedor
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
          <SupplierForm
            mode={formMode}
            supplier={selectedSupplier}
            onCancel={closeForm}
            onSuccess={handleFormSuccess}
          />
        </FocusActionLayout>
      ) : null}

      {!isActionMode ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
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
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Cargando proveedores...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Usa el boton Buscar para consultar proveedores.
                  </td>
                </tr>
              ) : paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay proveedores para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((supplier) => {
                  const fiscalBadge = resolveFiscalBadge(supplier);
                  return (
                    <tr key={supplier.id}>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.legalName && supplier.legalName !== supplier.name ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{supplier.legalName}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {getSupplierDocument(supplier)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${fiscalBadge.className}`}
                        >
                          {fiscalBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {supplier.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {supplier.invoiceEmail || supplier.fiscalEmail || supplier.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {[supplier.ciudad, supplier.departamento].filter(Boolean).join(", ") ||
                          [supplier.municipalityCode, supplier.departmentCode]
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
                              onClick={() => openEditForm(supplier)}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDelete(supplier)}
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
      ) : null}
    </div>
  );
};

export default SuppliersPage;
