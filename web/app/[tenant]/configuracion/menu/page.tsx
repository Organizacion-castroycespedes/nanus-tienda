"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  FileText,
  Filter,
  FolderTree,
  Grid3X3,
  IdCard,
  KeyRound,
  Layers,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Ruler,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tags,
  Trash2,
  Unlock,
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

type ActiveTab = "permissions" | "menu-structure";

type PermissionFilterState = "all" | "granted" | "none" | "read" | "write";

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

const MenuManagementPage = () => {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("permissions");

  // Menu items state
  const [menuItems, setMenuItems] = useState<MenuItemRecord[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuForm, setMenuForm] = useState<MenuItemInput>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Roles & Permissions state
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft>({});
  const [initialPermissionDraft, setInitialPermissionDraft] = useState<PermissionDraft>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Filters & Search for Permissions
  const [permSearch, setPermSearch] = useState("");
  const [permModuleFilter, setPermModuleFilter] = useState("all");
  const [permStatusFilter, setPermStatusFilter] = useState<PermissionFilterState>("all");
  const [expandedPermModules, setExpandedPermModules] = useState<Record<string, boolean>>({});

  // Filters & Search for Menu Preview
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewModuleFilter, setPreviewModuleFilter] = useState("all");
  const [previewVisibilityFilter, setPreviewVisibilityFilter] = useState<"all" | "visible" | "hidden">("all");
  const [expandedPreviewModules, setExpandedPreviewModules] = useState<Record<string, boolean>>({});

  // Toast & Confirm
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
  }, [authUser?.id, authUser?.role, authUser?.tenantId]);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadMenuItems = useCallback(async () => {
    if (!tenantId) return;
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
    if (!selectedRoleId || !tenantId) return;
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
      setInitialPermissionDraft(draft);
    } catch {
      showToast("No se pudieron cargar los permisos del rol.", "error");
    } finally {
      setPermissionsLoading(false);
    }
  }, [selectedRoleId, tenantId, buildAuthHeaders, showToast]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setMenuForm((prev) => ({ ...prev, tenantId }));
    void loadMenuItems();
    void loadRoles();
  }, [isSuperAdmin, loadMenuItems, loadRoles, tenantId]);

  useEffect(() => {
    void loadRolePermissions();
  }, [loadRolePermissions]);

  // Detected unique modules
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      if (item.module) set.add(item.module);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [menuItems]);

  // Set all modules expanded by default on initial load
  useEffect(() => {
    if (availableModules.length > 0) {
      setExpandedPermModules((prev) => {
        if (Object.keys(prev).length === 0) {
          const init: Record<string, boolean> = {};
          availableModules.forEach((m) => {
            init[m] = true;
          });
          return init;
        }
        return prev;
      });
      setExpandedPreviewModules((prev) => {
        if (Object.keys(prev).length === 0) {
          const init: Record<string, boolean> = {};
          availableModules.forEach((m) => {
            init[m] = true;
          });
          return init;
        }
        return prev;
      });
    }
  }, [availableModules]);

  // Has unsaved permission changes check
  const hasUnsavedPermissions = useMemo(() => {
    const allKeys = new Set([
      ...Object.keys(permissionDraft),
      ...Object.keys(initialPermissionDraft),
    ]);
    for (const key of allKeys) {
      const current = permissionDraft[key] ?? null;
      const initial = initialPermissionDraft[key] ?? null;
      if (current !== initial) return true;
    }
    return false;
  }, [permissionDraft, initialPermissionDraft]);

  // Tree nodes builder
  const buildTree = useCallback((items: MenuItemRecord[]) => {
    const nodes = new Map<string, MenuTreeNode>();
    items.forEach((item) => {
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
    const sortNodes = (list: MenuTreeNode[]) => {
      list.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "es"));
      list.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  }, []);

  // Group items by module with search and filters
  const groupedPermissionsByModule = useMemo(() => {
    const query = permSearch.trim().toLowerCase();
    const map = new Map<string, MenuItemRecord[]>();

    availableModules.forEach((m) => map.set(m, []));
    map.set("otros", []);

    menuItems.forEach((item) => {
      // Filter by module
      if (permModuleFilter !== "all" && item.module !== permModuleFilter) {
        return;
      }

      // Filter by status
      const access = permissionDraft[item.id] ?? null;
      if (permStatusFilter === "granted" && !access) return;
      if (permStatusFilter === "none" && access) return;
      if (permStatusFilter === "read" && access !== "READ") return;
      if (permStatusFilter === "write" && access !== "WRITE") return;

      // Filter by search query
      if (query) {
        const matches =
          item.label.toLowerCase().includes(query) ||
          item.route.toLowerCase().includes(query) ||
          item.key.toLowerCase().includes(query) ||
          (item.module && item.module.toLowerCase().includes(query));
        if (!matches) return;
      }

      const modKey = item.module || "otros";
      if (!map.has(modKey)) {
        map.set(modKey, []);
      }
      map.get(modKey)!.push(item);
    });

    const result: Array<{ module: string; items: MenuItemRecord[]; tree: MenuTreeNode[] }> = [];
    map.forEach((items, mod) => {
      if (items.length > 0) {
        result.push({
          module: mod,
          items,
          tree: buildTree(items),
        });
      }
    });

    result.sort((a, b) => a.module.localeCompare(b.module, "es"));
    return result;
  }, [availableModules, menuItems, permModuleFilter, permStatusFilter, permSearch, permissionDraft, buildTree]);

  // Group items for menu preview with search & filters
  const groupedPreviewByModule = useMemo(() => {
    const query = previewSearch.trim().toLowerCase();
    const map = new Map<string, MenuItemRecord[]>();

    availableModules.forEach((m) => map.set(m, []));
    map.set("otros", []);

    menuItems.forEach((item) => {
      if (previewModuleFilter !== "all" && item.module !== previewModuleFilter) {
        return;
      }
      if (previewVisibilityFilter === "visible" && !item.visible) return;
      if (previewVisibilityFilter === "hidden" && item.visible) return;

      if (query) {
        const matches =
          item.label.toLowerCase().includes(query) ||
          item.route.toLowerCase().includes(query) ||
          item.key.toLowerCase().includes(query) ||
          (item.module && item.module.toLowerCase().includes(query));
        if (!matches) return;
      }

      const modKey = item.module || "otros";
      if (!map.has(modKey)) {
        map.set(modKey, []);
      }
      map.get(modKey)!.push(item);
    });

    const result: Array<{ module: string; items: MenuItemRecord[]; tree: MenuTreeNode[] }> = [];
    map.forEach((items, mod) => {
      if (items.length > 0) {
        result.push({
          module: mod,
          items,
          tree: buildTree(items),
        });
      }
    });

    result.sort((a, b) => a.module.localeCompare(b.module, "es"));
    return result;
  }, [availableModules, menuItems, previewModuleFilter, previewVisibilityFilter, previewSearch, buildTree]);

  // Global permission metrics
  const permissionStats = useMemo(() => {
    let total = menuItems.length;
    let readCount = 0;
    let writeCount = 0;
    let noneCount = 0;

    menuItems.forEach((item) => {
      const access = permissionDraft[item.id] ?? null;
      if (access === "WRITE") {
        writeCount++;
      } else if (access === "READ") {
        readCount++;
      } else {
        noneCount++;
      }
    });

    return { total, readCount, writeCount, noneCount, grantedCount: readCount + writeCount };
  }, [menuItems, permissionDraft]);

  const parentOptions = useMemo(
    () => menuItems.filter((item) => item.id !== editingId),
    [menuItems, editingId]
  );

  const resetForm = () => {
    setEditingId(null);
    setMenuForm({ ...emptyForm, tenantId });
  };

  const handleEdit = (item: MenuItemRecord) => {
    setActiveTab("menu-structure");
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
      if (editingId === item.id) {
        resetForm();
      }
    } catch {
      showToast("No se pudo eliminar el menú.", "error");
    }
  };

  // Permission mutation handlers
  const handlePermissionChange = (menuItemId: string, next: AccessLevel | null) => {
    setPermissionDraft((prev) => ({
      ...prev,
      [menuItemId]: next,
    }));
  };

  // Module-level mass actions
  const handleModuleMassPermission = (items: MenuItemRecord[], level: AccessLevel | null) => {
    setPermissionDraft((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[item.id] = level;
      });
      return next;
    });
  };

  // Global mass actions
  const handleGlobalMassPermission = (level: AccessLevel | null) => {
    setPermissionDraft((prev) => {
      const next = { ...prev };
      menuItems.forEach((item) => {
        next[item.id] = level;
      });
      return next;
    });
  };

  // Accordion toggle helpers
  const togglePermModule = (mod: string) => {
    setExpandedPermModules((prev) => ({ ...prev, [mod]: !prev[mod] }));
  };

  const toggleAllPermModules = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    availableModules.forEach((m) => {
      updated[m] = expand;
    });
    updated["otros"] = expand;
    setExpandedPermModules(updated);
  };

  const togglePreviewModule = (mod: string) => {
    setExpandedPreviewModules((prev) => ({ ...prev, [mod]: !prev[mod] }));
  };

  const toggleAllPreviewModules = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    availableModules.forEach((m) => {
      updated[m] = expand;
    });
    updated["otros"] = expand;
    setExpandedPreviewModules(updated);
  };

  const savePermissions = async () => {
    if (!selectedRoleId || !tenantId) return;
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
      setInitialPermissionDraft({ ...permissionDraft });
      showToast("Permisos actualizados correctamente.", "success");
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
        title: "¿Deseas guardar los cambios de permisos?",
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

  // Compact Tree Renderer for Permissions with Segmented Quick Toggles
  const renderPermissionTree = (items: MenuTreeNode[], depth = 0) => (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
      {items.map((item) => {
        const access = permissionDraft[item.id] ?? null;
        const ItemIcon = item.icon ? iconByName[normalizeIconName(item.icon)] : null;

        return (
          <div key={item.id} className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/40">
            <div
              className={`flex flex-col gap-2.5 py-2 px-3 sm:flex-row sm:items-center sm:justify-between ${
                depth > 0 ? "border-l-2 border-primary-400/80 dark:border-primary-600/80 ml-4 pl-3" : ""
              }`}
            >
              {/* Menu Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100/80 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {ItemIcon ? (
                    <ItemIcon className="h-3.5 w-3.5" />
                  ) : (
                    <FolderTree className="h-3.5 w-3.5 opacity-60" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {item.label}
                    </span>
                    <span className="hidden sm:inline rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {item.key}
                    </span>
                    {!item.visible && (
                      <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                        Oculto
                      </span>
                    )}
                  </div>
                  <span className="block truncate text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {item.route}
                  </span>
                </div>
              </div>

              {/* Segmented Permission Control Pill */}
              <div className="flex shrink-0 items-center gap-2 pl-9 sm:pl-0">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
                  {/* Sin acceso */}
                  <button
                    type="button"
                    onClick={() => handlePermissionChange(item.id, null)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                      access === null
                        ? "bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                        : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                    }`}
                    title="Quitar acceso a esta opción"
                  >
                    <Lock className="h-3 w-3" />
                    <span className="hidden xs:inline">Ninguno</span>
                  </button>

                  {/* Lectura */}
                  <button
                    type="button"
                    onClick={() => handlePermissionChange(item.id, "READ")}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                      access === "READ"
                        ? "bg-blue-600 text-white shadow-sm dark:bg-blue-600 dark:text-white"
                        : "text-blue-700/80 hover:text-blue-800 hover:bg-blue-50/50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                    }`}
                    title="Permiso de solo lectura"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Lectura</span>
                  </button>

                  {/* Total (Escritura) */}
                  <button
                    type="button"
                    onClick={() => handlePermissionChange(item.id, "WRITE")}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                      access === "WRITE"
                        ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-600 dark:text-white"
                        : "text-emerald-700/80 hover:text-emerald-800 hover:bg-emerald-50/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    }`}
                    title="Permiso completo (Lectura y Escritura)"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    <span>Total</span>
                  </button>
                </div>
              </div>
            </div>

            {item.children.length > 0 ? renderPermissionTree(item.children, depth + 1) : null}
          </div>
        );
      })}
    </div>
  );

  // Compact Tree Renderer for Menu Preview
  const renderPreviewTree = (items: MenuTreeNode[], depth = 0) => (
    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
      {items.map((item) => {
        const ItemIcon = item.icon ? iconByName[normalizeIconName(item.icon)] : null;
        const isEditing = editingId === item.id;

        return (
          <div
            key={item.id}
            className={`transition-colors ${
              isEditing
                ? "bg-primary-50/80 dark:bg-primary-950/30"
                : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            }`}
          >
            <div
              className={`flex flex-col gap-2 py-2.5 px-3 sm:flex-row sm:items-center sm:justify-between ${
                depth > 0 ? "border-l-2 border-primary-300 dark:border-primary-700 ml-4 pl-3" : ""
              }`}
            >
              {/* Menu info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100/70 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {ItemIcon ? (
                    <ItemIcon className="h-3.5 w-3.5" />
                  ) : (
                    <FolderTree className="h-3.5 w-3.5 opacity-60" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {item.label}
                    </span>
                    <span className="hidden sm:inline rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {item.key}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${
                        item.visible
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {item.visible ? "Visible" : "Oculto"}
                    </span>
                    {item.sort_order > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        #{item.sort_order}
                      </span>
                    )}
                  </div>
                  <span className="block truncate text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {item.route}
                  </span>
                </div>
              </div>

              {/* Row Action Buttons */}
              <div className="flex shrink-0 items-center gap-1.5 pl-9 sm:pl-0">
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Pencil className="h-3 w-3 text-primary-600" />
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleConfirmToggleVisibility(item)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-xs transition-colors ${
                    item.visible
                      ? "border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100/60 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                      : "border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/60 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                  }`}
                >
                  {item.visible ? (
                    <>
                      <EyeOff className="h-3 w-3" />
                      <span>Ocultar</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      <span>Mostrar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleConfirmDeleteItem(item)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  title="Eliminar elemento"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {item.children.length > 0 ? renderPreviewTree(item.children, depth + 1) : null}
          </div>
        );
      })}
    </div>
  );

  const selectedIconName = menuForm.icon?.trim() ?? "";
  const selectedIconKey = selectedIconName ? normalizeIconName(selectedIconName) : "";
  const SelectedIcon = selectedIconKey ? iconByName[selectedIconKey] : null;

  if (!isSuperAdmin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
        Solo SUPER_ADMIN puede administrar el menú.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header with Title & Tab Navigation */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Configuración del Sistema
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Menú y Permisos por Rol
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Administra la estructura de rutas y controla los niveles de acceso de lectura y escritura.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("permissions")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all ${
              activeTab === "permissions"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <span>Permisos por Rol</span>
            {hasUnsavedPermissions && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("menu-structure")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all ${
              activeTab === "menu-structure"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <FolderTree className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            <span>Estructura y Rutas</span>
            <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {menuItems.length}
            </span>
          </button>
        </div>
      </header>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onClose={() => setToastMessage(null)}
        />
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 1: PERMISOS POR ROL                                                  */}
      {/* ========================================================================= */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          {/* Sticky Toolbar for Permissions */}
          <div className="sticky top-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 space-y-3.5">
            
            {/* Top Control Line: Role selection + Unsaved badge + Primary Actions */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              
              {/* Left: Role Select & Live Status */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-52 sm:w-64">
                  <Select
                    value={selectedRoleId}
                    onChange={(event) => setSelectedRoleId(event.target.value)}
                    disabled={rolesLoading || savingPermissions}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        Rol: {role.nombre}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Status Chips */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span><strong>{permissionStats.grantedCount}</strong> de {permissionStats.total} asignados</span>
                  </span>

                  {hasUnsavedPermissions && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>Cambios pendientes</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Expand/Collapse & Save Button */}
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
                  <button
                    type="button"
                    onClick={() => toggleAllPermModules(true)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
                    title="Expandir todos los módulos"
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Expandir todo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllPermModules(false)}
                    className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
                    title="Colapsar todos los módulos"
                  >
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Colapsar todo</span>
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleConfirmSavePermissions()}
                  disabled={savingPermissions || permissionsLoading}
                  className="h-9 px-4 font-semibold shadow-sm"
                >
                  {savingPermissions ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  <span>Guardar permisos</span>
                </Button>
              </div>
            </div>

            {/* Bottom Controls Line: Filters + Global Mass Actions Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              
              {/* Search & Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 max-w-2xl">
                {/* Live Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar opción, ruta o key..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                  {permSearch && (
                    <button
                      onClick={() => setPermSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Module Dropdown */}
                <select
                  value={permModuleFilter}
                  onChange={(e) => setPermModuleFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="all">Todos los módulos</option>
                  {availableModules.map((m) => (
                    <option key={m} value={m}>
                      Módulo: {m}
                    </option>
                  ))}
                </select>

                {/* Status Dropdown */}
                <select
                  value={permStatusFilter}
                  onChange={(e) => setPermStatusFilter(e.target.value as PermissionFilterState)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="all">Cualquier estado</option>
                  <option value="granted">Con acceso asignado</option>
                  <option value="write">Solo Total (Lectura + Escritura)</option>
                  <option value="read">Solo Lectura</option>
                  <option value="none">Sin acceso</option>
                </select>
              </div>

              {/* Global Mass Selection Action Group */}
              <div className="flex items-center gap-2 self-start xl:self-auto">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Global:
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => handleGlobalMassPermission("READ")}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100/70 dark:text-blue-300 dark:hover:bg-blue-950/60 transition-colors"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Todo Lectura</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGlobalMassPermission("WRITE")}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100/70 dark:text-emerald-300 dark:hover:bg-emerald-950/60 transition-colors"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    <span>Todo Total</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGlobalMassPermission(null)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Limpiar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Module Accordions List */}
          {permissionsLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Cargando permisos del rol seleccionado...
              </p>
            </div>
          ) : groupedPermissionsByModule.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Filter className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                No se encontraron opciones con los filtros aplicados.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setPermSearch("");
                  setPermModuleFilter("all");
                  setPermStatusFilter("all");
                }}
              >
                Restablecer filtros
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedPermissionsByModule.map((group) => {
                const isExpanded = expandedPermModules[group.module] ?? true;
                const moduleGrantedCount = group.items.filter(
                  (it) => Boolean(permissionDraft[it.id])
                ).length;
                const allTotal = group.items.every(
                  (it) => permissionDraft[it.id] === "WRITE"
                );
                const allRead = group.items.every(
                  (it) => permissionDraft[it.id] === "READ"
                );
                const allNone = group.items.every(
                  (it) => !permissionDraft[it.id]
                );

                return (
                  <div
                    key={group.module}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900"
                  >
                    {/* Module Accordion Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-2.5 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800/80">
                      
                      {/* Left: Expand toggle + Module name + Count Badge */}
                      <button
                        type="button"
                        onClick={() => togglePermModule(group.module)}
                        className="flex items-center gap-2.5 text-left font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 group"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 shadow-2xs dark:bg-slate-700 dark:border-slate-600 group-hover:border-primary-400">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-primary-600" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-primary-600" />
                          )}
                        </div>

                        <span className="uppercase tracking-wider">
                          {group.module}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                            moduleGrantedCount > 0
                              ? "bg-primary-50 text-primary-700 border border-primary-200 dark:bg-primary-950/50 dark:text-primary-300 dark:border-primary-800"
                              : "bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                          }`}
                        >
                          {moduleGrantedCount} de {group.items.length} asignados
                        </span>
                      </button>

                      {/* Right: Module Mass Action Pill Buttons */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 hidden sm:inline mr-1">
                          Módulo:
                        </span>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => handleModuleMassPermission(group.items, "READ")}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                              allRead
                                ? "bg-blue-600 text-white"
                                : "text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                            }`}
                            title="Asignar solo lectura a todo este módulo"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Lectura</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleModuleMassPermission(group.items, "WRITE")}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                              allTotal
                                ? "bg-emerald-600 text-white"
                                : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            }`}
                            title="Asignar acceso total a todo este módulo"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            <span>Total</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleModuleMassPermission(group.items, null)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                              allNone
                                ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/60"
                            }`}
                            title="Quitar permisos de todo este módulo"
                          >
                            <X className="h-3 w-3" />
                            <span>Quitar</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Module Accordion Content */}
                    {isExpanded && (
                      <div className="p-1 sm:p-2">
                        {renderPermissionTree(group.tree)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ESTRUCTURA Y RUTAS DEL MENÚ (FORM + COMPACT PREVIEW)               */}
      {/* ========================================================================= */}
      {activeTab === "menu-structure" && (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr] items-start">
          {/* Left Column: Sticky Form */}
          <div className="lg:sticky lg:top-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingId ? "Editar opción de menú" : "Crear opción de menú"}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {editingId
                    ? "Modifica los atributos del elemento seleccionado."
                    : "Registra una nueva ruta en la plataforma."}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={resetForm} className="h-7 text-xs">
                {editingId ? "Cancelar" : "Limpiar"}
              </Button>
            </div>

            <div className="space-y-3">
              <Input
                label="Key única *"
                placeholder="ej: INVENTARIO_PRODUCTOS"
                value={menuForm.key}
                onChange={(event) =>
                  setMenuForm((prev) => ({ ...prev, key: event.target.value }))
                }
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Módulo *"
                  placeholder="ej: inventario"
                  value={menuForm.module}
                  onChange={(event) =>
                    setMenuForm((prev) => ({ ...prev, module: event.target.value }))
                  }
                  required
                />
                <Input
                  label="Etiqueta *"
                  placeholder="ej: Productos"
                  value={menuForm.label}
                  onChange={(event) =>
                    setMenuForm((prev) => ({ ...prev, label: event.target.value }))
                  }
                  required
                />
              </div>

              <Input
                label="Ruta *"
                placeholder="ej: /inventory/products"
                value={menuForm.route}
                onChange={(event) =>
                  setMenuForm((prev) => ({ ...prev, route: event.target.value }))
                }
                required
              />

              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
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
                      {option.label} ({option.name})
                    </option>
                  ))}
                </Select>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                  {SelectedIcon ? (
                    <SelectedIcon className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                  ) : (
                    <span className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Menú padre"
                  value={menuForm.parentId ?? ""}
                  onChange={(event) =>
                    setMenuForm((prev) => ({
                      ...prev,
                      parentId: event.target.value || null,
                    }))
                  }
                >
                  <option value="">(Raíz / Sin padre)</option>
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
              </div>

              <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
                    checked={menuForm.visible ?? true}
                    onChange={(event) =>
                      setMenuForm((prev) => ({
                        ...prev,
                        visible: event.target.checked,
                      }))
                    }
                  />
                  <span>Visible en la navegación</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
                    checked={menuForm.belowMainMenu ?? false}
                    onChange={(event) =>
                      setMenuForm((prev) => ({
                        ...prev,
                        belowMainMenu: event.target.checked,
                      }))
                    }
                  />
                  <span>Mostrar en sección inferior</span>
                </label>
              </div>

              <Button
                onClick={() => void handleConfirmSaveMenuItem()}
                variant="primary"
                disabled={menuLoading}
                className="w-full mt-2 font-semibold shadow-sm"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {editingId ? "Actualizar menú" : "Crear opción"}
              </Button>
            </div>
          </div>

          {/* Right Column: Compact Catalog & Preview */}
          <div className="space-y-4">
            {/* Filter Toolbar for Menu Preview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[200px] flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por etiqueta, ruta, key..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    {previewSearch && (
                      <button
                        onClick={() => setPreviewSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    value={previewModuleFilter}
                    onChange={(e) => setPreviewModuleFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <option value="all">Todos los módulos</option>
                    {availableModules.map((m) => (
                      <option key={m} value={m}>
                        Módulo: {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={previewVisibilityFilter}
                    onChange={(e) =>
                      setPreviewVisibilityFilter(e.target.value as "all" | "visible" | "hidden")
                    }
                    className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 px-2.5 text-xs text-slate-700 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <option value="all">Todas las visibilidades</option>
                    <option value="visible">Solo visibles</option>
                    <option value="hidden">Solo ocultos</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleAllPreviewModules(true)}
                    className="h-8 px-2 text-xs"
                    title="Expandir todo"
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleAllPreviewModules(false)}
                    className="h-8 px-2 text-xs"
                    title="Colapsar todo"
                  >
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={loadMenuItems}
                    disabled={menuLoading}
                    className="h-8 px-2.5 text-xs gap-1"
                  >
                    {menuLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    <span>Recargar</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Menu Items Accordion Groups */}
            {menuLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Cargando catálogo de menú...</p>
              </div>
            ) : groupedPreviewByModule.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <FolderTree className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  No hay opciones registradas con los filtros actuales.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedPreviewByModule.map((group) => {
                  const isExpanded = expandedPreviewModules[group.module] ?? true;

                  return (
                    <div
                      key={group.module}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900"
                    >
                      {/* Module Header */}
                      <div className="flex items-center justify-between bg-slate-50/80 px-4 py-2.5 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => togglePreviewModule(group.module)}
                          className="flex items-center gap-2.5 text-left font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 group"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white border border-slate-200 shadow-2xs dark:bg-slate-700 dark:border-slate-600 group-hover:border-primary-400">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-500 group-hover:text-primary-600" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-primary-600" />
                            )}
                          </div>
                          <span className="uppercase tracking-wider">{group.module}</span>
                          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {group.items.length} {group.items.length === 1 ? "opción" : "opciones"}
                          </span>
                        </button>
                      </div>

                      {/* Module Items Tree */}
                      {isExpanded && (
                        <div className="p-1 sm:p-2">
                          {renderPreviewTree(group.tree)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagementPage;
