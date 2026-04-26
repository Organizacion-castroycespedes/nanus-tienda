"use client";

import Link from "next/link";
import { ArrowRight, BarChart2, Play, ShoppingCart, Users } from "lucide-react";

const DashboardMockup = () => (
  <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
    <div className="flex flex-col">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-rose-400" />
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="ml-4 flex flex-1 items-center gap-2 rounded-md bg-white px-3 py-1 text-xs text-slate-400 border border-slate-200">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          app.manus.com/dashboard
        </div>
      </div>

      {/* App content */}
      <div className="flex" style={{ height: 380 }}>
        {/* Sidebar */}
        <div className="w-44 border-r border-slate-800 bg-slate-900 px-3 py-4">
          <div className="mb-5 flex items-center gap-2 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-bold text-white">M</div>
            <span className="text-sm font-semibold text-white">Manus</span>
          </div>
          <nav className="space-y-0.5">
            {[
              { label: "Dashboard", icon: "grid", active: true },
              { label: "Ventas POS", icon: "cart", active: false },
              { label: "Inventario", icon: "box", active: false },
              { label: "Clientes", icon: "users", active: false },
              { label: "Compras", icon: "truck", active: false },
              { label: "Finanzas", icon: "wallet", active: false },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-slate-600"}`} />
                {label}
              </div>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="rounded-md bg-slate-800 px-2.5 py-2">
              <p className="text-xs text-slate-400">Tienda</p>
              <p className="text-xs font-medium text-white">Minimarket Don José</p>
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-hidden bg-slate-50 p-4">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Dashboard</p>
              <p className="text-xs text-slate-500">Viernes 26 Abril, 2024 - 14:32</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-blue-100 text-center text-xs font-medium text-blue-700 leading-6">JR</div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[
              { label: "Ventas hoy", value: "S/ 2,847.50", sub: "42 transacciones", color: "blue", trend: "+18.2%" },
              { label: "Ticket promedio", value: "S/ 67.80", sub: "vs S/ 58.40 ayer", color: "emerald", trend: "+16.1%" },
              { label: "Stock bajo", value: "8 productos", sub: "Requieren pedido", color: "amber", trend: null },
              { label: "Por cobrar", value: "S/ 1,420.00", sub: "12 clientes", color: "rose", trend: null },
            ].map(({ label, value, sub, color, trend }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-slate-500">{label}</p>
                  {trend && <span className="text-xs font-semibold text-emerald-600">{trend}</span>}
                </div>
                <p className={`mt-1 text-sm font-bold text-${color}-600`}>{value}</p>
                <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
              </div>
            ))}
          </div>

          {/* Bottom section */}
          <div className="grid grid-cols-5 gap-2">
            {/* Chart */}
            <div className="col-span-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">Ventas por hora - Hoy</p>
                <div className="flex gap-1">
                  {["1D", "7D", "30D"].map((p) => (
                    <button key={p} className={`rounded px-1.5 py-0.5 text-xs ${p === "1D" ? "bg-blue-100 text-blue-700 font-medium" : "text-slate-400"}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-end justify-between gap-1 px-1" style={{ height: 60 }}>
                {[
                  { h: 15, l: "8am", v: "85" },
                  { h: 35, l: "9am", v: "210" },
                  { h: 55, l: "10am", v: "340" },
                  { h: 45, l: "11am", v: "285" },
                  { h: 75, l: "12pm", v: "520" },
                  { h: 90, l: "1pm", v: "680" },
                  { h: 60, l: "2pm", v: "412" },
                  { h: 25, l: "3pm", v: "145" },
                ].map(({ h, l }) => (
                  <div key={l} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-gradient-to-t from-blue-600 to-blue-400"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-xs text-slate-400">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent transactions */}
            <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="mb-2 text-xs font-semibold text-slate-700">Últimas ventas</p>
              <div className="space-y-1.5">
                {[
                  { time: "14:28", items: "3 items", total: "S/ 45.50", method: "Efectivo" },
                  { time: "14:15", items: "1 item", total: "S/ 12.00", method: "Yape" },
                  { time: "14:02", items: "5 items", total: "S/ 89.80", method: "Tarjeta" },
                  { time: "13:48", items: "2 items", total: "S/ 28.50", method: "Efectivo" },
                ].map(({ time, items, total, method }) => (
                  <div key={time} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{total}</p>
                      <p className="text-xs text-slate-400">{time} - {items}</p>
                    </div>
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                      method === "Efectivo" ? "bg-emerald-100 text-emerald-700" :
                      method === "Yape" ? "bg-violet-100 text-violet-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{method}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Hero = () => (
  <section className="relative overflow-hidden bg-white px-6 pb-16 pt-24 md:pb-24 md:pt-32">
    {/* Subtle background grid */}
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage:
          "linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    />
    <div className="relative mx-auto max-w-6xl">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* Left: text */}
        <div>
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Plataforma SaaS para negocios
          </span>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
            Controla tus ventas, inventario y dinero{" "}
            <span className="text-blue-600">sin complicaciones</span>
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-slate-600">
            Manus es el sistema que usan minimarkets, tiendas y pequeños negocios para ver exactamente cuánto venden, qué falta en inventario y cuánto dinero tienen. Un solo lugar para POS, inventario, compras, clientes y finanzas.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Empezar gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => {
                alert("Demo en desarrollo - Pronto disponible");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <Play className="h-4 w-4" />
              Ver demo
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Sin tarjeta de credito. Configura tu negocio en minutos.
          </p>
        </div>
        {/* Right: dashboard mockup */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-blue-50 opacity-60" />
          <div className="relative">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default Hero;
