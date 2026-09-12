"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ImageIcon, Pencil, Plus, Power, PowerOff, RefreshCw, Search } from "lucide-react";
import { MENU_KEYS } from "../../../../domains/menu/constants";
import { Button } from "../../../../components/design-system/Button";
import { ConfirmationMessage } from "../../../../components/design-system/confirmation-message";
import {
  DataTable,
  type DataTableColumn,
} from "../../../../components/design-system/DataTable";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { hasMenuAccess } from "../../../../lib/permissions";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { useAppSelector } from "../../../../store/hooks";
import { FocusActionLayout } from "../../../../modules/inventory/components/FocusActionLayout";
import { InventoryImagePreview } from "../../../../modules/inventory/components/InventoryImagePreview";
import { ProductSubcategoryForm } from "../../../../modules/inventory/components/ProductSubcategoryForm";
import {
  activateProductSubcategory,
  deactivateProductSubcategory,
  listProductCategories,
  listProductSubcategories,
  type ProductCategoryResponse,
  type ProductSubcategoryResponse,
} from "../../../../modules/inventory/services/product-classification.service";
import {
  getClassificationInitials,
  getProductClassificationErrorMessage,
} from "../../../../modules/inventory/utils/product-classification";

type StatusFilter = "all" | "active" | "inactive";

type SubcategoryFilters = {
  search: string;
  status: StatusFilter;
  categoryId: string;
};

type ActiveAction = "create" | "edit" | "activate" | "deactivate" | null;

const defaultFilters: SubcategoryFilters = {
  search: "",
  status: "all",
  categoryId: "",
};

const statusBadgeStyles = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-700",
};

const getStatusParam = (status: StatusFilter) => {
  if (status === "active") {
    return true;
  }
  if (status === "inactive") {
    return false;
  }
  return undefined;
};

const SubcategoryImage = ({
  subcategory,
}: {
  subcategory: ProductSubcategoryResponse;
}) => {
  return (
    <InventoryImagePreview
      imageUrl={subcategory.defaultImageUrl}
      altText={subcategory.defaultImageAltText ?? subcategory.name}
      className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 bg-cover bg-center text-xs font-semibold text-slate-600 dark:text-slate-300"
      fallback={getClassificationInitials(subcategory.name)}
    />
  );
};

