"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { ConfirmDialog } from "../../../../components/design-system/confirm-dialog";
import { ConfirmationMessage } from "../../../../components/design-system/confirmation-message";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { hasPermission } from "../../../../lib/permissions";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { FocusActionLayout } from "../../../../modules/inventory/components/FocusActionLayout";
import { TaxForm } from "../../../../modules/inventory/components/TaxForm";
import {
  deleteTax,
  getTaxes,
  type TaxResponse,
} from "../../../../modules/inventory/services/tax.service";

type TaxFilters = {
  query: string;
};

type ActionFeedback = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
};

const defaultFilters: TaxFilters = {
  query: "",
};

const pageSizeOptions = [10, 25, 50];

const TaxesPage = () => {
  const [taxes, setTaxes] = useState<TaxResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<TaxFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<TaxFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedTax, setSelectedTax] = useState<TaxResponse | null>(null);
  const [pendingDeleteTax, setPendingDeleteTax] = useState<TaxResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

  const canCreate = hasPermission("inventory.create");
  const canEdit = hasPermission("inventory.update");
  const canDelete = hasPermission("inventory.delete");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadTaxes = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getTaxes();
      setTaxes(result);
      setHasSearched(true);
    } catch {
      setErrorMessage("No se pudieron cargar los impuestos.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredTaxes = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return taxes;
    }

    return taxes.filter((tax) => {
      const name = tax.name.toLowerCase();
      const rate = String(tax.rate);
      return name.includes(query) || rate.includes(query);
    });
  }, [appliedFilters.query, taxes]);

  const paginatedTaxes = useMemo(() => {
    const start = page * pageSize;
    return filteredTaxes.slice(start, start + pageSize);
  }, [filteredTaxes, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTaxes.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadTaxes();
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedTax(null);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeForm();
    setActionFeedback({
      title:
        mode === "create"
          ? "Impuesto creado correctamente"
          : "Impuesto actualizado correctamente",
      description:
        mode === "create"
          ? "El impuesto quedo disponible para el catalogo."
          : "Los cambios del impuesto fueron guardados correctamente.",
      variant: "success",
    });
    if (hasSearched) {
      void loadTaxes();
    }
  };

  const openCreateForm = () => {
    setSelectedTax(null);
    setFormMode("create");
  };

  const openEditForm = (tax: TaxResponse) => {
    setSelectedTax(tax);
    setFormMode("edit");
  };

  const isActionMode = formMode !== null || pendingDeleteTax !== null;
  const actionTitle =
    pendingDeleteTax
      ? "Eliminar impuesto"
      : formMode === "edit"
        ? "Editar impuesto"
        : "Crear impuesto";
  const actionDescription =
    pendingDeleteTax
      ? "Confirma o cancela la eliminacion antes de volver al listado."
      : formMode === "edit"
        ? "Actualiza el impuesto seleccionado sin mezclar el formulario con el listado."
        : "Registra un impuesto nuevo sin mezclar el formulario con el listado.";
  const actionContextLabel =
    pendingDeleteTax
      ? `${pendingDeleteTax.name} - ${pendingDeleteTax.rate * 100}%`
      : formMode === "edit" && selectedTax
        ? `${selectedTax.name} - ${selectedTax.rate * 100}%`
        : undefined;

  const handleDelete = async () => {
    if (!pendingDeleteTax) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteTax(pendingDeleteTax.id);
      setPendingDeleteTax(null);
      showToast("Impuesto eliminado correctamente.", "success");
      if (hasSearched) {
        await loadTaxes();
      }
    } catch {
      showToast("No se pudo eliminar el impuesto.", "error");
    } finally {
      setIsDeleting(false);
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
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventory</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Impuestos</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {isActionMode
                ? "Completa la accion activa y vuelve al listado cuando termines."
                : "Configura los impuestos disponibles para el catalogo de productos."}
            </p>
          </div>
          {!isActionMode ? (
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" onClick={() => void loadTaxes()} isLoading={loading}>
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </Button>
              {canCreate ? (
                <Button onClick={openCreateForm}>
                  <Plus className="h-4 w-4" />
                  Crear impuesto
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {isActionMode ? (
        <FocusActionLayout
          title={actionTitle}
          description={actionDescription}
          contextLabel={actionContextLabel}
          onBack={pendingDeleteTax ? () => setPendingDeleteTax(null) : closeForm}
          onCancel={pendingDeleteTax ? () => setPendingDeleteTax(null) : closeForm}
        >
          {formMode ? (
            <TaxForm
              mode={formMode}
              tax={selectedTax}
              onCancel={closeForm}
              onSuccess={handleFormSuccess}
            />
          ) : null}

          {pendingDeleteTax ? (
            <div className="space-y-4">
              <ConfirmationMessage
                title={`Eliminar impuesto: ${pendingDeleteTax.name}`}
                description="Esta accion eliminara el impuesto seleccionado. Si esta asociado a productos, la base de datos puede rechazar la operacion."
                onDismiss={() => setPendingDeleteTax(null)}
              />
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setPendingDeleteTax(null)}
                    disabled={isDeleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void handleDelete()}
                    isLoading={isDeleting}
                  >
                    Confirmar eliminacion
                  </Button>
                </div>
              </section>
            </div>
          ) : null}
        </FocusActionLayout>
      ) : null}

      {!isActionMode ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <Input
              label="Buscar"
              placeholder="Nombre o porcentaje"
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

      {!isActionMode && toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      {!isActionMode ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Porcentaje</th>
                <th className="px-4 py-3 font-medium">Incluido</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Cargando impuestos...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Usa el boton Buscar para consultar impuestos.
                  </td>
                </tr>
              ) : paginatedTaxes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    No hay impuestos para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedTaxes.map((tax) => (
                  <tr key={tax.id}>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">{tax.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{tax.rate * 100}%</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {tax.isIncluded ? "Incluido" : "No incluido"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {tax.isActive ? "Activo" : "Inactivo"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(tax)}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDeleteTax(tax)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </Button>
                        ) : null}
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
      ) : null}
    </div>
  );
};

export default TaxesPage;
