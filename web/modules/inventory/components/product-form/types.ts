import type {
  ProductMeasurementUnit,
  ProductOperationalStatus,
  ProductRotationClass,
  ProductSaleType,
} from "../../../../domains/products/dtos";
import type { TaxCatalogItem } from "../../services/tax.service";
import type {
  ProductCategoryResponse,
  ProductSubcategoryResponse,
} from "../../services/product-classification.service";

export type ProductOption = {
  id: string;
  label: string;
};

export type TaxInfo = {
  id: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  label: string;
  calculationMethodCode: string | null;
  taxTypeCode: string | null;
};

export type AssignedTaxRow = {
  taxId: string;
  calculationOrder: string;
  isIncluded: boolean;
};

export type ProductFormValues = {
  name: string;
  sku: string;
  standardIdentificationScheme: "" | "001" | "010" | "020" | "999";
  standardIdentificationCode: string;
  price: string;
  priceWithTax: string;
  priceWithoutTax: string;
  cost: string;
  unitId: string;
  taxId: string;
  assignedTaxes: AssignedTaxRow[];
  taxProductCategoryId: string;
  alcoholDegree: string;
  netVolumeMl: string;
  daneCertifiedRetailPrice: string;
  danePriceEffectiveFrom: string;
  danePriceEffectiveTo: string;
  isActive: boolean;
  isPerishable: boolean;
  requiresLot: boolean;
  requiresExpiration: boolean;
  operationalStatus: ProductOperationalStatus;
  rotationClass: "" | ProductRotationClass;
  saleType: ProductSaleType;
  measurementUnit: ProductMeasurementUnit;
  minStock: string;
  maxStock: string;
  categoryId: string;
  subcategoryId: string;
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>> & {
  assignedTaxes?: string;
  taxProfile?: string;
  submit?: string;
};

export type ProductFormMode = "create" | "edit";

export const operationalStatusOptions: Array<{
  value: ProductOperationalStatus;
  label: string;
}> = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "BLOCKED", label: "Bloqueado" },
  { value: "DISCONTINUED", label: "Descontinuado" },
];

export const rotationClassOptions: Array<{
  value: ProductRotationClass;
  label: string;
}> = [
  { value: "HIGH", label: "Alta rotacion" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Baja" },
  { value: "NO_MOVEMENT", label: "Sin movimiento" },
];

export const saleTypeOptions: Array<{ value: ProductSaleType; label: string }> = [
  { value: "UNIT", label: "Unidad" },
  { value: "WEIGHT", label: "Peso" },
  { value: "BOTH", label: "Unidad y peso" },
];

export const measurementUnitOptions: Array<{
  value: ProductMeasurementUnit;
  label: string;
}> = [
  { value: "UND", label: "UND - Unidad" },
  { value: "KG", label: "KG - Kilogramo" },
  { value: "LB", label: "LB - Libra" },
  { value: "G", label: "G - Gramo" },
  { value: "OZ", label: "OZ - Onza" },
];

export type ClassificationLists = {
  categories: ProductCategoryResponse[];
  subcategories: ProductSubcategoryResponse[];
  categoriesPath: string;
  categoriesLoading: boolean;
  subcategoriesLoading: boolean;
  categoriesError: string | null;
  subcategoriesError: string | null;
};

export type FiscalCatalogs = {
  taxOptions: TaxInfo[];
  taxProductCategories: TaxCatalogItem[];
  catalogLoading: boolean;
  bridgeTax: TaxInfo | null;
  hasNonPercentageTax: boolean;
};
