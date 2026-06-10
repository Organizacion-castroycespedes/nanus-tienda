"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CreditCard,
  MapPinned,
  PackageCheck,
  PackageX,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Store,
  Tags,
  TrendingUp,
} from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { useAppSelector } from "../../../store/hooks";
import {
  getInventoryDashboard,
  type InventoryDashboardCashSessionOption,
  type InventoryDashboardFilterOption,
  type InventoryDashboardResponse,
} from "../services/dashboard.service";
import {
  getLotReconciliationDiscrepancies,
  getLotReconciliationSummary,
  listInventoryLotBalances,
  listInventoryLots,
  type InventoryLotBalanceResponse,
  type InventoryLotDiscrepancy,
  type InventoryLotReconciliationSummary,
  type InventoryLotResponse,
} from "../services/inventory-lot.service";

type DashboardFilters = {
  tenantId: string;
  branchId: string;
  terminalId: string;
  cashSessionId: string;
  startDate: string;
  endDate: string;
};

const today = new Date().toISOString().slice(0, 10);

const toDateOnly = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const daysUntil = (value: string | null | undefined) => {
  const target = toDateOnly(value);
  if (!target) {
    return null;
  }

  const current = new Date();
  current.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - current.getTime()) / 86_400_000);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "Sin registro";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getRoleConfig = (role: string) => ({
  canSelectTenant: role === "SUPER_ADMIN",
  canSelectBranch: role === "SUPER_ADMIN" || role === "SUPER_USER",
  canSelectTerminal: role !== "USER",
  canSelectCashSession: role !== "USER",
});

