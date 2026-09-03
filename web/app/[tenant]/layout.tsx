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
  Printer,
  Ruler,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Truck,
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
import { getAllowedMenuItems, hasPermission } from "../../lib/permissions";
import { getTenantConfig, getTenantDetails } from "../../domains/tenants/api";
import { setBranding } from "../../store/brandingSlice";
import { setCompanyDetails } from "../../store/companySlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAuthPermissions, setUser } from "../../store/authSlice";
import { setMenuCache, setMenuItems, setPermissions } from "../../store/menuSlice";
import { usePosUiStore } from "../../modules/pos/hooks/usePosUiStore";
import type { AuthProfile } from "../../domains/auth/types";
import type { MenuItem, MenuResponse } from "../../domains/menu/types";
import { Select } from "../../components/design-system/Select";
import { isConfirmCancelledError, useConfirm } from "../../hooks/use-confirm";
import { useTenantTheme } from "../../hooks/useTenantTheme";
import { getMenuItemStateStyles } from "../../src/lib/theme/buildTenantTheme";
import { useAutoClearState } from "../../lib/useAutoClearState";
import { Toast, type ToastVariant } from "../../components/design-system/Toast";
import { getCurrentCashSession } from "../../modules/finance/services/finance.service";
import type { CashSession } from "../../modules/finance/types";

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
  printer: Printer,
  grid3x3: Grid3X3,
  tags: Tags,
  truck: Truck,
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

const SIDEBAR_COLLAPSED_STORAGE_KEY = "flexibuild.sidebar.collapsed";
const SIDEBAR_MENU_STATE_STORAGE_KEY = "sidebar_open_menu_items";

