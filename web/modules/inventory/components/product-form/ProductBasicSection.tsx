"use client";

import { FileText } from "lucide-react";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import type {
  ProductMeasurementUnit,
  ProductSaleType,
} from "../../../../domains/products/dtos";
import { ProductSectionCard } from "./ProductSectionCard";
import {
  measurementUnitOptions,
  saleTypeOptions,
  type ProductFormErrors,
  type ProductFormMode,
  type ProductFormValues,
  type ProductOption,
} from "./types";

type ProductBasicSectionProps = {
  mode: ProductFormMode;
  values: ProductFormValues;
  errors: ProductFormErrors;
  unitOptions: ProductOption[];
  catalogLoading: boolean;
  onFieldChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onSaleModelChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
};

export const ProductBasicSection = ({
  mode,
  values,
  errors,
  unitOptions,
  catalogLoading,
  onFieldChange,
  onSaleModelChange,
}: ProductBasicSectionProps) => (
  <ProductSectionCard
    title="Datos básicos"
    description="Información general del producto para su identificación en el sistema."
    icon={<FileText className="h-5 w-5" />}
  >
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-1">
        <Input
          label="Nombre"
          required
          value={values.name}
          onChange={(event) => onFieldChange("name", event.target.value)}
          placeholder="Ej: Arroz premium"
        />
        {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
      </div>

      <div className="space-y-1">
        <Input
          label="SKU"
          required
          value={values.sku}
          onChange={(event) => {
            const sku = event.target.value;
            onFieldChange("sku", sku);
            if (
              mode === "create" &&
              values.standardIdentificationScheme === "999" &&
              !values.standardIdentificationCode.trim()
            ) {
              onFieldChange("standardIdentificationCode", sku);
            }
          }}
          placeholder="Ej: ARR-001"
        />
        {errors.sku ? <p className="text-xs text-rose-600">{errors.sku}</p> : null}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Select
            label="Estandar de identificacion DIAN"
            value={values.standardIdentificationScheme}
            onChange={(event) => {
              const scheme = event.target
                .value as ProductFormValues["standardIdentificationScheme"];
              onFieldChange("standardIdentificationScheme", scheme);
              if (scheme === "999" && !values.standardIdentificationCode.trim()) {
                onFieldChange("standardIdentificationCode", values.sku);
              }
              if (
                scheme !== "999" &&
                values.standardIdentificationScheme === "999"
              ) {
                onFieldChange("standardIdentificationCode", "");
              }
            }}
            hint="999 permite el codigo persistente adoptado por el contribuyente; al crear, inicia con el SKU."
          >
            <option value="">Sin estandar registrado</option>
            <option value="001">001 — UNSPSC</option>
            <option value="010">010 — GTIN</option>
            <option value="020">020 — Partida arancelaria</option>
            <option value="999">999 — Estandar adoptado por el contribuyente</option>
          </Select>
          <button
            type="button"
            aria-label="Ayuda sobre estandares de identificacion DIAN"
            title="001 UNSPSC, 010 GTIN, 020 partida arancelaria, 999 codigo adoptado por el contribuyente."
            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            ?
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <Input
          label="Codigo estandar DIAN"
          value={values.standardIdentificationCode}
          onChange={(event) =>
            onFieldChange("standardIdentificationCode", event.target.value)
          }
          placeholder="Codigo real del producto"
          disabled={!values.standardIdentificationScheme}
        />
        <p className="text-xs text-slate-500" role="note">
          999: codigo propio persistente. 001: UNSPSC. 010: GTIN. 020: partida
          arancelaria.
        </p>
        {errors.standardIdentificationCode ? (
          <p className="text-xs text-rose-600">{errors.standardIdentificationCode}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Select
          label="Unidad"
          required
          value={values.unitId}
          onChange={(event) => onFieldChange("unitId", event.target.value)}
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
          label="Modelo de venta"
          required
          value={values.saleType}
          onChange={(event) =>
            onSaleModelChange("saleType", event.target.value as ProductSaleType)
          }
          hint="Unidad no usa balanza. Peso usa balanza. Mixto permite ambos modos en POS."
        >
          {saleTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {errors.saleType ? (
          <p className="text-xs text-rose-600">{errors.saleType}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <Select
          label="Unidad comercial"
          required
          value={values.measurementUnit}
          onChange={(event) =>
            onSaleModelChange(
              "measurementUnit",
              event.target.value as ProductMeasurementUnit,
            )
          }
          hint="Para peso usa KG, LB, G u OZ."
        >
          {measurementUnitOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={
                values.saleType === "UNIT"
                  ? option.value !== "UND"
                  : option.value === "UND"
              }
            >
              {option.label}
            </option>
          ))}
        </Select>
        {errors.measurementUnit ? (
          <p className="text-xs text-rose-600">{errors.measurementUnit}</p>
        ) : null}
      </div>
    </div>
  </ProductSectionCard>
);
