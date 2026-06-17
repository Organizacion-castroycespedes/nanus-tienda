"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ProductCategoryForm } from "../../../../modules/inventory/components/ProductCategoryForm";
import {
  activateProductCategory,
  deactivateProductCategory,
  listProductCategories,
  type ProductCategoryResponse,
} from "../../../../modules/inventory/services/product-classification.service";
import {
  getClassificationInitials,
  getProductClassificationErrorMessage,
} from "../../../../modules/inventory/utils/product-classification";

type StatusFilter = "all" | "active" | "inactive";

type CategoryFilters = {
  search: string;
  status: StatusFilter;
};

type ActiveAction = "create" | "edit" | "activate" | "deactivate" | null;

const defaultFilters: CategoryFilters = {
  search: "",
  status: "all",
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

const CategoryImage = ({ category }: { category: ProductCategoryResponse }) => {
  return (
    <InventoryImagePreview
      imageUrl={category.defaultImageUrl}
      altText={category.defaultImageAltText ?? category.name}
      className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 bg-cover bg-center text-xs font-semibold text-slate-600"
      fallback={getClassificationInitials(category.name)}
    />
  );
};

const ProductCategoriesPage = () => {
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const [filters, setFilters] = useState<CategoryFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<CategoryFilters>(defaultFilters);
  const [categories, setCategories] = useState<ProductCategoryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<ProductCategoryResponse | null>(null);
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

  const loadCategories = useCallback(async (nextFilters: CategoryFilters) => {
    setLoading(true);
    setListError(null);
    try {
      const result = await listProductCategories({
        search: nextFilters.search || undefined,
        isActive: getStatusParam(nextFilters.status),
      });
      setCategories(result);
    } catch (error) {
      setListError(
        getProductClassificationErrorMessage(
          error,
          "No se pudieron cargar las categorias."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permissionsLoaded && canRead) {
      void loadCategories(defaultFilters);
    }
  }, [canRead, loadCategories, permissionsLoaded]);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.name.localeCompare(right.name, "es")
      ),
    [categories]
  );

  const openCreate = () => {
    setSelectedCategory(null);
    setActionError(null);
    setActiveAction("create");
  };

  const openEdit = (category: ProductCategoryResponse) => {
    setSelectedCategory(category);
    setActionError(null);
    setActiveAction("edit");
  };

  const openStatusAction = (
    category: ProductCategoryResponse,
    action: "activate" | "deactivate"
  ) => {
    setSelectedCategory(category);
    setActionError(null);
    setActiveAction(action);
  };

  const closeAction = () => {
    if (savingStatus) {
      return;
    }
    setActiveAction(null);
    setSelectedCategory(null);
    setActionError(null);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    void loadCategories(filters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    void loadCategories(defaultFilters);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeAction();
    showToast(
      mode === "create"
        ? "Categoria creada correctamente."
        : "Categoria actualizada correctamente.",
      "success"
    );
    void loadCategories(appliedFilters);
  };

  const handleCategoryImageChange = (updatedCategory: ProductCategoryResponse) => {
    setCategories((current) =>
      current.map((category) =>
        category.id === updatedCategory.id
          ? { ...category, ...updatedCategory }
          : category
      )
    );
    setSelectedCategory((current) =>
      current?.id === updatedCategory.id
        ? { ...current, ...updatedCategory }
        : current
    );
  };

  const handleStatusChange = async () => {
    if (!selectedCategory || !activeAction) {
      return;
    }

    setSavingStatus(true);
    setActionError(null);
    try {
      if (activeAction === "activate") {
        await activateProductCategory(selectedCategory.id);
        showToast("Categoria activada correctamente.", "success");
      }
      if (activeAction === "deactivate") {
        await deactivateProductCategory(selectedCategory.id);
        showToast("Categoria desactivada correctamente.", "success");
      }
      setActiveAction(null);
      setSelectedCategory(null);
      setActionError(null);
      await loadCategories(appliedFilters);
    } catch (error) {
      setActionError(
        getProductClassificationErrorMessage(
          error,
          "No se pudo cambiar el estado de la categoria."
        )
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const columns: DataTableColumn<ProductCategoryResponse>[] = [
    {
      key: "name",
      header: "Categoria",
      render: (category) => (
        <div className="flex min-w-[260px] items-start gap-3">
          <CategoryImage category={category} />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-slate-900">{category.name}</p>
            <p className="text-xs text-slate-500">{category.slug}</p>
            {category.description ? (
              <p className="line-clamp-2 text-xs text-slate-600">
                {category.description}
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "sort",
      header: "Orden",
      render: (category) => (
        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {category.sortOrder}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (category) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
            category.isActive ? statusBadgeStyles.active : statusBadgeStyles.inactive
          }`}
        >
          {category.isActive ? "Activa" : "Inactiva"}
        </span>
      ),
    },
    {
      key: "image",
      header: "Imagen",
      render: (category) => (
        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
          <ImageIcon className="h-4 w-4" />
          {category.defaultImageUrl ? "URL configurada" : "Placeholder"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (category) => (
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button variant="ghost" size="sm" onClick={() => openEdit(category)}>
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null}
          {canWrite && category.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openStatusAction(category, "deactivate")}
            >
              <PowerOff className="h-4 w-4" />
              Desactivar
            </Button>
          ) : null}
          {canWrite && !category.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openStatusAction(category, "activate")}
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Validando permisos...
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        No tienes permiso para administrar categorias de productos.
      </section>
    );
  }

  const isActionMode = activeAction !== null;
  const actionTitle =
    activeAction === "create"
      ? "Crear categoria"
      : activeAction === "edit"
        ? "Editar categoria"
        : activeAction === "activate"
          ? "Activar categoria"
          : "Desactivar categoria";

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
          contextLabel={selectedCategory?.name}
          onBack={closeAction}
          onCancel={closeAction}
        >
          {activeAction === "create" || activeAction === "edit" ? (
            <ProductCategoryForm
              mode={activeAction}
              category={selectedCategory}
              onCancel={closeAction}
              onSuccess={handleFormSuccess}
              onImageChange={handleCategoryImageChange}
            />
          ) : null}

          {activeAction === "activate" || activeAction === "deactivate" ? (
            <ConfirmationMessage
              title={`${actionTitle}: ${selectedCategory?.name ?? ""}`}
              description={
                activeAction === "deactivate"
                  ? "La categoria quedara inactiva. No se borrara y podra reactivarse."
                  : "La categoria volvera a estar disponible para el catalogo."
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
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Inventory
                </p>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Categorias de productos
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Administra la clasificacion principal del catalogo.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="ghost"
                  onClick={() => void loadCategories(appliedFilters)}
                  isLoading={loading}
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </Button>
                {canWrite ? (
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Crear categoria
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto]">
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
            rows={sortedCategories}
            getRowKey={(category) => category.id}
            loading={loading}
            error={listError}
            loadingState="Cargando categorias..."
            emptyState="No hay categorias para mostrar."
          />
        </>
      ) : null}
    </div>
  );
};

export default ProductCategoriesPage;
