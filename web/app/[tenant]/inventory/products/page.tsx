"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { listProducts } from "../../../../domains/products/api";
import type {
  ProductMeasurementUnit,
  ProductOperationalStatus,
  ProductResponse,
  ProductRotationClass,
  ProductSaleType,
} from "../../../../domains/products/dtos";
import { Button } from "../../../../components/design-system/Button";
import { ConfirmDialog } from "../../../../components/design-system/confirm-dialog";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useInventoryScope } from "../../../../hooks/useInventoryScope";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { buildConfirmFromApiError } from "../../../../lib/api-messages";
import { hasPermission } from "../../../../lib/permissions";
import { useAppSelector } from "../../../../store/hooks";
import { ProductBarcodePanel } from "../../../../modules/inventory/components/ProductBarcodePanel";
import { FocusActionLayout } from "../../../../modules/inventory/components/FocusActionLayout";
import { ProductForm } from "../../../../modules/inventory/components/ProductForm";
import { ProductImportDialog } from "../../../../modules/inventory/components/ProductImportDialog";
import { StockImportDialog } from "../../../../modules/inventory/components/StockImportDialog";
import { ProductPriceChangeModal } from "../../../../modules/inventory/components/ProductPriceChangeModal";
import { ProductPriceHistoryPanel } from "../../../../modules/inventory/components/ProductPriceHistoryPanel";
import { StockAdjustmentForm } from "../../../../modules/inventory/components/StockAdjustmentForm";
import {
  listProductCategories,
  listProductSubcategories,
  type ProductCategoryResponse,
  type ProductSubcategoryResponse,
} from "../../../../modules/inventory/services/product-classification.service";
import { deleteProduct } from "../../../../modules/inventory/services/product.service";
import type { ProductImportCommitResult } from "../../../../modules/inventory/services/product-import.service";
import type { StockImportCommitResult } from "../../../../modules/inventory/services/stock-import.service";
import { getProductClassificationErrorMessage } from "../../../../modules/inventory/utils/product-classification";
import { ProductInventoryReportDialog } from "../../../../modules/reporteria/components/ProductInventoryReportDialog";
import { ProductRowActions } from "../../../../modules/inventory/components/ProductRowActions";

type ProductFilters = {
  query: string;
  tenantId: string;
  branchId: string;
};

const defaultFilters: ProductFilters = {
  query: "",
  tenantId: "",
  branchId: "",
};

