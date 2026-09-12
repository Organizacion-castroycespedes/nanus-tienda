"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Pencil, Plus, RefreshCw, Search, XCircle } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { ConfirmationMessage } from "../../../../components/design-system/confirmation-message";
import { Input } from "../../../../components/design-system/Input";
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
import {
  deactivateInventoryLocation,
  INVENTORY_LOCATION_TYPES,
  listInventoryLocations,
  type InventoryLocationResponse,
  type InventoryLocationType,
} from "../../../../modules/inventory/services/inventory-location.service";

type LocationFilters = {
  search: string;
  branchId: string;
  type: InventoryLocationType | "";
  isActive: "all" | "true" | "false";
};

const createDefaultFilters = (branchId?: string | null): LocationFilters => ({
  search: "",
  branchId: branchId ?? "",
  type: "",
  isActive: "true",
});

const pageSizeOptions = [10, 25, 50];

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
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [branchOptions, setBranchOptions] = useState<InventoryLocationBranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [draftFilters, setDraftFilters] = useState<LocationFilters>(
    createDefaultFilters(currentBranch)
  );
  const [appliedFilters, setAppliedFilters] = useState<LocationFilters>(
    createDefaultFilters(currentBranch)
  );
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
  const [pendingFormCancel, setPendingFormCancel] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const canCreate = hasPermission("inventory.create");
  const canEdit = hasPermission("inventory.update");

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  useEffect(() => {
    if (isSuperRole || !currentBranch) {
      return;
    }

    setDraftFilters((prev) => ({ ...prev, branchId: prev.branchId || currentBranch }));
    setAppliedFilters((prev) => ({ ...prev, branchId: prev.branchId || currentBranch }));
  }, [currentBranch, isSuperRole]);

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
    async (filters?: LocationFilters) => {
      const activeFilters = filters ?? appliedFilters;
      setLoading(true);
      setErrorMessage(null);
      try {
        const result = await listInventoryLocations(resolveLocationFilters(activeFilters));
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
    [appliedFilters, resolveLocationFilters]
  );

  const branchNameById = useMemo(() => {
    const branches = new Map<string, string>();
    branchOptions.forEach((branch) => {
      branches.set(branch.id, branch.name);
    });
    return branches;
  }, [branchOptions]);

  const filteredLocations = useMemo(() => {
    const query = appliedFilters.search.trim().toLowerCase();
    if (!query) {
      return locations;
    }

    return locations.filter((location) => {
      const branchName = (branchNameById.get(location.branchId) ?? "").toLowerCase();
      return (
        location.code.toLowerCase().includes(query) ||
        location.name.toLowerCase().includes(query) ||
        branchName.includes(query)
      );
    });
  }, [appliedFilters.search, branchNameById, locations]);

  const paginatedLocations = useMemo(() => {
    const start = page * pageSize;
    return filteredLocations.slice(start, start + pageSize);
  }, [filteredLocations, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLocations.length / pageSize));

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(0);
    void loadLocations(draftFilters);
  };

  const resetFilters = () => {
    const nextFilters = createDefaultFilters(isSuperRole ? "" : currentBranch);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(0);
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
      void loadLocations();
    }
  };

  const handleDeactivate = async () => {
    if (!pendingDeactivateLocation) {
      return;
    }

    setIsDeactivating(true);
    try {
      await deactivateInventoryLocation(pendingDeactivateLocation.id);
      setPendingDeactivateLocation(null);
      showToast("Ubicacion inactivada correctamente.", "success");
      if (hasSearched) {
        await loadLocations();
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

  const isFocusMode = Boolean(formMode);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Inventory</p>
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
                onClick={() => void loadLocations()}
                isLoading={loading}
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </Button>
              {canCreate ? (
                <Button onClick={openCreateForm}>
                  <Plus className="h-4 w-4" />
                  Nueva ubicacion
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
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
          description="La ubicacion quedara inactiva. No se borrara fisicamente y podra seguir apareciendo como historica."
          variant="warning"
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => setPendingDeactivateLocation(null)}
                disabled={isDeactivating}
              >
                Cancelar
              </Button>
              <Button
                variant="warning"
                onClick={() => void handleDeactivate()}
                isLoading={isDeactivating}
              >
                Inactivar
              </Button>
            </>
          }
        />
      ) : null}

      {!isFocusMode ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_180px_160px_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Codigo, nombre o sucursal"
            value={draftFilters.search}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, search: event.target.value }))
            }
          />
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

      {branchErrorMessage ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
          {branchErrorMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Codigo</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Descripcion</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Cargando ubicaciones...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    Usa el boton Buscar para consultar ubicaciones.
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
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        {location.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">{location.name}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {branchNameById.get(location.branchId) ?? location.branchId}
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
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(location)}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                        ) : null}
                        {canEdit && location.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingDeactivateLocation(location)}
                          >
                            <XCircle className="h-4 w-4" />
                            Inactivar
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
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
      ) : null}
    </div>
  );
};

export default InventoryLocationsPage;
