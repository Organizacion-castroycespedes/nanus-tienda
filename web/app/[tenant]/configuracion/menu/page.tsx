"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowUpDown,
  BarChart3,
  Bell,
  Building,
  Building2,
  Calculator,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Grid3X3,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Ruler,
  Save,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import {
  isConfirmCancelledError,
  useConfirm,
} from "../../../../hooks/use-confirm";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { useAppSelector } from "../../../../store/hooks";
import { listRoles } from "../../../../domains/roles/api";
import type { RoleResponse } from "../../../../domains/roles/dtos";
import {
  createMenuItem,
  deleteMenuItem,
  listMenuItems,
  listRoleMenuPermissions,
  replaceRoleMenuPermissions,
  updateMenuItem,
  updateMenuItemStatus,
  type MenuItemInput,
  type MenuItemUpdateInput,
} from "../../../../domains/menu/admin-api";
import type { MenuItemRecord } from "../../../../domains/menu/admin-types";
import type { AccessLevel } from "../../../../domains/menu/types";

const emptyForm: MenuItemInput = {
  tenantId: "",
  key: "",
  module: "",
  label: "",
  route: "",
  icon: "",
  parentId: null,
  sortOrder: 0,
  visible: true,
  belowMainMenu: false,
  metadata: {},
};

type MenuTreeNode = MenuItemRecord & { children: MenuTreeNode[] };

type PermissionDraft = Record<string, AccessLevel | null>;

type ToggleSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
};

const normalizeIconName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const iconCatalog: Array<{ name: string; label: string; icon: LucideIcon }> = [
  { name: "Menu", label: "Menú", icon: Menu },
  { name: "LayoutDashboard", label: "Dashboard", icon: LayoutDashboard },
  { name: "Settings", label: "Configuración", icon: Settings },
  { name: "User", label: "Usuario", icon: User },
  { name: "Users", label: "Usuarios", icon: Users },
  { name: "UserCheck", label: "Usuario verificado", icon: UserCheck },
  { name: "UserPlus", label: "Agregar usuario", icon: UserPlus },
  { name: "IdCard", label: "Identificación", icon: IdCard },
  { name: "ShieldCheck", label: "Seguridad", icon: ShieldCheck },
  { name: "KeyRound", label: "Roles/Permisos", icon: KeyRound },
  { name: "Building2", label: "Edificios", icon: Building2 },
  { name: "Building", label: "Edificio", icon: Building },
  { name: "Store", label: "Tienda", icon: Store },
  { name: "Package", label: "Paquete", icon: Package },
  { name: "Grid3X3", label: "Cuadrícula", icon: Grid3X3 },
  { name: "Tags", label: "Etiquetas", icon: Tags },
  { name: "Calculator", label: "Calculadora", icon: Calculator },
  { name: "Ruler", label: "Regla", icon: Ruler },
  { name: "ShoppingCart", label: "Carrito", icon: ShoppingCart },
  { name: "BarChart3", label: "Gráfico", icon: BarChart3 },
  { name: "Archive", label: "Archivo", icon: Archive },
  { name: "ArrowUpDown", label: "Intercambio", icon: ArrowUpDown },
  { name: "FileText", label: "Documento", icon: FileText },
  { name: "Calendar", label: "Calendario", icon: Calendar },
  { name: "ChevronDown", label: "Chevron abajo", icon: ChevronDown },
  { name: "ChevronRight", label: "Chevron derecha", icon: ChevronRight },
  { name: "Wrench", label: "Herramienta", icon: Wrench },
  { name: "Activity", label: "Actividad", icon: Activity },
  { name: "AlertCircle", label: "Alerta", icon: AlertCircle },
  { name: "Loader2", label: "Cargando", icon: Loader2 },
  { name: "Bell", label: "Notificaciones", icon: Bell },
  { name: "MessageCircle", label: "Mensajes", icon: MessageCircle },
  { name: "LogOut", label: "Salida", icon: LogOut },
  { name: "X", label: "Cerrar", icon: X },
];

const iconByName = iconCatalog.reduce<Record<string, LucideIcon>>((acc, item) => {
  acc[normalizeIconName(item.name)] = item.icon;
  return acc;
}, {});

