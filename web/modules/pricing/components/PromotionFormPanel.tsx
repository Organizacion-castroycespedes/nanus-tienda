"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { ProductResponse } from "../../../domains/products/dtos";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import type { PromotionDiscountType } from "../services/promotions.service";

export type PromotionFormState = {
  name: string;
  description: string;
  discountType: PromotionDiscountType;
  discountValue: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  isActive: boolean;
  productIds: string[];
  branchIds: string[];
};

type PromotionFormPanelProps = {
  mode: "create" | "edit";
  form: PromotionFormState;
  setForm: Dispatch<SetStateAction<PromotionFormState>>;
  formError: string | null;
  saving: boolean;
  referencesLoading: boolean;
  filteredProducts: ProductResponse[];
  filteredBranches: BranchResponse[];
  productSearch: string;
  branchSearch: string;
  branchWarning: string | null;
  onProductSearchChange: (value: string) => void;
  onBranchSearchChange: (value: string) => void;
  onToggleProduct: (productId: string) => void;
  onToggleBranch: (branchId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

const productLabel = (product: ProductResponse) => `${product.name} (${product.sku})`;

export const PromotionFormPanel = ({
  mode,
  form,
  setForm,
  formError,
  saving,
  referencesLoading,
  filteredProducts,
  filteredBranches,
  productSearch,
  branchSearch,
  branchWarning,
  onProductSearchChange,
  onBranchSearchChange,
  onToggleProduct,
  onToggleBranch,
  onSubmit,
  onCancel,
}: PromotionFormPanelProps) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Input
          label="name"
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          required
        />
        <Select
          label="discountType"
          value={form.discountType}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              discountType: event.target.value as PromotionDiscountType,
            }))
          }
          required
        >
          <option value="PERCENTAGE">PERCENTAGE</option>
          <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
          <option value="SPECIAL_PRICE">SPECIAL_PRICE</option>
        </Select>
        <Input
          label="discountValue"
          type="number"
          min={form.discountType === "SPECIAL_PRICE" ? 0 : 0.01}
          max={form.discountType === "PERCENTAGE" ? 100 : undefined}
          step="0.01"
          value={form.discountValue}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              discountValue: event.target.value,
            }))
          }
          required
        />
        <Input
          label="priority"
          type="number"
          min={0}
          step={1}
          hint="Menor priority gana."
          value={form.priority}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              priority: event.target.value,
            }))
          }
          required
        />
        <Input
          label="startsAt"
          type="datetime-local"
          value={form.startsAt}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              startsAt: event.target.value,
            }))
          }
          required
        />
        <Input
          label="endsAt"
          type="datetime-local"
          value={form.endsAt}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              endsAt: event.target.value,
            }))
          }
          required
        />
        <div className="lg:col-span-2">
          <Textarea
            label="description"
            rows={3}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600"
          checked={form.isActive}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              isActive: event.target.checked,
            }))
          }
        />
        <span className="font-medium">isActive</span>
      </label>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">productIds</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seleccionados: {form.productIds.length}
              </p>
            </div>
            <Input
              label="Buscar producto"
              value={productSearch}
              onChange={(event) => onProductSearchChange(event.target.value)}
              className="min-w-56"
            />
          </div>
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {referencesLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Cargando productos...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay productos para seleccionar.</p>
            ) : (
              filteredProducts.map((product) => (
                <label
                  key={product.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={form.productIds.includes(product.id)}
                    onChange={() => onToggleProduct(product.id)}
                  />
                  <span>
                    <span className="block font-medium text-slate-900 dark:text-white">
                      {product.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{product.sku}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">branchIds</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {form.branchIds.length === 0
                  ? "Aplica a todas las sucursales permitidas."
                  : `Seleccionadas: ${form.branchIds.length}`}
              </p>
            </div>
            <Input
              label="Buscar sucursal"
              value={branchSearch}
              onChange={(event) => onBranchSearchChange(event.target.value)}
              className="min-w-56"
            />
          </div>
          {branchWarning ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {branchWarning}
            </p>
          ) : null}
          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
            {referencesLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Cargando sucursales...</p>
            ) : filteredBranches.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sin selector de sucursales disponible.
              </p>
            ) : (
              filteredBranches.map((branch) => (
                <label
                  key={branch.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={form.branchIds.includes(branch.id)}
                    onChange={() => onToggleBranch(branch.id)}
                  />
                  <span>
                    <span className="block font-medium text-slate-900 dark:text-white">
                      {branch.nombre}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{branch.codigo}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </section>

      {formError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={saving}>
          {mode === "create" ? "Crear promocion" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  </section>
);
