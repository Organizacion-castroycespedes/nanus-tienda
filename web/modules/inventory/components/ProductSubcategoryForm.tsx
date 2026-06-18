"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { InventoryImageUploadPanel } from "./InventoryImageUploadPanel";
import {
  createProductSubcategory,
  deleteProductSubcategoryImage,
  updateProductSubcategory,
  uploadProductSubcategoryImage,
  type ProductCategoryResponse,
  type ProductSubcategoryResponse,
} from "../services/product-classification.service";
import {
  getProductClassificationErrorMessage,
  normalizeSortOrder,
  slugifyClassificationName,
  validateProductClassificationForm,
  type ProductClassificationFormErrors,
  type ProductClassificationFormValues,
} from "../utils/product-classification";

type ProductSubcategoryFormProps = {
  mode: "create" | "edit";
  subcategory?: ProductSubcategoryResponse | null;
  categories: ProductCategoryResponse[];
  defaultCategoryId?: string;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
  onImageChange?: (subcategory: ProductSubcategoryResponse) => void;
};

const createInitialValues = (
  subcategory?: ProductSubcategoryResponse | null,
  defaultCategoryId = ""
): ProductClassificationFormValues => ({
  categoryId: subcategory?.categoryId ?? defaultCategoryId,
  name: subcategory?.name ?? "",
  slug: subcategory?.slug ?? "",
  description: subcategory?.description ?? "",
  sortOrder: String(subcategory?.sortOrder ?? 0),
  isActive: subcategory?.isActive ?? true,
});

export const ProductSubcategoryForm = ({
  mode,
  subcategory,
  categories,
  defaultCategoryId = "",
  onCancel,
  onSuccess,
  onImageChange,
}: ProductSubcategoryFormProps) => {
  const [values, setValues] = useState<ProductClassificationFormValues>(
    createInitialValues(subcategory, defaultCategoryId)
  );
  const [errors, setErrors] = useState<ProductClassificationFormErrors>({});
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageSubcategory, setImageSubcategory] =
    useState<ProductSubcategoryResponse | null>(subcategory ?? null);

  useEffect(() => {
    setValues(createInitialValues(subcategory, defaultCategoryId));
    setErrors({});
    setSlugTouched(mode === "edit");
    setImageSubcategory(subcategory ?? null);
  }, [mode, subcategory, defaultCategoryId]);

  const currentImageSubcategory = imageSubcategory ?? subcategory ?? null;

  const handleImageUpload = async (file: File) => {
    if (!subcategory?.id) {
      throw new Error("Guarda primero la subcategoria para poder cargar imagen.");
    }
    const updated = await uploadProductSubcategoryImage(
      subcategory.id,
      file,
      values.name.trim() || subcategory.name
    );
    setImageSubcategory(updated);
    onImageChange?.(updated);
  };

  const handleImageDelete = async () => {
    if (!subcategory?.id) {
      throw new Error(
        "Guarda primero la subcategoria para poder eliminar imagen."
      );
    }
    const updated = await deleteProductSubcategoryImage(subcategory.id);
    setImageSubcategory(updated);
    onImageChange?.(updated);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateProductClassificationForm(values, {
      requiresCategory: true,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      categoryId: values.categoryId!.trim(),
      name: values.name.trim(),
      slug: values.slug.trim(),
      description: values.description.trim() || null,
      sortOrder: normalizeSortOrder(values.sortOrder) ?? 0,
      isActive: values.isActive,
    };

    setIsSubmitting(true);
    setErrors({});
    try {
      if (mode === "create") {
        await createProductSubcategory(payload);
      } else {
        await updateProductSubcategory(subcategory!.id, payload);
      }
      onSuccess(mode);
    } catch (error) {
      setErrors({
        submit: getProductClassificationErrorMessage(
          error,
          mode === "create"
            ? "No se pudo crear la subcategoria."
            : "No se pudo actualizar la subcategoria."
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-1">
          <Select
            label="Categoria"
            required
            value={values.categoryId ?? ""}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                categoryId: event.target.value,
              }));
              setErrors((current) => ({
                ...current,
                categoryId: undefined,
                submit: undefined,
              }));
            }}
          >
            <option value="">Selecciona categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          {errors.categoryId ? (
            <p className="text-xs text-rose-600">{errors.categoryId}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Nombre"
            required
            value={values.name}
            onChange={(event) => {
              const name = event.target.value;
              setValues((current) => ({
                ...current,
                name,
                slug: slugTouched ? current.slug : slugifyClassificationName(name),
              }));
              setErrors((current) => ({
                ...current,
                name: undefined,
                slug: undefined,
                submit: undefined,
              }));
            }}
          />
          {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
        <div className="space-y-1">
          <Input
            label="Slug"
            required
            value={values.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setValues((current) => ({
                ...current,
                slug: slugifyClassificationName(event.target.value),
              }));
              setErrors((current) => ({
                ...current,
                slug: undefined,
                submit: undefined,
              }));
            }}
            hint="Unico por categoria dentro del tenant."
          />
          {errors.slug ? <p className="text-xs text-rose-600">{errors.slug}</p> : null}
        </div>

        <div className="space-y-1">
          <Input
            label="Orden"
            type="number"
            min={0}
            step={1}
            required
            value={values.sortOrder}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                sortOrder: event.target.value,
              }));
              setErrors((current) => ({
                ...current,
                sortOrder: undefined,
                submit: undefined,
              }));
            }}
          />
          {errors.sortOrder ? (
            <p className="text-xs text-rose-600">{errors.sortOrder}</p>
          ) : null}
        </div>
      </div>

      <Textarea
        label="Descripcion"
        rows={4}
        value={values.description}
        onChange={(event) => {
          setValues((current) => ({
            ...current,
            description: event.target.value,
          }));
          setErrors((current) => ({ ...current, submit: undefined }));
        }}
      />

      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              isActive: event.target.checked,
            }))
          }
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        />
        Subcategoria activa
      </label>

      <InventoryImageUploadPanel
        entityId={mode === "edit" ? subcategory?.id : null}
        title="Imagen predeterminada"
        imageUrl={currentImageSubcategory?.defaultImageUrl}
        imageAltText={currentImageSubcategory?.defaultImageAltText}
        imageMimeType={currentImageSubcategory?.defaultImageMimeType}
        imageSizeBytes={currentImageSubcategory?.defaultImageSizeBytes}
        disabledMessage="Guarda primero la subcategoria para poder cargar imagen."
        fallbackLabel={values.name || "Subcategoria"}
        onUpload={handleImageUpload}
        onDelete={handleImageDelete}
      />

      {errors.submit ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errors.submit}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={categories.length === 0}>
          {mode === "create" ? "Guardar subcategoria" : "Actualizar subcategoria"}
        </Button>
      </div>
    </form>
  );
};
