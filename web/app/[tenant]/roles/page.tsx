"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
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
    if (!query) {
      return roles;
    }
    return roles.filter((role) => {
      const name = role.nombre.toLowerCase();
      const description = role.descripcion?.toLowerCase() ?? "";
      return name.includes(query) || description.includes(query);
    });
  }, [roles, searchQuery]);

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
            ? "¿Deseas guardar los cambios?"
            : "¿Confirmas actualizar la información?",
        description:
          roleModalMode === "create"
            ? "Se creará un nuevo rol con la configuración actual."
            : "Se actualizará la configuración del rol seleccionado.",
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Roles</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Administra los roles disponibles y sus tenants asignados.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={loadRoles} disabled={rolesLoading}>
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
        <div className="mt-6">
          <Input
            label="Buscar"
            placeholder="Nombre o descripción"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </div>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      <div className="space-y-4">
        {rolesLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
            Cargando roles...
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
            No hay roles para mostrar.
          </div>
        ) : (
          filteredRoles.map((role) => (
            <div
              key={role.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {role.nombre}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {role.descripcion || "Sin descripción"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Creado el {new Date(role.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant={canManageRoles ? "ghost" : "disabled"}
                  onClick={() => openEditModal(role)}
                  disabled={!canManageRoles}
                >
                  Editar
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                {(role.tenant_ids?.length ?? 0) > 0 ? (
                  role.tenant_ids.map((tenantId) => {
                    const tenant = tenantLookup.get(tenantId);
                    return (
                      <span
                        key={tenantId}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1"
                      >
                        {tenant?.nombre ?? tenant?.slug ?? tenantId}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-400">
                    Sin tenants asociados
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {roleModalOpen ? (
        <Modal
          title={roleModalMode === "create" ? "Crear rol" : "Editar rol"}
        >
          <div className="space-y-4">
            <Input
              label="Nombre"
              required
              value={roleForm.nombre}
              onChange={(event) =>
                setRoleForm((prev) => ({ ...prev, nombre: event.target.value }))
              }
            />
            <Textarea
              label="Descripción"
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
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="ghost" onClick={closeModal}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleConfirmSubmitRole()}
              >
                {roleModalMode === "create" ? "Crear rol" : "Actualizar rol"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

export default RolesPage;

