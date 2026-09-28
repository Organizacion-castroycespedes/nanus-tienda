"use client";

import Link from "next/link";
import { BarChart3, ClipboardList, Receipt, RefreshCw, ShoppingBag, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select } from "../../../components/design-system/Select";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useAppSelector } from "../../../store/hooks";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { useOperationalControl } from "../hooks/use-operational-control";
import type { OperationalPeriod } from "../services/operational-control.service";

const destinations = [["POS", "reporteria/pos", Receipt], ["Caja", "reporteria/caja?tab=closings", Wallet], ["Compras", "reporteria/compras", ShoppingBag], ["Pedidos", "reporteria/pedidos", ClipboardList], ["Clientes", "reporteria/clientes", Users]] as const;
const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value ?? 0);
const shortDate = (value: string) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const COLORS = ["#2563eb", "#16a34a", "#f59e0b"];
const PAYMENT_FALLBACK_COLORS = ["#0f766e", "#7c3aed", "#ea580c", "#0891b2", "#be123c", "#4f46e5"];

const normalizePaymentLabel = (label: string) => label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const paymentMethodColor = (label: string) => {
  const normalized = normalizePaymentLabel(label);
  if (/(efectivo|cash)/.test(normalized)) return "#16a34a";
  if (/(debito|credito|tarjeta|card)/.test(normalized)) return "#2563eb";
  if (/(transferencia|transfer|banco|bank)/.test(normalized)) return "#7c3aed";
  if (/(qr|breb)/.test(normalized)) return "#ea580c";

  let hash = 0;
  for (const character of normalized || "desconocido") hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return PAYMENT_FALLBACK_COLORS[hash % PAYMENT_FALLBACK_COLORS.length];
};

