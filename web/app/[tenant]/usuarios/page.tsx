"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { RowActionsMenu } from "../../../components/design-system/RowActionsMenu";
import { SearchFilters } from "../../../components/design-system/SearchFilters";
import { Select } from "../../../components/design-system/Select";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import {
  WizardModal,
  type WizardStepConfig,
} from "../../../components/design-system/WizardModal";
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
  updateUserPassword,
  type ListUsersParams,
} from "../../../domains/users/api";
import type {
  CreateUserDto,
  UpdateUserDto,
  UserResponse,
} from "../../../domains/users/dtos";
import {
  sanitizeDocumentNumber,
  sanitizeEmail,
  sanitizeXss,
  validateStepCargo,
  validateStepCredentials,
  validateStepOrganization,
  validateStepPersona,
  validateStepRole,
} from "../../../domains/users/validation";

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
  documentoTipo: "CC",
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

const wizardSteps: WizardStepConfig[] = [
  { key: "credentials", label: "Credenciales", icon: KeyRound },
  { key: "persona", label: "Persona", icon: UserIcon },
  { key: "cargo", label: "Cargo y funciones", icon: Briefcase },
  { key: "organizacion", label: "Organización", icon: Building2 },
  { key: "rol", label: "Rol", icon: Shield },
  { key: "resumen", label: "Resumen", icon: FileText },
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
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<UserFormState>({ ...emptyForm });
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<UserResponse | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
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
      setRoles(result.filter((role) => role.nombre !== "SUPER_ADMIN"));
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
    setWizardError(null);
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
    setWizardError(null);
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
      documentoTipo: user.persona?.documentoTipo ?? "CC",
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
    setWizardError(null);
  };

  const openPasswordModal = (user: UserResponse) => {
    setPasswordModalUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordModalError(null);
  };

  const closePasswordModal = () => {
    setPasswordModalUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordModalError(null);
    setPasswordSaving(false);
  };

  const handleSavePassword = async () => {
    if (!passwordModalUser) return;
    const trimmed = newPassword.trim();
    if (!trimmed || trimmed.length < 8) {
      setPasswordModalError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (trimmed !== confirmPassword.trim()) {
      setPasswordModalError("Las contraseñas no coinciden.");
      return;
    }
    setPasswordSaving(true);
    setPasswordModalError(null);
    try {
      await updateUserPassword(
        passwordModalUser.id,
        trimmed,
        buildAuthHeaders()
      );
      showToast("Contraseña actualizada correctamente.", "success");
      closePasswordModal();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "No se pudo actualizar la contraseña.";
      setPasswordModalError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const updateForm = (field: keyof UserFormState, value: string) => {
    setWizardError(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateCurrentStep = useCallback(
    (stepIndex: number): { isValid: boolean; error?: string } => {
      switch (stepIndex) {
        case 0:
          return validateStepCredentials(
            { email: form.email, password: form.password },
            wizardMode
          );
        case 1:
          return validateStepPersona({
            nombres: form.nombres,
            apellidos: form.apellidos,
            documentoTipo: form.documentoTipo,
            documentoNumero: form.documentoNumero,
            telefono: form.telefono,
            direccion: form.direccion,
            emailPersonal: form.emailPersonal,
          });
        case 2:
          return validateStepCargo({
            cargoNombre: form.cargoNombre,
            cargoDescripcion: form.cargoDescripcion,
            funcionesDescripcion: form.funcionesDescripcion,
          });
        case 3:
          return validateStepOrganization(
            { tenantId: form.tenantId, tenantBranchId: form.tenantBranchId },
            isSuperAdmin
          );
        case 4:
          return validateStepRole({ roleId: form.roleId });
        default:
          return { isValid: true };
      }
    },
    [form, isSuperAdmin, wizardMode]
  );

  const canProceed = useMemo(() => {
    return validateCurrentStep(wizardStep).isValid;
  }, [validateCurrentStep, wizardStep]);

  const handleNext = () => {
    const validation = validateCurrentStep(wizardStep);
    if (!validation.isValid) {
      setWizardError(
        validation.error || "Completa los campos requeridos para continuar."
      );
      return;
    }
    setWizardError(null);
    setWizardStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
  };

  const handleBack = () => {
    setWizardError(null);
    setWizardStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepClick = (targetIndex: number) => {
    if (targetIndex < wizardStep) {
      setWizardError(null);
      setWizardStep(targetIndex);
    } else if (targetIndex > wizardStep) {
      const validation = validateCurrentStep(wizardStep);
      if (!validation.isValid) {
        setWizardError(
          validation.error || "Completa los campos requeridos para continuar."
        );
        return;
      }
      setWizardError(null);
      setWizardStep(targetIndex);
    }
  };

  const handleSubmit = async () => {
    // Validate all steps before submitting
    for (let i = 0; i < wizardSteps.length - 1; i++) {
      const stepVal = validateCurrentStep(i);
      if (!stepVal.isValid) {
        setWizardStep(i);
        setWizardError(stepVal.error || "Hay datos incompletos en el formulario.");
        return;
      }
    }

    setIsSubmitting(true);
    setWizardError(null);

    try {
      if (wizardMode === "create") {
        const payload: CreateUserDto = {
          email: sanitizeEmail(form.email),
          password: form.password,
          estado: "ACTIVE", // Clean default, removed technical selection
          tenantId: isSuperAdmin ? form.tenantId.trim() : undefined,
          tenantBranchId: form.tenantBranchId.trim(),
          roleId: form.roleId.trim(),
          persona: {
            nombres: sanitizeXss(form.nombres),
            apellidos: sanitizeXss(form.apellidos),
            documentoTipo: form.documentoTipo.trim(),
            documentoNumero: sanitizeDocumentNumber(form.documentoNumero),
            telefono: form.telefono.trim() || undefined,
            direccion: sanitizeXss(form.direccion) || undefined,
            emailPersonal: sanitizeEmail(form.emailPersonal) || undefined,
            cargoNombre: sanitizeXss(form.cargoNombre),
            cargoDescripcion: sanitizeXss(form.cargoDescripcion) || undefined,
            funcionesDescripcion:
              sanitizeXss(form.funcionesDescripcion) || undefined,
          },
        };
        await createUser(payload, buildAuthHeaders());
        showToast("Usuario creado correctamente.", "success");
      } else if (editingUser) {
        const payload: UpdateUserDto = {
          email: sanitizeEmail(form.email),
          estado: form.estado || "ACTIVE",
          tenantBranchId: form.tenantBranchId.trim(),
          roleId: form.roleId.trim(),
          persona: {
            nombres: sanitizeXss(form.nombres),
            apellidos: sanitizeXss(form.apellidos),
            documentoTipo: form.documentoTipo.trim(),
            documentoNumero: sanitizeDocumentNumber(form.documentoNumero),
            telefono: form.telefono.trim() || undefined,
            direccion: sanitizeXss(form.direccion) || undefined,
            emailPersonal: sanitizeEmail(form.emailPersonal) || undefined,
            cargoNombre: sanitizeXss(form.cargoNombre),
            cargoDescripcion: sanitizeXss(form.cargoDescripcion) || undefined,
            funcionesDescripcion:
              sanitizeXss(form.funcionesDescripcion) || undefined,
          },
        };
        await updateUser(editingUser.id, payload, buildAuthHeaders());
        showToast("Usuario actualizado correctamente.", "success");
      }
      setWizardOpen(false);
      await loadUsers();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "No se pudo guardar el usuario. Por favor verifica los datos ingresados.";
      setWizardError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    // Validate all steps first
    for (let i = 0; i < wizardSteps.length - 1; i++) {
      const stepVal = validateCurrentStep(i);
      if (!stepVal.isValid) {
        setWizardStep(i);
        setWizardError(stepVal.error || "Hay datos incompletos en el formulario.");
        return;
      }
    }

    try {
      await confirm({
        title:
          wizardMode === "create"
            ? "¿Deseas crear este usuario?"
            : "¿Confirmas actualizar la información?",
        description:
          wizardMode === "create"
            ? `Se creará el usuario para ${form.nombres} ${form.apellidos} con acceso a la sucursal seleccionada.`
            : `Se actualizarán los datos de acceso y perfil del usuario ${form.email}.`,
        confirmText: wizardMode === "create" ? "Crear usuario" : "Guardar cambios",
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
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
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
                  <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {`${user.persona?.nombres ?? ""} ${
                        user.persona?.apellidos ?? ""
                      }`.trim() || "Sin nombre"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          user.estado === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {user.estado === "ACTIVE" ? "Activo" : user.estado}
                      </span>
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end">
                        <RowActionsMenu
                          items={[
                            ...(canWrite
                              ? [
                                  {
                                    label: "Editar",
                                    icon: <Pencil className="h-4 w-4 text-slate-500" />,
                                    onSelect: () => openEditWizard(user),
                                  },
                                  {
                                    label: "Cambiar contraseña",
                                    icon: <KeyRound className="h-4 w-4 text-amber-500" />,
                                    onSelect: () => openPasswordModal(user),
                                  },
                                ]
                              : []),
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
        {users.length > 0 || hasNextPage || page > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-3">
              <span>Página {page + 1}</span>
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
        <WizardModal
          open={wizardOpen}
          title={wizardMode === "create" ? "Crear usuario" : "Editar usuario"}
          description={
            wizardMode === "create"
              ? "Completa los datos del nuevo usuario paso a paso para habilitar su acceso."
              : `Modifica los datos del usuario ${editingUser?.email ?? ""}.`
          }
          steps={wizardSteps}
          currentStepIndex={wizardStep}
          onStepClick={handleStepClick}
          onClose={closeWizard}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={() => void handleConfirmSubmit()}
          canProceed={canProceed}
          canSubmit={canProceed}
          isSubmitting={isSubmitting}
          size="xl"
          submitText={wizardMode === "create" ? "Crear usuario" : "Guardar cambios"}
          error={wizardError}
          onDismissError={() => setWizardError(null)}
        >
          <div className="py-2">
            {wizardStep === 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/40">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Credenciales de inicio de sesión
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ingresa la cuenta de correo corporativo para el acceso a la plataforma.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Correo electrónico"
                    type="email"
                    required
                    placeholder="ejemplo@empresa.com"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                  />

                  {wizardMode === "create" ? (
                    <Input
                      label="Contraseña inicial"
                      name="new_user_initial_password"
                      type="password"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      required
                      placeholder="Mínimo 8 caracteres"
                      hint="Mínimo 8 caracteres seguros"
                      value={form.password}
                      onChange={(event) => updateForm("password", event.target.value)}
                    />
                  ) : (
                    <div className="flex flex-col justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-3.5 dark:border-slate-700 dark:bg-slate-800/40 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Gestión de contraseña
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cambia la clave de acceso de este usuario
                        </p>
                      </div>
                      {editingUser ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openPasswordModal(editingUser)}
                        >
                          <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                          Cambiar clave
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/40">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Datos personales
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Información de identidad y contacto del usuario.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Nombres"
                    required
                    placeholder="Ej. Juan Carlos"
                    value={form.nombres}
                    onChange={(event) => updateForm("nombres", event.target.value)}
                  />
                  <Input
                    label="Apellidos"
                    required
                    placeholder="Ej. Pérez Gómez"
                    value={form.apellidos}
                    onChange={(event) => updateForm("apellidos", event.target.value)}
                  />
                  <Select
                    label="Tipo de documento"
                    required
                    value={form.documentoTipo}
                    onChange={(event) =>
                      updateForm("documentoTipo", event.target.value)
                    }
                  >
                    <option value="CC">Cédula de Ciudadanía (CC)</option>
                    <option value="CE">Cédula de Extranjería (CE)</option>
                    <option value="NIT">NIT</option>
                    <option value="Pasaporte">Pasaporte</option>
                    <option value="TI">Tarjeta de Identidad (TI)</option>
                    <option value="PEP">Permiso Especial de Permanencia (PEP)</option>
                    <option value="PPT">Permiso por Protección Temporal (PPT)</option>
                  </Select>
                  <Input
                    label="Número de documento"
                    required
                    placeholder="Ej. 1020304050"
                    value={form.documentoNumero}
                    onChange={(event) =>
                      updateForm(
                        "documentoNumero",
                        sanitizeDocumentNumber(event.target.value)
                      )
                    }
                  />
                  <Input
                    label="Teléfono de contacto"
                    placeholder="Ej. +57 300 1234567"
                    value={form.telefono}
                    onChange={(event) => updateForm("telefono", event.target.value)}
                  />
                  <Input
                    label="Correo electrónico personal"
                    type="email"
                    placeholder="usuario.personal@correo.com"
                    value={form.emailPersonal}
                    onChange={(event) =>
                      updateForm("emailPersonal", event.target.value)
                    }
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Dirección de residencia"
                      placeholder="Ej. Calle 123 # 45-67"
                      value={form.direccion}
                      onChange={(event) =>
                        updateForm("direccion", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/40">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Cargo y responsabilidades
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define la posición operativa del colaborador en la organización.
                  </p>
                </div>

                <div className="grid gap-4">
                  <Input
                    label="Nombre del cargo"
                    required
                    placeholder="Ej. Cajero Principal, Supervisor de Turno, Administrador"
                    value={form.cargoNombre}
                    onChange={(event) =>
                      updateForm("cargoNombre", event.target.value)
                    }
                  />
                  <Textarea
                    label="Descripción del cargo"
                    placeholder="Breve resumen de la posición..."
                    value={form.cargoDescripcion}
                    onChange={(event) =>
                      updateForm("cargoDescripcion", event.target.value)
                    }
                  />
                  <Textarea
                    label="Funciones principales"
                    placeholder="Detalla las funciones asignadas a este puesto..."
                    value={form.funcionesDescripcion}
                    onChange={(event) =>
                      updateForm("funcionesDescripcion", event.target.value)
                    }
                  />
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/40">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Asignación de organización y sucursal
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Establece el establecimiento principal donde desempeñará sus actividades.
                  </p>
                </div>

                <div className={`grid gap-4 ${isSuperAdmin ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                  {isSuperAdmin ? (
                    <Select
                      label="Empresa / Tenant"
                      required
                      disabled={wizardMode === "edit"}
                      value={form.tenantId}
                      onChange={(event) => handleTenantChange(event.target.value)}
                    >
                      <option value="">Selecciona un tenant</option>
                      {tenantOptions.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.nombre ?? tenant.slug}
                        </option>
                      ))}
                    </Select>
                  ) : null}
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
                </div>
                {branchesLoading ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Cargando sucursales...
                  </span>
                ) : null}
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/40">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Rol y permisos de acceso
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    El rol determinará las opciones de menú y acciones que el usuario puede realizar.
                  </p>
                </div>

                <div className="grid gap-4">
                  <Select
                    label="Rol asignado"
                    required
                    value={form.roleId}
                    onChange={(event) => updateForm("roleId", event.target.value)}
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
              </div>
            ) : null}

            {wizardStep === 5 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50/80 p-4 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                    Resumen de datos listos para guardar
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Revisa la información consolidada antes de confirmar la operación.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Cuenta y Acceso
                    </p>
                    <div className="text-sm space-y-1">
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-white">Email:</span>{" "}
                        {form.email}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-white">Rol:</span>{" "}
                        {roles.find((r) => r.id === form.roleId)?.nombre ?? "-"}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-white">Sucursal:</span>{" "}
                        {branches.find((b) => b.id === form.tenantBranchId)?.nombre ?? "-"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 space-y-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Datos del Colaborador
                    </p>
                    <div className="text-sm space-y-1">
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-white">Nombre:</span>{" "}
                        {form.nombres} {form.apellidos}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-white">Documento:</span>{" "}
                        {form.documentoTipo} {form.documentoNumero}
                      </p>
                      <p className="text-slate-700 dark:text-slate-300">
                        <span className="font-medium text-slate-900 dark:text-white">Cargo:</span>{" "}
                        {form.cargoNombre}
                      </p>
                      {form.telefono ? (
                        <p className="text-slate-700 dark:text-slate-300">
                          <span className="font-medium text-slate-900 dark:text-white">Teléfono:</span>{" "}
                          {form.telefono}
                        </p>
                      ) : null}
                      {form.emailPersonal ? (
                        <p className="text-slate-700 dark:text-slate-300">
                          <span className="font-medium text-slate-900 dark:text-white">Email personal:</span>{" "}
                          {form.emailPersonal}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </WizardModal>
      ) : null}

      {passwordModalUser ? (
        <Modal
          title={`Cambiar contraseña - ${passwordModalUser.email}`}
          onClose={closePasswordModal}
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={closePasswordModal}
                disabled={passwordSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSavePassword}
                disabled={passwordSaving}
              >
                {passwordSaving ? "Guardando..." : "Guardar contraseña"}
              </Button>
            </div>
          }
        >
          <form
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSavePassword();
            }}
            className="space-y-4"
          >
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Estás actualizando la contraseña para el usuario{" "}
              <strong>{passwordModalUser.email}</strong>.
            </div>

            {passwordModalError ? (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {passwordModalError}
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-new-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Nueva contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="modal-new-password"
                    name="admin_new_user_pwd"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => {
                      setPasswordModalError(null);
                      setNewPassword(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-11 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    title={showNewPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    aria-label={showNewPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="modal-confirm-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Confirmar nueva contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="modal-confirm-password"
                    name="admin_confirm_user_pwd"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    required
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(e) => {
                      setPasswordModalError(null);
                      setConfirmPassword(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-11 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    title={showConfirmPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
    </div>
  );
};

export default UsuariosPage;
