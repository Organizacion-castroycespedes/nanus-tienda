"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { isConfirmCancelledError, useConfirm } from "../../../hooks/use-confirm";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { useAppSelector } from "../../../store/hooks";
import { hasMenuAccess } from "../../../lib/permissions";
import { MENU_KEYS } from "../../../domains/menu/constants";
import { listTenants } from "../../../domains/tenants/api";
import type { TenantSummaryResponse } from "../../../domains/tenants/dtos";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { listRoles } from "../../../domains/roles/api";
import type { RoleResponse } from "../../../domains/roles/dtos";
import {
  createUser,
  listUsers,
  updateUser,
  type ListUsersParams,
} from "../../../domains/users/api";
import type {
  CreateUserDto,
  UpdateUserDto,
  UserResponse,
} from "../../../domains/users/dtos";

type WizardMode = "create" | "edit";

type UserFormState = {
  email: string;
  password: string;
  estado: string;
  nombres: string;
  apellidos: string;
  documentoTipo: string;
  documentoNumero: string;
  telefono: string;
  direccion: string;
  emailPersonal: string;
  cargoNombre: string;
  cargoDescripcion: string;
  funcionesDescripcion: string;
  tenantId: string;
  tenantBranchId: string;
  roleId: string;
};

const emptyForm: UserFormState = {
  email: "",
  password: "",
  estado: "ACTIVE",
  nombres: "",
  apellidos: "",
  documentoTipo: "",
  documentoNumero: "",
  telefono: "",
  direccion: "",
  emailPersonal: "",
  cargoNombre: "",
  cargoDescripcion: "",
  funcionesDescripcion: "",
  tenantId: "",
  tenantBranchId: "",
  roleId: "",
};

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "INACTIVE", label: "Inactivos" },
];

const wizardSteps = [
  "Credenciales",
  "Persona",
  "Cargo y funciones",
  "Organización",
  "Rol",
  "Resumen",
];

