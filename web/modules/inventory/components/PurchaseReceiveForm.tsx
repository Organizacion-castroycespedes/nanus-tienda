"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import {
  getPurchaseById,
  receivePurchase,
  type PurchaseDetailResponse,
  type PurchaseResponse,
} from "../services/purchase.service";

type ReceiveItemValue = {
  productId: string;
  quantity: string;
};

type ReceiveFormErrors = {
  items?: string;
  submit?: string;
};

type PurchaseReceiveFormProps = {
  purchaseId: string;
  onCancel: () => void;
  onSuccess: (response?: PurchaseResponse) => void;
  onError?: (error: unknown) => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

export const PurchaseReceiveForm = ({
  purchaseId,
  onCancel,
  onSuccess,
  onError,
}: PurchaseReceiveFormProps) => {
  const [purchase, setPurchase] = useState<PurchaseDetailResponse | null>(null);
  const [values, setValues] = useState<ReceiveItemValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<ReceiveFormErrors>({});

  useEffect(() => {
    let mounted = true;

    const loadPurchase = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await getPurchaseById(purchaseId);
        if (!mounted) {
          return;
        }

        setPurchase(result);
        setValues(
          result.items.map((item) => ({
            productId: item.productId,
            quantity: "",
          }))
        );
      } catch {
        if (mounted) {
          setLoadError("No se pudo cargar el detalle de la compra.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPurchase();

    return () => {
      mounted = false;
    };
  }, [purchaseId]);

  const rows = useMemo(() => {
    if (!purchase) {
      return [];
    }

    return purchase.items.map((item, index) => {
      const pending = Math.max(item.orderedQuantity - item.receivedQuantity, 0);
      return {
        item,
        index,
        pending,
      };
    });
  }, [purchase]);

  const isBlockedStatus =
    purchase?.status === "CANCELLED" ||
    purchase?.status === "RECEIVED" ||
    purchase?.status === "CERRADA_PARCIAL";

  const validate = () => {
    const nextErrors: ReceiveFormErrors = {};

    if (isBlockedStatus) {
      nextErrors.items = "No se puede recibir una compra cancelada, recibida o cerrada parcial.";
      setErrors(nextErrors);
      return false;
    }

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
      nextErrors.items = "Debes ingresar al menos una cantidad a recibir.";
    } else if (hasInvalidQuantity) {
      nextErrors.items =
        "Las cantidades a recibir deben ser mayores a 0 y no pueden exceder el pendiente.";
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

      const response = await receivePurchase(purchaseId, payload);
      onSuccess(response);
    } catch (error) {
      onError?.(error);
      setErrors({
        submit: "No se pudo registrar la recepcion.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Purchases</p>
          <h2 className="text-xl font-semibold text-slate-900">Recibir compra</h2>
          <p className="mt-2 text-sm text-slate-600">
            Registra las cantidades realmente recibidas por producto.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Volver
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Cargando detalle de la compra...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadError}
        </div>
      ) : purchase ? (
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Proveedor</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {purchase.supplierName || purchase.supplierId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Sucursal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {purchase.branchName || purchase.branchId || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{purchase.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Tipo</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{purchase.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Terminal</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {purchase.terminalName || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {formatCurrency(Number(purchase.total))}
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
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Recibido acumulado</th>
                    <th className="px-4 py-3 font-medium">Pendiente</th>
                    <th className="px-4 py-3 font-medium">Recibir ahora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ item, index, pending }) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-900">
                        {item.productName || item.productId}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.orderedQuantity}</td>
                      <td className="px-4 py-3 text-slate-700">{item.receivedQuantity}</td>
                      <td className="px-4 py-3 text-slate-700">{pending}</td>
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
                          disabled={isBlockedStatus || pending <= 0}
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

          {isBlockedStatus ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              No se puede recibir esta compra porque esta cancelada, recibida o cerrada parcial.
            </div>
          ) : null}

          {errors.submit ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.submit}
            </div>
          ) : null}

          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium text-amber-950">Confirmar recepcion</p>
            <p className="mt-1">
              Al guardar, se registrara la recepcion parcial de esta compra y se actualizara
              el inventario con las cantidades ingresadas.
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={isSubmitting} disabled={isBlockedStatus}>
              Confirmar recepcion
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Volver
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
};
