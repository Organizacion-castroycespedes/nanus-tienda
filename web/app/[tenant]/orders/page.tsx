"use client";

import { CheckCircle2, Plus, RefreshCw, Search, XCircle } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import { hasPermission } from "../../../lib/permissions";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { OrderForm } from "../../../modules/inventory/components/OrderForm";
import {
  cancelOrder,
  confirmOrder,
  getOrders,
  type OrderResponse,
} from "../../../modules/inventory/services/order.service";

type OrderFilters = {
  query: string;
};

const defaultFilters: OrderFilters = {
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

const OrdersPage = () => {
  const confirm = useConfirm();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<OrderFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<OrderFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const canCreate = hasPermission("inventory.create");
  const canUpdate = hasPermission("inventory.update");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getOrders();
      setOrders(result);
      setHasSearched(true);
    } catch {
      setErrorMessage("No se pudieron cargar los pedidos.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredOrders = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return orders;
    }

    return orders.filter((order) => {
      const customerName = (order.customerName ?? "").toLowerCase();
      const type = order.type.toLowerCase();
      const status = order.status.toLowerCase();
      return (
        customerName.includes(query) ||
        type.includes(query) ||
        status.includes(query)
      );
    });
  }, [appliedFilters.query, orders]);

  const paginatedOrders = useMemo(() => {
    const start = page * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadOrders();
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const handleCreateSuccess = async () => {
    setShowCreateForm(false);
    showToast("Pedido creado correctamente.", "success");
    if (hasSearched) {
      await loadOrders();
    }
  };

  const handleConfirm = async (order: OrderResponse) => {
    try {
      await confirm({
        title: "Confirmar pedido",
        description: `Se confirmara el pedido de ${order.customerName || order.customerId}.`,
        confirmText: "Confirmar pedido",
        variant: "warning",
      });

      await confirmOrder(order.id);
      showToast("Pedido confirmado correctamente.", "success");
      if (hasSearched) {
        await loadOrders();
      }
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      showToast("No se pudo confirmar el pedido.", "error");
    }
  };

  const handleCancel = async (order: OrderResponse) => {
    try {
      await confirm({
        title: "Cancelar pedido",
        description: `Se cancelara el pedido de ${order.customerName || order.customerId}.`,
        confirmText: "Cancelar pedido",
        variant: "danger",
      });

      await cancelOrder(order.id);
      showToast("Pedido cancelado correctamente.", "success");
      if (hasSearched) {
        await loadOrders();
      }
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      showToast("No se pudo cancelar el pedido.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Orders</p>
            <h1 className="text-2xl font-semibold text-slate-900">Pedidos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Consulta pedidos registrados por cliente, tipo y estado.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadOrders()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4" />
                Crear pedido
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {showCreateForm ? (
        <OrderForm
          onCancel={() => setShowCreateForm(false)}
          onSuccess={() => void handleCreateSuccess()}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Cliente, tipo o estado"
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
                <th className="px-4 py-3 font-medium">Cliente</th>
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
                    Cargando pedidos...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar pedidos.
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No hay pedidos para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-slate-900">
                      {order.customerName || order.customerId}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.type}</td>
                    <td className="px-4 py-3 text-slate-700">{order.status}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canUpdate && order.status === "DRAFT" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleConfirm(order)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Confirmar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleCancel(order)}
                            >
                              <XCircle className="h-4 w-4" />
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Sin acciones</span>
                        )}
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

export default OrdersPage;
