import {
  PRODUCT_MEASUREMENT_UNITS,
  PRODUCT_STANDARD_IDENTIFICATION_SCHEMES,
  type ProductMeasurementUnit,
  type ProductSaleType,
  type ProductStandardIdentification,
  type ProductStandardIdentificationScheme,
} from "../entities/product.entity";
import type { ProductImportRawRow } from "./product-import.parser";

export type ProductImportCatalogs = {
  units: Array<{
    id: string;
    name: string;
    abbreviation: string;
    isActive: boolean;
  }>;
  taxes: Array<{
    id: string;
    name: string;
    rate: number;
    isIncluded: boolean;
    isActive: boolean;
    taxTypeCode: string | null;
    calculationMethodCode: string | null;
  }>;
  fiscalCategories: Array<{
    id: string;
    code: string;
    name: string;
    isAlcoholicBeverage: boolean;
  }>;
  fiscalCategoryTaxLinks: Array<{
    taxId: string;
    taxProductCategoryId: string;
  }>;
  categories: Array<{ id: string; name: string; slug: string }>;
  subcategories: Array<{
    id: string;
    categoryId: string;
    name: string;
    slug: string;
  }>;
  branches: Array<{
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  }>;
  accessibleBranchIds: ReadonlySet<string> | null;
  existingProducts: Array<{
    id: string;
    sku: string;
    price: number;
    saleType: ProductSaleType;
    measurementUnit: ProductMeasurementUnit;
    requiresLot: boolean;
    requiresExpiration: boolean;
    isPerishable: boolean;
    categoryId: string | null;
    subcategoryId: string | null;
  }>;
  existingBarcodes: Array<{ barcode: string; productId: string }>;
};

export type ProductImportClassificationRef = {
  id: string | null;
  name: string;
  slug: string;
  isNew: boolean;
};

export type ProductImportTaxAssignment = {
  taxId: string;
  name: string;
  calculationOrder: number;
  isIncluded: boolean;
};

export type ProductImportTaxProfile = {
  taxProductCategoryId: string;
  alcoholDegree: number | null;
  netVolumeMl: number | null;
  daneCertifiedRetailPrice: number | null;
  danePriceEffectiveFrom: string | null;
  danePriceEffectiveTo: string | null;
};

export type ProductImportProductFields = {
  name: string;
  description?: string | null;
  sku: string;
  unitId?: string;
  price?: number;
  cost?: number;
  saleType?: ProductSaleType;
  measurementUnit?: ProductMeasurementUnit;
  standardIdentification?: ProductStandardIdentification | null;
  requiresLot?: boolean;
  requiresExpiration?: boolean;
  isPerishable?: boolean;
  minStock?: number | null;
  maxStock?: number | null;
  isActive?: boolean;
};

export type ProductImportStock = {
  branchId: string;
  branchCode: string;
  quantity: number;
  unitCost: number | null;
  lotCode: string | null;
  expirationDate: string | null;
};

export type ProductImportRowPlan = {
  rowNumber: number;
  sku: string;
  name: string;
  action: "CREATE" | "UPDATE";
  productId: string | null;
  errors: string[];
  warnings: string[];
  unit: { id: string; label: string } | null;
  category: ProductImportClassificationRef | null;
  subcategory: ProductImportClassificationRef | null;
  fiscalCategory: { id: string; code: string; name: string } | null;
  taxes: ProductImportTaxAssignment[] | null;
  taxProfile: ProductImportTaxProfile | null | undefined;
  product: ProductImportProductFields;
  priceChanged: boolean;
  barcode: string | null;
  stock: ProductImportStock | null;
};

export type ProductImportNewSubcategory = {
  categorySlug: string;
  categoryName: string;
  name: string;
  slug: string;
};

export type ProductImportReport = {
  rows: ProductImportRowPlan[];
  newCategories: Array<{ name: string; slug: string }>;
  newSubcategories: ProductImportNewSubcategory[];
  summary: {
    total: number;
    create: number;
    update: number;
    withErrors: number;
    withWarnings: number;
    withStock: number;
  };
  canCommit: boolean;
};

