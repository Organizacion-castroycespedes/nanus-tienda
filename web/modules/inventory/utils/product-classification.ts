export type ProductClassificationFormValues = {
  categoryId?: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

export type ProductClassificationFormErrors = Partial<
  Record<keyof ProductClassificationFormValues, string>
> & {
  submit?: string;
};

export type ProductClassificationSelection = {
  categoryId: string;
  subcategoryId: string;
};

export type ProductSubcategoryLike = {
  id: string;
  categoryId: string;
};

export const slugifyClassificationName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

export const normalizeSortOrder = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const validateProductClassificationForm = (
  values: ProductClassificationFormValues,
  options: { requiresCategory?: boolean } = {}
) => {
  const errors: ProductClassificationFormErrors = {};

  if (options.requiresCategory && !values.categoryId?.trim()) {
    errors.categoryId = "La categoria es requerida.";
  }
  if (!values.name.trim()) {
    errors.name = "El nombre es requerido.";
  }
  if (!values.slug.trim()) {
    errors.slug = "El slug es requerido.";
  }
  if (normalizeSortOrder(values.sortOrder) === null) {
    errors.sortOrder = "El orden debe ser un entero mayor o igual a 0.";
  }

  return errors;
};

export const getClassificationInitials = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const initials = words.map((word) => word[0]?.toUpperCase()).join("");
  return initials || "CL";
};

export const filterProductSubcategoriesByCategory = <
  TSubcategory extends ProductSubcategoryLike,
>(
  subcategories: TSubcategory[],
  categoryId: string
) =>
  categoryId
    ? subcategories.filter((subcategory) => subcategory.categoryId === categoryId)
    : [];

export const resolveSubcategoryForCategory = <
  TSubcategory extends ProductSubcategoryLike,
>(
  subcategoryId: string,
  categoryId: string,
  subcategories: TSubcategory[]
) => {
  if (!subcategoryId || !categoryId) {
    return "";
  }

  return subcategories.some(
    (subcategory) =>
      subcategory.id === subcategoryId && subcategory.categoryId === categoryId
  )
    ? subcategoryId
    : "";
};

export const validateProductClassificationSelection = <
  TSubcategory extends ProductSubcategoryLike,
>(
  values: ProductClassificationSelection,
  subcategories: TSubcategory[]
) => {
  if (values.subcategoryId && !values.categoryId) {
    return "Selecciona una categoria antes de elegir subcategoria.";
  }

  if (!values.subcategoryId) {
    return null;
  }

  const selectedSubcategory = subcategories.find(
    (subcategory) => subcategory.id === values.subcategoryId
  );

  if (
    selectedSubcategory &&
    selectedSubcategory.categoryId !== values.categoryId
  ) {
    return "La subcategoria no pertenece a la categoria seleccionada.";
  }

  if (subcategories.length > 0 && !selectedSubcategory) {
    return "La subcategoria seleccionada no esta disponible.";
  }

  return null;
};

export const buildProductClassificationPayload = (
  values: ProductClassificationSelection
) => ({
  categoryId: values.categoryId || null,
  subcategoryId:
    values.categoryId && values.subcategoryId ? values.subcategoryId : null,
});

export const getProductClassificationErrorMessage = (
  error: unknown,
  fallback: string
) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallback;
};
