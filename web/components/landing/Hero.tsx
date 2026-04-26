import Link from "next/link";
import { ArrowRight, BarChart2, Play, ShoppingCart, Users } from "lucide-react";

const DashboardMockup = () => (
  <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
    {/* Top bar */}
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
      <div className="h-3 w-3 rounded-full bg-rose-400" />
      <div className="h-3 w-3 rounded-full bg-amber-400" />
      <div className="h-3 w-3 rounded-full bg-emerald-400" />
      <div className="ml-4 h-2 w-32 rounded bg-slate-200" />
    </div>
    {/* Content */}
    <div className="flex">
      {/* Sidebar */}
      <div className="w-40 border-r border-slate-100 bg-slate-900 px-3 py-4">
        <div className="mb-4 px-2">
          <div className="h-2 w-16 rounded bg-white/30" />
        </div>
        {["Dashboard", "POS", "Inventario", "Clientes", "Compras"].map(
          (item) => (
            <div
              key={item}
              className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10"
            >
              <div className="h-2 w-2 rounded-sm bg-white/20" />
              <div className="h-1.5 rounded bg-white/30" style={{ width: `${item.length * 5}px` }} />
            </div>
          )
        )}
      </div>
      {/* Main area */}
      <div className="flex-1 p-4">
        {/* POS Section */}
        <div className="mb-4 rounded-xl border border-slate-100 bg-gradient-to-br from-blue-50 to-blue-25 p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="h-2 w-24 rounded bg-slate-200" />
            <div className="text-xs font-semibold text-blue-700">POS</div>
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 48 }}>
            {[40, 60, 55, 75, 65, 85, 95, 80].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-blue-500"
                style={{ height: `${h}%`, opacity: 0.5 + (i / 8) * 0.5 }}
              />
            ))}
          </div>
          <div className="mt-2 text-xs text-slate-500">Ventas por hora</div>
        </div>

        {/* Key metrics grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Ventas hoy", value: "$2,480", icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Stock bajo", value: "12", icon: "⚠️", color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Ingresos", value: "$18,320", icon: BarChart2, color: "text-violet-600", bg: "bg-violet-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
              <div className={`mb-1.5 inline-flex rounded-lg p-1 ${bg}`}>
                {typeof Icon === "string" ? (
                  <span className="text-sm">{Icon}</span>
                ) : (
                  <Icon className={`h-3 w-3 ${color}`} />
                )}
              </div>
              <p className="text-xs font-semibold text-slate-800">{value}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{label}</p>
            </div>
          ))}
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