export default function ReporteriaPage() {
  const user = useAppSelector((state) => state.auth.user);
  const tenantSlug = user?.tenantSlug ?? user?.tenantId ?? "default";
  const scope = useReportingScope();
  const [period, setPeriod] = useState<OperationalPeriod>("TODAY");
  const [cashierId, setCashierId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const filters = useMemo(() => ({ period, tenantId: scope.tenantId || undefined, branchId: scope.branchId || undefined, cashierId: cashierId || undefined, terminalId: terminalId || undefined }), [cashierId, period, scope.branchId, scope.tenantId, terminalId]);
  const { data, loading, error, reload } = useOperationalControl(filters);
  const metrics = data?.metrics;
  const chart = data?.charts;
  const link = (path: string) => `/${tenantSlug}/${path}`;
  const isUser = data?.filters.actorRole === "USER";

  useEffect(() => {
    setCashierId("");
    setTerminalId("");
  }, [scope.tenantId, scope.branchId]);

  if (!scope.canViewReports) return <FinanceAccessNotice description="No tienes permisos para consultar el centro de control operativo." />;

  return <main className="min-w-0 space-y-4" aria-busy={loading}>
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-slate-500">Reportería</p><h1 className="text-2xl font-bold text-slate-950 dark:text-white">Centro de control operativo</h1><p className="text-sm text-slate-500">Primero terminales POS. Luego caja, pedidos y soporte.</p></div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Periodo">{([['TODAY', 'Hoy'], ['LAST_7_DAYS', '7 días'], ['LAST_30_DAYS', '30 días']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${period === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{label}</button>)}<button type="button" onClick={() => void reload()} className="rounded-lg border border-slate-200 p-2 text-slate-600" aria-label="Actualizar"><RefreshCw className="h-4 w-4" /></button></div>
    </header>

    <nav className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Reportes especializados">{destinations.map(([label, path, Icon]) => <Link key={label} href={link(path)} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon className="h-4 w-4 shrink-0 text-blue-600" /><span className="truncate">{label}</span></Link>)}</nav>

    <section className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-label="Filtros operativos">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-semibold uppercase tracking-wide">Alcance</span>{!scope.showTenantSelector ? <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-700">{scope.resolvedTenantLabel}</span> : null}{!scope.showBranchSelector ? <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-700">{scope.resolvedBranchLabel}</span> : null}</div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {scope.showTenantSelector ? <Select label="Tenant" value={scope.tenantId} onChange={(event) => scope.setTenantId(event.target.value)} disabled={scope.loadingTenants}><option value="">Selecciona un tenant</option>{scope.tenantOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select> : null}
        {scope.showBranchSelector ? <Select label="Sucursal" value={scope.branchId} onChange={(event) => scope.setBranchId(event.target.value)} disabled={scope.loadingBranches || (!scope.tenantId && scope.showTenantSelector)}><option value="">Todas las sucursales</option>{scope.branchOptions.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select> : null}
        {!isUser ? <Select label="Cajero / usuario" value={cashierId} onChange={(event) => setCashierId(event.target.value)} disabled={!data}><option value="">Todos</option>{(data?.filterOptions.cashiers ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select> : null}
        {!isUser ? <Select label="Terminal" value={terminalId} onChange={(event) => setTerminalId(event.target.value)} disabled={!data}><option value="">Todas</option>{(data?.filterOptions.terminals ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select> : null}
      </div>
    </section>

    {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
    <section className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores operativos">{[["Ventas netas", metrics ? money(metrics.netSales) : "—"], ["Transacciones", metrics?.transactions ?? "—"], ["Cajas abiertas", metrics?.openCashSessions ?? "—"], ["Cajeros activos", metrics?.activeCashiers ?? "—"], ["Pedidos pendientes", metrics?.pendingOrders ?? "—"], ["Diferencia caja", metrics ? money(metrics.cashDifference) : "—"]].map(([label, value]) => <article key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"><p className="truncate text-xs text-slate-500">{label}</p><p className="mt-1 truncate text-lg font-bold text-slate-950 dark:text-white">{loading ? "…" : value}</p></article>)}</section>
    <div className="flex min-w-0 flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300"><span>Compras: <strong>{data ? `${data.summaries.purchases.count} · ${money(data.summaries.purchases.total)}` : "—"}</strong></span><span>Clientes con actividad: <strong>{data?.summaries.customers.active ?? "—"}</strong></span></div>

    <section className="grid min-w-0 gap-3 lg:grid-cols-2" aria-label="Gráficas operativas">
      <ChartCard title="Evolución de ventas" empty={!chart?.salesEvolution.length}><ResponsiveContainer width="100%" height={220}><LineChart data={chart?.salesEvolution ?? []}><XAxis dataKey="bucket" tickFormatter={shortDate} minTickGap={24} /><YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: number) => money(v)} labelFormatter={shortDate} /><Legend /><Line type="monotone" dataKey="total" name="Ventas" stroke="#2563eb" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Ventas por método de pago" empty={!chart?.paymentMethods.length}><ResponsiveContainer width="100%" height={220}><BarChart data={chart?.paymentMethods ?? []}><XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={60} /><YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: number) => money(v)} /><Bar dataKey="total" name="Total" radius={[5, 5, 0, 0]}>{(chart?.paymentMethods ?? []).map((method, index) => <Cell key={`${method.label}-${index}`} fill={paymentMethodColor(method.label)} />)}</Bar></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Movimientos de caja" empty={!chart?.cashMovements.length}><ResponsiveContainer width="100%" height={220}><LineChart data={chart?.cashMovements ?? []}><XAxis dataKey="bucket" tickFormatter={shortDate} minTickGap={24} /><YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip formatter={(v: number) => money(v)} labelFormatter={shortDate} /><Legend /><Line dataKey="cashIn" name="Ingresos" stroke="#16a34a" /><Line dataKey="cashOut" name="Egresos" stroke="#dc2626" /></LineChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Pedidos por estado" empty={!chart}><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={[{ name: "Pendientes", value: chart?.ordersByState.pending ?? 0 }, { name: "Parciales", value: chart?.ordersByState.partial ?? 0 }, { name: "Completados", value: chart?.ordersByState.completed ?? 0 }]} dataKey="value" nameKey="name" outerRadius={76} label>{[0, 1, 2].map((i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></ChartCard>
    </section>

    <section className="grid min-w-0 gap-3 lg:grid-cols-2" aria-label="Detalle operativo">
      <DetailCard title="Detalle de ventas" href={link("reporteria/pos")} empty={!data?.details.sales.length}><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="text-slate-500"><tr><th className="px-2 py-2">Fecha/hora</th>{!isUser ? <><th className="px-2 py-2">Sucursal</th><th className="px-2 py-2">Terminal</th><th className="px-2 py-2">Cajero</th></> : null}<th className="px-2 py-2 text-right">Importe</th></tr></thead><tbody>{data?.details.sales.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-2 py-2">{shortDate(row.createdAt)}</td>{!isUser ? <><td className="px-2 py-2">{row.branch ?? "—"}</td><td className="px-2 py-2">{row.terminal ?? "—"}</td><td className="px-2 py-2">{row.cashier ?? "—"}</td></> : null}<td className="px-2 py-2 text-right font-semibold">{money(row.amount)}</td></tr>)}</tbody></table></div></DetailCard>
      <DetailCard title="Detalle de movimientos de caja" href={link("reporteria/caja?tab=movements")} empty={!data?.details.cash.length}><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="text-slate-500"><tr><th className="px-2 py-2">Fecha/hora</th>{!isUser ? <><th className="px-2 py-2">Sucursal</th><th className="px-2 py-2">Terminal</th><th className="px-2 py-2">Cajero</th></> : null}<th className="px-2 py-2">Tipo</th><th className="px-2 py-2 text-right">Importe</th></tr></thead><tbody>{data?.details.cash.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700"><td className="px-2 py-2">{shortDate(row.createdAt)}</td>{!isUser ? <><td className="px-2 py-2">{row.branch ?? "—"}</td><td className="px-2 py-2">{row.terminal ?? "—"}</td><td className="px-2 py-2">{row.cashier ?? "—"}</td></> : null}<td className="px-2 py-2"><span className={row.direction === "IN" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{row.direction === "IN" ? "Ingreso" : "Egreso"}</span> · {row.type}</td><td className="px-2 py-2 text-right font-semibold">{money(row.amount)}</td></tr>)}</tbody></table></div></DetailCard>
    </section>
  </main>;
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) { return <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="mb-2 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-600" /><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2></div>{empty ? <p className="flex h-[220px] items-center justify-center text-sm text-slate-500">Sin datos para este periodo.</p> : <div className="min-w-0" aria-label={`${title}. Alternativa textual disponible en los indicadores y leyenda.`}>{children}</div>}</article>; }
function DetailCard({ title, href, empty, children }: { title: string; href: string; empty: boolean; children: React.ReactNode }) { return <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2><Link href={href} className="shrink-0 text-xs font-semibold text-blue-700 hover:underline">Ver todo</Link></div>{empty ? <p className="py-8 text-center text-sm text-slate-500">Sin datos para este periodo.</p> : children}</article>; }
