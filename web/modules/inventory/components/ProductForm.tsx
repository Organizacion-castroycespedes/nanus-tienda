"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { InventoryImageUploadPanel } from "./InventoryImageUploadPanel";
import type {
  ProductMeasurementUnit,
  ProductOperationalStatus,
  ProductResponse,
  ProductRotationClass,
  ProductSaleType,
} from "../../../domains/products/dtos";
import {
  getTaxCatalogs,
  getTaxes,
  type TaxCatalogItem,
  type TaxResponse,
} from "../services/tax.service";
import {
  getUnits,
  type UnitResponse,
} from "../services/unit.service";
import {
  createProduct,
  deleteProductImage,
  getProduct,
  updateProduct,
  uploadProductImage,
  type CreateProductPayload,
  type UpdateProductPayload,
} from "../services/product.service";
import {
  listProductCategories,
  listProductSubcategoriesByCategory,
  type ProductCategoryResponse,
  type ProductSubcategoryResponse,
} from "../services/product-classification.service";
import {
  buildProductClassificationPayload,
  getProductClassificationErrorMessage,
  resolveSubcategoryForCategory,
  validateProductClassificationSelection,
} from "../utils/product-classification";

type ProductOption = {
  id: string;
  label: string;
};

type TaxInfo = {
  id: string;
  name: string;
  rate: number;
  isIncluded: boolean;
  label: string;
  calculationMethodCode: string | null;
  taxTypeCode: string | null;
};

type AssignedTaxRow = {
  taxId: string;
  calculationOrder: string;
};

type ProductFormValues = {
  name: string;
  sku: string;
  standardIdentificationScheme: "" | "001" | "010" | "020" | "999";
  standardIdentificationCode: string;
  price: string;
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

type ProductFormErrors = Partial<Record<keyof ProductFormValues, string>> & {
  assignedTaxes?: string;
  taxProfile?: string;
  submit?: string;
};

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
  onImageChange?: (product: ProductResponse) => void;
};

const createInitialValues = (product?: ProductResponse | null): ProductFormValues => {
  const assignedTaxes =
    product?.taxes && product.taxes.length > 0
      ? product.taxes.map((tax) => ({
          taxId: tax.taxId,
          calculationOrder: String(tax.calculationOrder),
        }))
      : product?.taxId
        ? [{ taxId: product.taxId, calculationOrder: "100" }]
        : [];

  return {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    standardIdentificationScheme: product?.standardIdentification?.scheme ?? (product ? "" : "999"),
    standardIdentificationCode:
      product?.standardIdentification?.code ?? (product ? "" : ""),
    price: product ? String(product.price) : "",
    cost: product ? String(product.cost) : "",
    unitId: product?.unitId ?? "",
    taxId: product?.taxId ?? "",
    assignedTaxes,
    taxProductCategoryId: product?.taxProfile?.taxProductCategoryId ?? "",
    alcoholDegree:
      product?.taxProfile?.alcoholDegree === null ||
      product?.taxProfile?.alcoholDegree === undefined
        ? ""
        : String(product.taxProfile.alcoholDegree),
    netVolumeMl:
      product?.taxProfile?.netVolumeMl === null ||
      product?.taxProfile?.netVolumeMl === undefined
        ? ""
        : String(product.taxProfile.netVolumeMl),
    daneCertifiedRetailPrice:
      product?.taxProfile?.daneCertifiedRetailPrice === null ||
      product?.taxProfile?.daneCertifiedRetailPrice === undefined
        ? ""
        : String(product.taxProfile.daneCertifiedRetailPrice),
    danePriceEffectiveFrom: product?.taxProfile?.danePriceEffectiveFrom ?? "",
    danePriceEffectiveTo: product?.taxProfile?.danePriceEffectiveTo ?? "",
    isActive: product?.isActive ?? true,
    isPerishable: product?.isPerishable ?? false,
    requiresLot: product?.requiresLot ?? false,
    requiresExpiration: product?.requiresExpiration ?? false,
    operationalStatus: product?.operationalStatus ?? "ACTIVE",
    rotationClass: product?.rotationClass ?? "",
    saleType: product?.saleType ?? "UNIT",
    measurementUnit: product?.measurementUnit ?? "UND",
    minStock:
      product?.minStock === null || product?.minStock === undefined
        ? ""
        : String(product.minStock),
    maxStock:
      product?.maxStock === null || product?.maxStock === undefined
        ? ""
        : String(product.maxStock),
    categoryId: product?.categoryId ?? "",
    subcategoryId: product?.subcategoryId ?? "",
  };
};

