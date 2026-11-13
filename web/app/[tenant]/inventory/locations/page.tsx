"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Layers, MapPin, Pencil, Plus, RefreshCw, RotateCcw, Search, X, XCircle } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { ConfirmationMessage } from "../../../../components/design-system/confirmation-message";
import { Input } from "../../../../components/design-system/Input";
import { RowActionsMenu, type RowActionItem } from "../../../../components/design-system/RowActionsMenu";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { listBranches } from "../../../../domains/branches/api";
import type { BranchResponse } from "../../../../domains/branches/dtos";
import { useInventoryScope } from "../../../../hooks/useInventoryScope";
import { hasPermission } from "../../../../lib/permissions";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { FocusActionLayout } from "../../../../modules/inventory/components/FocusActionLayout";
import {
  InventoryLocationForm,
  type InventoryLocationBranchOption,
} from "../../../../modules/inventory/components/InventoryLocationForm";
import { CollapsibleFilterPanel } from "../../../../modules/inventory/list-filters/CollapsibleFilterPanel";
import {
  deactivateInventoryLocation,
  INVENTORY_LOCATION_TYPES,
  listInventoryLocations,
  updateInventoryLocation,
  type InventoryLocationResponse,
  type InventoryLocationType,
} from "../../../../modules/inventory/services/inventory-location.service";
import { listInventoryLotBalances } from "../../../../modules/inventory/services/inventory-lot.service";

type LocationFilters = {
  search: string;
  branchId: string;
  type: InventoryLocationType | "";
  isActive: "all" | "true" | "false";
};

type LocationFilterKey = Exclude<keyof LocationFilters, "search">;

type DeactivationCheck =
  | { state: "loading" }
  | { state: "ready"; balances: number; units: number }
  | { state: "error" };