const TenantLayout = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openMenuItems, setOpenMenuItems] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [layoutCashSession, setLayoutCashSession] = useState<CashSession | null>(null);
  const [cashSessionChecked, setCashSessionChecked] = useState(false);
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
  const tenantTheme = useTenantTheme();
  const company = useAppSelector((state) => state.company.details);
  const authUser = useAppSelector((state) => state.auth.user);
  const authStatus = useAppSelector((state) => state.auth.authStatus);
  const authToken = useAppSelector((state) => state.auth.accessToken);
  const bootstrapped = useAppSelector((state) => state.auth.bootstrapped);
  const permissionsLoaded = useAppSelector((state) => state.auth.permissionsLoaded);
  const menuItems = useAppSelector((state) => state.menu.menuItems);
  const permissions = useAppSelector((state) => state.menu.permissions);
  const posContext = useAppSelector((state) => state.pos);
  const { openCartSheet } = usePosUiStore();
  const posCartItemCount = useAppSelector((state) =>
    state.posCart.items.reduce((sum, item) => sum + item.quantity, 0)
  );
  const hasPendingPosSale = posCartItemCount > 0;
  const confirm = useConfirm();
  const sidebarCompanyName = company?.razonSocial || authUser?.tenantName || "Empresa";
  const brandingLogo = branding.logoUrl ?? branding.logo;
  const tenantSlug = authUser?.tenantId ?? "default";
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [posClock, setPosClock] = useState(() => new Date());
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
  const isPosRoute = useMemo(
    () => Boolean(pathname && /^\/[^/]+\/pos(?:\/|$)/i.test(pathname)),
    [pathname]
  );
  const posClockDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    []
  );
  const posClockTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );
  const posOperationalRole = authUser?.role ?? null;
  const posOperationalBranch = posContext.branchName ?? null;
  const posOperationalTerminal = posContext.terminalName ?? null;
  const hasPosOperationalContext = Boolean(
    posOperationalRole || posOperationalBranch || posOperationalTerminal || posContext.posSessionId
  );
  const posOperationalDate = posClockDateFormatter.format(posClock);
  const posOperationalTime = posClockTimeFormatter.format(posClock);
  const desktopSidebarWidthClass = sidebarCollapsed ? "lg:w-20 lg:px-3" : "lg:w-72 lg:px-4";
  const isSidebarCompact = sidebarCollapsed && !sidebarOpen;

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

  useEffect(() => {
    if (isPosRoute) {
      setSidebarCollapsed(true);
    }
  }, [isPosRoute]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setPosClock(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSidebarCollapsed(
      window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
    );

    const storedOpenMenuItems = window.localStorage.getItem(
      SIDEBAR_MENU_STATE_STORAGE_KEY
    );

    if (!storedOpenMenuItems) {
      return;
    }

    try {
      setOpenMenuItems(JSON.parse(storedOpenMenuItems) as Record<string, boolean>);
    } catch {
      window.localStorage.removeItem(SIDEBAR_MENU_STATE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      String(sidebarCollapsed)
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      SIDEBAR_MENU_STATE_STORAGE_KEY,
      JSON.stringify(openMenuItems)
    );
  }, [openMenuItems]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen]);

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

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setLayoutCashSession(null);
      setCashSessionChecked(false);
      return;
    }

    let active = true;

    const loadCashSession = async () => {
      setCashSessionChecked(false);
      try {
        const session = await getCurrentCashSession();
        if (active) {
          setLayoutCashSession(session);
        }
      } catch {
        if (active) {
          setLayoutCashSession(null);
        }
      } finally {
        if (active) {
          setCashSessionChecked(true);
        }
      }
    };

    void loadCashSession();
    window.addEventListener("manus:cash-session-changed", loadCashSession);

    return () => {
      active = false;
      window.removeEventListener("manus:cash-session-changed", loadCashSession);
    };
  }, [authStatus, authUser?.id, tenantSlug]);

  const isPosMenuItem = useCallback((item: MenuItem) => {
    const normalizedRoute = item.route.toLowerCase();
    const normalizedKey = item.key.toLowerCase();
    const normalizedLabel = item.label.toLowerCase();

    return (
      normalizedKey === "pos" ||
      normalizedLabel === "pos" ||
      normalizedRoute.endsWith("/pos")
    );
  }, []);

  const { menuSections, mainMenuSections } = useMemo(() => {
    const allowedItems = getAllowedMenuItems(menuItems);
    const rootItems = allowedItems.filter(
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
  }, [isDashboardItem, menuItems]);

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
    if (key.includes("domicilio") || key.includes("deliver")) {
      return Truck;
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
    <ul
      className={`mt-1.5 ${depth > 0 ? "ml-5 space-y-0.5 border-l pl-3" : "space-y-1"}`}
      style={depth > 0 ? { borderColor: tenantTheme.sidebar.border } : undefined}
    >
      {items.map((item) => {
        const Icon = getMenuIcon(item.label, item.module, item.icon);
        const isActive = pathname === item.route;
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const isExpanded = openMenuItems[item.id] ?? false;
        const posRequiresCash =
          isPosMenuItem(item) && cashSessionChecked && !layoutCashSession;
        const effectiveRoute = posRequiresCash
          ? `/${tenantSlug}/pos/select-context`
          : item.route;
        const activeChildChain = hasChildren
          ? getActiveMenuChain(item.children ?? [], pathname ?? "")
          : [];
        const hasActiveChild = activeChildChain.length > 0;
        const isDirectActive = isActive;
        const isContextOpen = hasChildren && (isExpanded || hasActiveChild);
        const isPromotedChildActive = depth > 0 && isDirectActive;
        const isVisuallyActive = isDirectActive || hasActiveChild;
        const menuItemStyles = getMenuItemStateStyles(tenantTheme, {
          depth,
          isActive: isDirectActive && !hasActiveChild,
          isOpen: isContextOpen,
          hasActiveChild,
          promoteActive: isPromotedChildActive,
        });
        return (
          <li key={item.key}>
            <div
              className={`group relative flex items-center gap-2 overflow-hidden transition-all duration-200 ${
                depth > 0
                  ? "rounded-lg text-[13px]"
                  : "rounded-xl px-3 py-2 text-sm"
              } ${
                isVisuallyActive
                  ? "bg-[var(--brand-sidebar-active)] text-[var(--brand-sidebar-active-text)] shadow-sm"
                  : "text-[var(--brand-sidebar-text)] hover:bg-[var(--brand-sidebar-hover)]"
              }`}
              style={menuItemStyles.container}
              title={isSidebarCompact ? item.label : undefined}
            >
              <span
                aria-hidden="true"
                className={`absolute left-0 w-0.5 rounded-r-full transition-all duration-200 group-hover:opacity-70 ${
                  depth > 0 ? "inset-y-1" : "inset-y-2"
                }`}
                style={menuItemStyles.indicator}
              />
              <Link
                href={effectiveRoute}
                aria-current={isDirectActive ? "page" : undefined}
                className={`relative z-10 flex flex-1 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-sidebar-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-sidebar-focus-offset)] ${
                  depth > 0 ? "gap-2 px-2 py-1.5 text-[13px] font-medium" : "gap-3 text-sm font-semibold"
                } ${
                  isSidebarCompact ? "justify-center" : ""
                }`}
                onClick={() => setSidebarOpen(false)}
                aria-label={
                  posRequiresCash
                    ? "POS requiere caja abierta"
                    : isSidebarCompact
                      ? item.label
                      : undefined
                }
              >
                {depth > 0 ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={menuItemStyles.icon}
                  />
                ) : (
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: String(menuItemStyles.icon.backgroundColor),
                    color: String(menuItemStyles.icon.color),
                  }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                )}
                {!isSidebarCompact ? (
                  <span className="flex min-w-0 flex-1 flex-col leading-5">
                    <span className="truncate">{item.label}</span>
                    {posRequiresCash ? (
                      <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] opacity-75">
                        Requiere caja
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </Link>
              {hasChildren ? (
                <button
                  type="button"
                  className={`relative z-10 rounded-md p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-sidebar-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-sidebar-focus-offset)] ${
                    isVisuallyActive
                      ? "text-[var(--brand-sidebar-active-text)] hover:bg-[var(--brand-sidebar-hover)]"
                      : "text-[var(--brand-sidebar-muted)] hover:bg-[var(--brand-sidebar-hover)] hover:text-[var(--brand-sidebar-text)]"
                  }`}
                  aria-label={isExpanded ? "Colapsar submenu" : "Expandir submenu"}
                  aria-expanded={isExpanded}
                  style={menuItemStyles.chevron}
                  title={
                    isSidebarCompact
                      ? `${isExpanded ? "Colapsar" : "Expandir"} ${item.label}`
                      : undefined
                  }
                  onClick={() =>
                    setOpenMenuItems((prev) => ({
                      ...prev,
                      [item.id]: !isExpanded,
                    }))
                  }
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : null}
            </div>
            {hasChildren && (isExpanded || hasActiveChild) && !isSidebarCompact
              ? renderMenuItems(item.children ?? [], depth + 1)
              : null}
          </li>
        );
      })}
    </ul>
  );

  const renderMenuSections = (sections: Record<string, MenuItem[]>, prefix: string) => (
    <ul className="space-y-2 text-sm">
      {Object.entries(sections).map(([section, items]) => {
        const sectionKey = `${prefix}:${section}`;
        const isExpanded = openSections[sectionKey] ?? true;
        return (
          <li
            key={sectionKey}
            className="border-t pt-2 first:border-t-0 first:pt-0"
            style={{ borderColor: tenantTheme.sidebar.border }}
          >
            {!isSidebarCompact ? (
              <p className="mb-2 mt-1 px-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--brand-sidebar-muted)] opacity-70">
                {section}
              </p>
            ) : null}
            {isExpanded ? renderMenuItems(items) : null}
          </li>
        );
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
    if (
      authUser?.tenantId &&
      tenantSlug !== authUser.tenantId &&
      authUser.role !== "SUPER_ADMIN"
    ) {
      router.replace(`/${authUser.tenantId}/unauthorized`);
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
  }, [
    authStatus,
    authUser?.role,
    authUser?.tenantId,
    pathname,
    permissionsLoaded,
    router,
    tenantSlug,
  ]);

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
              logoUrl: configResponse.config.logoUrl,
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
  const tenantMismatch =
    authStatus === "authenticated" &&
    Boolean(authUser?.tenantId) &&
    tenantSlug !== authUser?.tenantId &&
    authUser?.role !== "SUPER_ADMIN";
  if (tenantMismatch) {
    return null;
  }

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
      className="flex h-screen overflow-hidden overscroll-none bg-[var(--brand-background)] text-[var(--brand-text)]"
      style={{
        ["--brand-primary" as never]: tenantTheme.primary,
        ["--brand-primary-text" as never]: tenantTheme.primaryText,
        ["--brand-primary-soft" as never]: tenantTheme.primarySoftBg,
        ["--brand-primary-border" as never]: tenantTheme.primaryBorder,
        ["--brand-secondary" as never]: tenantTheme.secondary,
        ["--brand-secondary-text" as never]: tenantTheme.secondaryText,
        ["--brand-secondary-soft" as never]: tenantTheme.secondarySoftBg,
        ["--brand-secondary-border" as never]: tenantTheme.secondaryBorder,
        ["--brand-background" as never]: tenantTheme.surface.page,
        ["--brand-text" as never]: tenantTheme.surface.text,
        ["--brand-primary-hover" as never]: tenantTheme.header.actionHover,
        ["--brand-sidebar-bg" as never]: tenantTheme.sidebar.background,
        ["--brand-sidebar-text" as never]: tenantTheme.sidebar.text,
        ["--brand-sidebar-muted" as never]: tenantTheme.sidebar.mutedText,
        ["--brand-sidebar-active" as never]: tenantTheme.sidebar.activeBackground,
        ["--brand-sidebar-active-text" as never]: tenantTheme.sidebar.activeText,
        ["--brand-sidebar-open" as never]:
          tenantTheme.sidebar.openBackground,
        ["--brand-sidebar-open-text" as never]:
          tenantTheme.sidebar.openText,
        ["--brand-sidebar-open-indicator" as never]:
          tenantTheme.sidebar.openIndicator,
        ["--brand-sidebar-sub-active" as never]:
          tenantTheme.sidebar.subItemActiveBackground,
        ["--brand-sidebar-sub-active-text" as never]:
          tenantTheme.sidebar.subItemActiveText,
        ["--brand-sidebar-sub-indicator" as never]:
          tenantTheme.sidebar.subItemActiveIndicator,
        ["--brand-sidebar-hover" as never]: tenantTheme.sidebar.hoverBackground,
        ["--brand-sidebar-border" as never]: tenantTheme.sidebar.border,
        ["--brand-sidebar-accent" as never]: tenantTheme.sidebar.activeIndicator,
        ["--brand-sidebar-focus" as never]: tenantTheme.sidebar.focusRing,
        ["--brand-sidebar-focus-offset" as never]: tenantTheme.sidebar.focusRingOffset,
        ["--brand-header-bg" as never]: tenantTheme.header.background,
        ["--brand-header-text" as never]: tenantTheme.header.text,
        ["--brand-header-muted" as never]: tenantTheme.header.mutedText,
        ["--brand-header-border" as never]: tenantTheme.header.border,
        ["--brand-header-icon-bg" as never]: tenantTheme.header.iconButtonBackground,
        ["--brand-header-icon-border" as never]: tenantTheme.header.iconButtonBorder,
        ["--brand-header-icon-text" as never]: tenantTheme.header.iconButtonText,
        ["--brand-surface-card" as never]: tenantTheme.surface.card,
        ["--brand-surface-muted" as never]: tenantTheme.surface.mutedText,
        ["--brand-surface-border" as never]: tenantTheme.surface.border,
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        aria-label="Barra lateral de navegacion"
        className={`sidebar-scroll fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 transform flex-col overflow-y-auto overscroll-contain border-r border-white/10 px-4 py-4 shadow-2xl transition-all duration-300 lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 lg:px-4 ${desktopSidebarWidthClass} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: `linear-gradient(180deg, ${tenantTheme.sidebar.background}, ${tenantTheme.sidebar.border})`,
          borderColor: tenantTheme.sidebar.border,
          color: tenantTheme.sidebar.text,
        }}
      >
          <div className={`mb-5 flex items-center gap-3 ${isSidebarCompact ? "lg:justify-center" : ""}`}>
            <div className={`flex min-w-0 items-center gap-2.5 ${isSidebarCompact ? "lg:flex-col" : ""}`}>
              {brandingLogo ? (
                <img
                  src={brandingLogo}
                  alt="Logo empresa"
                  className="h-10 w-10 shrink-0 rounded-xl object-contain p-1"
                  style={{ backgroundColor: tenantTheme.sidebar.logoBackground }}
                />
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                  style={{
                    backgroundColor: tenantTheme.sidebar.logoBackground,
                    color: tenantTheme.sidebar.logoText,
                  }}
                >
                  {companyInitials}
                </div>
              )}
              {!isSidebarCompact ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-tight text-[var(--brand-sidebar-text)]">
                    {sidebarCompanyName}
                  </p>
                  <p className="truncate text-xs text-[var(--brand-sidebar-muted)]">
                    Manus POS
                  </p>
                </div>
              ) : null}
            </div>
            <div className={`ml-auto flex items-center gap-2 ${isSidebarCompact ? "lg:ml-0" : ""}`}>
              <button
                type="button"
                className="hidden h-8 w-8 place-items-center rounded-lg text-[var(--brand-sidebar-text)] transition hover:bg-[var(--brand-sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-sidebar-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-sidebar-focus-offset)] lg:grid"
                aria-label={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
                onClick={() => setSidebarCollapsed((prev) => !prev)}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5 rotate-180" />
                )}
              </button>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-lg text-[var(--brand-sidebar-text)] transition hover:bg-[var(--brand-sidebar-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-sidebar-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-sidebar-focus-offset)] lg:hidden"
                aria-label="Cerrar menu lateral"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <nav className="mt-4 flex-1 pb-2" aria-label="Navegacion principal">
            {renderMenuSections(menuSections, "primary")}
            {Object.keys(mainMenuSections).length > 0 ? (
              <>
                <div className="mt-4 px-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--brand-sidebar-muted)]">
                  Menu principal
                </div>
                <div className="mt-1.5">{renderMenuSections(mainMenuSections, "main")}</div>
              </>
            ) : null}
          </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header
            className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b bg-[var(--brand-header-bg)]/90 px-4 py-4 shadow-sm backdrop-blur-md md:px-6"
            style={{ borderColor: tenantTheme.header.border }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-lg border p-2 text-[var(--brand-header-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-header-bg)] lg:hidden"
                style={{
                  borderColor: tenantTheme.header.iconButtonBorder,
                  backgroundColor: tenantTheme.header.iconButtonBackground,
                  color: tenantTheme.header.iconButtonText,
                }}
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu lateral"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                {hasPosOperationalContext ? (
                  <div className="space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {posOperationalRole ? (
                        <span
                          className="inline-flex max-w-[7.5rem] items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brand-header-text)]"
                          style={{
                            borderColor: tenantTheme.header.iconButtonBorder,
                            backgroundColor: tenantTheme.header.iconButtonBackground,
                          }}
                          title={posOperationalRole}
                        >
                          <span className="truncate">{posOperationalRole}</span>
                        </span>
                      ) : null}
                      {posOperationalTerminal ? (
                        <span
                          className="inline-flex max-w-[10rem] items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-header-text)]"
                          style={{
                            borderColor: tenantTheme.header.iconButtonBorder,
                            backgroundColor: tenantTheme.header.iconButtonBackground,
                          }}
                          title={posOperationalTerminal}
                        >
                          <span className="truncate">{posOperationalTerminal}</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex max-w-[10rem] items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-header-muted)]"
                          style={{
                            borderColor: tenantTheme.header.iconButtonBorder,
                            backgroundColor: tenantTheme.header.iconButtonBackground,
                          }}
                        >
                          Terminal no disponible
                        </span>
                      )}
                      {posOperationalBranch ? (
                        <span
                          className="inline-flex max-w-[12rem] items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-header-text)]"
                          style={{
                            borderColor: tenantTheme.header.iconButtonBorder,
                            backgroundColor: tenantTheme.header.iconButtonBackground,
                          }}
                          title={posOperationalBranch}
                        >
                          <span className="truncate">{posOperationalBranch}</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--brand-header-muted)]">
                      {posOperationalDate} · {posOperationalTime}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--brand-header-muted)]">
                      Sistema
                    </p>
                    <h1 className="text-lg font-semibold text-[var(--brand-header-text)]">
                      Panel de control
                    </h1>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${tenantSlug}/dashboard`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-sidebar-active-text)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-header-bg)]"
                style={{
                  backgroundColor: tenantTheme.header.actionBackground,
                  color: tenantTheme.header.actionText,
                }}
                aria-label="Ir al dashboard"
              >
                <LayoutDashboard className="h-4 w-4" />
              </Link>
              <button
                type="button"
                className="relative rounded-lg border p-2 text-[var(--brand-header-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-header-bg)]"
                style={{
                  borderColor: tenantTheme.header.iconButtonBorder,
                  backgroundColor: tenantTheme.header.iconButtonBackground,
                  color: tenantTheme.header.iconButtonText,
                }}
                aria-label="Ver notificaciones"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
              </button>
              <button
                type="button"
                className="rounded-lg border p-2 text-[var(--brand-header-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-header-bg)]"
                style={{
                  borderColor: tenantTheme.header.iconButtonBorder,
                  backgroundColor: tenantTheme.header.iconButtonBackground,
                  color: tenantTheme.header.iconButtonText,
                }}
                aria-label="Mensajes"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              {hasPendingPosSale ? (
                isPosRoute ? (
                  <button
                    type="button"
                    className="relative inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
                    aria-label={`Abrir carrito con ${posCartItemCount} items pendientes`}
                    title={`Venta POS pendiente: ${posCartItemCount} items`}
                    onClick={() => openCartSheet()}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span className="absolute -right-2 -top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold leading-none text-white">
                      {posCartItemCount}
                    </span>
                  </button>
                ) : (
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
                )
              ) : null}
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm text-[var(--brand-header-text)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-header-bg)]"
                  style={{
                    borderColor: tenantTheme.header.iconButtonBorder,
                    backgroundColor: tenantTheme.header.iconButtonBackground,
                    color: tenantTheme.header.iconButtonText,
                  }}
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="Abrir menu de usuario"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="max-w-[160px] truncate">
                    {authUser?.name || "Usuario"}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {userMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-lg border bg-white py-2 text-sm text-slate-700 shadow-lg"
                    style={{ borderColor: tenantTheme.header.border }}
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
                className="rounded-full border p-2 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-header-bg)]"
                style={{
                  borderColor: tenantTheme.header.iconButtonBorder,
                  backgroundColor: tenantTheme.header.iconButtonBackground,
                  color: tenantTheme.header.iconButtonText,
                }}
                aria-label="Cerrar sesion"
                onClick={() => logout()}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </header>
          <main
            id="contenido-principal"
            className="flex-1 overflow-y-auto overscroll-contain"
          >
            <div className="min-h-full px-4 py-6 md:px-6 lg:px-8">
              {children}
            </div>
            <footer
              className="border-t px-4 py-4 text-sm md:px-6"
              style={{
                borderColor: tenantTheme.surface.border,
                backgroundColor: tenantTheme.surface.card,
                color: tenantTheme.surface.mutedText,
              }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold" style={{ color: tenantTheme.surface.text }}>
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
        </div>
      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
    </div>
  );
};

export default TenantLayout;