const ProductSubcategoriesPage = () => {
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params?.tenant ?? "default";
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const [filters, setFilters] = useState<SubcategoryFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<SubcategoryFilters>(defaultFilters);
  const [categories, setCategories] = useState<ProductCategoryResponse[]>([]);
  const [subcategories, setSubcategories] = useState<ProductSubcategoryResponse[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [selectedSubcategory, setSelectedSubcategory] =
    useState<ProductSubcategoryResponse | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useAutoClearState(toastMessage, setToastMessage);

  const canRead = permissionsLoaded
    ? hasMenuAccess(MENU_KEYS.INVENTORY_PRODUCTS, "READ")
    : false;
  const canWrite = permissionsLoaded
    ? hasMenuAccess(MENU_KEYS.INVENTORY_PRODUCTS, "WRITE")
    : false;

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    setCategoryError(null);
    try {
      const result = await listProductCategories();
      setCategories(result);
    } catch (error) {
      setCategoryError(
        getProductClassificationErrorMessage(
          error,
          "No se pudieron cargar las categorias."
        )
      );
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadSubcategories = useCallback(
    async (nextFilters: SubcategoryFilters) => {
      setLoadingSubcategories(true);
      setListError(null);
      try {
        const result = await listProductSubcategories({
          categoryId: nextFilters.categoryId || undefined,
          search: nextFilters.search || undefined,
          isActive: getStatusParam(nextFilters.status),
        });
        setSubcategories(result);
      } catch (error) {
        setListError(
          getProductClassificationErrorMessage(
            error,
            "No se pudieron cargar las subcategorias."
          )
        );
      } finally {
        setLoadingSubcategories(false);
      }
    },
    []
  );

  useEffect(() => {
    if (permissionsLoaded && canRead) {
      void loadCategories();
      void loadSubcategories(defaultFilters);
    }
  }, [canRead, loadCategories, loadSubcategories, permissionsLoaded]);

  const categoryById = useMemo(() => {
    const map = new Map<string, ProductCategoryResponse>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);

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
      [...subcategories].sort((left, right) => {
        const leftCategory = categoryById.get(left.categoryId)?.name ?? "";
        const rightCategory = categoryById.get(right.categoryId)?.name ?? "";
        return (
          leftCategory.localeCompare(rightCategory, "es") ||
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, "es")
        );
      }),
    [categoryById, subcategories]
  );

  const openCreate = () => {
    setSelectedSubcategory(null);
    setActionError(null);
    setActiveAction("create");
  };

  const openEdit = (subcategory: ProductSubcategoryResponse) => {
    setSelectedSubcategory(subcategory);
    setActionError(null);
    setActiveAction("edit");
  };

  const openStatusAction = (
    subcategory: ProductSubcategoryResponse,
    action: "activate" | "deactivate"
  ) => {
    setSelectedSubcategory(subcategory);
    setActionError(null);
    setActiveAction(action);
  };

  const closeAction = () => {
    if (savingStatus) {
      return;
    }
    setActiveAction(null);
    setSelectedSubcategory(null);
    setActionError(null);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    void loadSubcategories(filters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    void loadSubcategories(defaultFilters);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeAction();
    showToast(
      mode === "create"
        ? "Subcategoria creada correctamente."
        : "Subcategoria actualizada correctamente.",
      "success"
    );
    void loadSubcategories(appliedFilters);
  };

  const handleSubcategoryImageChange = (
    updatedSubcategory: ProductSubcategoryResponse
  ) => {
    setSubcategories((current) =>
      current.map((subcategory) =>
        subcategory.id === updatedSubcategory.id
          ? { ...subcategory, ...updatedSubcategory }
          : subcategory
      )
    );
    setSelectedSubcategory((current) =>
      current?.id === updatedSubcategory.id
        ? { ...current, ...updatedSubcategory }
        : current
    );
  };

  const handleStatusChange = async () => {
    if (!selectedSubcategory || !activeAction) {
      return;
    }

    setSavingStatus(true);
    setActionError(null);
    try {
      if (activeAction === "activate") {
        await activateProductSubcategory(selectedSubcategory.id);
        showToast("Subcategoria activada correctamente.", "success");
      }
      if (activeAction === "deactivate") {
        await deactivateProductSubcategory(selectedSubcategory.id);
        showToast("Subcategoria desactivada correctamente.", "success");
      }
      setActiveAction(null);
      setSelectedSubcategory(null);
      setActionError(null);
      await loadSubcategories(appliedFilters);
    } catch (error) {
      setActionError(
        getProductClassificationErrorMessage(
          error,
          "No se pudo cambiar el estado de la subcategoria."
        )
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const goToCategories = () => {
    router.push(`/${tenantSlug}/inventory/product-categories`);
  };

  const columns: DataTableColumn<ProductSubcategoryResponse>[] = [
    {
      key: "name",
      header: "Subcategoria",
      render: (subcategory) => (
        <div className="flex min-w-[260px] items-start gap-3">
          <SubcategoryImage subcategory={subcategory} />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">{subcategory.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{subcategory.slug}</p>
            {subcategory.description ? (
              <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                {subcategory.description}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoria padre",
      render: (subcategory) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {categoryById.get(subcategory.categoryId)?.name ?? "Sin cargar"}
        </span>
      ),
    },
    {
      key: "sort",
      header: "Orden",
      render: (subcategory) => (
        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {subcategory.sortOrder}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (subcategory) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
            subcategory.isActive
              ? statusBadgeStyles.active
              : statusBadgeStyles.inactive
          }`}
        >
          {subcategory.isActive ? "Activa" : "Inactiva"}
        </span>
      ),
    },
    {
      key: "image",
      header: "Imagen",
      render: (subcategory) => (
        <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <ImageIcon className="h-4 w-4" />
          {subcategory.defaultImageUrl ? "URL configurada" : "Placeholder"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (subcategory) => (
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button variant="ghost" size="sm" onClick={() => openEdit(subcategory)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null}
          {canWrite && subcategory.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openStatusAction(subcategory, "deactivate")}
            >
              <PowerOff className="h-4 w-4" />
              Desactivar
            </Button>
          ) : null}
          {canWrite && !subcategory.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openStatusAction(subcategory, "activate")}
            >
              <Power className="h-4 w-4" />
              Activar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  if (!permissionsLoaded) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
        Validando permisos...
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        No tienes permiso para administrar subcategorias de productos.
      </section>
    );
  }

  const isActionMode = activeAction !== null;
  const actionTitle =
    activeAction === "create"
      ? "Crear subcategoria"
      : activeAction === "edit"
        ? "Editar subcategoria"
        : activeAction === "activate"
          ? "Activar subcategoria"
          : "Desactivar subcategoria";

  return (
    <div className="space-y-6">
      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      {isActionMode ? (
        <FocusActionLayout
          title={actionTitle}
          description="Completa la accion activa y vuelve al listado cuando termines."
          contextLabel={selectedSubcategory?.name}
          onBack={closeAction}
          onCancel={closeAction}
        >
          {activeAction === "create" || activeAction === "edit" ? (
            <ProductSubcategoryForm
              mode={activeAction}
              subcategory={selectedSubcategory}
              categories={sortedCategories}
              defaultCategoryId={filters.categoryId}
              onCancel={closeAction}
              onSuccess={handleFormSuccess}
              onImageChange={handleSubcategoryImageChange}
            />
          ) : null}

          {activeAction === "activate" || activeAction === "deactivate" ? (
            <ConfirmationMessage
              title={`${actionTitle}: ${selectedSubcategory?.name ?? ""}`}
              description={
                activeAction === "deactivate"
                  ? "La subcategoria quedara inactiva. No se borrara y podra reactivarse."
                  : "La subcategoria volvera a estar disponible para el catalogo."
              }
              variant="warning"
              actions={
                <>
                  <Button variant="ghost" onClick={closeAction} disabled={savingStatus}>
                    Cancelar
                  </Button>
                  <Button
                    variant={activeAction === "deactivate" ? "warning" : "primary"}
                    onClick={() => void handleStatusChange()}
                    isLoading={savingStatus}
                  >
                    {activeAction === "deactivate" ? "Desactivar" : "Activar"}
                  </Button>
                </>
              }
            />
          ) : null}

          {actionError ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {actionError}
            </section>
          ) : null}
        </FocusActionLayout>
      ) : null}

      {!isActionMode ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Inventory
                </p>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  Subcategorias de productos
                </h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Organiza la clasificacion secundaria dependiente de categorias.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    void loadCategories();
                    void loadSubcategories(appliedFilters);
                  }}
                  isLoading={loadingCategories || loadingSubcategories}
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </Button>
                {canWrite ? (
                  <Button onClick={openCreate} disabled={categories.length === 0}>
                    <Plus className="h-4 w-4" />
                    Crear subcategoria
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          {categoryError ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {categoryError}
            </section>
          ) : null}

          {!loadingCategories && categories.length === 0 ? (
            <ConfirmationMessage
              title="Primero crea una categoria"
              description="Las subcategorias siempre dependen de una categoria del tenant actual."
              variant="warning"
              actions={
                <Button onClick={goToCategories}>
                  <Plus className="h-4 w-4" />
                  Ir a categorias
                </Button>
              }
            />
          ) : null}

          {categories.length > 0 && !filters.categoryId ? (
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Selecciona una categoria para filtrar el listado o crear una
              subcategoria ya asociada.
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px_180px_auto]">
              <Input
                label="Buscar"
                placeholder="Nombre o slug"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
              />
              <Select
                label="Categoria"
                value={filters.categoryId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">Todas</option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Estado"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as StatusFilter,
                  }))
                }
              >
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
              </Select>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={handleApplyFilters}>
                  <Search className="h-4 w-4" />
                  Buscar
                </Button>
                <Button variant="ghost" onClick={handleResetFilters}>
                  Limpiar
                </Button>
              </div>
            </div>
          </section>

          <DataTable
            columns={columns}
            rows={sortedSubcategories}
            getRowKey={(subcategory) => subcategory.id}
            loading={loadingSubcategories}
            error={listError}
            loadingState="Cargando subcategorias..."
            emptyState="No hay subcategorias para mostrar."
          />
        </>
      ) : null}
    </div>
  );
};

export default ProductSubcategoriesPage;