const createDefaultFilters = (branchId?: string | null): LocationFilters => ({
  search: "",
  branchId: branchId ?? "",
  type: "",
  isActive: "true",
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const pageSizeOptions = [10, 25, 50];
const UNKNOWN_BRANCH = "Sucursal no disponible";

const typeLabels: Record<InventoryLocationType, string> = {
  WAREHOUSE: "Bodega",
  DISPLAY: "Vitrina",
  SHELF: "Estante",
  COLD_ROOM: "Cuarto frio",
  COUNTER: "Mostrador",
  OTHER: "Otro",
};

const typeBadgeStyles: Record<InventoryLocationType, string> = {
  WAREHOUSE: "border-blue-200 bg-blue-50 text-blue-700",
  DISPLAY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SHELF: "border-slate-200 bg-slate-100 text-slate-700",
  COLD_ROOM: "border-cyan-200 bg-cyan-50 text-cyan-700",
  COUNTER: "border-amber-200 bg-amber-50 text-amber-700",
  OTHER: "border-violet-200 bg-violet-50 text-violet-700",
};

const activeLabels: Record<LocationFilters["isActive"], string> = {
  all: "Todos",
  true: "Activas",
  false: "Inactivas",
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
};

const mapBranch = (branch: BranchResponse): InventoryLocationBranchOption => ({
  id: branch.id,
  name: branch.nombre,
});

const InventoryLocationsPage = () => {
  const { currentTenant, currentBranch, isSuperRole } = useInventoryScope();
  const router = useRouter();
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params?.tenant ?? "";
  const searchParams = useSearchParams();
  const defaultFilters = useMemo(
    () => createDefaultFilters(isSuperRole ? "" : currentBranch),
    [currentBranch, isSuperRole]
  );
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [branchOptions, setBranchOptions] = useState<InventoryLocationBranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [draftFilters, setDraftFilters] = useState<LocationFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<LocationFilters>(defaultFilters);
  const [preloadedFromUrl, setPreloadedFromUrl] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [branchErrorMessage, setBranchErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<InventoryLocationResponse | null>(null);
  const [pendingDeactivateLocation, setPendingDeactivateLocation] =
    useState<InventoryLocationResponse | null>(null);
  const [deactivationCheck, setDeactivationCheck] = useState<DeactivationCheck | null>(null);
  const [pendingFormCancel, setPendingFormCancel] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const urlApplied = useRef(false);

  const canCreate = hasPermission("inventory.create");
  const canEdit = hasPermission("inventory.update");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  // Sucursal por defecto del rol y precarga desde la URL (sin consultar).
  useEffect(() => {
    if (urlApplied.current || (!isSuperRole && !currentBranch)) {
      return;
    }
    urlApplied.current = true;
    const next = { ...defaultFilters };
    const branchParam = searchParams.get("branchId")?.trim() ?? "";
    const searchParam = searchParams.get("search")?.trim() ?? "";
    const branchAllowed =
      UUID_PATTERN.test(branchParam) && (isSuperRole || branchParam === currentBranch);
    if (branchAllowed) {
      next.branchId = branchParam;
    }
    if (searchParam) {
      next.search = searchParam.slice(0, 100);
    }
    setDraftFilters(next);
    setAppliedFilters(next);
    setPreloadedFromUrl(branchAllowed || Boolean(searchParam));
  }, [currentBranch, defaultFilters, isSuperRole, searchParams]);

  const loadBranches = useCallback(async () => {
    setLoadingBranches(true);
    setBranchErrorMessage(null);
    try {
      const result = await listBranches({ tenantId: currentTenant ?? undefined });
      const options = result.map(mapBranch);

      if (currentBranch && !options.some((branch) => branch.id === currentBranch)) {
        options.unshift({
          id: currentBranch,
          name: "Sucursal actual",
        });
      }

      setBranchOptions(options);
    } catch {
      if (currentBranch) {
        setBranchOptions([
          {
            id: currentBranch,
            name: "Sucursal actual",
          },
        ]);
      }
      setBranchErrorMessage("No se pudieron cargar las sucursales.");
    } finally {
      setLoadingBranches(false);
    }
  }, [currentBranch, currentTenant]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const resolveLocationFilters = useCallback(
    (filters: LocationFilters) => ({
      branchId: filters.branchId || (!isSuperRole ? currentBranch ?? undefined : undefined),
      type: filters.type || undefined,
      isActive:
        filters.isActive === "all" ? undefined : filters.isActive === "true",
      search: filters.search.trim() || undefined,
    }),
    [currentBranch, isSuperRole]
  );

  const loadLocations = useCallback(
    async (filters: LocationFilters) => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await listInventoryLocations(resolveLocationFilters(filters));
        setLocations(result);
        setHasSearched(true);
      } catch (error) {
        setErrorMessage(
          getErrorMessage(error, "No se pudieron cargar las ubicaciones.")
        );
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [resolveLocationFilters]
  );

  const branchNameById = useMemo(() => {
    const branches = new Map<string, string>();
    branchOptions.forEach((branch) => {
      branches.set(branch.id, branch.name);
    });
    return branches;
  }, [branchOptions]);

  const describeBranch = useCallback(
    (branchId: string) => branchNameById.get(branchId) ?? UNKNOWN_BRANCH,
    [branchNameById]
  );

  const chips = useMemo(() => {
    const result: { key: LocationFilterKey; label: string; value: string }[] = [];
    if (appliedFilters.branchId && appliedFilters.branchId !== defaultFilters.branchId) {
      result.push({ key: "branchId", label: "Sucursal", value: describeBranch(appliedFilters.branchId) });
    }
    if (appliedFilters.type) {
      result.push({ key: "type", label: "Tipo", value: typeLabels[appliedFilters.type] });
    }
    if (appliedFilters.isActive !== defaultFilters.isActive) {
      result.push({ key: "isActive", label: "Estado", value: activeLabels[appliedFilters.isActive] });
    }
    return result;
  }, [appliedFilters, defaultFilters, describeBranch]);

  const paginatedLocations = useMemo(() => {
    const start = page * pageSize;
    return locations.slice(start, start + pageSize);
  }, [locations, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(locations.length / pageSize));

  const applyFilters = (filters: LocationFilters = draftFilters) => {
    setAppliedFilters(filters);
    setPreloadedFromUrl(false);
    setPage(0);
    void loadLocations(filters);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFilters();
    }
  };

  const removeChip = (key: LocationFilterKey) => {
    const next = { ...appliedFilters, [key]: defaultFilters[key] } as LocationFilters;
    setDraftFilters((previous) => ({ ...previous, [key]: defaultFilters[key] }) as LocationFilters);
    setAppliedFilters(next);
    setPage(0);
    if (hasSearched) {
      void loadLocations(next);
    }
  };

  const resetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPreloadedFromUrl(false);
    setPage(0);
    if (hasSearched) {
      void loadLocations(defaultFilters);
    }
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedLocation(null);
    setPendingFormCancel(false);
  };

  const requestCloseForm = () => {
    setPendingFormCancel(true);
  };

  const handleFormSuccess = (mode: "create" | "edit") => {
    closeForm();
    showToast(
      mode === "create"
        ? "Ubicacion creada correctamente."
        : "Ubicacion actualizada correctamente.",
      "success"
    );
    if (hasSearched) {
      void loadLocations(appliedFilters);
    }
  };

  const requestDeactivate = async (location: InventoryLocationResponse) => {
    setPendingDeactivateLocation(location);
    setDeactivationCheck({ state: "loading" });
    try {
      const balances = await listInventoryLotBalances({
        branchId: location.branchId,
        locationId: location.id,
        onlyAvailable: true,
      });
      setDeactivationCheck({
        state: "ready",
        balances: balances.length,
        units: balances.reduce((sum, balance) => sum + Number(balance.quantityAvailable ?? 0), 0),
      });
    } catch {
      setDeactivationCheck({ state: "error" });
    }
  };

  const cancelDeactivate = () => {
    setPendingDeactivateLocation(null);
    setDeactivationCheck(null);
  };

  const handleDeactivate = async () => {
    if (!pendingDeactivateLocation) {
      return;
    }

    setIsDeactivating(true);
    try {
      await deactivateInventoryLocation(pendingDeactivateLocation.id);
      cancelDeactivate();
      showToast("Ubicacion inactivada correctamente.", "success");
      if (hasSearched) {
        await loadLocations(appliedFilters);
      }
    } catch (error) {
      showToast(
        getErrorMessage(error, "No se pudo inactivar la ubicacion."),
        "error"
      );
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async (location: InventoryLocationResponse) => {
    setReactivatingId(location.id);
    try {
      await updateInventoryLocation(location.id, { isActive: true });
      showToast("Ubicación reactivada correctamente.", "success");
      if (hasSearched) {
        await loadLocations(appliedFilters);
      }
    } catch (error) {
      showToast(getErrorMessage(error, "No se pudo reactivar la ubicación."), "error");
    } finally {
      setReactivatingId(null);
    }
  };

  const openCreateForm = () => {
    setSelectedLocation(null);
    setPendingFormCancel(false);
    setFormMode("create");
  };

  const openEditForm = (location: InventoryLocationResponse) => {
    setSelectedLocation(location);
    setPendingFormCancel(false);
    setFormMode("edit");
  };

  const lotsHref = (location: InventoryLocationResponse) =>
    `/${tenantSlug}/inventory/lots?branchId=${encodeURIComponent(location.branchId)}&locationId=${encodeURIComponent(location.id)}`;

  const buildRowActions = (location: InventoryLocationResponse): RowActionItem[] => {
    const items: RowActionItem[] = [
      {
        label: "Ver lotes",
        icon: <Layers className="h-4 w-4 text-slate-500" />,
        onSelect: () => router.push(lotsHref(location)),
        disabled: !tenantSlug,
      },
    ];
    if (canEdit) {
      items.push({
        label: "Editar",
        icon: <Pencil className="h-4 w-4 text-slate-500" />,
        onSelect: () => openEditForm(location),
      });
      if (location.isActive) {
        items.push({
          label: "Inactivar",
          icon: <XCircle className="h-4 w-4 text-amber-500" />,
          destructive: true,
          onSelect: () => void requestDeactivate(location),
        });
      } else {
        items.push({
          label: "Reactivar",
          icon: <RotateCcw className="h-4 w-4 text-emerald-600" />,
          onSelect: () => void handleReactivate(location),
          disabled: reactivatingId === location.id,
        });
      }
    }
    return items;
  };

  const deactivationDescription = (() => {
    if (!deactivationCheck || deactivationCheck.state === "loading") {
      return "Verificando saldos disponibles en esta ubicación...";
    }
    if (deactivationCheck.state === "error") {
      return "No se pudo verificar el saldo de esta ubicación. Puedes continuar o cancelar. La ubicación no se borra y seguirá apareciendo como histórica.";
    }
    if (deactivationCheck.balances > 0) {
      return `${formatNumber(deactivationCheck.balances)} saldo${deactivationCheck.balances === 1 ? "" : "s"} con ${formatNumber(
        deactivationCheck.units
      )} unidades disponibles seguirán asociados a esta ubicación. La ubicación no se borra y seguirá apareciendo como histórica.`;
    }
    return "La ubicación no tiene saldo disponible. Quedará inactiva, no se borrará y podrá seguir apareciendo como histórica.";
  })();

  const isFocusMode = Boolean(formMode);
  const thClass = "whitespace-nowrap px-4 py-3 font-medium";

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventario</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Ubicaciones fisicas
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Administra codigos fisicos por sucursal para bodega, vitrina,
              estantes y mostradores.
            </p>
          </div>
          {!isFocusMode ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                onClick={() => void loadLocations(appliedFilters)}
                isLoading={loading}
                disabled={!hasSearched}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Actualizar
              </Button>
              {canCreate ? (
                <Button onClick={openCreateForm}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nueva ubicacion
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {!isFocusMode ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input
                label="Buscar"
                type="search"
                placeholder="Codigo o nombre"
                value={draftFilters.search}
                onKeyDown={handleSearchKeyDown}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
                }
              />
            </div>
            <Button onClick={() => applyFilters()} isLoading={loading} className="w-full sm:w-auto">
              <Search className="h-4 w-4" aria-hidden="true" />
              Buscar
            </Button>
          </div>
        ) : null}
      </section>

      {formMode ? (
        <FocusActionLayout
          title={formMode === "create" ? "Nueva ubicacion" : "Editar ubicacion"}
          description="La ubicacion queda disponible para futuras operaciones loteadas, sin cambiar ventas ni compras."
          contextLabel={
            selectedLocation
              ? `${selectedLocation.code} - ${selectedLocation.name}`
              : "Nueva ubicacion"
          }
          onBack={requestCloseForm}
          onCancel={requestCloseForm}
        >
          <div className="space-y-5">
            {pendingFormCancel ? (
              <ConfirmationMessage
                title="Cancelar ubicacion activa"
                description="Volveras al listado de ubicaciones. Si habia datos sin guardar, se descartaran."
                variant="warning"
                actions={
                  <>
                    <Button variant="ghost" onClick={() => setPendingFormCancel(false)}>
                      Seguir editando
                    </Button>
                    <Button variant="warning" onClick={closeForm}>
                      Descartar y volver
                    </Button>
                  </>
                }
              />
            ) : null}

            <InventoryLocationForm
              mode={formMode}
              location={selectedLocation}
              branchOptions={branchOptions}
              onCancel={requestCloseForm}
              onSuccess={handleFormSuccess}
            />
          </div>
        </FocusActionLayout>
      ) : null}

      {pendingDeactivateLocation ? (
        <ConfirmationMessage
          title={`Inactivar ubicacion: ${pendingDeactivateLocation.code}`}
          description={deactivationDescription}
          variant="warning"
          actions={
            <>
              <Button variant="ghost" onClick={cancelDeactivate} disabled={isDeactivating}>
                Cancelar
              </Button>
              <Button
                variant="warning"
                onClick={() => void handleDeactivate()}
                isLoading={isDeactivating}
                disabled={deactivationCheck?.state === "loading"}
              >
                Inactivar
              </Button>
            </>
          }
        />
      ) : null}

      {!isFocusMode ? (
        <>
          <CollapsibleFilterPanel
            id="inventory-locations-filters"
            storageKey="inventory-locations"
            activeCount={chips.length}
          >
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <Select
                  label="Sucursal"
                  value={draftFilters.branchId}
                  disabled={!isSuperRole || loadingBranches}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({ ...prev, branchId: event.target.value }))
                  }
                >
                  <option value="">{isSuperRole ? "Todas" : "Sucursal actual"}</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-0">
                <Select
                  label="Tipo"
                  value={draftFilters.type}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      type: event.target.value as InventoryLocationType | "",
                    }))
                  }
                >
                  <option value="">Todos</option>
                  {INVENTORY_LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-0">
                <Select
                  label="Estado"
                  value={draftFilters.isActive}
                  onChange={(event) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      isActive: event.target.value as LocationFilters["isActive"],
                    }))
                  }
                >
                  <option value="all">Todos</option>
                  <option value="true">Activas</option>
                  <option value="false">Inactivas</option>
                </Select>
              </div>
              <div className="min-w-0">
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
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => applyFilters()} className="w-full sm:w-auto">
                <Search className="h-4 w-4" aria-hidden="true" />
                Aplicar filtros
              </Button>
              <Button variant="ghost" onClick={resetFilters} className="w-full sm:w-auto">
                Limpiar
              </Button>
            </div>
          </CollapsibleFilterPanel>

          {chips.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Filtros aplicados">
              {chips.map((chip) => (
                <li
                  key={chip.key}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1 text-xs font-medium text-blue-800"
                >
                  <span className="truncate">
                    {chip.label}: {chip.value}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChip(chip.key)}
                    aria-label={`Quitar filtro ${chip.label}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {branchErrorMessage ? (
            <section
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm"
            >
              <span>{branchErrorMessage}</span>
              <Button variant="ghost" size="sm" onClick={() => void loadBranches()} isLoading={loadingBranches}>
                Reintentar
              </Button>
            </section>
          ) : null}

          {errorMessage ? (
            <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
              {errorMessage}
            </section>
          ) : null}

          {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

          <section className="min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:bg-slate-800 dark:border-slate-700">
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">Ubicaciones físicas del resultado aplicado</caption>
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <tr>
                    <th scope="col" className={thClass}>Codigo</th>
                    <th scope="col" className={thClass}>Nombre</th>
                    <th scope="col" className={thClass}>Sucursal</th>
                    <th scope="col" className={thClass}>Tipo</th>
                    <th scope="col" className={thClass}>Estado</th>
                    <th scope="col" className={thClass}>Descripcion</th>
                    <th scope="col" className={`${thClass} text-right`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        Cargando ubicaciones...
                      </td>
                    </tr>
                  ) : !hasSearched ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        {preloadedFromUrl
                          ? "Filtros precargados. Presiona Buscar."
                          : "Presiona Buscar para consultar ubicaciones."}
                      </td>
                    </tr>
                  ) : paginatedLocations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                        No hay ubicaciones para mostrar.
                      </td>
                    </tr>
                  ) : (
                    paginatedLocations.map((location) => (
                      <tr key={location.id}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                            {location.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white">{location.name}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          {describeBranch(location.branchId)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${typeBadgeStyles[location.type]}`}
                          >
                            {typeLabels[location.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              location.isActive
                                ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                                : "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                            }
                          >
                            {location.isActive ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-slate-700 dark:text-slate-200">
                          <span className="line-clamp-2">
                            {location.description ?? "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end">
                            <RowActionsMenu
                              label={`Acciones de la ubicación ${location.code}`}
                              items={buildRowActions(location)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span>
                {hasSearched ? `${formatNumber(locations.length)} ubicaciones · ` : ""}
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
      ) : null}
    </div>
  );
};

export default InventoryLocationsPage;
