"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../../../components/design-system/Button";
import type { ProductResponse } from "../../../domains/products/dtos";
import { useAppSelector } from "../../../store/hooks";

import {
  getTaxCatalogs,
  getTaxes,
  type TaxCatalogItem,
  type TaxResponse,
} from "../services/tax.service";
import { getUnits, type UnitResponse } from "../services/unit.service";
import {
  createProduct,
  deleteProductImage,
  getProduct,
  updateProduct,
  getFiscalPreview,
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
import { ProductBasicSection } from "./product-form/ProductBasicSection";
import { ProductClassificationImageSection } from "./product-form/ProductClassificationImageSection";
import { ProductFiscalAdvancedAccordion } from "./product-form/ProductFiscalAdvancedAccordion";
import { ProductOperationalSection } from "./product-form/ProductOperationalSection";
import { ProductPriceCostSection } from "./product-form/ProductPriceCostSection";
import { ProductSummaryCard } from "./product-form/ProductSummaryCard";
import { ProductTraitsSection } from "./product-form/ProductTraitsSection";
import type {
  AssignedTaxRow,
  ProductFormErrors,
  ProductFormValues,
  ProductOption,
  TaxInfo,
} from "./product-form/types";

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductResponse | null;
  onCancel: () => void;
  onSuccess: (mode: "create" | "edit") => void;
  onImageChange?: (product: ProductResponse) => void;
};

