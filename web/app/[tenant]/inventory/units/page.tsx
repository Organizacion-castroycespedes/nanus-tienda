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
import { UnitForm } from "../../../../modules/inventory/components/UnitForm";
import {
  deleteUnit,
  getUnits,
  type UnitResponse,
} from "../../../../modules/inventory/services/unit.service";

type UnitFilters = {
  query: string;
};

type ActionFeedback = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
};

const defaultFilters: UnitFilters = {
  query: "",
};

const pageSizeOptions = [10, 25, 50];

const UnitsPage = () => {
  const [units, setUnits] = useState<UnitResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<UnitFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<UnitFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitResponse | null>(null);
  const [pendingDeleteUnit, setPendingDeleteUnit] = useState<UnitResponse | null>(null);
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

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getUnits();
      setUnits(result);
      setHasSearched(true);
    } catch {
      setErrorMessage("No se pudieron cargar las unidades.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredUnits = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return units;
    }

    return units.filter((unit) => {
      const name = unit.name.toLowerCase();
      const abbreviation = unit.abbreviation.toLowerCase();
      return name.includes(query) || abbreviation.includes(query);
    });
  }, [appliedFilters.query, units]);

  const paginatedUnits = useMemo(() => {
    const start = page * pageSize;
    return filteredUnits.slice(start, start + pageSize);
  }, [filteredUnits, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadUnits();
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedUnit(null);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeForm();
    setActionFeedback({
      title:
        mode === "create"
          ? "Unidad creada correctamente"
          : "Unidad actualizada correctamente",
      description:
        mode === "create"
          ? "La unidad quedo disponible para el catalogo."
          : "Los cambios de la unidad fueron guardados correctamente.",
      variant: "success",
    });
    if (hasSearched) {
      void loadUnits();
    }
  };

  const openCreateForm = () => {
    setSelectedUnit(null);
    setFormMode("create");
  };

  const openEditForm = (unit: UnitResponse) => {
    setSelectedUnit(unit);
    setFormMode("edit");
  };

  const isActionMode = formMode !== null || pendingDeleteUnit !== null;
  const actionTitle =
    pendingDeleteUnit
      ? "Eliminar unidad"
      : formMode === "edit"
        ? "Editar unidad"
        : "Crear unidad";
  const actionDescription =
    pendingDeleteUnit
      ? "Confirma o cancela la eliminacion antes de volver al listado."
      : formMode === "edit"
        ? "Actualiza la unidad seleccionada sin mezclar el formulario con el listado."
        : "Registra una unidad nueva sin mezclar el formulario con el listado.";
  const actionContextLabel =
    pendingDeleteUnit
      ? `${pendingDeleteUnit.name} · ${pendingDeleteUnit.abbreviation}`
      : formMode === "edit" && selectedUnit
        ? `${selectedUnit.name} · ${selectedUnit.abbreviation}`
        : undefined;

  const handleDelete = async () => {
    if (!pendingDeleteUnit) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUnit(pendingDeleteUnit.id);
      setPendingDeleteUnit(null);
      showToast("Unidad eliminada correctamente.", "success");
      if (hasSearched) {
        await loadUnits();
      }
    } catch {
      showToast("No se pudo eliminar la unidad.", "error");
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Inventory</p>
            <h1 className="text-2xl font-semibold text-slate-900">Unidades</h1>
            <p className="mt-2 text-sm text-slate-600">
              {isActionMode
                ? "Completa la accion activa y vuelve al listado cuando termines."
                : "Administra las unidades de medida disponibles para los productos."}
            </p>
          </div>
          {!isActionMode ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadUnits()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Crear unidad
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
          onBack={pendingDeleteUnit ? () => setPendingDeleteUnit(null) : closeForm}
          onCancel={pendingDeleteUnit ? () => setPendingDeleteUnit(null) : closeForm}
        >
          {formMode ? (
            <UnitForm
              mode={formMode}
              unit={selectedUnit}
              onCancel={closeForm}
              onSuccess={handleFormSuccess}
            />
          ) : null}

          {pendingDeleteUnit ? (
            <div className="space-y-4">
              <ConfirmationMessage
                title={`Eliminar unidad: ${pendingDeleteUnit.name}`}
                description="Esta accion eliminara la unidad seleccionada. Si esta asociada a productos, la base de datos puede rechazar la operacion."
                onDismiss={() => setPendingDeleteUnit(null)}
              />
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setPendingDeleteUnit(null)}
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Nombre o abreviacion"
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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Abreviacion</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Cargando unidades...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar unidades.
                  </td>
                </tr>
              ) : paginatedUnits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No hay unidades para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td className="px-4 py-3 text-slate-900">{unit.name}</td>
                    <td className="px-4 py-3 text-slate-700">{unit.abbreviation}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {unit.isActive ? "Activa" : "Inactiva"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(unit)}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDeleteUnit(unit)}
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

export default UnitsPage;
