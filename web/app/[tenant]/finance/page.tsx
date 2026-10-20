"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  CreditCard,
  ReceiptText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { FinanceAccessNotice } from "../../../modules/finance/components/FinanceAccessNotice";
import { FinanceStatusBadge } from "../../../modules/finance/components/FinanceStatusBadge";
import { useCashRegisters } from "../../../modules/finance/hooks/use-cash-registers";
import { useCashSessions } from "../../../modules/finance/hooks/use-cash-sessions";
import { usePaymentMethods } from "../../../modules/finance/hooks/use-payment-methods";
import { getFinancePermissions } from "../../../modules/finance/permissions";
import { formatCurrency, formatDateTime } from "../../../modules/finance/utils";
import { useAppSelector } from "../../../store/hooks";

type QuickAccess = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type FinanceMetric = {
  label: string;
  value: ReactNode;
  helper: string;
  accent: "amber" | "emerald" | "slate" | "rose" | "blue";
};

const metricAccentStyles: Record<FinanceMetric["accent"], string> = {
  amber: "border-t-amber-500",
  emerald: "border-t-emerald-500",
  slate: "border-t-slate-300",
  rose: "border-t-rose-500",
  blue: "border-t-blue-500",
};

const getResponsiveColumns = (count: number) => {
  if (count >= 4) return "grid-cols-2 lg:grid-cols-4";
  if (count === 3) return "grid-cols-2 lg:grid-cols-3";
  if (count === 2) return "grid-cols-2 lg:grid-cols-2";
  return "grid-cols-1";
};

const FinanceHomePage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantSlug ?? authUser?.tenantId ?? "default";
  const { canViewFinance, canViewPaymentMethods } = getFinancePermissions(role);
  const { paymentMethods, loadPaymentMethods } = usePaymentMethods();
  const { cashRegisters, loadCashRegisters } = useCashRegisters();
  const {
    currentSession,
    history,
    loadingCurrent,
    loadingHistory,
    historyLoaded,
    loadCurrentSession,
    loadHistory,
  } = useCashSessions();

  useEffect(() => {
    if (!canViewFinance) {
      return;
    }
    if (canViewPaymentMethods) {
      void loadPaymentMethods();
    }
    void loadCashRegisters();
    void loadCurrentSession();
    void loadHistory({ limit: 8 });
  }, [
    canViewFinance,
    canViewPaymentMethods,
    loadCashRegisters,
    loadCurrentSession,
    loadHistory,
    loadPaymentMethods,
  ]);

  if (!canViewFinance) {
    return (
      <FinanceAccessNotice description="Solo SUPER_ADMIN, SUPER_USER, ADMIN y USER pueden ingresar al modulo financiero." />
    );
  }

  const activeMethods = paymentMethods.filter((item) => item.active).length;
  const activeRegisters = cashRegisters.filter((item) => item.activo).length;
  const closedSessions = history.filter((item) => item.status === "CLOSED");
  const lastDifferences = closedSessions.reduce(
    (sum, item) => sum + Math.abs(item.differenceAmount ?? 0),
    0
  );
  const loading = loadingCurrent || loadingHistory;
  const link = (path: string) => `/${tenantSlug}/finance/${path}`;
  const quickAccess: QuickAccess[] = [
    {
      label: "Caja",
      description: "Aperturas, cierres y arqueos.",
      href: link("cash-sessions"),
      icon: ReceiptText,
    },
    {
      label: "Movimientos",
      description: "Entradas, salidas y ajustes.",
      href: link("cash-movements"),
      icon: ArrowRightLeft,
    },
    {
      label: "Cajas",
      description: "Puntos de recaudo y estado.",
      href: link("cash-registers"),
      icon: Banknote,
    },
    ...(canViewPaymentMethods
      ? [
          {
            label: "Metodos de pago",
            description: "Catalogo y reglas de cobro.",
            href: link("payment-methods"),
            icon: CreditCard,
          },
        ]
      : []),
  ];
  const metrics: FinanceMetric[] = [
    ...(canViewPaymentMethods
      ? [
          {
            label: "Metodos activos",
            value: activeMethods,
            accent: "blue" as const,
            helper: "Disponibles para cobros.",
          },
        ]
      : []),
    {
      label: "Cajas activas",
      value: activeRegisters,
      accent: "emerald",
      helper: "Puntos de recaudo disponibles.",
    },
    {
      label: "Caja actual",
      value: currentSession ? currentSession.cashRegisterNombre ?? "Abierta" : "Sin sesion",
      accent: currentSession ? "amber" : "slate",
      helper: currentSession
        ? `Apertura: ${formatCurrency(currentSession.openingAmount)}`
        : "No hay una sesion abierta para tu usuario.",
    },
    {
      label: "Diferencias recientes",
      value: formatCurrency(lastDifferences),
      accent: lastDifferences > 0 ? "rose" : "slate",
      helper: "Suma absoluta de cierres recientes.",
    },
  ];

  return (
    <main className="min-w-0 space-y-4" aria-busy={loading}>
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Finance
          </p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">
            Centro financiero
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control operativo de caja, sesiones, movimientos y medios de pago.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={link("cash-sessions")}
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {currentSession ? "Gestionar caja" : "Abrir caja"}
          </Link>
        </div>
      </header>

      <nav
        className={`grid min-w-0 gap-2 ${getResponsiveColumns(quickAccess.length)}`}
        aria-label="Accesos financieros"
      >
        {quickAccess.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-800"
            >
              <span className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                  {item.description}
                </span>
              </span>
              <ArrowRight
                className="ml-auto h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-blue-600"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </nav>

      <section
        className={`grid min-w-0 gap-2 ${getResponsiveColumns(metrics.length)}`}
        aria-label="Resumen financiero"
      >
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`min-w-0 rounded-xl border border-t-2 border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${metricAccentStyles[metric.accent]}`}
          >
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-1 truncate text-lg font-bold leading-tight text-slate-950 dark:text-white">
              {loading ? "..." : metric.value}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
              {metric.helper}
            </p>
          </article>
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_1.5fr]">
        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Estado actual
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                Caja y turno
              </h2>
            </div>
            <Wallet className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {loadingCurrent ? "Cargando caja..." : currentSession?.cashRegisterNombre ?? "Sin sesion abierta"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {currentSession
                  ? `Apertura ${formatCurrency(currentSession.openingAmount)}`
                  : "La caja actual se consulta con las reglas de Finance."}
              </p>
            </div>
            {currentSession ? <FinanceStatusBadge value={currentSession.status} kind="session" /> : null}
          </div>
          <Link
            href={link("current-shift")}
            className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-300"
          >
            Ver turno actual
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </article>

        <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Actividad reciente
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                Cierres y aperturas
              </h2>
            </div>
            <Link
              href={link("cash-sessions")}
              className="shrink-0 text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-blue-300"
            >
              Ver todo
            </Link>
          </div>
          {!historyLoaded || loadingHistory ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
              Cargando sesiones...
            </p>
          ) : history.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Aun no hay sesiones para mostrar.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
              {history.slice(0, 5).map((session) => (
                <div key={session.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {session.cashRegisterNombre ?? "Caja"}
                      </p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {session.cashRegisterCodigo ?? "-"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(session.openedAt)}
                    </p>
                  </div>
                  <FinanceStatusBadge value={session.status} kind="session" />
                  <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {formatCurrency(session.openingAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
};

export default FinanceHomePage;
