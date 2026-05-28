"use client";

import {
  Download,
  Eye,
  PackageCheck,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { useInventoryScope } from "../../../hooks/useInventoryScope";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import { hasPermission } from "../../../lib/permissions";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { OrderDeliverForm } from "../../../modules/inventory/components/OrderDeliverForm";
import { OrderForm } from "../../../modules/inventory/components/OrderForm";
import { OrderInvoiceForm } from "../../../modules/inventory/components/OrderInvoiceForm";
import { DocumentPaymentForm } from "../../../modules/finance/components/DocumentPaymentForm";
import {
  cancelOrder,
  getOrderById,
  getOrders,
  type OrderDetailResponse,
  type OrderResponse,
} from "../../../modules/inventory/services/order.service";
import { useAppSelector } from "../../../store/hooks";
import { PdfPreviewModal } from "../../../modules/reporteria/components/PdfPreviewModal";
import { getOrderSaleTicket as getOrderTicket } from "../../../modules/reporteria/services/reporting.service";
import { downloadBlob, getApiErrorMessage } from "../../../modules/reporteria/utils";

type OrderFilters = {
  query: string;
  tenantId: string;
  branchId: string;
  fromDate: string;
  toDate: string;
};

const defaultFilters: OrderFilters = {
  query: "",
  tenantId: "",
  branchId: "",
  fromDate: "",
  toDate: "",
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
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? null);
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
  const [formMode, setFormMode] = useState<
    "create" | "edit" | "deliver" | "invoice" | "payment" | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetailResponse | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<OrderResponse | null>(null);
  const [previewOrder, setPreviewOrder] = useState<OrderResponse | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const { currentTenant } = useInventoryScope();

  const isAdminLikeRole =
    role === "ADMIN" || role === "USER" || role === "SUPER_ADMIN" || role === "SUPER_USER";
  const canCreate = hasPermission("inventory.create") || isAdminLikeRole;
  const canUpdate = hasPermission("inventory.update") || isAdminLikeRole;
  const isGlobalRole = role === "SUPER_ADMIN";

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const closeForms = useCallback(() => {
    setFormMode(null);
    setSelectedOrder(null);
    setSelectedOrderId(null);
    setSelectedPaymentOrder(null);
    setLoadingOrder(false);
  }, []);

  const loadOrders = useCallback(
    async (filters?: OrderFilters) => {
      const activeFilters = filters ?? appliedFilters;
      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await getOrders(
          isGlobalRole
            ? {
                tenantId: activeFilters.tenantId || undefined,
                branchId: activeFilters.branchId || undefined,
                fromDate: activeFilters.fromDate || undefined,
                toDate: activeFilters.toDate || undefined,
              }
            : {
                tenantId: currentTenant ?? undefined,
                branchId: activeFilters.branchId || undefined,
                fromDate: activeFilters.fromDate || undefined,
                toDate: activeFilters.toDate || undefined,
              }
        );
        setOrders(result);
        setHasSearched(true);
      } catch {
        setErrorMessage("No se pudieron cargar los pedidos.");
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [appliedFilters, currentTenant, isGlobalRole]
  );

  const tenantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    orders.forEach((order) => {
      if (order.tenantId && order.tenantName && !seen.has(order.tenantId)) {
        seen.set(order.tenantId, order.tenantName);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [orders]);

  const branchOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    orders
      .filter((order) =>
        draftFilters.tenantId ? order.tenantId === draftFilters.tenantId : true
      )
      .forEach((order) => {
        if (order.branchId && order.branchName) {
          const key = `${order.tenantId}:${order.branchId}`;
          if (!seen.has(key)) {
            seen.set(key, { id: order.branchId, name: order.branchName });
          }
        }
      });
    return Array.from(seen.values());
  }, [draftFilters.tenantId, orders]);

  const filteredOrders = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return orders;
    }

    return orders.filter((order) => {
      const customerName = (order.customerName ?? "").toLowerCase();
      const type = order.type.toLowerCase();
      const status = order.status.toLowerCase();
      const branchName = (order.branchName ?? "").toLowerCase();
      const terminalName = (order.terminalName ?? "").toLowerCase();
      return (
        customerName.includes(query) ||
        type.includes(query) ||
        status.includes(query) ||
        branchName.includes(query) ||
        terminalName.includes(query)
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
    void loadOrders(draftFilters);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const refreshAfterMutation = async (message: string) => {
    closeForms();
    showToast(message, "success");
    if (hasSearched) {
      await loadOrders();
    }
  };

  const openCreateForm = () => {
    setSelectedOrder(null);
    setSelectedOrderId(null);
    setFormMode("create");
  };

  const handleEdit = async (orderId: string) => {
    setLoadingOrder(true);
    setErrorMessage(null);
    try {
      const order = await getOrderById(orderId);
      setSelectedOrder(order);
      setSelectedOrderId(orderId);
      setFormMode("edit");
    } catch {
      showToast("No se pudo cargar el pedido para editar.", "error");
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleOpenDeliver = (orderId: string) => {
    setSelectedOrder(null);
    setSelectedOrderId(orderId);
    setFormMode("deliver");
  };

  const handleOpenInvoice = (orderId: string) => {
    setSelectedOrder(null);
    setSelectedOrderId(orderId);
    setFormMode("invoice");
  };

  const handleOpenPayment = (order: OrderResponse) => {
    setSelectedOrder(null);
    setSelectedOrderId(order.id);
    setSelectedPaymentOrder(order);
    setFormMode("payment");
  };

  const handleCancel = async (order: OrderResponse) => {
    try {
      await confirm({
        title: "Cancelar pedido",
        description: `Se cancelará el pedido de ${order.customerName || order.customerId}.`,
        confirmText: "Cancelar pedido",
        variant: "danger",
      });

      await cancelOrder(order.id);
      await refreshAfterMutation("Pedido cancelado correctamente.");
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      showToast("No se pudo cancelar el pedido.", "error");
    }
  };

  const canDeliverOrder = (status: OrderResponse["status"]) =>
    status === "DRAFT" || status === "CONFIRMED" || status === "PARTIAL";

  const canEditOrder = (status: OrderResponse["status"]) => status === "DRAFT";

  const canCancelOrder = (status: OrderResponse["status"]) => status === "DRAFT";

  const canInvoiceOrder = (order: OrderResponse) =>
    (order.status === "PARTIAL" || order.status === "COMPLETED") &&
    order.billingStatus !== "INVOICED";

  const canRegisterOrderPayment = (order: OrderResponse) =>
    order.status !== "CANCELLED" &&
    order.balanceDue > 0 &&
    order.billingStatus !== "INVOICED";

  const canAccessTicket = (status: OrderResponse["status"]) => status !== "DRAFT";

  const handleDownloadTicket = async (order: OrderResponse) => {
    try {
      const blob = await getOrderTicket(order.id);
      downloadBlob(blob, `ticket-pedido-${order.id}.pdf`);
    } catch (error) {
      showToast(getApiErrorMessage(error, "No se pudo descargar el ticket."), "error");
    }
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 overflow-x-hidden">
      <section className="w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Orders</p>
            <h1 className="text-2xl font-semibold text-slate-900">Pedidos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Consulta pedidos registrados por cliente, sucursal, tipo y estado.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadOrders()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
                Crear pedido
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {formMode === "create" ? (
        <OrderForm
          mode="create"
          onCancel={closeForms}
          onSuccess={() => void refreshAfterMutation("Pedido creado correctamente.")}
        />
      ) : null}

      {formMode === "edit" ? (
        loadingOrder ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Cargando pedido...
          </section>
        ) : selectedOrder ? (
          <OrderForm
            mode="edit"
            order={selectedOrder}
            onCancel={closeForms}
            onSuccess={() => void refreshAfterMutation("Pedido actualizado correctamente.")}
          />
        ) : null
      ) : null}

      {formMode === "deliver" && selectedOrderId ? (
        <OrderDeliverForm
          orderId={selectedOrderId}
          onCancel={closeForms}
          onSuccess={() => void refreshAfterMutation("Entrega registrada correctamente.")}
        />
      ) : null}

      {formMode === "invoice" && selectedOrderId ? (
        <OrderInvoiceForm
          orderId={selectedOrderId}
          onCancel={closeForms}
          onSuccess={() => void refreshAfterMutation("Venta creada correctamente desde la orden.")}
        />
      ) : null}

      {formMode === "payment" && selectedPaymentOrder ? (
        <DocumentPaymentForm
          title="Registrar abono al pedido"
          description="Aplica anticipos o abonos parciales sobre el pedido usando el motor de pagos unificado."
          branchId={selectedPaymentOrder.branchId ?? ""}
          referenceType="SALES_ORDER"
          referenceId={selectedPaymentOrder.id}
          direction="IN"
          total={selectedPaymentOrder.total}
          totalPaid={selectedPaymentOrder.totalPaid}
          balanceDue={selectedPaymentOrder.balanceDue}
          paymentStatus={selectedPaymentOrder.paymentStatus}
          onCancel={closeForms}
          onSuccess={() => void refreshAfterMutation("Abono registrado correctamente.")}
        />
      ) : null}

      <PdfPreviewModal
        isOpen={Boolean(previewOrder)}
        title={previewOrder ? `Ticket de pedido ${previewOrder.id.slice(0, 8)}` : "Ticket de pedido"}
        fileName={previewOrder ? `ticket-pedido-${previewOrder.id}.pdf` : "ticket-pedido.pdf"}
        onClose={() => setPreviewOrder(null)}
        getPdf={() =>
          previewOrder
            ? getOrderTicket(previewOrder.id)
            : Promise.reject(new Error("order ticket not selected"))
        }
      />

      <section className="w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div
          className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <Input
            label="Buscar"
            placeholder="Cliente, sucursal, terminal, tipo o estado"
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, query: event.target.value }))
            }
          />
          {isGlobalRole ? (
            <Select
              label="Tenant"
              value={draftFilters.tenantId}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  tenantId: event.target.value,
                  branchId:
                    prev.tenantId && prev.tenantId !== event.target.value ? "" : prev.branchId,
                }))
              }
            >
              <option value="">Todos</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          ) : null}
          {isGlobalRole ? (
            <Select
              label="Sucursal"
              value={draftFilters.branchId}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, branchId: event.target.value }))
              }
            >
              <option value="">Todas</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Input
            label="Desde"
            type="date"
            value={draftFilters.fromDate}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, fromDate: event.target.value }))
            }
          />
          <Input
            label="Hasta"
            type="date"
            value={draftFilters.toDate}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, toDate: event.target.value }))
            }
          />
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
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={applyFilters} className="w-full sm:w-auto">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
          <Button variant="ghost" onClick={resetFilters} className="w-full sm:w-auto">
            Limpiar
          </Button>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="w-full max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="min-w-[1120px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Terminal</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Pagado</th>
                <th className="px-4 py-3 font-medium">Saldo</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                    Cargando pedidos...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar pedidos.
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-slate-500">
                    No hay pedidos para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 text-slate-900">
                      {order.customerName || order.customerId}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.branchName ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{order.terminalName ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatCurrency(Number(order.totalPaid))}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatCurrency(Number(order.balanceDue))}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.type}</td>
                    <td className="px-4 py-3 text-slate-700">{order.status}</td>
                    <td className="px-4 py-3 text-slate-700">{order.paymentStatus}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const hasRowActions =
                          (canUpdate &&
                            (canEditOrder(order.status) ||
                              canDeliverOrder(order.status) ||
                              canRegisterOrderPayment(order) ||
                              canInvoiceOrder(order) ||
                              canCancelOrder(order.status))) ||
                          canAccessTicket(order.status);

                        return (
                      <div className="flex flex-wrap gap-2">
                        {canUpdate && canEditOrder(order.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleEdit(order.id)}
                            disabled={loadingOrder}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                        ) : null}
                        {canUpdate && canDeliverOrder(order.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDeliver(order.id)}
                          >
                            <PackageCheck className="h-4 w-4" />
                            Entregar
                          </Button>
                        ) : null}
                        {canUpdate && canInvoiceOrder(order) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenInvoice(order.id)}
                          >
                            <Receipt className="h-4 w-4" />
                            Facturar
                          </Button>
                        ) : null}
                        {canUpdate && canRegisterOrderPayment(order) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenPayment(order)}
                          >
                            <Receipt className="h-4 w-4" />
                            Abonar
                          </Button>
                        ) : null}
                        {canUpdate && canCancelOrder(order.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleCancel(order)}
                          >
                            <XCircle className="h-4 w-4" />
                            Cancelar
                          </Button>
                        ) : null}
                        {canAccessTicket(order.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewOrder(order)}
                          >
                            <Eye className="h-4 w-4" />
                            Ver Ticket
                          </Button>
                        ) : null}
                        {canAccessTicket(order.status) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDownloadTicket(order)}
                          >
                            <Download className="h-4 w-4" />
                            Descargar
                          </Button>
                        ) : null}
                        {!hasRowActions ? (
                          <span className="text-xs text-slate-400">Sin acciones</span>
                        ) : null}
                      </div>
                        );
                      })()}
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

