"use client";

import { PackageCheck, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { hasPermission } from "../../../lib/permissions";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { PurchaseForm } from "../../../modules/inventory/components/PurchaseForm";
import { PurchaseReceiveForm } from "../../../modules/inventory/components/PurchaseReceiveForm";
import {
  getPurchases,
  type PurchaseResponse,
} from "../../../modules/inventory/services/purchase.service";

type PurchaseFilters = {
  query: string;
};

const defaultFilters: PurchaseFilters = {
  query: "",
};

const pageSizeOptions = [10, 25, 50];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

const PurchasesPage = () => {
  const [purchases, setPurchases] = useState<PurchaseResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<PurchaseFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<PurchaseFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [receivingPurchaseId, setReceivingPurchaseId] = useState<string | null>(null);

  const canCreate = hasPermission("inventory.create");
  const canReceive = hasPermission("inventory.update");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getPurchases();
      setPurchases(result);
      setHasSearched(true);
    } catch {
      setErrorMessage("No se pudieron cargar las compras.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredPurchases = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return purchases;
    }

    return purchases.filter((purchase) => {
      const supplierName = (purchase.supplierName ?? "").toLowerCase();
      const type = purchase.type.toLowerCase();
      const status = purchase.status.toLowerCase();
      return (
        supplierName.includes(query) ||
        type.includes(query) ||
        status.includes(query)
      );
    });
  }, [appliedFilters.query, purchases]);

  const paginatedPurchases = useMemo(() => {
    const start = page * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadPurchases();
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const handleCreateSuccess = async () => {
    setShowCreateForm(false);
    showToast("Compra creada correctamente.", "success");
    if (hasSearched) {
      await loadPurchases();
    }
  };

  const handleReceiveSuccess = async () => {
    setReceivingPurchaseId(null);
    showToast("Recepcion registrada correctamente.", "success");
    if (hasSearched) {
      await loadPurchases();
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Purchases</p>
            <h1 className="text-2xl font-semibold text-slate-900">Compras</h1>
            <p className="mt-2 text-sm text-slate-600">
              Consulta compras registradas por proveedor, tipo y estado.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadPurchases()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" />
                Crear compra
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {showCreateForm ? (
        <PurchaseForm
          onCancel={() => setShowCreateForm(false)}
          onSuccess={() => void handleCreateSuccess()}
        />
      ) : null}

      {receivingPurchaseId ? (
        <PurchaseReceiveForm
          purchaseId={receivingPurchaseId}
          onCancel={() => setReceivingPurchaseId(null)}
          onSuccess={() => void handleReceiveSuccess()}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Proveedor, tipo o estado"
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
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Cargando compras...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar compras.
                  </td>
                </tr>
              ) : paginatedPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No hay compras para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-4 py-3 text-slate-900">
                      {purchase.supplierName || purchase.supplierId}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatCurrency(Number(purchase.total))}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{purchase.type}</td>
                    <td className="px-4 py-3 text-slate-700">{purchase.status}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(purchase.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {canReceive && purchase.status !== "CANCELLED" && purchase.status !== "RECEIVED" ? (
                        <Button
                          variant="ghost"
                          onClick={() => setReceivingPurchaseId(purchase.id)}
                        >
                          <PackageCheck className="h-4 w-4" />
                          Recibir
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Sin acciones</span>
                      )}
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

export default PurchasesPage;
