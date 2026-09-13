"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CreditCard,
  ReceiptText,
  Scale,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { FinanceAccessNotice } from "../../../modules/finance/components/FinanceAccessNotice";
import { FinanceMetricCard } from "../../../modules/finance/components/FinanceMetricCard";
import { FinancePageHeader } from "../../../modules/finance/components/FinancePageHeader";
import { FinanceSectionNav } from "../../../modules/finance/components/FinanceSectionNav";
import { useCashRegisters } from "../../../modules/finance/hooks/use-cash-registers";
import { useCashSessions } from "../../../modules/finance/hooks/use-cash-sessions";
import { usePaymentMethods } from "../../../modules/finance/hooks/use-payment-methods";
import { getFinancePermissions } from "../../../modules/finance/permissions";
import { formatCurrency } from "../../../modules/finance/utils";
import { useAppSelector } from "../../../store/hooks";

const FinanceHomePage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantSlug ?? authUser?.tenantId ?? "default";
  const { canViewFinance } = getFinancePermissions(role);
  const { paymentMethods, loadPaymentMethods } = usePaymentMethods();
  const { cashRegisters, loadCashRegisters } = useCashRegisters();
  const { currentSession, history, loadCurrentSession, loadHistory } = useCashSessions();

  useEffect(() => {
    if (!canViewFinance) {
      return;
    }
    void loadPaymentMethods();
    void loadCashRegisters();
    void loadCurrentSession();
    void loadHistory({ limit: 8 });
  }, [
    canViewFinance,
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

  const shortcuts = [
    {
      label: "Metodos de pago",
      href: `/${tenantSlug}/finance/payment-methods`,
      description: "Define medios permitidos, referencias y cambio.",
      icon: CreditCard,
    },
    {
      label: "Cajas",
      href: `/${tenantSlug}/finance/cash-registers`,
      description: "Configura cajas por sucursal y punto de recaudo.",
      icon: Wallet,
    },
    {
      label: "Sesiones",
      href: `/${tenantSlug}/finance/cash-sessions`,
      description: "Controla aperturas, cierres y diferencias de arqueo.",
      icon: ReceiptText,
    },
    {
      label: "Turno actual",
      href: `/${tenantSlug}/finance/current-shift`,
      description: "Ventas, pedidos, compras, arqueo y tickets de la caja abierta.",
      icon: Activity,
    },
    {
      label: "Movimientos",
      href: `/${tenantSlug}/finance/cash-movements`,
      description: "Observa entradas, salidas y ajustes en caja.",
      icon: Scale,
    },
  ];

  return (
    <div className="space-y-6">
      <FinancePageHeader
        eyebrow="Finance"
        title="Centro financiero"
        description="Una vista operativa para controlar catalogos, cajas, sesiones y movimientos en tiempo real sin tocar aun el flujo del POS."
        actions={
          <Link
            href={`/${tenantSlug}/finance/cash-sessions`}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 ease-out hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
          >
            {currentSession ? "Cerrar caja / arqueo" : "Abrir caja"}
          </Link>
        }
      />

      <FinanceSectionNav tenantSlug={tenantSlug} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard
          label="Metodos activos"
          value={activeMethods}
          accent="blue"
          helper="Catalogo listo para cobros y conciliacion."
        />
        <FinanceMetricCard
          label="Cajas activas"
          value={activeRegisters}
          accent="emerald"
          helper="Puntos de recaudo disponibles hoy."
        />
        <FinanceMetricCard
          label="Caja actual"
          value={currentSession ? currentSession.cashRegisterNombre ?? "Abierta" : "Sin sesion"}
          accent={currentSession ? "amber" : "slate"}
          helper={
            currentSession
              ? `Apertura: ${formatCurrency(currentSession.openingAmount)}`
              : "No hay una sesion abierta para tu usuario."
          }
        />
        <FinanceMetricCard
          label="Diferencias recientes"
          value={formatCurrency(lastDifferences)}
          accent={lastDifferences > 0 ? "rose" : "slate"}
          helper="Suma absoluta de diferencias en cierres recientes."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                Rutas rapidas
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                Operacion financiera base
              </h2>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {shortcuts.map((shortcut) => {
              const Icon = shortcut.icon;
              return (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md dark:bg-slate-800 dark:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-2xl bg-slate-900 p-2 text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-900 dark:text-white" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                    {shortcut.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {shortcut.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            Sesiones recientes
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
            Ultimos cierres y aperturas
          </h2>
          <div className="mt-5 space-y-3">
            {history.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
                Aun no hay sesiones para mostrar.
              </div>
            ) : (
              history.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {session.cashRegisterNombre ?? "Caja"}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {session.status} · {session.cashRegisterCodigo ?? "-"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(session.openingAmount)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default FinanceHomePage;