const IVA_5_FISCAL_CODES = new Set([
  "DISTILLED_LIQUOR",
  "LIQUOR_APERITIF",
  "WINE",
  "WINE_APERITIF",
]);
const IVA_19_FISCAL_CODES = new Set(["BEER", "SIPHON", "BEER_MIXTURE"]);
const CONSUMPTION_TAX_TYPES = new Set([
  "LIQUOR_CONSUMPTION",
  "BEER_CONSUMPTION",
  "NATIONAL_CONSUMPTION",
]);

const FISCAL_CATEGORY_ALIASES: Record<string, string> = {
  GENERAL: "GENERAL",
  PRODUCTO_GENERAL: "GENERAL",
  LICOR: "DISTILLED_LIQUOR",
  LICORES: "DISTILLED_LIQUOR",
  LICOR_DESTILADO: "DISTILLED_LIQUOR",
  APERITIVO: "LIQUOR_APERITIF",
  APERITIVO_DE_LICOR: "LIQUOR_APERITIF",
  VINO: "WINE",
  VINOS: "WINE",
  APERITIVO_DE_VINO: "WINE_APERITIF",
  CERVEZA: "BEER",
  CERVEZAS: "BEER",
  SIFON: "SIPHON",
  REFAJO: "BEER_MIXTURE",
  REFAJO_MEZCLA_DE_CERVEZA: "BEER_MIXTURE",
};

const SALE_TYPE_ALIASES: Record<string, ProductSaleType> = {
  UNIDAD: "UNIT",
  UNIT: "UNIT",
  PESO: "WEIGHT",
  WEIGHT: "WEIGHT",
  MIXTO: "BOTH",
  BOTH: "BOTH",
};

const TRUE_VALUES = new Set(["SI", "S", "TRUE", "VERDADERO", "1", "X", "YES", "Y"]);
const FALSE_VALUES = new Set(["NO", "N", "FALSE", "FALSO", "0"]);
const EXEMPT_VALUES = new Set(["EXENTO", "EXENTA", "EXCLUIDO", "EXCLUIDA"]);

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseImportNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s$%]/g, "");
  if (!cleaned) {
    return null;
  }

  let normalized = cleaned;
  const hasDot = cleaned.includes(".");
  const hasComma = cleaned.includes(",");
  if (hasDot && hasComma) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = /^-?[1-9]\d{0,2}(,\d{3})+$/.test(cleaned)
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  } else if (hasDot && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return Number.NaN;
  }
  return Number(normalized);
}

function normalizeRate(rate: number) {
  return rate > 1 ? rate / 100 : rate;
}

function sameRate(left: number, right: number) {
  return Math.abs(normalizeRate(left) - normalizeRate(right)) < 1e-6;
}