const isValidNumber = (value: string) => value.trim() !== "" && !Number.isNaN(Number(value));
const isOptionalNumber = (value: string) => value.trim() === "" || !Number.isNaN(Number(value));
const optionalNumber = (value: string) => (value.trim() === "" ? null : Number(value));

const operationalStatusOptions: Array<{ value: ProductOperationalStatus; label: string }> = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "BLOCKED", label: "Bloqueado" },
  { value: "DISCONTINUED", label: "Descontinuado" },
];

const rotationClassOptions: Array<{ value: ProductRotationClass; label: string }> = [
  { value: "HIGH", label: "Alta rotacion" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Baja" },
  { value: "NO_MOVEMENT", label: "Sin movimiento" },
];

const saleTypeOptions: Array<{ value: ProductSaleType; label: string }> = [
  { value: "UNIT", label: "Unidad" },
  { value: "WEIGHT", label: "Peso" },
  { value: "BOTH", label: "Unidad y peso" },
];

const measurementUnitOptions: Array<{
  value: ProductMeasurementUnit;
  label: string;
}> = [
  { value: "UND", label: "UND - Unidad" },
  { value: "KG", label: "KG - Kilogramo" },
  { value: "LB", label: "LB - Libra" },
  { value: "G", label: "G - Gramo" },
  { value: "OZ", label: "OZ - Onza" },
];

export const ProductForm = ({
  mode,
  product,
  onCancel,
  onSuccess,
  onImageChange,
}: ProductFormProps) => {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params?.tenant ?? "default";
  const [values, setValues] = useState<ProductFormValues>(createInitialValues(product));
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unitOptions, setUnitOptions] = useState<ProductOption[]>([]);
  const [taxOptions, setTaxOptions] = useState<TaxInfo[]>([]);
  const [taxProductCategories, setTaxProductCategories] = useState<
    TaxCatalogItem[]
  >([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [categories, setCategories] = useState<ProductCategoryResponse[]>([]);
  const [subcategories, setSubcategories] = useState<ProductSubcategoryResponse[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [subcategoriesError, setSubcategoriesError] = useState<string | null>(null);
  const [imageProduct, setImageProduct] = useState<ProductResponse | null>(
    product ?? null
  );

  useEffect(() => {
    setValues(createInitialValues(product));
    setErrors({});
    setImageProduct(product ?? null);
  }, [mode, product]);

  useEffect(() => {
    if (mode !== "edit" || !product?.id) {
      return;
    }

    let mounted = true;
    void (async () => {
      try {
        const detailed = await getProduct(product.id);
        if (!mounted) {
          return;
        }
        setValues(createInitialValues(detailed));
        setImageProduct(detailed);
      } catch {
        // Keep list snapshot if detail hydrate fails.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [mode, product?.id]);

  useEffect(() => {
    let mounted = true;

    const loadCatalogs = async () => {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const [units, taxes, taxCatalogs] = await Promise.all([
          getUnits(),
          getTaxes(),
          getTaxCatalogs(),
        ]);

        if (!mounted) {
          return;
        }

        setUnitOptions(
          units.map((unit: UnitResponse) => ({
            id: unit.id,
            label: `${unit.name} (${unit.abbreviation})`,
          }))
        );
        setTaxOptions(
          taxes.map((tax: TaxResponse) => ({
            id: tax.id,
            name: tax.name,
            rate: tax.rate,
            isIncluded: tax.isIncluded,
            calculationMethodCode: tax.calculationMethodCode ?? null,
            taxTypeCode: tax.taxTypeCode ?? null,
            label: `${tax.name} (${(tax.rate * 100).toFixed(2)}%)`,
          }))
        );
        setTaxProductCategories(taxCatalogs.productCategories);
      } catch {
        if (!mounted) {
          return;
        }
        setCatalogError("No se pudieron cargar unidades e impuestos.");
      } finally {
        if (mounted) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalogs();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      setCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const result = await listProductCategories();
        if (!mounted) {
          return;
        }
        setCategories(result);
      } catch (error) {
        if (!mounted) {
          return;
        }
        setCategoriesError(
          getProductClassificationErrorMessage(
            error,
            "No se pudieron cargar las categorias."
          )
        );
      } finally {
        if (mounted) {
          setCategoriesLoading(false);
        }
      }
    };

    void loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const categoryId = values.categoryId;

    if (!categoryId) {
      setSubcategories([]);
      setSubcategoriesError(null);
      setSubcategoriesLoading(false);
      setValues((current) =>
        current.subcategoryId ? { ...current, subcategoryId: "" } : current
      );
      return () => {
        mounted = false;
      };
    }

    const loadSubcategories = async () => {
      setSubcategoriesLoading(true);
      setSubcategoriesError(null);

      try {
        const result = await listProductSubcategoriesByCategory(categoryId);
        if (!mounted) {
          return;
        }
        setSubcategories(result);
        setValues((current) => {
          if (current.categoryId !== categoryId || !current.subcategoryId) {
            return current;
          }
          const nextSubcategoryId = resolveSubcategoryForCategory(
            current.subcategoryId,
            categoryId,
            result
          );
          return nextSubcategoryId === current.subcategoryId
            ? current
            : { ...current, subcategoryId: "" };
        });
      } catch (error) {
        if (!mounted) {
          return;
        }
        setSubcategories([]);
        setSubcategoriesError(
          getProductClassificationErrorMessage(
            error,
            "No se pudieron cargar las subcategorias."
          )
        );
      } finally {
        if (mounted) {
          setSubcategoriesLoading(false);
        }
      }
    };

    void loadSubcategories();

    return () => {
      mounted = false;
    };
  }, [values.categoryId]);

  const setFieldValue = <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  };

  const setCategoryValue = (categoryId: string) => {
    setValues((prev) => ({
      ...prev,
      categoryId,
      subcategoryId: prev.categoryId === categoryId ? prev.subcategoryId : "",
    }));
    setErrors((prev) => ({
      ...prev,
      categoryId: undefined,
      subcategoryId: undefined,
      submit: undefined,
    }));
  };

  const setSubcategoryValue = (subcategoryId: string) => {
    setValues((prev) => ({ ...prev, subcategoryId }));
    setErrors((prev) => ({
      ...prev,
      subcategoryId: undefined,
      submit: undefined,
    }));
  };

  const setOperationalValue = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K]
  ) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "requiresExpiration" && value === true) {
        next.requiresLot = true;
      }
      if (field === "requiresLot" && value === false) {
        next.requiresExpiration = false;
      }

      return next;
    });
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      requiresLot: undefined,
      requiresExpiration: undefined,
      isPerishable: undefined,
      submit: undefined,
    }));
  };

  const setSaleModelValue = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K]
  ) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "saleType") {
        if (value === "UNIT") {
          next.measurementUnit = "UND";
        }
        if (
          (value === "WEIGHT" || value === "BOTH") &&
          next.measurementUnit === "UND"
        ) {
          next.measurementUnit = "KG";
        }
      }

      return next;
    });
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
      saleType: undefined,
      measurementUnit: undefined,
      submit: undefined,
    }));
  };

  const assignedTaxDetails = useMemo(
    () =>
      values.assignedTaxes
        .map((assignment) => ({
          ...assignment,
          tax: taxOptions.find((tax) => tax.id === assignment.taxId) ?? null,
        }))
        .filter((item) => item.taxId),
    [taxOptions, values.assignedTaxes]
  );

  const bridgeTax = useMemo(() => {
    const ordered = [...assignedTaxDetails].sort(
      (left, right) =>
        Number(left.calculationOrder || 0) - Number(right.calculationOrder || 0)
    );
    return (
      ordered.find(
        (item) =>
          !item.tax?.calculationMethodCode ||
          item.tax.calculationMethodCode === "PERCENTAGE"
      )?.tax ?? null
    );
  }, [assignedTaxDetails]);

  const hasNonPercentageTax = assignedTaxDetails.some(
    (item) =>
      item.tax?.calculationMethodCode != null &&
      item.tax.calculationMethodCode !== "PERCENTAGE"
  );
  const hasAdvTax = assignedTaxDetails.some(
    (item) => item.tax?.taxTypeCode === "AD_VALOREM"
  );
  const selectedTaxCategory =
    taxProductCategories.find(
      (item) => item.id === values.taxProductCategoryId
    ) ?? null;

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, "es")
      ),
    [categories]
  );
  const sortedSubcategories = useMemo(
    () =>
      [...subcategories].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, "es")
      ),
    [subcategories]
  );
  const categoriesPath = `/${tenantSlug}/inventory/product-categories`;
  const currentImageProduct = imageProduct ?? product ?? null;

  const handleImageUpload = async (file: File) => {
    if (!product?.id) {
      throw new Error("Guarda primero el producto para poder cargar imagen.");
    }
    const updated = await uploadProductImage(
      product.id,
      file,
      values.name.trim() || product.name
    );
    setImageProduct(updated);
    onImageChange?.(updated);
  };

  const handleImageDelete = async () => {
    if (!product?.id) {
      throw new Error("Guarda primero el producto para poder eliminar imagen.");
    }
    const updated = await deleteProductImage(product.id);
    setImageProduct(updated);
    onImageChange?.(updated);
  };

  const validate = () => {
    const nextErrors: ProductFormErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "El nombre es requerido.";
    }
    if (!values.sku.trim()) {
      nextErrors.sku = "El SKU es requerido.";
    }
    if (values.standardIdentificationScheme && !values.standardIdentificationCode.trim()) {
      nextErrors.standardIdentificationCode =
        "El código estándar es requerido cuando seleccionas un esquema DIAN.";
    }
    if (!values.standardIdentificationScheme && values.standardIdentificationCode.trim()) {
      nextErrors.standardIdentificationCode =
        "Selecciona un esquema DIAN para guardar este código.";
    }
    if (values.standardIdentificationCode.trim().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      nextErrors.standardIdentificationCode =
        "El UUID interno no es una identificación estándar DIAN.";
    }
    if (!isValidNumber(values.price)) {
      nextErrors.price = "El precio es requerido.";
    } else if (Number(values.price) <= 0) {
      nextErrors.price = "El precio debe ser mayor a 0.";
    }
    if (!isValidNumber(values.cost)) {
      nextErrors.cost = "El costo es requerido.";
    } else if (Number(values.cost) < 0) {
      nextErrors.cost = "El costo debe ser mayor o igual a 0.";
    }
    if (!values.unitId) {
      nextErrors.unitId = "Debes seleccionar una unidad.";
    }
    if (values.requiresExpiration && !values.requiresLot) {
      nextErrors.requiresLot = "Requiere lote cuando el producto exige vencimiento.";
    }
    if (values.isPerishable && !values.requiresLot && !values.requiresExpiration) {
      nextErrors.isPerishable = "Marca lote o vencimiento para productos perecederos.";
    }
    if (!values.saleType) {
      nextErrors.saleType = "Debes seleccionar el modelo de venta.";
    }
    if (!values.measurementUnit) {
      nextErrors.measurementUnit = "Debes seleccionar la unidad comercial.";
    }
    if (values.saleType === "UNIT" && values.measurementUnit !== "UND") {
      nextErrors.measurementUnit = "Productos por unidad deben usar UND.";
    }
    if (values.saleType !== "UNIT" && values.measurementUnit === "UND") {
      nextErrors.measurementUnit =
        "Productos por peso deben usar KG, LB, G u OZ.";
    }
    if (!isOptionalNumber(values.minStock)) {
      nextErrors.minStock = "El stock minimo debe ser numerico.";
    } else if (optionalNumber(values.minStock) !== null && Number(values.minStock) < 0) {
      nextErrors.minStock = "El stock minimo no puede ser negativo.";
    }
    if (!isOptionalNumber(values.maxStock)) {
      nextErrors.maxStock = "El stock maximo debe ser numerico.";
    } else if (optionalNumber(values.maxStock) !== null && Number(values.maxStock) < 0) {
      nextErrors.maxStock = "El stock maximo no puede ser negativo.";
    }

    const minStock = optionalNumber(values.minStock);
    const maxStock = optionalNumber(values.maxStock);
    if (minStock !== null && maxStock !== null && maxStock < minStock) {
      nextErrors.maxStock = "El stock maximo debe ser mayor o igual al minimo.";
    }
    const classificationError = validateProductClassificationSelection(
      {
        categoryId: values.categoryId,
        subcategoryId: values.subcategoryId,
      },
      subcategories
    );
    if (classificationError) {
      nextErrors.subcategoryId = classificationError;
    }

    const taxIds = values.assignedTaxes.map((item) => item.taxId).filter(Boolean);
    if (new Set(taxIds).size !== taxIds.length) {
      nextErrors.assignedTaxes = "No se permiten impuestos duplicados.";
    }
    for (const assignment of values.assignedTaxes) {
      if (!assignment.taxId) {
        nextErrors.assignedTaxes = "Selecciona un impuesto en cada fila.";
        break;
      }
      if (
        assignment.calculationOrder.trim() === "" ||
        Number.isNaN(Number(assignment.calculationOrder)) ||
        Number(assignment.calculationOrder) <= 0
      ) {
        nextErrors.assignedTaxes = "El orden de calculo debe ser mayor a 0.";
        break;
      }
    }

    if (hasNonPercentageTax || selectedTaxCategory?.isAlcoholicBeverage) {
      if (!values.taxProductCategoryId) {
        nextErrors.taxProductCategoryId = "La categoria fiscal es requerida.";
      }
      if (
        values.alcoholDegree.trim() === "" ||
        Number.isNaN(Number(values.alcoholDegree))
      ) {
        nextErrors.alcoholDegree = "El grado alcoholico es requerido.";
      }
      if (
        values.netVolumeMl.trim() === "" ||
        Number.isNaN(Number(values.netVolumeMl)) ||
        Number(values.netVolumeMl) <= 0
      ) {
        nextErrors.netVolumeMl = "El volumen neto (ml) debe ser mayor a 0.";
      }
    }
    if (
      hasAdvTax &&
      (values.daneCertifiedRetailPrice.trim() === "" ||
        Number.isNaN(Number(values.daneCertifiedRetailPrice)))
    ) {
      nextErrors.daneCertifiedRetailPrice =
        "El precio DANE es requerido cuando hay ADV.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const orderedTaxes = [...values.assignedTaxes]
      .filter((item) => item.taxId)
      .sort(
        (left, right) =>
          Number(left.calculationOrder) - Number(right.calculationOrder)
      );
    const bridgeTaxId =
      orderedTaxes.find((assignment) => {
        const tax = taxOptions.find((item) => item.id === assignment.taxId);
        return (
          !tax?.calculationMethodCode ||
          tax.calculationMethodCode === "PERCENTAGE"
        );
      })?.taxId ?? null;

    const payload: CreateProductPayload = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      standardIdentification:
        values.standardIdentificationScheme && values.standardIdentificationCode.trim()
          ? {
              scheme: values.standardIdentificationScheme,
              code: values.standardIdentificationCode.trim(),
            }
          : null,
      price: Number(values.price),
      cost: Number(values.cost),
      unitId: values.unitId,
      taxId: bridgeTaxId,
      taxes: orderedTaxes.map((item) => ({
        taxId: item.taxId,
        calculationOrder: Number(item.calculationOrder),
      })),
      taxProfile:
        values.taxProductCategoryId || hasNonPercentageTax
          ? {
              taxProductCategoryId: values.taxProductCategoryId,
              alcoholDegree: optionalNumber(values.alcoholDegree),
              netVolumeMl: optionalNumber(values.netVolumeMl),
              daneCertifiedRetailPrice: optionalNumber(
                values.daneCertifiedRetailPrice
              ),
              danePriceEffectiveFrom: values.danePriceEffectiveFrom || null,
              danePriceEffectiveTo: values.danePriceEffectiveTo || null,
            }
          : null,
      isActive: values.isActive,
      isPerishable: values.isPerishable,
      requiresLot: values.requiresLot,
      requiresExpiration: values.requiresExpiration,
      operationalStatus: values.operationalStatus,
      rotationClass: values.rotationClass || null,
      saleType: values.saleType,
      measurementUnit: values.measurementUnit,
      minStock: optionalNumber(values.minStock),
      maxStock: optionalNumber(values.maxStock),
      ...buildProductClassificationPayload({
        categoryId: values.categoryId,
        subcategoryId: values.subcategoryId,
      }),
    };

    setIsSubmitting(true);
    setErrors({});

    try {
      const savedProduct =
        mode === "create"
          ? await createProduct(payload)
          : await updateProduct(product!.id, {
              ...payload,
              price: undefined,
              priceWithTax: undefined,
              priceWithoutTax: undefined,
            } as UpdateProductPayload);

      void savedProduct;
      onSuccess(mode);
    } catch (error) {
      setErrors({
        submit:
          getProductClassificationErrorMessage(
            error,
            mode === "create"
              ? "No se pudo crear el producto."
              : "No se pudo actualizar el producto."
          ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Producto</p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {mode === "create" ? "Crear producto" : "Editar producto"}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Completa los campos requeridos para guardar el producto.
          </p>
        </div>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>

      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Nombre"
              required
              value={values.name}
              onChange={(event) => setFieldValue("name", event.target.value)}
              placeholder="Ej: Arroz premium"
            />
            {errors.name ? <p className="text-xs text-rose-600">{errors.name}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="SKU"
              required
              value={values.sku}
              onChange={(event) => {
                const sku = event.target.value;
                setFieldValue("sku", sku);
                if (mode === "create" && values.standardIdentificationScheme === "999" && !values.standardIdentificationCode.trim()) {
                  setFieldValue("standardIdentificationCode", sku);
                }
              }}
              placeholder="Ej: ARR-001"
            />
            {errors.sku ? <p className="text-xs text-rose-600">{errors.sku}</p> : null}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
            <Select
              label="Estándar de identificación DIAN"
              value={values.standardIdentificationScheme}
              onChange={(event) => {
                const scheme = event.target.value as ProductFormValues["standardIdentificationScheme"];
                setFieldValue("standardIdentificationScheme", scheme);
                if (scheme === "999" && !values.standardIdentificationCode.trim()) {
                  setFieldValue("standardIdentificationCode", values.sku);
                }
                if (scheme !== "999" && values.standardIdentificationScheme === "999") {
                  setFieldValue("standardIdentificationCode", "");
                }
              }}
              hint="999 permite el código persistente adoptado por el contribuyente; al crear, inicia con el SKU. 001, 010 y 020 requieren su código real."
            >
              <option value="">Sin estándar registrado</option>
              <option value="001">001 — UNSPSC</option>
              <option value="010">010 — GTIN</option>
              <option value="020">020 — Partida arancelaria</option>
              <option value="999">999 — Estándar adoptado por el contribuyente</option>
            </Select>
              <button
                type="button"
                aria-label="Ayuda sobre estándares de identificación DIAN"
                title="001 UNSPSC, 010 GTIN, 020 partida arancelaria, 999 código adoptado por el contribuyente."
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                ?
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <Input
              label="Código estándar DIAN"
              value={values.standardIdentificationCode}
              onChange={(event) =>
                setFieldValue("standardIdentificationCode", event.target.value)
              }
              placeholder="Código real del producto"
              disabled={!values.standardIdentificationScheme}
            />
            <p className="text-xs text-slate-500" role="note">
              999: código propio persistente. 001: UNSPSC. 010: GTIN. 020: partida arancelaria.
            </p>
            {errors.standardIdentificationCode ? (
              <p className="text-xs text-rose-600">{errors.standardIdentificationCode}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Precio"
              required={mode === "create"}
              type="number"
              min="0"
              step="0.01"
              value={values.price}
              onChange={(event) => setFieldValue("price", event.target.value)}
              placeholder="0.00"
              disabled={mode === "edit"}
              className={mode === "edit" ? "bg-slate-100 text-slate-500" : undefined}
              hint={
                mode === "edit"
                  ? "Para trazabilidad use Cambiar precio desde el listado."
                  : undefined
              }
            />
            {errors.price ? <p className="text-xs text-rose-600">{errors.price}</p> : null}
          </div>

          <div className="space-y-1">
            <Input
              label="Costo"
              required
              type="number"
              min="0"
              step="0.01"
              value={values.cost}
              onChange={(event) => setFieldValue("cost", event.target.value)}
              placeholder="0.00"
            />
            {errors.cost ? <p className="text-xs text-rose-600">{errors.cost}</p> : null}
          </div>

          <div className="space-y-1">
            <Select
              label="Unidad"
              required
              value={values.unitId}
              onChange={(event) => setFieldValue("unitId", event.target.value)}
              disabled={catalogLoading || unitOptions.length === 0}
              hint={
                unitOptions.length === 0
                  ? "Aun no hay unidades disponibles para seleccionar."
                  : undefined
              }
            >
              <option value="">Selecciona una unidad</option>
              {unitOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
            {errors.unitId ? <p className="text-xs text-rose-600">{errors.unitId}</p> : null}
          </div>

          <div className="space-y-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Impuestos del producto
              </p>
              <Button
                type="button"
                variant="ghost"
                disabled={catalogLoading}
                onClick={() =>
                  setValues((prev) => ({
                    ...prev,
                    assignedTaxes: [
                      ...prev.assignedTaxes,
                      {
                        taxId: "",
                        calculationOrder: String(
                          (prev.assignedTaxes.length + 1) * 100
                        ),
                      },
                    ],
                  }))
                }
              >
                Agregar impuesto
              </Button>
            </div>

            {values.assignedTaxes.length === 0 ? (
              <p className="text-sm text-slate-500">
                Sin impuestos. El POS tratara el producto como exento/sin tributo.
              </p>
            ) : null}

            {values.assignedTaxes.map((assignment, index) => (
              <div
                key={`${assignment.taxId}-${index}`}
                className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_120px_auto]"
              >
                <Select
                  label={`Impuesto #${index + 1}`}
                  value={assignment.taxId}
                  disabled={catalogLoading}
                  onChange={(event) =>
                    setValues((prev) => {
                      const next = [...prev.assignedTaxes];
                      next[index] = {
                        ...next[index],
                        taxId: event.target.value,
                      };
                      return { ...prev, assignedTaxes: next };
                    })
                  }
                >
                  <option value="">Selecciona impuesto</option>
                  {taxOptions.map((option) => (
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
                    setValues((prev) => {
                      const next = [...prev.assignedTaxes];
                      next[index] = {
                        ...next[index],
                        calculationOrder: event.target.value,
                      };
                      return { ...prev, assignedTaxes: next };
                    })
                  }
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setValues((prev) => ({
                        ...prev,
                        assignedTaxes: prev.assignedTaxes.filter(
                          (_item, itemIndex) => itemIndex !== index
                        ),
                      }))
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

            {bridgeTax ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">POS usara: {bridgeTax.name}</p>
                <p>Porcentaje puente: {(bridgeTax.rate * 100).toFixed(2)}%</p>
                <p>
                  {bridgeTax.isIncluded
                    ? "El precio ya incluye impuestos"
                    : "El impuesto no esta incluido en el precio"}
                </p>
                {hasNonPercentageTax ? (
                  <p className="mt-2">
                    ICL/ADV se calculan en caja con el perfil fiscal (grado, ml,
                    DANE). El porcentaje puente sigue siendo el IVA de POS.
                  </p>
                ) : null}
              </div>
            ) : null}

            {(hasNonPercentageTax ||
              selectedTaxCategory?.isAlcoholicBeverage ||
              values.taxProductCategoryId) && (
              <div className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
                <Select
                  label="Categoria fiscal"
                  value={values.taxProductCategoryId}
                  onChange={(event) =>
                    setFieldValue("taxProductCategoryId", event.target.value)
                  }
                >
                  <option value="">Selecciona categoria</option>
                  {taxProductCategories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Grado alcoholico"
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  value={values.alcoholDegree}
                  onChange={(event) =>
                    setFieldValue("alcoholDegree", event.target.value)
                  }
                />
                <Input
                  label="Volumen neto (ml)"
                  type="number"
                  min="0"
                  step="0.001"
                  value={values.netVolumeMl}
                  onChange={(event) =>
                    setFieldValue("netVolumeMl", event.target.value)
                  }
                />
                <Input
                  label="Precio DANE certificado"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.daneCertifiedRetailPrice}
                  onChange={(event) =>
                    setFieldValue("daneCertifiedRetailPrice", event.target.value)
                  }
                />
                <Input
                  label="DANE vigente desde"
                  type="date"
                  value={values.danePriceEffectiveFrom}
                  onChange={(event) =>
                    setFieldValue("danePriceEffectiveFrom", event.target.value)
                  }
                />
                <Input
                  label="DANE vigente hasta"
                  type="date"
                  value={values.danePriceEffectiveTo}
                  onChange={(event) =>
                    setFieldValue("danePriceEffectiveTo", event.target.value)
                  }
                />
                {errors.taxProductCategoryId ? (
                  <p className="text-xs text-rose-600 md:col-span-2">
                    {errors.taxProductCategoryId}
                  </p>
                ) : null}
                {errors.alcoholDegree ? (
                  <p className="text-xs text-rose-600">{errors.alcoholDegree}</p>
                ) : null}
                {errors.netVolumeMl ? (
                  <p className="text-xs text-rose-600">{errors.netVolumeMl}</p>
                ) : null}
                {errors.daneCertifiedRetailPrice ? (
                  <p className="text-xs text-rose-600 md:col-span-2">
                    {errors.daneCertifiedRetailPrice}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Select
              label="Modelo de venta"
              required
              value={values.saleType}
              onChange={(event) =>
                setSaleModelValue(
                  "saleType",
                  event.target.value as ProductSaleType
                )
              }
              hint="Unidad no usa balanza. Peso usa balanza. Mixto permite ambos modos en POS."
            >
              {saleTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {errors.saleType ? (
              <p className="text-xs text-rose-600">{errors.saleType}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Select
              label="Unidad comercial"
              required
              value={values.measurementUnit}
              onChange={(event) =>
                setSaleModelValue(
                  "measurementUnit",
                  event.target.value as ProductMeasurementUnit
                )
              }
              hint="Para peso usa KG, LB, G u OZ."
            >
              {measurementUnitOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    values.saleType === "UNIT"
                      ? option.value !== "UND"
                      : option.value === "UND"
                  }
                >
                  {option.label}
                </option>
              ))}
            </Select>
            {errors.measurementUnit ? (
              <p className="text-xs text-rose-600">{errors.measurementUnit}</p>
            ) : null}
          </div>
        </div>

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Clasificacion
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                La subcategoria depende de la categoria seleccionada.
              </p>
            </div>
            {categories.length === 0 && !categoriesLoading ? (
              <a
                className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                href={categoriesPath}
              >
                Crear categorias
              </a>
            ) : null}
          </div>

          {categories.length === 0 && !categoriesLoading ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No hay categorias creadas. Puedes guardar el producto sin
              clasificacion.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Select
                label="Categoria"
                value={values.categoryId}
                onChange={(event) => setCategoryValue(event.target.value)}
                disabled={categoriesLoading || categories.length === 0}
                hint={
                  categoriesLoading
                    ? "Cargando categorias..."
                    : "Campo opcional."
                }
              >
                <option value="">Sin categoria</option>
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
                label="Subcategoria"
                value={values.subcategoryId}
                onChange={(event) => setSubcategoryValue(event.target.value)}
                disabled={
                  !values.categoryId ||
                  subcategoriesLoading ||
                  sortedSubcategories.length === 0
                }
                hint={
                  !values.categoryId
                    ? "Selecciona una categoria primero."
                    : subcategoriesLoading
                      ? "Cargando subcategorias..."
                      : sortedSubcategories.length === 0
                        ? "La categoria no tiene subcategorias."
                        : "Campo opcional."
                }
              >
                <option value="">Sin subcategoria</option>
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

          {categoriesError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {categoriesError} Puedes guardar el producto sin clasificacion.
            </div>
          ) : null}

          {subcategoriesError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {subcategoriesError}
            </div>
          ) : null}
        </section>

        <InventoryImageUploadPanel
          entityId={mode === "edit" ? product?.id : null}
          title="Imagen del producto"
          imageUrl={currentImageProduct?.imageUrl}
          imageAltText={currentImageProduct?.imageAltText}
          imageMimeType={currentImageProduct?.imageMimeType}
          imageSizeBytes={currentImageProduct?.imageSizeBytes}
          disabledMessage="Guarda primero el producto para poder cargar imagen."
          fallbackLabel={values.name || "Producto"}
          onUpload={handleImageUpload}
          onDelete={handleImageDelete}
        />

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(event) => setFieldValue("isActive", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          Producto activo
        </label>

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Configuracion operativa</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Define reglas de lote, vencimiento, estado y stock objetivo.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={values.isPerishable}
                onChange={(event) =>
                  setOperationalValue("isPerishable", event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>
                <span className="block font-medium text-slate-900 dark:text-white">Producto perecedero</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Recomendado para alimentos, farmacia o productos con vida util.
                </span>
              </span>
            </label>

            <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={values.requiresLot}
                onChange={(event) =>
                  setOperationalValue("requiresLot", event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>
                <span className="block font-medium text-slate-900 dark:text-white">Requiere lote</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Activa trazabilidad por lote en compras, ajustes y ventas v2.
                </span>
              </span>
            </label>

            <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={values.requiresExpiration}
                onChange={(event) =>
                  setOperationalValue("requiresExpiration", event.target.checked)
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>
                <span className="block font-medium text-slate-900 dark:text-white">Requiere vencimiento</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  Al activarlo, lote queda marcado automaticamente.
                </span>
              </span>
            </label>
          </div>

          {values.isPerishable ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Producto perecedero: revisa si debe exigir lote y vencimiento antes de venderlo por v2.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Select
                label="Estado operativo"
                value={values.operationalStatus}
                onChange={(event) =>
                  setOperationalValue(
                    "operationalStatus",
                    event.target.value as ProductOperationalStatus
                  )
                }
              >
                {operationalStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {errors.operationalStatus ? (
                <p className="text-xs text-rose-600">{errors.operationalStatus}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Select
                label="Rotacion"
                value={values.rotationClass}
                onChange={(event) =>
                  setOperationalValue(
                    "rotationClass",
                    event.target.value as "" | ProductRotationClass
                  )
                }
              >
                <option value="">Sin clasificar</option>
                {rotationClassOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {errors.rotationClass ? (
                <p className="text-xs text-rose-600">{errors.rotationClass}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Input
                label="Stock minimo"
                type="number"
                min="0"
                step="0.01"
                value={values.minStock}
                onChange={(event) => setOperationalValue("minStock", event.target.value)}
                placeholder="Opcional"
              />
              {errors.minStock ? <p className="text-xs text-rose-600">{errors.minStock}</p> : null}
            </div>

            <div className="space-y-1">
              <Input
                label="Stock maximo"
                type="number"
                min="0"
                step="0.01"
                value={values.maxStock}
                onChange={(event) => setOperationalValue("maxStock", event.target.value)}
                placeholder="Opcional"
              />
              {errors.maxStock ? <p className="text-xs text-rose-600">{errors.maxStock}</p> : null}
            </div>
          </div>

          {errors.isPerishable ? (
            <p className="text-xs text-rose-600">{errors.isPerishable}</p>
          ) : null}
          {errors.requiresLot ? (
            <p className="text-xs text-rose-600">{errors.requiresLot}</p>
          ) : null}
          {errors.requiresExpiration ? (
            <p className="text-xs text-rose-600">{errors.requiresExpiration}</p>
          ) : null}
        </section>

        {catalogLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
            Cargando unidades e impuestos...
          </div>
        ) : null}

        {catalogError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {catalogError}
          </div>
        ) : null}

        {errors.submit ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.submit}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Guardar producto" : "Actualizar producto"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        </div>
      </form>
    </section>
  );
};
