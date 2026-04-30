"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  FileText,
  Grid3X3,
  IdCard,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Monitor,
  Package,
  Ruler,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { fetchMenu, fetchProfile, logout, updatePassword, updateProfile } from "../../domains/auth/api";
import { fetchPermissions } from "../../domains/menu/api";
import { persistMenuCache, readMenuCache } from "../../domains/auth/menu-cache";
import { MENU_KEYS } from "../../domains/menu/constants";
import { getRoutePermissionRequirement } from "../../lib/route-permissions";
import { hasPermission } from "../../lib/permissions";
import { getTenantConfig, getTenantDetails } from "../../domains/tenants/api";
import { setBranding } from "../../store/brandingSlice";
import { setCompanyDetails } from "../../store/companySlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAuthPermissions, setUser } from "../../store/authSlice";
import { setMenuCache, setMenuItems, setPermissions } from "../../store/menuSlice";
import type { AuthProfile } from "../../domains/auth/types";
import type { MenuItem, MenuResponse } from "../../domains/menu/types";
import { Select } from "../../components/design-system/Select";
import { isConfirmCancelledError, useConfirm } from "../../hooks/use-confirm";
import { useAutoClearState } from "../../lib/useAutoClearState";
import { Toast, type ToastVariant } from "../../components/design-system/Toast";

const normalizeIconName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const iconByName: Record<string, LucideIcon> = {
  menu: Menu,
  layoutdashboard: LayoutDashboard,
  settings: Settings,
  user: User,
  users: Users,
  usercheck: UserCheck,
  userplus: UserPlus,
  idcard: IdCard,
  shieldcheck: ShieldCheck,
  keyround: KeyRound,
  building2: Building2,
  building: Building,
  store: Store,
  package: Package,
  grid3x3: Grid3X3,
  tags: Tags,
  calculator: Calculator,
  ruler: Ruler,
  shoppingcart: ShoppingCart,
  barchart3: BarChart3,
  archive: Archive,
  arrowupdown: ArrowUpDown,
  filetext: FileText,
  calendar: Calendar,
  chevrondown: ChevronDown,
  chevronright: ChevronRight,
  wrench: Wrench,
  activity: Activity,
  alertcircle: AlertCircle,
  loader2: Loader2,
  bell: Bell,
  messagecircle: MessageCircle,
  monitor: Monitor,
  logout: LogOut,
  x: X,
};

const TenantLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openMenuItems, setOpenMenuItems] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    nombres: "",
    apellidos: "",
    documentoTipo: "",
    documentoNumero: "",
    telefono: "",
    direccion: "",
    emailPersonal: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const dispatch = useAppDispatch();
  const branding = useAppSelector((state) => state.branding.config);
  const company = useAppSelector((state) => state.company.details);
  const authUser = useAppSelector((state) => state.auth.user);
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const authToken = useAppSelector((state) => state.auth.accessToken);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const menuItems = useAppSelector((state) => state.menu.menuItems);
  const permissions = useAppSelector((state) => state.menu.permissions);
  const posCartItemCount = useAppSelector((state) =>
    state.posCart.items.reduce((sum, item) => sum + item.quantity, 0)
  );
  const hasPendingPosSale = posCartItemCount > 0;
  const confirm = useConfirm();
  const sidebarCompanyName = company?.razonSocial || authUser?.tenantName || "Empresa";
  const tenantSlug = authUser?.tenantId ?? "default";
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const companyInitials = useMemo(() => {
    const name = sidebarCompanyName.trim();
    if (!name) return "";
    const parts = name.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [sidebarCompanyName]);
  const isPosContextRoute = useMemo(
    () => Boolean(pathname && /^\/[^/]+\/pos\/select-context\/?$/i.test(pathname)),
    [pathname]
  );

  const applyTenantToMenu = useCallback(
    (items: MenuResponse["items"], tenant: string): MenuResponse["items"] =>
      items.map((item) => ({
        ...item,
        route: item.route.replace("{tenant}", tenant),
        children: item.children ? applyTenantToMenu(item.children, tenant) : undefined,
      })),
    []
  );

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const buildAuthHeaders = () => {
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
  };

  const applyProfile = useCallback(
    (profile: AuthProfile) => {
    const fullName = [profile.persona?.nombres, profile.persona?.apellidos]
      .filter(Boolean)
      .join(" ");
    const nextUser = {
      id: profile.id,
      name: fullName || profile.email,
      email: profile.email,
      role: profile.role?.nombre ?? authUser?.role ?? "",
      tenantId: profile.tenant.id,
      tenantName: profile.tenant.nombre,
      branchId: profile.branch?.id ?? null,
      branchName: profile.branch?.nombre ?? null,
      persona: profile.persona,
    };
    dispatch(setUser(nextUser));
    },
    [authUser?.role, dispatch]
  );

  const openProfileModal = () => {
    const persona = authUser?.persona;
    setProfileForm({
      nombres: persona?.nombres ?? "",
      apellidos: persona?.apellidos ?? "",
      documentoTipo: persona?.documentoTipo ?? "",
      documentoNumero: persona?.documentoNumero ?? "",
      telefono: persona?.telefono ?? "",
      direccion: persona?.direccion ?? "",
      emailPersonal: persona?.emailPersonal ?? "",
    });
    setProfileError(null);
    setProfileModalOpen(true);
  };

  const openPasswordModal = () => {
    setPasswordForm({ password: "", confirmPassword: "" });
    setPasswordError(null);
    setPasswordModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileForm.nombres.trim() || !profileForm.apellidos.trim()) {
      setProfileError("Nombres y apellidos son requeridos.");
      return;
    }
    if (!profileForm.documentoTipo.trim() || !profileForm.documentoNumero.trim()) {
      setProfileError("Tipo y número de documento son requeridos.");
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateProfile(
        {
          persona: {
            nombres: profileForm.nombres.trim(),
            apellidos: profileForm.apellidos.trim(),
            documentoTipo: profileForm.documentoTipo.trim(),
            documentoNumero: profileForm.documentoNumero.trim(),
            telefono: profileForm.telefono.trim() || null,
            direccion: profileForm.direccion.trim() || null,
            emailPersonal: profileForm.emailPersonal.trim() || null,
          },
        },
        buildAuthHeaders()
      );
      const profile = await fetchProfile();
      applyProfile(profile);
      setProfileModalOpen(false);
    } catch {
      setProfileError("No se pudo actualizar la informacion.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (passwordForm.password.length < 8) {
      setPasswordError("La contraseña debe tener minimo 8 caracteres.");
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await updatePassword(passwordForm.password, buildAuthHeaders());
      setPasswordModalOpen(false);
      showToast("Contraseña actualizada correctamente.", "success");
    } catch {
      setPasswordError("No se pudo actualizar la contraseña.");
      showToast("No se pudo actualizar la contraseña.", "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleConfirmSaveProfile = async () => {
    if (
      !profileForm.nombres.trim() ||
      !profileForm.apellidos.trim() ||
      !profileForm.documentoTipo.trim() ||
      !profileForm.documentoNumero.trim()
    ) {
      await handleSaveProfile();
      return;
    }

    try {
      await confirm({
        title: "¿Confirmas actualizar la información?",
        description:
          "Se actualizarán tus datos personales en el perfil actual.",
        confirmText: "Guardar cambios",
        variant: "default",
      });
      await handleSaveProfile();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const handleConfirmSavePassword = async () => {
    if (
      passwordForm.password.length < 8 ||
      passwordForm.password !== passwordForm.confirmPassword
    ) {
      await handleSavePassword();
      return;
    }

    try {
      await confirm({
        title: "¿Confirmas actualizar la información?",
        description:
          "Tu contraseña se actualizará y deberás usar la nueva en los próximos accesos.",
        confirmText: "Actualizar contraseña",
        variant: "default",
      });
      await handleSavePassword();
    } catch (error) {
      if (!isConfirmCancelledError(error)) {
        throw error;
      }
    }
  };

  const isDashboardItem = useCallback((label: string, route: string) => {
    const targetLabel = label.toLowerCase();
    const targetRoute = route.toLowerCase();
    return targetLabel.includes("dashboard") || targetRoute.includes("/dashboard");
  }, []);

  const menuItemsWithTerminalShortcut = useMemo(() => {
    const isSuperRole =
      authUser?.role === "SUPER_ADMIN" || authUser?.role === "SUPER_USER";
    if (!isSuperRole || !hasPermission(MENU_KEYS.CONFIG_GENERAL, "read")) {
      return menuItems;
    }

    const shortcutRoute = `/${tenantSlug}/config/terminals`;
    const configRoute = `/${tenantSlug}/configuracion`;

    const routeExists = (items: MenuItem[]): boolean =>
      items.some(
        (item) =>
          item.route === shortcutRoute || routeExists(item.children ?? [])
      );

    if (routeExists(menuItems)) {
      return menuItems;
    }

    const appendShortcut = (items: MenuItem[]): MenuItem[] =>
      items.map((item) => {
        const nextChildren = appendShortcut(item.children ?? []);
        if (item.route !== configRoute) {
          return nextChildren === item.children
            ? item
            : { ...item, children: nextChildren };
        }

        return {
          ...item,
          children: [
            ...nextChildren,
            {
              id: "local-config-terminals",
              key: "CONFIG_GENERAL_TERMINALS",
              module: item.module,
              label: "Terminales",
              route: shortcutRoute,
              icon: "Monitor",
              parentId: item.id,
              sortOrder: Number(item.sortOrder ?? 0) + 100,
              visible: true,
              belowMainMenu: item.belowMainMenu,
              metadata: {},
              accessLevel: "READ",
              children: [],
            },
          ],
        };
      });

    return appendShortcut(menuItems);
  }, [authUser?.role, menuItems, tenantSlug]);

  const { menuSections, mainMenuSections } = useMemo(() => {
    const rootItems = menuItemsWithTerminalShortcut.filter(
      (item) => item.visible && !isDashboardItem(item.label, item.route)
    );
    const groupByModule = (items: MenuItem[]) =>
      items.reduce<Record<string, MenuItem[]>>((acc, item) => {
        const section = item.module?.trim() || "General";
        if (!acc[section]) {
          acc[section] = [];
        }
        acc[section].push(item);
        return acc;
      }, {});
    const primaryItems = rootItems.filter((item) => !item.belowMainMenu);
    const mainMenuItems = rootItems.filter((item) => item.belowMainMenu);
    return {
      menuSections: groupByModule(primaryItems),
      mainMenuSections: groupByModule(mainMenuItems),
    };
  }, [isDashboardItem, menuItemsWithTerminalShortcut]);

  const getMenuIcon = (label: string, module: string, iconName?: string | null) => {
    if (iconName?.trim()) {
      const normalized = normalizeIconName(iconName);
      const explicitIcon = iconByName[normalized];
      if (explicitIcon) {
        return explicitIcon;
      }
    }
    const key = `${module} ${label}`.toLowerCase();
    if (key.includes("dashboard") || key.includes("inicio")) {
      return LayoutDashboard;
    }
    if (key.includes("usuario") || key.includes("perfil")) {
      return User;
    }
    if (key.includes("seguridad") || key.includes("contraseña")) {
      return ShieldCheck;
    }
    if (key.includes("rol") || key.includes("permiso")) {
      return KeyRound;
    }
    if (key.includes("config")) {
      return Settings;
    }
    return LayoutDashboard;
  };

  const getActiveMenuChain = useCallback((items: MenuItem[], currentPath: string) => {
    const normalize = (value: string) => value.replace(/\/+$/, "") || "/";
    const targetPath = normalize(currentPath);
    const matchesRoute = (route: string) => {
      const normalizedRoute = normalize(route);
      return targetPath === normalizedRoute || targetPath.startsWith(`${normalizedRoute}/`);
    };
    const walk = (list: MenuItem[]): string[] | null => {
      for (const item of list) {
        if (matchesRoute(item.route)) {
          return [item.id];
        }
        if (item.children?.length) {
          const childChain = walk(item.children);
          if (childChain) {
            return [item.id, ...childChain];
          }
        }
      }
      return null;
    };
    return walk(items) ?? [];
  }, []);

  const renderMenuItems = (items: MenuItem[], depth = 0) => (
    <ul className={`mt-2 space-y-1 ${depth > 0 ? "pl-4" : ""}`}>
      {items.map((item) => {
        const Icon = getMenuIcon(item.label, item.module, item.icon);
        const isActive = pathname === item.route;
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const isExpanded = openMenuItems[item.id] ?? false;
        return (
          <li key={item.key}>
            <div
              className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-white/90 transition hover:bg-white/10 ${
                isActive ? "bg-white/15 text-white" : ""
              }`}
            >
              <Link
                href={item.route}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-1 items-center gap-3"
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
              {hasChildren ? (
                <button
                  type="button"
                  className="rounded p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label={isExpanded ? "Colapsar submenu" : "Expandir submenu"}
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setOpenMenuItems((prev) => ({
                      ...prev,
                      [item.id]: !isExpanded,
                    }))
                  }
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : null}
            </div>
            {hasChildren && isExpanded ? renderMenuItems(item.children ?? [], depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  const renderMenuSections = (sections: Record<string, MenuItem[]>, prefix: string) => (
    <ul className="space-y-3 text-sm">
      {Object.entries(sections).map(([section, items]) => {
        const sectionKey = `${prefix}:${section}`;
        const isExpanded = openSections[sectionKey] ?? true;
        return <li key={sectionKey}>{isExpanded ? renderMenuItems(items) : null}</li>;
      })}
    </ul>
  );

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }
    if (authStatus !== "authenticated") {
      if (authStatus !== "refreshing") {
        router.replace("/login");
      }
      return;
    }
    setReady(true);
  }, [authStatus, bootstrapped, router]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !authToken) {
      return;
    }
    const shouldLoadProfile =
      !authUser?.name || !authUser?.email || !authUser?.tenantName;
    if (shouldLoadProfile) {
      void (async () => {
        try {
          const profile = await fetchProfile();
          applyProfile(profile);
        } catch {
          // ignore profile fetch failures
        }
      })();
    }
  }, [authStatus, authToken, authUser, applyProfile]);

  useEffect(() => {
    if (!pathname || menuItems.length === 0) {
      return;
    }
    const activeChain = getActiveMenuChain(menuItems, pathname);
    if (activeChain.length === 0) {
      return;
    }
    setOpenMenuItems((prev) => {
      const next = { ...prev };
      activeChain.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  }, [getActiveMenuChain, menuItems, pathname]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !authToken) {
      return;
    }
    if (menuItems.length > 0 && permissions.length > 0) {
      return;
    }
    void (async () => {
      try {
        const cachedMenu = await readMenuCache(authToken, tenantSlug);
        if (cachedMenu) {
          const resolvedMenu = applyTenantToMenu(cachedMenu, tenantSlug);
          dispatch(
            setMenuCache({
              tenantId: tenantSlug,
              cachedAt: Date.now(),
              items: resolvedMenu,
            })
          );
          dispatch(setMenuItems(resolvedMenu));
          try {
            const permissionResponse = await fetchPermissions();
            dispatch(setPermissions(permissionResponse.items));
            dispatch(setAuthPermissions(permissionResponse.items));
          } catch {
            dispatch(setPermissions([]));
            dispatch(setAuthPermissions([]));
          }
        } else {
          const [menu, permissionResponse] = await Promise.all([
            fetchMenu(),
            fetchPermissions(),
          ]);
          const resolvedMenu = applyTenantToMenu(menu.items, tenantSlug);
          dispatch(
            setMenuCache({
              tenantId: tenantSlug,
              cachedAt: Date.now(),
              items: resolvedMenu,
            })
          );
          dispatch(setMenuItems(resolvedMenu));
          dispatch(setPermissions(permissionResponse.items));
          dispatch(setAuthPermissions(permissionResponse.items));
          await persistMenuCache(authToken, tenantSlug, menu.items);
        }
      } catch {
        dispatch(setMenuItems([]));
        dispatch(setPermissions([]));
        dispatch(setAuthPermissions([]));
      }
    })();
  }, [
    authStatus,
    authToken,
    applyTenantToMenu,
    dispatch,
    menuItems.length,
    permissions.length,
    tenantSlug,
  ]);

  useEffect(() => {
    if (!pathname || authStatus !== "authenticated" || !permissionsLoaded) {
      return;
    }

    const requirement = getRoutePermissionRequirement(pathname);
    if (!requirement) {
      return;
    }

    const allowed = hasPermission(requirement.module, requirement.action);
    const unauthorizedPath = `/${tenantSlug}/unauthorized`;
    if (!allowed && pathname !== unauthorizedPath) {
      router.replace(unauthorizedPath);
    }
  }, [authStatus, pathname, permissionsLoaded, router, tenantSlug]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }
    void (async () => {
      try {
        const tenantId = tenantSlug ?? authUser?.tenantId ?? "";
        if (!tenantId) {
          return;
        }
        const [configResult, detailsResult] = await Promise.allSettled([
          getTenantConfig(tenantId),
          getTenantDetails(tenantId),
        ]);
        if (detailsResult.status === "fulfilled" && detailsResult?.value) {
          const detailsResponse = detailsResult?.value;
          dispatch(
            setCompanyDetails({
              razonSocial: detailsResponse.razon_social,
              nit: detailsResponse.nit,
              dv: detailsResponse.dv,
              tipoPersona: detailsResponse.tipo_persona,
              tipoSociedad: detailsResponse.tipo_sociedad,
              fechaConstitucion: detailsResponse.fecha_constitucion,
              estado: detailsResponse.estado,
              responsabilidadesDian: detailsResponse.responsabilidades_dian,
              regimen: detailsResponse.regimen,
              actividadEconomica: detailsResponse.actividad_economica,
              obligadoFacturacionElectronica:
                detailsResponse.obligado_facturacion_electronica,
              resolucionDian: detailsResponse.resolucion_dian,
              fechaInicioFacturacion: detailsResponse.fecha_inicio_facturacion,
              direccionPrincipal: detailsResponse.direccion_principal,
              paisId: detailsResponse.pais_id ?? "",
              departamentoId: detailsResponse.departamento_id ?? "",
              municipioId: detailsResponse.municipio_id ?? "",
              ciudad: detailsResponse.ciudad,
              departamento: detailsResponse.departamento,
              pais: detailsResponse.pais,
              telefono: detailsResponse.telefono,
              emailCorporativo: detailsResponse.email_corporativo,
              sitioWeb: detailsResponse.sitio_web,
              representanteNombre: detailsResponse.representante_nombre,
              representanteTipoDocumento: detailsResponse.representante_tipo_documento,
              representanteNumeroDocumento:
                detailsResponse.representante_numero_documento,
              representanteEmail: detailsResponse.representante_email,
              representanteTelefono: detailsResponse.representante_telefono,
              cuentaContableDefecto: detailsResponse.cuenta_contable_defecto,
              bancoPrincipal: detailsResponse.banco_principal,
              numeroCuenta: detailsResponse.numero_cuenta,
              tipoCuenta: detailsResponse.tipo_cuenta,
            })
          );
        }
        if (configResult.status === "fulfilled" && configResult.value?.config) {
          const configResponse = configResult.value;
          dispatch(
            setBranding({
              colors: {
                primary: configResponse.config.colors.primary,
                secondary: configResponse.config.colors.secondary ?? "#0F172A",
                background: configResponse.config.colors.background ?? "#F8FAFC",
                text: configResponse.config.colors.text ?? "#0F172A",
              },
              font: configResponse.config.font ?? "Inter, system-ui, sans-serif",
              logo: configResponse.config.logo,
              spacing: {
                sm: configResponse.config.spacing?.sm ?? "8px",
                md: configResponse.config.spacing?.md ?? "16px",
                lg: configResponse.config.spacing?.lg ?? "24px",
              },
            })
          );
        }
      } catch {
        // ignore for now
      }
    })();
  }, [authStatus, authUser?.tenantId, dispatch, tenantSlug]);

  if (!ready) {
    return null;
  }

  if (authStatus === "authenticated" && !permissionsLoaded && !isPosContextRoute) {
    return null;
  }

  const routeRequirement = pathname ? getRoutePermissionRequirement(pathname) : null;
  if (
    authStatus === "authenticated" &&
    permissionsLoaded &&
    routeRequirement &&
    !hasPermission(routeRequirement.module, routeRequirement.action)
  ) {
    return null;
  }

  return (
    <div
      className="min-h-screen bg-[var(--brand-background)] text-[var(--brand-text)]"
      style={{
        ["--brand-primary" as never]: branding.colors.primary,
        ["--brand-secondary" as never]: branding.colors.secondary,
        ["--brand-background" as never]: branding.colors.background,
        ["--brand-text" as never]: branding.colors.text,
        ["--brand-spacing-sm" as never]: branding.spacing.sm,
        ["--brand-spacing-md" as never]: branding.spacing.md,
        ["--brand-spacing-lg" as never]: branding.spacing.lg,
        fontFamily: branding.font,
      }}
    >
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900"
      >
        Saltar al contenido principal
      </a>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="lg:grid lg:grid-cols-[280px_1fr]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-slate-900 px-6 py-8 text-white transition lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            background: `linear-gradient(180deg, ${branding.colors.secondary}, #0B1220)`,
          }}
        >
          <div className="flex items-center justify-between lg:justify-start">
            <div className="flex items-center gap-3">
              {branding.logo ? (
                <img
                  src={branding.logo}
                  alt="Logo empresa"
                  className="h-10 w-10 rounded-full bg-white object-contain"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900">
                  {companyInitials}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-white">{sidebarCompanyName}</p>
              </div>
            </div>
            <button
              type="button"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-8" aria-label="Navegacion principal">
            {renderMenuSections(menuSections, "primary")}
            {Object.keys(mainMenuSections).length > 0 ? (
              <>
                <div className="mt-10 text-xs uppercase tracking-widest text-white/40">
                  Menu principal
                </div>
                <div className="mt-3">{renderMenuSections(mainMenuSections, "main")}</div>
              </>
            ) : null}
          </nav>
        </aside>
        <div className="flex min-h-screen flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 py-4 shadow-sm backdrop-blur md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Sistema
                </p>
                <h1 className="text-lg font-semibold text-slate-900">
                  Panel de control
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${tenantSlug}/dashboard`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
              <button
                type="button"
                className="relative rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                aria-label="Ver notificaciones"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                aria-label="Mensajes"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              {hasPendingPosSale ? (
                <Link
                  href={`/${tenantSlug}/pos`}
                  className="relative inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
                  aria-label={`Volver al POS con ${posCartItemCount} items pendientes`}
                  title={`Venta POS pendiente: ${posCartItemCount} items`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-none text-white">
                    {posCartItemCount}
                  </span>
                </Link>
              ) : null}
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-50"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="max-w-[160px] truncate">
                    {authUser?.name || "Usuario"}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-2 text-sm text-slate-700 shadow-lg"
                    role="menu"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-slate-50"
                      onClick={() => {
                        setUserMenuOpen(false);
                        openProfileModal();
                      }}
                    >
                      <User className="h-4 w-4" />
                      Editar datos personales
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-slate-50"
                      onClick={() => {
                        setUserMenuOpen(false);
                        openPasswordModal();
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                      Cambiar contraseña
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                aria-label="Cerrar sesion"
                onClick={() => logout()}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>
          <main
            id="contenido-principal"
            className="flex-1 px-4 py-6 md:px-6 lg:px-8"
          >
            {children}
          </main>
          {profileModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
              <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Editar datos personales
                  </h2>
                  <button
                    type="button"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Cerrar"
                    onClick={() => setProfileModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Nombres
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={profileForm.nombres}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          nombres: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Apellidos
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={profileForm.apellidos}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          apellidos: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <Select
                    label="Tipo de documento"
                    required
                    value={profileForm.documentoTipo}
                    onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          documentoTipo: event.target.value,
                        }))
                      }
                  >
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="NIT">NIT</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </Select>
                  <label className="text-sm text-slate-600">
                    Numero de documento
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={profileForm.documentoNumero}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          documentoNumero: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Telefono
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={profileForm.telefono}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          telefono: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Direccion
                    <input
                      type="text"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={profileForm.direccion}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          direccion: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-600 sm:col-span-2">
                    Email personal
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={profileForm.emailPersonal}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          emailPersonal: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                {profileError && (
                  <p className="mt-3 text-sm text-rose-600">{profileError}</p>
                )}
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
                    onClick={() => setProfileModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-70"
                    onClick={() => void handleConfirmSaveProfile()}
                    disabled={profileSaving}
                  >
                    {profileSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {passwordModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Cambiar contraseña
                  </h2>
                  <button
                    type="button"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Cerrar"
                    onClick={() => setPasswordModalOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="text-sm text-slate-600">
                    Nueva contraseña
                    <input
                      type="password"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={passwordForm.password}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Confirmar contraseña
                    <input
                      type="password"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                {passwordError && (
                  <p className="mt-3 text-sm text-rose-600">{passwordError}</p>
                )}
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
                    onClick={() => setPasswordModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-70"
                    onClick={() => void handleConfirmSavePassword()}
                    disabled={passwordSaving}
                  >
                    {passwordSaving ? "Guardando..." : "Actualizar contraseña"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <footer className="border-t border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-slate-800">
                  {company?.razonSocial || authUser?.tenantName || "Empresa"}
                </p>
                <p>
                  {company?.nit ? `NIT ${company.nit}${company.dv ? `-${company.dv}` : ""}` : "Gestion administrativa y operativa."}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-slate-500">
                {company?.emailCorporativo && (
                  <span>{company.emailCorporativo}</span>
                )}
                {company?.sitioWeb && <span>{company.sitioWeb}</span>}
                {company?.telefono && <span>{company.telefono}</span>}
              </div>
            </div>
          </footer>
        </div>
      </div>
      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
    </div>
  );
};

export default TenantLayout;
