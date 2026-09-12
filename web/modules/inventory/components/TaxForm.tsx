"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import {
  createTax,
  getTaxCatalogs,
  updateTax,
  type TaxCatalogsResponse,
  type TaxResponse,
} from "../services/tax.service";

type TaxFormValues = {
  name: string;
  rate: string;
  isIncluded: boolean;
  isActive: boolean;
  taxTypeId: string;
  calculationMethodId: string;
  taxBaseTypeId: string;
  fixedAmount: string;
  baseQuantity: string;
  baseUnitCode: string;
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
  taxTypeId: tax?.taxTypeId ?? "",
  calculationMethodId: tax?.calculationMethodId ?? "",
  taxBaseTypeId: tax?.taxBaseTypeId ?? "",
  fixedAmount: "",
  baseQuantity: "",
  baseUnitCode: "ML",
});

export const TaxForm = ({ mode, tax, onCancel, onSuccess }: TaxFormProps) => {
  const [values, setValues] = useState<TaxFormValues>(createInitialValues(tax));
  const [errors, setErrors] = useState<TaxFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogs, setCatalogs] = useState<TaxCatalogsResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    setValues(createInitialValues(tax));
    setErrors({});
  }, [mode, tax]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await getTaxCatalogs();
        if (!cancelled) {
          setCatalogs(response);
          setCatalogError(null);
        }
      } catch {
        if (!cancelled) {
          setCatalogError("No se pudieron cargar los catalogos fiscales.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMethod = useMemo(
    () =>
      catalogs?.calculationMethods.find(
        (item) => item.id === values.calculationMethodId
      ) ?? null,
    [catalogs, values.calculationMethodId]
  );

  const isPercentageMethod =
    !selectedMethod || selectedMethod.code === "PERCENTAGE";

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
    if (!values.taxTypeId) {
      nextErrors.taxTypeId = "El tipo DIAN es requerido.";
    }
    if (!values.calculationMethodId) {
      nextErrors.calculationMethodId = "El metodo de calculo es requerido.";
    }
    if (!values.taxBaseTypeId) {
      nextErrors.taxBaseTypeId = "El tipo de base es requerido.";
    }
    if (
      !isPercentageMethod &&
      values.fixedAmount.trim() !== "" &&
      (Number.isNaN(Number(values.fixedAmount)) || Number(values.fixedAmount) < 0)
    ) {
      nextErrors.fixedAmount = "El valor fijo debe ser mayor o igual a 0.";
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

    const payload = {
      name: values.name.trim(),
      rate: Number(values.rate),
      isIncluded: values.isIncluded,
      isActive: values.isActive,
      taxTypeId: values.taxTypeId || null,
      calculationMethodId: values.calculationMethodId || null,
      taxBaseTypeId: values.taxBaseTypeId || null,
      percentageRate: isPercentageMethod ? Number(values.rate) : null,
      fixedAmount:
        !isPercentageMethod && values.fixedAmount.trim() !== ""
          ? Number(values.fixedAmount)
          : null,
      baseQuantity:
        values.baseQuantity.trim() !== ""
          ? Number(values.baseQuantity)
          : null,
      baseUnitCode: values.baseUnitCode.trim() || null,
      effectiveFrom: "2000-01-01",
    };

    try {
      if (mode === "create") {
        await createTax(payload);
      } else {
        await updateTax(tax!.id, payload);
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventory</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {mode === "create" ? "Crear impuesto" : "Editar impuesto"}
          </h2>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        {catalogError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {catalogError}
          </div>
        ) : null}

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
              label={isPercentageMethod ? "Porcentaje" : "Rate puente (POS)"}
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
              hint={
                isPercentageMethod
                  ? "Ejemplo: 0.19 para 19%"
                  : "Para ICL/ADV use 0. El cobro real llega en la fase del motor."
              }
            />
            {errors.rate ? <p className="text-xs text-rose-600">{errors.rate}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Select
              label="Tipo DIAN"
              required
              value={values.taxTypeId}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, taxTypeId: event.target.value }))
              }
            >
              <option value="">Selecciona tipo</option>
              {(catalogs?.types ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code}
                  {item.dianCode ? ` (${item.dianCode})` : ""} — {item.name}
                </option>
              ))}
            </Select>
            {errors.taxTypeId ? (
              <p className="text-xs text-rose-600">{errors.taxTypeId}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Select
              label="Metodo de calculo"
              required
              value={values.calculationMethodId}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  calculationMethodId: event.target.value,
                }))
              }
            >
              <option value="">Selecciona metodo</option>
              {(catalogs?.calculationMethods ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </Select>
            {errors.calculationMethodId ? (
              <p className="text-xs text-rose-600">{errors.calculationMethodId}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Select
              label="Tipo de base"
              required
              value={values.taxBaseTypeId}
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  taxBaseTypeId: event.target.value,
                }))
              }
            >
              <option value="">Selecciona base</option>
              {(catalogs?.baseTypes ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </Select>
            {errors.taxBaseTypeId ? (
              <p className="text-xs text-rose-600">{errors.taxBaseTypeId}</p>
            ) : null}
          </div>
        </div>

        {!isPercentageMethod ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <Input
                label="Valor fijo vigente"
                type="number"
                min="0"
                step="0.0001"
                value={values.fixedAmount}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    fixedAmount: event.target.value,
                  }))
                }
                hint="Tarifa anual en tax_rates"
              />
              {errors.fixedAmount ? (
                <p className="text-xs text-rose-600">{errors.fixedAmount}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Input
                label="Cantidad base"
                type="number"
                min="0"
                step="0.001"
                value={values.baseQuantity}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    baseQuantity: event.target.value,
                  }))
                }
                hint="Ej: 750"
              />
            </div>
            <div className="space-y-1">
              <Input
                label="Unidad base"
                value={values.baseUnitCode}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    baseUnitCode: event.target.value,
                  }))
                }
                hint="Ej: ML"
              />
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
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

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
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
