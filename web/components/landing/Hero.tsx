"use client";

import Link from "next/link";
import { ArrowRight, BarChart2, Play, ShoppingCart, Users } from "lucide-react";

const DashboardMockup = () => (
  <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
    {/* Browser frame */}
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-25 px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-rose-400" />
        <div className="h-3 w-3 rounded-full bg-amber-400" />
        <div className="h-3 w-3 rounded-full bg-emerald-400" />
        <div className="ml-4 flex-1">
          <div className="h-2 w-48 rounded bg-slate-200" />
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex h-96">
        {/* Sidebar */}
        <div className="w-48 border-r border-slate-100 bg-slate-900 px-4 py-6">
          {/* Logo placeholder */}
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600" />
            <div className="h-2.5 w-20 rounded bg-white/40" />
          </div>

          {/* Menu items */}
          <nav className="space-y-1">
            {[
              { label: "Dashboard", active: true },
              { label: "Ventas POS", active: false },
              { label: "Inventario", active: false },
              { label: "Clientes", active: false },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5"
                }`}
              >
                <div className="h-2 w-2 rounded-sm bg-white/30" />
                <span>{label}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50 to-white p-6">
          <div className="space-y-4">
            {/* Top metrics row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Ventas hoy", value: "$2,480", trend: "+12%", icon: "💰", color: "from-blue-50" },
                { label: "Órdenes", value: "34", trend: "+5", icon: "📦", color: "from-emerald-50" },
                { label: "Stock Bajo", value: "12", icon: "⚠️", color: "from-amber-50" },
                { label: "Por cobrar", value: "$1,240", icon: "👥", color: "from-violet-50" },
              ].map(({ label, value, trend, icon, color }) => (
                <div
                  key={label}
                  className={`rounded-lg border border-slate-200 bg-gradient-to-br ${color} to-white px-3 py-2.5 shadow-sm`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-lg">{icon}</span>
                    {trend && (
                      <span className="text-xs font-semibold text-emerald-600">
                        {trend}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Sales chart */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-600">
                  Ventas por hora
                </p>
                <div className="mt-2 flex items-end gap-1" style={{ height: 40 }}>
                  {[35, 52, 48, 68, 55, 75, 62, 88].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-gradient-to-t from-blue-600 to-blue-400"
                      style={{ height: `${h}%`, opacity: 0.6 + (i / 8) * 0.4 }}
                    />
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-600">
                  Top Categorías
                </p>
                <div className="mt-2 space-y-1.5">
                  {[
                    { name: "Alimentos", width: 85 },
                    { name: "Bebidas", width: 72 },
                    { name: "Otros", width: 45 },
                  ].map(({ name, width }) => (
                    <div key={name} className="flex items-center gap-2">
                      <div className="w-12 text-xs text-slate-500">{name}</div>
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
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
