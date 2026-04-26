"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { ConfirmationMessage } from "../../../../components/design-system/confirmation-message";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { hasPermission } from "../../../../lib/permissions";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { TaxForm } from "../../../../modules/inventory/components/TaxForm";
import {
  deleteTax,
  getTaxes,
  type TaxResponse,
} from "../../../../modules/inventory/services/tax.service";

type TaxFilters = {
  query: string;
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
    showToast(
      mode === "create" ? "Impuesto creado correctamente." : "Impuesto actualizado correctamente.",
      "success"
    );
    if (hasSearched) {
      void loadTaxes();
    }
  };

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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Inventory</p>
            <h1 className="text-2xl font-semibold text-slate-900">Impuestos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Configura los impuestos disponibles para el catalogo de productos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadTaxes()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button
                onClick={() => {
                  setSelectedTax(null);
                  setFormMode("create");
                }}
              >
                <Plus className="h-4 w-4" />
                Crear impuesto
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {formMode ? (
        <TaxForm
          mode={formMode}
          tax={selectedTax}
          onCancel={closeForm}
          onSuccess={handleFormSuccess}
        />
      ) : null}

      {pendingDeleteTax ? (
        <ConfirmationMessage
          title={`Eliminar impuesto: ${pendingDeleteTax.name}`}
          description="Esta accion eliminara el impuesto seleccionado. Si esta asociado a productos, la base de datos puede rechazar la operacion."
          onDismiss={() => setPendingDeleteTax(null)}
        />
      ) : null}

      {pendingDeleteTax ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setPendingDeleteTax(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} isLoading={isDeleting}>
              Confirmar eliminacion
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
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
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Cargando impuestos...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar impuestos.
                  </td>
                </tr>
              ) : paginatedTaxes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No hay impuestos para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedTaxes.map((tax) => (
                  <tr key={tax.id}>
                    <td className="px-4 py-3 text-slate-900">{tax.name}</td>
                    <td className="px-4 py-3 text-slate-700">{tax.rate * 100}%</td>
                    <td className="px-4 py-3 text-slate-700">
                      {tax.isIncluded ? "Incluido" : "No incluido"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {tax.isActive ? "Activo" : "Inactivo"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTax(tax);
                              setFormMode("edit");
                            }}
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
    </div>
  );
};

export default TaxesPage;
