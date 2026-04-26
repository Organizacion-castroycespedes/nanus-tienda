"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import type { ProductResponse } from "../../../domains/products/dtos";
import { createStockAdjustment } from "../services/stock-adjustment.service";

type StockAdjustmentValues = {
  type: "IN" | "OUT";
  quantity: string;
  reason: string;
};

type StockAdjustmentErrors = Partial<Record<keyof StockAdjustmentValues, string>> & {
  submit?: string;
};

type StockAdjustmentFormProps = {
  product: ProductResponse;
  onCancel: () => void;
  onSuccess: () => void;
};

const initialValues: StockAdjustmentValues = {
  type: "IN",
  quantity: "",
  reason: "",
};

export const StockAdjustmentForm = ({
  product,
  onCancel,
  onSuccess,
}: StockAdjustmentFormProps) => {
  const [values, setValues] = useState<StockAdjustmentValues>(initialValues);
  const [errors, setErrors] = useState<StockAdjustmentErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(initialValues);
    setErrors({});
  }, [product.id]);

  const validate = () => {
    const nextErrors: StockAdjustmentErrors = {};

    if (!values.type) {
      nextErrors.type = "El tipo es requerido.";
    }
    if (values.quantity.trim() === "" || Number.isNaN(Number(values.quantity))) {
      nextErrors.quantity = "La cantidad es requerida.";
    } else if (Number(values.quantity) <= 0) {
      nextErrors.quantity = "La cantidad debe ser mayor a 0.";
    }
    if (!values.reason.trim()) {
      nextErrors.reason = "El motivo es requerido.";
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
      await createStockAdjustment({
        productId: product.id,
        type: values.type,
        quantity: Number(values.quantity),
        reason: values.reason.trim(),
      });
      onSuccess();
    } catch {
      setErrors({
        submit: "No se pudo registrar el ajuste de stock.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Stock</p>
          <h2 className="text-xl font-semibold text-slate-900">Ajustar stock</h2>
          <p className="mt-2 text-sm text-slate-600">
            Producto: <span className="font-medium text-slate-900">{product.name}</span>
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Select
              label="Tipo"
              value={values.type}
              onChange={(event) => {
                const value = event.target.value as "IN" | "OUT";
                setValues((prev) => ({ ...prev, type: value }));
                setErrors((prev) => ({ ...prev, type: undefined, submit: undefined }));
              }}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </Select>
            {errors.type ? <p className="text-xs text-rose-600">{errors.type}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Cantidad"
              required
              type="number"
              min="0"
              step="0.01"
              value={values.quantity}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, quantity: value }));
                setErrors((prev) => ({ ...prev, quantity: undefined, submit: undefined }));
              }}
            />
            {errors.quantity ? <p className="text-xs text-rose-600">{errors.quantity}</p> : null}
          </div>

          <div className="space-y-1 md:col-span-3">
            <Input
              label="Motivo"
              required
              value={values.reason}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, reason: value }));
                setErrors((prev) => ({ ...prev, reason: undefined, submit: undefined }));
              }}
              placeholder="Ej: Ajuste manual de inventario"
            />
            {errors.reason ? <p className="text-xs text-rose-600">{errors.reason}</p> : null}
          </div>
        </div>

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            Guardar ajuste
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
