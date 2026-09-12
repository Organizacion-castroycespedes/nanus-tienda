"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import type {
  ProductPriceChangeResponse,
  ProductResponse,
} from "../../../domains/products/dtos";
import { changeProductPrice } from "../services/product.service";

type ProductPriceChangeModalProps = {
  open: boolean;
  product: ProductResponse | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: (response: ProductPriceChangeResponse) => void | Promise<void>;
  onError: (error: unknown) => void;
};

type FormErrors = {
  newPrice?: string;
  reason?: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const formatDifference = (value: number) => {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCurrency(value)}`;
};

export const ProductPriceChangeModal = ({
  open,
  product,
  onOpenChange,
  onSuccess,
  onError,
}: ProductPriceChangeModalProps) => {
  const [newPrice, setNewPrice] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !product) {
      setNewPrice("");
      setReason("");
      setErrors({});
      setIsSubmitting(false);
      return;
    }

    setNewPrice(String(product.price));
    setReason("");
    setErrors({});
  }, [open, product]);

  const currentPrice = Number(product?.price ?? 0);
  const parsedNewPrice = Number(newPrice);
  const hasParsedPrice = newPrice.trim() !== "" && Number.isFinite(parsedNewPrice);
  const difference = hasParsedPrice ? parsedNewPrice - currentPrice : 0;

  const warning = useMemo(() => {
    if (!hasParsedPrice) {
      return null;
    }
    if (parsedNewPrice === currentPrice) {
      return "El nuevo precio es igual al precio actual. Cambia el valor para guardar historial util.";
    }
    return null;
  }, [currentPrice, hasParsedPrice, parsedNewPrice]);

  if (!open || !product) {
    return null;
  }

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!hasParsedPrice) {
      nextErrors.newPrice = "El nuevo precio es requerido.";
    } else if (parsedNewPrice < 0) {
      nextErrors.newPrice = "El nuevo precio debe ser mayor o igual a 0.";
    } else if (parsedNewPrice === currentPrice) {
      nextErrors.newPrice = "El nuevo precio debe ser diferente al actual.";
    }

    if (!reason.trim()) {
      nextErrors.reason = "El motivo es requerido.";
    } else if (reason.trim().length < 5) {
      nextErrors.reason = "El motivo debe tener minimo 5 caracteres.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changeProductPrice(product.id, {
        newPrice: parsedNewPrice,
        reason: reason.trim(),
      });
      await onSuccess(result);
      onOpenChange(false);
    } catch (error) {
      onError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:bg-slate-800 dark:border-slate-700"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Cambio de precio
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{product.sku}</p>
          </div>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Actual
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {formatCurrency(currentPrice)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Nuevo
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                {hasParsedPrice ? formatCurrency(parsedNewPrice) : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Diferencia
              </p>
              <p
                className={`mt-1 text-base font-semibold ${
                  difference < 0
                    ? "text-rose-700"
                    : difference > 0
                      ? "text-emerald-700"
                      : "text-slate-700"
                } dark:text-slate-200`}
              >
                {hasParsedPrice ? formatDifference(difference) : "-"}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <Input
              label="Nuevo precio"
              required
              type="number"
              min="0"
              step="0.01"
              value={newPrice}
              onChange={(event) => {
                setNewPrice(event.target.value);
                setErrors((prev) => ({ ...prev, newPrice: undefined }));
              }}
              placeholder="0.00"
            />
            {errors.newPrice ? (
              <p className="text-xs text-rose-600">{errors.newPrice}</p>
            ) : null}
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="font-medium">
              Motivo <span className="text-red-600">*</span>
            </span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setErrors((prev) => ({ ...prev, reason: undefined }));
              }}
              placeholder="Ej: Ajuste por nuevo costo de proveedor"
            />
            {errors.reason ? (
              <span className="text-xs text-rose-600">{errors.reason}</span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Minimo 5 caracteres. Este texto queda en historial.
              </span>
            )}
          </label>

          {warning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {warning}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Confirmar cambio
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
