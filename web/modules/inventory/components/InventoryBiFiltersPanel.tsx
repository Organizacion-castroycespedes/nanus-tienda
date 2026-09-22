"use client";

import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { useAppSelector } from "../../../store/hooks";
import {
  getInventoryDashboard,
  type InventoryDashboardCashSessionOption,
  type InventoryDashboardFilterOption,
} from "../services/dashboard.service";
import { getInventoryProducts } from "../services/product.service";
import {
  listProductCategories,
  type ProductCategoryResponse,
} from "../services/product-classification.service";
import {
  createInventoryBiFilters,
  resetInventoryBiFilters,
  removeInventoryProduct,
  selectInventoryBranch,
  selectInventoryTenant,
  toggleInventoryProduct,
  type InventoryBiFilters,
  type InventoryStockStatus,
} from "../state/inventoryBiFilters";

type InventoryBiFiltersPanelProps = {
  onApply?: (filters: InventoryBiFilters) => void;
};

const panelClassName =
  "rounded-xl border border-[var(--brand-surface-border)] bg-[var(--brand-surface-card)] p-4 shadow-sm";

const today = new Date().toISOString().slice(0, 10);

const InventoryBiFiltersPanel = ({ onApply }: InventoryBiFiltersPanelProps) => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const canSelectTenant = role === "SUPER_ADMIN";
  const canSelectBranch = role === "SUPER_ADMIN" || role === "SUPER_USER";
  const authTenantId = authUser?.tenantId ?? "";
  const authBranchId = authUser?.branchId ?? "";

  const defaults = useMemo(
    () => ({
      requestedTenantId: authTenantId,
      requestedBranchId: authBranchId,
      startDate: today,
      endDate: today,
    }),
    [authBranchId, authTenantId]
  );
  const [filters, setFilters] = useState<InventoryBiFilters>(() =>
    createInventoryBiFilters(defaults)
  );
  const [tenants, setTenants] = useState<InventoryDashboardFilterOption[]>([]);
  const [branches, setBranches] = useState<InventoryDashboardFilterOption[]>([]);
  const [terminals, setTerminals] = useState<InventoryDashboardFilterOption[]>([]);
  const [cashSessions, setCashSessions] = useState<InventoryDashboardCashSessionOption[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [categories, setCategories] = useState<ProductCategoryResponse[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedProductLabels, setSelectedProductLabels] = useState<
    Record<string, { id: string; name: string; sku: string }>
  >({});
  const [showOperationalFilters, setShowOperationalFilters] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<InventoryBiFilters | null>(null);
  const productSearchRequestRef = useRef(0);

  useEffect(() => {
    setFilters((current) => {
      const requestedTenantId = current.requestedTenantId || defaults.requestedTenantId;
      const requestedBranchId = canSelectBranch
        ? current.requestedBranchId
        : defaults.requestedBranchId;

      if (
        requestedTenantId === current.requestedTenantId &&
        requestedBranchId === current.requestedBranchId
      ) {
        return current;
      }

      return { ...current, requestedTenantId, requestedBranchId };
    });
  }, [canSelectBranch, defaults]);

  const loadScopeOptions = useCallback(async (tenantId: string, branchId: string) => {
    if (!tenantId) return;
    setScopeLoading(true);
    setScopeError(null);
    try {
      const response = await getInventoryDashboard({
        tenantId,
        branchId: branchId || undefined,
      });
      setTenants(response.filters.tenants);
      setBranches(response.filters.branches);
      setTerminals(response.filters.terminals);
      setCashSessions(response.filters.cashSessions);
    } catch {
      setScopeError("No se pudieron cargar las opciones de alcance.");
      setBranches([]);
      setTerminals([]);
      setCashSessions([]);
    } finally {
      setScopeLoading(false);
    }
  }, []);

  const loadCategoryOptions = useCallback(
    async (tenantId: string) => {
      if (!tenantId) return;
      setCategoriesLoading(true);
      setCategoriesError(null);
      const categoriesRequest = listProductCategories({
        isActive: true,
        tenantId,
      });
      try {
        setCategories(await categoriesRequest);
      } catch {
        setCategories([]);
        setCategoriesError(
          true
            ? "No se pudieron cargar las categorías disponibles."
            : "La fuente actual de categorías solo permite el tenant autenticado."
        );
      }
      setCategoriesLoading(false);
    },
    []
  );

  useEffect(() => {
    void loadScopeOptions(filters.requestedTenantId, filters.requestedBranchId);
  }, [filters.requestedBranchId, filters.requestedTenantId, loadScopeOptions]);

  useEffect(() => {
    void loadCategoryOptions(filters.requestedTenantId);
  }, [filters.requestedTenantId, loadCategoryOptions]);

  const searchProducts = useCallback(
    async (tenantId: string, branchId: string, search: string, requestId: number) => {
      try {
        const result = await getInventoryProducts({
          tenantId,
          branchId: branchId || undefined,
          search,
          limit: 25,
        });
        if (requestId !== productSearchRequestRef.current) return;
        const uniqueProducts = new Map<string, { id: string; name: string; sku: string }>();
        result.forEach((product) => {
          if (!uniqueProducts.has(product.id)) {
            uniqueProducts.set(product.id, {
              id: product.id,
              name: product.name,
              sku: product.sku,
            });
          }
        });
        setSelectedProductLabels((current) => ({
          ...current,
          ...Object.fromEntries(uniqueProducts),
        }));
        setProducts(Array.from(uniqueProducts.values()));
        setProductsError(null);
      } catch {
        if (requestId !== productSearchRequestRef.current) return;
        setProducts([]);
        setProductsError("No se pudieron buscar los productos disponibles.");
      } finally {
        if (requestId === productSearchRequestRef.current) {
          setProductsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const requestId = productSearchRequestRef.current + 1;
    productSearchRequestRef.current = requestId;
    const search = productSearch.trim();

    if (!search || !filters.requestedTenantId) {
      setProducts([]);
      setProductsError(null);
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);
    setProductsError(null);
    const timeoutId = window.setTimeout(() => {
      void searchProducts(
        filters.requestedTenantId,
        filters.requestedBranchId,
        search,
        requestId
      );
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters.requestedBranchId, filters.requestedTenantId, productSearch, searchProducts]);

  const visibleProducts = useMemo(() => {
    return products.slice(0, 25);
  }, [products]);

  const updateFilter = <K extends keyof InventoryBiFilters>(
    key: K,
    value: InventoryBiFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const handleTenantChange = (tenantId: string) => {
    setFilters((current) => selectInventoryTenant(current, tenantId));
    setProductSearch("");
    setSelectedProductLabels({});
  };

  const handleBranchChange = (branchId: string) => {
    setFilters((current) => selectInventoryBranch(current, branchId));
    setProductSearch("");
    setSelectedProductLabels({});
  };

  const handleProductToggle = (product: { id: string; name: string; sku: string }) => {
    setSelectedProductLabels((current) => ({ ...current, [product.id]: product }));
    setFilters((current) => toggleInventoryProduct(current, product.id));
  };

  const handleProductRemove = (productId: string) => {
    setFilters((current) => removeInventoryProduct(current, productId));
  };

  const selectedProducts = filters.productIds
    .map((id) => selectedProductLabels[id])
    .filter((product): product is { id: string; name: string; sku: string } => Boolean(product));

  const productSummary =
    selectedProducts.length === 0
      ? "Todos los productos"
      : `${selectedProducts
          .slice(0, 2)
          .map((product) => product.name)
          .join(", ")}${selectedProducts.length > 2 ? ` +${selectedProducts.length - 2}` : ""}`;

  const handleReset = () => {
    const nextFilters = resetInventoryBiFilters(defaults);
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setProductSearch("");
    setSelectedProductLabels({});
    onApply?.(nextFilters);
  };

  const renderLoadingOption = (label: string, loading: boolean) =>
    loading ? <option value="">Cargando {label.toLowerCase()}...</option> : null;

  return (
    <section className={panelClassName} aria-labelledby="inventory-filters-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="inventory-filters-title"
            className="text-base font-bold leading-5 text-[var(--brand-surface-text)]"
          >
            Filtros de inventario
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-[var(--brand-surface-muted)]">
            Define el alcance y los filtros que usarán las próximas vistas BI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Limpiar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAppliedFilters(filters);
              onApply?.(filters);
            }}
          >
            Aplicar filtros
          </Button>
        </div>
      </div>

      <div className="inventory-bi-filter-grid grid gap-3">
        {canSelectTenant ? (
          <Select
            label="Tenant"
            value={filters.requestedTenantId}
            disabled={scopeLoading}
            onChange={(event) => handleTenantChange(event.target.value)}
          >
            <option value="">Selecciona un tenant</option>
            {renderLoadingOption("tenants", scopeLoading)}
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </Select>
        ) : (
          <Input label="Tenant activo" value={authUser?.tenantName ?? filters.requestedTenantId} readOnly disabled />
        )}

        {canSelectBranch ? (
          <Select
            label="Sucursal"
            value={filters.requestedBranchId}
            disabled={scopeLoading || !filters.requestedTenantId}
            onChange={(event) => handleBranchChange(event.target.value)}
          >
            <option value="">Todas las sucursales autorizadas</option>
            {renderLoadingOption("sucursales", scopeLoading)}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </Select>
        ) : (
          <Input label="Sucursal asignada" value={authUser?.branchName ?? filters.requestedBranchId} readOnly disabled />
        )}

        <div className="relative">
          <span className="mb-1 block text-[11px] font-semibold text-[var(--brand-surface-muted)]">
            Producto
          </span>
          <button
            type="button"
            className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-[var(--brand-surface-border)] bg-[var(--brand-surface-card)] px-3 py-2 text-left text-sm text-[var(--brand-surface-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
            aria-haspopup="listbox"
            aria-expanded={productPickerOpen}
            onClick={() => setProductPickerOpen((open) => !open)}
          >
            <span className="min-w-0 truncate">{productSummary}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {productPickerOpen ? (
            <div className="absolute z-20 mt-1 w-full min-w-[260px] rounded-lg border border-[var(--brand-surface-border)] bg-[var(--brand-surface-card)] p-2 shadow-lg">
              <Input
                label="Buscar producto"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Nombre o SKU"
              />
              {selectedProducts.length > 0 ? (
                <div className="mt-2 max-h-20 space-y-1 overflow-y-auto" aria-label="Productos seleccionados">
                  {selectedProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between gap-2 rounded bg-[var(--brand-background)] px-2 py-1 text-xs">
                      <span className="truncate">{product.name}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-[var(--brand-surface-muted)] hover:text-[var(--brand-surface-text)]"
                        aria-label={`Quitar ${product.name}`}
                        onClick={() => handleProductRemove(product.id)}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 max-h-52 overflow-y-auto" role="listbox" aria-busy={productsLoading} aria-multiselectable="true" aria-label="Resultados de productos">
                {productsLoading ? <p className="px-2 py-2 text-xs text-[var(--brand-surface-muted)]">Buscando productos...</p> : null}
                {!productSearch.trim() && !productsLoading ? <p className="px-2 py-2 text-xs text-[var(--brand-surface-muted)]">Escribe para buscar</p> : null}
                {visibleProducts.map((product) => {
                  const selected = filters.productIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-[var(--brand-background)]"
                      onClick={() => handleProductToggle(product)}
                    >
                      <span className="flex h-4 w-4 items-center justify-center rounded border border-[var(--brand-surface-border)]">
                        {selected ? <Check size={12} aria-hidden="true" /> : null}
                      </span>
                      <span className="min-w-0 truncate">{product.name} · {product.sku}</span>
                    </button>
                  );
                })}
              </div>
              {productsError ? <p className="mt-1 text-xs text-rose-700">{productsError}</p> : null}
            </div>
          ) : null}
        </div>

        <div>
          <Select
            label="Categoría"
            value={filters.categoryId}
            disabled={categoriesLoading || Boolean(categoriesError)}
            onChange={(event) => updateFilter("categoryId", event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {renderLoadingOption("categorías", categoriesLoading)}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </Select>
          {categoriesError ? <p className="mt-1 text-xs text-amber-700">{categoriesError}</p> : null}
        </div>

        <Select
          label="Estado de stock"
          value={filters.stockStatus}
          onChange={(event) => updateFilter("stockStatus", event.target.value as InventoryStockStatus)}
        >
          <option value="all">Todos</option>
          <option value="in_stock">Con stock</option>
          <option value="out_of_stock">Agotado</option>
          <option value="negative">Stock negativo</option>
        </Select>
      </div>

      {scopeError ? <p className="mt-3 text-xs text-rose-700" role="alert">{scopeError}</p> : null}
      {appliedFilters ? (
        <p className="mt-3 text-xs text-[var(--brand-surface-muted)]" role="status">
          Filtros preparados para las vistas BI.
        </p>
      ) : null}

      <div className="mt-4 border-t border-[var(--brand-surface-border)] pt-3">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showOperationalFilters}
          onClick={() => setShowOperationalFilters((current) => !current)}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Más filtros
        </Button>
        {showOperationalFilters ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Terminal operativa" value={filters.terminalId} disabled={scopeLoading} onChange={(event) => updateFilter("terminalId", event.target.value)}>
              <option value="">Todas las terminales</option>
              {renderLoadingOption("terminales", scopeLoading)}
              {terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}
            </Select>
            <Select label="Caja operativa" value={filters.cashSessionId} disabled={scopeLoading} onChange={(event) => updateFilter("cashSessionId", event.target.value)}>
              <option value="">Todas las cajas</option>
              {renderLoadingOption("cajas", scopeLoading)}
              {cashSessions.map((session) => <option key={session.id} value={session.id}>{session.cashRegisterName} · {session.branchName}</option>)}
            </Select>
            <Input label="Fecha inicial" type="date" value={filters.startDate} onChange={(event) => updateFilter("startDate", event.target.value)} />
            <Input label="Fecha final" type="date" value={filters.endDate} onChange={(event) => updateFilter("endDate", event.target.value)} />
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default InventoryBiFiltersPanel;
