"use client";

import { ChevronDown, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import type {
  AssignedTaxRow,
  FiscalCatalogs,
  ProductFormErrors,
  ProductFormValues,
} from "./types";

type ProductFiscalAdvancedAccordionProps = {
  values: ProductFormValues;
  errors: ProductFormErrors;
  catalogs: FiscalCatalogs;
  onFieldChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onAssignedTaxesChange: (assignedTaxes: AssignedTaxRow[]) => void;
};

export const ProductFiscalAdvancedAccordion = ({
  values,
  errors,
  catalogs,
  onFieldChange,
  onAssignedTaxesChange,
}: ProductFiscalAdvancedAccordionProps) => {
  const [open, setOpen] = useState(false);
  const isExpanded = open;

  const updateAssignment = (
    index: number,
    patch: Partial<AssignedTaxRow>,
  ) => {
    const next = [...values.assignedTaxes];
    next[index] = { ...next[index], ...patch };
    onAssignedTaxesChange(next);
  };

  const bridgeAssignment = values.assignedTaxes.find(
    (assignment) => assignment.taxId === catalogs.bridgeTax?.id,
  );
  const priceIncludesBridgeTax =
    bridgeAssignment?.isIncluded ?? catalogs.bridgeTax?.isIncluded ?? true;

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-sm dark:border-amber-900/40 dark:bg-slate-800">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
        aria-expanded={isExpanded}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Configuración avanzada
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Parámetros fiscales, impuestos y configuración DIAN del producto.
            </p>
          </div>
        </div>
        <ChevronDown
          className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded ? (
        <div className="space-y-6 border-t border-amber-100 px-6 py-6 dark:border-amber-900/40">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Configuración fiscal y parámetros avanzados del producto. Esta
            información afecta el cálculo automático de impuestos.
          </p>

          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40 md:grid-cols-2">
            <Select
              label="Categoria fiscal"
              value={values.taxProductCategoryId}
              onChange={(event) =>
                onFieldChange("taxProductCategoryId", event.target.value)
              }
              disabled={catalogs.catalogLoading}
            >
              <option value="">Selecciona categoria</option>
              {catalogs.taxProductCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Input
              label="Precio DANE certificado"
              type="number"
              min="0"
              step="0.01"
              value={values.daneCertifiedRetailPrice}
              onChange={(event) =>
                onFieldChange("daneCertifiedRetailPrice", event.target.value)
              }
            />
            <Input
              label="DANE vigente desde"
              type="date"
              value={values.danePriceEffectiveFrom}
              onChange={(event) =>
                onFieldChange("danePriceEffectiveFrom", event.target.value)
              }
            />
            <Input
              label="DANE vigente hasta"
              type="date"
              value={values.danePriceEffectiveTo}
              onChange={(event) =>
                onFieldChange("danePriceEffectiveTo", event.target.value)
              }
            />
            {errors.taxProductCategoryId ? (
              <p className="text-xs text-rose-600 md:col-span-2">
                {errors.taxProductCategoryId}
              </p>
            ) : null}
            {errors.daneCertifiedRetailPrice ? (
              <p className="text-xs text-rose-600 md:col-span-2">
                {errors.daneCertifiedRetailPrice}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Configuración de impuestos
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={catalogs.catalogLoading}
                onClick={() =>
                  onAssignedTaxesChange([
                    ...values.assignedTaxes,
                    {
                      taxId: "",
                      calculationOrder: String(
                        (values.assignedTaxes.length + 1) * 100,
                      ),
                      // Precio de góndola en Colombia suele incluir IVA.
                      isIncluded: catalogs.bridgeTax?.isIncluded ?? true,
                    },
                  ])
                }
              >
                Agregar impuesto
              </Button>
            </div>

            {values.assignedTaxes.length === 0 ? (
              <p className="text-sm text-slate-500">
                Sin impuestos. El POS tratara el producto como exento/sin
                tributo.
              </p>
            ) : null}

            {values.assignedTaxes.map((assignment, index) => (
              <div
                key={`${assignment.taxId}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 md:grid-cols-[1fr_120px_180px_auto]"
              >
                <Select
                  label={`Aplicacion #${index + 1}`}
                  value={assignment.taxId}
                  disabled={catalogs.catalogLoading}
                  onChange={(event) => {
                    const taxId = event.target.value;
                    const catalogTax = catalogs.taxOptions.find(
                      (option) => option.id === taxId,
                    );
                    updateAssignment(index, {
                      taxId,
                      ...(catalogTax
                        ? { isIncluded: catalogTax.isIncluded }
                        : {}),
                    });
                  }}
                >
                  <option value="">Selecciona impuesto</option>
                  {catalogs.taxOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Orden"
                  type="number"
                  min="1"
                  value={assignment.calculationOrder}
                  onChange={(event) =>
                    updateAssignment(index, {
                      calculationOrder: event.target.value,
                    })
                  }
                />
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={assignment.isIncluded}
                    onChange={(event) =>
                      updateAssignment(index, {
                        isIncluded: event.target.checked,
                      })
                    }
                  />
                  Precio incluye impuesto
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      onAssignedTaxesChange(
                        values.assignedTaxes.filter(
                          (_item, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}

            {errors.assignedTaxes ? (
              <p className="text-xs text-rose-600">{errors.assignedTaxes}</p>
            ) : null}

            {catalogs.bridgeTax ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">
                  POS usara: {catalogs.bridgeTax.name}
                </p>
                <p>
                  Porcentaje puente:{" "}
                  {(catalogs.bridgeTax.rate * 100).toFixed(2)}%
                </p>
                <p>
                  {priceIncludesBridgeTax
                    ? "El precio ya incluye impuestos (segun la asignacion del producto)"
                    : "El impuesto NO esta incluido en el precio (segun la asignacion del producto)"}
                </p>
                {catalogs.hasNonPercentageTax ? (
                  <p className="mt-2">
                    ICL/ADV se calculan en caja con el perfil fiscal (grado, ml,
                    DANE). El porcentaje puente sigue siendo el IVA de POS.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
            Estos valores afectan el calculo automatico de impuestos en
            facturacion y reportes fiscales. Editalos unicamente usuarios
            autorizados.
          </p>
        </div>
      ) : null}
    </section>
  );
};
