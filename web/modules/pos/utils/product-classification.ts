import type { ProductResponse } from "../../../domains/products/dtos";
import type {
  ProductCategoryResponse,
  ProductSubcategoryResponse,
} from "../../inventory/services/product-classification.service";

export type PosProductClassificationFilters = {
  categoryId?: string;
  subcategoryId?: string;
};

type PosClassificationIdReference =
  | string
  | number
  | {
      id?: string | number | null;
    }
  | null
  | undefined;

export type PosProductClassificationCandidate = {
  categoryId?: PosClassificationIdReference;
  category_id?: PosClassificationIdReference;
  productCategoryId?: PosClassificationIdReference;
  categoriaId?: PosClassificationIdReference;
  categoria_id?: PosClassificationIdReference;
  category?: PosClassificationIdReference;
  categoria?: PosClassificationIdReference;
  subcategoryId?: PosClassificationIdReference;
  subcategory_id?: PosClassificationIdReference;
  productSubcategoryId?: PosClassificationIdReference;
  subcategoriaId?: PosClassificationIdReference;
  subcategoria_id?: PosClassificationIdReference;
  subcategory?: PosClassificationIdReference;
  subcategoria?: PosClassificationIdReference;
};

export type PosStockFilterKey = "all" | "available" | "low" | "out";

type PosProductCatalogCandidate = PosProductClassificationCandidate & {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  sku?: string | null;
  stock?: number | string | null;
};

export type PosProductCatalogFilters<TProduct> =
  PosProductClassificationFilters & {
    query?: string;
    stockFilter?: PosStockFilterKey;
    getSearchText?: (product: TProduct) => string;
    isLowStock?: (stock: number) => boolean;
  };

export type EffectivePosProductImage = {
  imageUrl: string | null;
  altText: string | null;
  source: "product" | "subcategory" | "category" | null;
};

export const normalizePosClassificationId = (value: unknown) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
};

const normalizeReferenceId = (value: PosClassificationIdReference) => {
  const directId = normalizePosClassificationId(value);
  if (directId) {
    return directId;
  }

  if (value && typeof value === "object") {
    return normalizePosClassificationId(value.id);
  }

  return "";
};

const firstNormalizedId = (values: PosClassificationIdReference[]) =>
  values.map(normalizeReferenceId).find(Boolean) ?? "";

export const resolvePosProductCategoryId = (
  product: PosProductClassificationCandidate
) =>
  firstNormalizedId([
    product.categoryId,
    product.category_id,
    product.productCategoryId,
    product.categoriaId,
    product.categoria_id,
    product.category,
    product.categoria,
  ]);

export const resolvePosProductSubcategoryId = (
  product: PosProductClassificationCandidate
) =>
  firstNormalizedId([
    product.subcategoryId,
    product.subcategory_id,
    product.productSubcategoryId,
    product.subcategoriaId,
    product.subcategoria_id,
    product.subcategory,
    product.subcategoria,
  ]);

export const filterPosProductsByClassification = <
  TProduct extends PosProductClassificationCandidate,
>(
  products: TProduct[],
  filters: PosProductClassificationFilters
) => {
  const categoryId = normalizePosClassificationId(filters.categoryId);
  const subcategoryId = normalizePosClassificationId(filters.subcategoryId);

  return products.filter((product) => {
    if (categoryId && resolvePosProductCategoryId(product) !== categoryId) {
      return false;
    }

    if (
      subcategoryId &&
      resolvePosProductSubcategoryId(product) !== subcategoryId
    ) {
      return false;
    }

    return true;
  });
};

export const normalizePosProductFilterText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const defaultIsLowStock = (stock: number) => stock > 0 && stock <= 5;

const getNumericStock = (value: number | string | null | undefined) => {
  const stock = Number(value ?? 0);
  return Number.isFinite(stock) ? stock : 0;
};

const defaultProductSearchText = (product: PosProductCatalogCandidate) =>
  [product.name, product.description, product.sku, product.id]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

export const filterPosProductsForCatalog = <
  TProduct extends PosProductCatalogCandidate,
>(
  products: TProduct[],
  filters: PosProductCatalogFilters<TProduct>
) => {
  const normalizedQuery = normalizePosProductFilterText(filters.query ?? "");
  const stockFilter = filters.stockFilter ?? "all";
  const isLowStock = filters.isLowStock ?? defaultIsLowStock;
  const getSearchText =
    filters.getSearchText ?? ((product: TProduct) => defaultProductSearchText(product));

  const productsMatchingStockAndSearch = products.filter((product) => {
    const stock = getNumericStock(product.stock);
    const matchesStockFilter =
      stockFilter === "all"
        ? true
        : stockFilter === "available"
          ? stock > 0
          : stockFilter === "low"
            ? isLowStock(stock)
            : stock <= 0;

    if (!matchesStockFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return normalizePosProductFilterText(getSearchText(product)).includes(
      normalizedQuery
    );
  });

  return filterPosProductsByClassification(productsMatchingStockAndSearch, {
    categoryId: filters.categoryId,
    subcategoryId: filters.subcategoryId,
  });
};

export const resolvePosSubcategoryFilterForCategory = <
  TSubcategory extends Pick<ProductSubcategoryResponse, "id" | "categoryId">,
>(
  subcategoryId: string,
  categoryId: string,
  subcategories: TSubcategory[]
) => {
  const normalizedSubcategoryId = normalizePosClassificationId(subcategoryId);
  const normalizedCategoryId = normalizePosClassificationId(categoryId);

  if (!normalizedSubcategoryId || !normalizedCategoryId) {
    return "";
  }

  return subcategories.some(
    (subcategory) =>
      normalizePosClassificationId(subcategory.id) === normalizedSubcategoryId &&
      normalizePosClassificationId(subcategory.categoryId) === normalizedCategoryId
  )
    ? normalizedSubcategoryId
    : "";
};

export const buildClearedPosProductCatalogFilters = () => ({
  query: "",
  categoryId: "",
  subcategoryId: "",
});

export const sortPosClassificationOptions = <
  TOption extends Pick<ProductCategoryResponse, "name" | "sortOrder">,
>(
  options: TOption[]
) =>
  [...options].sort((left, right) => {
    const byOrder = left.sortOrder - right.sortOrder;
    return byOrder === 0 ? left.name.localeCompare(right.name, "es") : byOrder;
  });

export const resolveEffectivePosProductImage = (
  product: Pick<
    ProductResponse,
    "imageUrl" | "imageAltText" | "categoryId" | "subcategoryId" | "name"
  >,
  lookup: {
    categoryById: Map<string, ProductCategoryResponse>;
    subcategoryById: Map<string, ProductSubcategoryResponse>;
  }
): EffectivePosProductImage => {
  if (product.imageUrl) {
    return {
      imageUrl: product.imageUrl,
      altText: product.imageAltText ?? product.name,
      source: "product",
    };
  }

  const subcategory = product.subcategoryId
    ? lookup.subcategoryById.get(product.subcategoryId)
    : null;

  if (subcategory?.defaultImageUrl) {
    return {
      imageUrl: subcategory.defaultImageUrl,
      altText: subcategory.defaultImageAltText ?? product.name,
      source: "subcategory",
    };
  }

  const category = product.categoryId
    ? lookup.categoryById.get(product.categoryId)
    : null;

  if (category?.defaultImageUrl) {
    return {
      imageUrl: category.defaultImageUrl,
      altText: category.defaultImageAltText ?? product.name,
      source: "category",
    };
  }

  return {
    imageUrl: null,
    altText: product.name,
    source: null,
  };
};
