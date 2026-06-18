"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  CreditCard,
  ShoppingCart,
  BarChart3,
} from "lucide-react";

const chips = [
  { label: "POS", icon: ShoppingCart },
  { label: "Inventario", icon: Boxes },
  { label: "Caja", icon: CreditCard },
  { label: "Pedidos", icon: ClipboardList },
  { label: "Reportes", icon: BarChart3 },
];

const ProductMockup = () => (
  <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
    {/* Browser chrome */}
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
      <div className="flex gap-1.5">
        <span className="h-3 w-3 rounded-full bg-rose-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
      </div>
      <div className="ml-3 flex flex-1 items-center rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-400">
        app.manus.com
      </div>
    </div>

    {/* Content: a clean POS-style screen */}
    <div className="grid grid-cols-1 gap-0 sm:grid-cols-[1fr_280px]">
      {/* Cart / sale */}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Venta #1847</p>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            En curso
          </span>
        </div>
        <div className="space-y-2">
          {[
            { name: "Arroz Costeño 1kg", qty: "x2", price: "S/ 7.80" },
            { name: "Aceite Primor 1L", qty: "x1", price: "S/ 12.50" },
            { name: "Leche Gloria 400g", qty: "x3", price: "S/ 11.70" },
            { name: "Fideos Don Vittorio", qty: "x2", price: "S/ 6.40" },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div>
                <p className="text-xs font-medium text-slate-700">{item.name}</p>
                <p className="text-xs text-slate-400">{item.qty}</p>
              </div>
              <span className="text-xs font-semibold text-slate-900">
                {item.price}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals / payment */}
      <div className="border-t border-slate-100 bg-slate-50 p-4 sm:border-l sm:border-t-0">
        <p className="text-xs font-medium text-slate-500">Total a cobrar</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">S/ 38.40</p>
        <div className="mt-4 space-y-2">
          {["Efectivo", "Tarjeta", "Yape / Plin"].map((m, i) => (
            <button
              key={m}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium ${
                i === 0
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-medium text-emerald-700">Caja abierta</p>
          <p className="text-xs text-emerald-600">Turno: 08:00 - 14:32</p>
        </div>
      </div>
    </div>
  </div>
);

const Hero = () => (
  <section className="relative overflow-hidden bg-white px-6 pb-16 pt-28 md:pb-24 md:pt-36">
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
        <div>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Software de gestión para tu negocio
          </span>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-[3.4rem]">
            Controla ventas, inventario, caja y pedidos{" "}
            <span className="text-blue-600">desde un solo lugar</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-slate-600">
            Manus POS es el sistema operativo de tu tienda o minimarket: vende
            rápido, mantén tu stock al día, cuadra la caja y haz seguimiento a
            tus pedidos y clientes sin complicaciones.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#contacto"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Solicitar demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#funcionalidades"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              Ver funcionalidades
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {chips.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-blue-50 opacity-60" />
          <div className="relative">
            <ProductMockup />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default Hero;