const ToggleSection = ({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  defaultOpen = true,
}: ToggleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={className}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen((prev) => !prev)}
              className="gap-2"
            >
              {isOpen ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          {description ? (
            <p className="text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {isOpen ? <div className={contentClassName ?? "mt-4"}>{children}</div> : null}
    </section>
  );
};

const MenuManagementPage = () => {
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuForm, setMenuForm] = useState<MenuItemInput>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const confirm = useConfirm();

  const authUser = useAppSelector((state) => state.auth.user);
  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";
  const tenantId = authUser?.tenantId ?? "";

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
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadMenuItems = useCallback(async () => {
    if (!tenantId) {
      return;
    }
    setMenuLoading(true);
    try {
      const items = await listMenuItems(tenantId, buildAuthHeaders());
      setMenuItems(items);
    } catch {
      showToast("No se pudo cargar el menú.", "error");
    } finally {
      setMenuLoading(false);
    }
  }, [tenantId, buildAuthHeaders, showToast]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const items = await listRoles(buildAuthHeaders());
      setRoles(items);
      if (!selectedRoleId && items.length > 0) {
        setSelectedRoleId(items[0].id);
      }
    } catch {
      showToast("No se pudieron cargar los roles.", "error");
    } finally {
      setRolesLoading(false);
    }
  }, [buildAuthHeaders, selectedRoleId, showToast]);

  const loadRolePermissions = useCallback(async () => {
    if (!selectedRoleId || !tenantId) {
      return;
    }
    setPermissionsLoading(true);
    try {
      const items = await listRoleMenuPermissions(
        selectedRoleId,
        tenantId,
        buildAuthHeaders()
      );
      const draft: PermissionDraft = {};
      items.forEach((item) => {
        draft[item.menu_item_id] = item.access_level as AccessLevel;
      });
      setPermissionDraft(draft);
    } catch {
      showToast("No se pudieron cargar los permisos del rol.", "error");
    } finally {
      setPermissionsLoading(false);
    }
  }, [selectedRoleId, tenantId, buildAuthHeaders, showToast]);

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }
    setMenuForm((prev) => ({ ...prev, tenantId }));
    void loadMenuItems();
    void loadRoles();
  }, [isSuperAdmin, loadMenuItems, loadRoles, tenantId]);

  useEffect(() => {
    void loadRolePermissions();
  }, [loadRolePermissions]);

  const menuTree = useMemo(() => {
    const nodes = new Map<string, MenuTreeNode>();
    menuItems.forEach((item) => {
      nodes.set(item.id, { ...item, children: [] });
    });
    const roots: MenuTreeNode[] = [];
    nodes.forEach((node) => {
      if (node.parent_id && nodes.has(node.parent_id)) {
        nodes.get(node.parent_id)?.children.push(node);
      } else {
        roots.push(node);
      }
    });
    const sortNodes = (items: MenuTreeNode[]) => {
      items.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "es"));
      items.forEach((item) => sortNodes(item.children));
    };
    sortNodes(roots);
    return roots;
  }, [menuItems]);

  const parentOptions = useMemo(
    () => menuItems.filter((item) => item.id !== editingId),
    [menuItems, editingId]
  );

  const resetForm = () => {
    setEditingId(null);
    setMenuForm({ ...emptyForm, tenantId });
  };

  const handleEdit = (item: MenuItemRecord) => {
    setEditingId(item.id);
    setMenuForm({
      tenantId: item.tenant_id,
      key: item.key,
      module: item.module,
      label: item.label,
      route: item.route,
      icon: item.icon ?? "",
      parentId: item.parent_id ?? null,
      sortOrder: item.sort_order,
      visible: item.visible,
      belowMainMenu: item.below_main_menu ?? false,
      metadata: item.metadata ?? {},
    });
  };

  const handleSaveMenuItem = async () => {
    if (!menuForm.key.trim() || !menuForm.module.trim() || !menuForm.label.trim()) {
      showToast("Completa los campos obligatorios.", "warning");
      return;
    }
    if (!menuForm.route.trim().startsWith("/")) {
      showToast("La ruta debe iniciar con /.", "warning");
      return;
    }
    const sanitizedIcon = menuForm.icon?.trim() ? menuForm.icon.trim() : null;
    try {
      if (editingId) {
        const payload: MenuItemUpdateInput = {
          key: menuForm.key,
          module: menuForm.module,
          label: menuForm.label,
          route: menuForm.route,
          icon: sanitizedIcon,
          parentId: menuForm.parentId,
          sortOrder: menuForm.sortOrder,
          visible: menuForm.visible,
          belowMainMenu: menuForm.belowMainMenu,
          metadata: menuForm.metadata,
        };
        await updateMenuItem(editingId, payload, buildAuthHeaders());
        await loadMenuItems();
        showToast("Menú actualizado.", "success");
      } else {
        await createMenuItem(
          { ...menuForm, icon: sanitizedIcon },
          buildAuthHeaders()
        );
        await loadMenuItems();
        showToast("Menú creado.", "success");
      }
      resetForm();
    } catch {
      showToast("No se pudo guardar el menú.", "error");
    }
  };

  const handleToggleVisibility = async (item: MenuItemRecord) => {
    try {
      await updateMenuItemStatus(item.id, !item.visible, buildAuthHeaders());
      void loadMenuItems();
    } catch {
      showToast("No se pudo actualizar la visibilidad.", "error");
    }
  };

  const handleDeleteItem = async (item: MenuItemRecord) => {
    try {
      await deleteMenuItem(item.id, buildAuthHeaders());
      void loadMenuItems();
    } catch {
      showToast("No se pudo eliminar el menú.", "error");
    }
  };

  const handlePermissionChange = (menuItemId: string, next: AccessLevel | null) => {
    setPermissionDraft((prev) => ({
      ...prev,
      [menuItemId]: next,
    }));
  };

  const handleReadToggle = (menuItemId: string, checked: boolean) => {
    if (checked) {
      const current = permissionDraft[menuItemId];
      handlePermissionChange(menuItemId, current === "WRITE" ? "WRITE" : "READ");
      return;
    }
    handlePermissionChange(menuItemId, null);
  };

  const handleWriteToggle = (menuItemId: string, checked: boolean) => {
    if (checked) {
      handlePermissionChange(menuItemId, "WRITE");
      return;
    }
    handlePermissionChange(menuItemId, "READ");
  };

  const savePermissions = async () => {
    if (!selectedRoleId || !tenantId) {
      return;
    }
    setSavingPermissions(true);
    try {
      const permissions = Object.entries(permissionDraft)
        .filter(([, access]) => access)
        .map(([menuItemId, accessLevel]) => ({
          menuItemId,
          accessLevel: accessLevel as AccessLevel,
        }));
      await replaceRoleMenuPermissions(
        selectedRoleId,
        { tenantId, permissions },
        buildAuthHeaders()
      );
      showToast("Permisos actualizados.", "success");
    } catch {
      showToast("No se pudieron guardar los permisos.", "error");
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleConfirmSaveMenuItem = async () => {
    if (
      !menuForm.key.trim() ||
      !menuForm.module.trim() ||
      !menuForm.label.trim() ||
      !menuForm.route.trim().startsWith("/")
    ) {
      await handleSaveMenuItem();
      return;
    }

    try {
      await confirm({
        title: editingId
          ? "¿Confirmas actualizar la información?"
          : "¿Deseas guardar los cambios?",
        description: editingId
          ? "Se actualizará la configuración de este elemento de menú."
          : "Se creará un nuevo elemento de menú con la información diligenciada.",
        confirmText: editingId ? "Actualizar" : "Guardar",
        variant: "default",
      });
      await handleSaveMenuItem();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmToggleVisibility = async (item: MenuItemRecord) => {
    try {
      await confirm({
        title: item.visible
          ? "¿Deseas inactivar este registro?"
          : "¿Deseas reactivar este registro?",
        description: item.visible
          ? `El menú "${item.label}" dejará de mostrarse en la navegación.`
          : `El menú "${item.label}" volverá a mostrarse en la navegación.`,
        confirmText: item.visible ? "Ocultar" : "Mostrar",
        variant: "warning",
      });
      await handleToggleVisibility(item);
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmDeleteItem = async (item: MenuItemRecord) => {
    try {
      await confirm({
        title: "¿Estás seguro de eliminar este registro?",
        description: `Se eliminará el menú "${item.label}". Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        variant: "danger",
      });
      await handleDeleteItem(item);
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmSavePermissions = async () => {
    if (!selectedRoleId || !tenantId) {
      await savePermissions();
      return;
    }

    try {
      await confirm({
        title: "¿Deseas guardar los cambios?",
        description:
          "Los permisos del rol seleccionado se actualizarán con la configuración actual.",
        confirmText: "Guardar permisos",
        variant: "default",
      });
      await savePermissions();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const renderTree = (items: MenuTreeNode[], depth = 0) => (
    <ul className={`space-y-2 ${depth > 0 ? "pl-4" : ""}`}>
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">{item.route}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleConfirmToggleVisibility(item)}
              >
                {item.visible ? "Ocultar" : "Mostrar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleConfirmDeleteItem(item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {item.children.length > 0 ? renderTree(item.children, depth + 1) : null}
        </li>
      ))}
    </ul>
  );

  const renderPermissionTree = (items: MenuTreeNode[], depth = 0) => (
    <ul className={`space-y-2 ${depth > 0 ? "pl-4" : ""}`}>
      {items.map((item) => {
        const access = permissionDraft[item.id] ?? null;
        const canRead = access === "READ" || access === "WRITE";
        const canWrite = access === "WRITE";
        return (
          <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.route}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={canRead}
                    onChange={(event) =>
                      handleReadToggle(item.id, event.target.checked)
                    }
                  />
                  Lectura
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={canWrite}
                    onChange={(event) =>
                      handleWriteToggle(item.id, event.target.checked)
                    }
                  />
                  Escritura
                </label>
              </div>
            </div>
            {item.children.length > 0 ? renderPermissionTree(item.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  const selectedIconName = menuForm.icon?.trim() ?? "";
  const selectedIconKey = selectedIconName ? normalizeIconName(selectedIconName) : "";
  const SelectedIcon = selectedIconKey ? iconByName[selectedIconKey] : null;

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Solo SUPER_ADMIN puede administrar el menú.
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      <header className="space-y-2">
        <p className="text-sm text-slate-500">Configuración</p>
        <h1 className="text-2xl font-semibold text-slate-900">Creación de menú</h1>
        <p className="text-sm text-slate-500">
          Administra las rutas y asigna permisos de lectura y escritura por rol.
        </p>
      </header>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <ToggleSection
          title="Detalle del menú"
          actions={
            <Button variant="ghost" onClick={resetForm}>
              Limpiar
            </Button>
          }
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          contentClassName="mt-4 space-y-4"
        >
            <Input
              label="Key"
              value={menuForm.key}
              onChange={(event) =>
                setMenuForm((prev) => ({ ...prev, key: event.target.value }))
              }
              required
            />
            <Input
              label="Módulo"
              value={menuForm.module}
              onChange={(event) =>
                setMenuForm((prev) => ({ ...prev, module: event.target.value }))
              }
              required
            />
            <Input
              label="Etiqueta"
              value={menuForm.label}
              onChange={(event) =>
                setMenuForm((prev) => ({ ...prev, label: event.target.value }))
              }
              required
            />
            <Input
              label="Ruta"
              value={menuForm.route}
              onChange={(event) =>
                setMenuForm((prev) => ({ ...prev, route: event.target.value }))
              }
              required
            />
            <Select
              label="Icono"
              value={menuForm.icon ?? ""}
              onChange={(event) =>
                setMenuForm((prev) => ({ ...prev, icon: event.target.value }))
              }
            >
              <option value="">Sin icono</option>
              {iconCatalog.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.label}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Vista previa:</span>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                {SelectedIcon ? (
                  <SelectedIcon className="h-4 w-4 text-slate-700" aria-hidden="true" />
                ) : (
                  <span className="h-4 w-4 rounded bg-slate-200" aria-hidden="true" />
                )}
              </div>
            </div>
            <Select
              label="Padre"
              value={menuForm.parentId ?? ""}
              onChange={(event) =>
                setMenuForm((prev) => ({
                  ...prev,
                  parentId: event.target.value || null,
                }))
              }
            >
              <option value="">Sin padre</option>
              {parentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Input
              label="Orden"
              type="number"
              value={menuForm.sortOrder ?? 0}
              onChange={(event) =>
                setMenuForm((prev) => ({
                  ...prev,
                  sortOrder: Number(event.target.value),
                }))
              }
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={menuForm.visible ?? true}
                onChange={(event) =>
                  setMenuForm((prev) => ({
                    ...prev,
                    visible: event.target.checked,
                  }))
                }
              />
              Visible
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={menuForm.belowMainMenu ?? false}
                onChange={(event) =>
                  setMenuForm((prev) => ({
                    ...prev,
                    belowMainMenu: event.target.checked,
                  }))
                }
              />
              Mostrar debajo del menú principal
            </label>
            <Button
              onClick={() => void handleConfirmSaveMenuItem()}
              variant="primary"
              disabled={menuLoading}
            >
              <Save className="h-4 w-4" />
              {editingId ? "Actualizar" : "Crear"}
            </Button>
        </ToggleSection>

        <ToggleSection
          title="Vista previa"
          actions={
            <Button variant="ghost" onClick={loadMenuItems} disabled={menuLoading}>
              Recargar
            </Button>
          }
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          contentClassName="mt-4 space-y-4"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mt-4">
              {menuLoading ? (
                <p className="text-sm text-slate-500">Cargando menú...</p>
              ) : menuItems.length === 0 ? (
                <p className="text-sm text-slate-500">Sin elementos registrados.</p>
              ) : (
                renderTree(menuTree)
              )}
            </div>
          </div>
        </ToggleSection>        
      </section>

      <ToggleSection
        title="Permisos por rol"
        description="Asigna lectura y escritura para cada opción del menú."
        actions={
          <>
            <Select
              label="Rol"
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              disabled={rolesLoading}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.nombre}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              onClick={() => void handleConfirmSavePermissions()}
              disabled={savingPermissions || permissionsLoading}
            >
              Guardar permisos
            </Button>
          </>
        }
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        contentClassName="mt-6"
      >
          {permissionsLoading ? (
            <p className="text-sm text-slate-500">Cargando permisos...</p>
          ) : menuItems.length === 0 ? (
            <p className="text-sm text-slate-500">No hay menús para asignar.</p>
          ) : (
            renderPermissionTree(menuTree)
          )}
      </ToggleSection>
    </div>
  );
};

export default MenuManagementPage;
