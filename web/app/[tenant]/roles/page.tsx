"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { RowActionsMenu } from "../../../components/design-system/RowActionsMenu";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { hasMenuAccess } from "../../../lib/permissions";
import { MENU_KEYS } from "../../../domains/menu/constants";
import { listTenants } from "../../../domains/tenants/api";
import type { TenantSummaryResponse } from "../../../domains/tenants/dtos";
import { createRole, listRoles, updateRole } from "../../../domains/roles/api";
import type { RoleResponse } from "../../../domains/roles/dtos";
import { useAppSelector } from "../../../store/hooks";

type RoleFormState = {
  nombre: string;
  descripcion: string;
  tenantIds: string[];
};

const emptyRoleForm: RoleFormState = {
  nombre: "",
  descripcion: "",
  tenantIds: [],
};

const pageSizeOptions = [10, 25, 50];

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const RolesPage = () => {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantSummaryResponse[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [roleEditingId, setRoleEditingId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>({
    ...emptyRoleForm,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [hasAccess, setHasAccess] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const confirm = useConfirm();
  const authUser = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.menu.permissions);

  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";
  const canManageRoles = canWrite && isSuperAdmin;
  useAutoClearState(toastMessage, setToastMessage);

  const tenantOptions = useMemo(
    () => tenants.filter((tenant) => tenant.activo),
    [tenants]
  );

  const tenantLookup = useMemo(() => {
    const map = new Map<string, TenantSummaryResponse>();
    tenants.forEach((tenant) => map.set(tenant.id, tenant));
    return map;
  }, [tenants]);

  const filteredRoles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return roles.filter((role) => {
      const name = role.nombre.toLowerCase();
      const description = role.descripcion?.toLowerCase() ?? "";
      const matchesQuery = !query || name.includes(query) || description.includes(query);

      if (!matchesQuery) return false;

      if (tenantFilter) {
        if (!role.tenant_ids || role.tenant_ids.length === 0) {
          return false;
        }
        return role.tenant_ids.includes(tenantFilter);
      }

      return true;
    });
  }, [roles, searchQuery, tenantFilter]);

  const paginatedRoles = useMemo(() => {
    const start = page * pageSize;
    return filteredRoles.slice(start, start + pageSize);
  }, [filteredRoles, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));

  const buildAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (authUser?.role) {
      headers["x-user-role"] = authUser.role;
    }
    if (authUser?.tenantId) {
      headers["x-tenant-id"] = authUser.tenantId;
    }
    if (authUser?.id) {
      headers["x-user-id"] = authUser.id;
    }
    return headers;
  }, [authUser]);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const result = await listRoles(buildAuthHeaders());
      setRoles(result);
    } catch {
      showToast("No se pudieron cargar los roles.", "error");
    } finally {
      setRolesLoading(false);
    }
  }, [buildAuthHeaders, showToast]);

  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) {
      setTenants([]);
      return;
    }
    setTenantsLoading(true);
    try {
      const result = await listTenants();
      setTenants(result);
    } catch {
      showToast("No se pudieron cargar los tenants.", "error");
    } finally {
      setTenantsLoading(false);
    }
  }, [isSuperAdmin, showToast]);

  useEffect(() => {
    let timeoutId: number | undefined;
    const syncAccess = () => {
      const allowed = hasMenuAccess(MENU_KEYS.CONFIG_ROLES, "READ");
      const writable = hasMenuAccess(MENU_KEYS.CONFIG_ROLES, "WRITE");
      setHasAccess(allowed);
      setCanWrite(writable);
      if (!allowed && permissions.length === 0) {
        timeoutId = window.setTimeout(syncAccess, 300);
      }
    };
    syncAccess();
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [permissions.length]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    void loadRoles();
    void loadTenants();
  }, [hasAccess, loadRoles, loadTenants]);

  const openCreateModal = () => {
    if (!canManageRoles) {
      showToast("No tienes permisos para crear roles.", "warning");
      return;
    }
    setRoleModalMode("create");
    setRoleEditingId(null);
    setRoleForm({ ...emptyRoleForm });
    setRoleModalOpen(true);
  };

  const openEditModal = (role: RoleResponse) => {
    if (!canManageRoles) {
      showToast("No tienes permisos para editar roles.", "warning");
      return;
    }
    setRoleModalMode("edit");
    setRoleEditingId(role.id);
    setRoleForm({
      nombre: role.nombre,
      descripcion: role.descripcion ?? "",
      tenantIds: role.tenant_ids ?? [],
    });
    setRoleModalOpen(true);
  };

  const closeModal = () => {
    setRoleModalOpen(false);
  };

  const handleTenantSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(event.target.selectedOptions).map(
      (option) => option.value
    );
    setRoleForm((prev) => ({ ...prev, tenantIds: selected }));
  };

  const handleSubmitRole = async () => {
    if (!roleForm.nombre.trim()) {
      showToast("El nombre del rol es obligatorio.", "warning");
      return;
    }

    try {
      if (roleModalMode === "create") {
        await createRole(
          {
            nombre: roleForm.nombre.trim(),
            descripcion: roleForm.descripcion.trim() || undefined,
            tenantIds: roleForm.tenantIds,
          },
          buildAuthHeaders()
        );
        showToast("Rol creado correctamente.", "success");
      } else if (roleEditingId) {
        await updateRole(
          roleEditingId,
          {
            nombre: roleForm.nombre.trim(),
            descripcion: roleForm.descripcion.trim() || undefined,
            tenantIds: roleForm.tenantIds,
          },
          buildAuthHeaders()
        );
        showToast("Rol actualizado correctamente.", "success");
      }
      setRoleModalOpen(false);
      await loadRoles();
    } catch {
      showToast("No se pudo guardar el rol.", "error");
    }
  };

  const handleConfirmSubmitRole = async () => {
    if (!roleForm.nombre.trim()) {
      await handleSubmitRole();
      return;
    }

    try {
      await confirm({
        title:
          roleModalMode === "create"
            ? "¿Deseas crear este rol?"
            : "¿Confirmas actualizar la información?",
        description:
          roleModalMode === "create"
            ? `Se creará el rol "${roleForm.nombre.trim()}" con la configuración asignada.`
            : `Se actualizará la configuración del rol "${roleForm.nombre.trim()}".`,
        confirmText: roleModalMode === "create" ? "Crear rol" : "Actualizar rol",
        variant: "default",
      });
      await handleSubmitRole();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setTenantFilter("");
    setPage(0);
  };

  if (!hasAccess) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Acceso restringido
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          No cuentas con permisos para gestionar roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Configuración
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Roles
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Administra los roles disponibles y sus tenants asignados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => void loadRoles()}
              isLoading={rolesLoading}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button
              variant={canManageRoles ? "primary" : "disabled"}
              onClick={openCreateModal}
              disabled={!canManageRoles}
            >
              <Plus className="h-4 w-4" />
              Nuevo rol
            </Button>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] lg:grid-cols-[1fr_240px_auto_auto]">
          <Input
            label="Buscar"
            placeholder="Nombre o descripción..."
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(0);
            }}
          />

          {isSuperAdmin ? (
            <Select
              label="Tenant"
              value={tenantFilter}
              onChange={(event) => {
                setTenantFilter(event.target.value);
                setPage(0);
              }}
              disabled={tenantsLoading}
            >
              <option value="">Todos los tenants</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.nombre ?? tenant.slug}
                </option>
              ))}
            </Select>
          ) : null}

          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              onClick={handleResetFilters}
              disabled={!searchQuery && !tenantFilter}
            >
              Limpiar
            </Button>
          </div>

          <Select
            label="Filas por página"
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      {/* Roles Table */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold">Tenants asignados</th>
                <th className="px-4 py-3 font-semibold">Fecha de creación</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rolesLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Cargando roles...
                  </td>
                </tr>
              ) : paginatedRoles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No se encontraron roles.
                  </td>
                </tr>
              ) : (
                paginatedRoles.map((role) => (
                  <tr
                    key={role.id}
                    className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {role.nombre}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {role.descripcion || (
                        <span className="italic text-slate-400 dark:text-slate-500">
                          Sin descripción
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {(role.tenant_ids?.length ?? 0) > 0 ? (
                          role.tenant_ids.map((tenantId) => {
                            const tenant = tenantLookup.get(tenantId);
                            return (
                              <span
                                key={tenantId}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {tenant?.nombre ?? tenant?.slug ?? tenantId}
                              </span>
                            );
                          })
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
                            Sin tenants asociados
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(role.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end">
                        <RowActionsMenu
                          items={[
                            {
                              label: "Editar",
                              icon: <Pencil className="h-4 w-4 text-slate-500" />,
                              disabled: !canManageRoles,
                              onSelect: () => openEditModal(role),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredRoles.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <span>
              Página {Math.min(page + 1, totalPages)} de {totalPages} ({filteredRoles.length} {filteredRoles.length === 1 ? "rol" : "roles"})
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0 || rolesLoading}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, totalPages - 1))
                }
                disabled={page >= totalPages - 1 || rolesLoading}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Create / Edit Modal */}
      {roleModalOpen ? (
        <Modal
          title={roleModalMode === "create" ? "Nuevo rol" : "Editar rol"}
          onClose={closeModal}
        >
          <div className="space-y-4">
            <Input
              label="Nombre del rol"
              required
              placeholder="Ej: CAJERO, SUPERVISOR..."
              value={roleForm.nombre}
              onChange={(event) =>
                setRoleForm((prev) => ({ ...prev, nombre: event.target.value }))
              }
            />
            <Textarea
              label="Descripción"
              placeholder="Describe las responsabilidades o alcance de este rol..."
              value={roleForm.descripcion}
              onChange={(event) =>
                setRoleForm((prev) => ({
                  ...prev,
                  descripcion: event.target.value,
                }))
              }
            />
            <Select
              label="Tenants asociados"
              multiple
              value={roleForm.tenantIds}
              onChange={handleTenantSelect}
              className="min-h-[140px]"
              disabled={tenantsLoading}
            >
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.nombre ?? tenant.slug}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleConfirmSubmitRole()}
              >
                {roleModalMode === "create" ? "Crear rol" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

export default RolesPage;