const UsuariosPage = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [filters, setFilters] = useState({ query: "", status: "all" });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [tenants, setTenants] = useState<TenantSummaryResponse[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [branches, setBranches] = useState<BranchResponse[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<WizardMode>("create");
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm] = useState<UserFormState>({ ...emptyForm });
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [hasAccess, setHasAccess] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const confirm = useConfirm();

  const authUser = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.menu.permissions);
  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";

  useAutoClearState(toastMessage, setToastMessage);

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
  }, [authUser?.id, authUser?.role, authUser?.tenantId]);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const requestedLimit = pageSize + 1;
      const params: ListUsersParams = {
        query: filters.query.trim() || undefined,
        estado: filters.status !== "all" ? filters.status : undefined,
        limit: requestedLimit,
        offset: page * pageSize,
      };
      if (isSuperAdmin && selectedTenantId) {
        params.tenantId = selectedTenantId;
      }
      const result = await listUsers(params, buildAuthHeaders());
      const visibleUsers = isSuperAdmin
        ? result
        : result.filter((user) => user.role?.nombre !== "SUPER_ADMIN");
      setUsers(visibleUsers.slice(0, pageSize));
      setHasNextPage(visibleUsers.length > pageSize);
    } catch {
      showToast("No se pudieron cargar los usuarios.", "error");
    } finally {
      setUsersLoading(false);
    }
  }, [
    buildAuthHeaders,
    filters,
    isSuperAdmin,
    page,
    pageSize,
    selectedTenantId,
    showToast,
  ]);

  const loadTenants = useCallback(async () => {
    if (!isSuperAdmin) {
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

  const loadBranches = useCallback(
    async (tenantId?: string) => {
      if (!tenantId) {
        setBranches([]);
        return;
      }
      setBranchesLoading(true);
      try {
        const result = await listBranches({ tenantId }, buildAuthHeaders());
        setBranches(result);
      } catch {
        showToast("No se pudieron cargar las sucursales.", "error");
      } finally {
        setBranchesLoading(false);
      }
    },
    [buildAuthHeaders, showToast]
  );

  useEffect(() => {
    let timeoutId: number | undefined;
    const syncAccess = () => {
      const allowed = hasMenuAccess(MENU_KEYS.CONFIG_USUARIOS, "READ");
      const writable = hasMenuAccess(MENU_KEYS.CONFIG_USUARIOS, "WRITE");
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
    void loadUsers();
    void loadTenants();
    void loadRoles();
  }, [hasAccess, loadRoles, loadTenants, loadUsers]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    void loadUsers();
  }, [filters, hasAccess, loadUsers, selectedTenantId]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    if (isSuperAdmin) {
      void loadBranches(selectedTenantId);
    } else {
      void loadBranches(authUser?.tenantId);
    }
  }, [authUser?.tenantId, hasAccess, isSuperAdmin, loadBranches, selectedTenantId]);

  const tenantOptions = useMemo(
    () => tenants.filter((tenant) => tenant.activo),
    [tenants]
  );

  const openCreateWizard = () => {
    if (!canWrite) {
      showToast("No tienes permisos para crear usuarios.", "warning");
      return;
    }
    setWizardMode("create");
    setWizardStep(0);
    setEditingUser(null);
    setForm({
      ...emptyForm,
      tenantId: isSuperAdmin ? selectedTenantId : authUser?.tenantId ?? "",
    });
    setWizardOpen(true);
  };

  const openEditWizard = (user: UserResponse) => {
    if (!canWrite) {
      showToast("No tienes permisos para editar usuarios.", "warning");
      return;
    }
    setWizardMode("edit");
    setWizardStep(0);
    setEditingUser(user);
    if (isSuperAdmin) {
      void loadBranches(user.tenantId);
    }
    setForm({
      email: user.email,
      password: "",
      estado: user.estado,
      nombres: user.persona?.nombres ?? "",
      apellidos: user.persona?.apellidos ?? "",
      documentoTipo: user.persona?.documentoTipo ?? "",
      documentoNumero: user.persona?.documentoNumero ?? "",
      telefono: user.persona?.telefono ?? "",
      direccion: user.persona?.direccion ?? "",
      emailPersonal: user.persona?.emailPersonal ?? "",
      cargoNombre: user.persona?.cargoNombre ?? "",
      cargoDescripcion: user.persona?.cargoDescripcion ?? "",
      funcionesDescripcion: user.persona?.funcionesDescripcion ?? "",
      tenantId: user.tenantId,
      tenantBranchId: user.branch?.id ?? "",
      roleId: user.role?.id ?? "",
    });
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
  };

  const updateForm = (field: keyof UserFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = useMemo(() => {
    const emailOk = form.email.trim().length > 0;
    const passwordOk = wizardMode === "edit" || form.password.length >= 8;
    const personaOk =
      form.nombres.trim() &&
      form.apellidos.trim() &&
      form.documentoTipo.trim() &&
      form.documentoNumero.trim();
    const cargoOk = form.cargoNombre.trim();
    const tenantOk = isSuperAdmin ? form.tenantId.trim() : true;
    const branchOk = form.tenantBranchId.trim();
    const roleOk = form.roleId.trim();

    const checks = [
      emailOk && passwordOk,
      personaOk,
      cargoOk,
      tenantOk && branchOk,
      roleOk,
    ];

    return checks[wizardStep] ?? true;
  }, [form, isSuperAdmin, wizardMode, wizardStep]);

  const handleNext = () => {
    if (!canProceed) {
      showToast("Completa los campos requeridos para continuar.", "warning");
      return;
    }
    setWizardStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
  };

  const handleBack = () => {
    setWizardStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!canProceed) {
      showToast("Completa los campos requeridos.", "warning");
      return;
    }

    try {
      if (wizardMode === "create") {
        const payload: CreateUserDto = {
          email: form.email.trim(),
          password: form.password,
          estado: form.estado,
          tenantId: isSuperAdmin ? form.tenantId : undefined,
          tenantBranchId: form.tenantBranchId,
          roleId: form.roleId,
          persona: {
            nombres: form.nombres.trim(),
            apellidos: form.apellidos.trim(),
            documentoTipo: form.documentoTipo.trim(),
            documentoNumero: form.documentoNumero.trim(),
            telefono: form.telefono.trim() || undefined,
            direccion: form.direccion.trim() || undefined,
            emailPersonal: form.emailPersonal.trim() || undefined,
            cargoNombre: form.cargoNombre.trim(),
            cargoDescripcion: form.cargoDescripcion.trim() || undefined,
            funcionesDescripcion: form.funcionesDescripcion.trim() || undefined,
          },
        };
        await createUser(payload, buildAuthHeaders());
        showToast("Usuario creado correctamente.", "success");
      } else if (editingUser) {
        const payload: UpdateUserDto = {
          email: form.email.trim(),
          estado: form.estado,
          tenantBranchId: form.tenantBranchId,
          roleId: form.roleId,
          persona: {
            nombres: form.nombres.trim(),
            apellidos: form.apellidos.trim(),
            documentoTipo: form.documentoTipo.trim(),
            documentoNumero: form.documentoNumero.trim(),
            telefono: form.telefono.trim() || undefined,
            direccion: form.direccion.trim() || undefined,
            emailPersonal: form.emailPersonal.trim() || undefined,
            cargoNombre: form.cargoNombre.trim(),
            cargoDescripcion: form.cargoDescripcion.trim() || undefined,
            funcionesDescripcion: form.funcionesDescripcion.trim() || undefined,
          },
        };
        await updateUser(editingUser.id, payload, buildAuthHeaders());
        showToast("Usuario actualizado correctamente.", "success");
      }
      setWizardOpen(false);
      await loadUsers();
    } catch {
      showToast("No se pudo guardar el usuario.", "error");
    }
  };

  const handleConfirmSubmit = async () => {
    if (!canProceed) {
      await handleSubmit();
      return;
    }

    try {
      await confirm({
        title:
          wizardMode === "create"
            ? "¿Deseas guardar los cambios?"
            : "¿Confirmas actualizar la información?",
        description:
          wizardMode === "create"
            ? "Se creará un nuevo usuario con la información consolidada en el asistente."
            : "Se actualizará la información del usuario seleccionado.",
        confirmText: wizardMode === "create" ? "Crear usuario" : "Guardar usuario",
        variant: "default",
      });
      await handleSubmit();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const selectedBranchOptions = useMemo(() => {
    if (!branches.length) {
      return [];
    }
    return branches.filter((branch) => branch.estado === "ACTIVE");
  }, [branches]);

  const handleTenantChange = (tenantId: string) => {
    updateForm("tenantId", tenantId);
    updateForm("tenantBranchId", "");
    if (tenantId) {
      void loadBranches(tenantId);
    }
  };
  const canSubmit = wizardStep === wizardSteps.length - 1 && canProceed;

  if (!hasAccess) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        No tienes permisos para ver esta sección.
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configuración</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Gestión de usuarios
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={loadUsers}
            disabled={usersLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </Button>
          <Button onClick={openCreateWizard} disabled={!canWrite}>
            <Plus className="h-4 w-4" />
            Crear usuario
          </Button>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <div className="space-y-4">
          <SearchFilters
            query={filters.query}
            status={filters.status}
            onQueryChange={(value) =>
              setFilters((prev) => {
                setPage(0);
                return { ...prev, query: value };
              })
            }
            onStatusChange={(value) =>
              setFilters((prev) => {
                setPage(0);
                return { ...prev, status: value };
              })
            }
            queryLabel="Buscar usuario"
            queryPlaceholder="Email, documento o nombre"
            statusLabel="Estado"
            statusOptions={statusOptions}
          />

          {isSuperAdmin ? (
            <Select
              label="Tenant"
              value={selectedTenantId}
              onChange={(event) => {
                setSelectedTenantId(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.nombre ?? tenant.slug}
                </option>
              ))}
            </Select>
          ) : null}
          {tenantsLoading ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Cargando tenants...
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                {isSuperAdmin ? (
                  <th className="px-4 py-3 font-medium">Tenant</th>
                ) : null}
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersLoading ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 7 : 6}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 7 : 6}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    No hay usuarios registrados.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">
                      {`${user.persona?.nombres ?? ""} ${
                        user.persona?.apellidos ?? ""
                      }`.trim() || "Sin nombre"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{user.email}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {user.estado}
                    </td>
                    {isSuperAdmin ? (
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {user.tenantNombre ?? user.tenantId}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {user.role?.nombre ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {user.branch?.nombre ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        onClick={() => openEditWizard(user)}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {users.length > 0 || hasNextPage || page > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-3">
              <span>
                Página {page + 1}
              </span>
              <Select
                label="Filas por página"
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0 || usersLoading}
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!hasNextPage || usersLoading}
              >
                Siguiente
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {wizardOpen ? (
        <Modal
          title={
            wizardMode === "create"
              ? "Crear usuario"
              : "Editar usuario"
          }
        >
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
              {wizardSteps.map((step, index) => (
                <span
                  key={step}
                  className={`rounded-full px-3 py-1 ${
                    index === wizardStep
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100"
                  }`}
                >
                  {index + 1}. {step}
                </span>
              ))}
            </div>

            {wizardStep === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(event) =>
                    updateForm("email", event.target.value)
                  }
                />
                <Select
                  label="Estado"
                  value={form.estado}
                  onChange={(event) =>
                    updateForm("estado", event.target.value)
                  }
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </Select>
                {wizardMode === "create" ? (
                  <Input
                    label="Contraseña"
                    type="password"
                    required
                    hint="Mínimo 8 caracteres"
                    value={form.password}
                    onChange={(event) =>
                      updateForm("password", event.target.value)
                    }
                  />
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    La contraseña se gestiona por separado.
                  </div>
                )}
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nombres"
                  required
                  value={form.nombres}
                  onChange={(event) =>
                    updateForm("nombres", event.target.value)
                  }
                />
                <Input
                  label="Apellidos"
                  required
                  value={form.apellidos}
                  onChange={(event) =>
                    updateForm("apellidos", event.target.value)
                  }
                />
                <Select
                  label="Tipo de documento"
                  required
                  value={form.documentoTipo}
                  onChange={(event) =>
                    updateForm("documentoTipo", event.target.value)
                  }
                >
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="NIT">NIT</option>
                  <option value="Pasaporte">Pasaporte</option>
                </Select>
                <Input
                  label="Número de documento"
                  required
                  value={form.documentoNumero}
                  onChange={(event) =>
                    updateForm("documentoNumero", event.target.value)
                  }
                />
                <Input
                  label="Teléfono"
                  value={form.telefono}
                  onChange={(event) =>
                    updateForm("telefono", event.target.value)
                  }
                />
                <Input
                  label="Dirección"
                  value={form.direccion}
                  onChange={(event) =>
                    updateForm("direccion", event.target.value)
                  }
                />
                <Input
                  label="Email personal"
                  type="email"
                  value={form.emailPersonal}
                  onChange={(event) =>
                    updateForm("emailPersonal", event.target.value)
                  }
                />
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="grid gap-4">
                <Input
                  label="Nombre del cargo"
                  required
                  value={form.cargoNombre}
                  onChange={(event) =>
                    updateForm("cargoNombre", event.target.value)
                  }
                />
                <Textarea
                  label="Descripción del cargo"
                  value={form.cargoDescripcion}
                  onChange={(event) =>
                    updateForm("cargoDescripcion", event.target.value)
                  }
                />
                <Textarea
                  label="Funciones"
                  value={form.funcionesDescripcion}
                  onChange={(event) =>
                    updateForm("funcionesDescripcion", event.target.value)
                  }
                />
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {isSuperAdmin ? (
                  <Select
                    label="Tenant"
                    required
                    disabled={wizardMode === "edit"}
                    value={form.tenantId}
                    onChange={(event) =>
                      handleTenantChange(event.target.value)
                    }
                  >
                    <option value="">Selecciona un tenant</option>
                    {tenantOptions.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.nombre ?? tenant.slug}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    label="Tenant"
                    disabled
                    value={authUser?.tenantId ?? ""}
                  />
                )}
                <Select
                  label="Sucursal principal"
                  required
                  value={form.tenantBranchId}
                  onChange={(event) =>
                    updateForm("tenantBranchId", event.target.value)
                  }
                >
                  <option value="">Selecciona una sucursal</option>
                  {selectedBranchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.nombre}
                    </option>
                  ))}
                </Select>
                {branchesLoading ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Cargando sucursales...
                  </span>
                ) : null}
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <div className="grid gap-4">
                <Select
                  label="Rol"
                  required
                  value={form.roleId}
                  onChange={(event) =>
                    updateForm("roleId", event.target.value)
                  }
                >
                  <option value="">Selecciona un rol</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.nombre}
                    </option>
                  ))}
                </Select>
                {rolesLoading ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Cargando roles...
                  </span>
                ) : null}
              </div>
            ) : null}

            {wizardStep === 5 ? (
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  <strong>Email:</strong> {form.email}
                </p>
                <p>
                  <strong>Nombre:</strong> {form.nombres} {form.apellidos}
                </p>
                <p>
                  <strong>Documento:</strong> {form.documentoTipo} {form.documentoNumero}
                </p>
                <p>
                  <strong>Cargo:</strong> {form.cargoNombre}
                </p>
                <p>
                  <strong>Rol:</strong> {roles.find((role) => role.id === form.roleId)?.nombre ?? "-"}
                </p>
                <p>
                  <strong>Sucursal:</strong> {branches.find((branch) => branch.id === form.tenantBranchId)?.nombre ?? "-"}
                </p>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={closeWizard}>
                Cancelar
              </Button>
              <div className="flex items-center gap-2">
                {wizardStep > 0 ? (
                  <Button variant="ghost" onClick={handleBack}>
                    Atrás
                  </Button>
                ) : null}
                {wizardStep < wizardSteps.length - 1 ? (
                  <Button onClick={handleNext}>Siguiente</Button>
                ) : (
                  <Button
                    onClick={() => void handleConfirmSubmit()}
                    disabled={!canSubmit}
                  >
                    {wizardMode === "create" ? "Crear" : "Guardar"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
    </div>
  );
};

export default UsuariosPage;

