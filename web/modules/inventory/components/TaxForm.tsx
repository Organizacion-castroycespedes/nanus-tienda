"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import {
  createTax,
  updateTax,
  type TaxResponse,
} from "../services/tax.service";

type TaxFormValues = {
  name: string;
  rate: string;
  isIncluded: boolean;
  isActive: boolean;
};

type TaxFormErrors = Partial<Record<keyof TaxFormValues, string>> & {
  submit?: string;
};

type TaxFormProps = {
  mode: "create" | "edit";
  tax?: TaxResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
};

const createInitialValues = (tax?: TaxResponse | null): TaxFormValues => ({
  name: tax?.name ?? "",
  rate: tax ? String(tax.rate) : "",
  isIncluded: tax?.isIncluded ?? false,
  isActive: tax?.isActive ?? true,
});

export const TaxForm = ({ mode, tax, onCancel, onSuccess }: TaxFormProps) => {
  const [values, setValues] = useState<TaxFormValues>(createInitialValues(tax));
  const [errors, setErrors] = useState<TaxFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(createInitialValues(tax));
    setErrors({});
  }, [mode, tax]);

  const validate = () => {
    const nextErrors: TaxFormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (values.rate.trim() === "" || Number.isNaN(Number(values.rate))) {
      nextErrors.rate = "La tasa es requerida.";
    } else if (Number(values.rate) < 0) {
      nextErrors.rate = "La tasa debe ser mayor o igual a 0.";
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
      if (mode === "create") {
        await createTax({
          name: values.name.trim(),
          rate: Number(values.rate),
          isIncluded: values.isIncluded,
          isActive: values.isActive,
        });
      } else {
        await updateTax(tax!.id, {
          name: values.name.trim(),
          rate: Number(values.rate),
          isIncluded: values.isIncluded,
          isActive: values.isActive,
        });
      }

      onSuccess(mode);
    } catch {
      setErrors({
        submit:
          mode === "create"
            ? "No se pudo crear el impuesto."
            : "No se pudo actualizar el impuesto.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Inventory</p>
          <h2 className="text-xl font-semibold text-slate-900">
            {mode === "create" ? "Crear impuesto" : "Editar impuesto"}
          </h2>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Nombre"
              required
              value={values.name}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, name: value }));
                setErrors((prev) => ({ ...prev, name: undefined, submit: undefined }));
              }}
            />
            {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Porcentaje"
              required
              type="number"
              min="0"
              step="0.0001"
              value={values.rate}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, rate: value }));
                setErrors((prev) => ({ ...prev, rate: undefined, submit: undefined }));
              }}
              hint="Ejemplo: 0.19 para 19%"
            />
            {errors.rate ? <p className="text-xs text-rose-600">{errors.rate}</p> : null}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isIncluded}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, isIncluded: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          El precio ya incluye impuestos
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, isActive: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          Impuesto activo
        </label>

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Guardar impuesto" : "Actualizar impuesto"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
