import type { ProductResponse } from "../../../domains/products/dtos";
import type {
  ProductCategoryResponse,
  ProductSubcategoryResponse,
} from "../../inventory/services/product-classification.service";

export type PosProductClassificationFilters = {
  categoryId?: string;
  subcategoryId?: string;
};

export type EffectivePosProductImage = {
  imageUrl: string | null;
  altText: string | null;
  source: "product" | "subcategory" | "category" | null;
};

const normalizeId = (value?: string | null) => value?.trim() ?? "";

export const filterPosProductsByClassification = <
  TProduct extends Pick<ProductResponse, "categoryId" | "subcategoryId">,
>(
  products: TProduct[],
  filters: PosProductClassificationFilters
) => {
  const categoryId = normalizeId(filters.categoryId);
  const subcategoryId = normalizeId(filters.subcategoryId);

  return products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) {
      return false;
    }

    if (subcategoryId && product.subcategoryId !== subcategoryId) {
      return false;
    }

    return true;
  });
};

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