const pageSizeOptions = [10, 25, 50];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const getStockIndicator = (stock: number) => {
  if (stock <= 0) {
    return {
      label: "Sin stock",
      className: "border border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (stock <= 5) {
    return {
      label: "Stock bajo",
      className: "border border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Disponible",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  };
};

type ProductBadge = {
  label: string;
  className: string;
};

const productStatusLabels: Record<ProductOperationalStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  BLOCKED: "Bloqueado",
  DISCONTINUED: "Descontinuado",
};

const rotationLabels: Record<ProductRotationClass, string> = {
  HIGH: "Alta rotación",
  MEDIUM: "Media",
  LOW: "Baja",
  NO_MOVEMENT: "Sin movimiento",
};

const saleTypeLabels: Record<ProductSaleType, string> = {
  UNIT: "Unidad",
  WEIGHT: "Peso",
  BOTH: "Unidad y peso",
};

const formatSaleUnitLabel = (
  saleType: ProductSaleType | undefined,
  measurementUnit: ProductMeasurementUnit | undefined,
) => {
  const resolvedSaleType = saleType ?? "UNIT";
  const resolvedUnit = measurementUnit ?? "UND";
  if (resolvedSaleType === "UNIT" && resolvedUnit === "UND") {
    return "Unidad";
  }
  return `${saleTypeLabels[resolvedSaleType]} · ${measurementUnitLabels[resolvedUnit]}`;
};

const measurementUnitLabels: Record<ProductMeasurementUnit, string> = {
  UND: "UND",
  KG: "KG",
  LB: "LB",
  G: "G",
  OZ: "OZ",
};

const getProductBadges = (product: ProductResponse): ProductBadge[] => {
  const badges: ProductBadge[] = [];
  const operationalStatus = product.operationalStatus ?? (product.isActive ? "ACTIVE" : "INACTIVE");

  if (!product.isActive || operationalStatus !== "ACTIVE") {
    badges.push({
      label: productStatusLabels[operationalStatus],
      className:
        operationalStatus === "BLOCKED"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-100 text-slate-700",
    });
  }

  if (product.requiresExpiration) {
    badges.push({
      label: "Vence",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    });
  }

  if (product.requiresLot) {
    badges.push({
      label: "Lote",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    });
  }

  if (product.isPerishable) {
    badges.push({
      label: "Perecedero",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    });
  }

  if (product.rotationClass) {
    badges.push({
      label: rotationLabels[product.rotationClass],
      className: "border-violet-200 bg-violet-50 text-violet-700",
    });
  }

  return badges.slice(0, 4);
};

const thClass =
  "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300";
const tdClass = "whitespace-nowrap px-4 py-3 align-middle text-sm text-slate-700 dark:text-slate-200";

const ProductsPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [categories, setCategories] = useState<ProductCategoryResponse[]>([]);
  const [subcategories, setSubcategories] = useState<ProductSubcategoryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [classificationError, setClassificationError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductResponse | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductResponse | null>(null);
  const [priceProduct, setPriceProduct] = useState<ProductResponse | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceHistoryReloadKey, setPriceHistoryReloadKey] = useState(0);
  const [stockAdjustmentProduct, setStockAdjustmentProduct] = useState<ProductResponse | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<ProductResponse | null>(null);
  const [pendingFocusCancel, setPendingFocusCancel] = useState(false);
  const [pendingHeaderAction, setPendingHeaderAction] = useState<"refresh" | "create" | null>(null);
  const [priceFeedback, setPriceFeedback] = useState<{
    title: string;
    description?: string;
    variant?: "default" | "success" | "danger" | "warning";
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [stockImportOpen, setStockImportOpen] = useState(false);
  const { currentTenant, isSuperRole } = useInventoryScope();
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const canViewAllTenants = role === "SUPER_ADMIN";
  const canManageProducts =
    role === "SUPER_ADMIN" || role === "SUPER_USER" || role === "ADMIN";
  const canCreate = canManageProducts && hasPermission("inventory.create");
  const canEdit = canManageProducts && hasPermission("inventory.update");
  const canDelete = canManageProducts && hasPermission("inventory.delete");
  const canAdjustStock = canManageProducts && hasPermission("inventory.update");

  useAutoClearState(toastMessage, setToastMessage);

  const savedState = searchParams.get("saved");

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  useEffect(() => {
    if (savedState === "create") {
      showToast(
        "Producto creado correctamente. El producto fue guardado y ya puedes consultarlo desde el listado.",
        "success"
      );
      router.replace(pathname);
    }
    if (savedState === "edit") {
      showToast(
        "Producto actualizado correctamente. Los cambios fueron guardados exitosamente.",
        "success"
      );
      router.replace(pathname);
    }
  }, [pathname, router, savedState, showToast]);

  const resolveProductFilters = useCallback(
    (filters?: ProductFilters) => {
      if (canViewAllTenants) {
        return {
          tenantId: filters?.tenantId || undefined,
          branchId: filters?.branchId || undefined,
        };
      }

      return {
        tenantId: currentTenant || undefined,
      };
    },
    [canViewAllTenants, currentTenant]
  );

  const loadProducts = useCallback(async (filters?: ProductFilters) => {
    const activeFilters = filters ?? appliedFilters;
    setLoading(true);
      setErrorMessage(null);
      try {
        const result = await listProducts(resolveProductFilters(activeFilters));
        setProducts(result);
        setHasSearched(true);
      } catch {
      setErrorMessage("No se pudieron cargar los productos.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, resolveProductFilters]);

  const loadClassificationCatalogs = useCallback(async () => {
    setClassificationLoading(true);
    setClassificationError(null);
    try {
      const [categoryResult, subcategoryResult] = await Promise.all([
        listProductCategories(),
        listProductSubcategories(),
      ]);
      setCategories(categoryResult);
      setSubcategories(subcategoryResult);
    } catch (error) {
      setClassificationError(
        getProductClassificationErrorMessage(
          error,
          "No se pudo cargar la clasificacion de productos."
        )
      );
    } finally {
      setClassificationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClassificationCatalogs();
  }, [loadClassificationCatalogs]);

  const tenantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    products.forEach((product) => {
      if (product.tenantId && product.tenantName && !seen.has(product.tenantId)) {
        seen.set(product.tenantId, product.tenantName);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const branchOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    products
      .filter((product) =>
        draftFilters.tenantId ? product.tenantId === draftFilters.tenantId : true
      )
      .forEach((product) => {
        if (product.branchId && product.branchName) {
          const key = `${product.tenantId}:${product.branchId}`;
          if (!seen.has(key)) {
            seen.set(key, { id: product.branchId, name: product.branchName });
          }
        }
      });
    return Array.from(seen.values());
  }, [draftFilters.tenantId, products]);

  const categoryById = useMemo(() => {
    const map = new Map<string, ProductCategoryResponse>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

  const subcategoryById = useMemo(() => {
    const map = new Map<string, ProductSubcategoryResponse>();
    subcategories.forEach((subcategory) => {
      map.set(subcategory.id, subcategory);
    });
    return map;
  }, [subcategories]);

  const filteredProducts = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const name = product.name.toLowerCase();
      const sku = product.sku.toLowerCase();
      const branchName = (product.branchName ?? "").toLowerCase();
      const terminalName = (product.terminalName ?? "").toLowerCase();
      const categoryName = (
        categoryById.get(product.categoryId ?? "")?.name ?? ""
      ).toLowerCase();
      const subcategoryName = (
        subcategoryById.get(product.subcategoryId ?? "")?.name ?? ""
      ).toLowerCase();
      return (
        name.includes(query) ||
        sku.includes(query) ||
        branchName.includes(query) ||
        terminalName.includes(query) ||
        categoryName.includes(query) ||
        subcategoryName.includes(query)
      );
    });
  }, [appliedFilters.query, categoryById, products, subcategoryById]);

  const paginatedProducts = useMemo(() => {
    const start = page * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadProducts(draftFilters);
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPage(0);
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedProduct(null);
  };

  const closeStockAdjustmentForm = () => {
    setStockAdjustmentProduct(null);
  };

  const closeFocusAction = () => {
    closeForm();
    closeStockAdjustmentForm();
    setBarcodeProduct(null);
    setPriceProduct(null);
    setIsPriceModalOpen(false);
    setPendingFocusCancel(false);
  };

  const requestFocusCancel = () => {
    setPendingFocusCancel(true);
  };

  const handleCreateClick = () => {
    setSelectedProduct(null);
    setBarcodeProduct(null);
    setStockAdjustmentProduct(null);
    setFormMode("create");
  };

  const refreshProducts = async () => {
    await Promise.all([loadProducts(), loadClassificationCatalogs()]);
  };

  const requestRefresh = () => {
    if (products.length === 0) {
      void refreshProducts();
      return;
    }

    setPendingHeaderAction("refresh");
  };

  const handleHeaderActionConfirm = async () => {
    if (pendingHeaderAction === "refresh") {
      await refreshProducts();
      setPendingHeaderAction(null);
      return;
    }

    if (pendingHeaderAction === "create") {
      setPendingHeaderAction(null);
      handleCreateClick();
    }
  };

  const handleEditClick = (product: ProductResponse) => {
    setSelectedProduct(product);
    setBarcodeProduct(null);
    setPriceProduct(null);
    setStockAdjustmentProduct(null);
    setFormMode("edit");
  };

  const handleBarcodeClick = (product: ProductResponse) => {
    closeForm();
    setPriceProduct(null);
    setStockAdjustmentProduct(null);
    setBarcodeProduct(product);
  };

  const handlePriceClick = (product: ProductResponse) => {
    closeForm();
    setBarcodeProduct(null);
    setStockAdjustmentProduct(null);
    setPriceProduct(product);
    setIsPriceModalOpen(true);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeForm();
    router.replace(`${pathname}?saved=${mode}`);
    if (hasSearched) {
      void loadProducts();
    }
  };

  const handleProductImageChange = (updatedProduct: ProductResponse) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === updatedProduct.id ? { ...product, ...updatedProduct } : product
      )
    );
    setSelectedProduct((current) =>
      current?.id === updatedProduct.id ? { ...current, ...updatedProduct } : current
    );
  };

  const handleDelete = async () => {
    if (!pendingDeleteProduct) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProduct(pendingDeleteProduct.id);
      setPendingDeleteProduct(null);
      showToast("Producto eliminado correctamente.", "success");
      if (hasSearched) {
        await loadProducts();
      }
    } catch {
      showToast("No se pudo eliminar el producto.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStockAdjustmentSuccess = async () => {
    closeStockAdjustmentForm();
    showToast("Stock ajustado correctamente.", "success");
    if (hasSearched) {
      await loadProducts();
    }
  };

  const handleImportSuccess = async (result: ProductImportCommitResult) => {
    showToast(
      result.summary.failed > 0
        ? `Carga terminada: ${result.summary.succeeded} filas correctas y ${result.summary.failed} con fallas.`
        : `Carga terminada: ${result.summary.succeeded} productos procesados.`,
      result.summary.failed > 0 ? "warning" : "success"
    );
    await refreshProducts();
  };

  const handleStockImportSuccess = async (result: StockImportCommitResult) => {
    const changes = result.summary.in + result.summary.out;
    showToast(
      changes > 0
        ? `Stock cargado: ${result.summary.in} entradas y ${result.summary.out} salidas.`
        : "El stock ya coincidía con el archivo. No se registraron movimientos.",
      "success"
    );
    if (changes > 0 && hasSearched) {
      await loadProducts();
    }
  };

  const handlePriceChangeSuccess = async (response: { productId: string; newPrice: number }) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === response.productId
          ? { ...product, price: response.newPrice }
          : product
      )
    );
    setPriceProduct((current) =>
      current && current.id === response.productId
        ? { ...current, price: response.newPrice }
        : current
    );
    setPriceHistoryReloadKey((current) => current + 1);
    setPriceFeedback({
      title: "Precio actualizado",
      description: "El precio fue actualizado y el historial quedó registrado.",
      variant: "default",
    });
    if (hasSearched) {
      await loadProducts();
    }
  };

  const handlePriceChangeError = (error: unknown) => {
    setPriceFeedback(
      buildConfirmFromApiError(
        error,
        "No se pudo cambiar el precio del producto."
      )
    );
  };

  const isFocusMode = Boolean(
    formMode || barcodeProduct || stockAdjustmentProduct || priceProduct
  );
  const focusTitle = formMode
    ? formMode === "create"
      ? "Crear producto"
      : "Editar producto"
    : barcodeProduct
      ? "Gestionar códigos de barras"
      : priceProduct
        ? "Precio e historial"
        : stockAdjustmentProduct
          ? "Ajustar stock"
          : "";
  const focusDescription = formMode
    ? "Completa el formulario principal. El listado queda oculto para mantener foco."
    : barcodeProduct
      ? "Administra códigos alternos del producto sin modificar SKU ni POS."
      : priceProduct
        ? "Consulta historial y registra cambios de precio con motivo obligatorio."
        : stockAdjustmentProduct
          ? "Registra el ajuste manual con el contexto del producto seleccionado."
          : "";
  const focusContext = selectedProduct
    ? `${selectedProduct.name} - ${selectedProduct.sku}`
    : barcodeProduct
      ? `${barcodeProduct.name} - ${barcodeProduct.sku}`
      : priceProduct
        ? `${priceProduct.name} - ${priceProduct.sku}`
        : stockAdjustmentProduct
          ? `${stockAdjustmentProduct.name} - ${stockAdjustmentProduct.sku}`
          : undefined;
  const headerActionTitle =
    pendingHeaderAction === "refresh" ? "Actualizar productos" : "Crear producto";
  const headerActionDescription =
    pendingHeaderAction === "refresh"
      ? "Se volverá a consultar el listado de productos con los filtros actuales."
      : "Se ocultara el listado y se abrira el formulario para crear un nuevo producto.";
  const headerActionConfirmText =
    pendingHeaderAction === "refresh" ? "Actualizar" : "Crear producto";

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(pendingDeleteProduct)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDeleteProduct(null);
          }
        }}
        title={
          pendingDeleteProduct
            ? `Eliminar producto: ${pendingDeleteProduct.name}`
            : "Eliminar producto"
        }
        description="Esta accion realizara la eliminacion logica del producto y dejara de mostrarse como activo."
        confirmText="Confirmar eliminacion"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        loading={isDeleting}
      />

      <ConfirmDialog
        open={Boolean(pendingHeaderAction)}
        onOpenChange={(open) => {
          if (!open && !loading) {
            setPendingHeaderAction(null);
          }
        }}
        title={headerActionTitle}
        description={headerActionDescription}
        confirmText={headerActionConfirmText}
        cancelText="Cancelar"
        variant={pendingHeaderAction === "refresh" ? "default" : "warning"}
        onConfirm={handleHeaderActionConfirm}
        loading={
          pendingHeaderAction === "refresh" &&
          (loading || classificationLoading)
        }
      />

      <ConfirmDialog
        open={Boolean(priceFeedback)}
        onOpenChange={(open) => {
          if (!open) {
            setPriceFeedback(null);
          }
        }}
        title={priceFeedback?.title ?? ""}
        description={priceFeedback?.description}
        confirmText="Entendido"
        variant={priceFeedback?.variant ?? "default"}
        hideCancel
        onConfirm={() => setPriceFeedback(null)}
      />

      <ProductPriceChangeModal
        open={isPriceModalOpen}
        product={priceProduct}
        onOpenChange={setIsPriceModalOpen}
        onSuccess={(response) => handlePriceChangeSuccess(response)}
        onError={handlePriceChangeError}
      />

      {reportOpen ? (
        <ProductInventoryReportDialog
          defaultTenantId={currentTenant ?? ""}
          role={role}
          categories={categories}
          subcategories={subcategories}
          onClose={() => setReportOpen(false)}
        />
      ) : null}

      {importOpen ? (
        <ProductImportDialog
          onClose={() => setImportOpen(false)}
          onImported={(result) => void handleImportSuccess(result)}
        />
      ) : null}

      {stockImportOpen ? (
        <StockImportDialog
          tenantId={currentTenant ?? ""}
          onClose={() => setStockImportOpen(false)}
          onImported={(result) => void handleStockImportSuccess(result)}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Inventario
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Productos</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Consulta el catálogo de productos y su stock actual.
            </p>
          </div>
          {!isFocusMode ? (
            <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={requestRefresh}
              isLoading={loading || classificationLoading}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canManageProducts && hasPermission("inventory.read") ? (
              <>
                <Button variant="outline" onClick={() => setReportOpen(true)}>
                  <FileText className="h-4 w-4" /> PDF / Reporte
                </Button>
                <Button variant="outline" onClick={() => setReportOpen(true)}>
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </Button>
              </>
            ) : null}
            {canCreate ? (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Carga masiva
              </Button>
            ) : null}
            {canAdjustStock ? (
              <Button variant="outline" onClick={() => setStockImportOpen(true)}>
                <Boxes className="h-4 w-4" />
                Carga de stock
              </Button>
            ) : null}
            {canCreate ? (
              <Button onClick={() => setPendingHeaderAction("create")}>
                <Plus className="h-4 w-4" />
                Crear producto
              </Button>
            ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {isFocusMode ? (
        <FocusActionLayout
          title={focusTitle}
          description={focusDescription}
          contextLabel={focusContext}
          onBack={requestFocusCancel}
          onCancel={requestFocusCancel}
        >
          <div className="space-y-5">
            {pendingFocusCancel ? (
              <ConfirmDialog
                open={pendingFocusCancel}
                onOpenChange={(open) => {
                  if (!open) {
                    setPendingFocusCancel(false);
                  }
                }}
                title="Cancelar accion activa"
                description="Volveras al listado de productos. Si habia datos sin guardar, se descartaran."
                variant="warning"
                confirmText="Descartar y volver"
                cancelText="Seguir editando"
                onConfirm={closeFocusAction}
              />
            ) : null}

            {formMode ? (
              <ProductForm
                mode={formMode}
                product={selectedProduct}
                onCancel={requestFocusCancel}
                onSuccess={handleFormSuccess}
                onImageChange={handleProductImageChange}
              />
            ) : null}

            {barcodeProduct ? (
              <ProductBarcodePanel
                productId={barcodeProduct.id}
                productName={barcodeProduct.name}
                canWrite={canEdit}
              />
            ) : null}

            {priceProduct ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button onClick={() => setIsPriceModalOpen(true)}>
                    <DollarSign className="h-4 w-4" />
                    Cambiar precio
                  </Button>
                </div>
                <ProductPriceHistoryPanel
                  product={priceProduct}
                  reloadKey={priceHistoryReloadKey}
                />
              </div>
            ) : null}

            {stockAdjustmentProduct ? (
              <StockAdjustmentForm
                product={stockAdjustmentProduct}
                onCancel={requestFocusCancel}
                onSuccess={() => void handleStockAdjustmentSuccess()}
              />
            ) : null}
          </div>
        </FocusActionLayout>
      ) : (
        <>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/40">
          <div
            className={
              canViewAllTenants
                ? "grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(130px,160px)_minmax(130px,160px)_auto_minmax(120px,140px)] lg:items-end"
                : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(120px,140px)] sm:items-end"
            }
          >
            <Input
              label="Buscar"
              placeholder="Nombre, SKU, sucursal o terminal"
              value={draftFilters.query}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  query: event.target.value,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyFilters();
                }
              }}
            />
            {canViewAllTenants ? (
              <Select
                label="Tenant"
                value={draftFilters.tenantId}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    tenantId: event.target.value,
                    branchId:
                      prev.tenantId && prev.tenantId !== event.target.value
                        ? ""
                        : prev.branchId,
                  }))
                }
              >
                <option value="">Todos</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {canViewAllTenants ? (
              <Select
                label="Sucursal"
                value={draftFilters.branchId}
                onChange={(event) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    branchId: event.target.value,
                  }))
                }
                disabled={!draftFilters.tenantId}
                hint={
                  !draftFilters.tenantId
                    ? "Elige tenant primero."
                    : undefined
                }
              >
                <option value="">Todas</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <div className="flex flex-wrap items-end gap-2 sm:col-span-1">
              <Button
                type="button"
                variant="outline"
                className="min-h-[42px]"
                onClick={applyFilters}
              >
                <Search className="h-4 w-4" />
                Buscar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-[42px]"
                onClick={resetFilters}
              >
                Limpiar
              </Button>
            </div>
            <Select
              label="Filas por página"
              value={String(pageSize)}
              className="min-h-[42px] cursor-pointer"
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {classificationError ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          {classificationError} El listado seguira disponible sin nombres de
          categoría.
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className={`${thClass} min-w-[220px]`}>Producto</th>
                <th className={thClass}>Clasificación</th>
                <th className={thClass}>Ubicación</th>
                <th className={thClass}>Venta</th>
                <th className={`${thClass} text-right`}>Precio final</th>
                <th className={`${thClass} text-right`}>Stock</th>
                <th className={`${thClass} w-24 text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Cargando productos...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Usa el botón Buscar para consultar productos.
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No hay productos para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => {
                  const badges = getProductBadges(product);
                  const category = categoryById.get(product.categoryId ?? "");
                  const subcategory = subcategoryById.get(
                    product.subcategoryId ?? ""
                  );

                  const stock = Number(product.stock ?? 0);
                  const indicator = getStockIndicator(stock);
                  const classificationLabel = product.categoryId
                    ? category?.name ?? "Categoría no cargada"
                    : "Sin categoría";
                  const subLabel =
                    subcategory?.name ??
                    (product.categoryId ? "Sin subcategoría" : null);

                  return (
                    <tr
                      key={product.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-900/30"
                    >
                      <td className={`${tdClass} max-w-[280px] whitespace-normal`}>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-white">
                            {product.name}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {product.sku}
                          </p>
                          {badges.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {badges.map((badge) => (
                                <span
                                  key={`${product.id}:${badge.label}`}
                                  className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className={`${tdClass} max-w-[160px] whitespace-normal`}>
                        <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                          {classificationLabel}
                        </p>
                        {subLabel ? (
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {subLabel}
                          </p>
                        ) : null}
                      </td>
                      <td className={`${tdClass} max-w-[140px] whitespace-normal`}>
                        <p className="truncate">{product.branchName ?? "—"}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {product.terminalName ?? "—"}
                        </p>
                      </td>
                      <td className={tdClass}>
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200">
                          {formatSaleUnitLabel(
                            product.saleType,
                            product.measurementUnit,
                          )}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right font-medium tabular-nums text-slate-900 dark:text-white`}>
                        {formatCurrency(
                          Number(
                            product.priceWithTax ?? product.price ?? 0,
                          ),
                        )}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <span className="font-medium tabular-nums text-slate-900 dark:text-white">
                            {stock}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${indicator.className.includes("rose") ? "text-rose-700" : indicator.className.includes("amber") ? "text-amber-700" : "text-emerald-700"}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${indicator.className.includes("rose") ? "bg-rose-500" : indicator.className.includes("amber") ? "bg-amber-500" : "bg-emerald-500"}`}
                            />
                            {indicator.label}
                          </span>
                        </div>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <ProductRowActions
                          product={product}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canAdjustStock={canAdjustStock}
                          onBarcode={handleBarcodeClick}
                          onAdjustStock={setStockAdjustmentProduct}
                          onChangePrice={handlePriceClick}
                          onEdit={handleEditClick}
                          onDelete={setPendingDeleteProduct}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <span>
            Página {Math.min(page + 1, totalPages)} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0 || loading}
            >
              Anterior
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPage((prev) => Math.min(prev + 1, Math.max(totalPages - 1, 0)))}
              disabled={page >= totalPages - 1 || loading}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
};

export default ProductsPage;
