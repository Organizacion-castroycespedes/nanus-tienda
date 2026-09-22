"use client";

import { Tags } from "lucide-react";
import { Select } from "../../../../components/design-system/Select";
import { InventoryImageUploadPanel } from "../InventoryImageUploadPanel";
import type { ProductResponse } from "../../../../domains/products/dtos";
import { ProductSectionCard } from "./ProductSectionCard";
import type {
  ClassificationLists,
  ProductFormErrors,
  ProductFormMode,
  ProductFormValues,
} from "./types";

type ProductClassificationImageSectionProps = {
  mode: ProductFormMode;
  values: ProductFormValues;
  errors: ProductFormErrors;
  classification: ClassificationLists;
  imageProduct: ProductResponse | null;
  productId?: string | null;
  onCategoryChange: (categoryId: string) => void;
  onSubcategoryChange: (subcategoryId: string) => void;
  onActiveChange: (isActive: boolean) => void;
  onImageUpload: (file: File) => Promise<void>;
  onImageDelete: () => Promise<void>;
  imagePanelId?: string;
};

export const ProductClassificationImageSection = ({
  mode,
  values,
  errors,
  classification,
  imageProduct,
  productId,
  onCategoryChange,
  onSubcategoryChange,
  onActiveChange,
  onImageUpload,
  onImageDelete,
  imagePanelId,
}: ProductClassificationImageSectionProps) => {
  const sortedCategories = [...classification.categories].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name, "es"),
  );
  const sortedSubcategories = [...classification.subcategories].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name, "es"),
  );

  return (
    <ProductSectionCard
      title="Clasificación e imagen"
      description="Organiza el producto en el catálogo e incorpora su imagen."
      icon={<Tags className="h-5 w-5" />}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            La subcategoría depende de la categoría seleccionada.
          </p>
          {classification.categories.length === 0 &&
          !classification.categoriesLoading ? (
            <a
              className="text-sm font-semibold text-blue-700 hover:text-blue-800"
              href={classification.categoriesPath}
            >
              Crear categorías
            </a>
          ) : null}
        </div>

        {classification.categories.length === 0 &&
        !classification.categoriesLoading ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay categorías creadas. Puedes guardar el producto sin
            clasificación.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Select
                    label="Categoría"
              value={values.categoryId}
              onChange={(event) => onCategoryChange(event.target.value)}
              disabled={
                classification.categoriesLoading ||
                classification.categories.length === 0
              }
              hint={
                classification.categoriesLoading
                  ? "Cargando categorías..."
                  : "Campo opcional."
              }
            >
              <option value="">Sin categoría</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive ? "" : " (inactiva)"}
                </option>
              ))}
            </Select>
            {errors.categoryId ? (
              <p className="text-xs text-rose-600">{errors.categoryId}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Select
                    label="Subcategoría"
              value={values.subcategoryId}
              onChange={(event) => onSubcategoryChange(event.target.value)}
              disabled={
                !values.categoryId ||
                classification.subcategoriesLoading ||
                sortedSubcategories.length === 0
              }
              hint={
                !values.categoryId
                  ? "Selecciona una categoría primero."
                  : classification.subcategoriesLoading
                    ? "Cargando subcategorías..."
                    : sortedSubcategories.length === 0
                      ? "La categoría no tiene subcategorías."
                      : "Campo opcional."
              }
            >
              <option value="">Sin subcategoría</option>
              {sortedSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                  {subcategory.isActive ? "" : " (inactiva)"}
                </option>
              ))}
            </Select>
            {errors.subcategoryId ? (
              <p className="text-xs text-rose-600">{errors.subcategoryId}</p>
            ) : null}
          </div>
        </div>

        {classification.categoriesError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {classification.categoriesError} Puedes guardar el producto sin
            clasificación.
          </div>
        ) : null}

        {classification.subcategoriesError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {classification.subcategoriesError}
          </div>
        ) : null}

        <div id={imagePanelId}>
          <InventoryImageUploadPanel
            entityId={mode === "edit" ? productId : null}
            title="Imagen del producto"
            imageUrl={imageProduct?.imageUrl}
            imageAltText={imageProduct?.imageAltText}
            imageMimeType={imageProduct?.imageMimeType}
            imageSizeBytes={imageProduct?.imageSizeBytes}
            disabledMessage="Guarda primero el producto para poder cargar imagen."
            fallbackLabel={values.name || "Producto"}
            onUpload={onImageUpload}
            onDelete={onImageDelete}
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => onActiveChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          Producto activo
        </label>
      </div>
    </ProductSectionCard>
  );
};
