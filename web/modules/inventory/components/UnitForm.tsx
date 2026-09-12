"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import {
  createUnit,
  updateUnit,
  type UnitResponse,
} from "../services/unit.service";

type UnitFormValues = {
  name: string;
  abbreviation: string;
  isActive: boolean;
};

type UnitFormErrors = Partial<Record<keyof UnitFormValues, string>> & {
  submit?: string;
};

type UnitFormProps = {
  mode: "create" | "edit";
  unit?: UnitResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
};

const createInitialValues = (unit?: UnitResponse | null): UnitFormValues => ({
  name: unit?.name ?? "",
  abbreviation: unit?.abbreviation ?? "",
  isActive: unit?.isActive ?? true,
});

export const UnitForm = ({ mode, unit, onCancel, onSuccess }: UnitFormProps) => {
  const [values, setValues] = useState<UnitFormValues>(createInitialValues(unit));
  const [errors, setErrors] = useState<UnitFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(createInitialValues(unit));
    setErrors({});
  }, [mode, unit]);

  const validate = () => {
    const nextErrors: UnitFormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (!values.abbreviation.trim()) {
      nextErrors.abbreviation = "La abreviacion es requerida.";
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
        await createUnit({
          name: values.name.trim(),
          abbreviation: values.abbreviation.trim().toUpperCase(),
          isActive: values.isActive,
        });
      } else {
        await updateUnit(unit!.id, {
          name: values.name.trim(),
          abbreviation: values.abbreviation.trim().toUpperCase(),
          isActive: values.isActive,
        });
      }

      onSuccess(mode);
    } catch {
      setErrors({
        submit:
          mode === "create"
            ? "No se pudo crear la unidad."
            : "No se pudo actualizar la unidad.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventory</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {mode === "create" ? "Crear unidad" : "Editar unidad"}
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
              label="Abreviacion"
              required
              value={values.abbreviation}
              onChange={(event) => {
                const value = event.target.value;
                setValues((prev) => ({ ...prev, abbreviation: value }));
                setErrors((prev) => ({
                  ...prev,
                  abbreviation: undefined,
                  submit: undefined,
                }));
              }}
            />
            {errors.abbreviation ? (
              <p className="text-xs text-rose-600">{errors.abbreviation}</p>
            ) : null}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, isActive: event.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          Unidad activa
        </label>

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Guardar unidad" : "Actualizar unidad"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