function formatPercent(rate: number) {
  return `${Number((normalizeRate(rate) * 100).toFixed(4))}%`;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

class RowContext {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  constructor(readonly raw: ProductImportRawRow) {}

  text(key: keyof ProductImportRawRow["values"]) {
    const value = this.raw.values[key]?.trim();
    return value ? value : undefined;
  }

  number(
    key: keyof ProductImportRawRow["values"],
    options: { min?: number; positive?: boolean } = {}
  ): number | undefined {
    const raw = this.text(key);
    if (raw === undefined) {
      return undefined;
    }
    const value = parseImportNumber(raw);
    if (value === null || !Number.isFinite(value)) {
      this.errors.push(`${key}: "${raw}" no es un número válido.`);
      return undefined;
    }
    if (options.positive && value <= 0) {
      this.errors.push(`${key} debe ser mayor que 0.`);
      return undefined;
    }
    if (options.min !== undefined && value < options.min) {
      this.errors.push(`${key} debe ser mayor o igual a ${options.min}.`);
      return undefined;
    }
    return value;
  }

  boolean(key: keyof ProductImportRawRow["values"]): boolean | undefined {
    const raw = this.text(key);
    if (raw === undefined) {
      return undefined;
    }
    const normalized = normalizeKey(raw);
    if (TRUE_VALUES.has(normalized)) {
      return true;
    }
    if (FALSE_VALUES.has(normalized)) {
      return false;
    }
    this.errors.push(`${key}: "${raw}" debe ser SI o NO.`);
    return undefined;
  }
}

type ResolverState = {
  catalogs: ProductImportCatalogs;
  today: string;
  productsBySku: Map<string, ProductImportCatalogs["existingProducts"][number]>;
  barcodeOwners: Map<string, string>;
  seenSkus: Map<string, number>;
  seenBarcodes: Map<string, number>;
  newCategories: Map<string, { name: string; slug: string }>;
  newSubcategories: Map<string, ProductImportNewSubcategory>;
};

function resolveUnit(row: RowContext, state: ResolverState, required: boolean) {
  const raw = row.text("unidad");
  if (!raw) {
    if (required) {
      row.errors.push("unidad es obligatoria.");
    }
    return null;
  }
  const key = normalizeKey(raw);
  const unit = state.catalogs.units.find(
    (item) =>
      item.isActive &&
      (normalizeKey(item.abbreviation) === key || normalizeKey(item.name) === key)
  );
  if (!unit) {
    row.errors.push(`La unidad "${raw}" no existe o está inactiva en el sistema.`);
    return null;
  }
  return { id: unit.id, label: `${unit.abbreviation} - ${unit.name}` };
}

function resolveSaleModel(
  row: RowContext,
  existing: ProductImportCatalogs["existingProducts"][number] | undefined
) {
  const rawSaleType = row.text("modelo_venta");
  const rawMeasurement = row.text("unidad_comercial");

  let saleType: ProductSaleType | undefined;
  if (rawSaleType) {
    saleType = SALE_TYPE_ALIASES[normalizeKey(rawSaleType)];
    if (!saleType) {
      row.errors.push(
        `modelo_venta: "${rawSaleType}" debe ser UNIDAD, PESO o MIXTO.`
      );
      return {};
    }
  }

  let measurementUnit: ProductMeasurementUnit | undefined;
  if (rawMeasurement) {
    const normalized = normalizeKey(rawMeasurement) as ProductMeasurementUnit;
    if (!PRODUCT_MEASUREMENT_UNITS.includes(normalized)) {
      row.errors.push(
        `unidad_comercial: "${rawMeasurement}" debe ser UND, KG, LB, G u OZ.`
      );
      return {};
    }
    measurementUnit = normalized;
  }

  if (existing && !saleType && !measurementUnit) {
    return {};
  }

  const finalSaleType = saleType ?? existing?.saleType ?? "UNIT";
  const finalMeasurement =
    measurementUnit ??
    (saleType === undefined && existing
      ? existing.measurementUnit
      : finalSaleType === "UNIT"
        ? "UND"
        : "KG");

  if (finalSaleType === "UNIT" && finalMeasurement !== "UND") {
    row.errors.push("Productos por UNIDAD deben usar unidad_comercial UND.");
    return {};
  }
  if (finalSaleType !== "UNIT" && finalMeasurement === "UND") {
    row.errors.push(
      "Productos por PESO o MIXTO deben usar unidad_comercial KG, LB, G u OZ."
    );
    return {};
  }

  return { saleType: finalSaleType, measurementUnit: finalMeasurement };
}

function resolveStandardIdentification(
  row: RowContext,
  sku: string,
  isCreate: boolean
): ProductStandardIdentification | null | undefined {
  const rawScheme = row.text("estandar_dian");
  const rawCode = row.text("codigo_estandar_dian");

  if (!rawScheme && !rawCode) {
    return isCreate ? { scheme: "999", code: sku } : undefined;
  }

  const digits = rawScheme?.match(/\d{1,3}/)?.[0];
  const scheme = (digits ? digits.padStart(3, "0") : "999") as
    ProductStandardIdentificationScheme;
  if (!PRODUCT_STANDARD_IDENTIFICATION_SCHEMES.includes(scheme)) {
    row.errors.push(
      `estandar_dian: "${rawScheme}" debe ser 001, 010, 020 o 999.`
    );
    return undefined;
  }

  const code = rawCode ?? (scheme === "999" ? sku : undefined);
  if (!code) {
    row.errors.push(
      `codigo_estandar_dian es obligatorio para el estándar ${scheme}.`
    );
    return undefined;
  }
  return { scheme, code };
}

function resolveClassification(
  row: RowContext,
  state: ResolverState
): {
  category: ProductImportClassificationRef | null;
  subcategory: ProductImportClassificationRef | null;
} {
  const rawCategory = row.text("categoria");
  const rawSubcategory = row.text("subcategoria");

  if (!rawCategory) {
    if (rawSubcategory) {
      row.errors.push("subcategoria requiere categoria.");
    }
    return { category: null, subcategory: null };
  }

  const categorySlug = slugify(rawCategory);
  if (!categorySlug) {
    row.errors.push(`categoria: "${rawCategory}" no es un nombre válido.`);
    return { category: null, subcategory: null };
  }

  const existingCategory = state.catalogs.categories.find(
    (item) =>
      item.slug === categorySlug || slugify(item.name) === categorySlug
  );
  const category: ProductImportClassificationRef = existingCategory
    ? {
        id: existingCategory.id,
        name: existingCategory.name,
        slug: existingCategory.slug,
        isNew: false,
      }
    : { id: null, name: rawCategory, slug: categorySlug, isNew: true };

  if (category.isNew) {
    if (!state.newCategories.has(categorySlug)) {
      state.newCategories.set(categorySlug, {
        name: rawCategory,
        slug: categorySlug,
      });
    }
    row.warnings.push(`La categoría "${rawCategory}" no existe y se creará.`);
  }

  if (!rawSubcategory) {
    return { category, subcategory: null };
  }

  const subcategorySlug = slugify(rawSubcategory);
  if (!subcategorySlug) {
    row.errors.push(`subcategoria: "${rawSubcategory}" no es un nombre válido.`);
    return { category, subcategory: null };
  }

  const existingSubcategory = category.id
    ? state.catalogs.subcategories.find(
        (item) =>
          item.categoryId === category.id &&
          (item.slug === subcategorySlug ||
            slugify(item.name) === subcategorySlug)
      )
    : undefined;

  if (existingSubcategory) {
    return {
      category,
      subcategory: {
        id: existingSubcategory.id,
        name: existingSubcategory.name,
        slug: existingSubcategory.slug,
        isNew: false,
      },
    };
  }

  const key = `${category.slug}/${subcategorySlug}`;
  if (!state.newSubcategories.has(key)) {
    state.newSubcategories.set(key, {
      categorySlug: category.slug,
      categoryName: category.name,
      name: rawSubcategory,
      slug: subcategorySlug,
    });
  }
  row.warnings.push(
    `La subcategoría "${rawSubcategory}" no existe en "${category.name}" y se creará.`
  );
  return {
    category,
    subcategory: {
      id: null,
      name: rawSubcategory,
      slug: subcategorySlug,
      isNew: true,
    },
  };
}

function findFiscalCategory(raw: string, state: ResolverState) {
  const key = normalizeKey(raw);
  const aliasCode = FISCAL_CATEGORY_ALIASES[key];
  return state.catalogs.fiscalCategories.find(
    (item) =>
      normalizeKey(item.code) === key ||
      normalizeKey(item.name) === key ||
      (aliasCode !== undefined && item.code === aliasCode)
  );
}

function findVatTax(rate: number, state: ResolverState) {
  const candidates = state.catalogs.taxes.filter(
    (tax) =>
      tax.isActive &&
      sameRate(tax.rate, rate) &&
      (tax.taxTypeCode === "VAT" ||
        (tax.taxTypeCode === null && /iva|exent|exclu/i.test(tax.name)))
  );
  return (
    candidates.find((tax) => tax.taxTypeCode === "VAT") ?? candidates[0] ?? null
  );
}

function calculationOrderFor(taxTypeCode: string | null) {
  if (taxTypeCode && CONSUMPTION_TAX_TYPES.has(taxTypeCode)) {
    return 10;
  }
  if (taxTypeCode === "AD_VALOREM") {
    return 20;
  }
  return 50;
}

function resolveFiscal(
  row: RowContext,
  state: ResolverState,
  isCreate: boolean
): {
  fiscalCategory: ProductImportRowPlan["fiscalCategory"];
  taxes: ProductImportTaxAssignment[] | null;
  taxProfile: ProductImportTaxProfile | null | undefined;
} {
  const rawIva = row.text("iva");
  const rawFiscalCategory = row.text("categoria_fiscal");
  const hasProfileData =
    row.text("grado_alcohol") !== undefined ||
    row.text("volumen_ml") !== undefined ||
    row.text("precio_dane") !== undefined;

  if (!isCreate && !rawIva && !rawFiscalCategory) {
    if (hasProfileData) {
      row.warnings.push(
        "grado_alcohol, volumen_ml y precio_dane se ignoran al actualizar si no viene iva o categoria_fiscal."
      );
    }
    return { fiscalCategory: null, taxes: null, taxProfile: undefined };
  }

  const fiscalCategory = findFiscalCategory(rawFiscalCategory ?? "GENERAL", state);
  if (!fiscalCategory) {
    row.errors.push(
      rawFiscalCategory
        ? `categoria_fiscal: "${rawFiscalCategory}" no existe (ver hoja Catalogos).`
        : "No existe la categoría fiscal GENERAL en el sistema."
    );
    return { fiscalCategory: null, taxes: null, taxProfile: undefined };
  }

  const linkedTaxIds = new Set(
    state.catalogs.fiscalCategoryTaxLinks
      .filter((link) => link.taxProductCategoryId === fiscalCategory.id)
      .map((link) => link.taxId)
  );
  const specialTaxes = state.catalogs.taxes.filter(
    (tax) =>
      tax.isActive && linkedTaxIds.has(tax.id) && tax.taxTypeCode !== "VAT"
  );

  let vatRate: number | null = null;
  if (rawIva) {
    if (EXEMPT_VALUES.has(normalizeKey(rawIva))) {
      vatRate = 0;
    } else {
      const parsed = parseImportNumber(rawIva);
      if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
        row.errors.push(`iva: "${rawIva}" debe ser 19, 5, 0 o EXENTO.`);
      } else {
        vatRate = normalizeRate(parsed);
      }
    }
  } else if (IVA_5_FISCAL_CODES.has(fiscalCategory.code)) {
    vatRate = 0.05;
  } else if (IVA_19_FISCAL_CODES.has(fiscalCategory.code)) {
    vatRate = 0.19;
  } else {
    row.errors.push(
      `iva es obligatorio para la categoría fiscal ${fiscalCategory.code}.`
    );
  }

  const taxes: ProductImportTaxAssignment[] = specialTaxes
    .map((tax) => ({
      taxId: tax.id,
      name: tax.name,
      calculationOrder: calculationOrderFor(tax.taxTypeCode),
      isIncluded: tax.isIncluded,
    }))
    .sort((left, right) => left.calculationOrder - right.calculationOrder);

  if (vatRate !== null) {
    const vatTax = findVatTax(vatRate, state);
    if (!vatTax) {
      row.errors.push(
        `No existe un IVA de ${formatPercent(vatRate)} activo en el sistema.`
      );
    } else {
      taxes.push({
        taxId: vatTax.id,
        name: vatTax.name,
        calculationOrder: 100,
        isIncluded: vatTax.isIncluded,
      });
      if (!rawIva) {
        row.warnings.push(
          `IVA ${formatPercent(vatRate)} tomado de la categoría fiscal ${fiscalCategory.name}.`
        );
      }
    }
  }

  const hasNonPercentage = specialTaxes.some(
    (tax) =>
      tax.calculationMethodCode !== null &&
      tax.calculationMethodCode !== "PERCENTAGE"
  );
  const hasAdv = specialTaxes.some((tax) => tax.taxTypeCode === "AD_VALOREM");
  const needsProfile = fiscalCategory.isAlcoholicBeverage || hasNonPercentage;

  const alcoholDegree = row.number("grado_alcohol", { min: 0 });
  const netVolumeMl = row.number("volumen_ml", { positive: true });
  const danePrice = row.number("precio_dane", { positive: true });

  if (needsProfile) {
    if (alcoholDegree === undefined) {
      row.errors.push(
        `grado_alcohol es obligatorio para la categoría fiscal ${fiscalCategory.name}.`
      );
    }
    if (netVolumeMl === undefined) {
      row.errors.push(
        `volumen_ml es obligatorio para la categoría fiscal ${fiscalCategory.name}.`
      );
    }
  }
  if (hasAdv && danePrice === undefined) {
    row.errors.push("precio_dane es obligatorio cuando aplica ad valórem.");
  }

  const profileRequested =
    needsProfile || rawFiscalCategory !== undefined || hasProfileData;
  const taxProfile: ProductImportTaxProfile | null = profileRequested
    ? {
        taxProductCategoryId: fiscalCategory.id,
        alcoholDegree: alcoholDegree ?? null,
        netVolumeMl: netVolumeMl ?? null,
        daneCertifiedRetailPrice: danePrice ?? null,
        danePriceEffectiveFrom: danePrice !== undefined ? state.today : null,
        danePriceEffectiveTo: null,
      }
    : null;

  return {
    fiscalCategory: {
      id: fiscalCategory.id,
      code: fiscalCategory.code,
      name: fiscalCategory.name,
    },
    taxes,
    taxProfile,
  };
}

