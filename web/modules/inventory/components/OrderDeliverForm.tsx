"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import {
  isConfirmCancelledError,
  useConfirm,
} from "../../../hooks/use-confirm";
import {
  deliverOrder,
  getOrderById,
  type OrderDetailResponse,
  type OrderResponse,
} from "../services/order.service";
import { buildConfirmFromApiError } from "../../../lib/api-messages";
import { useAppSelector } from "../../../store/hooks";
import type { OrderPeripheralContext } from "../../../domains/peripherals/order-integration";

type DeliverItemValue = {
  productId: string;
  quantity: string;
};

type DeliverFormErrors = {
  items?: string;
  submit?: string;
};

type OrderDeliverFormProps = {
  orderId: string;
  onCancel: () => void;
  onSuccess: (
    response?: OrderResponse,
    peripheralContext?: OrderPeripheralContext
  ) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

export const OrderDeliverForm = ({
  orderId,
  onCancel,
  onSuccess,
}: OrderDeliverFormProps) => {
  const confirm = useConfirm();
  const authUser = useAppSelector((state) => state.auth.user);
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [values, setValues] = useState<DeliverItemValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<DeliverFormErrors>({});

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await getOrderById(orderId);
        if (!mounted) {
          return;
        }

        setOrder(result);
        setValues(
          result.items.map((item) => ({
            productId: item.productId,
            quantity: "",
          }))
        );
      } catch {
        if (mounted) {
          setLoadError("No se pudo cargar el detalle del pedido.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrder();

    return () => {
      mounted = false;
    };
  }, [orderId]);

  const rows = useMemo(() => {
    if (!order) {
      return [];
    }

    return order.items.map((item, index) => {
      const pending = Math.max(item.orderedQuantity - item.deliveredQuantity, 0);
      return {
        item,
        index,
        pending,
      };
    });
  }, [order]);

  const validate = () => {
    const nextErrors: DeliverFormErrors = {};

    const hasAnyQuantity = values.some((value) => {
      const quantity = Number(value.quantity);
      return Number.isFinite(quantity) && quantity > 0;
    });

    const hasInvalidQuantity = rows.some(({ pending }, index) => {
      const quantity = Number(values[index]?.quantity ?? "");
      if (!Number.isFinite(quantity) || quantity === 0) {
        return false;
      }
      return quantity < 0 || quantity > pending;
    });

    if (!hasAnyQuantity) {
      nextErrors.items = "Debes ingresar al menos una cantidad a entregar.";
    } else if (hasInvalidQuantity) {
      nextErrors.items =
        "Las cantidades a entregar deben ser mayores a 0 y no pueden exceder el pendiente.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        items: rows
          .map(({ item, index, pending }) => {
            const quantity = Number(values[index]?.quantity ?? "");
            if (!Number.isFinite(quantity) || quantity <= 0 || quantity > pending) {
              return null;
            }

            return {
              product_id: item.productId,
              quantity,
            };
          })
          .filter((item): item is { product_id: string; quantity: number } => item !== null),
      };

      await confirm({
        title: "Confirmar entrega",
        description:
          "Se registrará la entrega parcial del pedido y se descontará inventario.",
        confirmText: "Confirmar entrega",
        cancelText: "Volver",
        variant: "warning",
      });

      const response = await deliverOrder(orderId, payload);
      const peripheralContext: OrderPeripheralContext | undefined = order
        ? {
            orderId: response.id,
            orderNumber: response.id,
            documentNumber: response.id,
            date: response.createdAt,
            businessName: response.tenantName ?? authUser?.tenantName ?? "Manus POS",
            branchName: response.branchName ?? order.branchName ?? undefined,
            cashier: authUser?.name ?? authUser?.email ?? undefined,
            customerName: response.customerName ?? order.customerName ?? "Cliente",
            status: response.status,
            items: order.items.map((item) => ({
              name: item.productName ?? item.productId,
              quantity: item.orderedQuantity,
              unitPrice: Number(item.price),
              total: Number(item.subtotal),
            })),
            subtotal: Number(response.total),
            taxes: 0,
            discounts: 0,
            total: Number(response.total),
            balanceDue: response.balanceDue,
            payments: [],
          }
        : undefined;

      onSuccess(response, peripheralContext);
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }

      const dialog = buildConfirmFromApiError(
        error,
        "No se pudo registrar la entrega."
      );
      setErrors({
        submit: dialog.description ?? "No se pudo registrar la entrega.",
      });
      await confirm({
        ...dialog,
        confirmText: "Entendido",
        hideCancel: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Orders</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Entregar pedido</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Registra cantidades entregadas por item sin cerrar automaticamente el pedido.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
          Cargando detalle del pedido...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : order ? (
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.customerName || order.customerId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sucursal</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.branchName || order.branchId || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{order.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{order.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Terminal</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {order.terminalName || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {formatCurrency(Number(order.total))}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Cantidad pedida</th>
                    <th className="px-4 py-3 font-medium">Cantidad entregada</th>
                    <th className="px-4 py-3 font-medium">Pendiente</th>
                    <th className="px-4 py-3 font-medium">Entregar ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ item, index, pending }) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-900 dark:text-white">
                        {item.productName || item.productId}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.orderedQuantity}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{item.deliveredQuantity}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{pending}</td>
                      <td className="px-4 py-3">
                        <Input
                          label=""
                          type="number"
                          min="0"
                          step="0.01"
                          max={String(pending)}
                          placeholder="0"
                          value={values[index]?.quantity ?? ""}
                          onChange={(event) => {
                            const rawValue = event.target.value;
                            const numericValue = Number(rawValue);
                            const nextValue =
                              rawValue === "" || !Number.isFinite(numericValue)
                                ? rawValue
                                : String(Math.min(Math.max(numericValue, 0), pending));
                            setValues((prev) =>
                              prev.map((value, valueIndex) =>
                                valueIndex === index
                                  ? { ...value, quantity: nextValue }
                                  : value
                              )
                            );
                            setErrors((prev) => ({ ...prev, items: undefined, submit: undefined }));
                          }}
                          disabled={pending <= 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {errors.items ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errors.items}
            </div>
          ) : null}

          {errors.submit ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.submit}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting}>
              Guardar entrega
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
