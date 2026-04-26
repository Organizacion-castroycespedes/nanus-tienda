"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { listProducts } from "../../../../domains/products/api";
import type { ProductResponse } from "../../../../domains/products/dtos";
import { Button } from "../../../../components/design-system/Button";
import { ConfirmationMessage } from "../../../../components/design-system/confirmation-message";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { hasPermission } from "../../../../lib/permissions";
import { ProductForm } from "../../../../modules/inventory/components/ProductForm";
import { StockAdjustmentForm } from "../../../../modules/inventory/components/StockAdjustmentForm";
import { deleteProduct } from "../../../../modules/inventory/services/product.service";

type ProductFilters = {
  query: string;
};

const defaultFilters: ProductFilters = {
  query: "",
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
  const [stockAdjustmentProduct, setStockAdjustmentProduct] = useState<ProductResponse | null>(null);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<ProductResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canCreate = hasPermission("inventory.create");
  const canEdit = hasPermission("inventory.update");
  const canDelete = hasPermission("inventory.delete");

  useAutoClearState(toastMessage, setToastMessage);

  const savedState = searchParams.get("saved");

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await listProducts();
      setProducts(result);
      setHasSearched(true);
    } catch {
      setErrorMessage("No se pudieron cargar los productos.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    const query = appliedFilters.query.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const name = product.name.toLowerCase();
      const sku = product.sku.toLowerCase();
      return name.includes(query) || sku.includes(query);
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
    void loadProducts();
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

  const handleCreateClick = () => {
    setSelectedProduct(null);
    setFormMode("create");
  };

  const handleEditClick = (product: ProductResponse) => {
    setSelectedProduct(product);
    setFormMode("edit");
  };

  const dismissSavedMessage = () => {
    router.replace(pathname);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeForm();
    router.replace(`${pathname}?saved=${mode}`);
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

  return (
    <div className="space-y-6">
      {savedState === "create" ? (
        <ConfirmationMessage
          title="Producto creado correctamente"
          description="El producto fue guardado y ya puedes consultarlo desde el listado."
          onDismiss={dismissSavedMessage}
        />
      ) : null}

      {savedState === "edit" ? (
        <ConfirmationMessage
          title="Producto actualizado correctamente"
          description="Los cambios del producto fueron guardados exitosamente."
          onDismiss={dismissSavedMessage}
        />
      ) : null}

      {pendingDeleteProduct ? (
        <ConfirmationMessage
          title={`Eliminar producto: ${pendingDeleteProduct.name}`}
          description="Esta accion realizara la eliminacion logica del producto y dejara de mostrarse como activo."
          onDismiss={() => setPendingDeleteProduct(null)}
        />
      ) : null}

      {pendingDeleteProduct ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setPendingDeleteProduct(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()} isLoading={isDeleting}>
              Confirmar eliminacion
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Inventory</p>
            <h1 className="text-2xl font-semibold text-slate-900">Productos</h1>
            <p className="mt-2 text-sm text-slate-600">
              Consulta el catalogo de productos y su stock actual.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => void loadProducts()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreate ? (
              <Button onClick={handleCreateClick}>
                <Plus className="h-4 w-4" />
                Crear producto
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {formMode ? (
        <ProductForm
          mode={formMode}
          product={selectedProduct}
          onCancel={closeForm}
          onSuccess={handleFormSuccess}
        />
      ) : null}

      {stockAdjustmentProduct ? (
        <StockAdjustmentForm
          product={stockAdjustmentProduct}
          onCancel={closeStockAdjustmentForm}
          onSuccess={() => void handleStockAdjustmentSuccess()}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Nombre o SKU"
            value={draftFilters.query}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                query: event.target.value,
              }))
            }
          />
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
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Cargando productos...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Usa el boton Buscar para consultar productos.
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No hay productos para mostrar.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3 text-slate-900">{product.name}</td>
                    <td className="px-4 py-3 text-slate-700">{product.sku}</td>
                    <td className="px-4 py-3 text-slate-700">{formatCurrency(product.price)}</td>
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
                          onClick={() => setStockAdjustmentProduct(product)}
                        >
                          Ajustar stock
                        </Button>
                        {canEdit ? (
                          <Button variant="ghost" size="sm" onClick={() => handleEditClick(product)}>
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
                ))
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
    </div>
  );
};

export default ProductsPage;