function resolveFlags(
  row: RowContext,
  existing: ProductImportCatalogs["existingProducts"][number] | undefined
) {
  const requiresLotInput = row.boolean("requiere_lote");
  const requiresExpirationInput = row.boolean("requiere_vencimiento");
  const isPerishableInput = row.boolean("perecedero");

  const requiresExpiration =
    requiresExpirationInput ?? existing?.requiresExpiration ?? false;
  let requiresLot = requiresLotInput ?? existing?.requiresLot ?? false;
  const isPerishable = isPerishableInput ?? existing?.isPerishable ?? false;

  if (requiresExpiration && !requiresLot) {
    if (requiresLotInput === false) {
      row.errors.push("requiere_vencimiento necesita requiere_lote = SI.");
    } else {
      requiresLot = true;
    }
  }
  if (isPerishable && !requiresLot && !requiresExpiration) {
    row.errors.push("perecedero necesita requiere_lote o requiere_vencimiento.");
  }

  const changed =
    requiresLotInput !== undefined ||
    requiresExpirationInput !== undefined ||
    isPerishableInput !== undefined ||
    requiresLot !== (existing?.requiresLot ?? false);

  return {
    requiresLot,
    requiresExpiration,
    isPerishable,
    changed: !existing || changed,
  };
}

function resolveStock(
  row: RowContext,
  state: ResolverState,
  flags: { requiresLot: boolean; requiresExpiration: boolean },
  isUpdate: boolean
): ProductImportStock | null {
  const rawBranch = row.text("sucursal");
  const rawLot = row.text("lote_codigo");
  const rawExpiration = row.text("fecha_vencimiento");
  const hasStockData =
    rawBranch !== undefined ||
    row.text("cantidad") !== undefined ||
    row.text("costo_unitario") !== undefined ||
    rawLot !== undefined ||
    rawExpiration !== undefined;

  if (!hasStockData) {
    return null;
  }

  const quantity = row.number("cantidad", { positive: true });
  if (quantity === undefined) {
    if (row.text("cantidad") === undefined) {
      row.errors.push("cantidad es obligatoria cuando se carga stock.");
    }
    return null;
  }
  const unitCost = row.number("costo_unitario", { min: 0 });

  const activeBranches = state.catalogs.branches.filter((item) => item.isActive);
  let branch: ProductImportCatalogs["branches"][number] | undefined;
  if (rawBranch) {
    const key = normalizeKey(rawBranch);
    branch = state.catalogs.branches.find(
      (item) => normalizeKey(item.code) === key || normalizeKey(item.name) === key
    );
    if (!branch) {
      row.errors.push(`La sucursal "${rawBranch}" no existe.`);
      return null;
    }
    if (!branch.isActive) {
      row.errors.push(`La sucursal "${rawBranch}" está inactiva.`);
      return null;
    }
  } else if (activeBranches.length === 1) {
    branch = activeBranches[0];
  } else {
    row.errors.push("sucursal es obligatoria cuando se carga stock.");
    return null;
  }

  if (
    state.catalogs.accessibleBranchIds &&
    !state.catalogs.accessibleBranchIds.has(branch.id)
  ) {
    row.errors.push(`No tiene acceso a la sucursal "${branch.code}".`);
    return null;
  }

  if (rawExpiration && !isValidIsoDate(rawExpiration)) {
    row.errors.push(
      `fecha_vencimiento: "${rawExpiration}" debe tener formato YYYY-MM-DD.`
    );
  }

  if (flags.requiresLot) {
    if (!rawLot) {
      row.errors.push("lote_codigo es obligatorio porque el producto maneja lote.");
    }
    if (flags.requiresExpiration && !rawExpiration) {
      row.errors.push(
        "fecha_vencimiento es obligatoria porque el producto requiere vencimiento."
      );
    }
  } else {
    if (rawLot || rawExpiration) {
      row.errors.push(
        "El producto no maneja lote: quite lote_codigo y fecha_vencimiento o marque requiere_lote = SI."
      );
    }
    if (unitCost !== undefined) {
      row.warnings.push(
        "costo_unitario solo aplica a productos con lote; se ignora."
      );
    }
  }

  if (isUpdate) {
    row.warnings.push(
      `La cantidad ${quantity} se sumará al stock actual en la sucursal ${branch.code}.`
    );
  }

  return {
    branchId: branch.id,
    branchCode: branch.code,
    quantity,
    unitCost: flags.requiresLot ? unitCost ?? null : null,
    lotCode: flags.requiresLot && rawLot ? rawLot.toUpperCase() : null,
    expirationDate: flags.requiresLot && rawExpiration ? rawExpiration : null,
  };
}

