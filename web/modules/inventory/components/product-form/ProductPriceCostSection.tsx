"use client";

import { CircleDollarSign } from "lucide-react";
import { Input } from "../../../../components/design-system/Input";
import { ProductSectionCard } from "./ProductSectionCard";
import type {
  ProductFormErrors,
  ProductFormMode,
  ProductFormValues,
} from "./types";

type ProductPriceCostSectionProps = {
  mode: ProductFormMode;
  values: ProductFormValues;
  errors: ProductFormErrors;
  priceWithoutTax: string;
  priceWithTax: string;
  onFieldChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
};

export const ProductPriceCostSection = ({
  mode,
  values,
  errors,
  priceWithoutTax,
  priceWithTax,
  onFieldChange,
}: ProductPriceCostSectionProps) => (
  <ProductSectionCard
    title="Precio y costo"
    description="Define el precio de venta y el costo. Los valores fiscales se reflejan automáticamente."
    icon={<CircleDollarSign className="h-5 w-5" />}
  >
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-1">
        <Input
          label="Precio de venta"
          required={mode === "create"}
          type="number"
          min="0"
          step="0.01"
          value={values.price}
          onChange={(event) => onFieldChange("price", event.target.value)}
          placeholder="0.00"
          disabled={mode === "edit"}
          className={mode === "edit" ? "bg-slate-100 text-slate-500" : undefined}
          hint={
            mode === "edit"
              ? "Para trazabilidad use Cambiar precio desde el listado."
              : undefined
          }
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
          onChange={(event) => onFieldChange("cost", event.target.value)}
          placeholder="0.00"
        />
        {errors.cost ? <p className="text-xs text-rose-600">{errors.cost}</p> : null}
      </div>

      <div className="space-y-1">
        <Input
          label="Precio sin impuestos"
          type="number"
          min="0"
          step="0.01"
          value={priceWithoutTax}
          readOnly
          className="bg-slate-50 text-slate-500 dark:bg-slate-900/40"
          placeholder="0.00"
        />
      </div>

      <div className="space-y-1">
        <Input
          label="Precio con impuestos"
          type="number"
          min="0"
          step="0.01"
          value={priceWithTax}
          readOnly
          className="bg-slate-50 text-slate-500 dark:bg-slate-900/40"
          placeholder="0.00"
        />
      </div>
    </div>

    <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
      Los valores fiscales se calculan automáticamente según la categoría y
      configuración vigente.
    </p>
  </ProductSectionCard>
);
