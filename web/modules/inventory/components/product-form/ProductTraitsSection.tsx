"use client";

import { Beaker } from "lucide-react";
import { Input } from "../../../../components/design-system/Input";
import { ProductSectionCard } from "./ProductSectionCard";
import type { ProductFormErrors, ProductFormValues } from "./types";

type ProductTraitsSectionProps = {
  values: ProductFormValues;
  errors: ProductFormErrors;
  onFieldChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
};

export const ProductTraitsSection = ({
  values,
  errors,
  onFieldChange,
}: ProductTraitsSectionProps) => (
  <ProductSectionCard
    title="Características del producto"
    description="Datos físicos del producto. La configuración avanzada queda al final."
    icon={<Beaker className="h-5 w-5" />}
  >
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-1">
        <Input
          label="Presentacion / volumen neto"
          type="number"
          min="0"
          step="0.001"
          value={values.netVolumeMl}
          onChange={(event) => onFieldChange("netVolumeMl", event.target.value)}
          placeholder="Ej: 1000"
          hint="Unidad: ml"
        />
        {errors.netVolumeMl ? (
          <p className="text-xs text-rose-600">{errors.netVolumeMl}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Input
          label="Grado de alcohol"
          type="number"
          min="0"
          max="100"
          step="0.001"
          value={values.alcoholDegree}
          onChange={(event) => onFieldChange("alcoholDegree", event.target.value)}
          placeholder="Ej: 29"
          hint="Porcentaje %"
        />
        {errors.alcoholDegree ? (
          <p className="text-xs text-rose-600">{errors.alcoholDegree}</p>
        ) : null}
      </div>
    </div>
  </ProductSectionCard>
);
