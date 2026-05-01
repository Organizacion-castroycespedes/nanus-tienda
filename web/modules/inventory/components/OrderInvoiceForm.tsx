"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import {
  getCurrentCashSession,
  listPaymentMethods,
} from "../../finance/services/finance.service";
import type { CashSession, PaymentMethod } from "../../finance/types";
import {
  isConfirmCancelledError,
  useConfirm,
} from "../../../hooks/use-confirm";
import {
  getOrderById,
  invoiceOrder,
  type OrderDetailResponse,
} from "../services/order.service";

type OrderInvoiceFormProps = {
  orderId: string;
  onCancel: () => void;
  onSuccess: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

export const OrderInvoiceForm = ({
  orderId,
  onCancel,
  onSuccess,
}: OrderInvoiceFormProps) => {
  const confirm = useConfirm();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [type, setType] = useState<"CASH" | "CREDIT">("CASH");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [result, methods, currentSession] = await Promise.all([
          getOrderById(orderId),
          listPaymentMethods({ active: true }),
          getCurrentCashSession(),
        ]);
        if (!mounted) {
          return;
        }
        setOrder(result);
        setPaymentMethods(methods.filter((method) => method.active));
        setCashSession(currentSession);
        setPaymentMethodId((current) => current || methods[0]?.id || "");
      } catch {
        if (mounted) {
          setLoadError("No se pudo cargar el detalle del pedido o los metodos de pago.");
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

    return order.items
      .map((item) => {
        const invoiceableQuantity = Math.max(item.deliveredQuantity - item.billedQuantity, 0);
        return {
          item,
          invoiceableQuantity,
          subtotal: invoiceableQuantity * item.price,
        };
      })
      .filter((row) => row.invoiceableQuantity > 0);
  }, [order]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.subtotal, 0),
    [rows]
  );

  const selectedMethod =
    paymentMethods.find((method) => method.id === paymentMethodId) ?? null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (rows.length === 0) {
      setSubmitError("No hay productos entregados pendientes por facturar.");
      return;
    }

    if (type === "CASH" && !selectedMethod) {
      setSubmitError("Selecciona un metodo de pago valido.");
      return;
    }

    if (type === "CASH" && selectedMethod?.requiresReference && referenceNumber.trim() === "") {
      setSubmitError("La referencia es obligatoria para este metodo de pago.");
      return;
    }

    if (type === "CASH" && selectedMethod?.tipo === "CASH" && !cashSession?.id) {
      setSubmitError("Necesitas una caja abierta para facturar en efectivo.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await confirm({
        title: "Crear venta",
        description:
          "Se creará la venta usando solo los productos entregados pendientes por facturar.",
        confirmText: "Crear venta",
        cancelText: "Volver",
        variant: "warning",
      });

      await invoiceOrder(orderId, {
        type,
        payments:
          type === "CASH"
            ? [
                {
                  paymentMethodId,
                  amount: total,
                  cashSessionId:
                    selectedMethod?.tipo === "CASH" ? cashSession?.id ?? undefined : undefined,
                  referenceNumber: referenceNumber.trim() || undefined,
                },
              ]
            : [],
      });
      onSuccess();
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return;
      }
      setSubmitError("No se pudo crear la venta desde la orden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Orders</p>
          <h2 className="text-xl font-semibold text-slate-900">Facturar orden</h2>
          <p className="mt-2 text-sm text-slate-600">
            Crea una venta usando solo los productos entregados y no facturados.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
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
                <p className="text-xs uppercase tracking-wide text-slate-500">Cliente</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {order.customerName || order.customerId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Sucursal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {order.branchName || order.branchId || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{order.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Terminal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {order.terminalName || "-"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Entregado</th>
                    <th className="px-4 py-3 font-medium">Facturado</th>
                    <th className="px-4 py-3 font-medium">Facturar ahora</th>
                    <th className="px-4 py-3 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No hay productos entregados pendientes por facturar.
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ item, invoiceableQuantity, subtotal }) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-slate-900">
                          {item.productName || item.productId}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{item.deliveredQuantity}</td>
                        <td className="px-4 py-3 text-slate-700">{item.billedQuantity}</td>
                        <td className="px-4 py-3 text-slate-700">{invoiceableQuantity}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tipo de venta"
              value={type}
              onChange={(event) => setType(event.target.value as "CASH" | "CREDIT")}
            >
              <option value="CASH">CASH</option>
              <option value="CREDIT">CREDIT</option>
            </Select>

            {type === "CASH" ? (
              <Select
                label="Metodo de pago"
                value={paymentMethodId}
                onChange={(event) => setPaymentMethodId(event.target.value)}
              >
                <option value="">Selecciona un metodo</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.nombre}
                  </option>
                ))}
              </Select>
            ) : (
              <Input label="Saldo a credito" value={formatCurrency(total)} disabled readOnly />
            )}

            {type === "CASH" ? (
              <>
                <Input label="Monto" value={formatCurrency(total)} disabled readOnly />
                <Input
                  label={
                    selectedMethod?.requiresReference ? "Referencia obligatoria" : "Referencia"
                  }
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  placeholder="Opcional"
                />
              </>
            ) : null}
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700">
                  Total a facturar
                </p>
                <p className="text-sm text-emerald-900/80">
                  Solo se incluyen cantidades entregadas y pendientes por facturar.
                </p>
              </div>
              <p className="text-xl font-semibold text-emerald-950">{formatCurrency(total)}</p>
            </div>
          </section>

          {submitError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting} disabled={rows.length === 0}>
              Crear venta
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