const getStatusClassName = (status: string) => {
  const normalized = status.toUpperCase();

  if (["RECEIVED", "COMPLETED", "PAID", "OPEN"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (["PARTIAL", "PENDING", "CONFIRMED", "DRAFT"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (["CANCELLED", "CLOSED"].includes(normalized)) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
};

const KpiCard = ({
  title,
  value,
  description,
  icon: Icon,
  tone = "slate",
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Boxes;
  tone?: "slate" | "emerald" | "amber" | "rose" | "blue";
}) => {
  const toneClassName = {
    slate: "from-slate-900 to-slate-700 text-white",
    emerald: "from-emerald-600 to-emerald-500 text-white",
    amber: "from-amber-500 to-amber-400 text-slate-950",
    rose: "from-rose-600 to-rose-500 text-white",
    blue: "from-sky-600 to-blue-500 text-white",
  }[tone];

  return (
    <article className={`rounded-3xl bg-gradient-to-br p-5 shadow-sm ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">{title}</p>
          <p className="mt-3 text-2xl font-semibold">{value}</p>
          <p className="mt-2 text-sm opacity-80">{description}</p>
        </div>
        <div className="rounded-2xl bg-white/15 p-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
};

const InventoryAlertCard = ({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Boxes;
  tone: string;
}) => (
  <article className={`rounded-2xl border px-4 py-4 shadow-sm ${tone}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide opacity-75">{title}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs opacity-75">{description}</p>
      </div>
      <Icon className="h-5 w-5 opacity-70" />
    </div>
  </article>
);

const ChartCard = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
    {children}
  </section>
);

const EmptyPanel = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

const SkeletonBlock = ({ className }: { className: string }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200 ${className}`} />
);

const DashboardTableSection = ({
  title,
  subtitle,
  emptyMessage,
  children,
}: {
  title: string;
  subtitle: string;
  emptyMessage: string;
  children: ReactNode;
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
    {children || <EmptyPanel message={emptyMessage} />}
  </section>
);

export const InventoryDashboard = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const authRole = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "");
  const pos = useAppSelector((state) => state.pos);
  const roleConfig = getRoleConfig(authRole);

  const [filters, setFilters] = useState<DashboardFilters>({
    tenantId: authUser?.tenantId ?? "",
    branchId: authUser?.branchId ?? "",
    terminalId: pos.terminalId ?? "",
    cashSessionId: "",
    startDate: today,
    endDate: today,
  });
  const [dashboard, setDashboard] = useState<InventoryDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alertLots, setAlertLots] = useState<InventoryLotResponse[]>([]);
  const [alertBalances, setAlertBalances] = useState<InventoryLotBalanceResponse[]>([]);
  const [alertSummary, setAlertSummary] =
    useState<InventoryLotReconciliationSummary | null>(null);
  const [alertDiscrepancies, setAlertDiscrepancies] = useState<InventoryLotDiscrepancy[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertErrorMessage, setAlertErrorMessage] = useState<string | null>(null);

  const loadInventoryAlerts = useCallback(
    async (nextFilters: Pick<DashboardFilters, "branchId">) => {
      const branchId =
        nextFilters.branchId || (authRole === "USER" ? authUser?.branchId ?? "" : "");

      setAlertLoading(true);
      setAlertErrorMessage(null);

      try {
        const [nextLots, nextBalances] = await Promise.all([
          listInventoryLots({ branchId: branchId || undefined }),
          listInventoryLotBalances({ branchId: branchId || undefined }),
        ]);

        setAlertLots(nextLots);
        setAlertBalances(nextBalances);

        const reconciliationParams = { branchId: branchId || undefined };
        const [nextSummary, nextDiscrepancies] = await Promise.all([
          getLotReconciliationSummary(reconciliationParams).catch(() => null),
          getLotReconciliationDiscrepancies({
            ...reconciliationParams,
            onlyDiscrepancies: true,
          }).catch(() => [] as InventoryLotDiscrepancy[]),
        ]);

        setAlertSummary(nextSummary);
        setAlertDiscrepancies(nextDiscrepancies);
      } catch {
        setAlertLots([]);
        setAlertBalances([]);
        setAlertSummary(null);
        setAlertDiscrepancies([]);
        setAlertErrorMessage(
          "No se pudieron cargar alertas loteadas. El dashboard operativo sigue disponible."
        );
      } finally {
        setAlertLoading(false);
      }
    },
    [authRole, authUser?.branchId]
  );

  const loadDashboard = useCallback(
    async (nextFilters: DashboardFilters) => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await getInventoryDashboard({
          tenantId: nextFilters.tenantId || undefined,
          branchId: nextFilters.branchId || undefined,
          terminalId: nextFilters.terminalId || undefined,
          cashSessionId: nextFilters.cashSessionId || undefined,
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate,
        });

        setDashboard(response);
        setFilters((current) => ({
          ...current,
          tenantId: response.scope.tenantId ?? current.tenantId,
          branchId: response.scope.branchId ?? "",
          terminalId: response.scope.terminalId ?? "",
          cashSessionId: response.scope.cashSessionId ?? "",
          startDate: response.scope.startDate,
          endDate: response.scope.endDate,
        }));
        void loadInventoryAlerts({
          branchId: response.scope.branchId ?? nextFilters.branchId,
        });
      } catch {
        setErrorMessage("No se pudo cargar el dashboard operativo de inventory.");
      } finally {
        setLoading(false);
      }
    },
    [loadInventoryAlerts]
  );

  useEffect(() => {
    if (!authUser?.tenantId && authRole !== "SUPER_ADMIN") {
      return;
    }

    void loadDashboard({
      tenantId: authUser?.tenantId ?? "",
      branchId: authRole === "USER" ? authUser?.branchId ?? "" : filters.branchId,
      terminalId: authRole === "USER" ? pos.terminalId ?? "" : filters.terminalId,
      cashSessionId: filters.cashSessionId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.tenantId, authRole, pos.terminalId]);

  const handleApplyFilters = () => {
    void loadDashboard(filters);
  };

  const handleResetFilters = () => {
    const nextFilters = {
      tenantId: authUser?.tenantId ?? "",
      branchId: authRole === "USER" ? authUser?.branchId ?? "" : "",
      terminalId: authRole === "USER" ? pos.terminalId ?? "" : "",
      cashSessionId: "",
      startDate: today,
      endDate: today,
    };

    setFilters(nextFilters);
    void loadDashboard(nextFilters);
  };

  const tenantName =
    dashboard?.header.tenant?.name ?? authUser?.tenantName ?? "Tenant no definido";
  const branchName =
    dashboard?.header.branch?.name ?? authUser?.branchName ?? "Sin sucursal activa";
  const terminalName =
    dashboard?.header.terminal?.name ??
    dashboard?.filters.cashSessions.find((item) => item.terminalId === filters.terminalId)?.terminalName ??
    "Sin terminal activa";
  const cashName =
    dashboard?.header.cashSession?.cashRegisterName ??
    dashboard?.filters.cashSessions.find((item) => item.id === filters.cashSessionId)?.cashRegisterName ??
    "Sin caja activa";

  const filterOptions = dashboard?.filters ?? {
    tenants: [] as InventoryDashboardFilterOption[],
    branches: [] as InventoryDashboardFilterOption[],
    terminals: [] as InventoryDashboardFilterOption[],
    cashSessions: [] as InventoryDashboardCashSessionOption[],
  };

  const topChartMax = useMemo(() => {
    const values = dashboard?.charts.topProducts.map((item) => item.quantity) ?? [];
    return Math.max(...values, 1);
  }, [dashboard?.charts.topProducts]);

  const tenantSlug = authUser?.tenantId ?? "default";

  const inventoryAlertStats = useMemo(() => {
    const availableByLot = new Map<string, number>();
    alertBalances.forEach((balance) => {
      availableByLot.set(
        balance.lotId,
        (availableByLot.get(balance.lotId) ?? 0) + Number(balance.quantityAvailable ?? 0)
      );
    });

    const expiredLots = alertLots.filter((lot) => {
      const days = daysUntil(lot.expirationDate);
      return lot.status === "EXPIRED" || (days !== null && days < 0);
    }).length;
    const expiringLots = alertLots.filter((lot) => {
      const days = daysUntil(lot.expirationDate);
      return days !== null && days >= 0 && days <= 30;
    }).length;
    const blockedOrCancelledWithStock = alertLots.filter((lot) => {
      const available = availableByLot.get(lot.id) ?? 0;
      return ["BLOCKED", "CANCELLED"].includes(lot.status) && available > 0;
    }).length;
    const availableStock = alertBalances.reduce(
      (sum, balance) => sum + Number(balance.quantityAvailable ?? 0),
      0
    );
    const criticalCount =
      alertSummary?.criticalCount ??
      alertDiscrepancies.filter((item) => item.severity === "CRITICAL").length;
    const highCount =
      alertSummary?.highCount ??
      alertDiscrepancies.filter((item) => item.severity === "HIGH").length;
    const warningCount =
      alertSummary?.warningCount ??
      alertDiscrepancies.filter((item) => item.severity === "WARNING").length;
    const discrepancyCount = alertSummary?.discrepancyCount ?? alertDiscrepancies.length;

    return {
      expiredLots,
      expiringLots,
      blockedOrCancelledWithStock,
      availableStock,
      criticalCount,
      highCount,
      warningCount,
      discrepancyCount,
    };
  }, [alertBalances, alertDiscrepancies, alertLots, alertSummary]);

  const reconciliationStatus = inventoryAlertStats.criticalCount
    ? {
        label: "Critico",
        className: "border-rose-200 bg-rose-50 text-rose-800",
        description: "Revisar antes de operar loteado.",
      }
    : inventoryAlertStats.highCount
      ? {
          label: "Con altas",
          className: "border-amber-200 bg-amber-50 text-amber-800",
          description: "Hay diferencias altas por validar.",
        }
      : inventoryAlertStats.warningCount
        ? {
            label: "Advertencias",
            className: "border-yellow-200 bg-yellow-50 text-yellow-800",
            description: "Hay hallazgos no bloqueantes.",
          }
        : {
            label: "Sin discrepancias",
            className: "border-emerald-200 bg-emerald-50 text-emerald-800",
            description: "No hay critical/high en el alcance.",
          };

  const quickLinks = [
    {
      label: "Ver inventario por lote",
      description: "Lotes, saldos, vencimientos y discrepancias.",
      href: `/${tenantSlug}/inventory/lots`,
      icon: Boxes,
    },
    {
      label: "Ver ubicaciones fisicas",
      description: "Bodegas, vitrinas, estantes y mostradores.",
      href: `/${tenantSlug}/inventory/locations`,
      icon: MapPinned,
    },
    {
      label: "Ver productos loteados",
      description: "Catalogo con badges de lote y vencimiento.",
      href: `/${tenantSlug}/inventory/products`,
      icon: PackageCheck,
    },
    {
      label: "Administrar promociones",
      description: "Descuentos por producto y alcance por sucursal.",
      href: `/${tenantSlug}/inventory/promotions`,
      icon: Tags,
    },
    {
      label: "Ver discrepancias",
      description: "Revision read-only desde inventario por lote.",
      href: `/${tenantSlug}/inventory/lots`,
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(135deg,_#0f172a,_#1e293b)] px-6 py-7 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-100/80">
                Inventory operativo
              </p>
              <h1 className="mt-3 text-3xl font-semibold">Dashboard contextual de inventory</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-200">
                Vista diaria de stock, compras, pedidos, ventas y movimiento real del modulo
                segun tenant, sucursal, terminal y caja activa.
              </p>
            </div>
            <div className="grid min-w-[280px] gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-sky-100/70">Usuario</p>
                <p className="mt-1 font-semibold">{authUser?.name ?? authUser?.email ?? "Usuario"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-sky-100/70">Rol</p>
                <p className="mt-1 font-semibold">{authRole || "Sin rol"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-sky-100/70">Tenant</p>
                <p className="mt-1 font-semibold">{tenantName}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-sky-100/70">Sucursal</p>
                <p className="mt-1 font-semibold">{branchName}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-sky-100/70">Terminal</p>
                <p className="mt-1 font-semibold">{terminalName}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-sky-100/70">Caja activa</p>
                <p className="mt-1 font-semibold">{cashName}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Filtros operativos</h2>
            <p className="mt-1 text-sm text-slate-500">
              El alcance se ajusta automaticamente al rol y al contexto autenticado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={handleResetFilters} disabled={loading}>
              Limpiar
            </Button>
            <Button variant="outline" onClick={handleApplyFilters} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {roleConfig.canSelectTenant ? (
            <Select
              label="Tenant"
              value={filters.tenantId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  tenantId: event.target.value,
                  branchId: "",
                  terminalId: "",
                  cashSessionId: "",
                }))
              }
            >
              <option value="">Selecciona</option>
              {filterOptions.tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          ) : null}

          {roleConfig.canSelectBranch ? (
            <Select
              label="Sucursal"
              value={filters.branchId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  branchId: event.target.value,
                  terminalId: "",
                  cashSessionId: "",
                }))
              }
            >
              <option value="">Todas</option>
              {filterOptions.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input label="Sucursal activa" value={branchName} readOnly />
          )}

          {roleConfig.canSelectTerminal ? (
            <Select
              label="Terminal"
              value={filters.terminalId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  terminalId: event.target.value,
                  cashSessionId: "",
                }))
              }
            >
              <option value="">Todas</option>
              {filterOptions.terminals.map((terminal) => (
                <option key={terminal.id} value={terminal.id}>
                  {terminal.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input label="Terminal actual" value={terminalName} readOnly />
          )}

          {roleConfig.canSelectCashSession ? (
            <Select
              label="Caja activa"
              value={filters.cashSessionId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  cashSessionId: event.target.value,
                }))
              }
            >
              <option value="">Todas</option>
              {filterOptions.cashSessions.map((cashSession) => (
                <option key={cashSession.id} value={cashSession.id}>
                  {cashSession.cashRegisterName}
                </option>
              ))}
            </Select>
          ) : (
            <Input label="Caja activa" value={cashName} readOnly />
          )}

          <Input
            label="Fecha inicial"
            type="date"
            value={filters.startDate}
            onChange={(event) =>
              setFilters((current) => ({ ...current, startDate: event.target.value }))
            }
          />

          <Input
            label="Fecha final"
            type="date"
            value={filters.endDate}
            onChange={(event) =>
              setFilters((current) => ({ ...current, endDate: event.target.value }))
            }
          />
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      {loading && !dashboard ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-36" />
          ))}
        </section>
      ) : null}

      {dashboard ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Stock total"
              value={formatNumber(dashboard.summary.stockTotal)}
              description="Saldo agregado en el alcance visible"
              icon={Boxes}
              tone="blue"
            />
            <KpiCard
              title="Productos bajos"
              value={formatNumber(dashboard.summary.productsLow)}
              description="Stock actual por debajo de la salida del periodo"
              icon={AlertTriangle}
              tone="amber"
            />
            <KpiCard
              title="Productos agotados"
              value={formatNumber(dashboard.summary.productsOut)}
              description="Referencias sin stock operativo"
              icon={PackageX}
              tone="rose"
            />
            <KpiCard
              title="Compras pendientes"
              value={formatNumber(dashboard.summary.pendingPurchases)}
              description="Documentos por recibir o cerrar"
              icon={ShoppingBag}
              tone="slate"
            />
            <KpiCard
              title="Pedidos pendientes"
              value={formatNumber(dashboard.summary.pendingOrders)}
              description="Pedidos en cola de confirmacion o entrega"
              icon={Store}
              tone="slate"
            />
            <KpiCard
              title="Ventas del dia"
              value={formatCurrency(dashboard.summary.salesDay)}
              description="Ventas del dia final del rango"
              icon={TrendingUp}
              tone="emerald"
            />
            <KpiCard
              title="Caja activa"
              value={dashboard.header.cashSession?.cashRegisterName ?? "Sin caja"}
              description={
                dashboard.header.cashSession?.openedAt
                  ? `Abierta ${formatDateTime(dashboard.header.cashSession.openedAt)}`
                  : "No hay caja abierta en el alcance"
              }
              icon={CreditCard}
              tone="blue"
            />
            <KpiCard
              title="Movimientos recientes"
              value={formatNumber(dashboard.summary.recentMovements)}
              description="Movimientos dentro del rango filtrado"
              icon={Activity}
              tone="slate"
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Alertas de inventario
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Lectura rapida de vencimientos, disponibilidad loteada y reconciliacion.
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => void loadInventoryAlerts(filters)}
                isLoading={alertLoading}
              >
                <RefreshCw className="h-4 w-4" />
                Refrescar alertas
              </Button>
            </div>

            {alertErrorMessage ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {alertErrorMessage}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <InventoryAlertCard
                title="Lotes vencidos"
                value={formatNumber(inventoryAlertStats.expiredLots)}
                description="No aptos para venta FEFO."
                icon={AlertTriangle}
                tone="border-rose-200 bg-rose-50 text-rose-800"
              />
              <InventoryAlertCard
                title="Proximos a vencer"
                value={formatNumber(inventoryAlertStats.expiringLots)}
                description="Vencen en 30 dias o menos."
                icon={AlertTriangle}
                tone="border-amber-200 bg-amber-50 text-amber-800"
              />
              <InventoryAlertCard
                title="Bloq/cancel con saldo"
                value={formatNumber(inventoryAlertStats.blockedOrCancelledWithStock)}
                description="Saldo disponible en lotes no vendibles."
                icon={PackageX}
                tone="border-slate-200 bg-slate-100 text-slate-800"
              />
              <InventoryAlertCard
                title="Discrep. criticas"
                value={formatNumber(inventoryAlertStats.criticalCount)}
                description="Reconciliacion loteada."
                icon={ShieldAlert}
                tone="border-rose-200 bg-white text-rose-800"
              />
              <InventoryAlertCard
                title="Discrep. altas"
                value={formatNumber(inventoryAlertStats.highCount)}
                description="Diferencias por revisar."
                icon={ShieldAlert}
                tone="border-amber-200 bg-white text-amber-800"
              />
              <InventoryAlertCard
                title="Stock loteado disp."
                value={formatNumber(inventoryAlertStats.availableStock)}
                description="Suma de quantity_available."
                icon={Boxes}
                tone="border-blue-200 bg-blue-50 text-blue-800"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Accesos rapidos</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {quickLinks.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <span className="flex items-center gap-3">
                          <span className="rounded-xl bg-slate-100 p-2 text-slate-700 group-hover:bg-white group-hover:text-blue-700">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-semibold text-slate-900">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {item.description}
                            </span>
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700" />
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section
                className={`rounded-2xl border p-5 shadow-sm ${reconciliationStatus.className}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide opacity-75">
                      Reconciliacion
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold">
                      {reconciliationStatus.label}
                    </h3>
                    <p className="mt-1 text-sm opacity-80">
                      {reconciliationStatus.description}
                    </p>
                  </div>
                  <ShieldAlert className="h-6 w-6 opacity-70" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <p className="text-xs opacity-70">Total</p>
                    <p className="font-semibold">
                      {formatNumber(inventoryAlertStats.discrepancyCount)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2">
                    <p className="text-xs opacity-70">Warning</p>
                    <p className="font-semibold">
                      {formatNumber(inventoryAlertStats.warningCount)}
                    </p>
                  </div>
                </div>
                {alertDiscrepancies.length > 0 ? (
                  <div className="mt-4 space-y-2 text-xs">
                    {alertDiscrepancies.slice(0, 3).map((item, index) => (
                      <p
                        key={[
                          item.discrepancyType,
                          item.severity,
                          item.productId ?? "no-product",
                          item.lotId ?? "no-lot",
                          item.balanceId ?? "no-balance",
                          item.stockMovementId ?? "no-movement",
                          item.stockMovementLotId ?? "no-link",
                          item.branchId ?? "no-branch",
                          item.detectedAt,
                          index,
                        ].join(":")}
                        className="rounded-xl bg-white/70 px-3 py-2"
                      >
                        {item.severity} - {item.discrepancyType}
                      </p>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Entradas vs salidas"
              subtitle="Movimiento diario de inventario en el rango filtrado."
            >
              {dashboard.charts.movementSeries.length === 0 ? (
                <EmptyPanel message="No hay movimientos para graficar en este rango." />
              ) : (
                <div className="grid grid-cols-7 gap-3">
                  {dashboard.charts.movementSeries.map((item) => {
                    const max = Math.max(
                      ...dashboard.charts.movementSeries.flatMap((point) => [
                        point.entries,
                        point.exits,
                        1,
                      ])
                    );

                    return (
                      <div key={item.date} className="flex flex-col items-center gap-2">
                        <div className="flex h-44 items-end gap-1">
                          <div
                            className="w-3 rounded-full bg-emerald-500"
                            style={{ height: `${(item.entries / max) * 100}%` }}
                          />
                          <div
                            className="w-3 rounded-full bg-rose-500"
                            style={{ height: `${(item.exits / max) * 100}%` }}
                          />
                        </div>
                        <div className="text-center text-[11px] text-slate-500">
                          {item.date.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Ventas y compras por dia"
              subtitle="Comparativo diario de flujo comercial e ingreso de mercancia."
            >
              {dashboard.charts.salesSeries.length === 0 && dashboard.charts.purchaseSeries.length === 0 ? (
                <EmptyPanel message="No hay ventas ni compras para este rango." />
              ) : (
                <div className="space-y-3">
                  {dashboard.charts.salesSeries.map((item, index) => {
                    const purchase = dashboard.charts.purchaseSeries[index];
                    const max = Math.max(
                      ...dashboard.charts.salesSeries.flatMap((point) => point.total),
                      ...dashboard.charts.purchaseSeries.flatMap((point) => point.total),
                      1
                    );

                    return (
                      <div key={item.date} className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{item.date}</span>
                          <span>
                            V {formatCurrency(item.total)} / C{" "}
                            {formatCurrency(purchase?.total ?? 0)}
                          </span>
                        </div>
                        <div className="grid gap-2">
                          <div className="h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-emerald-500"
                              style={{ width: `${(item.total / max) * 100}%` }}
                            />
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-sky-500"
                              style={{ width: `${((purchase?.total ?? 0) / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <ChartCard
              title="Top productos"
              subtitle="Productos mas vendidos dentro del rango filtrado."
            >
              {dashboard.charts.topProducts.length === 0 ? (
                <EmptyPanel message="Aun no hay productos vendidos para este filtro." />
              ) : (
                <div className="space-y-4">
                  {dashboard.charts.topProducts.map((item) => (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-900">{formatNumber(item.quantity)}</p>
                          <p className="text-xs text-slate-500">{formatCurrency(item.total)}</p>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-slate-900"
                          style={{ width: `${(item.quantity / topChartMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Contexto activo"
              subtitle="Resumen del rango y de la sesion operativa usada."
            >
              <div className="space-y-3 text-sm text-slate-700">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Rango</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {filters.startDate} al {filters.endDate}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Caja activa</p>
                  <p className="mt-1 font-medium text-slate-900">{cashName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {dashboard.header.cashSession?.openedAt
                      ? `Abierta ${formatDateTime(dashboard.header.cashSession.openedAt)}`
                      : "Sin sesion de caja abierta"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Terminal</p>
                  <p className="mt-1 font-medium text-slate-900">{terminalName}</p>
                </div>
              </div>
            </ChartCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <DashboardTableSection
              title="Ultimos movimientos de inventario"
              subtitle="Entradas y salidas recientes del rango."
              emptyMessage="No hay movimientos recientes en este rango."
            >
              {dashboard.tables.recentMovements.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.tables.recentMovements.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{item.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.sku} • {item.branchName ?? "Sin sucursal"} •{" "}
                            {item.terminalName ?? "Sin terminal"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            item.type === "IN"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-rose-200 bg-rose-50 text-rose-700"
                          }`}
                        >
                          {item.type === "IN" ? "Entrada" : "Salida"} {formatNumber(item.quantity)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{item.referenceType}</span>
                        <span>
                          Stock {formatNumber(Number(item.stockBefore ?? 0))} -&gt;{" "}
                          {formatNumber(Number(item.stockAfter ?? 0))}
                        </span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </DashboardTableSection>

            <DashboardTableSection
              title="Ultimas compras"
              subtitle="Compras y recepciones visibles para el alcance actual."
              emptyMessage="No hay compras recientes para mostrar."
            >
              {dashboard.tables.recentPurchases.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.tables.recentPurchases.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.supplierName ?? "Proveedor no registrado"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.branchName ?? "Sin sucursal"} • {item.terminalName ?? "Sin terminal"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Total {formatCurrency(Number(item.total))}</span>
                        <span>Saldo {formatCurrency(Number(item.balanceDue))}</span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </DashboardTableSection>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <DashboardTableSection
              title="Productos criticos"
              subtitle="Productos agotados o cuyo stock no cubre la salida del periodo."
              emptyMessage="No hay productos criticos con el filtro actual."
            >
              {dashboard.tables.criticalProducts.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.tables.criticalProducts.map((item) => (
                    <article
                      key={`${item.productId}:${item.branchId}`}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{item.productName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.sku} • {item.branchName}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            Number(item.stock) <= 0
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          Stock {formatNumber(Number(item.stock))}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Salida periodo {formatNumber(Number(item.outboundInPeriod))}</span>
                        <span>Ultimo movimiento {formatDateTime(item.lastMovementAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </DashboardTableSection>

            <DashboardTableSection
              title="Pedidos pendientes"
              subtitle="Pedidos en curso que siguen afectando la operacion."
              emptyMessage="No hay pedidos pendientes en este momento."
            >
              {dashboard.tables.pendingOrders.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.tables.pendingOrders.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.customerName ?? "Cliente no registrado"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.branchName ?? "Sin sucursal"} • {item.terminalName ?? "Sin terminal"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Total {formatCurrency(Number(item.total))}</span>
                        <span>Pendiente {formatNumber(Number(item.pendingQuantity))}</span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </DashboardTableSection>
          </section>
        </>
      ) : null}
    </div>
  );
};
