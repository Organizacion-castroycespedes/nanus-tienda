"use client";

import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  Receipt,
  Scale,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useAppSelector } from "../../../store/hooks";
import { useReportingOverview } from "../hooks/use-reporting-overview";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { formatCurrency, formatDateTime, getTodayRange } from "../utils";
import { ReportMetricCard } from "./ReportMetricCard";

const accessCards = [
  {
    href: "reporteria/pos",
    title: "Ventas POS",
    description: "Consulta ventas, pagos, saldos y tickets emitidos desde caja.",
    icon: Receipt,
  },
  {
    href: "reporteria/caja?tab=closings",
    title: "Caja (cierres)",
    description: "Monitorea cierres, ingresos, egresos y diferencias esperadas.",
    icon: Wallet,
  },
  {
    href: "reporteria/caja?tab=audits",
    title: "Arqueo",
    description: "Revisa conteos de caja, diferencias y tickets de auditoria.",
    icon: Scale,
  },
  {
    href: "reporteria/compras",
    title: "Compras",
    description: "Consulta compras, pagos a proveedor y tickets de compra.",
    icon: ShoppingBag,
  },
  {
    href: "reporteria/pedidos",
    title: "Pedidos",
    description: "Monitorea pedidos, venta generada y su estado operativo.",
    icon: ClipboardList,
  },
  {
    href: "reporteria/clientes",
    title: "Clientes",
    description: "Agrupa clientes segun el estado y saldo de sus pedidos.",
    icon: Users,
  },
];

const ReporteriaPage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const tenantSlug = authUser?.tenantId ?? "default";
  const initialRange = useMemo(() => getTodayRange(), []);
  const {
    canViewReports,
    tenantId,
    branchId,
  } = useReportingScope();
  const { overview, loading, error, loadOverview } = useReportingOverview();

  useEffect(() => {
    if (!canViewReports || !tenantId) {
      return;
    }

    void loadOverview({
      tenantId,
      branchId: branchId || undefined,
      dateFrom: initialRange.from,
      dateTo: initialRange.to,
    });
  }, [branchId, canViewReports, initialRange, loadOverview, tenantId]);

  if (!canViewReports) {
    return (
      <FinanceAccessNotice description="Solo USER, ADMIN, SUPER_USER y SUPER_ADMIN pueden acceder al centro de control operativo." />
    );
  }

  const posSummary = overview.pos?.summary;
  const closingsSummary = overview.closings?.summary;

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Reporteria
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Centro de control operativo
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Un espacio rapido para consultar ventas POS, cierres y arqueos sin salir del flujo diario de operacion.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Resumen del dia</p>
            <p>{initialRange.from}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetricCard
          label="Ventas del dia"
          value={posSummary ? formatCurrency(posSummary.total) : loading ? "Cargando..." : "$ 0"}
          helper={
            posSummary
              ? `${posSummary.count} transacciones registradas`
              : error ?? "Sin datos para el rango actual."
          }
          accent="blue"
        />
        <ReportMetricCard
          label="Ingresos"
          value={
            closingsSummary ? formatCurrency(closingsSummary.totalIn) : loading ? "Cargando..." : "$ 0"
          }
          helper="Total de entradas reportadas por cierres de caja."
          accent="emerald"
        />
        <ReportMetricCard
          label="Egresos"
          value={
            closingsSummary ? formatCurrency(closingsSummary.totalOut) : loading ? "Cargando..." : "$ 0"
          }
          helper="Total de salidas consolidadas en cierres."
          accent="amber"
        />
        <ReportMetricCard
          label="Diferencia caja"
          value={
            closingsSummary
              ? formatCurrency(closingsSummary.difference)
              : loading
                ? "Cargando..."
                : "$ 0"
          }
          helper="Diferencia acumulada segun el backend."
          accent="rose"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-slate-900 p-3 text-white">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Accesos directos
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Reportes clave del turno
              </h2>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accessCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.href}
                  href={`/${tenantSlug}/${card.href}`}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
                >
                  <span className="inline-flex rounded-2xl bg-white p-3 text-slate-900 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-base font-semibold text-slate-900">
                    {card.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Actividad reciente
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Ultimos movimientos visibles
          </h2>
          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                Cargando resumen operativo...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-sm text-rose-700">
                {error}
              </div>
            ) : overview.pos?.rows.length || overview.closings?.rows.length ? (
              <>
                {overview.pos?.rows.slice(0, 2).map((row) => (
                  <div key={row.saleId} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          Venta POS · {row.customerName || "Consumidor final"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatDateTime(row.date)} · {row.branchName ?? "Sucursal"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(row.total)}
                      </p>
                    </div>
                  </div>
                ))}
                {overview.closings?.rows.slice(0, 2).map((row) => (
                  <div key={row.cashSessionId} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          Cierre de caja · {row.branchName ?? "Sucursal"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatDateTime(row.closedAt ?? row.openedAt)} · {row.cashRegister ?? "Caja"}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(row.difference)}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                No hay actividad para el dia seleccionado.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default ReporteriaPage;