const createInitialValues = (
  product?: ProductResponse | null,
): ProductFormValues => {
  const assignedTaxes =
    product?.taxes && product.taxes.length > 0
      ? product.taxes.map((tax) => ({
          taxId: tax.taxId,
          calculationOrder: String(tax.calculationOrder),
          isIncluded: tax.isIncluded ?? true,
        }))
      : product?.taxId
        ? [{ taxId: product.taxId, calculationOrder: "100", isIncluded: true }]
        : [];

  return {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    standardIdentificationScheme:
      product?.standardIdentification?.scheme ?? (product ? "" : "999"),
    standardIdentificationCode:
      product?.standardIdentification?.code ?? (product ? "" : ""),
    price: product ? String(product.price) : "",
    priceWithTax: product ? String(product.priceWithTax) : "",
    priceWithoutTax: product ? String(product.priceWithoutTax) : "",
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

const isValidNumber = (value: string) =>
  value.trim() !== "" && !Number.isNaN(Number(value));
const isOptionalNumber = (value: string) =>
  value.trim() === "" || !Number.isNaN(Number(value));
const optionalNumber = (value: string) =>
  value.trim() === "" ? null : Number(value);

export const ProductForm = ({
  mode,
  product,
  onCancel,
  onSuccess,
  onImageChange,
}: ProductFormProps) => {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params?.tenant ?? "default";
  const role = useAppSelector(
    (state) => state.auth.user?.role ?? state.auth.role ?? "",
  );
  const canViewFiscalAdvanced =
    role === "SUPER_ADMIN" || role === "SUPER_USER";
  const imagePanelId = "product-form-image-panel";

  const [values, setValues] = useState<ProductFormValues>(
    createInitialValues(product),
  );
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
  const [subcategories, setSubcategories] = useState<
    ProductSubcategoryResponse[]
  >([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [subcategoriesError, setSubcategoriesError] = useState<string | null>(
    null,
  );
  const [imageProduct, setImageProduct] = useState<ProductResponse | null>(
    product ?? null,
  );
  const [fiscalPricePreview, setFiscalPricePreview] = useState({
    priceWithTax: values.priceWithTax ?? "",
    priceWithoutTax: values.priceWithoutTax ?? "",
  });

  useEffect(() => {
    const finalPrice = Number(values.price);
    if (
      !Number.isFinite(finalPrice) ||
      finalPrice < 0 ||
      values.assignedTaxes.length === 0
    ) {
      setFiscalPricePreview({
        priceWithTax: values.priceWithTax,
        priceWithoutTax: values.priceWithoutTax,
      });
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const preview = await getFiscalPreview({
          finalUnitPrice: finalPrice,
          taxes: values.assignedTaxes.map((t, i) => ({
            taxId: t.taxId,
            calculationOrder: i + 1,
            isIncluded: t.isIncluded,
          })),
          taxProfile: values.taxProductCategoryId
            ? {
                taxProductCategoryId: values.taxProductCategoryId,
                alcoholDegree: values.alcoholDegree
                  ? Number(values.alcoholDegree)
                  : null,
                netVolumeMl: values.netVolumeMl
                  ? Number(values.netVolumeMl)
                  : null,
                daneCertifiedRetailPrice: values.daneCertifiedRetailPrice
                  ? Number(values.daneCertifiedRetailPrice)
                  : null,
              }
            : null,
        });
        setFiscalPricePreview({
          priceWithTax: preview.lineTotal.toFixed(2),
          priceWithoutTax: preview.lineSubtotal.toFixed(2),
        });
      } catch (err) {
        console.error("Failed to fetch fiscal preview", err);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [
    values.price,
    values.assignedTaxes,
    values.taxProductCategoryId,
    values.alcoholDegree,
    values.netVolumeMl,
    values.daneCertifiedRetailPrice,
    taxOptions,
    values.priceWithTax,
    values.priceWithoutTax,
  ]);

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
          })),
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
          })),
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
            "No se pudieron cargar las categorias.",
          ),
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
        current.subcategoryId ? { ...current, subcategoryId: "" } : current,
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
            result,
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
            "No se pudieron cargar las subcategorias.",
          ),
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

  const setFieldValue = <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  };

  const setAssignedTaxes = (assignedTaxes: AssignedTaxRow[]) => {
    setValues((prev) => ({ ...prev, assignedTaxes }));
    setErrors((prev) => ({
      ...prev,
      assignedTaxes: undefined,
      submit: undefined,
    }));
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
    value: ProductFormValues[K],
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
    value: ProductFormValues[K],
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
    [taxOptions, values.assignedTaxes],
  );

  const bridgeTax = useMemo(() => {
    const ordered = [...assignedTaxDetails].sort(
      (left, right) =>
        Number(left.calculationOrder || 0) -
        Number(right.calculationOrder || 0),
    );
    return (
      ordered.find(
        (item) =>
          !item.tax?.calculationMethodCode ||
          item.tax.calculationMethodCode === "PERCENTAGE",
      )?.tax ?? null
    );
  }, [assignedTaxDetails]);

  const hasNonPercentageTax = assignedTaxDetails.some(
    (item) =>
      item.tax?.calculationMethodCode != null &&
      item.tax.calculationMethodCode !== "PERCENTAGE",
  );
  const hasAdvTax = assignedTaxDetails.some(
    (item) => item.tax?.taxTypeCode === "AD_VALOREM",
  );
  const selectedTaxCategory =
    taxProductCategories.find(
      (item) => item.id === values.taxProductCategoryId,
    ) ?? null;

  const categoriesPath = `/${tenantSlug}/inventory/product-categories`;
  const currentImageProduct = imageProduct ?? product ?? null;

  const handleImageUpload = async (file: File) => {
    if (!product?.id) {
      throw new Error("Guarda primero el producto para poder cargar imagen.");
    }
    const updated = await uploadProductImage(
      product.id,
      file,
      values.name.trim() || product.name,
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
    if (
      values.standardIdentificationScheme &&
      !values.standardIdentificationCode.trim()
    ) {
      nextErrors.standardIdentificationCode =
        "El código estándar es requerido cuando seleccionas un esquema DIAN.";
    }
    if (
      !values.standardIdentificationScheme &&
      values.standardIdentificationCode.trim()
    ) {
      nextErrors.standardIdentificationCode =
        "Selecciona un esquema DIAN para guardar este código.";
    }
    if (
      values.standardIdentificationCode
        .trim()
        .match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
    ) {
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
      nextErrors.requiresLot =
        "Requiere lote cuando el producto exige vencimiento.";
    }
    if (
      values.isPerishable &&
      !values.requiresLot &&
      !values.requiresExpiration
    ) {
      nextErrors.isPerishable =
        "Marca lote o vencimiento para productos perecederos.";
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
    } else if (
      optionalNumber(values.minStock) !== null &&
      Number(values.minStock) < 0
    ) {
      nextErrors.minStock = "El stock minimo no puede ser negativo.";
    }
    if (!isOptionalNumber(values.maxStock)) {
      nextErrors.maxStock = "El stock maximo debe ser numerico.";
    } else if (
      optionalNumber(values.maxStock) !== null &&
      Number(values.maxStock) < 0
    ) {
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
      subcategories,
    );
    if (classificationError) {
      nextErrors.subcategoryId = classificationError;
    }

    const taxIds = values.assignedTaxes
      .map((item) => item.taxId)
      .filter(Boolean);

    if (canViewFiscalAdvanced) {
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
      }
      if (
        hasAdvTax &&
        (values.daneCertifiedRetailPrice.trim() === "" ||
          Number.isNaN(Number(values.daneCertifiedRetailPrice)))
      ) {
        nextErrors.daneCertifiedRetailPrice =
          "El precio DANE es requerido cuando hay ADV.";
      }
    }

    const needsAlcoholTraits =
      hasNonPercentageTax || Boolean(selectedTaxCategory?.isAlcoholicBeverage);

    if (needsAlcoholTraits) {
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
          Number(left.calculationOrder) - Number(right.calculationOrder),
      );
    const bridgeTaxId =
      orderedTaxes.find((assignment) => {
        const tax = taxOptions.find((item) => item.id === assignment.taxId);
        return (
          !tax?.calculationMethodCode ||
          tax.calculationMethodCode === "PERCENTAGE"
        );
      })?.taxId ?? null;

    const taxProfilePayload =
      values.taxProductCategoryId || hasNonPercentageTax
        ? {
            taxProductCategoryId: values.taxProductCategoryId,
            alcoholDegree: optionalNumber(values.alcoholDegree),
            netVolumeMl: optionalNumber(values.netVolumeMl),
            daneCertifiedRetailPrice: optionalNumber(
              values.daneCertifiedRetailPrice,
            ),
            danePriceEffectiveFrom: values.danePriceEffectiveFrom || null,
            danePriceEffectiveTo: values.danePriceEffectiveTo || null,
          }
        : null;

    const basePayload: CreateProductPayload = {
      name: values.name.trim(),
      sku: values.sku.trim(),
      standardIdentification:
        values.standardIdentificationScheme &&
        values.standardIdentificationCode.trim()
          ? {
              scheme: values.standardIdentificationScheme,
              code: values.standardIdentificationCode.trim(),
            }
          : null,
      price: Number(values.price),
      priceWithTax: undefined,
      priceWithoutTax: undefined,
      cost: Number(values.cost),
      unitId: values.unitId,
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

    // Solo Super Admin / Super User definen impuestos y DANE.
    // Al editar, el resto no envia taxes/taxId para no pisar la config fiscal en BD.
    const payload: CreateProductPayload = canViewFiscalAdvanced
      ? {
          ...basePayload,
          taxId: bridgeTaxId,
          taxes: orderedTaxes.map((item) => ({
            taxId: item.taxId,
            calculationOrder: Number(item.calculationOrder),
            isIncluded: item.isIncluded,
          })),
          taxProfile: taxProfilePayload,
        }
      : {
          ...basePayload,
          ...(taxProfilePayload ? { taxProfile: taxProfilePayload } : {}),
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
        submit: getProductClassificationErrorMessage(
          error,
          mode === "create"
            ? "No se pudo crear el producto."
            : "No se pudo actualizar el producto.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form className="space-y-6" onSubmit={handleSubmit}>
        {mode === "edit" && product ? (
          <ProductSummaryCard
            name={values.name}
            sku={values.sku}
            isActive={values.isActive}
            imageUrl={currentImageProduct?.imageUrl}
            onChangeImageClick={() => {
              document
                .getElementById(imagePanelId)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ) : null}

        <ProductBasicSection
          mode={mode}
          values={values}
          errors={errors}
          unitOptions={unitOptions}
          catalogLoading={catalogLoading}
          onFieldChange={setFieldValue}
          onSaleModelChange={setSaleModelValue}
        />

        <ProductPriceCostSection
          mode={mode}
          values={values}
          errors={errors}
          priceWithoutTax={fiscalPricePreview.priceWithoutTax}
          priceWithTax={fiscalPricePreview.priceWithTax}
          onFieldChange={setFieldValue}
        />
        <ProductClassificationImageSection
          mode={mode}
          values={values}
          errors={errors}
          classification={{
            categories,
            subcategories,
            categoriesPath,
            categoriesLoading,
            subcategoriesLoading,
            categoriesError,
            subcategoriesError,
          }}
          imageProduct={currentImageProduct}
          productId={product?.id}
          onCategoryChange={setCategoryValue}
          onSubcategoryChange={setSubcategoryValue}
          onActiveChange={(isActive) => setFieldValue("isActive", isActive)}
          onImageUpload={handleImageUpload}
          onImageDelete={handleImageDelete}
          imagePanelId={imagePanelId}
        />

        
        <ProductTraitsSection
          values={values}
          errors={errors}
          requiresAlcoholTraits={
            hasNonPercentageTax ||
            Boolean(selectedTaxCategory?.isAlcoholicBeverage)
          }
          onFieldChange={setFieldValue}
        />


        <ProductOperationalSection
          values={values}
          errors={errors}
          onOperationalChange={setOperationalValue}
        />

        {canViewFiscalAdvanced ? (
          <ProductFiscalAdvancedAccordion
            values={values}
            errors={errors}
            catalogs={{
              taxOptions,
              taxProductCategories,
              catalogLoading,
              bridgeTax,
              hasNonPercentageTax,
            }}
            onFieldChange={setFieldValue}
            onAssignedTaxesChange={setAssignedTaxes}
          />
        ) : null}

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

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {mode === "create" ? "Guardar producto" : "Actualizar producto"}
          </Button>
        </div>
      </form>
    </div>
  );
};
