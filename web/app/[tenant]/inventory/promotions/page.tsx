"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
} from "lucide-react";
import { listProducts } from "../../../../domains/products/api";
import type { ProductResponse } from "../../../../domains/products/dtos";
import { listBranches } from "../../../../domains/branches/api";
import type { BranchResponse } from "../../../../domains/branches/dtos";
import { MENU_KEYS } from "../../../../domains/menu/constants";
import { Button } from "../../../../components/design-system/Button";
import {
  DataTable,
  type DataTableColumn,
} from "../../../../components/design-system/DataTable";
import { ConfirmDialog } from "../../../../components/design-system/confirm-dialog";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { hasMenuAccess } from "../../../../lib/permissions";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { useAppSelector } from "../../../../store/hooks";
import { useInventoryScope } from "../../../../hooks/useInventoryScope";
import { FocusActionLayout } from "../../../../modules/inventory/components/FocusActionLayout";
import {
  PromotionFormPanel,
  type PromotionFormState,
} from "../../../../modules/pricing/components/PromotionFormPanel";
import {
  createPromotion,
  deactivatePromotion,
  getPromotion,
  listPromotions,
  updatePromotion,
  type CreatePromotionPayload,
  type PromotionDiscountType,
  type PromotionResponse,
} from "../../../../modules/pricing/services/promotions.service";

type StatusFilter = "active" | "inactive" | "all";

type PromotionFilters = {
  search: string;
  status: StatusFilter;
};

type ActiveAction = "create" | "edit" | "deactivate" | null;

type ActionFeedback = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
};

const defaultFilters: PromotionFilters = {
  search: "",
  status: "active",
};

const discountTypeLabels: Record<PromotionDiscountType, string> = {
  PERCENTAGE: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo",
  SPECIAL_PRICE: "Precio especial",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);

const toDateTimeLocalValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const createDefaultForm = (): PromotionFormState => {
  const startsAt = new Date();
  startsAt.setSeconds(0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + 7);

  return {
    name: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "0",
    startsAt: toDateTimeLocalValue(startsAt),
    endsAt: toDateTimeLocalValue(endsAt),
    priority: "100",
    isActive: true,
    productIds: [],
    branchIds: [],
  };
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const toApiDateTime = (value: string) => new Date(value).toISOString();

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const productLabel = (product: ProductResponse) => `${product.name} (${product.sku})`;

const branchLabel = (branch: BranchResponse) =>
  `${branch.nombre}${branch.codigo ? ` (${branch.codigo})` : ""}`;

const formatDiscount = (promotion: PromotionResponse) => {
  const value = Number(promotion.discountValue);
  if (promotion.discountType === "PERCENTAGE") {
    return `${value}%`;
  }
  if (promotion.discountType === "SPECIAL_PRICE") {
    return `Precio ${formatCurrency(value)}`;
  }
  return formatCurrency(value);
};

const validateForm = (form: PromotionFormState) => {
  if (!form.name.trim()) {
    return "name es requerido.";
  }

  const discountValue = Number(form.discountValue);
  if (!Number.isFinite(discountValue)) {
    return "discountValue debe ser numerico.";
  }
  if (form.discountType === "PERCENTAGE" && (discountValue <= 0 || discountValue > 100)) {
    return "PERCENTAGE debe ser mayor a 0 y menor o igual a 100.";
  }
  if (form.discountType === "FIXED_AMOUNT" && discountValue <= 0) {
    return "FIXED_AMOUNT debe ser mayor a 0.";
  }
  if (form.discountType === "SPECIAL_PRICE" && discountValue < 0) {
    return "SPECIAL_PRICE debe ser mayor o igual a 0.";
  }

  const startsAt = new Date(form.startsAt);
  const endsAt = new Date(form.endsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return "startsAt es invalido.";
  }
  if (Number.isNaN(endsAt.getTime())) {
    return "endsAt es invalido.";
  }
  if (endsAt <= startsAt) {
    return "endsAt debe ser mayor que startsAt.";
  }

  const priority = Number(form.priority);
  if (!Number.isInteger(priority) || priority < 0) {
    return "priority debe ser entero y >= 0.";
  }

  if (form.productIds.length === 0) {
    return "Selecciona al menos un producto.";
  }

  return null;
};

const PromotionsAdminPage = () => {
  const params = useParams<{ tenant: string }>();
  const routeTenant = params?.tenant ?? "";
  const { currentTenant } = useInventoryScope();
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const [filters, setFilters] = useState<PromotionFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<PromotionFilters>(defaultFilters);
  const [promotions, setPromotions] = useState<PromotionResponse[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [branchWarning, setBranchWarning] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedPromotion, setSelectedPromotion] =
    useState<PromotionResponse | null>(null);
  const [form, setForm] = useState<PromotionFormState>(() => createDefaultForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingPromotionId, setOpeningPromotionId] = useState<string | null>(null);
  const [promotionToDeactivate, setPromotionToDeactivate] =
    useState<PromotionResponse | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);

  useAutoClearState(toastMessage, setToastMessage);

  const canRead = permissionsLoaded
    ? hasMenuAccess(MENU_KEYS.INVENTORY_PROMOTIONS, "READ")
    : false;
  const canWrite = permissionsLoaded
    ? hasMenuAccess(MENU_KEYS.INVENTORY_PROMOTIONS, "WRITE")
    : false;

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const readPromotions = useCallback(async (nextFilters: PromotionFilters) => {
    setLoading(true);
    setListError(null);
    try {
      const isActive =
        nextFilters.status === "all"
          ? undefined
          : nextFilters.status === "active";
      const result = await listPromotions({
        search: nextFilters.search || undefined,
        isActive,
      });
      setPromotions(result);
    } catch (error) {
      setListError(
        getErrorMessage(error, "No se pudieron cargar las promociones.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReferences = useCallback(async () => {
    setReferencesLoading(true);
    setReferenceError(null);
    setBranchWarning(null);

    try {
      const result = await listProducts({
        tenantId: currentTenant ?? undefined,
      });
      setProducts(result);
    } catch (error) {
      setProducts([]);
      setReferenceError(
        getErrorMessage(error, "No se pudieron cargar los productos.")
      );
    }

    try {
      const result = await listBranches({
        tenantId: currentTenant ?? undefined,
      });
      setBranches(result);
    } catch (error) {
      setBranches([]);
      setBranchWarning(
        getErrorMessage(
          error,
          "No se pudieron cargar sucursales. La promocion puede quedar para todas."
        )
      );
    } finally {
      setReferencesLoading(false);
    }
  }, [currentTenant]);

  useEffect(() => {
    void readPromotions(defaultFilters);
    void loadReferences();
  }, [loadReferences, readPromotions]);

  const productMap = useMemo(() => {
    const map = new Map<string, ProductResponse>();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const branchMap = useMemo(() => {
    const map = new Map<string, BranchResponse>();
    branches.forEach((branch) => {
      map.set(branch.id, branch);
    });
    return map;
  }, [branches]);

  const productOptions = useMemo(
    () =>
      Array.from(productMap.values()).sort((left, right) =>
        productLabel(left).localeCompare(productLabel(right), "es")
      ),
    [productMap]
  );

  const filteredProducts = useMemo(() => {
    const query = normalizeSearch(productSearch);
    if (!query) {
      return productOptions;
    }
    return productOptions.filter((product) =>
      `${product.name} ${product.sku}`.toLowerCase().includes(query)
    );
  }, [productOptions, productSearch]);

  const filteredBranches = useMemo(() => {
    const query = normalizeSearch(branchSearch);
    if (!query) {
      return branches;
    }
    return branches.filter((branch) =>
      `${branch.nombre} ${branch.codigo}`.toLowerCase().includes(query)
    );
  }, [branchSearch, branches]);

  const resolveProductList = (ids: string[]) => {
    if (ids.length === 0) {
      return "Sin productos";
    }
    const labels = ids.slice(0, 3).map((id) => {
      const product = productMap.get(id);
      return product ? productLabel(product) : id.slice(0, 8);
    });
    return ids.length > 3 ? `${labels.join(", ")} +${ids.length - 3}` : labels.join(", ");
  };

  const resolveBranchList = (ids: string[]) => {
    if (ids.length === 0) {
      return "Todas las sucursales permitidas";
    }
    const labels = ids.slice(0, 3).map((id) => {
      const branch = branchMap.get(id);
      return branch ? branchLabel(branch) : id.slice(0, 8);
    });
    return ids.length > 3 ? `${labels.join(", ")} +${ids.length - 3}` : labels.join(", ");
  };

  const openCreateForm = () => {
    setSelectedPromotion(null);
    setForm(createDefaultForm());
    setProductSearch("");
    setBranchSearch("");
    setFormError(null);
    setFormMode("create");
  };

  const promotionToForm = (promotion: PromotionResponse): PromotionFormState => ({
    name: promotion.name,
    description: promotion.description ?? "",
    discountType: promotion.discountType,
    discountValue: String(promotion.discountValue),
    startsAt: toDateTimeLocalValue(new Date(promotion.startsAt)),
    endsAt: toDateTimeLocalValue(new Date(promotion.endsAt)),
    priority: String(promotion.priority),
    isActive: promotion.isActive,
    productIds: promotion.productIds,
    branchIds: promotion.branchIds,
  });

  const openEditForm = async (promotion: PromotionResponse) => {
    setOpeningPromotionId(promotion.id);
    setFormError(null);
    try {
      const freshPromotion = await getPromotion(promotion.id);
      setSelectedPromotion(freshPromotion);
      setForm(promotionToForm(freshPromotion));
      setProductSearch("");
      setBranchSearch("");
      setFormMode("edit");
    } catch (error) {
      showToast(
        getErrorMessage(error, "No se pudo cargar la promocion."),
        "error"
      );
    } finally {
      setOpeningPromotionId(null);
    }
  };

  const closeForm = () => {
    if (saving) {
      return;
    }
    setFormMode(null);
    setSelectedPromotion(null);
    setFormError(null);
  };

  const closeDeactivate = () => {
    if (deactivating) {
      return;
    }
    setPromotionToDeactivate(null);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    void readPromotions(filters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    void readPromotions(defaultFilters);
  };

  const toggleProduct = (productId: string) => {
    setForm((current) => {
      const exists = current.productIds.includes(productId);
      return {
        ...current,
        productIds: exists
          ? current.productIds.filter((id) => id !== productId)
          : [...current.productIds, productId],
      };
    });
  };

  const toggleBranch = (branchId: string) => {
    setForm((current) => {
      const exists = current.branchIds.includes(branchId);
      return {
        ...current,
        branchIds: exists
          ? current.branchIds.filter((id) => id !== branchId)
          : [...current.branchIds, branchId],
      };
    });
  };

  const buildPayload = (): CreatePromotionPayload => ({
    name: form.name.trim(),
    description: form.description.trim() || null,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    startsAt: toApiDateTime(form.startsAt),
    endsAt: toApiDateTime(form.endsAt),
    priority: Number(form.priority),
    productIds: form.productIds,
    branchIds: form.branchIds,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        let created = await createPromotion(buildPayload());
        if (!form.isActive) {
          created = await updatePromotion(created.id, { isActive: false });
        }
        setSelectedPromotion(created);
        setActionFeedback({
          title: "Promoción creada correctamente",
          description: "La promoción quedó disponible para el motor de precios.",
          variant: "success",
        });
      }

      if (formMode === "edit" && selectedPromotion) {
        await updatePromotion(selectedPromotion.id, {
          ...buildPayload(),
          isActive: form.isActive,
        });
        setActionFeedback({
          title: "Promoción actualizada correctamente",
          description: "Los cambios de la promoción fueron guardados.",
          variant: "success",
        });
      }

      setFormMode(null);
      setSelectedPromotion(null);
      await readPromotions(appliedFilters);
    } catch (error) {
      setFormError(
        getErrorMessage(error, "No se pudo guardar la promocion.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!promotionToDeactivate) {
      return;
    }

    setDeactivating(true);
    try {
      await deactivatePromotion(promotionToDeactivate.id);
      setActionFeedback({
        title: "Promoción desactivada correctamente",
        description: "La promoción dejó de aplicar en PricingService.",
        variant: "success",
      });
      setPromotionToDeactivate(null);
      await readPromotions(appliedFilters);
    } catch (error) {
      showToast(
        getErrorMessage(error, "No se pudo inactivar la promocion."),
        "error"
      );
    } finally {
      setDeactivating(false);
    }
  };

  const activeAction: ActiveAction = formMode ?? (promotionToDeactivate ? "deactivate" : null);
  const isActionMode = activeAction !== null;
  const actionTitle =
    activeAction === "create"
      ? "Crear promoción"
      : activeAction === "edit"
        ? "Editar promoción"
        : "Desactivar promoción";
  const actionDescription =
    activeAction === "create"
      ? "Configura la promoción sin mezclar el formulario con el listado."
      : activeAction === "edit"
        ? "Actualiza la promoción seleccionada y conserva el contexto del listado."
        : "Confirma o cancela la desactivación antes de volver al listado.";
  const actionContextLabel =
    activeAction === "edit" && selectedPromotion
      ? selectedPromotion.name
      : activeAction === "deactivate" && promotionToDeactivate
        ? promotionToDeactivate.name
        : undefined;

  const columns: DataTableColumn<PromotionResponse>[] = [
    {
      key: "name",
      header: "Promocion",
      render: (promotion) => (
        <div className="max-w-xs space-y-1">
          <p className="font-semibold text-slate-900">{promotion.name}</p>
          <p className="text-xs text-slate-500">
            {promotion.description || "Sin descripcion"}
          </p>
        </div>
      ),
    },
    {
      key: "discount",
      header: "Descuento",
      render: (promotion) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{formatDiscount(promotion)}</p>
          <p className="text-xs text-slate-500">
            {discountTypeLabels[promotion.discountType]}
          </p>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Vigencia",
      render: (promotion) => (
        <div className="space-y-1 text-xs">
          <p>Desde {formatDateTime(promotion.startsAt)}</p>
          <p>Hasta {formatDateTime(promotion.endsAt)}</p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (promotion) => (
        <div className="space-y-1">
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {promotion.priority}
          </span>
          <p className="text-xs text-slate-500">Menor gana</p>
        </div>
      ),
    },
    {
      key: "targets",
      header: "Alcance",
      render: (promotion) => (
        <div className="max-w-sm space-y-1 text-xs">
          <p className="text-slate-700">{resolveProductList(promotion.productIds)}</p>
          <p className="text-slate-500">{resolveBranchList(promotion.branchIds)}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (promotion) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
            promotion.isActive
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-100 text-slate-700"
          }`}
        >
          {promotion.isActive ? "Activa" : "Inactiva"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (promotion) => (
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void openEditForm(promotion)}
              isLoading={openingPromotionId === promotion.id}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          ) : null}
          {canWrite && promotion.isActive ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPromotionToDeactivate(promotion)}
            >
              <Power className="h-4 w-4" />
              Inactivar
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  if (permissionsLoaded && !canRead) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        No tienes permiso para administrar promociones.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={Boolean(actionFeedback)}
        onOpenChange={(open) => {
          if (!open) {
            setActionFeedback(null);
          }
        }}
        title={actionFeedback?.title ?? ""}
        description={actionFeedback?.description}
        confirmText="Entendido"
        variant={actionFeedback?.variant ?? "success"}
        hideCancel
        onConfirm={() => setActionFeedback(null)}
      />

      {isActionMode ? (
        <FocusActionLayout
          title={actionTitle}
          description={actionDescription}
          contextLabel={actionContextLabel}
          onBack={activeAction === "deactivate" ? closeDeactivate : closeForm}
          onCancel={activeAction === "deactivate" ? closeDeactivate : closeForm}
        >
          {formMode ? (
            <PromotionFormPanel
              mode={formMode}
              form={form}
              setForm={setForm}
              formError={formError}
              saving={saving}
              referencesLoading={referencesLoading}
              filteredProducts={filteredProducts}
              filteredBranches={filteredBranches}
              productSearch={productSearch}
              branchSearch={branchSearch}
              branchWarning={branchWarning}
              onProductSearchChange={setProductSearch}
              onBranchSearchChange={setBranchSearch}
              onToggleProduct={toggleProduct}
              onToggleBranch={toggleBranch}
              onSubmit={handleSubmit}
              onCancel={closeForm}
            />
          ) : null}

          {promotionToDeactivate ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-900">
                  Desactivar promocion: {promotionToDeactivate.name}
                </p>
                <p className="text-sm text-amber-800">
                  La promocion dejara de aplicar en PricingService. Esta accion conserva
                  el registro para consulta posterior.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button variant="ghost" onClick={closeDeactivate} disabled={deactivating}>
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void handleDeactivate()}
                    isLoading={deactivating}
                  >
                    Desactivar promocion
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
        </FocusActionLayout>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Inventory</p>
            <h1 className="text-2xl font-semibold text-slate-900">Promociones</h1>
            <p className="mt-2 text-sm text-slate-600">
              {isActionMode
                ? "Completa la accion activa y vuelve al listado cuando termines."
                : "Administra descuentos de productos. Menor priority gana."}
            </p>
            <p className="mt-1 text-xs text-slate-500">Tenant ruta: {routeTenant}</p>
          </div>
          {!isActionMode ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  void loadReferences();
                  void readPromotions(appliedFilters);
                }}
                isLoading={loading || referencesLoading}
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </Button>
              {canWrite ? (
                <Button onClick={openCreateForm}>
                  <Plus className="h-4 w-4" />
                  Crear promocion
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      {referenceError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {referenceError}
        </section>
      ) : null}

      {!isActionMode ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Nombre o descripcion"
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
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
            <option value="all">Todas</option>
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
          <div className="flex items-end">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span className="inline-flex items-center gap-2 font-semibold">
                <BadgePercent className="h-4 w-4" />
                Menor priority gana
              </span>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {!isActionMode ? (
      <DataTable
        columns={columns}
        rows={promotions}
        getRowKey={(promotion) => promotion.id}
        loading={loading}
        error={listError}
        loadingState="Cargando promociones..."
        emptyState="No hay promociones para mostrar."
      />
      ) : null}
    </div>
  );
};

export default PromotionsAdminPage;
