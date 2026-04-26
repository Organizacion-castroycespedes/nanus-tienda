"use client";

import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { SupplierForm } from "../../../modules/inventory/components/SupplierForm";
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

const defaultFilters: SupplierFilters = {
  query: "",
};

const pageSizeOptions = [10, 25, 50];

const SuppliersPage = () => {
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
  const [hasSearched, setHasSearched] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierResponse | null>(null);

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
    try {
      const result = await getSuppliers();
      setSuppliers(result);
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
      const documentNumber = (supplier.documentNumber ?? "").toLowerCase();
      const email = (supplier.email ?? "").toLowerCase();
      return (
        name.includes(query) ||
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
    showToast(
      mode === "create"
        ? "Proveedor creado correctamente."
        : "Proveedor actualizado correctamente.",
      "success"
    );
    if (hasSearched) {
      void loadSuppliers();
    }
  };

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
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Suppliers</p>
            <h1 className="text-2xl font-semibold text-slate-900">Proveedores</h1>
            <p className="mt-2 text-sm text-slate-600">
              Administra proveedores, contactos y ubicacion comercial.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadSuppliers()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button
                onClick={() => {
                  setSelectedSupplier(null);
                  setFormMode("create");
                }}
              >
                <Plus className="h-4 w-4" />
                Crear proveedor
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {formMode ? (
        <SupplierForm
          mode={formMode}
          supplier={selectedSupplier}
          onCancel={closeForm}
          onSuccess={handleFormSuccess}
        />
      ) : null}

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
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Telefono</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Ubicacion</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Cargando proveedores...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar proveedores.
                  </td>
                </tr>
              ) : paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No hay proveedores para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="px-4 py-3 text-slate-900">{supplier.name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {supplier.documentNumber || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{supplier.phone || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{supplier.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {[supplier.ciudad, supplier.departamento].filter(Boolean).join(", ") || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSupplier(supplier);
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
                            onClick={() => void handleDelete(supplier)}
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

export default SuppliersPage;