function resolveBarcode(
  row: RowContext,
  state: ResolverState,
  productId: string | null
) {
  const barcode = row.text("codigo_barras");
  if (!barcode) {
    return null;
  }

  const firstRow = state.seenBarcodes.get(barcode);
  if (firstRow !== undefined) {
    row.errors.push(
      `codigo_barras "${barcode}" está repetido en el archivo (fila ${firstRow}).`
    );
    return null;
  }
  state.seenBarcodes.set(barcode, row.raw.rowNumber);

  const owner = state.barcodeOwners.get(barcode);
  if (owner && owner !== productId) {
    row.errors.push(
      `codigo_barras "${barcode}" ya pertenece a otro producto.`
    );
    return null;
  }
  if (owner && owner === productId) {
    return null;
  }
  return barcode;
}

function resolveRow(
  raw: ProductImportRawRow,
  state: ResolverState
): ProductImportRowPlan {
  const row = new RowContext(raw);
  const sku = (row.text("sku") ?? "").toUpperCase();
  const name = row.text("nombre") ?? "";

  if (!sku) {
    row.errors.push("sku es obligatorio.");
  } else {
    const firstRow = state.seenSkus.get(sku);
    if (firstRow !== undefined) {
      row.errors.push(`sku "${sku}" está repetido en el archivo (fila ${firstRow}).`);
    } else {
      state.seenSkus.set(sku, raw.rowNumber);
    }
  }
  if (!name) {
    row.errors.push("nombre es obligatorio.");
  }

  const existing = sku ? state.productsBySku.get(sku) : undefined;
  const isCreate = !existing;
  if (existing) {
    row.warnings.push(`El SKU ${sku} ya existe; el producto se actualizará.`);
  }

  const unit = resolveUnit(row, state, isCreate);
  const price = row.number("precio_venta", { min: 0 });
  const cost = row.number("costo", { min: 0 });
  if (isCreate && price === undefined && row.text("precio_venta") === undefined) {
    row.errors.push("precio_venta es obligatorio.");
  }
  if (isCreate && cost === undefined && row.text("costo") === undefined) {
    row.errors.push("costo es obligatorio.");
  }

  const saleModel = resolveSaleModel(row, existing);
  const standardIdentification = sku
    ? resolveStandardIdentification(row, sku, isCreate)
    : undefined;
  const { category, subcategory } = resolveClassification(row, state);
  const fiscal = resolveFiscal(row, state, isCreate);
  const flags = resolveFlags(row, existing);
  const minStock = row.number("stock_minimo", { min: 0 });
  const maxStock = row.number("stock_maximo", { min: 0 });
  const isActive = row.boolean("activo");
  if (minStock !== undefined && maxStock !== undefined && maxStock < minStock) {
    row.errors.push("stock_maximo debe ser mayor o igual a stock_minimo.");
  }

  const barcode = resolveBarcode(row, state, existing?.id ?? null);
  const stock = resolveStock(row, state, flags, !isCreate);

  const description = row.text("descripcion");
  const product: ProductImportProductFields = {
    name,
    sku,
    ...(description !== undefined ? { description } : {}),
    ...(unit ? { unitId: unit.id } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...saleModel,
    ...(standardIdentification !== undefined ? { standardIdentification } : {}),
    ...(flags.changed
      ? {
          requiresLot: flags.requiresLot,
          requiresExpiration: flags.requiresExpiration,
          isPerishable: flags.isPerishable,
        }
      : {}),
    ...(minStock !== undefined ? { minStock } : {}),
    ...(maxStock !== undefined ? { maxStock } : {}),
    ...(isActive !== undefined ? { isActive } : isCreate ? { isActive: true } : {}),
  };

  const priceChanged =
    !isCreate &&
    price !== undefined &&
    Math.abs(price - (existing?.price ?? 0)) > 0.0001;

  return {
    rowNumber: raw.rowNumber,
    sku,
    name,
    action: isCreate ? "CREATE" : "UPDATE",
    productId: existing?.id ?? null,
    errors: row.errors,
    warnings: row.warnings,
    unit,
    category,
    subcategory,
    fiscalCategory: fiscal.fiscalCategory,
    taxes: fiscal.taxes,
    taxProfile: fiscal.taxProfile,
    product,
    priceChanged,
    barcode,
    stock,
  };
}

export function resolveProductImport(
  rows: ProductImportRawRow[],
  catalogs: ProductImportCatalogs,
  options: { today: string }
): ProductImportReport {
  const state: ResolverState = {
    catalogs,
    today: options.today,
    productsBySku: new Map(
      catalogs.existingProducts.map((product) => [
        product.sku.trim().toUpperCase(),
        product,
      ])
    ),
    barcodeOwners: new Map(
      catalogs.existingBarcodes.map((item) => [item.barcode, item.productId])
    ),
    seenSkus: new Map(),
    seenBarcodes: new Map(),
    newCategories: new Map(),
    newSubcategories: new Map(),
  };

  const plans = rows.map((row) => resolveRow(row, state));
  const withErrors = plans.filter((plan) => plan.errors.length > 0).length;

  return {
    rows: plans,
    newCategories: [...state.newCategories.values()],
    newSubcategories: [...state.newSubcategories.values()],
    summary: {
      total: plans.length,
      create: plans.filter((plan) => plan.action === "CREATE").length,
      update: plans.filter((plan) => plan.action === "UPDATE").length,
      withErrors,
      withWarnings: plans.filter((plan) => plan.warnings.length > 0).length,
      withStock: plans.filter((plan) => plan.stock !== null).length,
    },
    canCommit: plans.length > 0 && withErrors === 0,
  };
}
