"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/request";
import { fetchOperationalDashboard, type OperationalDashboardResponse } from "../dashboard";
import { useAppSelector } from "../../../store/hooks";

const empty: OperationalDashboardResponse = { metrics: {}, dailyTrend: [], statusDistribution: [], branches: [] };
const money = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const labels: Record<string, string> = { ACCEPTED: "Aceptadas", REJECTED: "Rechazadas", PENDING: "Pendientes", PROCESSING: "Procesando", TECHNICAL_ERROR: "Error técnico", CANCELLED: "Canceladas", NO_DOCUMENT: "Sin documento" };
const title = (status: string) => labels[status] ?? status;

export const OperationalDashboardPage = () => {
  const params = useParams<{ tenant: string }>();
  const role = useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "").toUpperCase();
  const [period, setPeriod] = useState("TODAY");
  const [branchId, setBranchId] = useState("");
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; setLoading(true); setError(null); void fetchOperationalDashboard({ period, branchId: branchId || undefined }).then((value) => { if (active) setData(value); }).catch((cause) => { if (active) setError(cause instanceof ApiError && cause.status === 403 ? "No tienes un turno abierto o permisos para este alcance." : "No se pudo cargar Gestión Operativa."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [period, branchId]);
  const m = data.metrics;
  const card = (name: string, value: string | number) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p></div>;
  const max = Math.max(1, ...data.dailyTrend.map((item) => item.salesAmount));
  return <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
    <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">Gestión Operativa</p><h1 className="mt-2 text-2xl font-bold text-slate-950">Resumen de operación</h1><p className="mt-1 text-sm text-slate-500">Métricas reales del alcance autorizado y facturación electrónica.</p><div className="mt-5 flex flex-wrap gap-3"><label className="text-sm text-slate-700">Periodo<select aria-label="Periodo" className="ml-2 rounded-lg border border-slate-200 px-3 py-2" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="TODAY">Hoy</option><option value="LAST_7_DAYS">Últimos 7 días</option><option value="LAST_30_DAYS">Últimos 30 días</option></select></label>{role !== "USER" && data.branches.length > 1 ? <label className="text-sm text-slate-700">Sucursal<select aria-label="Sucursal" className="ml-2 rounded-lg border border-slate-200 px-3 py-2" value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Todas autorizadas</option>{data.branches.map((b) => <option key={b.id} value={b.id}>{b.name ?? b.id}</option>)}</select></label> : null}</div></header>
    {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">Cargando métricas...</div> : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">{error}</div> : <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{card("Ventas", m.totalSalesCount ?? 0)}{card("Valor vendido", money(m.totalSalesAmount ?? 0))}{card("Ticket promedio", money(m.averageTicket ?? 0))}{card("Facturas electrónicas", m.electronicDocumentsCount ?? 0)}{card("Aceptadas", m.electronicAcceptedCount ?? 0)}{card("Rechazadas / errores", m.documentsRequiringAttention ?? 0)}{card("Tasa de aceptación", `${((m.electronicAcceptanceRate ?? 0) * 100).toFixed(1)}%`)}{card("Valor aceptado", money(m.electronicAcceptedAmount ?? 0))}</section>
      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-slate-950">Evolución diaria</h2><Link className="text-sm font-semibold text-blue-700" href={`/${params.tenant}/operations/sales`}>Ver todas las ventas</Link></div>{data.dailyTrend.length === 0 ? <p className="py-10 text-sm text-slate-500">No hay datos para este periodo.</p> : <div className="mt-5 space-y-3">{data.dailyTrend.map((item) => <div key={item.date} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm"><span className="text-slate-500">{item.date}</span><div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.max(2, item.salesAmount / max * 100)}%` }} /></div><span className="text-right font-semibold">{money(item.salesAmount)}</span></div>)}</div>}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-950">Estado FE</h2><div className="mt-4 space-y-3">{data.statusDistribution.filter((x) => x.status !== "NO_DOCUMENT").map((x) => <Link key={x.status} href={`/${params.tenant}/operations/sales?electronicBillingStatus=${encodeURIComponent(x.status)}`} className="flex justify-between rounded-lg p-2 text-sm hover:bg-slate-50"><span>{title(x.status)}</span><b>{x.count}</b></Link>)}{(m.documentsRequiringAttention ?? 0) > 0 ? <Link className="mt-4 block rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900" href={`/${params.tenant}/operations/sales?electronicBillingStatus=REJECTED`}>Ver requieren atención</Link> : <p className="text-sm text-slate-500">Sin documentos que requieran atención.</p>}</div></div></section>
    </>}
  </main>;
};
