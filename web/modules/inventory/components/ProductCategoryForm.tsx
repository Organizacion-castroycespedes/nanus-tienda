"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Textarea } from "../../../components/design-system/Textarea";
import {
  createProductCategory,
  updateProductCategory,
  type ProductCategoryResponse,
} from "../services/product-classification.service";
import {
  getProductClassificationErrorMessage,
  normalizeSortOrder,
  slugifyClassificationName,
  validateProductClassificationForm,
  type ProductClassificationFormErrors,
  type ProductClassificationFormValues,
} from "../utils/product-classification";

type ProductCategoryFormProps = {
  mode: "create" | "edit";
  category?: ProductCategoryResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
};

const createInitialValues = (
  category?: ProductCategoryResponse | null
): ProductClassificationFormValues => ({
  name: category?.name ?? "",
  slug: category?.slug ?? "",
  description: category?.description ?? "",
  sortOrder: String(category?.sortOrder ?? 0),
  isActive: category?.isActive ?? true,
});

export const ProductCategoryForm = ({
  mode,
  category,
  onCancel,
  onSuccess,
}: ProductCategoryFormProps) => {
  const [values, setValues] = useState<ProductClassificationFormValues>(
    createInitialValues(category)
  );
  const [errors, setErrors] = useState<ProductClassificationFormErrors>({});
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(createInitialValues(category));
    setErrors({});
    setSlugTouched(mode === "edit");
  }, [mode, category]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validateProductClassificationForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
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
        await createProductCategory(payload);
      } else {
        await updateProductCategory(category!.id, payload);
      }
      onSuccess(mode);
    } catch (error) {
      setErrors({
        submit: getProductClassificationErrorMessage(
          error,
          mode === "create"
            ? "No se pudo crear la categoria."
            : "No se pudo actualizar la categoria."
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
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
            hint="Editable. Se usa para evitar duplicados por tenant."
          />
          {errors.slug ? <p className="text-xs text-rose-600">{errors.slug}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_180px]">
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
        Categoria activa
      </label>

      {errors.submit ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errors.submit}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "Guardar categoria" : "Actualizar categoria"}
        </Button>
      </div>
    </form>
  );
};
