"use client";

import { Settings2 } from "lucide-react";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import type {
  ProductOperationalStatus,
  ProductRotationClass,
} from "../../../../domains/products/dtos";
import { ProductSectionCard } from "./ProductSectionCard";
import {
  operationalStatusOptions,
  rotationClassOptions,
  type ProductFormErrors,
  type ProductFormValues,
} from "./types";

type ProductOperationalSectionProps = {
  values: ProductFormValues;
  errors: ProductFormErrors;
  structuralConfigurationLocked: boolean;
  onOperationalChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
};

export const ProductOperationalSection = ({
  values,
  errors,
  structuralConfigurationLocked,
  onOperationalChange,
}: ProductOperationalSectionProps) => (
  <ProductSectionCard
    title="Configuración operativa"
    description="Define reglas de lote, vencimiento, estado y stock objetivo."
    icon={<Settings2 className="h-5 w-5" />}
  >
    <div className="space-y-5">
      <div className="space-y-1">
        <Select
          label="Tipo de producto"
          value={values.isInventoryable ? "INVENTORYABLE" : "SERVICE"}
          disabled={structuralConfigurationLocked}
          onChange={(event) =>
            onOperationalChange(
              "isInventoryable",
              event.target.value === "INVENTORYABLE",
            )
          }
          hint="Servicio no consulta existencias ni genera movimientos físicos."
        >
          <option value="INVENTORYABLE">Producto inventariable</option>
          <option value="SERVICE">Servicio / no inventariable</option>
        </Select>
        {!values.isInventoryable ? (
          <p className="text-xs text-amber-700">
            Lote, vencimiento, reservas y stock físico quedan inactivos para este producto.
          </p>
        ) : null}
      </div>
      {/*
        <div className="space-y-1">
          <Input
            label="Motivo del cambio a servicio"
            value={values.inventoryabilityChangeReason}
            onChange={(event) =>
              onOperationalChange(
                "inventoryabilityChangeReason",
                event.target.value,
              )
            }
            placeholder="Ej: servicio de impresión"
          />
          {errors.inventoryabilityChangeReason ? (
            <p className="text-xs text-rose-600">
              {errors.inventoryabilityChangeReason}
            </p>
          ) : null}
        </div>
      */}
      {structuralConfigurationLocked ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="note">
          El tipo de producto y la configuracion de perecibilidad, lote y
          vencimiento se definen al crear el producto y no pueden cambiarse
          despues del primer guardado.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          <input
            type="checkbox"
            checked={values.isPerishable}
            disabled={structuralConfigurationLocked || !values.isInventoryable}
            onChange={(event) =>
              onOperationalChange("isPerishable", event.target.checked)
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span>
            <span className="block font-medium text-slate-900 dark:text-white">
              Producto perecedero
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Recomendado para alimentos, farmacia o productos con vida útil.
            </span>
          </span>
        </label>

        <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          <input
            type="checkbox"
            checked={values.requiresLot}
            disabled={structuralConfigurationLocked || !values.isInventoryable}
            onChange={(event) =>
              onOperationalChange("requiresLot", event.target.checked)
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span>
            <span className="block font-medium text-slate-900 dark:text-white">
              Requiere lote
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Activa trazabilidad por lote en compras, ajustes y ventas.
            </span>
          </span>
        </label>

        <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          <input
            type="checkbox"
            checked={values.requiresExpiration}
            disabled={structuralConfigurationLocked || !values.isInventoryable}
            onChange={(event) =>
              onOperationalChange("requiresExpiration", event.target.checked)
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span>
            <span className="block font-medium text-slate-900 dark:text-white">
              Requiere vencimiento
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Al activarlo, lote queda marcado automáticamente.
            </span>
          </span>
        </label>

        <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          <input
            type="checkbox"
            checked={values.requiresSerial}
            disabled={
              structuralConfigurationLocked ||
              !values.isInventoryable ||
              values.saleType !== "UNIT"
            }
            onChange={(event) =>
              onOperationalChange("requiresSerial", event.target.checked)
            }
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span>
            <span className="block font-medium text-slate-900 dark:text-white">
              Requiere número de serie
            </span>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Cada unidad recibida registra su serie y al vender se elige cuál sale. Solo por unidad y sin lote.
            </span>
          </span>
        </label>
      </div>

      {values.isInventoryable && values.isPerishable ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Producto perecedero
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Select
            label="Estado operativo"
            value={values.operationalStatus}
            onChange={(event) =>
              onOperationalChange(
                "operationalStatus",
                event.target.value as ProductOperationalStatus,
              )
            }
          >
            {operationalStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {errors.operationalStatus ? (
            <p className="text-xs text-rose-600">{errors.operationalStatus}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Select
            label="Rotación"
            value={values.rotationClass}
            onChange={(event) =>
              onOperationalChange(
                "rotationClass",
                event.target.value as "" | ProductRotationClass,
              )
            }
          >
            <option value="">Sin clasificar</option>
            {rotationClassOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {errors.rotationClass ? (
            <p className="text-xs text-rose-600">{errors.rotationClass}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Stock mínimo"
            type="number"
            min="0"
            step="0.01"
            value={values.minStock}
            onChange={(event) =>
              onOperationalChange("minStock", event.target.value)
            }
            placeholder="Opcional"
            disabled={!values.isInventoryable}
          />
          {errors.minStock ? (
            <p className="text-xs text-rose-600">{errors.minStock}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Stock máximo"
            type="number"
            min="0"
            step="0.01"
            value={values.maxStock}
            onChange={(event) =>
              onOperationalChange("maxStock", event.target.value)
            }
            placeholder="Opcional"
            disabled={!values.isInventoryable}
          />
          {errors.maxStock ? (
            <p className="text-xs text-rose-600">{errors.maxStock}</p>
          ) : null}
        </div>
      </div>

      {errors.isPerishable ? (
        <p className="text-xs text-rose-600">{errors.isPerishable}</p>
      ) : null}
      {errors.requiresLot ? (
        <p className="text-xs text-rose-600">{errors.requiresLot}</p>
      ) : null}
      {errors.requiresExpiration ? (
        <p className="text-xs text-rose-600">{errors.requiresExpiration}</p>
      ) : null}
      {errors.requiresSerial ? (
        <p className="text-xs text-rose-600">{errors.requiresSerial}</p>
      ) : null}
    </div>
  </ProductSectionCard>
);
