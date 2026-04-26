"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import type { ProductResponse } from "../../../domains/products/dtos";
import {
  getTaxes,
  type TaxResponse,
} from "../services/tax.service";
import {
  getUnits,
  type UnitResponse,
} from "../services/unit.service";
import {
  createProduct,
  updateProduct,
  type CreateProductPayload,
  type UpdateProductPayload,
} from "../services/product.service";

type ProductOption = {
  id: string;
  label: string;
};

type TaxInfo = {
  id: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  label: string;
};

type ProductFormValues = {
  name: string;
  sku: string;
  price: string;
  cost: string;
  unitId: string;
  taxId: string;
  isActive: boolean;
};

type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>> & {
  submit?: string;
};

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
};

const createInitialValues = (product?: ProductResponse | null): ProductFormValues => ({
  name: product?.name ?? "",
  sku: product?.sku ?? "",
  price: product ? String(product.price) : "",
  cost: product ? String(product.cost) : "",
  unitId: product?.unitId ?? "",
  taxId: product?.taxId ?? "",
  isActive: product?.isActive ?? true,
});

const isValidNumber = (value: string) => value.trim() !== "" && !Number.isNaN(Number(value));

export const ProductForm = ({
  mode,
  product,
  onCancel,
  onSuccess,
}: ProductFormProps) => {
  const [values, setValues] = useState<ProductFormValues>(createInitialValues(product));
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unitOptions, setUnitOptions] = useState<ProductOption[]>([]);
  const [taxOptions, setTaxOptions] = useState<TaxInfo[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    setValues(createInitialValues(product));
    setErrors({});
  }, [mode, product]);

  useEffect(() => {
    let mounted = true;

    const loadCatalogs = async () => {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const [units, taxes] = await Promise.all([getUnits(), getTaxes()]);

        if (!mounted) {
          return;
        }

        setUnitOptions(
          units.map((unit: UnitResponse) => ({
            id: unit.id,
            label: `${unit.name} (${unit.abbreviation})`,
          }))
        );
        setTaxOptions(
          taxes.map((tax: TaxResponse) => ({
            id: tax.id,
            name: tax.name,
            rate: Number(tax.rate),
            isIncluded: tax.isIncluded,
            label: `${tax.name} (${Number(tax.rate) * 100}%)`,
          }))
        );
      } catch {
        if (!mounted) {
          return;
        }
        setCatalogError("No se pudieron cargar unidades e impuestos.");
      } finally {
        if (mounted) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalogs();

    return () => {
      mounted = false;
    };
  }, []);

  const setFieldValue = <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  };

  const selectedTax = taxOptions.find((tax) => tax.id === values.taxId) ?? null;

  const validate = () => {
    const nextErrors: ProductFormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (!values.sku.trim()) {
      nextErrors.sku = "El SKU es requerido.";
    }
    if (!isValidNumber(values.price)) {
      nextErrors.price = "El precio es requerido.";
    } else if (Number(values.price) <= 0) {
      nextErrors.price = "El precio debe ser mayor a 0.";
    }
    if (!isValidNumber(values.cost)) {
      nextErrors.cost = "El costo es requerido.";
    } else if (Number(values.cost) < 0) {
      nextErrors.cost = "El costo debe ser mayor o igual a 0.";
    }
    if (!values.unitId) {
      nextErrors.unitId = "Debes seleccionar una unidad.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const payload: CreateProductPayload = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      price: Number(values.price),
      cost: Number(values.cost),
      unitId: values.unitId,
      taxId: values.taxId || null,
      isActive: values.isActive,
    };

    setIsSubmitting(true);
    setErrors({});

    try {
      const savedProduct =
        mode === "create"
          ? await createProduct(payload)
          : await updateProduct(product!.id, payload as UpdateProductPayload);

      void savedProduct;
      onSuccess(mode);
    } catch {
      setErrors({
        submit:
          mode === "create"
            ? "No se pudo crear el producto."
            : "No se pudo actualizar el producto.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Producto</p>
          <h2 className="text-xl font-semibold text-slate-900">
            {mode === "create" ? "Crear producto" : "Editar producto"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Completa los campos requeridos para guardar el producto.
          </p>
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
              onChange={(event) => setFieldValue("name", event.target.value)}
              placeholder="Ej: Arroz premium"
            />
            {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="SKU"
              required
              value={values.sku}
              onChange={(event) => setFieldValue("sku", event.target.value)}
              placeholder="Ej: ARR-001"
            />
            {errors.sku ? <p className="text-xs text-rose-600">{errors.sku}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Precio"
              required
              type="number"
              min="0"
              step="0.01"
              value={values.price}
              onChange={(event) => setFieldValue("price", event.target.value)}
              placeholder="0.00"
            />
            {errors.price ? <p className="text-xs text-rose-600">{errors.price}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Costo"
              required
              type="number"
              min="0"
              step="0.01"
              value={values.cost}
              onChange={(event) => setFieldValue("cost", event.target.value)}
              placeholder="0.00"
            />
            {errors.cost ? <p className="text-xs text-rose-600">{errors.cost}</p> : null}
          </div>

          <div className="space-y-1">
            <Select
              label="Unidad"
              required
              value={values.unitId}
              onChange={(event) => setFieldValue("unitId", event.target.value)}
              disabled={catalogLoading || unitOptions.length === 0}
              hint={
                unitOptions.length === 0
                  ? "Aun no hay unidades disponibles para seleccionar."
                  : undefined
              }
            >
              <option value="">Selecciona una unidad</option>
              {unitOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            {errors.unitId ? <p className="text-xs text-rose-600">{errors.unitId}</p> : null}
          </div>

          <div className="space-y-1">
            <Select
              label="Impuesto"
              value={values.taxId}
              onChange={(event) => setFieldValue("taxId", event.target.value)}
              disabled={catalogLoading}
              hint={
                taxOptions.length === 0
                  ? "Aun no hay impuestos disponibles. Este campo es opcional."
                  : undefined
              }
            >
              <option value="">Sin impuesto</option>
              {taxOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            {selectedTax ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">{selectedTax.name}</p>
                <p>Porcentaje: {selectedTax.rate * 100}%</p>
                <p>
                  {selectedTax.isIncluded
                    ? "El precio ya incluye impuestos"
                    : "El impuesto no esta incluido en el precio"}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => setFieldValue("isActive", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          Producto activo
        </label>

        {catalogLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Cargando unidades e impuestos...
          </div>
        ) : null}

        {catalogError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {catalogError}
          </div>
        ) : null}

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Guardar producto" : "Actualizar producto"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
