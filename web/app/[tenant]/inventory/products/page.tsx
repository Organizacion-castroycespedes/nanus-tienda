"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Barcode, DollarSign, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { ProductPriceChangeModal } from "../../../../modules/inventory/components/ProductPriceChangeModal";
import { ProductPriceHistoryPanel } from "../../../../modules/inventory/components/ProductPriceHistoryPanel";
import { StockAdjustmentForm } from "../../../../modules/inventory/components/StockAdjustmentForm";
import { deleteProduct } from "../../../../modules/inventory/services/product.service";

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
  HIGH: "Alta rotacion",
  MEDIUM: "Media",
  LOW: "Baja",
  NO_MOVEMENT: "Sin movimiento",
};

const saleTypeLabels: Record<ProductSaleType, string> = {
  UNIT: "Unidad",
  WEIGHT: "Peso",
  BOTH: "Unidad/peso",
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
  const saleType = product.saleType ?? "UNIT";

  badges.push({
    label: saleTypeLabels[saleType],
    className:
      saleType === "UNIT"
        ? "border-slate-200 bg-slate-100 text-slate-700"
        : "border-sky-200 bg-sky-50 text-sky-700",
  });

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

  return badges.slice(0, 5);
};

const ProductsPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ProductFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    variant?: "default" | "danger" | "warning";
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { currentTenant, isSuperRole } = useInventoryScope();
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const canViewAllTenants = role === "SUPER_ADMIN";
  const canManageProducts =
    role === "SUPER_ADMIN" || role === "SUPER_USER" || role === "ADMIN";
  const canCreate = canManageProducts && hasPermission("inventory.create");
  const canEdit = canManageProducts && hasPermission("inventory.update");
  const canDelete = canManageProducts && hasPermission("inventory.delete");
  const canAdjustStock = isSuperRole;

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
      return (
        name.includes(query) ||
        sku.includes(query) ||
        branchName.includes(query) ||
        terminalName.includes(query)
      );
    });
  }, [appliedFilters.query, products]);

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

  const handleHeaderActionConfirm = async () => {
    if (pendingHeaderAction === "refresh") {
      await loadProducts();
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
      description: "El precio fue actualizado y el historial quedo registrado.",
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
      ? "Gestionar codigos de barras"
      : priceProduct
        ? "Precio e historial"
        : stockAdjustmentProduct
          ? "Ajustar stock"
          : "";
  const focusDescription = formMode
    ? "Completa el formulario principal. El listado queda oculto para mantener foco."
    : barcodeProduct
      ? "Administra codigos alternos del producto sin modificar SKU ni POS."
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
      ? "Se volvera a consultar el listado de productos con los filtros actuales."
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
        loading={pendingHeaderAction === "refresh" && loading}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Inventory</p>
            <h1 className="text-2xl font-semibold text-slate-900">Productos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Consulta el catalogo de productos y su stock actual.
            </p>
          </div>
          {!isFocusMode ? (
            <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              onClick={() => setPendingHeaderAction("refresh")}
              isLoading={loading}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
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
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          className={
            isSuperRole
              ? "grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_auto_auto]"
              : "grid gap-4 md:grid-cols-[1fr_auto_auto]"
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
                    prev.tenantId && prev.tenantId !== event.target.value ? "" : prev.branchId,
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
                setDraftFilters((prev) => ({ ...prev, branchId: event.target.value }))
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
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={applyFilters}>
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button variant="ghost" onClick={resetFilters}>
              Limpiar
            </Button>
          </div>
          <Select
            label="Filas por pagina"
            value={String(pageSize)}
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
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Terminal</th>
                <th className="px-4 py-3 font-medium">Venta</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Cargando productos...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar productos.
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No hay productos para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => {
                  const badges = getProductBadges(product);

                  return (
                    <tr key={product.id}>
                      <td className="px-4 py-3 text-slate-900">
                        <div className="space-y-2">
                          <span className="font-medium">{product.name}</span>
                          {badges.length > 0 ? (
                            <div className="flex max-w-xs flex-wrap gap-1.5">
                              {badges.map((badge) => (
                                <span
                                  key={`${product.id}:${badge.label}`}
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{product.sku}</td>
                      <td className="px-4 py-3 text-slate-700">{product.branchName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{product.terminalName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {saleTypeLabels[product.saleType ?? "UNIT"]} /{" "}
                        {measurementUnitLabels[product.measurementUnit ?? "UND"]}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const stock = Number(product.stock ?? 0);
                          const indicator = getStockIndicator(stock);

                          return (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900">{stock}</span>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${indicator.className}`}
                              >
                                {indicator.label}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBarcodeClick(product)}
                          >
                            <Barcode className="h-4 w-4" />
                            Codigos
                          </Button>
                          {canAdjustStock ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setStockAdjustmentProduct(product)}
                            >
                              Ajustar stock
                            </Button>
                          ) : null}
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePriceClick(product)}
                            >
                              <DollarSign className="h-4 w-4" />
                              Cambiar precio
                            </Button>
                          ) : null}
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(product)}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDeleteProduct(product)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Pagina {Math.min(page + 1, totalPages)} de {totalPages}
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
