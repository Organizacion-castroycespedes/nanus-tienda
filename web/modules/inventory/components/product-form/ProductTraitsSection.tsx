"use client";

import { Beaker } from "lucide-react";
import { Input } from "../../../../components/design-system/Input";
import { ProductSectionCard } from "./ProductSectionCard";
import type { ProductFormErrors, ProductFormValues } from "./types";

type ProductTraitsSectionProps = {
  values: ProductFormValues;
  errors: ProductFormErrors;
  requiresAlcoholTraits?: boolean;
  onFieldChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
};

export const ProductTraitsSection = ({
  values,
  errors,
  requiresAlcoholTraits = false,
  onFieldChange,
}: ProductTraitsSectionProps) => (
  <ProductSectionCard
    title="Características del producto"
    description={
      requiresAlcoholTraits
        ? "Datos físicos obligatorios para productos con régimen de licores."
        : "Opcional en productos comunes. Solo es obligatorio para licores o impuestos especiales."
    }
    icon={<Beaker className="h-5 w-5" />}
  >
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-1">
        <Input
          label="Presentación / volumen neto"
          required={requiresAlcoholTraits}
          type="number"
          min="0"
          step="0.001"
          value={values.netVolumeMl}
          onChange={(event) => onFieldChange("netVolumeMl", event.target.value)}
          placeholder="Ej: 1000"
          hint={
            requiresAlcoholTraits
              ? "Unidad: ml"
              : "Opcional. Unidad: ml. Solo requerido en licores."
          }
        />
        {errors.netVolumeMl ? (
          <p className="text-xs text-rose-600">{errors.netVolumeMl}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Input
          label="Grado de alcohol"
          required={requiresAlcoholTraits}
          type="number"
          min="0"
          max="100"
          step="0.001"
          value={values.alcoholDegree}
          onChange={(event) => onFieldChange("alcoholDegree", event.target.value)}
          placeholder="Ej: 29"
          hint={
            requiresAlcoholTraits
              ? "Porcentaje %"
              : "Opcional. Solo requerido en licores."
          }
        />
        {errors.alcoholDegree ? (
          <p className="text-xs text-rose-600">{errors.alcoholDegree}</p>
        ) : null}
      </div>
    </div>
  </ProductSectionCard>
);
